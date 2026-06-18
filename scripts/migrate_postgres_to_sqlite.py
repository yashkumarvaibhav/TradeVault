#!/usr/bin/env python3
"""One-time data migration from a Postgres source to local SQLite.

Usage:
  SOURCE_DATABASE_URL='postgresql://...' python scripts/migrate_postgres_to_sqlite.py
  SOURCE_DATABASE_URL='postgresql://...' python scripts/migrate_postgres_to_sqlite.py --replace /path/to/trading_journal.db

The script refuses to write into a non-empty SQLite database unless --replace is
passed. When --replace is used and the SQLite file already exists, a timestamped
backup is created next to it first.
"""

import os
import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

import psycopg
from psycopg.rows import dict_row


TABLES = ['users', 'instruments', 'close_reasons', 'strategies', 'playbooks', 'trades', 'trade_attachments']
DELETE_ORDER = ['trade_attachments', 'trades', 'instruments', 'close_reasons', 'strategies', 'playbooks', 'users']


def parse_args():
    replace = False
    sqlite_path = None
    for arg in sys.argv[1:]:
        if arg == '--replace':
            replace = True
        elif sqlite_path is None:
            sqlite_path = arg
        else:
            raise SystemExit(f'Unexpected argument: {arg}')

    return replace, sqlite_path or os.environ.get('TRADEVAULT_DB_PATH', './trading_journal.db')


def require_source_database_url() -> str:
    database_url = (
        os.environ.get('SOURCE_DATABASE_URL')
        or os.environ.get('DATABASE_URL')
        or ''
    ).strip()
    if not database_url:
        raise SystemExit('SOURCE_DATABASE_URL is required (Postgres connection string)')
    if not (database_url.startswith('postgres://') or database_url.startswith('postgresql://')):
        raise SystemExit('SOURCE_DATABASE_URL must start with postgres:// or postgresql://')
    return database_url


def load_sqlite_schema():
    saved_database_url = os.environ.pop('DATABASE_URL', None)
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from app import SQLITE_SCHEMA
        return SQLITE_SCHEMA
    finally:
        if saved_database_url is not None:
            os.environ['DATABASE_URL'] = saved_database_url


def fetch_source_columns(pg_conn, table):
    rows = pg_conn.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
        """,
        (table,),
    ).fetchall()
    return [row['column_name'] for row in rows]


def fetch_sqlite_columns(sqlite_conn, table):
    rows = sqlite_conn.execute(f'PRAGMA table_info({table})').fetchall()
    return [row['name'] for row in rows]


def table_counts(sqlite_conn):
    counts = {}
    for table in TABLES:
        counts[table] = sqlite_conn.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
    return counts


def backup_sqlite(sqlite_path):
    path = Path(sqlite_path)
    if not path.exists():
        return None
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = path.with_suffix(path.suffix + f'.bak-{timestamp}')
    shutil.copy2(path, backup_path)
    return backup_path


def reset_sqlite(sqlite_conn):
    sqlite_conn.execute('PRAGMA foreign_keys=OFF')
    try:
        for table in DELETE_ORDER:
            sqlite_conn.execute(f'DELETE FROM {table}')
        sqlite_conn.execute('DELETE FROM sqlite_sequence WHERE name IN ({})'.format(
            ','.join(['?'] * len(TABLES))
        ), TABLES)
        sqlite_conn.commit()
    finally:
        sqlite_conn.execute('PRAGMA foreign_keys=ON')


def main():
    replace, sqlite_path = parse_args()
    source_database_url = require_source_database_url()
    sqlite_schema = load_sqlite_schema()

    sqlite_path = os.path.abspath(sqlite_path)
    os.makedirs(os.path.dirname(sqlite_path) or '.', exist_ok=True)

    backup_path = backup_sqlite(sqlite_path) if replace else None

    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_conn.execute('PRAGMA foreign_keys=ON')
    sqlite_conn.executescript(sqlite_schema)

    counts = table_counts(sqlite_conn)
    if any(counts.values()) and not replace:
        sqlite_conn.close()
        details = ', '.join(f'{table}={count}' for table, count in counts.items())
        raise SystemExit(
            f'SQLite destination is not empty ({details}). '
            'Re-run with --replace to overwrite after taking a backup.'
        )

    if replace:
        reset_sqlite(sqlite_conn)

    pg_conn = psycopg.connect(source_database_url, row_factory=dict_row)

    try:
        migrated = {}
        for table in TABLES:
            source_columns = fetch_source_columns(pg_conn, table)
            sqlite_columns = fetch_sqlite_columns(sqlite_conn, table)
            columns = [column for column in source_columns if column in sqlite_columns]
            if not columns:
                migrated[table] = 0
                continue

            col_sql = ', '.join(columns)
            rows = pg_conn.execute(f'SELECT {col_sql} FROM {table} ORDER BY id').fetchall()
            if not rows:
                migrated[table] = 0
                continue

            placeholders = ', '.join(['?'] * len(columns))
            insert_sql = f'INSERT INTO {table} ({col_sql}) VALUES ({placeholders})'
            for row in rows:
                sqlite_conn.execute(insert_sql, tuple(row[column] for column in columns))
            migrated[table] = len(rows)

        sqlite_conn.commit()

        print('Migration completed successfully.')
        if backup_path:
            print(f'  backup: {backup_path}')
        print(f'  sqlite: {sqlite_path}')
        for table in TABLES:
            print(f'  {table}: {migrated.get(table, 0)} rows')

    except Exception:
        sqlite_conn.rollback()
        raise
    finally:
        pg_conn.close()
        sqlite_conn.close()


if __name__ == '__main__':
    main()

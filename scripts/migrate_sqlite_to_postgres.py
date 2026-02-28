#!/usr/bin/env python3
"""One-time data migration from local SQLite to Postgres/Supabase.

Usage:
  DATABASE_URL='postgresql://...' python scripts/migrate_sqlite_to_postgres.py
  DATABASE_URL='postgresql://...' python scripts/migrate_sqlite_to_postgres.py /path/to/trading_journal.db
"""

import os
import sqlite3
import sys

import psycopg


TABLES = ['users', 'instruments', 'trades', 'close_reasons', 'strategies']


def resolve_sqlite_path() -> str:
    if len(sys.argv) > 1:
        return sys.argv[1]
    return os.environ.get('TRADEVAULT_DB_PATH', './trading_journal.db')


def require_database_url() -> str:
    database_url = os.environ.get('DATABASE_URL', '').strip()
    if not database_url:
        raise SystemExit('DATABASE_URL is required (Supabase/Postgres connection string)')
    if not (database_url.startswith('postgres://') or database_url.startswith('postgresql://')):
        raise SystemExit('DATABASE_URL must start with postgres:// or postgresql://')
    return database_url


def fetch_table_columns(sqlite_conn: sqlite3.Connection, table: str):
    info_rows = sqlite_conn.execute(f'PRAGMA table_info({table})').fetchall()
    return [row[1] for row in info_rows]


def main():
    sqlite_path = resolve_sqlite_path()
    database_url = require_database_url()

    if not os.path.exists(sqlite_path):
        raise SystemExit(f'SQLite file not found: {sqlite_path}')

    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row

    pg_conn = psycopg.connect(database_url)

    try:
        # Clear destination tables first to keep IDs/foreign keys deterministic.
        for table in TABLES:
            pg_conn.execute(f'TRUNCATE TABLE {table} RESTART IDENTITY CASCADE')

        migrated = {}
        for table in TABLES:
            columns = fetch_table_columns(sqlite_conn, table)
            if not columns:
                migrated[table] = 0
                continue

            rows = sqlite_conn.execute(f'SELECT * FROM {table} ORDER BY id').fetchall()
            if not rows:
                migrated[table] = 0
                continue

            col_sql = ', '.join(columns)
            placeholder_sql = ', '.join(['%s'] * len(columns))
            insert_sql = f'INSERT INTO {table} ({col_sql}) VALUES ({placeholder_sql})'

            for row in rows:
                pg_conn.execute(insert_sql, tuple(row[col] for col in columns))

            # Keep sequence aligned with imported IDs.
            pg_conn.execute(
                f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM {table}), 1), true)"
            )
            migrated[table] = len(rows)

        pg_conn.commit()

        print('Migration completed successfully.')
        for table in TABLES:
            print(f'  {table}: {migrated.get(table, 0)} rows')

    except Exception:
        pg_conn.rollback()
        raise
    finally:
        sqlite_conn.close()
        pg_conn.close()


if __name__ == '__main__':
    main()

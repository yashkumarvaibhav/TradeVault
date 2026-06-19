import os
import sqlite3
import hashlib
import secrets
import time
import io
import base64
import re
from datetime import datetime, timedelta
from functools import wraps
from threading import Lock

import json

import pyotp
import qrcode
from flask import (Flask, render_template, request, redirect, url_for,
                   session, jsonify, flash, send_file, Response)
from werkzeug.utils import secure_filename

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:
    psycopg = None
    dict_row = None

app = Flask(__name__,
            template_folder='templates',
            static_folder='static')

# Use a stable secret key in production so sessions survive restarts.
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))
app.permanent_session_lifetime = timedelta(days=30)
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = os.environ.get('SESSION_COOKIE_SECURE', 'false').lower() == 'true'
app.config['MAX_CONTENT_LENGTH'] = int(os.environ.get('TRADEVAULT_MAX_UPLOAD_BYTES', 5 * 1024 * 1024))

MAX_LOGIN_ATTEMPTS = 3
CSRF_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}
LOT_SIZED_CATEGORIES = {'Index', 'US Index', 'Commodity'}
ALLOWED_DIRECTIONS = {'Long', 'Short'}
ALLOWED_CURRENCIES = {'INR', 'USD'}
ALLOWED_STATUSES = {'open', 'closed'}
ALLOWED_ATTACHMENT_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
ALLOWED_ATTACHMENT_MIME_TYPES = {
    'image/png', 'image/jpeg', 'image/webp', 'image/gif'
}
TRADE_SIGNATURE_FIELDS = (
    'asset_category', 'subcategory', 'trading_style', 'instrument', 'direction',
    'instrument_type', 'platform', 'currency', 'entry_price', 'entry_datetime',
    'stop_loss', 'planned_target', 'position_size', 'exit_price',
    'exit_datetime', 'strategy', 'playbook_id', 'status'
)
TRADE_NUMERIC_FIELDS = {
    'lot_size', 'entry_price', 'stop_loss', 'planned_target',
    'position_size', 'exit_price', 'manual_pnl', 'execution_score',
    'rule_followed', 'playbook_id'
}
TRADE_REVIEW_FIELDS = {
    'execution_score', 'rule_followed', 'mistake_tags', 'setup_quality',
    'review_notes'
}


class ReverseProxied:
    """Middleware to handle SCRIPT_NAME / URL prefix when behind a reverse proxy.
    Nginx should set X-Script-Name header to /TradeVault."""
    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        script_name = environ.get('HTTP_X_SCRIPT_NAME', '')
        if script_name:
            environ['SCRIPT_NAME'] = script_name
            path_info = environ.get('PATH_INFO', '')
            if path_info.startswith(script_name):
                environ['PATH_INFO'] = path_info[len(script_name):]
        return self.app(environ, start_response)


app.wsgi_app = ReverseProxied(app.wsgi_app)


def csrf_token():
    token = session.get('_csrf_token')
    if not token:
        token = secrets.token_urlsafe(32)
        session['_csrf_token'] = token
    return token


app.jinja_env.globals['csrf_token'] = csrf_token


def static_url(filename):
    path = os.path.join(app.static_folder, filename)
    version = int(os.path.getmtime(path)) if os.path.exists(path) else int(time.time())
    return url_for('static', filename=filename, v=version)


app.jinja_env.globals['static_url'] = static_url


@app.before_request
def protect_csrf():
    if request.method not in CSRF_METHODS:
        return None

    expected = session.get('_csrf_token')
    supplied = request.headers.get('X-CSRF-Token') or request.form.get('csrf_token')
    if expected and supplied and secrets.compare_digest(expected, supplied):
        return None

    if request.path.startswith('/api/'):
        return jsonify({'error': 'Your session security token expired. Refresh the page and retry.'}), 400

    flash('Your session expired. Please try again.', 'error')
    return redirect(request.referrer or url_for('landing'))


@app.after_request
def set_security_headers(response):
    response.headers.setdefault('X-Content-Type-Options', 'nosniff')
    response.headers.setdefault('X-Frame-Options', 'DENY')
    response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.setdefault('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    return response

DATABASE_URL = os.environ.get('DATABASE_URL', '').strip()
USE_POSTGRES = DATABASE_URL.startswith('postgres://') or DATABASE_URL.startswith('postgresql://')

SQLITE_DATABASE = os.environ.get(
    'TRADEVAULT_DB_PATH',
    os.path.join(os.path.dirname(__file__), 'trading_journal.db')
)
UPLOAD_ROOT = os.environ.get(
    'TRADEVAULT_UPLOAD_DIR',
    os.path.join(os.path.dirname(SQLITE_DATABASE) or os.path.dirname(__file__), 'uploads')
)
if not USE_POSTGRES:
    sqlite_dir = os.path.dirname(SQLITE_DATABASE)
    if sqlite_dir:
        os.makedirs(sqlite_dir, exist_ok=True)

DB_INTEGRITY_ERRORS = (sqlite3.IntegrityError,)
if USE_POSTGRES and psycopg is not None:
    DB_INTEGRITY_ERRORS = DB_INTEGRITY_ERRORS + (psycopg.IntegrityError,)

SQLITE_SCHEMA = '''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        totp_secret TEXT NOT NULL,
        totp_verified INTEGER NOT NULL DEFAULT 0,
        failed_login_attempts INTEGER NOT NULL DEFAULT 0,
        account_locked INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS instruments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        asset_category TEXT NOT NULL,
        subcategory TEXT DEFAULT '',
        trading_style TEXT DEFAULT '',
        instrument_type TEXT DEFAULT '',
        lot_size REAL DEFAULT 0,
        platform TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, name)
    );
    CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        asset_category TEXT NOT NULL,
        subcategory TEXT,
        trading_style TEXT NOT NULL,
        instrument TEXT NOT NULL,
        direction TEXT NOT NULL DEFAULT 'Long',
        instrument_type TEXT DEFAULT '',
        lot_size REAL DEFAULT 0,
        platform TEXT DEFAULT '',
        currency TEXT DEFAULT 'INR',
        entry_price REAL NOT NULL,
        entry_datetime TEXT NOT NULL,
        stop_loss REAL NOT NULL,
        planned_target REAL,
        position_size REAL NOT NULL,
        entry_notes TEXT DEFAULT '',
        exit_price REAL,
        exit_datetime TEXT,
        exit_notes TEXT DEFAULT '',
        close_reason TEXT DEFAULT '',
        psychology TEXT DEFAULT '',
        psychology_detail TEXT DEFAULT '',
        execution_score INTEGER,
        rule_followed INTEGER NOT NULL DEFAULT 0,
        mistake_tags TEXT DEFAULT '',
        setup_quality TEXT DEFAULT '',
        review_notes TEXT DEFAULT '',
        reviewed_at TEXT,
        manual_pnl REAL,
        playbook_id INTEGER,
        strategy TEXT DEFAULT '',
        status TEXT DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS close_reasons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, reason)
    );
    CREATE TABLE IF NOT EXISTS strategies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, name)
    );
    CREATE TABLE IF NOT EXISTS playbooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        market_scope TEXT DEFAULT '',
        setup_rules TEXT DEFAULT '',
        checklist TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, name)
    );
    CREATE TABLE IF NOT EXISTS trade_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        trade_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT DEFAULT '',
        mime_type TEXT DEFAULT '',
        file_size INTEGER DEFAULT 0,
        caption TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (trade_id) REFERENCES trades(id)
    );
    CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id);
    CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
    CREATE INDEX IF NOT EXISTS idx_trades_category ON trades(asset_category);
    CREATE INDEX IF NOT EXISTS idx_instruments_user ON instruments(user_id);
    CREATE INDEX IF NOT EXISTS idx_close_reasons_user ON close_reasons(user_id);
    CREATE INDEX IF NOT EXISTS idx_strategies_user ON strategies(user_id);
    CREATE INDEX IF NOT EXISTS idx_playbooks_user ON playbooks(user_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_user ON trade_attachments(user_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_trade ON trade_attachments(trade_id);
'''

POSTGRES_SCHEMA = '''
    CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        totp_secret TEXT NOT NULL,
        totp_verified INTEGER NOT NULL DEFAULT 0,
        failed_login_attempts INTEGER NOT NULL DEFAULT 0,
        account_locked INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS instruments (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        name TEXT NOT NULL,
        asset_category TEXT NOT NULL,
        subcategory TEXT DEFAULT '',
        trading_style TEXT DEFAULT '',
        instrument_type TEXT DEFAULT '',
        lot_size REAL DEFAULT 0,
        platform TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, name)
    );
    CREATE TABLE IF NOT EXISTS trades (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        asset_category TEXT NOT NULL,
        subcategory TEXT,
        trading_style TEXT NOT NULL,
        instrument TEXT NOT NULL,
        direction TEXT NOT NULL DEFAULT 'Long',
        instrument_type TEXT DEFAULT '',
        lot_size REAL DEFAULT 0,
        platform TEXT DEFAULT '',
        currency TEXT DEFAULT 'INR',
        entry_price REAL NOT NULL,
        entry_datetime TEXT NOT NULL,
        stop_loss REAL NOT NULL,
        planned_target REAL,
        position_size REAL NOT NULL,
        entry_notes TEXT DEFAULT '',
        exit_price REAL,
        exit_datetime TEXT,
        exit_notes TEXT DEFAULT '',
        close_reason TEXT DEFAULT '',
        psychology TEXT DEFAULT '',
        psychology_detail TEXT DEFAULT '',
        execution_score INTEGER,
        rule_followed INTEGER NOT NULL DEFAULT 0,
        mistake_tags TEXT DEFAULT '',
        setup_quality TEXT DEFAULT '',
        review_notes TEXT DEFAULT '',
        reviewed_at TEXT,
        manual_pnl REAL,
        playbook_id BIGINT,
        strategy TEXT DEFAULT '',
        status TEXT DEFAULT 'open',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS close_reasons (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        reason TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, reason)
    );
    CREATE TABLE IF NOT EXISTS strategies (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        name TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, name)
    );
    CREATE TABLE IF NOT EXISTS playbooks (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        name TEXT NOT NULL,
        market_scope TEXT DEFAULT '',
        setup_rules TEXT DEFAULT '',
        checklist TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, name)
    );
    CREATE TABLE IF NOT EXISTS trade_attachments (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        trade_id BIGINT NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT DEFAULT '',
        mime_type TEXT DEFAULT '',
        file_size INTEGER DEFAULT 0,
        caption TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (trade_id) REFERENCES trades(id)
    );
    CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id);
    CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
    CREATE INDEX IF NOT EXISTS idx_trades_category ON trades(asset_category);
    CREATE INDEX IF NOT EXISTS idx_instruments_user ON instruments(user_id);
    CREATE INDEX IF NOT EXISTS idx_close_reasons_user ON close_reasons(user_id);
    CREATE INDEX IF NOT EXISTS idx_strategies_user ON strategies(user_id);
    CREATE INDEX IF NOT EXISTS idx_playbooks_user ON playbooks(user_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_user ON trade_attachments(user_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_trade ON trade_attachments(trade_id);
'''


class DBConnection:
    def __init__(self, conn, backend):
        self.conn = conn
        self.backend = backend

    def _query(self, sql):
        if self.backend == 'postgres':
            return sql.replace('?', '%s')
        return sql

    def execute(self, sql, params=()):
        return self.conn.execute(self._query(sql), params)

    def executescript(self, sql_script):
        if self.backend == 'postgres':
            for statement in (s.strip() for s in sql_script.split(';')):
                if statement:
                    self.conn.execute(statement)
        else:
            self.conn.executescript(sql_script)

    def commit(self):
        self.conn.commit()

    def close(self):
        self.conn.close()


# ─── Database helpers ───────────────────────────────────────────────

_DB_INIT_LOCK = Lock()
_DB_INITIALIZED = False


def _open_db():
    if USE_POSTGRES:
        if psycopg is None:
            raise RuntimeError('DATABASE_URL is set but psycopg is not installed')
        conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
        return DBConnection(conn, 'postgres')

    conn = sqlite3.connect(SQLITE_DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return DBConnection(conn, 'sqlite')


def _get_table_columns(db, table_name):
    if db.backend == 'postgres':
        rows = db.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=?",
            (table_name,)
        ).fetchall()
        return {row['column_name'] for row in rows}

    rows = db.execute(f'PRAGMA table_info({table_name})').fetchall()
    return {row['name'] for row in rows}


def _ensure_user_security_columns(db):
    columns = _get_table_columns(db, 'users')
    if 'totp_verified' not in columns:
        db.execute('ALTER TABLE users ADD COLUMN totp_verified INTEGER NOT NULL DEFAULT 1')
    if 'failed_login_attempts' not in columns:
        db.execute('ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0')
    if 'account_locked' not in columns:
        db.execute('ALTER TABLE users ADD COLUMN account_locked INTEGER NOT NULL DEFAULT 0')


def _ensure_trade_columns(db):
    columns = _get_table_columns(db, 'trades')
    if 'planned_target' not in columns:
        db.execute('ALTER TABLE trades ADD COLUMN planned_target REAL')
    if 'execution_score' not in columns:
        db.execute('ALTER TABLE trades ADD COLUMN execution_score INTEGER')
    if 'rule_followed' not in columns:
        db.execute('ALTER TABLE trades ADD COLUMN rule_followed INTEGER NOT NULL DEFAULT 0')
    if 'mistake_tags' not in columns:
        db.execute("ALTER TABLE trades ADD COLUMN mistake_tags TEXT DEFAULT ''")
    if 'setup_quality' not in columns:
        db.execute("ALTER TABLE trades ADD COLUMN setup_quality TEXT DEFAULT ''")
    if 'review_notes' not in columns:
        db.execute("ALTER TABLE trades ADD COLUMN review_notes TEXT DEFAULT ''")
    if 'reviewed_at' not in columns:
        db.execute('ALTER TABLE trades ADD COLUMN reviewed_at TEXT')
    if 'playbook_id' not in columns:
        db.execute('ALTER TABLE trades ADD COLUMN playbook_id INTEGER')
    db.execute('CREATE INDEX IF NOT EXISTS idx_trades_playbook ON trades(playbook_id)')


def init_db():
    global _DB_INITIALIZED
    if _DB_INITIALIZED:
        return
    with _DB_INIT_LOCK:
        if _DB_INITIALIZED:
            return
        conn = _open_db()
        conn.executescript(POSTGRES_SCHEMA if USE_POSTGRES else SQLITE_SCHEMA)
        _ensure_user_security_columns(conn)
        _ensure_trade_columns(conn)
        conn.commit()
        conn.close()
        _DB_INITIALIZED = True

def get_db():
    # Lazy init avoids blocking service boot during platform port checks.
    init_db()
    return _open_db()


def insert_and_get_id(db, insert_sql, params):
    if db.backend == 'postgres':
        row = db.execute(insert_sql.rstrip(';') + ' RETURNING id', params).fetchone()
        return row['id']
    db.execute(insert_sql, params)
    return db.execute('SELECT last_insert_rowid()').fetchone()[0]


# ─── Auth helpers ─────────────────────────────────────────────────

def hash_password(password, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 310_000).hex()
    return pw_hash, salt


def is_valid_totp_code(code):
    return len(code) == 6 and code.isdigit()


def reset_login_state(db, user_id):
    db.execute(
        'UPDATE users SET failed_login_attempts=0, account_locked=0 WHERE id=?',
        (user_id,)
    )


def register_failed_login(db, user):
    attempts = int(user['failed_login_attempts'] or 0) + 1
    locked = 1 if attempts >= MAX_LOGIN_ATTEMPTS else 0
    db.execute(
        'UPDATE users SET failed_login_attempts=?, account_locked=? WHERE id=?',
        (attempts, locked, user['id'])
    )
    return attempts, bool(locked)


def request_json():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None
    return data


def parse_float_field(data, field, label, required=False, positive=False, minimum=None):
    value = data.get(field)
    if value is None or value == '':
        if required:
            raise ValueError(f'{label} is required')
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        raise ValueError(f'{label} must be a valid number')
    if positive and parsed <= 0:
        raise ValueError(f'{label} must be greater than 0')
    if minimum is not None and parsed < minimum:
        raise ValueError(f'{label} must be at least {minimum:g}')
    return parsed


def require_datetime(value, label):
    if not value:
        raise ValueError(f'{label} is required')
    try:
        datetime.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValueError(f'{label} must be a valid date and time')
    return value


def clean_text(value, max_len=500):
    value = (value or '').strip()
    if len(value) > max_len:
        return value[:max_len]
    return value


def effective_units(trade):
    position_size = float(trade.get('position_size') or 0)
    lot_size = float(trade.get('lot_size') or 0)
    if trade.get('asset_category') in LOT_SIZED_CATEGORIES and lot_size > 0:
        return position_size * lot_size
    return position_size


def calculate_trade_pnl(trade):
    if trade.get('status') != 'closed':
        return None
    if trade.get('asset_category') == 'Forex' and trade.get('manual_pnl') is not None:
        return float(trade.get('manual_pnl') or 0)
    if trade.get('exit_price') in (None, ''):
        return None

    entry_price = float(trade.get('entry_price') or 0)
    exit_price = float(trade.get('exit_price') or 0)
    units = effective_units(trade)
    if entry_price <= 0 or units <= 0:
        return None

    if trade.get('direction', 'Long') == 'Short':
        return (entry_price - exit_price) * units
    return (exit_price - entry_price) * units


def calculate_trade_pnl_pct(trade, pnl=None):
    entry_price = float(trade.get('entry_price') or 0)
    units = effective_units(trade)
    if entry_price <= 0 or units <= 0:
        return 0
    if pnl is None:
        pnl = calculate_trade_pnl(trade)
    if pnl is None:
        return 0
    return (pnl / (entry_price * units)) * 100


def calculate_planned_risk(trade):
    entry_price = float(trade.get('entry_price') or 0)
    stop_loss = float(trade.get('stop_loss') or 0)
    units = effective_units(trade)
    if entry_price <= 0 or stop_loss <= 0 or units <= 0:
        return None
    return abs(entry_price - stop_loss) * units


def calculate_planned_reward(trade):
    target = trade.get('planned_target')
    if target in (None, ''):
        return None
    entry_price = float(trade.get('entry_price') or 0)
    target = float(target or 0)
    units = effective_units(trade)
    if entry_price <= 0 or target <= 0 or units <= 0:
        return None
    if trade.get('direction', 'Long') == 'Short':
        return (entry_price - target) * units
    return (target - entry_price) * units


def calculate_planned_rr(trade):
    risk = calculate_planned_risk(trade)
    reward = calculate_planned_reward(trade)
    if not risk or reward is None or reward <= 0:
        return None
    return reward / risk


def calculate_realized_r(trade, pnl=None):
    risk = calculate_planned_risk(trade)
    if not risk:
        return None
    if pnl is None:
        pnl = calculate_trade_pnl(trade)
    if pnl is None:
        return None
    return pnl / risk


def build_return_distribution(pct_returns):
    if not pct_returns:
        return []
    buckets = {}
    for pct in pct_returns:
        bucket_start = int(pct // 2) * 2
        bucket_start = max(-100, min(600, bucket_start))
        label = f'{bucket_start}% to {bucket_start + 2}%'
        buckets[label] = buckets.get(label, 0) + 1
    return [
        {'range': label, 'count': count}
        for label, count in sorted(
            buckets.items(),
            key=lambda item: int(item[0].split('%', 1)[0])
        )
    ]


def safe_filename_part(value):
    cleaned = re.sub(r'[^A-Za-z0-9_.-]+', '_', value or 'user').strip('._')
    return cleaned[:60] or 'user'


def attachment_upload_dir(user_id, trade_id):
    return os.path.abspath(
        os.path.join(UPLOAD_ROOT, f'user_{int(user_id)}', f'trade_{int(trade_id)}')
    )


def attachment_disk_path(user_id, trade_id, filename):
    directory = attachment_upload_dir(user_id, trade_id)
    path = os.path.abspath(os.path.join(directory, filename))
    if path != directory and not path.startswith(directory + os.sep):
        raise ValueError('Invalid attachment path')
    return path


def image_signature_matches(payload, extension):
    if extension == 'png':
        return payload.startswith(b'\x89PNG\r\n\x1a\n')
    if extension in {'jpg', 'jpeg'}:
        return payload.startswith(b'\xff\xd8\xff')
    if extension == 'gif':
        return payload.startswith((b'GIF87a', b'GIF89a'))
    if extension == 'webp':
        return len(payload) >= 12 and payload[:4] == b'RIFF' and payload[8:12] == b'WEBP'
    return False


def prepare_attachment_upload(file):
    if not file or not file.filename:
        raise ValueError('Choose a chart image to upload')

    original_name = secure_filename(file.filename)[:140] or 'chart-image'
    if '.' not in original_name:
        raise ValueError('Attachment must be a PNG, JPG, WEBP, or GIF image')
    extension = original_name.rsplit('.', 1)[1].lower()
    if extension not in ALLOWED_ATTACHMENT_EXTENSIONS:
        raise ValueError('Attachment must be a PNG, JPG, WEBP, or GIF image')

    mime_type = (file.mimetype or '').lower()
    if mime_type and mime_type not in ALLOWED_ATTACHMENT_MIME_TYPES:
        raise ValueError('Attachment must be an image file')

    payload = file.read()
    if not payload:
        raise ValueError('Attachment file is empty')
    max_bytes = app.config['MAX_CONTENT_LENGTH']
    if len(payload) > max_bytes:
        limit_mb = max_bytes / (1024 * 1024)
        raise ValueError(f'Attachment must be {limit_mb:g} MB or smaller')
    if not image_signature_matches(payload, extension):
        raise ValueError('Attachment content does not match a supported image type')

    stored_extension = 'jpg' if extension == 'jpeg' else extension
    stored_name = f'{secrets.token_hex(16)}.{stored_extension}'
    return original_name, stored_name, mime_type or f'image/{stored_extension}', len(payload), payload


def serialize_attachment(row):
    attachment = dict(row)
    attachment['url'] = url_for('api_get_trade_attachment_file', attachment_id=attachment['id'])
    return attachment


def delete_attachment_file(row):
    try:
        path = attachment_disk_path(row['user_id'], row['trade_id'], row['filename'])
        os.remove(path)
    except FileNotFoundError:
        pass
    except (OSError, ValueError):
        pass

    for directory in (
        attachment_upload_dir(row['user_id'], row['trade_id']),
        os.path.abspath(os.path.join(UPLOAD_ROOT, f'user_{int(row["user_id"])}')),
    ):
        try:
            os.rmdir(directory)
        except OSError:
            pass


def normalize_signature_value(field, value):
    if value is None:
        return ''
    if field in TRADE_NUMERIC_FIELDS:
        try:
            return round(float(value), 8)
        except (TypeError, ValueError):
            return ''
    return str(value).strip()


def trade_signature(trade):
    return tuple(normalize_signature_value(field, trade.get(field)) for field in TRADE_SIGNATURE_FIELDS)


def serialize_trade(row):
    trade = dict(row)
    pnl = calculate_trade_pnl(trade)
    planned_risk = calculate_planned_risk(trade)
    planned_reward = calculate_planned_reward(trade)
    planned_rr = calculate_planned_rr(trade)
    realized_r = calculate_realized_r(trade, pnl)
    review_markers = (
        trade.get('execution_score') not in (None, ''),
        bool(trade.get('rule_followed')),
        bool((trade.get('mistake_tags') or '').strip()),
        bool((trade.get('setup_quality') or '').strip()),
        bool((trade.get('review_notes') or '').strip()),
    )
    trade['effective_units'] = round(effective_units(trade), 4)
    trade['computed_pnl'] = round(pnl, 2) if pnl is not None else None
    trade['computed_pnl_pct'] = round(calculate_trade_pnl_pct(trade, pnl), 2) if pnl is not None else None
    trade['planned_risk'] = round(planned_risk, 2) if planned_risk is not None else None
    trade['planned_reward'] = round(planned_reward, 2) if planned_reward is not None else None
    trade['planned_rr'] = round(planned_rr, 2) if planned_rr is not None else None
    trade['realized_r'] = round(realized_r, 2) if realized_r is not None else None
    trade['reviewed'] = bool(trade.get('reviewed_at') or any(review_markers))
    return trade


def normalize_bool(value):
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, (int, float)):
        return 1 if value else 0
    return 1 if str(value or '').strip().lower() in {'1', 'true', 'yes', 'on'} else 0


def has_review_signal(trade):
    return any((
        trade.get('execution_score') not in (None, ''),
        bool(normalize_bool(trade.get('rule_followed'))),
        bool((trade.get('mistake_tags') or '').strip()),
        bool((trade.get('setup_quality') or '').strip()),
        bool((trade.get('review_notes') or '').strip()),
    ))


def parse_mistake_tags(value):
    raw_tags = re.split(r'[,;\n]+', value or '')
    cleaned = []
    seen = set()
    for tag in raw_tags:
        tag = clean_text(tag, 40)
        if not tag:
            continue
        key = tag.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(tag)
    return ', '.join(cleaned[:12])


def ensure_user_playbook(db, user_id, playbook_id, active_only=True):
    if playbook_id in (None, ''):
        return None
    query = 'SELECT id FROM playbooks WHERE id=? AND user_id=?'
    params = [playbook_id, user_id]
    if active_only:
        query += ' AND active=1'
    row = db.execute(
        query,
        params
    ).fetchone()
    if not row:
        raise ValueError('Selected playbook is not available')
    return int(row['id'])


def validate_trade_fields(data, partial=False):
    required = ['asset_category', 'trading_style', 'instrument', 'entry_price',
                'entry_datetime', 'stop_loss', 'position_size', 'direction']
    if not partial:
        for field in required:
            if not data.get(field):
                raise ValueError(f'{field} is required')

    cleaned = {}
    text_fields = {
        'asset_category': 60, 'subcategory': 80, 'trading_style': 80,
        'instrument': 120, 'direction': 20, 'instrument_type': 40,
        'platform': 80, 'currency': 10, 'entry_notes': 1000,
        'exit_notes': 1000, 'close_reason': 120, 'psychology': 40,
        'psychology_detail': 120, 'strategy': 120, 'status': 20,
        'setup_quality': 10, 'review_notes': 1200
    }
    for field, max_len in text_fields.items():
        if field in data:
            cleaned[field] = clean_text(data.get(field), max_len)

    if 'mistake_tags' in data:
        cleaned['mistake_tags'] = parse_mistake_tags(data.get('mistake_tags'))

    if 'rule_followed' in data:
        cleaned['rule_followed'] = normalize_bool(data.get('rule_followed'))

    if 'execution_score' in data:
        execution_score = parse_float_field(data, 'execution_score', 'Execution score', required=False, minimum=1)
        if execution_score is not None:
            if execution_score > 5 or execution_score != int(execution_score):
                raise ValueError('Execution score must be a whole number from 1 to 5')
            execution_score = int(execution_score)
        cleaned['execution_score'] = execution_score

    if 'playbook_id' in data:
        playbook_id = parse_float_field(data, 'playbook_id', 'Playbook', required=False, minimum=1)
        if playbook_id is not None:
            if playbook_id != int(playbook_id):
                raise ValueError('Playbook must be a valid saved playbook')
            playbook_id = int(playbook_id)
        cleaned['playbook_id'] = playbook_id

    category = cleaned.get('asset_category', data.get('asset_category'))
    if category and category not in CATEGORIES:
        raise ValueError('asset_category is not supported')

    direction = cleaned.get('direction', data.get('direction', 'Long'))
    if direction and direction not in ALLOWED_DIRECTIONS:
        raise ValueError('direction must be Long or Short')
    if 'direction' in data or not partial:
        cleaned['direction'] = direction or 'Long'

    currency = cleaned.get('currency', data.get('currency', 'INR'))
    if currency and currency not in ALLOWED_CURRENCIES:
        raise ValueError('currency must be INR or USD')
    if 'currency' in data or not partial:
        cleaned['currency'] = currency or 'INR'

    if 'status' in cleaned and cleaned['status'] not in ALLOWED_STATUSES:
        raise ValueError('status must be open or closed')

    numeric_fields = {
        'entry_price': ('Entry price', True, None),
        'stop_loss': ('Stop loss', True, None),
        'planned_target': ('Planned target', False, None),
        'position_size': ('Position size', True, None),
        'lot_size': ('Lot size', False, 0),
        'exit_price': ('Exit price', False, None),
        'manual_pnl': ('Manual P&L', False, None),
    }
    for field, (label, positive, minimum) in numeric_fields.items():
        if field in data or (field in required and not partial):
            cleaned[field] = parse_float_field(
                data, field, label,
                required=field in required and not partial,
                positive=positive,
                minimum=minimum
            )

    if 'entry_datetime' in data or not partial:
        cleaned['entry_datetime'] = require_datetime(data.get('entry_datetime'), 'Entry date/time')
    if 'exit_datetime' in data and data.get('exit_datetime'):
        cleaned['exit_datetime'] = require_datetime(data.get('exit_datetime'), 'Exit date/time')
    elif 'exit_datetime' in data:
        cleaned['exit_datetime'] = ''

    if category in LOT_SIZED_CATEGORIES and (not partial or 'lot_size' in data or 'asset_category' in data):
        lot_size = cleaned.get('lot_size')
        if lot_size is None:
            lot_size = parse_float_field(data, 'lot_size', 'Lot size', required=False, minimum=0)
        if not lot_size or lot_size <= 0:
            raise ValueError('Lot size is required for lot-based assets')
        cleaned['lot_size'] = lot_size

    entry_price = cleaned.get('entry_price')
    stop_loss = cleaned.get('stop_loss')
    planned_target = cleaned.get('planned_target')
    if entry_price is not None and stop_loss is not None and direction:
        if direction == 'Long' and stop_loss >= entry_price:
            raise ValueError('Stop loss must be below entry price for long trades')
        if direction == 'Short' and stop_loss <= entry_price:
            raise ValueError('Stop loss must be above entry price for short trades')
        if planned_target is not None:
            if direction == 'Long' and planned_target <= entry_price:
                raise ValueError('Planned target must be above entry price for long trades')
            if direction == 'Short' and planned_target >= entry_price:
                raise ValueError('Planned target must be below entry price for short trades')

    return cleaned


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Login required'}), 401
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated


# ─── Routes: Landing ──────────────────────────────────────────────

@app.route('/')
def landing():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('landing.html')


# ─── Routes: Auth ─────────────────────────────────────────────────

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'GET':
        return render_template('register.html')

    username = request.form.get('username', '').strip()
    password = request.form.get('password', '')
    confirm = request.form.get('confirm_password', '')

    if not username or not password:
        flash('Username and password are required.', 'error')
        return redirect(url_for('register'))
    if len(password) < 6:
        flash('Password must be at least 6 characters.', 'error')
        return redirect(url_for('register'))
    if password != confirm:
        flash('Passwords do not match.', 'error')
        return redirect(url_for('register'))

    db = get_db()
    existing = db.execute('SELECT id FROM users WHERE username=?', (username,)).fetchone()
    if existing:
        db.close()
        flash('Username already taken.', 'error')
        return redirect(url_for('register'))

    pw_hash, salt = hash_password(password)
    totp_secret = pyotp.random_base32()

    db.execute(
        'INSERT INTO users (username, password_hash, salt, totp_secret, totp_verified) VALUES (?,?,?,?,0)',
        (username, pw_hash, salt, totp_secret)
    )
    db.commit()
    user = db.execute('SELECT id FROM users WHERE username=?', (username,)).fetchone()
    db.close()

    # Store temp data for TOTP setup
    session['totp_setup_user_id'] = user['id']
    session['totp_setup_secret'] = totp_secret
    session['totp_setup_username'] = username
    return redirect(url_for('setup_totp'))


@app.route('/setup-totp', methods=['GET', 'POST'])
def setup_totp():
    if 'totp_setup_user_id' not in session:
        return redirect(url_for('register'))

    secret = session['totp_setup_secret']
    username = session['totp_setup_username']

    if request.method == 'POST':
        code = request.form.get('totp_code', '').strip()
        totp = pyotp.TOTP(secret)
        if totp.verify(code, valid_window=1):
            db = get_db()
            db.execute(
                'UPDATE users SET totp_verified=1 WHERE id=?',
                (session['totp_setup_user_id'],)
            )
            db.commit()
            db.close()

            # Recovery TOTP verified; log user in.
            session.permanent = True
            session['user_id'] = session.pop('totp_setup_user_id')
            session['username'] = username
            session.pop('totp_setup_secret', None)
            session.pop('totp_setup_username', None)
            flash('Registration complete! Welcome to TradeVault.', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid TOTP code. Please try again.', 'error')

    # Generate QR code
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=username, issuer_name='TradeVault')
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    qr_b64 = base64.b64encode(buf.read()).decode()

    return render_template('setup_totp.html', qr_b64=qr_b64, secret=secret, username=username)


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return render_template(
            'login.html',
            prefill_username=request.args.get('username', '').strip()
        )

    username = request.form.get('username', '').strip()
    password = request.form.get('password', '')

    db = get_db()
    user = db.execute('SELECT * FROM users WHERE username=?', (username,)).fetchone()

    if not user:
        db.close()
        flash('Invalid credentials.', 'error')
        return redirect(url_for('login'))

    if user['account_locked']:
        db.close()
        flash('Account locked after 3 failed logins. Unlock it with your TOTP code.', 'error')
        return redirect(url_for('unlock_account', username=username))

    pw_hash, _ = hash_password(password, user['salt'])
    if pw_hash != user['password_hash']:
        attempts, locked = register_failed_login(db, user)
        db.commit()
        db.close()
        if locked:
            flash('Account locked after 3 failed logins. Unlock it with your TOTP code.', 'error')
            return redirect(url_for('unlock_account', username=username))
        remaining = MAX_LOGIN_ATTEMPTS - attempts
        suffix = '' if remaining == 1 else 's'
        flash(f'Invalid credentials. {remaining} login attempt{suffix} remaining before lock.', 'error')
        return redirect(url_for('login', username=username))

    if 'totp_verified' in user.keys() and not user['totp_verified']:
        db.close()
        session['totp_setup_user_id'] = user['id']
        session['totp_setup_secret'] = user['totp_secret']
        session['totp_setup_username'] = user['username']
        flash('Finish recovery-code setup before entering your workspace.', 'info')
        return redirect(url_for('setup_totp'))

    reset_login_state(db, user['id'])
    db.commit()
    db.close()

    session.permanent = True
    session['user_id'] = user['id']
    session['username'] = user['username']
    flash(f'Welcome back, {user["username"]}!', 'success')
    return redirect(url_for('dashboard'))


@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'GET':
        return render_template(
            'forgot_password.html',
            prefill_username=request.args.get('username', '').strip()
        )

    username = request.form.get('username', '').strip()
    totp_code = request.form.get('totp_code', '').strip()
    new_password = request.form.get('new_password', '')
    confirm_password = request.form.get('confirm_password', '')

    if not username or not totp_code or not new_password or not confirm_password:
        flash('All fields are required.', 'error')
        return redirect(url_for('forgot_password'))
    if len(new_password) < 6:
        flash('Password must be at least 6 characters.', 'error')
        return redirect(url_for('forgot_password'))
    if new_password != confirm_password:
        flash('Passwords do not match.', 'error')
        return redirect(url_for('forgot_password'))
    if not is_valid_totp_code(totp_code):
        flash('TOTP code must be a valid 6-digit code.', 'error')
        return redirect(url_for('forgot_password'))

    db = get_db()
    user = db.execute(
        'SELECT id, totp_secret FROM users WHERE username=?',
        (username,)
    ).fetchone()
    if not user:
        db.close()
        flash('Invalid recovery details.', 'error')
        return redirect(url_for('forgot_password'))

    totp = pyotp.TOTP(user['totp_secret'])
    if not totp.verify(totp_code, valid_window=1):
        db.close()
        flash('Invalid recovery details.', 'error')
        return redirect(url_for('forgot_password'))

    pw_hash, salt = hash_password(new_password)
    db.execute(
        'UPDATE users SET password_hash=?, salt=?, failed_login_attempts=0, account_locked=0 WHERE id=?',
        (pw_hash, salt, user['id'])
    )
    db.commit()
    db.close()

    session.clear()
    flash('Password reset successful. Please login with your new password.', 'success')
    return redirect(url_for('login'))


@app.route('/unlock-account', methods=['GET', 'POST'])
def unlock_account():
    if request.method == 'GET':
        return render_template(
            'unlock_account.html',
            prefill_username=request.args.get('username', '').strip()
        )

    username = request.form.get('username', '').strip()
    totp_code = request.form.get('totp_code', '').strip()

    if not username or not is_valid_totp_code(totp_code):
        flash('Username and a valid 6-digit TOTP code are required.', 'error')
        return redirect(url_for('unlock_account', username=username))

    db = get_db()
    user = db.execute(
        'SELECT id, totp_secret, account_locked FROM users WHERE username=?',
        (username,)
    ).fetchone()
    if not user:
        db.close()
        flash('Invalid unlock details.', 'error')
        return redirect(url_for('unlock_account'))

    if not user['account_locked']:
        db.close()
        flash('This account is not locked. Login with your password.', 'info')
        return redirect(url_for('login', username=username))

    totp = pyotp.TOTP(user['totp_secret'])
    if not totp.verify(totp_code, valid_window=1):
        db.close()
        flash('Invalid unlock details.', 'error')
        return redirect(url_for('unlock_account', username=username))

    reset_login_state(db, user['id'])
    db.commit()
    db.close()

    flash('Account unlocked. Please login with your password.', 'success')
    return redirect(url_for('login', username=username))


@app.route('/change-password', methods=['GET', 'POST'])
@login_required
def change_password():
    if request.method == 'GET':
        return render_template('change_password.html', username=session.get('username'))

    current_password = request.form.get('current_password', '')
    totp_code = request.form.get('totp_code', '').strip()
    new_password = request.form.get('new_password', '')
    confirm_password = request.form.get('confirm_password', '')

    if not current_password or not totp_code or not new_password or not confirm_password:
        flash('All fields are required.', 'error')
        return redirect(url_for('change_password'))
    if len(new_password) < 6:
        flash('Password must be at least 6 characters.', 'error')
        return redirect(url_for('change_password'))
    if new_password != confirm_password:
        flash('Passwords do not match.', 'error')
        return redirect(url_for('change_password'))
    if not is_valid_totp_code(totp_code):
        flash('TOTP code must be a valid 6-digit code.', 'error')
        return redirect(url_for('change_password'))

    db = get_db()
    user = db.execute(
        'SELECT id, username, password_hash, salt, totp_secret FROM users WHERE id=?',
        (session['user_id'],)
    ).fetchone()
    if not user:
        db.close()
        session.clear()
        flash('Session expired. Please login again.', 'error')
        return redirect(url_for('login'))

    current_hash, _ = hash_password(current_password, user['salt'])
    totp = pyotp.TOTP(user['totp_secret'])
    if current_hash != user['password_hash'] or not totp.verify(totp_code, valid_window=1):
        db.close()
        flash('Current password or TOTP code is incorrect.', 'error')
        return redirect(url_for('change_password'))

    pw_hash, salt = hash_password(new_password)
    db.execute(
        'UPDATE users SET password_hash=?, salt=?, failed_login_attempts=0, account_locked=0 WHERE id=?',
        (pw_hash, salt, user['id'])
    )
    db.commit()
    db.close()

    session.clear()
    flash('Password changed. Please login with your new password.', 'success')
    return redirect(url_for('login', username=user['username']))


@app.route('/logout', methods=['GET'])
def logout_get():
    return redirect(url_for('dashboard' if 'user_id' in session else 'landing'))


@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    flash('You have been logged out.', 'info')
    return redirect(url_for('landing'))


# ─── Routes: Dashboard ───────────────────────────────────────────

@app.route('/dashboard')
@app.route('/dashboard/<path:view>')
@login_required
def dashboard(view=None):
    return render_template('dashboard.html', username=session.get('username'))


@app.route('/healthz')
def healthz():
    return jsonify({'status': 'ok'}), 200


# ─── Routes: Trades API ──────────────────────────────────────────

CATEGORIES = {
    'Equity': {
        'subcategories': ['Small Cap', 'Mid Cap', 'Large Cap'],
        'styles': ['Intraday', 'Swing', 'Positional']
    },
    'Index': {
        'subcategories': ['Nifty', 'Bank Nifty'],
        'styles': ['Intraday', 'Swing', 'Positional']
    },
    'Forex': {
        'subcategories': [],
        'styles': ['Intraday', 'Swing', 'Scalp', 'Positional']
    },
    'Commodity': {
        'subcategories': [],
        'styles': ['Intraday', 'Swing']
    },
    'US Index': {
        'subcategories': [],
        'styles': ['Intraday', 'Swing']
    }
}


@app.route('/api/categories')
@login_required
def api_categories():
    return jsonify(CATEGORIES)


# ─── Routes: Instruments API ──────────────────────────────────

@app.route('/api/instruments', methods=['GET'])
@login_required
def api_get_instruments():
    db = get_db()
    instruments = db.execute(
        'SELECT * FROM instruments WHERE user_id=? ORDER BY name',
        (session['user_id'],)
    ).fetchall()
    db.close()
    return jsonify([dict(i) for i in instruments])


@app.route('/api/instruments', methods=['POST'])
@login_required
def api_add_instrument():
    data = request_json()
    if data is None:
        return jsonify({'error': 'Invalid JSON payload'}), 400
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Instrument name is required'}), 400
    try:
        lot_size = parse_float_field(data, 'lot_size', 'Lot size', required=False, minimum=0) or 0
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    db = get_db()
    existing = db.execute(
        'SELECT id FROM instruments WHERE user_id=? AND name=?',
        (session['user_id'], name)
    ).fetchone()

    if existing:
        # Update existing instrument defaults
        db.execute('''UPDATE instruments SET asset_category=?, subcategory=?,
            trading_style=?, instrument_type=?, lot_size=?, platform=?
            WHERE id=?''',
            (data.get('asset_category', ''), data.get('subcategory', ''),
             data.get('trading_style', ''), data.get('instrument_type', ''),
             lot_size, data.get('platform', ''),
             existing['id']))
        db.commit()
        db.close()
        return jsonify({'id': existing['id'], 'message': 'Instrument updated'})

    inst_id = insert_and_get_id(
        db,
        '''INSERT INTO instruments
        (user_id, name, asset_category, subcategory, trading_style,
         instrument_type, lot_size, platform)
        VALUES (?,?,?,?,?,?,?,?)''',
        (session['user_id'], name, data.get('asset_category', ''),
         data.get('subcategory', ''), data.get('trading_style', ''),
         data.get('instrument_type', ''), lot_size,
         data.get('platform', ''))
    )
    db.commit()
    db.close()
    return jsonify({'id': inst_id, 'message': 'Instrument saved'}), 201


@app.route('/api/instruments/<int:inst_id>', methods=['DELETE'])
@login_required
def api_delete_instrument(inst_id):
    db = get_db()
    db.execute('DELETE FROM instruments WHERE id=? AND user_id=?',
               (inst_id, session['user_id']))
    db.commit()
    db.close()
    return jsonify({'message': 'Instrument deleted'})


@app.route('/api/close_reasons', methods=['GET'])
@login_required
def api_get_close_reasons():
    db = get_db()
    rows = db.execute('SELECT * FROM close_reasons WHERE user_id=? ORDER BY reason',
                      (session['user_id'],)).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/close_reasons', methods=['POST'])
@login_required
def api_add_close_reason():
    data = request_json()
    if data is None:
        return jsonify({'error': 'Invalid JSON payload'}), 400
    reason = data.get('reason', '').strip()
    if not reason:
        return jsonify({'error': 'reason is required'}), 400
    db = get_db()
    try:
        db.execute('INSERT INTO close_reasons (user_id, reason) VALUES (?,?)',
                   (session['user_id'], reason))
        db.commit()
    except DB_INTEGRITY_ERRORS:
        pass  # already exists, that's fine
    db.close()
    return jsonify({'message': 'ok'}), 201


@app.route('/api/strategies', methods=['GET'])
@login_required
def api_get_strategies():
    db = get_db()
    rows = db.execute('SELECT * FROM strategies WHERE user_id=? ORDER BY name',
                      (session['user_id'],)).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/strategies', methods=['POST'])
@login_required
def api_add_strategy():
    data = request_json()
    if data is None:
        return jsonify({'error': 'Invalid JSON payload'}), 400
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'name is required'}), 400
    db = get_db()
    try:
        db.execute('INSERT INTO strategies (user_id, name) VALUES (?,?)',
                   (session['user_id'], name))
        db.commit()
    except DB_INTEGRITY_ERRORS:
        pass  # already exists
    db.close()
    return jsonify({'message': 'ok'}), 201


def clean_playbook_payload(data, partial=False):
    cleaned = {}
    if not partial and not clean_text(data.get('name'), 120):
        raise ValueError('Playbook name is required')
    if 'name' in data or not partial:
        cleaned['name'] = clean_text(data.get('name'), 120)
        if not cleaned['name']:
            raise ValueError('Playbook name is required')
    if 'market_scope' in data or not partial:
        market_scope = clean_text(data.get('market_scope'), 60)
        if market_scope and market_scope not in CATEGORIES:
            raise ValueError('Market scope is not supported')
        cleaned['market_scope'] = market_scope
    if 'setup_rules' in data or not partial:
        cleaned['setup_rules'] = clean_text(data.get('setup_rules'), 2000)
    if 'checklist' in data or not partial:
        cleaned['checklist'] = clean_text(data.get('checklist'), 2000)
    if 'notes' in data or not partial:
        cleaned['notes'] = clean_text(data.get('notes'), 2000)
    if 'active' in data:
        cleaned['active'] = normalize_bool(data.get('active'))
    return cleaned


@app.route('/api/playbooks', methods=['GET'])
@login_required
def api_get_playbooks():
    include_inactive = request.args.get('include_inactive') == '1'
    query = 'SELECT * FROM playbooks WHERE user_id=?'
    if not include_inactive:
        query += ' AND active=1'
    query += ' ORDER BY active DESC, name'
    db = get_db()
    rows = db.execute(query, (session['user_id'],)).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/playbooks', methods=['POST'])
@login_required
def api_add_playbook():
    data = request_json()
    if data is None:
        return jsonify({'error': 'Invalid JSON payload'}), 400
    try:
        cleaned = clean_playbook_payload(data)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    db = get_db()
    try:
        playbook_id = insert_and_get_id(
            db,
            '''INSERT INTO playbooks
            (user_id, name, market_scope, setup_rules, checklist, notes, active)
            VALUES (?,?,?,?,?,?,1)''',
            (session['user_id'], cleaned['name'], cleaned.get('market_scope', ''),
             cleaned.get('setup_rules', ''), cleaned.get('checklist', ''),
             cleaned.get('notes', ''))
        )
        db.commit()
    except DB_INTEGRITY_ERRORS:
        db.close()
        return jsonify({'error': 'A playbook with this name already exists'}), 400
    db.close()
    return jsonify({'id': playbook_id, 'message': 'Playbook saved'}), 201


@app.route('/api/playbooks/<int:playbook_id>', methods=['PATCH'])
@login_required
def api_update_playbook(playbook_id):
    data = request_json()
    if data is None:
        return jsonify({'error': 'Invalid JSON payload'}), 400
    try:
        cleaned = clean_playbook_payload(data, partial=True)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    if not cleaned:
        return jsonify({'error': 'No valid fields to update'}), 400

    sets = []
    vals = []
    for field in ('name', 'market_scope', 'setup_rules', 'checklist', 'notes', 'active'):
        if field in cleaned:
            sets.append(f'{field}=?')
            vals.append(cleaned[field])
    vals.extend([playbook_id, session['user_id']])
    db = get_db()
    try:
        cursor = db.execute(
            f"UPDATE playbooks SET {', '.join(sets)} WHERE id=? AND user_id=?",
            vals
        )
        db.commit()
    except DB_INTEGRITY_ERRORS:
        db.close()
        return jsonify({'error': 'A playbook with this name already exists'}), 400
    updated = getattr(cursor, 'rowcount', 0)
    db.close()
    if updated == 0:
        return jsonify({'error': 'Playbook not found'}), 404
    return jsonify({'message': 'Playbook updated'})


@app.route('/api/playbooks/<int:playbook_id>', methods=['DELETE'])
@login_required
def api_delete_playbook(playbook_id):
    db = get_db()
    cursor = db.execute(
        'UPDATE playbooks SET active=0 WHERE id=? AND user_id=?',
        (playbook_id, session['user_id'])
    )
    db.commit()
    updated = getattr(cursor, 'rowcount', 0)
    db.close()
    if updated == 0:
        return jsonify({'error': 'Playbook not found'}), 404
    return jsonify({'message': 'Playbook archived'})


@app.route('/api/trades', methods=['GET'])
@login_required
def api_get_trades():
    user_id = session['user_id']
    category = request.args.get('category')
    subcategory = request.args.get('subcategory')
    style = request.args.get('style')
    status = request.args.get('status')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    direction = request.args.get('direction')
    platform = request.args.get('platform')
    instrument = request.args.get('instrument')
    instrument_type = request.args.get('instrument_type')
    currency = request.args.get('currency')
    psychology = request.args.get('psychology')
    close_reason = request.args.get('close_reason')
    strategy = request.args.get('strategy')
    playbook_id = request.args.get('playbook_id')

    query = '''
        SELECT trades.*, playbooks.name AS playbook_name
        FROM trades
        LEFT JOIN playbooks ON playbooks.id=trades.playbook_id AND playbooks.user_id=trades.user_id
        WHERE trades.user_id=?
    '''
    params = [user_id]

    if category:
        query += ' AND trades.asset_category=?'
        params.append(category)
    if subcategory:
        query += ' AND trades.subcategory=?'
        params.append(subcategory)
    if style:
        query += ' AND trades.trading_style=?'
        params.append(style)
    if status:
        query += ' AND trades.status=?'
        params.append(status)
    if direction:
        query += ' AND trades.direction=?'
        params.append(direction)
    if platform:
        query += ' AND trades.platform=?'
        params.append(platform)
    if instrument:
        query += ' AND trades.instrument=?'
        params.append(instrument)
    if instrument_type:
        query += ' AND trades.instrument_type=?'
        params.append(instrument_type)
    if currency:
        query += ' AND trades.currency=?'
        params.append(currency)
    if psychology:
        query += ' AND trades.psychology=?'
        params.append(psychology)
    if close_reason:
        query += ' AND trades.close_reason=?'
        params.append(close_reason)
    if strategy:
        query += ' AND trades.strategy=?'
        params.append(strategy)
    if playbook_id:
        query += ' AND trades.playbook_id=?'
        params.append(playbook_id)
    if date_from:
        query += ' AND trades.entry_datetime>=?'
        params.append(date_from)
    if date_to:
        query += ' AND trades.entry_datetime<=?'
        params.append(date_to)

    query += ' ORDER BY trades.entry_datetime DESC'

    db = get_db()
    trades = db.execute(query, params).fetchall()
    db.close()

    return jsonify([serialize_trade(t) for t in trades])


@app.route('/api/trades/<int:trade_id>', methods=['GET'])
@login_required
def api_get_trade(trade_id):
    db = get_db()
    trade = db.execute(
        '''SELECT trades.*, playbooks.name AS playbook_name
           FROM trades
           LEFT JOIN playbooks ON playbooks.id=trades.playbook_id AND playbooks.user_id=trades.user_id
           WHERE trades.id=? AND trades.user_id=?''',
        (trade_id, session['user_id'])
    ).fetchone()
    db.close()
    if not trade:
        return jsonify({'error': 'Trade not found'}), 404
    return jsonify(serialize_trade(trade))


@app.route('/api/trades/<int:trade_id>/attachments', methods=['GET'])
@login_required
def api_get_trade_attachments(trade_id):
    db = get_db()
    trade = db.execute(
        'SELECT id FROM trades WHERE id=? AND user_id=?',
        (trade_id, session['user_id'])
    ).fetchone()
    if not trade:
        db.close()
        return jsonify({'error': 'Trade not found'}), 404

    rows = db.execute(
        '''SELECT * FROM trade_attachments
           WHERE trade_id=? AND user_id=?
           ORDER BY created_at DESC, id DESC''',
        (trade_id, session['user_id'])
    ).fetchall()
    db.close()
    return jsonify([serialize_attachment(row) for row in rows])


@app.route('/api/trades/<int:trade_id>/attachments', methods=['POST'])
@login_required
def api_upload_trade_attachment(trade_id):
    db = get_db()
    trade = db.execute(
        'SELECT id FROM trades WHERE id=? AND user_id=?',
        (trade_id, session['user_id'])
    ).fetchone()
    if not trade:
        db.close()
        return jsonify({'error': 'Trade not found'}), 404

    try:
        original_name, stored_name, mime_type, file_size, payload = prepare_attachment_upload(
            request.files.get('file')
        )
        caption = clean_text(request.form.get('caption'), 180)
        directory = attachment_upload_dir(session['user_id'], trade_id)
        os.makedirs(directory, exist_ok=True)
        path = attachment_disk_path(session['user_id'], trade_id, stored_name)
        with open(path, 'wb') as handle:
            handle.write(payload)

        attachment_id = insert_and_get_id(
            db,
            '''INSERT INTO trade_attachments
               (user_id, trade_id, filename, original_name, mime_type, file_size, caption)
               VALUES (?,?,?,?,?,?,?)''',
            (session['user_id'], trade_id, stored_name, original_name, mime_type, file_size, caption)
        )
        db.commit()
        row = db.execute(
            'SELECT * FROM trade_attachments WHERE id=? AND user_id=?',
            (attachment_id, session['user_id'])
        ).fetchone()
    except ValueError as exc:
        db.close()
        return jsonify({'error': str(exc)}), 400
    except OSError:
        db.close()
        return jsonify({'error': 'Could not save attachment on the server'}), 500

    db.close()
    return jsonify(serialize_attachment(row)), 201


@app.route('/api/trade-attachments/<int:attachment_id>/file', methods=['GET'])
@login_required
def api_get_trade_attachment_file(attachment_id):
    db = get_db()
    row = db.execute(
        'SELECT * FROM trade_attachments WHERE id=? AND user_id=?',
        (attachment_id, session['user_id'])
    ).fetchone()
    db.close()
    if not row:
        return jsonify({'error': 'Attachment not found'}), 404

    try:
        path = attachment_disk_path(row['user_id'], row['trade_id'], row['filename'])
    except ValueError:
        return jsonify({'error': 'Attachment path is invalid'}), 404
    if not os.path.exists(path):
        return jsonify({'error': 'Attachment file is missing'}), 404

    return send_file(
        path,
        mimetype=row['mime_type'] or 'application/octet-stream',
        download_name=row['original_name'] or row['filename'],
        as_attachment=False,
        conditional=True,
        max_age=300
    )


@app.route('/api/trade-attachments/<int:attachment_id>', methods=['DELETE'])
@login_required
def api_delete_trade_attachment(attachment_id):
    db = get_db()
    row = db.execute(
        'SELECT * FROM trade_attachments WHERE id=? AND user_id=?',
        (attachment_id, session['user_id'])
    ).fetchone()
    if not row:
        db.close()
        return jsonify({'error': 'Attachment not found'}), 404

    delete_attachment_file(row)
    db.execute('DELETE FROM trade_attachments WHERE id=? AND user_id=?',
               (attachment_id, session['user_id']))
    db.commit()
    db.close()
    return jsonify({'message': 'Attachment deleted'})


@app.route('/api/trades', methods=['POST'])
@login_required
def api_add_trade():
    data = request_json()
    if data is None:
        return jsonify({'error': 'Invalid JSON payload'}), 400
    try:
        trade_data = validate_trade_fields(data)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    db = get_db()
    try:
        trade_data['playbook_id'] = ensure_user_playbook(
            db, session['user_id'], trade_data.get('playbook_id')
        )
    except ValueError as exc:
        db.close()
        return jsonify({'error': str(exc)}), 400
    trade_id = insert_and_get_id(
        db,
        '''INSERT INTO trades
        (user_id, asset_category, subcategory, trading_style, instrument,
         direction, instrument_type, lot_size, platform, currency,
         entry_price, entry_datetime, stop_loss, planned_target, position_size,
         entry_notes, playbook_id, strategy, status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
        (session['user_id'], trade_data['asset_category'], trade_data.get('subcategory', ''),
         trade_data['trading_style'], trade_data['instrument'],
         trade_data.get('direction', 'Long'), trade_data.get('instrument_type', ''),
         trade_data.get('lot_size') or 0, trade_data.get('platform', ''),
         trade_data.get('currency', 'INR'),
         trade_data['entry_price'], trade_data['entry_datetime'],
         trade_data['stop_loss'], trade_data.get('planned_target'), trade_data['position_size'],
         trade_data.get('entry_notes', ''), trade_data.get('playbook_id'),
         trade_data.get('strategy', ''), 'open')
    )
    db.commit()

    # Save/update instrument defaults
    inst_name = trade_data['instrument'].strip()
    existing = db.execute('SELECT id FROM instruments WHERE user_id=? AND name=?',
                          (session['user_id'], inst_name)).fetchone()
    if existing:
        db.execute('''UPDATE instruments SET asset_category=?, subcategory=?,
            trading_style=?, instrument_type=?, lot_size=?, platform=?
            WHERE id=?''',
            (trade_data['asset_category'], trade_data.get('subcategory', ''),
             trade_data['trading_style'], trade_data.get('instrument_type', ''),
             trade_data.get('lot_size') or 0, trade_data.get('platform', ''),
             existing['id']))
    else:
        db.execute('''INSERT INTO instruments
            (user_id, name, asset_category, subcategory, trading_style,
             instrument_type, lot_size, platform)
            VALUES (?,?,?,?,?,?,?,?)''',
            (session['user_id'], inst_name, trade_data['asset_category'],
             trade_data.get('subcategory', ''), trade_data['trading_style'],
             trade_data.get('instrument_type', ''), trade_data.get('lot_size') or 0,
             trade_data.get('platform', '')))
    db.commit()

    # Save strategy to user's list if new
    strategy_name = trade_data.get('strategy', '').strip()
    if strategy_name:
        try:
            db.execute('INSERT INTO strategies (user_id, name) VALUES (?,?)',
                       (session['user_id'], strategy_name))
            db.commit()
        except DB_INTEGRITY_ERRORS:
            pass

    db.close()
    return jsonify({'id': trade_id, 'message': 'Trade added'}), 201


@app.route('/api/trades/<int:trade_id>/close', methods=['PUT'])
@login_required
def api_close_trade(trade_id):
    data = request_json()
    if data is None:
        return jsonify({'error': 'Invalid JSON payload'}), 400

    db = get_db()
    trade = db.execute('SELECT * FROM trades WHERE id=? AND user_id=?',
                       (trade_id, session['user_id'])).fetchone()
    if not trade:
        db.close()
        return jsonify({'error': 'Trade not found'}), 404

    close_reason = data.get('close_reason', '')
    exit_notes = data.get('exit_notes', '')
    psychology = data.get('psychology', '')
    psychology_detail = data.get('psychology_detail', '')
    manual_pnl = data.get('manual_pnl')  # For Forex trades

    # For Forex trades, manual_pnl is required instead of exit_price
    is_forex = trade['asset_category'] == 'Forex'
    try:
        exit_datetime = require_datetime(data.get('exit_datetime'), 'Exit date/time')
        if is_forex:
            if manual_pnl is None:
                raise ValueError('Manual P&L is required for Forex trades')
            exit_price = parse_float_field(data, 'exit_price', 'Exit price', required=False, positive=False) or 0
            manual_pnl_val = parse_float_field(data, 'manual_pnl', 'Manual P&L', required=True)
        else:
            exit_price = parse_float_field(data, 'exit_price', 'Exit price', required=True, positive=True)
            manual_pnl_val = None
    except ValueError as exc:
        db.close()
        return jsonify({'error': str(exc)}), 400

    db.execute('''UPDATE trades SET exit_price=?, exit_datetime=?, status='closed',
                  close_reason=?, exit_notes=?, psychology=?, psychology_detail=?,
                  manual_pnl=?
                  WHERE id=? AND user_id=?''',
               (exit_price, exit_datetime,
                close_reason, exit_notes, psychology, psychology_detail,
                manual_pnl_val,
                trade_id, session['user_id']))
    db.commit()

    # Save close_reason to user's list if new
    if close_reason:
        try:
            db.execute('INSERT INTO close_reasons (user_id, reason) VALUES (?,?)',
                       (session['user_id'], close_reason))
            db.commit()
        except DB_INTEGRITY_ERRORS:
            pass

    db.close()
    return jsonify({'message': 'Trade closed'})


@app.route('/api/trades/<int:trade_id>', methods=['PATCH'])
@login_required
def api_edit_trade(trade_id):
    """Edit any field of a trade (for editing psychology, notes, close_reason, etc)."""
    data = request_json()
    if data is None:
        return jsonify({'error': 'Invalid JSON payload'}), 400
    db = get_db()
    trade = db.execute('SELECT * FROM trades WHERE id=? AND user_id=?',
                       (trade_id, session['user_id'])).fetchone()
    if not trade:
        db.close()
        return jsonify({'error': 'Trade not found'}), 404

    try:
        cleaned = validate_trade_fields(data, partial=True)
    except ValueError as exc:
        db.close()
        return jsonify({'error': str(exc)}), 400

    allowed = ['asset_category', 'subcategory', 'trading_style', 'instrument',
               'direction', 'instrument_type', 'lot_size', 'platform', 'currency',
               'entry_price', 'entry_datetime', 'stop_loss', 'planned_target', 'position_size',
               'entry_notes', 'exit_price', 'exit_datetime', 'exit_notes',
               'close_reason', 'psychology', 'psychology_detail', 'manual_pnl',
               'execution_score', 'rule_followed', 'mistake_tags', 'setup_quality',
               'review_notes', 'playbook_id', 'strategy', 'status']
    sets = []
    vals = []
    if 'playbook_id' in cleaned:
        try:
            cleaned['playbook_id'] = ensure_user_playbook(
                db, session['user_id'], cleaned.get('playbook_id'), active_only=False
            )
        except ValueError as exc:
            db.close()
            return jsonify({'error': str(exc)}), 400
    for field in allowed:
        if field in cleaned:
            sets.append(f'{field}=?')
            vals.append(cleaned[field])
    if TRADE_REVIEW_FIELDS.intersection(cleaned):
        sets.append('reviewed_at=?')
        vals.append(datetime.now().isoformat(timespec='seconds') if has_review_signal(cleaned) else None)
    if not sets:
        db.close()
        return jsonify({'error': 'No valid fields to update'}), 400

    vals.extend([trade_id, session['user_id']])
    db.execute(f"UPDATE trades SET {', '.join(sets)} WHERE id=? AND user_id=?", vals)
    db.commit()

    # Save new strategy/close_reason to user's lists
    if cleaned.get('strategy', '').strip():
        try:
            db.execute('INSERT INTO strategies (user_id, name) VALUES (?,?)',
                       (session['user_id'], cleaned['strategy'].strip()))
            db.commit()
        except DB_INTEGRITY_ERRORS:
            pass
    if cleaned.get('close_reason', '').strip():
        try:
            db.execute('INSERT INTO close_reasons (user_id, reason) VALUES (?,?)',
                       (session['user_id'], cleaned['close_reason'].strip()))
            db.commit()
        except DB_INTEGRITY_ERRORS:
            pass

    db.close()
    return jsonify({'message': 'Trade updated'})


@app.route('/api/trades/<int:trade_id>', methods=['DELETE'])
@login_required
def api_delete_trade(trade_id):
    db = get_db()
    trade = db.execute(
        'SELECT id FROM trades WHERE id=? AND user_id=?',
        (trade_id, session['user_id'])
    ).fetchone()
    if not trade:
        db.close()
        return jsonify({'error': 'Trade not found'}), 404

    attachments = db.execute(
        'SELECT * FROM trade_attachments WHERE trade_id=? AND user_id=?',
        (trade_id, session['user_id'])
    ).fetchall()
    for attachment in attachments:
        delete_attachment_file(attachment)
    db.execute('DELETE FROM trade_attachments WHERE trade_id=? AND user_id=?',
               (trade_id, session['user_id']))
    cursor = db.execute('DELETE FROM trades WHERE id=? AND user_id=?',
                        (trade_id, session['user_id']))
    deleted = getattr(cursor, 'rowcount', 0)
    db.commit()
    db.close()
    if deleted == 0:
        return jsonify({'error': 'Trade not found'}), 404
    return jsonify({'message': 'Trade deleted'})


# ─── Routes: Analytics API ───────────────────────────────────────

def build_currency_analytics(trades):
    """Build every money-derived analytic inside an explicit currency scope."""
    grouped = {}
    for trade in trades:
        currency = trade.get('currency') or 'INR'
        grouped.setdefault(currency, []).append(trade)

    result = {}
    for currency, currency_trades in sorted(grouped.items()):
        wins = []
        losses = []
        equity_curve = []
        category_pnl = {}
        monthly_pnl = {}
        strategy_pnl = {}
        playbook_pnl = {}
        mistake_cost_by_tag = {}

        for trade in currency_trades:
            pnl = calculate_trade_pnl(trade)
            if pnl is None:
                continue

            if pnl >= 0:
                wins.append(pnl)
            else:
                losses.append(pnl)

            exit_date = trade.get('exit_datetime') or trade.get('entry_datetime') or ''
            equity_curve.append({
                'date': exit_date,
                'pnl': round(pnl, 2),
                'instrument': trade.get('instrument', ''),
                'currency': currency,
            })

            category = trade.get('asset_category') or 'Other'
            category_pnl[category] = round(category_pnl.get(category, 0) + pnl, 2)

            if exit_date:
                month_key = exit_date[:7]
                monthly_pnl[month_key] = round(monthly_pnl.get(month_key, 0) + pnl, 2)

            strategy = trade.get('strategy') or 'No Strategy'
            strategy_pnl[strategy] = round(strategy_pnl.get(strategy, 0) + pnl, 2)
            playbook = trade.get('playbook_name') or 'No Playbook'
            playbook_pnl[playbook] = round(playbook_pnl.get(playbook, 0) + pnl, 2)

            if pnl < 0:
                tags = [tag.strip() for tag in (trade.get('mistake_tags') or '').split(',') if tag.strip()]
                for tag in tags:
                    mistake_cost_by_tag[tag] = round(mistake_cost_by_tag.get(tag, 0) + abs(pnl), 2)

        equity_curve.sort(key=lambda point: point['date'])
        cumulative = 0
        peak = 0
        max_drawdown = 0
        for point in equity_curve:
            cumulative += point['pnl']
            point['cumulative'] = round(cumulative, 2)
            peak = max(peak, cumulative)
            max_drawdown = min(max_drawdown, cumulative - peak)

        total = len(currency_trades)
        win_count = len(wins)
        loss_count = len(losses)
        win_pct = (win_count / total * 100) if total else 0
        loss_pct = 100 - win_pct
        avg_win = (sum(wins) / win_count) if wins else 0
        avg_loss = (sum(losses) / loss_count) if losses else 0
        payoff_ratio = (avg_win / abs(avg_loss)) if avg_loss else None
        adjusted_payoff_ratio = (
            (win_pct / 100 * avg_win) / (loss_pct / 100 * abs(avg_loss))
            if loss_pct > 0 and avg_loss else None
        )
        gross_profit = sum(wins)
        gross_loss = abs(sum(losses))
        profit_factor = (gross_profit / gross_loss) if gross_loss else (None if gross_profit else 0)
        net_pnl = sum(point['pnl'] for point in equity_curve)
        expectancy = (net_pnl / total) if total else 0

        result[currency] = {
            'currency': currency,
            'total_trades': total,
            'winning_trades': win_count,
            'losing_trades': loss_count,
            'win_pct': round(win_pct, 2),
            'net_pnl': round(net_pnl, 2),
            'avg_win': round(avg_win, 2),
            'avg_loss': round(avg_loss, 2),
            'payoff_ratio': round(payoff_ratio, 2) if payoff_ratio is not None else None,
            'adjusted_payoff_ratio': (
                round(adjusted_payoff_ratio, 2) if adjusted_payoff_ratio is not None else None
            ),
            'profit_factor': round(profit_factor, 2) if profit_factor is not None else None,
            'expectancy': round(expectancy, 2),
            'max_drawdown': round(max_drawdown, 2),
            'largest_win': round(max(wins, default=0), 2),
            'largest_loss': round(min(losses, default=0), 2),
            'equity_curve': equity_curve,
            'monthly_pnl': [
                {'month': month, 'pnl': value}
                for month, value in sorted(monthly_pnl.items())
            ],
            'category_pnl': category_pnl,
            'strategy_pnl': strategy_pnl,
            'playbook_pnl': playbook_pnl,
            'mistake_cost_by_tag': [
                {'tag': tag, 'cost': cost}
                for tag, cost in sorted(mistake_cost_by_tag.items(), key=lambda item: item[1], reverse=True)
            ],
        }

    return result


@app.route('/api/analytics')
@login_required
def api_analytics():
    user_id = session['user_id']
    category = request.args.get('category')
    subcategory = request.args.get('subcategory')
    style = request.args.get('style')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')

    direction = request.args.get('direction')
    platform = request.args.get('platform')
    instrument = request.args.get('instrument')
    instrument_type = request.args.get('instrument_type')
    currency_filter = request.args.get('currency')
    psychology_filter = request.args.get('psychology')
    close_reason_filter = request.args.get('close_reason')
    strategy_filter = request.args.get('strategy')
    playbook_filter = request.args.get('playbook_id')

    query = '''
        SELECT trades.*, playbooks.name AS playbook_name
        FROM trades
        LEFT JOIN playbooks ON playbooks.id=trades.playbook_id AND playbooks.user_id=trades.user_id
        WHERE trades.user_id=? AND trades.status='closed'
    '''
    params = [user_id]

    if category:
        query += ' AND asset_category=?'
        params.append(category)
    if subcategory:
        query += ' AND subcategory=?'
        params.append(subcategory)
    if style:
        query += ' AND trading_style=?'
        params.append(style)
    if direction:
        query += ' AND direction=?'
        params.append(direction)
    if platform:
        query += ' AND platform=?'
        params.append(platform)
    if instrument:
        query += ' AND instrument=?'
        params.append(instrument)
    if instrument_type:
        query += ' AND instrument_type=?'
        params.append(instrument_type)
    if currency_filter:
        query += ' AND currency=?'
        params.append(currency_filter)
    if psychology_filter:
        query += ' AND psychology=?'
        params.append(psychology_filter)
    if close_reason_filter:
        query += ' AND close_reason=?'
        params.append(close_reason_filter)
    if strategy_filter:
        query += ' AND strategy=?'
        params.append(strategy_filter)
    if playbook_filter:
        query += ' AND trades.playbook_id=?'
        params.append(playbook_filter)
    if date_from:
        query += ' AND entry_datetime>=?'
        params.append(date_from)
    if date_to:
        query += ' AND entry_datetime<=?'
        params.append(date_to)

    db = get_db()
    trades = db.execute(query, params).fetchall()
    db.close()

    trades = [dict(t) for t in trades]

    if not trades:
        return jsonify({
            'total_trades': 0, 'winning_trades': 0, 'losing_trades': 0,
            'win_pct': 0, 'avg_win': 0, 'avg_loss': 0,
            'payoff_ratio': 0, 'adjusted_payoff_ratio': 0,
            'win_loss_ratio': 0, 'adjusted_wl_ratio': 0,
            'largest_win': 0, 'largest_loss': 0,
            'avg_win_duration_hrs': 0, 'avg_loss_duration_hrs': 0,
            'profit_factor': 0, 'expectancy': 0, 'avg_planned_rr': 0,
            'avg_realized_r': 0, 'max_drawdown': 0, 'current_streak': '',
            'reviewed_trades': 0, 'review_pending': 0, 'avg_execution_score': 0,
            'rule_follow_rate': 0, 'discipline_score': 0, 'mistake_cost_by_tag': [],
            'equity_curve': [], 'category_pnl': {}, 'monthly_pnl': [],
            'strategy_pnl': {}, 'playbook_pnl': {}, 'pnl_by_currency': {}, 'currencies': [],
            'currency_analytics': {}, 'money_scope': 'empty',
            'mixed_currency': False, 'return_distribution': []
        })

    wins = []
    losses = []
    pct_returns = []
    realized_r_values = []
    planned_rr_values = []
    execution_scores = []
    reviewed_trades = 0
    rule_review_count = 0
    rule_followed_count = 0
    result_events = []
    currencies = sorted({t.get('currency') or 'INR' for t in trades})
    currency_analytics = build_currency_analytics(trades)
    mixed_currency = not currency_filter and len(currencies) > 1

    for t in trades:
        pnl = calculate_trade_pnl(t)
        if pnl is None:
            continue
        pnl_pct = calculate_trade_pnl_pct(t, pnl)
        pct_returns.append(pnl_pct)
        realized_r = calculate_realized_r(t, pnl)
        planned_rr = calculate_planned_rr(t)
        if realized_r is not None:
            realized_r_values.append(realized_r)
        if planned_rr is not None:
            planned_rr_values.append(planned_rr)
        is_reviewed = bool(t.get('reviewed_at') or has_review_signal(t))
        if is_reviewed:
            reviewed_trades += 1
        if is_reviewed and t.get('execution_score') not in (None, ''):
            execution_scores.append(int(t['execution_score']))
        if is_reviewed:
            rule_review_count += 1
            if normalize_bool(t.get('rule_followed')):
                rule_followed_count += 1

        try:
            entry_dt = datetime.fromisoformat(t['entry_datetime'])
            exit_dt = datetime.fromisoformat(t['exit_datetime'])
            duration_hrs = (exit_dt - entry_dt).total_seconds() / 3600
        except (TypeError, ValueError):
            duration_hrs = 0

        result_events.append({
            'date': t.get('exit_datetime') or t.get('entry_datetime') or '',
            'pnl': pnl,
        })
        if pnl >= 0:
            wins.append({'duration': duration_hrs})
        else:
            losses.append({'duration': duration_hrs})

    return_distribution = build_return_distribution(pct_returns)

    total = len(trades)
    win_count = len(wins)
    loss_count = len(losses)
    win_pct = (win_count / total * 100) if total else 0
    avg_planned_rr = (sum(planned_rr_values) / len(planned_rr_values)) if planned_rr_values else 0
    avg_realized_r = (sum(realized_r_values) / len(realized_r_values)) if realized_r_values else 0
    avg_execution_score = (sum(execution_scores) / len(execution_scores)) if execution_scores else 0
    rule_follow_rate = (rule_followed_count / rule_review_count * 100) if rule_review_count else 0
    execution_component = (avg_execution_score / 5 * 100) if avg_execution_score else 0
    discipline_components = [value for value in (execution_component, rule_follow_rate) if value]
    discipline_score = (sum(discipline_components) / len(discipline_components)) if discipline_components else 0

    avg_win_dur = (sum(w['duration'] for w in wins) / win_count) if wins else 0
    avg_loss_dur = (sum(l['duration'] for l in losses) / loss_count) if losses else 0
    current_streak_count = 0
    current_streak_type = ''
    result_events.sort(key=lambda point: point['date'])
    for point in reversed(result_events):
        point_type = 'W' if point['pnl'] >= 0 else 'L'
        if not current_streak_type:
            current_streak_type = point_type
        if point_type != current_streak_type:
            break
        current_streak_count += 1
    current_streak = f'{current_streak_count}{current_streak_type}' if current_streak_count else ''

    single_money = next(iter(currency_analytics.values())) if len(currency_analytics) == 1 else None

    def legacy_money(field, default=None):
        if mixed_currency:
            return None
        if single_money is None:
            return default
        return single_money[field]

    legacy_equity = single_money['equity_curve'] if single_money and not mixed_currency else []
    legacy_monthly = single_money['monthly_pnl'] if single_money and not mixed_currency else []
    legacy_category = single_money['category_pnl'] if single_money and not mixed_currency else {}
    legacy_strategy = single_money['strategy_pnl'] if single_money and not mixed_currency else {}
    legacy_playbook = single_money['playbook_pnl'] if single_money and not mixed_currency else {}
    legacy_mistakes = single_money['mistake_cost_by_tag'] if single_money and not mixed_currency else []
    pnl_by_currency = {
        currency: analytics['net_pnl']
        for currency, analytics in currency_analytics.items()
    }

    return jsonify({
        'total_trades': total,
        'winning_trades': win_count,
        'losing_trades': loss_count,
        'win_pct': round(win_pct, 2),
        'avg_win': legacy_money('avg_win', 0),
        'avg_loss': legacy_money('avg_loss', 0),
        'payoff_ratio': legacy_money('payoff_ratio', 0),
        'adjusted_payoff_ratio': legacy_money('adjusted_payoff_ratio', 0),
        # Compatibility aliases remain valid only when the request resolves to one currency.
        'win_loss_ratio': legacy_money('payoff_ratio', 0),
        'adjusted_wl_ratio': legacy_money('adjusted_payoff_ratio', 0),
        'largest_win': legacy_money('largest_win', 0),
        'largest_loss': legacy_money('largest_loss', 0),
        'avg_win_duration_hrs': round(avg_win_dur, 2),
        'avg_loss_duration_hrs': round(avg_loss_dur, 2),
        'profit_factor': legacy_money('profit_factor', 0),
        'expectancy': legacy_money('expectancy', 0),
        'avg_planned_rr': round(avg_planned_rr, 2),
        'avg_realized_r': round(avg_realized_r, 2),
        'max_drawdown': legacy_money('max_drawdown', 0),
        'current_streak': current_streak,
        'reviewed_trades': reviewed_trades,
        'review_pending': max(total - reviewed_trades, 0),
        'avg_execution_score': round(avg_execution_score, 2),
        'rule_follow_rate': round(rule_follow_rate, 2),
        'discipline_score': round(discipline_score, 2),
        'mistake_cost_by_tag': legacy_mistakes,
        'equity_curve': legacy_equity,
        'category_pnl': legacy_category,
        'monthly_pnl': legacy_monthly,
        'strategy_pnl': legacy_strategy,
        'playbook_pnl': legacy_playbook,
        'pnl_by_currency': pnl_by_currency,
        'currencies': currencies,
        'currency_analytics': currency_analytics,
        'money_scope': 'per_currency' if mixed_currency else 'single_currency',
        'mixed_currency': mixed_currency,
        'return_distribution': return_distribution
    })


# ─── Routes: Review Center API ───────────────────────────────────

def grouped_currency_amounts(amounts_by_currency):
    return {
        currency: round(value, 2)
        for currency, value in sorted(amounts_by_currency.items())
        if round(value, 2) != 0
    }


def build_review_summary(trades):
    serialized = [serialize_trade(t) for t in trades]
    closed = [t for t in serialized if t.get('status') == 'closed']
    total_closed = len(closed)
    reviewed = [t for t in closed if t.get('reviewed')]
    pending = [t for t in closed if not t.get('reviewed')]
    execution_scores = [
        int(t['execution_score'])
        for t in reviewed
        if t.get('execution_score') not in (None, '')
    ]
    avg_execution = (sum(execution_scores) / len(execution_scores)) if execution_scores else 0
    rule_followed = sum(1 for t in reviewed if normalize_bool(t.get('rule_followed')))
    rule_follow_rate = (rule_followed / len(reviewed) * 100) if reviewed else 0
    planned_target_count = sum(1 for t in closed if t.get('planned_target') not in (None, ''))
    target_coverage = (planned_target_count / total_closed * 100) if total_closed else 0
    playbook_count = sum(1 for t in closed if t.get('playbook_id') not in (None, ''))
    playbook_coverage = (playbook_count / total_closed * 100) if total_closed else 0

    execution_component = (avg_execution / 5 * 100) if avg_execution else 0
    discipline_components = [value for value in (execution_component, rule_follow_rate) if value]
    discipline_score = (sum(discipline_components) / len(discipline_components)) if discipline_components else 0

    mistake_cost_by_tag = {}
    mistake_cost_by_currency = {}
    daily = {}
    for trade in closed:
        pnl = trade.get('computed_pnl')
        if pnl is None:
            continue
        pnl = float(pnl)
        currency = trade.get('currency') or 'INR'
        date_key = (trade.get('exit_datetime') or trade.get('entry_datetime') or '')[:10]
        if date_key:
            day = daily.setdefault(date_key, {
                'date': date_key,
                'pnl': 0,
                'pnl_by_currency': {},
                'trades': 0,
                'wins': 0,
                'losses': 0,
                'reviewed': 0,
            })
            day['pnl'] = round(day['pnl'] + pnl, 2)
            day['pnl_by_currency'][currency] = round(day['pnl_by_currency'].get(currency, 0) + pnl, 2)
            day['trades'] += 1
            if pnl >= 0:
                day['wins'] += 1
            else:
                day['losses'] += 1
            if trade.get('reviewed'):
                day['reviewed'] += 1

        tags = [tag.strip() for tag in (trade.get('mistake_tags') or '').split(',') if tag.strip()]
        if pnl < 0 and tags:
            mistake_cost_by_currency[currency] = round(mistake_cost_by_currency.get(currency, 0) + abs(pnl), 2)
            for tag in tags:
                row = mistake_cost_by_tag.setdefault(tag, {'tag': tag, 'cost': 0, 'cost_by_currency': {}})
                row['cost'] = round(row['cost'] + abs(pnl), 2)
                row['cost_by_currency'][currency] = round(row['cost_by_currency'].get(currency, 0) + abs(pnl), 2)

    mistake_rows = sorted(mistake_cost_by_tag.values(), key=lambda row: row['cost'], reverse=True)
    for row in mistake_rows:
        row['cost_by_currency'] = grouped_currency_amounts(row['cost_by_currency'])

    action_items = []
    if pending:
        action_items.append(f'Review {len(pending)} closed trade{"s" if len(pending) != 1 else ""} before taking the next setup.')
    if total_closed and target_coverage < 80:
        action_items.append('Add planned targets more consistently so R:R and realized R stay comparable.')
    if total_closed and playbook_coverage < 70:
        action_items.append('Link more trades to playbooks so setup performance is reviewable.')
    if reviewed and rule_follow_rate < 80:
        action_items.append('Rule adherence is below 80%. Tighten the pre-trade checklist before sizing up.')
    if mistake_rows:
        action_items.append(f'Largest tagged mistake cost is {mistake_rows[0]["tag"]}. Audit that pattern first.')
    if not action_items:
        action_items.append('Keep closing the loop: review the trade, tag the mistake, and carry one adjustment forward.')

    sorted_pending = sorted(
        pending,
        key=lambda trade: trade.get('exit_datetime') or trade.get('entry_datetime') or '',
        reverse=True
    )

    return {
        'total_closed': total_closed,
        'reviewed_count': len(reviewed),
        'pending_review_count': len(pending),
        'avg_execution_score': round(avg_execution, 2),
        'rule_follow_rate': round(rule_follow_rate, 2),
        'target_coverage': round(target_coverage, 2),
        'playbook_coverage': round(playbook_coverage, 2),
        'discipline_score': round(discipline_score, 2),
        'mistake_cost_by_currency': grouped_currency_amounts(mistake_cost_by_currency),
        'mistake_cost_by_tag': mistake_rows[:10],
        'review_queue': sorted_pending[:12],
        'daily_pnl': sorted(daily.values(), key=lambda row: row['date']),
        'action_items': action_items[:4],
    }


@app.route('/api/review/summary')
@login_required
def api_review_summary():
    db = get_db()
    trades = db.execute(
        """SELECT trades.*, playbooks.name AS playbook_name
           FROM trades
           LEFT JOIN playbooks ON playbooks.id=trades.playbook_id AND playbooks.user_id=trades.user_id
           WHERE trades.user_id=? AND trades.status='closed'
           ORDER BY COALESCE(trades.exit_datetime, trades.entry_datetime) DESC""",
        (session['user_id'],)
    ).fetchall()
    db.close()
    return jsonify(build_review_summary([dict(t) for t in trades]))


# ─── Routes: Export / Import ──────────────────────────────────────

@app.route('/api/trades/export', methods=['GET'])
@login_required
def api_export_trades():
    """Export all trades as JSON for backup / migration."""
    db = get_db()
    trades = db.execute('SELECT * FROM trades WHERE user_id=? ORDER BY id',
                        (session['user_id'],)).fetchall()
    instruments = db.execute('SELECT * FROM instruments WHERE user_id=? ORDER BY id',
                             (session['user_id'],)).fetchall()
    close_reasons = db.execute('SELECT * FROM close_reasons WHERE user_id=? ORDER BY id',
                               (session['user_id'],)).fetchall()
    strategies = db.execute('SELECT * FROM strategies WHERE user_id=? ORDER BY id',
                            (session['user_id'],)).fetchall()
    playbooks = db.execute('SELECT * FROM playbooks WHERE user_id=? ORDER BY id',
                           (session['user_id'],)).fetchall()
    attachment_counts = db.execute(
        '''SELECT trade_id, COUNT(*) AS count
           FROM trade_attachments
           WHERE user_id=?
           GROUP BY trade_id''',
        (session['user_id'],)
    ).fetchall()
    db.close()

    playbook_names = {row['id']: row['name'] for row in playbooks}
    attachments_by_trade = {row['trade_id']: row['count'] for row in attachment_counts}
    export_data = {
        'format': 'tradevault_export_v3',
        'exported_at': datetime.now().isoformat(),
        'username': session.get('username', ''),
        'attachments': {
            'included': False,
            'note': 'Chart image files are stored separately on the TradeVault server and are not embedded in JSON exports.'
        },
        'trades': [dict(t) for t in trades],
        'instruments': [dict(i) for i in instruments],
        'close_reasons': [dict(r) for r in close_reasons],
        'strategies': [dict(s) for s in strategies],
        'playbooks': [dict(p) for p in playbooks]
    }
    # Remove user_id and id from each record (not needed for import)
    for t in export_data['trades']:
        trade_id = t.get('id')
        if t.get('playbook_id') in playbook_names:
            t['playbook_name'] = playbook_names[t['playbook_id']]
        t['attachment_count'] = attachments_by_trade.get(trade_id, 0)
        t.pop('user_id', None)
        t.pop('id', None)
    for i in export_data['instruments']:
        i.pop('user_id', None)
        i.pop('id', None)
    for r in export_data['close_reasons']:
        r.pop('user_id', None)
        r.pop('id', None)
    for s in export_data['strategies']:
        s.pop('user_id', None)
        s.pop('id', None)
    for p in export_data['playbooks']:
        p.pop('user_id', None)
        p.pop('id', None)

    json_str = json.dumps(export_data, indent=2, default=str)
    export_user = safe_filename_part(session.get('username', 'user'))
    return Response(
        json_str,
        mimetype='application/json',
        headers={'Content-Disposition': f'attachment; filename=tradevault_export_{export_user}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'}
    )


@app.route('/api/trades/import', methods=['POST'])
@login_required
def api_import_trades():
    """Import trades from a previously exported JSON file."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if not file.filename.endswith('.json'):
        return jsonify({'error': 'Only .json files are accepted'}), 400

    try:
        data = json.load(file)
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid JSON file'}), 400

    if data.get('format') not in ('tradevault_export_v1', 'tradevault_export_v2', 'tradevault_export_v3'):
        return jsonify({'error': 'Unrecognized file format. Expected a TradeVault JSON export'}), 400

    user_id = session['user_id']
    db = get_db()

    imported_trades = 0
    imported_instruments = 0
    imported_reasons = 0
    imported_playbooks = 0
    skipped = 0
    duplicate_trades = 0

    # Import instruments first
    for inst in data.get('instruments', []):
        name = inst.get('name', '').strip()
        if not name:
            continue
        existing = db.execute('SELECT id FROM instruments WHERE user_id=? AND name=?',
                              (user_id, name)).fetchone()
        if existing:
            skipped += 1
            continue
        db.execute('''INSERT INTO instruments
            (user_id, name, asset_category, subcategory, trading_style,
             instrument_type, lot_size, platform)
            VALUES (?,?,?,?,?,?,?,?)''',
            (user_id, name, inst.get('asset_category', ''),
             inst.get('subcategory', ''), inst.get('trading_style', ''),
             inst.get('instrument_type', ''), float(inst.get('lot_size', 0) or 0),
             inst.get('platform', '')))
        imported_instruments += 1

    # Import close reasons
    for reason in data.get('close_reasons', []):
        r = reason.get('reason', '').strip()
        if not r:
            continue
        try:
            db.execute('INSERT INTO close_reasons (user_id, reason) VALUES (?,?)',
                       (user_id, r))
            imported_reasons += 1
        except DB_INTEGRITY_ERRORS:
            skipped += 1

    # Import strategies
    imported_strategies = 0
    for strat in data.get('strategies', []):
        name = strat.get('name', '').strip()
        if not name:
            continue
        try:
            db.execute('INSERT INTO strategies (user_id, name) VALUES (?,?)',
                       (user_id, name))
            imported_strategies += 1
        except DB_INTEGRITY_ERRORS:
            skipped += 1

    # Import playbooks before trades so trade rows can link to current IDs.
    for playbook in data.get('playbooks', []):
        if not isinstance(playbook, dict):
            skipped += 1
            continue
        try:
            cleaned = clean_playbook_payload(playbook)
        except ValueError:
            skipped += 1
            continue
        try:
            db.execute('''INSERT INTO playbooks
                (user_id, name, market_scope, setup_rules, checklist, notes, active)
                VALUES (?,?,?,?,?,?,?)''',
                (user_id, cleaned['name'], cleaned.get('market_scope', ''),
                 cleaned.get('setup_rules', ''), cleaned.get('checklist', ''),
                 cleaned.get('notes', ''), cleaned.get('active', 1)))
            imported_playbooks += 1
        except DB_INTEGRITY_ERRORS:
            skipped += 1

    playbook_rows = db.execute(
        'SELECT id, name FROM playbooks WHERE user_id=?',
        (user_id,)
    ).fetchall()
    playbook_name_to_id = {row['name']: row['id'] for row in playbook_rows}

    # Import trades
    trade_columns = [
        'asset_category', 'subcategory', 'trading_style', 'instrument',
        'direction', 'instrument_type', 'lot_size', 'platform', 'currency',
        'entry_price', 'entry_datetime', 'stop_loss', 'planned_target', 'position_size',
        'entry_notes', 'exit_price', 'exit_datetime', 'exit_notes',
        'close_reason', 'psychology', 'psychology_detail', 'manual_pnl',
        'execution_score', 'rule_followed', 'mistake_tags', 'setup_quality',
        'review_notes', 'reviewed_at', 'playbook_id', 'strategy', 'status'
    ]
    existing_trade_rows = db.execute(
        f'SELECT {",".join(trade_columns)} FROM trades WHERE user_id=?',
        (user_id,)
    ).fetchall()
    existing_trade_signatures = {trade_signature(dict(row)) for row in existing_trade_rows}

    for trade in data.get('trades', []):
        if not isinstance(trade, dict) or not trade.get('instrument') or not trade.get('entry_price'):
            skipped += 1
            continue
        values = []
        try:
            for col in trade_columns:
                val = trade.get(col)
                if col == 'playbook_id':
                    playbook_name = clean_text(trade.get('playbook_name'), 120)
                    values.append(playbook_name_to_id.get(playbook_name))
                elif col == 'rule_followed':
                    values.append(normalize_bool(val))
                elif col == 'execution_score':
                    if val in (None, ''):
                        values.append(None)
                    else:
                        score = int(float(val))
                        values.append(score if 1 <= score <= 5 else None)
                elif col in TRADE_NUMERIC_FIELDS:
                    values.append(float(val) if val is not None and val != '' else None)
                elif col == 'direction':
                    values.append(val if val in ALLOWED_DIRECTIONS else 'Long')
                elif col == 'currency':
                    values.append(val if val in ALLOWED_CURRENCIES else 'INR')
                elif col == 'status':
                    values.append(val if val in ALLOWED_STATUSES else 'open')
                elif col == 'mistake_tags':
                    values.append(parse_mistake_tags(val))
                else:
                    values.append(clean_text(val, 1000) if val is not None else '')
        except (TypeError, ValueError):
            skipped += 1
            continue

        candidate = dict(zip(trade_columns, values))
        required_import_fields = ('asset_category', 'trading_style', 'instrument',
                                  'entry_price', 'entry_datetime', 'stop_loss',
                                  'position_size')
        if any(candidate.get(field) in (None, '') for field in required_import_fields):
            skipped += 1
            continue
        signature = trade_signature(candidate)
        if signature in existing_trade_signatures:
            duplicate_trades += 1
            skipped += 1
            continue
        values.insert(0, user_id)  # prepend user_id

        placeholders = ','.join(['?'] * (len(trade_columns) + 1))
        cols = 'user_id,' + ','.join(trade_columns)
        db.execute(f'INSERT INTO trades ({cols}) VALUES ({placeholders})', values)
        existing_trade_signatures.add(signature)
        imported_trades += 1

    db.commit()
    db.close()

    return jsonify({
        'message': f'Import complete: {imported_trades} trades, {imported_instruments} instruments, {imported_reasons} close reasons, {imported_strategies} strategies, {imported_playbooks} playbooks imported. {duplicate_trades} duplicate trades skipped; {skipped} total skipped.',
        'imported_trades': imported_trades,
        'imported_instruments': imported_instruments,
        'imported_reasons': imported_reasons,
        'imported_strategies': imported_strategies,
        'imported_playbooks': imported_playbooks,
        'skipped': skipped,
        'duplicate_trades': duplicate_trades
    })


if __name__ == '__main__':
    app.run(debug=True, port=5000)

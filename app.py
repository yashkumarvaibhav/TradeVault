import os
import sqlite3
import hashlib
import secrets
import time
import io
import base64
from datetime import datetime, timedelta
from functools import wraps

import json

import pyotp
import qrcode
from flask import (Flask, render_template, request, redirect, url_for,
                   session, jsonify, flash, send_file, Response)

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

DATABASE_URL = os.environ.get('DATABASE_URL', '').strip()
USE_POSTGRES = DATABASE_URL.startswith('postgres://') or DATABASE_URL.startswith('postgresql://')

SQLITE_DATABASE = os.environ.get(
    'TRADEVAULT_DB_PATH',
    os.path.join(os.path.dirname(__file__), 'trading_journal.db')
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
        position_size REAL NOT NULL,
        entry_notes TEXT DEFAULT '',
        exit_price REAL,
        exit_datetime TEXT,
        exit_notes TEXT DEFAULT '',
        close_reason TEXT DEFAULT '',
        psychology TEXT DEFAULT '',
        psychology_detail TEXT DEFAULT '',
        manual_pnl REAL,
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
    CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id);
    CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
    CREATE INDEX IF NOT EXISTS idx_trades_category ON trades(asset_category);
    CREATE INDEX IF NOT EXISTS idx_instruments_user ON instruments(user_id);
    CREATE INDEX IF NOT EXISTS idx_close_reasons_user ON close_reasons(user_id);
    CREATE INDEX IF NOT EXISTS idx_strategies_user ON strategies(user_id);
'''

POSTGRES_SCHEMA = '''
    CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        totp_secret TEXT NOT NULL,
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
        position_size REAL NOT NULL,
        entry_notes TEXT DEFAULT '',
        exit_price REAL,
        exit_datetime TEXT,
        exit_notes TEXT DEFAULT '',
        close_reason TEXT DEFAULT '',
        psychology TEXT DEFAULT '',
        psychology_detail TEXT DEFAULT '',
        manual_pnl REAL,
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
    CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id);
    CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
    CREATE INDEX IF NOT EXISTS idx_trades_category ON trades(asset_category);
    CREATE INDEX IF NOT EXISTS idx_instruments_user ON instruments(user_id);
    CREATE INDEX IF NOT EXISTS idx_close_reasons_user ON close_reasons(user_id);
    CREATE INDEX IF NOT EXISTS idx_strategies_user ON strategies(user_id);
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

def get_db():
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


def init_db():
    conn = get_db()
    conn.executescript(POSTGRES_SCHEMA if USE_POSTGRES else SQLITE_SCHEMA)
    conn.commit()
    conn.close()


def insert_and_get_id(db, insert_sql, params):
    if db.backend == 'postgres':
        row = db.execute(insert_sql.rstrip(';') + ' RETURNING id', params).fetchone()
        return row['id']
    db.execute(insert_sql, params)
    return db.execute('SELECT last_insert_rowid()').fetchone()[0]


init_db()

# ─── Auth helpers ─────────────────────────────────────────────────

def hash_password(password, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 310_000).hex()
    return pw_hash, salt


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
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

    db.execute('INSERT INTO users (username, password_hash, salt, totp_secret) VALUES (?,?,?,?)',
               (username, pw_hash, salt, totp_secret))
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
            # TOTP verified – log user in
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
        return render_template('login.html')

    username = request.form.get('username', '').strip()
    password = request.form.get('password', '')
    totp_code = request.form.get('totp_code', '').strip()

    db = get_db()
    user = db.execute('SELECT * FROM users WHERE username=?', (username,)).fetchone()
    db.close()

    if not user:
        flash('Invalid credentials.', 'error')
        return redirect(url_for('login'))

    pw_hash, _ = hash_password(password, user['salt'])
    if pw_hash != user['password_hash']:
        flash('Invalid credentials.', 'error')
        return redirect(url_for('login'))

    totp = pyotp.TOTP(user['totp_secret'])
    if not totp.verify(totp_code, valid_window=1):
        flash('Invalid TOTP code.', 'error')
        return redirect(url_for('login'))

    session.permanent = True
    session['user_id'] = user['id']
    session['username'] = user['username']
    flash(f'Welcome back, {user["username"]}!', 'success')
    return redirect(url_for('dashboard'))


@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'GET':
        return render_template('forgot_password.html')

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
    if len(totp_code) != 6 or not totp_code.isdigit():
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
        'UPDATE users SET password_hash=?, salt=? WHERE id=?',
        (pw_hash, salt, user['id'])
    )
    db.commit()
    db.close()

    session.clear()
    flash('Password reset successful. Please login with your new password.', 'success')
    return redirect(url_for('login'))


@app.route('/logout')
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
    data = request.get_json()
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Instrument name is required'}), 400

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
             float(data.get('lot_size', 0) or 0), data.get('platform', ''),
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
         data.get('instrument_type', ''), float(data.get('lot_size', 0) or 0),
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
    data = request.get_json()
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
    data = request.get_json()
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

    query = 'SELECT * FROM trades WHERE user_id=?'
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
    if status:
        query += ' AND status=?'
        params.append(status)
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
    if currency:
        query += ' AND currency=?'
        params.append(currency)
    if psychology:
        query += ' AND psychology=?'
        params.append(psychology)
    if close_reason:
        query += ' AND close_reason=?'
        params.append(close_reason)
    if strategy:
        query += ' AND strategy=?'
        params.append(strategy)
    if date_from:
        query += ' AND entry_datetime>=?'
        params.append(date_from)
    if date_to:
        query += ' AND entry_datetime<=?'
        params.append(date_to)

    query += ' ORDER BY entry_datetime DESC'

    db = get_db()
    trades = db.execute(query, params).fetchall()
    db.close()

    return jsonify([dict(t) for t in trades])


@app.route('/api/trades', methods=['POST'])
@login_required
def api_add_trade():
    data = request.get_json()
    required = ['asset_category', 'trading_style', 'instrument', 'entry_price',
                'entry_datetime', 'stop_loss', 'position_size', 'direction']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    db = get_db()
    trade_id = insert_and_get_id(
        db,
        '''INSERT INTO trades
        (user_id, asset_category, subcategory, trading_style, instrument,
         direction, instrument_type, lot_size, platform, currency,
         entry_price, entry_datetime, stop_loss, position_size, entry_notes, strategy, status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
        (session['user_id'], data['asset_category'], data.get('subcategory', ''),
         data['trading_style'], data['instrument'],
         data.get('direction', 'Long'), data.get('instrument_type', ''),
         float(data.get('lot_size', 0) or 0), data.get('platform', ''),
         data.get('currency', 'INR'),
         float(data['entry_price']), data['entry_datetime'],
         float(data['stop_loss']), float(data['position_size']),
         data.get('entry_notes', ''), data.get('strategy', ''), 'open')
    )
    db.commit()

    # Save/update instrument defaults
    inst_name = data['instrument'].strip()
    existing = db.execute('SELECT id FROM instruments WHERE user_id=? AND name=?',
                          (session['user_id'], inst_name)).fetchone()
    if existing:
        db.execute('''UPDATE instruments SET asset_category=?, subcategory=?,
            trading_style=?, instrument_type=?, lot_size=?, platform=?
            WHERE id=?''',
            (data['asset_category'], data.get('subcategory', ''),
             data['trading_style'], data.get('instrument_type', ''),
             float(data.get('lot_size', 0) or 0), data.get('platform', ''),
             existing['id']))
    else:
        db.execute('''INSERT INTO instruments
            (user_id, name, asset_category, subcategory, trading_style,
             instrument_type, lot_size, platform)
            VALUES (?,?,?,?,?,?,?,?)''',
            (session['user_id'], inst_name, data['asset_category'],
             data.get('subcategory', ''), data['trading_style'],
             data.get('instrument_type', ''), float(data.get('lot_size', 0) or 0),
             data.get('platform', '')))
    db.commit()

    # Save strategy to user's list if new
    strategy_name = data.get('strategy', '').strip()
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
    data = request.get_json()

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
    if is_forex:
        if manual_pnl is None or not data.get('exit_datetime'):
            db.close()
            return jsonify({'error': 'manual_pnl and exit_datetime are required for Forex trades'}), 400
        exit_price = float(data.get('exit_price', 0) or 0)
        manual_pnl_val = float(manual_pnl)
    else:
        if not data.get('exit_price') or not data.get('exit_datetime'):
            db.close()
            return jsonify({'error': 'exit_price and exit_datetime are required'}), 400
        exit_price = float(data['exit_price'])
        manual_pnl_val = None

    db.execute('''UPDATE trades SET exit_price=?, exit_datetime=?, status='closed',
                  close_reason=?, exit_notes=?, psychology=?, psychology_detail=?,
                  manual_pnl=?
                  WHERE id=? AND user_id=?''',
               (exit_price, data['exit_datetime'],
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
    data = request.get_json()
    db = get_db()
    trade = db.execute('SELECT * FROM trades WHERE id=? AND user_id=?',
                       (trade_id, session['user_id'])).fetchone()
    if not trade:
        db.close()
        return jsonify({'error': 'Trade not found'}), 404

    allowed = ['asset_category', 'subcategory', 'trading_style', 'instrument',
               'direction', 'instrument_type', 'lot_size', 'platform', 'currency',
               'entry_price', 'entry_datetime', 'stop_loss', 'position_size',
               'entry_notes', 'exit_price', 'exit_datetime', 'exit_notes',
               'close_reason', 'psychology', 'psychology_detail', 'manual_pnl',
               'strategy', 'status']
    sets = []
    vals = []
    for field in allowed:
        if field in data:
            sets.append(f'{field}=?')
            if field in ('lot_size', 'stop_loss', 'manual_pnl', 'entry_price',
                         'exit_price', 'position_size'):
                vals.append(float(data[field]) if data[field] is not None and data[field] != '' else None)
            else:
                vals.append(data[field])
    if not sets:
        db.close()
        return jsonify({'error': 'No valid fields to update'}), 400

    vals.extend([trade_id, session['user_id']])
    db.execute(f"UPDATE trades SET {', '.join(sets)} WHERE id=? AND user_id=?", vals)
    db.commit()

    # Save new strategy/close_reason to user's lists
    if data.get('strategy', '').strip():
        try:
            db.execute('INSERT INTO strategies (user_id, name) VALUES (?,?)',
                       (session['user_id'], data['strategy'].strip()))
            db.commit()
        except DB_INTEGRITY_ERRORS:
            pass
    if data.get('close_reason', '').strip():
        try:
            db.execute('INSERT INTO close_reasons (user_id, reason) VALUES (?,?)',
                       (session['user_id'], data['close_reason'].strip()))
            db.commit()
        except DB_INTEGRITY_ERRORS:
            pass

    db.close()
    return jsonify({'message': 'Trade updated'})


@app.route('/api/trades/<int:trade_id>', methods=['DELETE'])
@login_required
def api_delete_trade(trade_id):
    db = get_db()
    db.execute('DELETE FROM trades WHERE id=? AND user_id=?',
               (trade_id, session['user_id']))
    db.commit()
    db.close()
    return jsonify({'message': 'Trade deleted'})


# ─── Routes: Analytics API ───────────────────────────────────────

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

    query = "SELECT * FROM trades WHERE user_id=? AND status='closed'"
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
            'win_loss_ratio': 0, 'adjusted_wl_ratio': 0,
            'largest_win': 0, 'largest_loss': 0,
            'avg_win_duration_hrs': 0, 'avg_loss_duration_hrs': 0,
            'equity_curve': [], 'category_pnl': {}, 'monthly_pnl': [],
            'strategy_pnl': {}
        })

    wins = []
    losses = []
    pct_returns = []
    equity_curve = []  # For cumulative P&L chart
    category_pnl = {}  # P&L breakdown by asset category
    monthly_pnl = {}   # P&L breakdown by month
    strategy_pnl = {}  # P&L breakdown by strategy

    for t in trades:
        direction = t.get('direction', 'Long')
        # For Forex trades, use manual_pnl instead of calculating
        if t.get('asset_category') == 'Forex' and t.get('manual_pnl') is not None:
            pnl = t['manual_pnl']
            # For forex, calculate pct return based on entry price if available
            if t['entry_price'] and t['entry_price'] != 0 and t['position_size']:
                pnl_pct = (pnl / (t['entry_price'] * t['position_size'])) * 100
            else:
                pnl_pct = 0
        elif direction == 'Short':
            pnl_pct = ((t['entry_price'] - t['exit_price']) / t['entry_price']) * 100
            pnl = (t['entry_price'] - t['exit_price']) * t['position_size']
        else:
            pnl_pct = ((t['exit_price'] - t['entry_price']) / t['entry_price']) * 100
            pnl = (t['exit_price'] - t['entry_price']) * t['position_size']
        pct_returns.append(pnl_pct)

        # Equity curve point
        exit_date = t.get('exit_datetime', t.get('entry_datetime', ''))
        equity_curve.append({'date': exit_date, 'pnl': round(pnl, 2), 'instrument': t.get('instrument', '')})

        # Category breakdown
        cat = t.get('asset_category', 'Other')
        category_pnl[cat] = round(category_pnl.get(cat, 0) + pnl, 2)

        # Monthly breakdown
        try:
            month_key = exit_date[:7]  # YYYY-MM
            monthly_pnl[month_key] = round(monthly_pnl.get(month_key, 0) + pnl, 2)
        except:
            pass

        # Strategy breakdown
        strat = t.get('strategy', '') or 'No Strategy'
        strategy_pnl[strat] = round(strategy_pnl.get(strat, 0) + pnl, 2)

        try:
            entry_dt = datetime.fromisoformat(t['entry_datetime'])
            exit_dt = datetime.fromisoformat(t['exit_datetime'])
            duration_hrs = (exit_dt - entry_dt).total_seconds() / 3600
        except:
            duration_hrs = 0

        if pnl >= 0:
            wins.append({'pnl': pnl, 'pct': pnl_pct, 'duration': duration_hrs})
        else:
            losses.append({'pnl': pnl, 'pct': pnl_pct, 'duration': duration_hrs})

    # Sort equity curve by date and compute cumulative P&L
    equity_curve.sort(key=lambda x: x['date'])
    cumulative = 0
    for point in equity_curve:
        cumulative += point['pnl']
        point['cumulative'] = round(cumulative, 2)

    # Sort monthly P&L by month
    sorted_monthly = sorted(monthly_pnl.items())
    monthly_chart = [{'month': m, 'pnl': v} for m, v in sorted_monthly]

    total = len(trades)
    win_count = len(wins)
    loss_count = len(losses)
    win_pct = (win_count / total * 100) if total else 0

    avg_win = (sum(w['pnl'] for w in wins) / win_count) if wins else 0
    avg_loss = (sum(l['pnl'] for l in losses) / loss_count) if losses else 0

    win_loss_ratio = (avg_win / abs(avg_loss)) if avg_loss != 0 else (avg_win if avg_win else 0)

    # Adjusted win-loss ratio: (win_pct * avg_win) / ((1-win_pct) * |avg_loss|)
    loss_pct = 100 - win_pct
    if loss_pct > 0 and avg_loss != 0:
        adjusted = (win_pct / 100 * avg_win) / (loss_pct / 100 * abs(avg_loss))
    else:
        adjusted = win_loss_ratio

    largest_win = max((w['pnl'] for w in wins), default=0)
    largest_loss = min((l['pnl'] for l in losses), default=0)

    avg_win_dur = (sum(w['duration'] for w in wins) / win_count) if wins else 0
    avg_loss_dur = (sum(l['duration'] for l in losses) / loss_count) if losses else 0

    return jsonify({
        'total_trades': total,
        'winning_trades': win_count,
        'losing_trades': loss_count,
        'win_pct': round(win_pct, 2),
        'avg_win': round(avg_win, 2),
        'avg_loss': round(avg_loss, 2),
        'win_loss_ratio': round(win_loss_ratio, 2),
        'adjusted_wl_ratio': round(adjusted, 2),
        'largest_win': round(largest_win, 2),
        'largest_loss': round(largest_loss, 2),
        'avg_win_duration_hrs': round(avg_win_dur, 2),
        'avg_loss_duration_hrs': round(avg_loss_dur, 2),
        'equity_curve': equity_curve,
        'category_pnl': category_pnl,
        'monthly_pnl': monthly_chart,
        'strategy_pnl': strategy_pnl
    })


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
    db.close()

    export_data = {
        'format': 'tradevault_export_v2',
        'exported_at': datetime.now().isoformat(),
        'username': session.get('username', ''),
        'trades': [dict(t) for t in trades],
        'instruments': [dict(i) for i in instruments],
        'close_reasons': [dict(r) for r in close_reasons],
        'strategies': [dict(s) for s in strategies]
    }
    # Remove user_id and id from each record (not needed for import)
    for t in export_data['trades']:
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

    json_str = json.dumps(export_data, indent=2, default=str)
    return Response(
        json_str,
        mimetype='application/json',
        headers={'Content-Disposition': f'attachment; filename=tradevault_export_{session.get("username", "user")}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'}
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

    if data.get('format') not in ('tradevault_export_v1', 'tradevault_export_v2'):
        return jsonify({'error': 'Unrecognized file format. Expected tradevault_export_v1 or v2'}), 400

    user_id = session['user_id']
    db = get_db()

    imported_trades = 0
    imported_instruments = 0
    imported_reasons = 0
    skipped = 0

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

    # Import trades
    trade_columns = [
        'asset_category', 'subcategory', 'trading_style', 'instrument',
        'direction', 'instrument_type', 'lot_size', 'platform', 'currency',
        'entry_price', 'entry_datetime', 'stop_loss', 'position_size',
        'entry_notes', 'exit_price', 'exit_datetime', 'exit_notes',
        'close_reason', 'psychology', 'psychology_detail', 'manual_pnl',
        'strategy', 'status'
    ]
    for trade in data.get('trades', []):
        if not trade.get('instrument') or not trade.get('entry_price'):
            skipped += 1
            continue
        values = []
        for col in trade_columns:
            val = trade.get(col)
            if col in ('lot_size', 'entry_price', 'stop_loss', 'position_size',
                       'exit_price', 'manual_pnl'):
                values.append(float(val) if val is not None and val != '' else None)
            else:
                values.append(val or '' if val is not None else '')
        values.insert(0, user_id)  # prepend user_id

        placeholders = ','.join(['?'] * (len(trade_columns) + 1))
        cols = 'user_id,' + ','.join(trade_columns)
        db.execute(f'INSERT INTO trades ({cols}) VALUES ({placeholders})', values)
        imported_trades += 1

    db.commit()
    db.close()

    return jsonify({
        'message': f'Import complete: {imported_trades} trades, {imported_instruments} instruments, {imported_reasons} close reasons, {imported_strategies} strategies imported. {skipped} skipped.',
        'imported_trades': imported_trades,
        'imported_instruments': imported_instruments,
        'imported_reasons': imported_reasons,
        'imported_strategies': imported_strategies,
        'skipped': skipped
    })


if __name__ == '__main__':
    app.run(debug=True, port=5000)

import base64
import io
import json
import os
import re
import tempfile
import unittest
from pathlib import Path

os.environ['SECRET_KEY'] = 'test-secret'
TEST_ROOT = Path(tempfile.mkdtemp())
os.environ['TRADEVAULT_DB_PATH'] = str(TEST_ROOT / 'tradevault-test.db')
os.environ['TRADEVAULT_UPLOAD_DIR'] = str(TEST_ROOT / 'uploads')

import pyotp

import app as tradevault

TINY_PNG = base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='
)


def csrf_from(response):
    html = response.data.decode()
    match = (
        re.search(r'name="csrf_token" value="([^"]+)"', html)
        or re.search(r'name="csrf-token" content="([^"]+)"', html)
    )
    if not match:
        raise AssertionError(html[:500])
    return match.group(1)


class TradeVaultSmokeTest(unittest.TestCase):
    def setUp(self):
        tradevault.app.config['TESTING'] = True

    def test_public_metric_copy_uses_payoff_terminology(self):
        with tradevault.app.test_client() as client:
            landing_html = client.get('/').data.decode()
            self.assertIn('Payoff Ratio', landing_html)
            self.assertIn('Win-Rate Adjusted Payoff', landing_html)
            self.assertNotIn('W/L Ratio', landing_html)
            self.assertNotIn('Win/Loss Ratio', landing_html)

    def test_auth_password_change_validation_and_lot_pnl(self):
        with tradevault.app.test_client() as client:
            token = csrf_from(client.get('/register'))
            res = client.post('/register', data={
                'csrf_token': token,
                'username': 'smokeuser',
                'password': 'pass1234',
                'confirm_password': 'pass1234',
            })
            self.assertEqual(res.status_code, 302)
            self.assertIn('/setup-totp', res.headers['Location'])

            with client.session_transaction() as sess:
                secret = sess['totp_setup_secret']

            token = csrf_from(client.get('/setup-totp'))
            res = client.post('/setup-totp', data={
                'csrf_token': token,
                'totp_code': pyotp.TOTP(secret).now(),
            })
            self.assertEqual(res.status_code, 302)
            self.assertIn('/dashboard', res.headers['Location'])

            api_token = csrf_from(client.get('/dashboard'))
            headers = {'X-CSRF-Token': api_token}
            dashboard_html = client.get('/dashboard').data.decode()
            self.assertIn('Payoff Ratio', dashboard_html)
            self.assertIn('Win-Rate Adjusted Payoff', dashboard_html)
            self.assertIn('overview-currency-warning', dashboard_html)
            self.assertIn('analytics-currency-warning', dashboard_html)

            playbook = client.post('/api/playbooks', json={
                'name': 'Opening Range Breakout',
                'market_scope': 'Index',
                'setup_rules': 'Break opening range with volume confirmation.',
                'checklist': 'Trend aligned\nStop defined\nTarget at least 2R',
                'notes': 'Avoid late entries.',
            }, headers=headers)
            self.assertEqual(playbook.status_code, 201)
            playbook_id = playbook.get_json()['id']
            self.assertEqual(len(client.get('/api/playbooks').get_json()), 1)

            bad = client.post('/api/trades', json={
                'asset_category': 'Equity',
                'trading_style': 'Swing',
                'instrument': 'BAD',
                'entry_price': 100,
                'entry_datetime': '2026-06-18T10:00',
                'stop_loss': 120,
                'position_size': 1,
                'direction': 'Long',
                'currency': 'INR',
            }, headers=headers)
            self.assertEqual(bad.status_code, 400)
            self.assertIn('Stop loss', bad.get_json()['error'])

            created = client.post('/api/trades', json={
                'asset_category': 'Index',
                'subcategory': 'Nifty',
                'trading_style': 'Intraday',
                'instrument': 'NIFTY FUT',
                'entry_price': 100,
                'entry_datetime': '2026-06-18T10:00',
                'stop_loss': 90,
                'planned_target': 130,
                'position_size': 2,
                'lot_size': 50,
                'direction': 'Long',
                'currency': 'INR',
                'playbook_id': playbook_id,
            }, headers=headers)
            self.assertEqual(created.status_code, 201)
            trade_id = created.get_json()['id']

            closed = client.patch(f'/api/trades/{trade_id}', json={
                'asset_category': 'Index',
                'subcategory': 'Nifty',
                'trading_style': 'Intraday',
                'instrument': 'NIFTY FUT',
                'entry_price': 100,
                'entry_datetime': '2026-06-18T10:00',
                'stop_loss': 90,
                'planned_target': 130,
                'position_size': 2,
                'lot_size': 50,
                'direction': 'Long',
                'currency': 'INR',
                'playbook_id': playbook_id,
                'exit_price': 110,
                'exit_datetime': '2026-06-18T11:00',
                'execution_score': 4,
                'rule_followed': True,
                'mistake_tags': 'Early exit',
                'setup_quality': 'A',
                'review_notes': 'Good entry, exit management can improve.',
                'status': 'closed',
            }, headers=headers)
            self.assertEqual(closed.status_code, 200)
            trade = client.get(f'/api/trades/{trade_id}').get_json()
            self.assertEqual(trade['computed_pnl'], 1000)
            self.assertEqual(trade['planned_rr'], 3)
            self.assertEqual(trade['realized_r'], 1)
            self.assertTrue(trade['reviewed'])
            self.assertEqual(trade['playbook_name'], 'Opening Range Breakout')
            analytics = client.get('/api/analytics').get_json()
            self.assertTrue(analytics['return_distribution'])
            self.assertIsNone(analytics['payoff_ratio'])
            self.assertEqual(analytics['avg_execution_score'], 4)
            self.assertEqual(analytics['playbook_pnl']['Opening Range Breakout'], 1000)
            review = client.get('/api/review/summary').get_json()
            self.assertEqual(review['pending_review_count'], 0)
            self.assertEqual(review['avg_execution_score'], 4)
            self.assertEqual(review['rule_follow_rate'], 100)
            self.assertEqual(review['playbook_coverage'], 100)

            attachment = client.post(
                f'/api/trades/{trade_id}/attachments',
                data={
                    'file': (io.BytesIO(TINY_PNG), 'entry-chart.png'),
                    'caption': 'Entry chart before breakout',
                },
                content_type='multipart/form-data',
                headers=headers,
            )
            self.assertEqual(attachment.status_code, 201)
            attachment_data = attachment.get_json()
            self.assertEqual(attachment_data['caption'], 'Entry chart before breakout')
            self.assertTrue(attachment_data['url'].endswith(f'/api/trade-attachments/{attachment_data["id"]}/file'))
            attachments = client.get(f'/api/trades/{trade_id}/attachments').get_json()
            self.assertEqual(len(attachments), 1)
            attachment_file = client.get(attachment_data['url'])
            self.assertEqual(attachment_file.status_code, 200)
            self.assertEqual(attachment_file.mimetype, 'image/png')
            attachment_file.close()

            export_data = json.loads(client.get('/api/trades/export').data.decode())
            self.assertEqual(export_data['format'], 'tradevault_export_v3')
            self.assertFalse(export_data['attachments']['included'])
            self.assertEqual(export_data['trades'][0]['attachment_count'], 1)

            deleted_attachment = client.delete(
                f'/api/trade-attachments/{attachment_data["id"]}',
                headers=headers,
            )
            self.assertEqual(deleted_attachment.status_code, 200)
            self.assertEqual(client.get(f'/api/trades/{trade_id}/attachments').get_json(), [])

            losing_trade = client.post('/api/trades', json={
                'asset_category': 'Equity',
                'subcategory': 'Large Cap',
                'trading_style': 'Intraday',
                'instrument': 'LOSS TEST',
                'entry_price': 100,
                'entry_datetime': '2026-06-18T12:00',
                'stop_loss': 90,
                'position_size': 1,
                'direction': 'Long',
                'currency': 'INR',
            }, headers=headers)
            self.assertEqual(losing_trade.status_code, 201)
            losing_trade_id = losing_trade.get_json()['id']
            closed_loss = client.patch(f'/api/trades/{losing_trade_id}', json={
                'asset_category': 'Equity',
                'subcategory': 'Large Cap',
                'trading_style': 'Intraday',
                'instrument': 'LOSS TEST',
                'entry_price': 100,
                'entry_datetime': '2026-06-18T12:00',
                'stop_loss': 90,
                'position_size': 1,
                'direction': 'Long',
                'currency': 'INR',
                'exit_price': 80,
                'exit_datetime': '2026-06-18T13:00',
                'status': 'closed',
            }, headers=headers)
            self.assertEqual(closed_loss.status_code, 200)
            analytics = client.get('/api/analytics').get_json()
            self.assertEqual(analytics['payoff_ratio'], 50)
            self.assertEqual(analytics['payoff_ratio'], analytics['win_loss_ratio'])
            self.assertEqual(analytics['adjusted_payoff_ratio'], analytics['adjusted_wl_ratio'])
            self.assertEqual(analytics['currency_analytics']['INR']['net_pnl'], 980)
            self.assertEqual(analytics['currency_analytics']['INR']['expectancy'], 490)

            usd_trade = client.post('/api/trades', json={
                'asset_category': 'US Index',
                'subcategory': 'S&P 500',
                'trading_style': 'Swing',
                'instrument': 'USD TEST',
                'entry_price': 100,
                'entry_datetime': '2026-06-19T12:00',
                'stop_loss': 90,
                'position_size': 1,
                'lot_size': 1,
                'direction': 'Long',
                'currency': 'USD',
            }, headers=headers)
            self.assertEqual(usd_trade.status_code, 201)
            usd_trade_id = usd_trade.get_json()['id']
            closed_usd = client.patch(f'/api/trades/{usd_trade_id}', json={
                'asset_category': 'US Index',
                'subcategory': 'S&P 500',
                'trading_style': 'Swing',
                'instrument': 'USD TEST',
                'entry_price': 100,
                'entry_datetime': '2026-06-19T12:00',
                'stop_loss': 90,
                'position_size': 1,
                'lot_size': 1,
                'direction': 'Long',
                'currency': 'USD',
                'exit_price': 150,
                'exit_datetime': '2026-06-19T13:00',
                'status': 'closed',
            }, headers=headers)
            self.assertEqual(closed_usd.status_code, 200)

            mixed = client.get('/api/analytics').get_json()
            self.assertTrue(mixed['mixed_currency'])
            self.assertEqual(mixed['money_scope'], 'per_currency')
            self.assertEqual(mixed['pnl_by_currency'], {'INR': 980, 'USD': 50})
            self.assertEqual(set(mixed['currency_analytics']), {'INR', 'USD'})
            self.assertEqual(mixed['currency_analytics']['INR']['monthly_pnl'], [
                {'month': '2026-06', 'pnl': 980}
            ])
            self.assertEqual(mixed['currency_analytics']['USD']['net_pnl'], 50)
            self.assertEqual(mixed['currency_analytics']['USD']['expectancy'], 50)
            self.assertEqual(mixed['currency_analytics']['USD']['equity_curve'][0]['cumulative'], 50)
            for field in (
                'avg_win', 'avg_loss', 'payoff_ratio', 'adjusted_payoff_ratio',
                'win_loss_ratio', 'adjusted_wl_ratio', 'profit_factor', 'expectancy',
                'max_drawdown', 'largest_win', 'largest_loss',
            ):
                self.assertIsNone(mixed[field], field)
            for field in ('equity_curve', 'monthly_pnl'):
                self.assertEqual(mixed[field], [], field)
            for field in ('category_pnl', 'strategy_pnl', 'playbook_pnl'):
                self.assertEqual(mixed[field], {}, field)

            usd_only = client.get('/api/analytics?currency=USD').get_json()
            self.assertFalse(usd_only['mixed_currency'])
            self.assertEqual(usd_only['money_scope'], 'single_currency')
            self.assertEqual(usd_only['expectancy'], 50)
            self.assertEqual(usd_only['largest_win'], 50)
            self.assertEqual(usd_only['pnl_by_currency'], {'USD': 50})
            self.assertEqual(set(usd_only['currency_analytics']), {'USD'})

            token = csrf_from(client.get('/change-password'))
            changed = client.post('/change-password', data={
                'csrf_token': token,
                'current_password': 'pass1234',
                'totp_code': pyotp.TOTP(secret).now(),
                'new_password': 'pass5678',
                'confirm_password': 'pass5678',
            })
            self.assertEqual(changed.status_code, 302)
            self.assertIn('/login', changed.headers['Location'])

            token = csrf_from(client.get('/login?username=smokeuser'))
            logged_in = client.post('/login', data={
                'csrf_token': token,
                'username': 'smokeuser',
                'password': 'pass5678',
            })
            self.assertEqual(logged_in.status_code, 302)
            self.assertIn('/dashboard', logged_in.headers['Location'])


if __name__ == '__main__':
    unittest.main()

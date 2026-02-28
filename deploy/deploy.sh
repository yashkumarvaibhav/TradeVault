#!/bin/bash
# TradeVault Production Deployment Script
# Usage: ./deploy.sh

set -e

echo "=== TradeVault Deployment ==="
echo ""

# 1. Install dependencies
echo "[1/5] Installing Python dependencies..."
pip3 install flask pyotp qrcode pillow gunicorn --quiet

# 2. Create systemd service
echo "[2/5] Creating systemd service..."
sudo tee /etc/systemd/system/tradevault.service > /dev/null << 'EOF'
[Unit]
Description=TradeVault Trading Journal
After=network.target

[Service]
User=yashkumarvaibhav
WorkingDirectory=/home/yashkumarvaibhav/Desktop/ArpitProject
ExecStart=/usr/bin/python3 -m gunicorn -w 2 -b 127.0.0.1:5000 app:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 3. Setup nginx
echo "[3/5] Setting up nginx..."
echo ""
echo "  Add the following to your existing nginx server block for yashkumarvaibhav.me:"
echo ""
echo "    location /TradeVault/ {"
echo "        proxy_pass http://127.0.0.1:5000/;"
echo "        proxy_set_header Host \$host;"
echo "        proxy_set_header X-Real-IP \$remote_addr;"
echo "        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;"
echo "        proxy_set_header X-Forwarded-Proto \$scheme;"
echo "        proxy_set_header X-Script-Name /TradeVault;"
echo "        proxy_redirect off;"
echo "    }"
echo ""

# 4. Enable and start service
echo "[4/5] Enabling and starting TradeVault service..."
sudo systemctl daemon-reload
sudo systemctl enable tradevault
sudo systemctl restart tradevault

# 5. Reload nginx
echo "[5/5] Reloading nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "=== Deployment Complete ==="
echo "TradeVault should now be available at: https://yashkumarvaibhav.me/TradeVault"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status tradevault  # Check status"
echo "  sudo journalctl -u tradevault -f  # View logs"
echo "  sudo systemctl restart tradevault # Restart"

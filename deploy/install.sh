#!/bin/bash
# install.sh - Automated production setup script for Ubuntu 24.04 LTS
# Run this as sudo on AWS EC2: sudo ./install.sh

set -e

echo "=========================================================="
echo "      DMR Network Control Station Installation Engine     "
echo "=========================================================="

# 1. Verify Root execution
if [ "$EUID" -ne 0 ]; then
  echo "[-] CRITICAL CAUTION: Please run as root (sudo ./install.sh)."
  exit 1
fi

# 2. Add Repositories and Update Package System
echo "[+] Step 1: Updating packages & adding repositories..."
apt-get update -y
apt-get upgrade -y
apt-get install -y python3-pip python3-venv python3-dev apache2 apache2-utils git curl sqlite3 libsqlite3-dev snapd ufw

# 3. Enable Apache modules for reverse proxy and rewrite rules
echo "[+] Step 2: Enabling required Apache modules..."
a2enmod proxy
a2enmod proxy_http
a2enmod proxy_wstunnel
a2enmod rewrite
a2enmod headers
a2enmod ssl

# 4. Create paths and move system components to /opt
echo "[+] Step 3: Configuring directory structures..."
INSTALL_DIR="/opt/dmr_ncs_system"
mkdir -p "$INSTALL_DIR"
mkdir -p /var/log/gunicorn
mkdir -p /var/log/mmdvm

# Copy current files to deployment directory
cp -r ./* "$INSTALL_DIR/" || true
cd "$INSTALL_DIR"

# 5. Build isolated Python Virtual Environment
echo "[+] Step 4: Configuring virtual environment..."
python3 -m venv venv
source venv/bin/bin/activate || source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 6. Run Database Setup and populate default data
echo "[+] Step 5: Seeding SQLite database schemas..."
python setup_database.py --admin admin --password "vulcan3efz!"

# 7. Apply Ownership and folder permission standards
echo "[+] Step 6: Locking down directory permissions..."
chown -R root:www-data "$INSTALL_DIR"
chmod -R 775 "$INSTALL_DIR"
chmod 664 /opt/dmr_ncs_system/dmr_control_station.db || true
chown -R www-data:www-data /var/log/gunicorn

# Create mockup ABInfo file to avoid exceptions during startup
if [ ! -f "/tmp/ABInfo_31001.json" ]; then
  echo '{"digital": {"gw":"4040444", "rpt":"404044418", "tg":"91", "call":"VU3EFZ"}}' > /tmp/ABInfo_31001.json
  chmod 666 /tmp/ABInfo_31001.json
fi

# 8. Copy and activate systemd service
echo "[+] Step 7: Configuring systemd services..."
cp "$INSTALL_DIR/dvs-admin.service" /etc/systemd/system/dmr-ncs.service
systemctl daemon-reload
systemctl enable dmr-ncs.service

# 9. Configure Apache Web Configurations and default SSL certifications
echo "[+] Step 8: Deploying Apache reverse-proxy virtual hosts..."
cp "$INSTALL_DIR/apache2.conf" /etc/apache2/sites-available/dmr-ncs.conf

# Create dummy self-signed cert structures so apache doesn't crash prior to certbot execution
mkdir -p /etc/letsencrypt/live/dmr.realneilbruce.in/ /etc/letsencrypt/live/dvs.realneilbruce.in/
touch /etc/letsencrypt/options-ssl-apache.conf
if [ ! -f "/etc/letsencrypt/live/dmr.realneilbruce.in/fullchain.pem" ]; then
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/letsencrypt/live/dmr.realneilbruce.in/privkey.pem \
      -out /etc/letsencrypt/live/dmr.realneilbruce.in/fullchain.pem \
      -subj "/C=IN/ST=Karnataka/L=Bangalore/O=AmateurRadio/CN=dmr.realneilbruce.in"
fi
if [ ! -f "/etc/letsencrypt/live/dvs.realneilbruce.in/fullchain.pem" ]; then
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/letsencrypt/live/dvs.realneilbruce.in/privkey.pem \
      -out /etc/letsencrypt/live/dvs.realneilbruce.in/fullchain.pem \
      -subj "/C=IN/ST=Karnataka/L=Bangalore/O=AmateurRadio/CN=dvs.realneilbruce.in"
fi

a2ensite dmr-ncs.conf
systemctl restart apache2

# 10. Start the NCS engine
systemctl start dmr-ncs.service

echo "=========================================================="
echo "[+] SUCCESSFUL PRODUCTION INSTALLATION COMPLETED          "
echo "  Public Site:  https://dmr.realneilbruce.in              "
echo "  Admin Portal: https://dvs.realneilbruce.in/admin        "
echo "  Default User: admin                                     "
echo "  Default Pass: vulcan3efz!                               "
echo "  Please run 'sudo certbot --apache' to obtain Let's      "
echo "  Encrypt live SSL production certificates.               "
echo "=========================================================="

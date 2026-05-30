#!/bin/bash
# install.sh - One-command production setup for Ubuntu 24.04 LTS
# Usage: curl -fsSL https://example.invalid/install.sh | sudo bash

set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "[-] Please run as root (curl ... | sudo bash)." >&2
  exit 1
fi

INSTALL_DIR="${INSTALL_DIR:-/opt/dmr_ncs_system}"
ENV_FILE="${ENV_FILE:-/etc/dmr-ncs.env}"
PORT="${PORT:-5000}"
GUNICORN_WORKERS="${GUNICORN_WORKERS:-1}"
APACHE_SERVER_NAME="${APACHE_SERVER_NAME:-_}"

SECRET_KEY="${SECRET_KEY:-$(openssl rand -hex 32)}"
INITIAL_ADMIN_USERNAME="${INITIAL_ADMIN_USERNAME:-admin}"
INITIAL_ADMIN_PASSWORD="${INITIAL_ADMIN_PASSWORD:-$(openssl rand -base64 24 | tr -d '=+/')}"
STATION_CALLSIGN="${STATION_CALLSIGN:?Set STATION_CALLSIGN before installation}"
STATION_DMR_ID="${STATION_DMR_ID:?Set STATION_DMR_ID before installation}"
REPEATER_ID="${REPEATER_ID:-}"
DEFAULT_TALKGROUP="${DEFAULT_TALKGROUP:-91}"
APRS_IS_CALLSIGN="${APRS_IS_CALLSIGN:-$STATION_CALLSIGN}"
APRS_IS_PASSCODE="${APRS_IS_PASSCODE:--1}"

apt-get update -y
apt-get install -y python3-pip python3-venv python3-dev apache2 apache2-utils git curl sqlite3 libsqlite3-dev openssl sudo ufw

a2enmod proxy proxy_http proxy_wstunnel rewrite headers ssl

id -u dmrncs >/dev/null 2>&1 || useradd --system --home "$INSTALL_DIR" --shell /usr/sbin/nologin --groups www-data dmrncs
mkdir -p "$INSTALL_DIR" /var/log/gunicorn /var/log/mmdvm /var/log/dvswitch
cp -r ./* "$INSTALL_DIR/" || true
cd "$INSTALL_DIR"

python3 -m venv venv
# shellcheck disable=SC1091
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

cat > "$ENV_FILE" <<ENV
SECRET_KEY=$SECRET_KEY
DATABASE_URL=sqlite:////opt/dmr_ncs_system/dmr_control_station.db
PORT=$PORT
GUNICORN_WORKERS=$GUNICORN_WORKERS
INITIAL_ADMIN_USERNAME=$INITIAL_ADMIN_USERNAME
INITIAL_ADMIN_PASSWORD=$INITIAL_ADMIN_PASSWORD
STATION_CALLSIGN=$STATION_CALLSIGN
STATION_DMR_ID=$STATION_DMR_ID
REPEATER_ID=$REPEATER_ID
DEFAULT_TALKGROUP=$DEFAULT_TALKGROUP
APRS_ENABLED=${APRS_ENABLED:-true}
APRS_IS_CALLSIGN=$APRS_IS_CALLSIGN
APRS_IS_PASSCODE=$APRS_IS_PASSCODE
APRS_IS_HOST=${APRS_IS_HOST:-rotate.aprs2.net}
APRS_IS_PORT=${APRS_IS_PORT:-14580}
APRS_IS_FILTER=${APRS_IS_FILTER:-t/poimqstunw}
SESSION_COOKIE_SECURE=${SESSION_COOKIE_SECURE:-true}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
ENV
chmod 600 "$ENV_FILE"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

python setup_database.py --admin "$INITIAL_ADMIN_USERNAME" --password "$INITIAL_ADMIN_PASSWORD"
venv/bin/alembic -c alembic.ini stamp head || true

python3 - <<'PYAB'
import json, os
path = os.environ.get('AB_INFO_FILE', '/tmp/ABInfo_31001.json')
os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
with open(path, 'w', encoding='utf-8') as fh:
    json.dump({"digital": {"gw": os.environ['STATION_DMR_ID'], "rpt": os.environ.get('REPEATER_ID', ''), "tg": os.environ.get('DEFAULT_TALKGROUP', '91'), "call": os.environ['STATION_CALLSIGN']}}, fh)
PYAB
chmod 660 "${AB_INFO_FILE:-/tmp/ABInfo_31001.json}" || true

chown -R dmrncs:www-data "$INSTALL_DIR"
chmod -R 750 "$INSTALL_DIR"
chmod 660 "$INSTALL_DIR/dmr_control_station.db" || true
chown -R dmrncs:www-data /var/log/gunicorn
cat > /etc/sudoers.d/dmr-ncs <<SUDOERS
dmrncs ALL=(root) NOPASSWD: /bin/systemctl start apache2, /bin/systemctl stop apache2, /bin/systemctl restart apache2, /bin/systemctl start dmr-ncs, /bin/systemctl stop dmr-ncs, /bin/systemctl restart dmr-ncs, /bin/systemctl start Analog_Bridge, /bin/systemctl stop Analog_Bridge, /bin/systemctl restart Analog_Bridge, /bin/systemctl start MMDVM_Bridge, /bin/systemctl stop MMDVM_Bridge, /bin/systemctl restart MMDVM_Bridge, /bin/systemctl start md380-emu, /bin/systemctl stop md380-emu, /bin/systemctl restart md380-emu, ${DVSWITCH_SCRIPT:-/opt/MMDVM_Bridge/dvswitch.sh} tune *, ${DVSWITCH_SCRIPT:-/opt/MMDVM_Bridge/dvswitch.sh} disconnect
SUDOERS
chmod 440 /etc/sudoers.d/dmr-ncs

cp "$INSTALL_DIR/dvs-admin.service" /etc/systemd/system/dmr-ncs.service
cp "$INSTALL_DIR/apache2.conf" /etc/apache2/sites-available/dmr-ncs.conf
cp "$INSTALL_DIR/dmr-ncs" /usr/local/bin/dmr-ncs
chmod 755 /usr/local/bin/dmr-ncs
a2ensite dmr-ncs.conf
systemctl daemon-reload
systemctl enable dmr-ncs.service
systemctl restart apache2
systemctl restart dmr-ncs.service

cat <<OUT
==========================================================
[+] DMR NCS appliance installation complete
    URL: configure Apache ServerName/certificates as required
    Admin user: $INITIAL_ADMIN_USERNAME
    Admin password: $INITIAL_ADMIN_PASSWORD
    Env file: $ENV_FILE
==========================================================
OUT

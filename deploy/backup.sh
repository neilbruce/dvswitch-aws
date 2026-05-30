#!/bin/bash
# backup.sh - Automated Automated DB, configuration, and log backup utility
# Recommending cron schedule: 0 4 * * * /opt/dmr_ncs_system/backup.sh

set -e

BACKUP_DIR="/opt/dmr_ncs_system/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PATH="$BACKUP_DIR/ncs_backup_$TIMESTAMP"

mkdir -p "$BACKUP_PATH"

echo "[+] Initiating complete system backup checklist..."

# 1. Back up SQLite Database
if [ -f "/opt/dmr_ncs_system/dmr_control_station.db" ]; then
    sqlite3 /opt/dmr_ncs_system/dmr_control_station.db ".backup '$BACKUP_PATH/dmr_control_station.db'"
    echo "[+] Database backup successfully processed."
else
    echo "[-] WARNING: Database file dmr_control_station.db was not found on path."
fi

# 2. Back up configuration files
echo "[+] Copying system environments, models and config declarations..."
cp /opt/dmr_ncs_system/config.py "$BACKUP_PATH/" || true
cp /opt/dmr_ncs_system/app.py "$BACKUP_PATH/" || true
cp /opt/dmr_ncs_system/models.py "$BACKUP_PATH/" || true
cp /etc/apache2/sites-available/dmr-ncs.conf "$BACKUP_PATH/apache_site_vhost.conf" || true
cp /etc/systemd/system/dmr-ncs.service "$BACKUP_PATH/" || true

# 3. Back up user reports, CSV, exports, ADIF structures
echo "[+] Packaging user reports, logs & ADIF database..."
if [ -d "/opt/dmr_ncs_system/reports" ] || [ -d "/opt/dmr_ncs_system/exports" ]; then
    tar -czf "$BACKUP_PATH/reports_exports_adif.tar.gz" -C /opt/dmr_ncs_system reports exports || true
fi

# 4. Back up current MMDVM logs
if [ -d "/var/log/mmdvm" ]; then
    tar -czf "$BACKUP_PATH/mmdvm_logs.tar.gz" -C /var log/mmdvm || true
fi

# 5. Compress full backup bundle
cd "$BACKUP_DIR"
tar -czf "ncs_backup_full_$TIMESTAMP.tar.gz" -C "$BACKUP_DIR" "ncs_backup_$TIMESTAMP"
rm -rf "$BACKUP_PATH"

# 6. Retain only latest 7 copies (Auto rotation)
echo "[+] Rotating logs: Removing backups older than 7 days..."
find "$BACKUP_DIR" -name "ncs_backup_full_*.tar.gz" -mtime +7 -exec rm {} \;

echo "[+] Backup successfully compiled and saved to: $BACKUP_DIR/ncs_backup_full_$TIMESTAMP.tar.gz"

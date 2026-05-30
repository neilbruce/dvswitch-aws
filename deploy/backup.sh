#!/bin/bash
# backup.sh - DB, configuration, exports, and log backup utility with 30-day retention.

set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/dmr_ncs_system}"
BACKUP_DIR="${BACKUP_DIR:-$INSTALL_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PATH="$BACKUP_DIR/ncs_backup_$TIMESTAMP"
ENV_FILE="${ENV_FILE:-/etc/dmr-ncs.env}"

mkdir -p "$BACKUP_PATH"

if [ -f "$INSTALL_DIR/dmr_control_station.db" ]; then
    sqlite3 "$INSTALL_DIR/dmr_control_station.db" ".backup '$BACKUP_PATH/dmr_control_station.db'"
fi

for file in "$ENV_FILE" "$INSTALL_DIR/config.py" "$INSTALL_DIR/app.py" "$INSTALL_DIR/models.py" /etc/apache2/sites-available/dmr-ncs.conf /etc/systemd/system/dmr-ncs.service; do
    [ -f "$file" ] && cp "$file" "$BACKUP_PATH/$(basename "$file")"
done

for dir in "$INSTALL_DIR/reports" "$INSTALL_DIR/exports" /var/log/mmdvm /var/log/dvswitch /var/log/apache2 /var/log/gunicorn; do
    if [ -d "$dir" ]; then
        safe_name=$(echo "$dir" | tr '/' '_')
        tar -czf "$BACKUP_PATH/${safe_name}.tar.gz" -C / "${dir#/}"
    fi
done

cd "$BACKUP_DIR"
tar -czf "ncs_backup_full_$TIMESTAMP.tar.gz" -C "$BACKUP_DIR" "ncs_backup_$TIMESTAMP"
rm -rf "$BACKUP_PATH"
find "$BACKUP_DIR" -name "ncs_backup_full_*.tar.gz" -mtime +"$RETENTION_DAYS" -delete

echo "Backup saved to $BACKUP_DIR/ncs_backup_full_$TIMESTAMP.tar.gz"

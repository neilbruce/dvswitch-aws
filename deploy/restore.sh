#!/bin/bash
# restore.sh - Disaster recovery restoration helper.
# Usage: sudo ./restore.sh /opt/dmr_ncs_system/backups/ncs_backup_full_YYYYMMDD_HHMMSS.tar.gz

set -euo pipefail

BACKUP_FILE="${1:-}"
INSTALL_DIR="${INSTALL_DIR:-/opt/dmr_ncs_system}"
ENV_FILE="${ENV_FILE:-/etc/dmr-ncs.env}"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "Usage: sudo ./restore.sh <backup_file_path.tar.gz>" >&2
    exit 1
fi

read -r -p "This will overwrite current DMR NCS database/config/log archives. Continue? (y/N): " reply
if [[ ! "$reply" =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 1
fi

systemctl stop dmr-ncs.service || true
TEMP_RESTORE_DIR="/tmp/ncs_restore_space"
rm -rf "$TEMP_RESTORE_DIR"
mkdir -p "$TEMP_RESTORE_DIR"
tar -xzf "$BACKUP_FILE" -C "$TEMP_RESTORE_DIR"
REST_PATH="$TEMP_RESTORE_DIR/$(find "$TEMP_RESTORE_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | head -n1)"

if [ -f "$REST_PATH/dmr_control_station.db" ]; then
    cp "$REST_PATH/dmr_control_station.db" "$INSTALL_DIR/dmr_control_station.db"
    chown dmrncs:www-data "$INSTALL_DIR/dmr_control_station.db" || true
    chmod 660 "$INSTALL_DIR/dmr_control_station.db"
fi

for file in config.py app.py models.py; do
    [ -f "$REST_PATH/$file" ] && cp "$REST_PATH/$file" "$INSTALL_DIR/$file"
done
[ -f "$REST_PATH/dmr-ncs.env" ] && cp "$REST_PATH/dmr-ncs.env" "$ENV_FILE" && chmod 600 "$ENV_FILE"
[ -f "$REST_PATH/dmr-ncs.conf" ] && cp "$REST_PATH/dmr-ncs.conf" /etc/apache2/sites-available/dmr-ncs.conf
[ -f "$REST_PATH/dmr-ncs.service" ] && cp "$REST_PATH/dmr-ncs.service" /etc/systemd/system/dmr-ncs.service

for archive in "$REST_PATH"/*.tar.gz; do
    [ -f "$archive" ] || continue
    case "$(basename "$archive")" in
        *_opt_dmr_ncs_system_reports.tar.gz|*_opt_dmr_ncs_system_exports.tar.gz|*_var_log_mmdvm.tar.gz|*_var_log_dvswitch.tar.gz|*_var_log_apache2.tar.gz|*_var_log_gunicorn.tar.gz)
            tar -xzf "$archive" -C /
            ;;
    esac
done

chown -R dmrncs:www-data "$INSTALL_DIR" /var/log/gunicorn || true
systemctl daemon-reload
systemctl start dmr-ncs.service
systemctl restart apache2
rm -rf "$TEMP_RESTORE_DIR"
echo "Restore completed. Run: sudo dmr-ncs healthcheck"

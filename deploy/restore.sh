#!/bin/bash
# restore.sh - Disaster recovery system restoration helper script
# Usage: sudo ./restore.sh /opt/dmr_ncs_system/backups/ncs_backup_full_YYYYMMDD_HHMMSS.tar.gz

set -e

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "[-] Error: Please specify the backup file path to restore."
    echo "    Usage: sudo ./restore.sh <backup_file_path.tar.gz>"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "[-] Error: The backup file specified does not exist."
    exit 1
fi

echo "=========================================================="
echo "          DMR NCS Platform Recovery Console               "
echo "=========================================================="
echo "[!] WARNING: This will overwrite current database, configs, and system logs."
read -p "Are you sure you want to proceed with restore operations? (y/N): " -r
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "[-] Restore cancelled."
    exit 1
fi

# Stop services
echo "[+] Stopping services before restoration..."
systemctl stop dmr-ncs.service || true

# Extract full archive
TEMP_RESTORE_DIR="/tmp/ncs_restore_space"
rm -rf "$TEMP_RESTORE_DIR"
mkdir -p "$TEMP_RESTORE_DIR"
tar -xzf "$BACKUP_FILE" -C "$TEMP_RESTORE_DIR"

# Identify folder name inside
INNER_FOLDER=$(ls "$TEMP_RESTORE_DIR")
REST_PATH="$TEMP_RESTORE_DIR/$INNER_FOLDER"

# Restore SQLite Database
if [ -f "$REST_PATH/dmr_control_station.db" ]; then
    echo "[+] Restoring SQLite database file..."
    cp "$REST_PATH/dmr_control_station.db" /opt/dmr_ncs_system/dmr_control_station.db
    chmod 664 /opt/dmr_ncs_system/dmr_control_station.db
    chown root:www-data /opt/dmr_ncs_system/dmr_control_station.db
fi

# Restore configurations
echo "[+] Restoring system source scripts..."
cp "$REST_PATH/config.py" /opt/dmr_ncs_system/ || true
cp "$REST_PATH/app.py" /opt/dmr_ncs_system/ || true
cp "$REST_PATH/models.py" /opt/dmr_ncs_system/ || true

# Restore reports/exports if bundled
if [ -f "$REST_PATH/reports_exports_adif.tar.gz" ]; then
    echo "[+] Restoring Net Reports and ADIF records..."
    tar -xzf "$REST_PATH/reports_exports_adif.tar.gz" -C /opt/dmr_ncs_system/
fi

# Restore Apache logs
if [ -f "$REST_PATH/mmdvm_logs.tar.gz" ]; then
    echo "[+] Restoring historic MMDVM Radio Logs..."
    tar -xzf "$REST_PATH/mmdvm_logs.tar.gz" -C /
fi

# Restart services
echo "[+] Restarting services to apply restored structures..."
systemctl start dmr-ncs.service
systemctl restart apache2

# Clean temporary folders
rm -rf "$TEMP_RESTORE_DIR"

echo "=========================================================="
echo "[+] RECOVERY RESTORE PROCESS COMPLETED SUCCESSFULLY       "
echo "=========================================================="

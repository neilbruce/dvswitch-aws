# db_maintenance.py - SQLite Database Maintenance Daemon
# Place in crontab: 0 2 1 * * /opt/dmr_ncs_system/venv/bin/python /opt/dmr_ncs_system/db_maintenance.py

import os
import sys
import sqlite3
import datetime

# Add parent directory to path so imports work
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from config import Config

def maintain_database():
    print(f"[{datetime.datetime.utcnow().isoformat()}] Starting DB Maintenance routine...")
    db_path = Config.SQLALCHEMY_DATABASE_URI.replace("sqlite:///", "")
    
    if not os.path.exists(db_path):
        print(f"[-] Error: SQLite database not found on: {db_path}")
        sys.exit(1)
        
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 1. Clean up old transient Heard records older than 90 days to free storage
        print("[+] Pruning obsolete transmissions older than 90 days...")
        ninety_days_ago = (datetime.datetime.utcnow() - datetime.timedelta(days=90)).strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute("DELETE FROM heard WHERE last_heard < ?", (ninety_days_ago,))
        prune_count = cursor.rowcount
        print(f"[+] Pruned {prune_count} transaction log entries.")
        
        # 2. Re-index all primary indexes to clear overhead fragmentation
        print("[+] Tuning indices and optimizing columns...")
        cursor.execute("REINDEX")
        
        # 3. Compile VACUUM to reduce filesystem disk layout allocations
        print("[+] Compressing database storage via VACUUM...")
        cursor.execute("VACUUM")
        
        conn.commit()
        conn.close()
        print("[+] SUCCESS: Database maintenance completed successfully without interrupts.")
        
    except sqlite3.Error as e:
        print(f"[-] CRITICAL FAILURE: Database maintenance failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    maintain_database()

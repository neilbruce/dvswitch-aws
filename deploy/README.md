# DMR Network Control Station Platform (DVSwitch / BrandMeister)

This repository contains a production-grade Network Control Station platform designed for **DVSwitch**, **MMDVM**, and **BrandMeister** gateways. It is built to run reliably on on-premise hardware or cloud-based AWS EC2 Ubuntu 24.04 nodes, acting as a DMR hotspot controller, tactical check-in management console, log analyzer, and APRS position tracker.

---

## 🏗️ Architectural Layout

### 🐍 Backend Service System
* **Framework:** Python 3.14 + Flask Core WSGI
* **Database Driver:** SQLAlchemy with localized multi-indexed SQLite database
* **Task Automation:** APScheduler background daemons (automatically parsing MMDVM radio files every 5 seconds, triggering weekly Saturday Net schedules at 21:30 IST, and closing Sunday Nets at 03:00 IST)
* **Web Server Binding:** Gunicorn WSGI running 3 parallel workers proxying to port 5000

### 🎨 Human Cockpit (Frontend Portal)
* **UI Engine:** React with Vite compilation
* **Styling Matrix:** Tailwind CSS v4 design rules
* **Telemetry Visuals:** Recharts activity vector models
* **Design Standards:** Modular, deep charcoal night-mode contrast, projecting board layouts

---

## 🛠️ Complete Installation Manual (AWS EC2 Ubuntu 24.04)

### 1. clone current workspace and execute setup
First, move all files inside `/deploy` to your deployment path, such as `/opt/dmr_ncs_system`.
Execute the built-in command script:
```bash
sudo chmod +x install.sh backup.sh restore.sh
sudo ./install.sh
```

### 2. Obtain Free SSL Handshake certificates
Deploy automatic configuration using Certbot to bind domain names securely:
```bash
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
sudo certbot --apache -d dmr.realneilbruce.in -d dvs.realneilbruce.in
```

### 3. Initialize cron tab
Register log rotation configuration, database purgers, and automatic backup routines:
```bash
# Add logrotate rules
sudo cp logrotate.conf /etc/logrotate.d/dmr-ncs

# Configure system cron triggers (sudo crontab -e)
0 4 * * * /opt/dmr_ncs_system/backup.sh
0 2 1 * * /opt/dmr_ncs_system/venv/bin/python /opt/dmr_ncs_system/db_maintenance.py
```

---

## 🔒 Security and Roles Control Matrix

The administrator cockpit can authenticate users based on security profiles.
Users can log in with:

| User Account | Access Key Passphrase | Role Permissions |
| :--- | :--- | :--- |
| **admin** | `vulcan3efz!` | Full Admin (Tune TG, Service stop/reboots, Start nets, CSV/ADIF Exports) |
| **readonly** | `radio` | Guest Observer (View status indicators, logs, APRS compass feeds) |

Passwords must be securely updated and changed in the db models setting inside `/opt/dmr_ncs_system/setup_database.py`.

---

## 📂 Deployment File References

The relevant configuration files deployed in this platform:
* `/deploy/app.py`: Main Flask API router & Scheduler process loops
* `/deploy/models.py`: SQLAlchemy database tables
* `/deploy/apache2.conf`: Apache virtualhosts configuration mapping HTTPS domains
* `/deploy/dvs-admin.service`: Systemd service starting Gunicorn
* `/deploy/install.sh`: Master automation setup script
* `/deploy/backup.sh`: Daily database backup process
* `/deploy/restore.sh`: Recovery tools for system restoration
* `/deploy/db_maintenance.py`: Monthly VACUUM schema indexing
* `/deploy/logrotate.conf`: Gunicorn and MMDVM files auto-clean

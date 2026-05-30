# setup_database.py - Database Initializer & Migration Tool
import os
import sys
import argparse
from werkzeug.security import generate_password_hash

# Add parent directory to path so imports work
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from flask import Flask
from models import db, Role, User, Talkgroup, Setting

def create_app():
    from config import Config
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    return app

def populate_default_talkgroups():
    tgs = [
        {"number": 91, "name": "Worldwide", "country": "Worldwide", "description": "Primary International TG", "category": "International", "language": "English", "region": "Global"},
        {"number": 92, "name": "Europe", "country": "Europe-wide", "description": "European Regional TG", "category": "Regional", "language": "Multi", "region": "Europe"},
        {"number": 93, "name": "North America", "country": "North America", "description": "North American Regional TG", "category": "Regional", "language": "English", "region": "North America"},
        {"number": 404, "name": "India", "country": "India", "description": "Primary National Talkgroup", "category": "National", "language": "Multi", "region": "India"},
        {"number": 40480, "name": "India English", "country": "India", "description": "National English Language Net", "category": "National", "language": "English", "region": "India"},
        {"number": 3100, "name": "USA Bridge", "country": "United States", "description": "USA Nationwide Bridge", "category": "National", "language": "English", "region": "North America"},
        {"number": 235, "name": "United Kingdom", "country": "United Kingdom", "description": "UK National Talkgroup", "category": "National", "language": "English", "region": "Europe"},
        {"number": 505, "name": "Australia", "country": "Australia", "description": "Australia National Talkgroup", "category": "National", "language": "English", "region": "Oceania"},
        {"number": 910, "name": "Worldwide German", "country": "Worldwide", "description": "German Language Primary", "category": "Language", "language": "German", "region": "Global"},
    ]
    for tg_data in tgs:
        existing = db.session.get(Talkgroup, tg_data["number"])
        if not existing:
            tg = Talkgroup(**tg_data)
            db.session.add(tg)
    db.session.commit()
    print("Talkgroup directory database populated successfully.")

def initialize_db(admin_user, admin_pass):
    app = create_app()
    with app.app_context():
        # Ensure directories exist
        from config import Config
        os.makedirs(Config.EXPORT_DIR, exist_ok=True)
        os.makedirs(Config.REPORT_DIR, exist_ok=True)
        os.makedirs(Config.BACKUP_DIR, exist_ok=True)

        # Create all tables
        db.create_all()
        print("Database schema updated and all tables verified.")

        # Create Roles
        admin_role = Role.query.filter_by(name="Admin").first()
        if not admin_role:
            admin_role = Role(name="Admin", description="NCS Station Super Administrator. Full read/write and script execute permissions.")
            db.session.add(admin_role)

        readonly_role = Role.query.filter_by(name="ReadOnly").first()
        if not readonly_role:
            readonly_role = Role(name="ReadOnly", description="ReadOnly Observer Dashboard access. No control capabilities.")
            db.session.add(readonly_role)
        db.session.commit()

        # Create Admin User
        admin = User.query.filter_by(username=admin_user).first()
        if not admin:
            admin = User(
                username=admin_user,
                email="admin@realneilbruce.in",
                password_hash=generate_password_hash(admin_pass),
                active=True
            )
            admin.roles.append(admin_role)
            db.session.add(admin)
            print(f"Created administrator account: {admin_user}")
        else:
            admin.password_hash = generate_password_hash(admin_pass)
            print(f"Admin account found: Password updated.")

        # Seed Settings table
        settings_seed = {
            "autotune_net_active": "true",
            "log_parse_interval": "5",
            "brandmeister_status": "online",
            "last_tune_timestamp": "2026-05-30 08:59:48",
            "aprs_reporting_callsign": "VU3EFZ-9",
            "aprs_server": "rotate.aprs2.net:14580"
        }
        for k, v in settings_seed.items():
            s = db.session.get(Setting, k)
            if not s:
                db.session.add(Setting(key=k, value=v, group='radio_ncs'))
        
        db.session.commit()
        
        # Populate talkgroups
        populate_default_talkgroups()
        print("Database initialized successfully.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DMR NCS System Database Initialization Utility")
    parser.add_argument("--admin", type=str, default="admin", help="Admin username")
    parser.add_argument("--password", type=str, default="vulcan3efz!", help="Admin secure password")
    args = parser.parse_args()
    initialize_db(args.admin, args.password)

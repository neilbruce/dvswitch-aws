# setup_database.py - Database Initializer & Migration Bootstrap
import os
import sys
import argparse
import secrets
from werkzeug.security import generate_password_hash

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from flask import Flask
from models import db, Role, User, Setting


def create_app():
    from config import Config
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    return app


def initialize_db(admin_user, admin_pass):
    app = create_app()
    with app.app_context():
        from config import Config
        os.makedirs(Config.EXPORT_DIR, exist_ok=True)
        os.makedirs(Config.REPORT_DIR, exist_ok=True)
        os.makedirs(Config.BACKUP_DIR, exist_ok=True)
        db.create_all()

        roles = {
            "Admin": "NCS station administrator with radio, system, and user-control permissions.",
            "Operator": "NCS net-control operator with radio/net logging permissions.",
            "ReadOnly": "Read-only observer access.",
        }
        role_objects = {}
        for name, description in roles.items():
            role = Role.query.filter_by(name=name).first() or Role(name=name)
            role.description = description
            db.session.add(role)
            role_objects[name] = role
        db.session.commit()

        admin = User.query.filter_by(username=admin_user).first()
        if not admin:
            admin = User(username=admin_user, email=os.environ.get('INITIAL_ADMIN_EMAIL'), active=True)
            admin.roles.append(role_objects["Admin"])
            db.session.add(admin)
        admin.password_hash = generate_password_hash(admin_pass, method='scrypt')
        db.session.commit()

        settings_seed = {
            "autotune_net_active": "true",
            "log_parse_interval": "5",
            "station_callsign": Config.STATION_CALLSIGN,
            "station_dmr_id": Config.STATION_DMR_ID,
            "aprs_reporting_callsign": Config.APRS_IS_CALLSIGN,
            "aprs_server": f"{Config.APRS_IS_HOST}:{Config.APRS_IS_PORT}",
        }
        for key, value in settings_seed.items():
            row = db.session.get(Setting, key)
            if not row:
                db.session.add(Setting(key=key, value=str(value), group='radio_ncs'))
            else:
                row.value = str(value)
        db.session.commit()
        print("Database initialized. Run /api/talkgroups/sync or the installer sync step to load BrandMeister talkgroups.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DMR NCS System Database Initialization Utility")
    parser.add_argument("--admin", type=str, default=os.environ.get('INITIAL_ADMIN_USERNAME', 'admin'), help="Admin username")
    parser.add_argument("--password", type=str, default=os.environ.get('INITIAL_ADMIN_PASSWORD'), help="Admin secure password")
    args = parser.parse_args()
    password = args.password
    if not password:
        password = secrets.token_urlsafe(24)
        print("Generated administrative password; save it immediately:")
        print(f"USERNAME={args.admin}")
        print(f"PASSWORD={password}")
    if len(password) < 14:
        print("Admin password must be at least 14 characters.", file=sys.stderr)
        sys.exit(1)
    initialize_db(args.admin.lower(), password)

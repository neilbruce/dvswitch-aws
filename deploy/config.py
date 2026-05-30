# config.py - Production Configuration for DMR NCS Platform
import os
import secrets

class Config:
    # Flask application secrets
    SECRET_KEY = os.environ.get('SECRET_KEY', secrets.token_hex(32))
    
    # CSRF, Cookie, and Session protections
    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = 3600
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    REMEMBER_COOKIE_SECURE = True
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SAMESITE = 'Lax'
    
    # Database configurations
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL', 
        f"sqlite:///{os.path.join(BASE_DIR, 'dmr_control_station.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_recycle': 280,
        'pool_timeout': 20,
        'pool_size': 10,
        'max_overflow': 10,
    }
    
    # Rate Limiting configuration
    RATELIMIT_DEFAULT = "200 per day;50 per hour"
    RATELIMIT_STORAGE_URL = "memory://"
    
    # Radio & MMDVM File Configurations
    AB_INFO_FILE = "/tmp/ABInfo_31001.json"
    DVSWITCH_SCRIPT = "/opt/MMDVM_Bridge/dvswitch.sh"
    LOG_DIR = "/var/log/mmdvm"
    
    # Net Automatic Schedule Settings (timezone Asia/Kolkata)
    TIMEZONE = "Asia/Kolkata"
    NET_AUTOMATIC_TG = 91
    
    # Export File Storage
    EXPORT_DIR = os.path.join(BASE_DIR, 'exports')
    REPORT_DIR = os.path.join(BASE_DIR, 'reports')
    BACKUP_DIR = os.path.join(BASE_DIR, 'backups')

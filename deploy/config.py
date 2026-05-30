# config.py - Production Configuration for DMR NCS Platform
import os

class Config:
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    ENV = os.environ.get('FLASK_ENV', 'production')
    DEBUG = False
    TESTING = False

    SECRET_KEY = os.environ.get('SECRET_KEY')
    if not SECRET_KEY or SECRET_KEY in {'change-me', 'dev', 'secret'}:
        raise RuntimeError('SECRET_KEY must be set to a unique random value before starting the NCS dashboard')

    WTF_CSRF_ENABLED = True
    WTF_CSRF_CHECK_DEFAULT = False
    WTF_CSRF_TIME_LIMIT = int(os.environ.get('WTF_CSRF_TIME_LIMIT', '3600'))
    SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'true').lower() == 'true'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = os.environ.get('SESSION_COOKIE_SAMESITE', 'Lax')
    REMEMBER_COOKIE_SECURE = SESSION_COOKIE_SECURE
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SAMESITE = SESSION_COOKIE_SAMESITE
    PERMANENT_SESSION_LIFETIME = int(os.environ.get('SESSION_LIFETIME_SECONDS', '21600'))

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        f"sqlite:///{os.path.join(BASE_DIR, 'dmr_control_station.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {'pool_pre_ping': True}
    if not SQLALCHEMY_DATABASE_URI.startswith('sqlite'):
        SQLALCHEMY_ENGINE_OPTIONS.update({'pool_recycle': 280, 'pool_timeout': 20, 'pool_size': 10, 'max_overflow': 10})

    RATELIMIT_DEFAULT = os.environ.get('RATELIMIT_DEFAULT', '200 per day;50 per hour')
    RATELIMIT_STORAGE_URL = os.environ.get('RATELIMIT_STORAGE_URL', 'memory://')

    STATION_CALLSIGN = os.environ.get('STATION_CALLSIGN')
    STATION_DMR_ID = os.environ.get('STATION_DMR_ID')
    REPEATER_ID = os.environ.get('REPEATER_ID', '')
    DEFAULT_TALKGROUP = int(os.environ.get('DEFAULT_TALKGROUP', '91'))
    SERVER_PUBLIC_IP = os.environ.get('SERVER_PUBLIC_IP', '')
    if not STATION_CALLSIGN or not STATION_DMR_ID:
        raise RuntimeError('STATION_CALLSIGN and STATION_DMR_ID must be configured')

    AB_INFO_FILE = os.environ.get('AB_INFO_FILE', '/tmp/ABInfo_31001.json')
    DVSWITCH_SCRIPT = os.environ.get('DVSWITCH_SCRIPT', '/opt/MMDVM_Bridge/dvswitch.sh')
    MMDVM_LOG_DIR = os.environ.get('MMDVM_LOG_DIR', '/var/log/mmdvm')
    MMDVM_LOG_PATH = os.environ.get('MMDVM_LOG_PATH', '')
    DVSWITCH_LOG_PATH = os.environ.get('DVSWITCH_LOG_PATH', '/var/log/dvswitch/dvswitch.log')
    ANALOG_BRIDGE_LOG_PATH = os.environ.get('ANALOG_BRIDGE_LOG_PATH', '/var/log/dvswitch/Analog_Bridge.log')

    SYSTEMD_UNITS = {
        'apache': os.environ.get('APACHE_SERVICE', 'apache2'),
        'gunicorn': os.environ.get('GUNICORN_SERVICE', 'dmr-ncs'),
        'analogBridge': os.environ.get('ANALOG_BRIDGE_SERVICE', 'Analog_Bridge'),
        'mmdvmBridge': os.environ.get('MMDVM_BRIDGE_SERVICE', 'MMDVM_Bridge'),
        'dvswitch': os.environ.get('DVSWITCH_SERVICE', 'md380-emu'),
    }

    RADIOID_URL = os.environ.get('RADIOID_URL', 'https://radioid.net/api/dmr/user/')
    RADIOID_CACHE_HOURS = int(os.environ.get('RADIOID_CACHE_HOURS', '168'))
    RADIOID_MIN_INTERVAL_SECONDS = float(os.environ.get('RADIOID_MIN_INTERVAL_SECONDS', '1.2'))

    BRANDMEISTER_TALKGROUP_URL = os.environ.get('BRANDMEISTER_TALKGROUP_URL', 'https://api.brandmeister.network/v2/talkgroup/')
    BRANDMEISTER_LASTHEARD_URL = os.environ.get('BRANDMEISTER_LASTHEARD_URL', 'https://api.brandmeister.network/v2/lastheard/')
    BRANDMEISTER_MASTERS_URL = os.environ.get('BRANDMEISTER_MASTERS_URL', 'https://api.brandmeister.network/v2/master/')

    APRS_ENABLED = os.environ.get('APRS_ENABLED', 'true').lower() == 'true'
    APRS_IS_HOST = os.environ.get('APRS_IS_HOST', 'rotate.aprs2.net')
    APRS_IS_PORT = int(os.environ.get('APRS_IS_PORT', '14580'))
    APRS_IS_CALLSIGN = os.environ.get('APRS_IS_CALLSIGN', STATION_CALLSIGN)
    APRS_IS_PASSCODE = os.environ.get('APRS_IS_PASSCODE', '-1')
    APRS_IS_FILTER = os.environ.get('APRS_IS_FILTER', 't/poimqstunw')
    APRS_RETENTION_DAYS = int(os.environ.get('APRS_RETENTION_DAYS', '30'))
    APRS_MAX_ROWS = int(os.environ.get('APRS_MAX_ROWS', '5000'))

    TIMEZONE = os.environ.get('NCS_TIMEZONE', 'Asia/Kolkata')
    NET_AUTOMATIC_TG = int(os.environ.get('NET_AUTOMATIC_TG', '91'))
    NET_START_HOUR = int(os.environ.get('NET_START_HOUR', '21'))
    NET_START_MINUTE = int(os.environ.get('NET_START_MINUTE', '30'))
    NET_CLOSE_HOUR = int(os.environ.get('NET_CLOSE_HOUR', '3'))
    NET_CLOSE_MINUTE = int(os.environ.get('NET_CLOSE_MINUTE', '0'))

    EXPORT_DIR = os.environ.get('EXPORT_DIR', os.path.join(BASE_DIR, 'exports'))
    REPORT_DIR = os.environ.get('REPORT_DIR', os.path.join(BASE_DIR, 'reports'))
    BACKUP_DIR = os.environ.get('BACKUP_DIR', os.path.join(BASE_DIR, 'backups'))
    BACKUP_RETENTION_DAYS = int(os.environ.get('BACKUP_RETENTION_DAYS', '30'))

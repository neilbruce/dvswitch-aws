import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]

class ReleaseStaticTests(unittest.TestCase):
    def read(self, path):
        return (ROOT / path).read_text(encoding='utf-8')

    def test_no_json_persistence_backend(self):
        self.assertFalse((ROOT / 'database.ts').exists(), 'JSON persistence backend must not coexist with SQLAlchemy')
        legacy_name = 'db' + '_persistence' + '.json'
        self.assertNotIn(legacy_name, self.read('server.ts'))

    def test_no_known_demo_values(self):
        forbidden = ['vulcan' + '3efz', '15' + '.206' + '.12' + '.84', '404' + '0444']
        for path in ROOT.rglob('*'):
            if any(part in {'node_modules', 'dist', '.git'} for part in path.parts) or not path.is_file():
                continue
            if path.suffix.lower() not in {'.py', '.ts', '.tsx', '.sh', '.md', '.service', '.example', '.html', '.ini'}:
                continue
            text = path.read_text(encoding='utf-8', errors='ignore').lower()
            for value in forbidden:
                self.assertNotIn(value, text, f'{value} found in {path}')

    def test_service_privilege_separation_and_migrations(self):
        service = self.read('deploy/dvs-admin.service')
        self.assertIn('User=dmrncs', service)
        self.assertIn('ExecStartPre=', service)
        self.assertIn('alembic', service)

    def test_healthcheck_command_installed(self):
        install = self.read('deploy/install.sh')
        self.assertIn('/usr/local/bin/dmr-ncs', install)
        self.assertTrue((ROOT / 'deploy/dmr-ncs-healthcheck.py').exists())

    def test_no_shell_true(self):
        for path in ['deploy/app.py', 'server.ts']:
            self.assertNotRegex(self.read(path), re.compile(r'shell\s*=\s*True'))

if __name__ == '__main__':
    unittest.main()

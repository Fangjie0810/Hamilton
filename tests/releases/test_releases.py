import importlib.util
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('releases', Path(__file__).resolve().parents[2] / 'scripts/releases.py')
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)


class ReleasesTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / 'server'
        self.site = self.base / 'live'
        self.site.mkdir()
        (self.site / 'index.html').write_text('<html>baseline</html>')
        (self.site / 'assets').mkdir()
        (self.site / 'assets/game-abc.js').write_text('baseline')

    def register(self, v='0.1.0'):
        r.register(self.root, v, self.site, 'test')
        return self.root / 'releases' / v

    def test_baseline_is_independent_and_cannot_be_overwritten(self):
        release = self.register()
        (self.site / 'index.html').write_text('changed source')
        r.verify(release, '0.1.0')
        self.assertEqual(release.stat().st_mode & 0o777, 0o755)
        with self.assertRaises(ValueError):
            self.register()

    def test_activation_and_explicit_rollback(self):
        self.register()
        self.register('0.1.1')
        (self.root / 'current').symlink_to('releases/0.1.0/site')
        seen = []
        r.activate(self.root, '0.1.1', seen.append)
        self.assertEqual(os.readlink(self.root / 'current'), 'releases/0.1.1/site')
        r.activate(self.root, '0.1.0', seen.append, action='rollback')
        self.assertEqual(os.readlink(self.root / 'current'), 'releases/0.1.0/site')
        self.assertEqual(seen, ['0.1.1', '0.1.0'])

    def test_failed_health_check_restores_previous_version(self):
        self.register()
        self.register('0.1.1')
        (self.root / 'current').symlink_to('releases/0.1.0/site')
        def fail(_):
            raise RuntimeError('HTTP failed')
        with self.assertRaises(RuntimeError):
            r.activate(self.root, '0.1.1', fail)
        self.assertEqual(os.readlink(self.root / 'current'), 'releases/0.1.0/site')
        event = json.loads((self.root / 'history.jsonl').read_text().splitlines()[-1])
        self.assertEqual(event['action'], 'activation-failed')

    def test_tampered_release_cannot_be_activated(self):
        self.register()
        release = self.register('0.1.1')
        (self.root / 'current').symlink_to('releases/0.1.0/site')
        (release / 'site/index.html').write_text('tampered')
        with self.assertRaises(ValueError):
            r.activate(self.root, '0.1.1', lambda _: None)
        self.assertEqual(os.readlink(self.root / 'current'), 'releases/0.1.0/site')

    def test_install_verifies_archive_and_keeps_old_hashed_assets(self):
        release = self.register()
        archive = self.base / 'release.tar.gz'
        r.archive_tree(release, archive, ['release.json', 'site'])
        other = self.base / 'other-server'
        with self.assertRaises(ValueError):
            r.install(other, '0.1.0', archive, '0' * 64)
        r.install(other, '0.1.0', archive, r.digest(archive))
        r.verify(other / 'releases/0.1.0', '0.1.0')
        self.assertEqual((other / 'shared/assets/game-abc.js').read_text(), 'baseline')
        with self.assertRaises(ValueError):
            r.install(other, '0.1.0', archive, r.digest(archive))

    def test_archive_traversal_symlinks_and_duplicate_paths_are_rejected(self):
        for name, kind in [('../escape', tarfile.REGTYPE), ('/escape', tarfile.REGTYPE),
                           ('site/link', tarfile.SYMTYPE), ('site/link', tarfile.LNKTYPE)]:
            with self.subTest(name=name, kind=kind):
                archive = self.base / 'bad.tar.gz'
                with tarfile.open(archive, 'w:gz') as out:
                    info = tarfile.TarInfo(name)
                    info.type = kind
                    info.linkname = '/etc/passwd'
                    out.addfile(info, io.BytesIO())
                with self.assertRaises(ValueError):
                    r.safe_extract(archive, self.base / 'unpacked')
        with self.assertRaises(ValueError):
            r.version('../0.1.0')

    def test_hashed_asset_collision_does_not_overwrite_previous_asset(self):
        self.register()
        (self.site / 'assets/game-abc.js').write_text('different content, same name')
        with self.assertRaises(ValueError):
            self.register('0.1.1')
        self.assertEqual((self.root / 'shared/assets/game-abc.js').read_text(), 'baseline')


if __name__ == '__main__':
    unittest.main()

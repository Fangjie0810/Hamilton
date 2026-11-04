#!/usr/bin/env python3
"""Immutable Hamilton release archives and atomic server activation (Python 3.9+)."""
import argparse
import contextlib
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tarfile
import tempfile

PROJECT = Path(__file__).resolve().parents[1]
SERVER_ROOT = Path('/var/www/ham.newflorencia.com')
DOMAIN = 'ham.newflorencia.com'


def version(value):
    if not re.fullmatch(r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', value):
        raise ValueError('Use a version such as 0.1.1')
    return value


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def stamp(project=PROJECT):
    v = version(json.loads((project / 'package.json').read_text())['version'])
    write_json(project / 'public/version.json', {'schemaVersion': 1, 'version': v, 'channel': 'test'})
    return v


def inventory(site):
    result = {}
    for path in sorted(site.rglob('*')):
        if path.is_symlink():
            raise ValueError('Release files must not contain symbolic links')
        if path.is_file():
            result[path.relative_to(site).as_posix()] = digest(path)
    if not result.get('index.html'):
        raise ValueError('Missing index.html')
    return result


def manifest(folder, v, notes, origin):
    data = {'schemaVersion': 1, 'version': version(v), 'channel': 'test',
            'createdAt': now(), 'notes': notes, 'origin': origin,
            'files': inventory(folder / 'site')}
    write_json(folder / 'release.json', data)
    return data


def verify(folder, v):
    data = json.loads((folder / 'release.json').read_text())
    marker = json.loads((folder / 'site/version.json').read_text())
    if data['version'] != version(v) or marker['version'] != v:
        raise ValueError('Version does not match archive metadata')
    if inventory(folder / 'site') != data['files']:
        raise ValueError('Release checksum mismatch; refusing to activate modified files')
    return data


@contextlib.contextmanager
def locked(root):
    root.mkdir(parents=True, exist_ok=True)
    with (root / '.release.lock').open('a') as stream:
        fcntl.flock(stream, fcntl.LOCK_EX)
        yield


def audit(root, event):
    with (root / 'history.jsonl').open('a', encoding='utf-8') as stream:
        stream.write(json.dumps({'at': now(), **event}, ensure_ascii=False) + '\n')
        stream.flush()
        os.fsync(stream.fileno())


def sync_assets(root, site):
    """Keep hashed assets available for tabs opened before a version switch."""
    for source in sorted((site / 'assets').rglob('*')):
        if not source.is_file():
            continue
        target = root / 'shared/assets' / source.relative_to(site / 'assets')
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            if digest(target) != digest(source):
                raise ValueError('Hashed asset name collision: ' + target.name)
        else:
            shutil.copyfile(source, target)
            target.chmod(0o644)


def archive_tree(source, output, paths):
    with tarfile.open(output, 'w:gz') as archive:
        for name in paths:
            archive.add(source / name, arcname=name, filter=lambda info: None if
                        '.DS_Store' in info.name or '__pycache__' in info.name else info)


def pack(notes):
    v = version(json.loads((PROJECT / 'package.json').read_text())['version'])
    output = PROJECT / 'releases'
    with locked(output):
        destination = output / v
        if destination.exists():
            raise ValueError('Version already archived; increment package.json instead of overwriting')
        for command in [['npm', 'test'], ['npm', 'run', 'test:releases'], ['npm', 'run', 'build']]:
            subprocess.run(command, cwd=PROJECT, check=True)
        with tempfile.TemporaryDirectory(dir=output, prefix='.pack-') as temp:
            staging = Path(temp)
            payload = staging / 'payload'
            payload.mkdir()
            shutil.copytree(PROJECT / 'dist', payload / 'site')
            manifest(payload, v, notes, 'local-production-build')
            archive = staging / ('ham-' + v + '.tar.gz')
            archive_tree(payload, archive, ['release.json', 'site'])
            source = staging / ('ham-' + v + '-source.tar.gz')
            candidates = ['src', 'public', 'scripts', 'tests', 'docs', 'deployment',
                          'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
                          'tsconfig.json', 'vite.config.ts', 'index.html', 'README.md',
                          'AGENTS.md', 'CHANGELOG.md', '.gitignore']
            archive_tree(PROJECT, source, [p for p in candidates if (PROJECT / p).exists()])
            (staging / 'SHA256SUMS').write_text(
                f'{digest(archive)}  {archive.name}\n{digest(source)}  {source.name}\n')
            shutil.copy2(payload / 'release.json', staging / 'release.json')
            shutil.rmtree(payload)
            staging.rename(destination)
        print(destination)


def register(root, v, directory, notes):
    """Snapshot the existing live site once, adding only version metadata."""
    v = version(v)
    with locked(root):
        releases = root / 'releases'
        releases.mkdir(exist_ok=True)
        target = releases / v
        if target.exists():
            raise ValueError('Version already exists')
        inventory(directory)
        with tempfile.TemporaryDirectory(dir=releases, prefix='.register-') as temp:
            staging = Path(temp)
            shutil.copytree(directory, staging / 'site')
            write_json(staging / 'site/version.json', {'schemaVersion': 1, 'version': v, 'channel': 'test'})
            manifest(staging, v, notes, 'snapshot-of-existing-live-site')
            verify(staging, v)
            sync_assets(root, staging / 'site')
            for path in staging.rglob('*'):
                path.chmod(0o755 if path.is_dir() else 0o644)
            staging.chmod(0o755)
            staging.rename(target)
        audit(root, {'action': 'register', 'version': v})


def safe_extract(archive, destination):
    with tarfile.open(archive, 'r:gz') as source:
        members = source.getmembers()
        names = set()
        total = 0
        for member in members:
            path = PurePosixPath(member.name)
            if (path.is_absolute() or '..' in path.parts or member.name in names
                    or not (member.isfile() or member.isdir())
                    or not (path.parts and path.parts[0] in ('site', 'release.json'))
                    or (path.parts[0] == 'release.json' and (len(path.parts) != 1 or not member.isfile()))):
                raise ValueError('Unsafe or unexpected archive entry: ' + member.name)
            names.add(member.name)
            total += member.size
        if total > 4 * 1024 ** 3:
            raise ValueError('Uncompressed archive exceeds 4 GiB')
        for member in members:
            target = destination / member.name
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with source.extractfile(member) as inp, target.open('xb') as out:
                    shutil.copyfileobj(inp, out)
                target.chmod(0o644)


def install(root, v, archive, expected):
    v = version(v)
    if not re.fullmatch('[a-f0-9]{64}', expected) or digest(archive) != expected:
        raise ValueError('Uploaded archive checksum mismatch')
    with locked(root):
        releases = root / 'releases'
        releases.mkdir(exist_ok=True)
        target = releases / v
        if target.exists():
            raise ValueError('Version already exists; releases cannot be overwritten')
        with tempfile.TemporaryDirectory(dir=releases, prefix='.install-') as temp:
            staging = Path(temp)
            safe_extract(archive, staging)
            verify(staging, v)
            sync_assets(root, staging / 'site')
            for path in staging.rglob('*'):
                if path.is_dir():
                    path.chmod(0o755)
            staging.chmod(0o755)
            staging.rename(target)
        audit(root, {'action': 'install', 'version': v, 'archiveSHA256': expected})


def switch(root, target):
    with tempfile.TemporaryDirectory(dir=root, prefix='.switch-') as temp:
        link = Path(temp) / 'current'
        link.symlink_to(target)
        os.replace(link, root / 'current')


def check_live(v):
    args = ['curl', '--noproxy', '*', '--fail', '--silent', '--show-error',
            '--max-time', '20', '--resolve', DOMAIN + ':443:127.0.0.1']
    marker = json.loads(subprocess.check_output(args + ['https://' + DOMAIN + '/version.json']))
    if marker['version'] != v:
        raise ValueError('Live version does not match the selected release')
    subprocess.run(args + ['--output', '/dev/null', 'https://' + DOMAIN + '/'], check=True)


def activate(root, v, check=check_live, action='activate'):
    v = version(v)
    with locked(root):
        target = root / 'releases' / v
        verify(target, v)
        current = root / 'current'
        if not current.is_symlink():
            raise ValueError('Initial Nginx migration must be completed before activation')
        old = os.readlink(current)
        new = 'releases/' + v + '/site'
        switch(root, new)
        try:
            check(v)
        except Exception:
            switch(root, old)
            audit(root, {'action': 'activation-failed', 'version': v, 'restored': old})
            raise
        audit(root, {'action': action, 'version': v, 'previous': old})


def status(root):
    active = os.readlink(root / 'current') if (root / 'current').is_symlink() else None
    releases = []
    for path in sorted((root / 'releases').glob('*/release.json')):
        if path.parent.name.startswith('.'):
            continue
        data = json.loads(path.read_text())
        releases.append({k: data[k] for k in ['version', 'createdAt', 'notes']})
    print(json.dumps({'current': active, 'releases': releases}, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=SERVER_ROOT)
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('stamp')
    p = commands.add_parser('pack')
    p.add_argument('--notes', required=True)
    p = commands.add_parser('register')
    p.add_argument('version', type=version)
    p.add_argument('--directory', type=Path, required=True)
    p.add_argument('--notes', required=True)
    p = commands.add_parser('install')
    p.add_argument('version', type=version)
    p.add_argument('archive', type=Path)
    p.add_argument('--sha256', required=True)
    for command in ['activate', 'rollback']:
        p = commands.add_parser(command)
        p.add_argument('version', type=version)
    commands.add_parser('status')
    args = parser.parse_args()
    if args.command == 'stamp':
        print(stamp())
    elif args.command == 'pack':
        pack(args.notes)
    elif args.command == 'register':
        register(args.root, args.version, args.directory, args.notes)
    elif args.command == 'install':
        install(args.root, args.version, args.archive, args.sha256)
    elif args.command in ('activate', 'rollback'):
        activate(args.root, args.version, action=args.command)
    else:
        status(args.root)


if __name__ == '__main__':
    main()

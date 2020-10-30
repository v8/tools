#!/usr/bin/env python3

import subprocess
import tempfile
import os
import sys
from pathlib import Path


DESTINATION = Path(__file__).parent
ALLOWLIST = DESTINATION  / 'ALLOWLIST.txt'
TOOLS_GIT = DESTINATION
V8_GIT = DESTINATION  / '.v8'
GEN_DIR = DESTINATION / 'gen'


def run(*command, capture=False, cwd=None):
    command = list(map(str, command))
    print(f'CMD:  {" ".join(command)}')
    stdout = subprocess.PIPE if capture else None 
    result = subprocess.run(command, stdout=stdout, cwd=cwd)
    result.check_returncode()
    if capture:
        return result.stdout.decode('utf-8')
    return None

def git(*command, capture=False, repository=V8_GIT):
    return run('git', '-C', repository, *command, capture=capture)

class Step:
    def __init__(self, title):
        self.title = title

    def __enter__(self):
        print('=' * 80)
        print("::group::" + self.title)
        print('-' * 80)

    def __exit__(self, type, value, tb):
        print("::endgroup::")


with Step(f'Update V8 checkout in: {V8_GIT}'):
    if not V8_GIT.exists():
        run('git', 'clone', '--depth=1', 'https://github.com/v8/v8.git', V8_GIT)
    # List all remote branches even for a shallow copy
    git('remote', 'set-branches', 'origin', '*')
    git('fetch', '--all', '--no-tags', '--depth=1')


with Step('List branches'):
    if len(sys.argv) == 1:
      NAMES = ['refs/remotes/origin/*-lkgr', 'refs/remotes/origin/lkgr']
    else:
      NAMES = [
        'refs/remotes/origin/lkgr' if name == "head" else f'refs/remotes/origin/{name}-lkgr'
        for name in sys.argv[1:]
      ]
    
    BRANCHES = git('for-each-ref', *NAMES, '--format=%(refname:strip=3) %(objectname)', capture=True).rstrip().split("\n")
    BRANCHES = [ref.split(' ') for ref in BRANCHES]
    BRANCHES = [(branch.split('-')[0], sha) for branch,sha in BRANCHES]
    
    # Sort branches from old to new:
    def branch_sort_key(branch_and_sha): 
      if branch_and_sha[0] == 'lkgr':
        return (float("inf"),)
      return tuple(map(int, branch_and_sha[0].split('.')))
    
    BRANCHES.sort(key=branch_sort_key)
    print(BRANCHES)
    
    GEN_DIR.mkdir(exist_ok=True)

for branch, sha in BRANCHES:
    with Step(f'Generating Branch: {branch}'):
        if branch == 'lkgr':
            version_name = 'head'
        else:
            branch_name = branch.split('-')[0]
            version_name = f'v{branch_name}'
        branch_dir = GEN_DIR / version_name 
        branch_dir.mkdir(exist_ok=True)

        stamp = branch_dir / '.sha'

        def needs_update():
            if not stamp.exists():
                Step(f'Needs update: no stamp file')
                return True
            stamp_mtime = stamp.stat().st_mtime
            if stamp_mtime <= GEN_DIR.stat().st_mtime:
                Step(f'Needs update: stamp file older than Doxyfile')
                return True
            if stamp_mtime <= Path(__file__).stat().st_mtime:
                Step(f'Needs update: stamp file older than update script')
                return True
            stamp_sha = stamp.read_text()
            if stamp_sha != sha:
                Step(f'Needs update: stamp SHA does not match branch SHA ({stamp_sha} vs. {sha})')
                return True
            return False

        if not needs_update():
            Step(f'Docs already up-to-date.')
            continue
        stamp.write_text(sha)

        git('switch', '--force', '--detach', sha)
        git('clean', '--force', '-d')
        source = V8_GIT / 'tools'
        run('rsync', '--itemize-changes', f'--include-from={ALLOWLIST}',
                '--exclude=*', '--recursive', 
                '--checksum', f'{source}{os.sep}', f'{branch_dir}{os.sep}')
        turbolizer_dir = branch_dir / 'turbolizer'
        if (turbolizer_dir / 'package.json').exists():
            with Step(f'Building turbolizer: {turbolizer_dir}'):
                run('rm', '-rf', turbolizer_dir / 'build')
                try:
                    run('npm', 'i', cwd=turbolizer_dir)
                    run('npm', 'run-script', 'build', cwd=turbolizer_dir)
                except Exception as e:
                    print(f'Error occured: {e}')


with Step("Update versions.txt"):
    versions_file = GEN_DIR / 'versions.txt'
    with open(versions_file, mode='w') as f:
        versions = list(GEN_DIR.glob('v*'))
        versions.sort()
        # write all but the last filename (=versions.txt)
        for version_dir in versions[:-1]:
            f.write(version_dir.name)
            f.write('\n')

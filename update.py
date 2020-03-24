#!/usr/bin/env python3


import subprocess
import tempfile
import os
from pathlib import Path

def run(*command, capture=False):
    command = list(map(str, command))
    print(f'CMD:  {" ".join(command)}')
    stdout = subprocess.PIPE if capture else None 
    result = subprocess.run(command, stdout=stdout)
    result.check_returncode()
    if capture:
        return result.stdout.decode('utf-8')
    return None

def git(*command, capture=False):
    return run('git', '-C', GIT_DIR, *command, capture=capture)

def step(title):
    print('-' * 80)
    print(title)
    print('-' * 80)


DESTINATION = Path(__file__).parent
WHITELIST = DESTINATION  / 'WHITELIST.txt'
GIT_DIR = DESTINATION  / '.v8'


step(f'Update V8 checkout in: {GIT_DIR}')
if not GIT_DIR.exists():
    run('git', 'clone', 'https://chromium.googlesource.com/v8/v8.git', GIT_DIR)
git('fetch', '--all')


step('List branches')
BRANCHES = git('branch', '--all', '--list', '*lkgr', '--format=%(refname)', capture=True).split()
BRANCHES = list(map(lambda ref: ref.split('/')[-1], BRANCHES))
print(BRANCHES)



for branch in BRANCHES:
    step(f'Importing web tools from branch: {branch}')
    if branch == 'lkgr':
        branch_name = 'head'
        version_name = 'head'
    else:
        branch_name = branch.split('-')[0]
        version_name = f'v{branch_name}'
    branch_dir = DESTINATION / version_name
    branch_dir.mkdir(exist_ok=True)
    git('switch', '--force', '--detach', f'remotes/origin/{branch}')
    source = GIT_DIR / 'tools'
    run('rsync', '--itemize-changes', f'--include-from={WHITELIST}',
            '--exclude=*', '--recursive', 
            '--checksum', f'{source}{os.sep}', f'{branch_dir}{os.sep}')
    turbolizer_dir = branch_dir / 'turbolizer'
    if turbolizer_dir.exists and !(turbolizer_dir / 'build').exist
        print(f'{turbolizer_dir / "build"} does not exist, check the README for building!')

   


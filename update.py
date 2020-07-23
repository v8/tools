#!/usr/bin/env python3


import subprocess
import tempfile
import os
from pathlib import Path


DESTINATION = Path(__file__).parent
ALLOWLIST = DESTINATION  / 'ALLOWLIST.txt'
TOOLS_GIT = DESTINATION
V8_GIT = DESTINATION  / '.v8'


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

def step(title):
    print('=' * 80)
    print(title)
    print('-' * 80)


step(f'Update V8 checkout in: {V8_GIT}')
if not V8_GIT.exists():
    run('git', 'clone', 'https://chromium.googlesource.com/v8/v8.git', V8_GIT)
git('fetch', '--all')


step('List branches')
BRANCHES = git('branch', '--all', '--list', '*-lkgr', '--format=%(refname)', capture=True).split()
BRANCHES = list(set(map(lambda ref: ref.split('/')[-1], BRANCHES)))

# Sort branches from old to new:
BRANCHES.sort(key=lambda branch: list(map(int, branch.split('-')[0].split('.'))))
BRANCHES.append('lkgr')

# List of branches that have potential back-merges and thus need updates:
BRANCHES_FORCE_BUILDS = set(BRANCHES[-4:])
print(BRANCHES)



for branch in BRANCHES:
    step(f'Importing web tools from branch: {branch}')
    if branch == 'lkgr':
        version_name = 'head'
    else:
        branch_name = branch.split('-')[0]
        version_name = f'v{branch_name}'
    branch_dir = DESTINATION / version_name 
    branch_dir.mkdir(exist_ok=True)
    git('switch', '--force', '--detach', f'remotes/origin/{branch}')
    git('clean', '--force', '-d')
    source = V8_GIT / 'tools'
    run('rsync', '--itemize-changes', f'--include-from={ALLOWLIST}',
            '--exclude=*', '--recursive', 
            '--checksum', f'{source}{os.sep}', f'{branch_dir}{os.sep}')
    turbolizer_dir = branch_dir / 'turbolizer'
    if (turbolizer_dir / 'package.json').exists():
        force_build = branch in BRANCHES_FORCE_BUILDS
        if force_build or not (turbolizer_dir / 'build').exists():
            step(f'Building turbolizer: {turbolizer_dir}')
            run('rm', '-rf', turbolizer_dir / 'build')
            try:
                run('npm', 'i', cwd=turbolizer_dir)
                run('npm', 'run-script', 'build', cwd=turbolizer_dir)
            except Exception as e:
                print(f'Error occured: {e}')
    git('add', branch_dir, repository=TOOLS_GIT)


step("Update versions.txt")
versions_file = DESTINATION / 'versions.txt'
with open(versions_file, mode='w') as f:
    versions = list(DESTINATION.glob('v*'))
    versions.sort()
    # write all but the last filename (=versions.txt)
    for version_dir in versions[:-1]:
        f.write(version_dir.name)
        f.write('\n')

git('add', versions_file, repository=TOOLS_GIT)



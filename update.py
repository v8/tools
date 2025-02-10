#!/usr/bin/env python3

import subprocess
import os
from pathlib import Path

# =============================================================================

DESTINATION = Path(__file__).parent
ALLOWLIST = DESTINATION / 'ALLOWLIST.txt'
TOOLS_GIT = DESTINATION
V8_GIT = DESTINATION / '.v8'
OUT_DIR = DESTINATION / 'gen'
OUT_DIR.mkdir(exist_ok=True)
# V8 8.6 is the first version with tools
OLDEST_VERSION=(8, 6)

# =============================================================================


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


# =============================================================================

with Step(f'Getting V8 checkout in: {V8_GIT}'):
  if not V8_GIT.exists():
    run('git', 'clone', '--depth=1', 'https://chromium.googlesource.com/v8/v8',
        V8_GIT)


def map_branch_name(branch):
  version = branch.split('-')[0]
  if version == 'lkgr' or version == 'main':
    return 'head'
  return f"v{version}"


def filter_branch_name(name):
  return name.endswith("-lkgr") or name == 'main'


with Step('List Branches'):
  # Find the refs and SHA of all remote branches.
  BRANCHES = git('ls-remote', '--heads', 'origin',
                 capture=True).rstrip().split("\n")
  BRANCHES = [ref.split("\t") for ref in BRANCHES]
  BRANCHES = [(branch.split('/')[-1], sha) for sha, branch in BRANCHES]
  # Only keep release branches
  BRANCHES = filter(lambda each: filter_branch_name(each[0]), BRANCHES)
  BRANCHES = [(map_branch_name(branch), branch, sha)
              for branch, sha in BRANCHES]

  # Sort branches from old to new:
  def branch_sort_key(version_branch_sha):
    if version_branch_sha[0] == 'head':
      return (float("inf"), )
    return tuple(map(int, version_branch_sha[0][1:].split('.')))

  BRANCHES.sort(key=branch_sort_key)
  print(BRANCHES)


def filter_by_stamp(values):
  version, branch, sha = values
  stamp = OUT_DIR / version / '.sha'
  if not stamp.exists():
    print(f'{version} needs update: no stamp file {stamp}')
    return True
  stamp_mtime = stamp.stat().st_mtime
  if stamp_mtime <= Path(__file__).stat().st_mtime:
    print(f'{version} needs update: stamp file older than update script')
    return True
  stamp_sha = stamp.read_text()
  if stamp_sha != sha:
    print(
        f'{version} needs update: stamp SHA does not match branch SHA ({stamp_sha} vs. {sha})'
    )
    return True
  return False


with Step("Fetch Filtered Branches"):
  # Fetch only the required branches
  BRANCHES = list(filter(filter_by_stamp, BRANCHES))
  # Only update the last 3 branches
  BRANCHES = BRANCHES[-3:]
  print(f"BRANCHES {BRANCHES}")
  git("fetch", "--depth=1", "origin",
      *(branch for version, branch, sha in BRANCHES))

for version, branch, sha in BRANCHES:
  with Step(f'Generating Branch: {branch}'):
    branch_dir = OUT_DIR / version
    branch_dir.mkdir(exist_ok=True)

    stamp = branch_dir / '.sha'
    stamp.write_text(sha)

    git('switch', '--force', '--detach', sha)
    git('clean', '--force', '-d')
    source = V8_GIT / 'tools'
    run('rsync', '--itemize-changes', f'--include-from={ALLOWLIST}',
        '--exclude=*', '--recursive', '--checksum', f'{source}{os.sep}',
        f'{branch_dir}{os.sep}')
    turbolizer_dir = branch_dir / 'turbolizer'
    if (turbolizer_dir / 'package.json').exists():
      with Step(f'Building turbolizer: {turbolizer_dir}'):
        run('rm', '-rf', turbolizer_dir / 'build')
        try:
          run('npm', 'install', cwd=turbolizer_dir)
          run('npm', 'run-script', 'build', cwd=turbolizer_dir)
          # We don't need to deploy the cached node_modules folder
          run('rm', '-rf', turbolizer_dir / "node_modules")
        except Exception as e:
          print(f'Error occured: {e}')

INDEX_HTML = OUT_DIR / "index.html"
with Step("Update versions.txt"):
  versions_file = OUT_DIR / 'versions.txt'
  with open(versions_file, mode='w') as f:
    versions = OUT_DIR.glob('v*')
    versions = list(filter(lambda file: file.name != 'versions.txt', versions))
    versions.sort(
      key=lambda file: list(map(int, file.name[1:].split('.')))
    )
    for version_dir in versions:
      f.write(version_dir.name)
      f.write('\n')
  run("cp", DESTINATION / "index.html.template",INDEX_HTML )


GTAG = """
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-EQNXD43G9N"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-EQNXD43G9N');
</script>
"""
PLACEHOLDER = "<!-- ANALYTICS_PLACEHOLDER -->"

def inject_analytics(html_file):
  with html_file.open() as f:
    contents = f.read()
  contents = contents.replace(PLACEHOLDER, GTAG)
  with html_file.open('w+') as f:
    f.write(contents)

with Step("Inject Analytics"):
  inject_analytics(INDEX_HTML)
  for version, branch, sha in BRANCHES:
    for html_file in OUT_DIR.glob("**/*.html"):
      inject_analytics(html_file)

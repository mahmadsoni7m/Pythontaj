#!/usr/bin/env python3
"""Copies the web app into a destination folder and fills in build-time configuration.

  python scripts/sync_assets.py --dest android/app/src/main/assets/www \
      --remote-base https://USER.github.io/PythonTaj/ --repo USER/PythonTaj --version 1.0.0
"""
import argparse
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITEMS = ["index.html", "css", "js", "assets", "data", "lessons"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dest", required=True)
    ap.add_argument("--remote-base", default="")
    ap.add_argument("--repo", default="")
    ap.add_argument("--version", default="")
    a = ap.parse_args()

    if a.repo and not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", a.repo):
        sys.exit("invalid --repo")
    if a.remote_base and not a.remote_base.startswith("https://"):
        sys.exit("--remote-base must be https://")
    if a.version and not re.fullmatch(r"\d+(\.\d+){1,3}[A-Za-z0-9.-]*", a.version):
        sys.exit("invalid --version")

    dest = os.path.abspath(a.dest)
    if os.path.exists(dest):
        shutil.rmtree(dest)
    os.makedirs(dest)
    for item in ITEMS:
        src = os.path.join(ROOT, item)
        dst = os.path.join(dest, item)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)

    cfg = os.path.join(dest, "js", "config.js")
    with open(cfg, encoding="utf-8") as f:
        text = f.read()
    if a.remote_base:
        base = a.remote_base if a.remote_base.endswith("/") else a.remote_base + "/"
        text = text.replace("__REMOTE_BASE__", base)
    if a.repo:
        text = text.replace("__GITHUB_REPO__", a.repo)
    if a.version:
        text = re.sub(r"APP_VERSION: '[^']*'", "APP_VERSION: '%s'" % a.version, text)
    with open(cfg, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    print("assets copied to", dest)


if __name__ == "__main__":
    main()

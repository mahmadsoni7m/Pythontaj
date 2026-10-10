#!/usr/bin/env python3
"""Rebuilds data/manifest.json from lessons/*.json (sizes, SHA-256, versions, dates)."""
import datetime
import hashlib
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools", "content"))
from lib import MODULES  # noqa: E402

MANIFEST = os.path.join(ROOT, "data", "manifest.json")


def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def main():
    old = {}
    if os.path.exists(MANIFEST):
        with open(MANIFEST, encoding="utf-8") as f:
            old = {e["id"]: e for e in json.load(f).get("lessons", [])}
    lessons_dir = os.path.join(ROOT, "lessons")
    entries = []
    for name in sorted(os.listdir(lessons_dir)):
        if not (name.startswith("lesson-") and name.endswith(".json")):
            continue
        path = os.path.join(lessons_dir, name)
        with open(path, "rb") as f:
            raw = f.read()
        data = json.loads(raw.decode("utf-8"))
        sha = hashlib.sha256(raw).hexdigest()
        prev = old.get(data["id"])
        t = now()
        published = prev["publishedAt"] if prev else t
        updated = prev["updatedAt"] if prev and prev["sha256"] == sha else t
        entries.append({
            "id": data["id"], "number": data["number"], "module": data["module"],
            "title": data["title"], "description": data["description"],
            "version": data["version"], "points": data["points"],
            "path": "lessons/" + name, "size": len(raw), "sha256": sha,
            "publishedAt": published, "updatedAt": updated,
        })
    entries.sort(key=lambda e: e["number"])
    manifest = {
        "contentSchema": 1,
        "minAppContent": 1,
        "curriculumVersion": "1.0.%d" % sum(e["version"] - 1 for e in entries),
        "generatedAt": now(),
        "modules": [{"id": m, "title": t, "order": i + 1, "from": a, "to": b}
                    for i, (m, t, a, b) in enumerate(MODULES)],
        "lessons": entries,
    }
    # keep file stable when nothing but the timestamp changed
    if old and os.path.exists(MANIFEST):
        with open(MANIFEST, encoding="utf-8") as f:
            prev_m = json.load(f)
        a = dict(prev_m); b = dict(manifest)
        a.pop("generatedAt", None); b.pop("generatedAt", None)
        if a == b:
            print("manifest unchanged")
            return
    with open(MANIFEST, "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("manifest written:", len(entries), "lessons")


if __name__ == "__main__":
    main()

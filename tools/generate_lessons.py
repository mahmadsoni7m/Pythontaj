#!/usr/bin/env python3
"""Builds lessons/lesson-NNN.json from tools/content/m*.py.

Every code example and every exercise solution is REALLY executed with
python/runner.py; expected outputs are taken from those runs. The generator fails
if an example or solution raises an error.
"""
import importlib
import json
import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools", "content"))
sys.path.insert(0, os.path.join(ROOT, "python"))
import runner  # noqa: E402


def run(code, stdin):
    ws = tempfile.mkdtemp(prefix="gen_")
    res = json.loads(runner.run("gen", code, stdin, ws, 10))
    if not res["ok"]:
        raise SystemExit("FAILED code:\n%s\n%s" % (code, json.dumps(res, ensure_ascii=False)))
    return res["stdout"]


def main():
    lessons = []
    for name in ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"]:
        lessons += importlib.import_module(name).LESSONS
    lessons.sort(key=lambda l: l["number"])
    assert [l["number"] for l in lessons] == list(range(1, len(lessons) + 1))
    out_dir = os.path.join(ROOT, "lessons")
    os.makedirs(out_dir, exist_ok=True)
    for l in lessons:
        for ex in l["examples"]:
            ex["output"] = run(ex["code"], ex["stdin"])
        for t in l["exercise"]["tests"]:
            t["expected"] = run(l["exercise"]["solution"], t["stdin"])
        path = os.path.join(out_dir, l["id"] + ".json")
        old = None
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                old = json.load(f)
        if old:  # keep version stable when nothing changed
            cand = dict(l, version=old["version"])
            if cand == old:
                continue
            l["version"] = old["version"] + 1
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(l, f, ensure_ascii=False, indent=2)
            f.write("\n")
    print("generated", len(lessons), "lessons")


if __name__ == "__main__":
    main()

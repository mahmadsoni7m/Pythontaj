#!/usr/bin/env python3
"""Validates data/manifest.json and every lesson file. Exit code 1 on any problem."""
import hashlib
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
errors = []


def err(msg):
    errors.append(msg)


def need(obj, key, typ, where):
    if key not in obj or not isinstance(obj[key], typ) or isinstance(obj[key], bool) and typ is int:
        err("%s: поле '%s' нест ё навъаш нодуруст" % (where, key))
        return False
    return True


def check_lesson(d, where):
    for k, t in [("schema", int), ("id", str), ("number", int), ("module", str), ("title", str),
                 ("description", str), ("version", int), ("points", int), ("objectives", list),
                 ("explanation", list), ("examples", list), ("notes", list), ("mistakes", list),
                 ("exercise", dict), ("quiz", list)]:
        need(d, k, t, where)
    if err_count_before(where):
        return
    if not re.fullmatch(r"lesson-\d{3,}", d["id"]):
        err("%s: id нодуруст" % where)
    if d["version"] < 1:
        err("%s: version бояд >= 1 бошад" % where)
    if not d["explanation"] or not all(isinstance(x, str) and x.strip() for x in d["explanation"]):
        err("%s: explanation холӣ ё нодуруст" % where)
    if not d["examples"]:
        err("%s: камаш як мисол лозим аст" % where)
    for i, ex in enumerate(d["examples"]):
        for k in ("title", "code", "output"):
            if not isinstance(ex.get(k), str):
                err("%s: examples[%d].%s" % (where, i, k))
        if not isinstance(ex.get("steps"), list):
            err("%s: examples[%d].steps" % (where, i))
    e = d["exercise"]
    for k in ("prompt", "starter", "solution", "hint"):
        if not isinstance(e.get(k), str):
            err("%s: exercise.%s" % (where, k))
    if not isinstance(e.get("tests"), list) or not e["tests"]:
        err("%s: exercise.tests холӣ аст" % where)
    else:
        for i, t in enumerate(e["tests"]):
            if not isinstance(t.get("stdin"), str) or not isinstance(t.get("expected"), str):
                err("%s: exercise.tests[%d]" % (where, i))
    if not isinstance(e.get("mustContain"), list):
        err("%s: exercise.mustContain" % where)
    if len(d["quiz"]) < 3:
        err("%s: викторина камаш 3 савол дорад" % where)
    for i, q in enumerate(d["quiz"]):
        opts = q.get("options")
        if not isinstance(q.get("q"), str) or not isinstance(opts, list) or not 2 <= len(opts) <= 4:
            err("%s: quiz[%d] сохтор" % (where, i))
            continue
        if not isinstance(q.get("answer"), int) or not 0 <= q["answer"] < len(opts):
            err("%s: quiz[%d].answer берун аз ҳудуд" % (where, i))
        if not isinstance(q.get("explanation"), str) or not q["explanation"]:
            err("%s: quiz[%d].explanation" % (where, i))
    # no executable payload allowed in lessons
    raw = json.dumps(d, ensure_ascii=False)
    if re.search(r"<script|javascript:", raw, re.I):
        err("%s: дарс бояд скрипт надошта бошад" % where)


_marks = {}


def err_count_before(where):
    return any(e.startswith(where + ":") for e in errors)


def main():
    mpath = os.path.join(ROOT, "data", "manifest.json")
    with open(mpath, encoding="utf-8") as f:
        m = json.load(f)
    for k, t in [("contentSchema", int), ("minAppContent", int), ("curriculumVersion", str),
                 ("modules", list), ("lessons", list)]:
        need(m, k, t, "manifest")
    ids = set()
    for e in m["lessons"]:
        w = e.get("id", "?")
        for k, t in [("id", str), ("number", int), ("module", str), ("title", str), ("version", int),
                     ("path", str), ("size", int), ("sha256", str), ("publishedAt", str), ("updatedAt", str)]:
            need(e, k, t, "manifest." + w)
        if w in ids:
            err("id такрор шудааст: " + w)
        ids.add(w)
        path = os.path.join(ROOT, e["path"])
        if not e["path"].startswith("lessons/") or ".." in e["path"]:
            err("%s: роҳи нодуруст" % w)
            continue
        if not os.path.exists(path):
            err("%s: файл нест (%s)" % (w, e["path"]))
            continue
        raw = open(path, "rb").read()
        if hashlib.sha256(raw).hexdigest() != e["sha256"]:
            err("%s: sha256 мувофиқ нест — scripts/build_manifest.py-ро иҷро кунед" % w)
        if len(raw) != e["size"]:
            err("%s: size мувофиқ нест" % w)
        d = json.loads(raw.decode("utf-8"))
        check_lesson(d, w)
        if d.get("id") != e["id"] or d.get("version") != e["version"]:
            err("%s: id/version бо манифест мувофиқ нест" % w)
    on_disk = {n[:-5] for n in os.listdir(os.path.join(ROOT, "lessons")) if n.endswith(".json")}
    for missing in on_disk - ids:
        err("файл дар манифест нест: " + missing)
    for e in errors:
        print("ХАТО:", e)
    print("Санҷиш: %d дарс, %d хато" % (len(m["lessons"]), len(errors)))
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()

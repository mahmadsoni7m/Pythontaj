import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "python"))
import runner  # noqa: E402

LESSONS = []
for name in sorted(os.listdir(os.path.join(ROOT, "lessons"))):
    if name.endswith(".json"):
        with open(os.path.join(ROOT, "lessons", name), encoding="utf-8") as f:
            LESSONS.append(json.load(f))


def run(code, stdin=""):
    return json.loads(runner.run("t", code, stdin, tempfile.mkdtemp(), 5))


def norm(s):
    return "\n".join(l.rstrip() for l in s.replace("\r\n", "\n").split("\n")).rstrip()


class LessonTests(unittest.TestCase):
    def test_count_and_numbering(self):
        self.assertGreaterEqual(len(LESSONS), 42)
        self.assertEqual([l["number"] for l in LESSONS], list(range(1, len(LESSONS) + 1)))
        self.assertEqual(len({l["id"] for l in LESSONS}), len(LESSONS))

    def test_every_module_has_lessons(self):
        mods = {l["module"] for l in LESSONS}
        self.assertEqual(mods, {"m%d" % i for i in range(1, 9)})

    def test_examples_output_matches_real_execution(self):
        for l in LESSONS:
            for ex in l["examples"]:
                r = run(ex["code"], ex["stdin"])
                self.assertTrue(r["ok"], (l["id"], r["error"]))
                self.assertEqual(r["stdout"], ex["output"], l["id"])

    def test_solutions_pass_all_tests_and_contain_required_words(self):
        for l in LESSONS:
            e = l["exercise"]
            for t in e["tests"]:
                r = run(e["solution"], t["stdin"])
                self.assertTrue(r["ok"], (l["id"], r["error"]))
                self.assertEqual(norm(r["stdout"]), norm(t["expected"]), l["id"])
            for m in e["mustContain"]:
                self.assertIn(m, e["solution"], l["id"])

    def test_starter_code_does_not_already_solve_the_exercise(self):
        for l in LESSONS:
            e = l["exercise"]
            passed = all(
                (lambda r: r["ok"] and norm(r["stdout"]) == norm(t["expected"]))(run(e["starter"], t["stdin"]))
                for t in e["tests"]
            )
            self.assertFalse(passed, l["id"])

    def test_quiz_quality(self):
        for l in LESSONS:
            self.assertGreaterEqual(len(l["quiz"]), 3, l["id"])
            for q in l["quiz"]:
                self.assertTrue(0 <= q["answer"] < len(q["options"]), l["id"])
                self.assertEqual(len(set(q["options"])), len(q["options"]), (l["id"], q["q"]))

    def test_text_is_tajik_cyrillic(self):
        for l in LESSONS:
            for p in l["explanation"]:
                self.assertTrue(re.search(r"[\u0400-\u04FF]", p), l["id"])

    def test_sections_are_filled(self):
        for l in LESSONS:
            for key in ("objectives", "explanation", "notes", "mistakes"):
                self.assertTrue(l[key] and all(x.strip() for x in l[key]), (l["id"], key))
            self.assertTrue(l["exercise"]["hint"].strip(), l["id"])

    def test_manifest_matches_files(self):
        with open(os.path.join(ROOT, "data", "manifest.json"), encoding="utf-8") as f:
            m = json.load(f)
        self.assertEqual(len(m["lessons"]), len(LESSONS))
        for e in m["lessons"]:
            raw = open(os.path.join(ROOT, e["path"]), "rb").read()
            self.assertEqual(hashlib.sha256(raw).hexdigest(), e["sha256"], e["id"])
            self.assertEqual(len(raw), e["size"])

    def test_validator_script_passes(self):
        r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "validate_content.py")], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)


if __name__ == "__main__":
    unittest.main()

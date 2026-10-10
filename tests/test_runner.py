import json
import os
import sys
import tempfile
import threading
import time
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "python"))
import runner  # noqa: E402


def run(code, stdin="", timeout=5, ws=None):
    return json.loads(runner.run("t", code, stdin, ws or tempfile.mkdtemp(), timeout))


class RunnerTests(unittest.TestCase):
    def test_print(self):
        r = run('print("Салом", 1 + 2)')
        self.assertTrue(r["ok"])
        self.assertEqual(r["stdout"], "Салом 3\n")

    def test_input_is_fed_and_echoed(self):
        r = run("n = input('Ном: ')\nprint('Салом,', n)", "Алӣ\n")
        self.assertEqual(r["stdout"], "Ном: Алӣ\nСалом, Алӣ\n")

    def test_input_without_data_gives_eof_error(self):
        r = run("input()")
        self.assertFalse(r["ok"])
        self.assertEqual(r["error"]["type"], "EOFError")

    def test_runtime_error_has_line_and_type(self):
        r = run("x = 1\nprint(x)\nprint(1 / 0)")
        self.assertFalse(r["ok"])
        self.assertEqual(r["error"]["type"], "ZeroDivisionError")
        self.assertEqual(r["error"]["line"], 3)
        self.assertEqual(r["stdout"], "1\n")
        self.assertIn("print(1 / 0)", r["error"]["traceback"])

    def test_syntax_and_indentation_errors(self):
        r = run("print('a'")
        self.assertEqual(r["error"]["type"], "SyntaxError")
        r = run("if True:\nprint(1)")
        self.assertEqual(r["error"]["type"], "IndentationError")

    def test_infinite_loop_times_out(self):
        t = time.time()
        r = run("while True:\n    pass", timeout=1)
        self.assertTrue(r["timedOut"])
        self.assertFalse(r["ok"])
        self.assertLess(time.time() - t, 6)
        self.assertTrue(run("print(1)")["ok"])  # runtime still healthy afterwards

    def test_stop_from_another_thread(self):
        res = {}
        th = threading.Thread(target=lambda: res.update(run("while True:\n    pass", timeout=20)))
        th.start()
        time.sleep(0.5)
        self.assertTrue(runner.stop("t"))
        th.join(8)
        self.assertFalse(th.is_alive())
        self.assertTrue(res["stopped"])

    def test_output_is_capped(self):
        r = run("for i in range(200000):\n    print('xxxxxxxxxx')")
        self.assertTrue(r["truncated"])
        self.assertLessEqual(len(r["stdout"]), runner.MAX_OUTPUT)

    def test_files_stay_inside_workspace(self):
        ws = tempfile.mkdtemp()
        r = run("open('a.txt','w').write('hi')\nprint(open('a.txt').read())", ws=ws)
        self.assertTrue(r["ok"], r)
        self.assertTrue(os.path.exists(os.path.join(ws, "a.txt")))
        for bad in ["open('/etc/passwd')", "open('../x.txt','w')", "open('/tmp/pytaj_evil','w')"]:
            r = run(bad, ws=ws)
            self.assertEqual(r["error"]["type"], "PermissionError", bad)

    def test_dangerous_calls_blocked_and_restored(self):
        orig_system = os.system
        for bad in ["import os; os.system('echo hacked')", "import subprocess", "import os; os.popen('ls')"]:
            r = run(bad)
            self.assertFalse(r["ok"], bad)
        self.assertIs(os.system, orig_system)
        import builtins
        self.assertTrue(callable(builtins.open))
        self.assertEqual(os.getcwd(), os.getcwd())

    def test_cwd_and_streams_restored(self):
        cwd, out, inp = os.getcwd(), sys.stdout, sys.stdin
        run("print(1)")
        run("1/0")
        self.assertEqual((os.getcwd(), sys.stdout, sys.stdin), (cwd, out, inp))

    def test_repl_keeps_state_and_echoes_expressions(self):
        runner.repl_reset("s1")
        a = json.loads(runner.repl("1", "s1", "x = 20"))
        b = json.loads(runner.repl("2", "s1", "x + 1"))
        c = json.loads(runner.repl("3", "s1", "def f():\n    return x * 2\n\nprint(f())"))
        self.assertEqual(a["stdout"], "")
        self.assertEqual(b["stdout"], "21\n")
        self.assertEqual(c["stdout"], "40\n")
        runner.repl_reset("s1")
        d = json.loads(runner.repl("4", "s1", "x"))
        self.assertEqual(d["error"]["type"], "NameError")

    def test_system_exit_is_not_an_error(self):
        self.assertTrue(run("import sys\nsys.exit(0)")["ok"])

    def test_stdlib_modules_available(self):
        r = run("import math, random, datetime, json, statistics\nprint(math.sqrt(16))")
        self.assertTrue(r["ok"])


if __name__ == "__main__":
    unittest.main()

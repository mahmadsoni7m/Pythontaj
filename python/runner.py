"""PythonТаҷ — Python runtime wrapper.

Executes learner code with the real CPython interpreter (Chaquopy on Android,
plain CPython on a desktop for tests). The module is deliberately free of any
Android imports so that it can be tested with ``python -m unittest``.

Safety notes (best-effort guards, NOT a hard security boundary):
  * file access through open() is limited to the workspace directory;
  * os.system / os.popen / exec* / spawn* / fork and `subprocess` are blocked;
  * runs have a time limit and an output size limit;
  * lesson files are never executed automatically; only code the learner
    explicitly runs is executed.
"""
import builtins
import ctypes
import io
import json
import linecache
import os
import sys
import threading
import time
import tokenize  # noqa: F401  (imported early on purpose)
import traceback

MAX_OUTPUT = 100_000
DEFAULT_TIMEOUT = 10.0
FILENAME = "<код>"

_run_lock = threading.Lock()
_workers = {}  # run id -> thread


class RunStopped(BaseException):
    """Raised inside the worker thread when the learner presses Stop."""


class RunTimeout(BaseException):
    """Raised inside the worker thread when the time limit is exceeded."""


class _Out(io.TextIOBase):
    def __init__(self):
        self.parts = []
        self.size = 0
        self.truncated = False

    def writable(self):
        return True

    def write(self, s):
        if not isinstance(s, str):
            s = str(s)
        room = MAX_OUTPUT - self.size
        if room <= 0:
            self.truncated = True
            return len(s)
        if len(s) > room:
            s = s[:room]
            self.truncated = True
        self.parts.append(s)
        self.size += len(s)
        return len(s)

    def flush(self):
        pass

    def getvalue(self):
        return "".join(self.parts)


def _async_raise(thread, exc_type):
    if thread is None or thread.ident is None:
        return
    ctypes.pythonapi.PyThreadState_SetAsyncExc(
        ctypes.c_ulong(thread.ident), ctypes.py_object(exc_type)
    )


def _make_safe_open(workspace):
    real_open = builtins.open
    root = os.path.realpath(workspace)

    def safe_open(file, *args, **kwargs):
        if isinstance(file, int):
            raise PermissionError("Дастрасӣ ба дескриптор манъ аст")
        path = os.path.realpath(os.path.join(root, os.fspath(file)))
        if path != root and not path.startswith(root + os.sep):
            raise PermissionError(
                "Дастрасӣ ба файл берун аз ҷузвдони корӣ манъ аст: %s" % file
            )
        return real_open(path, *args, **kwargs)

    return safe_open


def _blocked(*_a, **_k):
    raise PermissionError("Ин амал дар PythonТаҷ манъ аст")


_BLOCKED_OS = [
    "system", "popen", "fork", "forkpty", "kill", "killpg",
    "execv", "execve", "execvp", "execvpe", "execl", "execle", "execlp", "execlpe",
    "spawnl", "spawnle", "spawnlp", "spawnlpe", "spawnv", "spawnve", "spawnvp", "spawnvpe",
    "startfile",
]


def _format_error(exc, tb):
    """Describe an error, keeping only the frames of the learner's code."""
    etype = type(exc).__name__
    line = None
    if isinstance(exc, SyntaxError):
        line = exc.lineno
        text = '  File "%s", line %s\n' % (FILENAME, exc.lineno)
        if exc.text:
            text += "    %s\n" % exc.text.strip()
        text += "%s: %s" % (etype, exc.msg)
        return {"type": etype, "message": exc.msg, "line": line, "traceback": text}
    frames = [f for f in traceback.extract_tb(tb) if f.filename == FILENAME]
    if frames:
        line = frames[-1].lineno
    lines = ["Traceback (most recent call last):"]
    for f in frames:
        lines.append('  File "%s", line %s, in %s' % (f.filename, f.lineno, f.name))
        if f.line:
            lines.append("    " + f.line.strip())
    lines.append("%s: %s" % (etype, exc))
    return {"type": etype, "message": str(exc), "line": line, "traceback": "\n".join(lines)}


def _execute(code, stdin_text, workspace, timeout, result, run_id, env=None, mode="exec"):
    out = _Out()
    err = _Out()
    stdin_lines = stdin_text.split("\n") if stdin_text else []
    if stdin_lines and stdin_lines[-1] == "":
        stdin_lines.pop()

    def fake_input(prompt=""):
        out.write(str(prompt))
        if not stdin_lines:
            raise EOFError("Маълумоти вурудӣ намондааст (дар майдони вурудӣ сатри лозимӣ нест)")
        line = stdin_lines.pop(0)
        out.write(line + "\n")
        return line

    saved = {
        "stdout": sys.stdout, "stderr": sys.stderr, "stdin": sys.stdin,
        "input": builtins.input, "open": builtins.open,
        "displayhook": sys.displayhook,
        "cwd": os.getcwd(), "subprocess": sys.modules.get("subprocess", "__missing__"),
        "os": {n: getattr(os, n) for n in _BLOCKED_OS if hasattr(os, n)},
    }
    started = time.time()
    try:
        os.makedirs(workspace, exist_ok=True)
        os.chdir(workspace)
        sys.stdout, sys.stderr = out, err
        sys.stdin = io.StringIO(stdin_text or "")
        builtins.input = fake_input
        builtins.open = _make_safe_open(workspace)

        def hook(value):
            if value is not None:
                builtins._ = value
                out.write(repr(value) + "\n")

        sys.displayhook = hook
        sys.modules["subprocess"] = None  # makes `import subprocess` fail
        for n in saved["os"]:
            setattr(os, n, _blocked)

        if env is None:
            env = {"__name__": "__main__", "__builtins__": builtins}
        try:
            try:
                compiled = compile(code, FILENAME, mode)
            except SyntaxError:
                if mode != "single":
                    raise
                compiled = compile(code, FILENAME, "exec")
        except SyntaxError as e:  # includes IndentationError
            result["error"] = _format_error(e, None)
            return out, err, started

        def target():
            try:
                exec(compiled, env)
            except RunStopped:
                result["stopped"] = True
            except RunTimeout:
                result["timedOut"] = True
            except SystemExit:
                pass
            except BaseException as e:  # noqa: BLE001
                result["error"] = _format_error(e, e.__traceback__)

        linecache.cache[FILENAME] = (len(code), None, code.splitlines(True), FILENAME)
        worker = threading.Thread(target=target, daemon=True)
        _workers[run_id] = worker
        worker.start()
        worker.join(timeout)
        if worker.is_alive():
            result["timedOut"] = True
            for _ in range(50):
                _async_raise(worker, RunTimeout)
                worker.join(0.1)
                if not worker.is_alive():
                    break
        return out, err, started
    finally:
        _workers.pop(run_id, None)
        sys.displayhook = saved["displayhook"]
        sys.stdout, sys.stderr, sys.stdin = saved["stdout"], saved["stderr"], saved["stdin"]
        builtins.input, builtins.open = saved["input"], saved["open"]
        for n, fn in saved["os"].items():
            setattr(os, n, fn)
        if saved["subprocess"] == "__missing__":
            sys.modules.pop("subprocess", None)
        else:
            sys.modules["subprocess"] = saved["subprocess"]
        os.chdir(saved["cwd"])


def run(run_id, code, stdin_text="", workspace=None, timeout=DEFAULT_TIMEOUT, env=None, mode="exec"):
    """Run learner code. Returns a JSON string."""
    run_id = str(run_id)
    if workspace is None:
        import tempfile
        workspace = tempfile.mkdtemp(prefix="pytaj_")
    result = {"id": run_id, "ok": False, "stdout": "", "stderr": "", "error": None,
              "timedOut": False, "stopped": False, "truncated": False, "durationMs": 0}
    if not _run_lock.acquire(timeout=2):
        result["error"] = {"type": "Busy", "message": "Иҷрои дигар идома дорад", "line": None,
                           "traceback": "Busy"}
        return json.dumps(result, ensure_ascii=False)
    try:
        out, err, started = _execute(code, stdin_text or "", workspace, float(timeout), result, run_id, env, mode)
        result["stdout"] = out.getvalue()
        result["stderr"] = err.getvalue()
        result["truncated"] = out.truncated or err.truncated
        result["durationMs"] = int((time.time() - started) * 1000)
        result["ok"] = not (result["error"] or result["timedOut"] or result["stopped"])
    finally:
        _run_lock.release()
    return json.dumps(result, ensure_ascii=False)


def stop(run_id):
    """Ask a running worker to stop. Returns True if a worker was found."""
    worker = _workers.get(str(run_id))
    if worker is None or not worker.is_alive():
        return False
    _async_raise(worker, RunStopped)
    return True


def version():
    return sys.version.split()[0]


_sessions = {}


def repl(run_id, session, source, workspace=None, timeout=DEFAULT_TIMEOUT):
    """Interactive console: globals persist between calls of the same session."""
    env = _sessions.setdefault(str(session), {"__name__": "__main__", "__builtins__": builtins})
    return run(run_id, source, "", workspace, timeout, env, "single")


def repl_reset(session):
    _sessions.pop(str(session), None)

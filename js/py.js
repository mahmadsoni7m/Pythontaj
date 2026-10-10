/* Bridge to the real Python runtime (Chaquopy) exposed by the Android app as window.AndroidApp. */
(function () {
  const pending = new Map();
  let seq = 0;
  const native = () => (window.AndroidApp && typeof window.AndroidApp.pyRun === 'function' ? window.AndroidApp : null);

  window.__ptNative = window.__ptNative || {};
  window.__ptNative.onPyResult = function (id, json) {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    try { p.resolve(JSON.parse(json)); } catch (e) { p.reject(e); }
  };

  window.Py = {
    available: () => !!native(),
    version: () => { const n = native(); try { return n && n.pyVersion ? n.pyVersion() : ''; } catch (e) { return ''; } },
    /** Runs code. Resolves with {ok, stdout, stderr, error, timedOut, stopped, ...}. */
    run(code, stdin, timeoutSec) {
      const n = native();
      if (!n) return Promise.resolve({ ok: false, unavailable: true, stdout: '', stderr: '', error: null });
      const id = 'r' + (++seq);
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        window.Py.lastId = id;
        try { n.pyRun(id, String(code), String(stdin || ''), timeoutSec || 10); } catch (e) { pending.delete(id); reject(e); }
      });
    },
    stop() { const n = native(); if (n && window.Py.lastId) n.pyStop(window.Py.lastId); },
    runRepl(session, source) {
      const n = native();
      if (!n) return Promise.resolve({ ok: false, unavailable: true, stdout: '', stderr: '', error: null });
      const id = 'c' + (++seq);
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        try { n.pyRepl(id, String(session), String(source), 10); } catch (e) { pending.delete(id); reject(e); }
      });
    },
    resetRepl(session) { const n = native(); if (n) n.pyReplReset(String(session)); },
  };
})();

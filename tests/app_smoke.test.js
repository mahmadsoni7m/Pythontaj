/* Smoke test: loads the real browser scripts in Node with a tiny fake DOM, renders every screen,
   downloads a lesson through the real verification path and runs the exercise + quiz flow.
   Python code is executed by the REAL runner (python/runner.py) through a child process. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');

function fake(init) {
  const store = Object.assign({ innerHTML: '', value: '', hidden: false, dataset: {}, style: {}, scrollTop: 0, textContent: '', disabled: false }, init);
  const fn = function () { return fake(); };
  return new Proxy(fn, {
    get(_t, k) {
      if (k in store) return store[k];
      if (k === 'classList') return { add() {}, remove() {}, toggle() {}, contains: () => false };
      if (k === 'querySelector') return () => fake();
      if (k === 'querySelectorAll') return () => [];
      if (k === 'closest') return () => null;
      if (k === Symbol.toPrimitive) return () => '';
      if (k === 'then') return undefined;
      return fake();
    },
    set(_t, k, v) { store[k] = v; return true; },
  });
}

const screen = fake();
const listeners = {};
const g = globalThis;
g.window = g;
g.require = require; // lib.js uses node's crypto when running under Node
g.document = { documentElement: { dataset: {} }, getElementById: (id) => (id === 'screen' ? screen : fake()), querySelector: () => fake(), querySelectorAll: () => [],
  addEventListener: (n, f) => { listeners[n] = f; }, createElement: () => fake(), body: fake() };
g.location = { hash: '', protocol: 'https:', replace(h) { this.hash = h; }, set href(v) {} };
g.history = { length: 1, back() {} };
g.navigator = { onLine: true };
const ls = {}; g.localStorage = { getItem: (k) => ls[k] || null, setItem: (k, v) => { ls[k] = String(v); } };
g.addEventListener = () => {};
g.fetch = async (url) => {
  if (/^https?:/.test(url)) throw new Error('offline');
  const f = path.join(root, url);
  if (!fs.existsSync(f)) return { ok: false, status: 404 };
  const buf = fs.readFileSync(f);
  return { ok: true, status: 200, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
};
for (const f of ['config', 'i18n', 'icons', 'lib', 'art', 'db', 'py', 'editor', 'content', 'store', 'app']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8'), { filename: f + '.js' });
}

// Real Python through a child process (same runner module as on Android).
g.Py = Object.assign(g.Py, {
  run: async (code, stdin) => {
    const r = spawnSync('python3', ['-c', 'import sys,json;sys.path.insert(0,"python");import runner;d=json.load(sys.stdin);print(runner.run("t",d["code"],d["stdin"]))'],
      { cwd: root, input: JSON.stringify({ code, stdin }), encoding: 'utf8' });
    return JSON.parse(r.stdout);
  },
  runRepl: async () => ({ ok: true, stdout: '5\n', error: null }),
  available: () => true,
});

test('boot, render every screen', async () => {
  await DB.open(); await Progress.load(); await Content.init();
  assert.equal(Content.entries().length, 42);
  assert.equal(Content.source, 'bundled');
  const { render } = g.PTApp;
  const routes = ['#/onboarding', '#/home', '#/path', '#/play', '#/files', '#/console', '#/progress', '#/downloads', '#/settings', '#/update'];
  for (const r of routes) {
    location.hash = r; await render(false);
    if (r !== '#/onboarding') assert.ok(screen.innerHTML.length > 100, r + ' rendered empty');
    assert.ok(!/undefined|\[object/.test(screen.innerHTML), r + ' contains undefined');
  }
  for (const lang of ['ru', 'en', 'tk']) { I18N.setLang(lang); location.hash = '#/home'; await render(false); assert.ok(screen.innerHTML.length > 100); }
});

test('locked lesson redirects to the path; unknown route goes home', async () => {
  location.hash = '#/lesson/lesson-005'; await g.PTApp.render(false);
  assert.equal(location.hash, '#/path');
  location.hash = '#/nonsense'; await g.PTApp.render(false);
  assert.equal(location.hash, '#/home');
});

test('download with SHA-256 verification, then lesson renders', async () => {
  location.hash = '#/lesson/lesson-001'; await g.PTApp.render(false);
  assert.match(screen.innerHTML, /data-a="dl"/); // not downloaded yet
  await Content.download('lesson-001');
  assert.equal(Content.status(Content.entry('lesson-001')), 'ok');
  await g.PTApp.render(false);
  assert.match(screen.innerHTML, /exsec/);
  assert.match(screen.innerHTML, /Python чист/);
});

test('corrupted download is rejected and nothing is stored', async () => {
  const orig = g.fetch;
  g.fetch = async (url) => { const r = await orig(url); if (/lesson-002/.test(url)) { const b = Buffer.from('{"id":"lesson-002"}'); return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; } return r; };
  await assert.rejects(() => Content.download('lesson-002'));
  assert.equal(Content.status(Content.entry('lesson-002')), 'missing');
  assert.equal(await Content.getLesson('lesson-002'), null);
  g.fetch = orig;
});

test('exercise submit + quiz completes the lesson and unlocks the next one', async () => {
  const { A, S } = g.PTApp;
  location.hash = '#/lesson/lesson-001'; await g.PTApp.render(false);
  await new Promise((r) => setTimeout(r, 20));
  const L = S.lesson;
  assert.ok(L && L.data.id === 'lesson-001');
  L.editor = { getValue: () => 'print("x")', setValue() {} };
  await A.exSubmit();
  assert.equal(Progress.get().exercises['lesson-001'].passed, false);
  L.editor = { getValue: () => L.data.exercise.solution, setValue() {} };
  await A.exSubmit();
  assert.equal(Progress.get().exercises['lesson-001'].passed, true);
  A.quizStart();
  for (let i = 0; i < S.quiz.items.length; i++) {
    const ci = S.quiz.items[i].options.findIndex((o) => o.correct);
    A.qpick({ i: String(ci) }); A.qnext();
  }
  assert.equal(S.quiz.summary.passed, true);
  assert.ok(Progress.get().completed['lesson-001']);
  assert.equal(Progress.get().points, 20);
  location.hash = '#/lesson/lesson-002'; await g.PTApp.render(false);
  assert.notEqual(location.hash, '#/path');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

global.window = {}; global.document = { documentElement: {} };
require('../js/i18n.js');
const dicts = window.I18N.dicts;

test('i18n: ru and en have exactly the tk keys', () => {
  const k = Object.keys(dicts.tk).sort();
  assert.deepEqual(Object.keys(dicts.ru).sort(), k);
  assert.deepEqual(Object.keys(dicts.en).sort(), k);
  for (const l of ['tk', 'ru', 'en']) for (const key of k) assert.ok(dicts[l][key].trim().length, l + ':' + key);
});

test('every t("key") used in the app exists', () => {
  const src = read('js/app.js') + read('js/editor.js');
  const used = new Set([...src.matchAll(/\bt\('([a-z0-9_]+)'/g)].map((m) => m[1]));
  const dyn = ['onb1', 'onb2', 'onb3', 'onb4', 'onb5'];
  used.delete('lvl'); // dynamic: lvl1..lvl8 checked below
  for (let i = 1; i <= 8; i++) assert.ok(('lvl' + i) in dicts.tk, 'lvl' + i);
  used.forEach((k) => assert.ok(k in dicts.tk, 'missing i18n key: ' + k));
  dyn.forEach((p) => { assert.ok(p + '_t' in dicts.tk); assert.ok(p + '_d' in dicts.tk); });
  ['k_lesson', 'k_exercise', 'k_quiz', 'src_remote', 'src_cache', 'src_bundled', 'greet_m', 'greet_d', 'greet_e'].forEach((k) => assert.ok(k in dicts.tk, k));
});

test('every data-a action has a handler', () => {
  const src = read('js/app.js');
  const actions = new Set([...src.matchAll(/data-a="([A-Za-z0-9_]+)"/g)].map((m) => m[1]));
  ['exStop', 'fStop'].forEach((a) => actions.add(a));
  const defined = new Set([...src.matchAll(/\bA\.([A-Za-z0-9_]+)\s*=/g)].map((m) => m[1]));
  for (const a of actions) assert.ok(defined.has(a), 'no handler for data-a=' + a);
});

test('every icon used exists', () => {
  const icons = read('js/icons.js');
  const names = new Set([...icons.matchAll(/(?:^|,)\s*([a-z]+):\s*'/gm)].map((m) => m[1]));
  const src = read('js/app.js');
  const used = new Set([...src.matchAll(/icon\('([a-z]+)'/g)].map((m) => m[1]));
  used.forEach((n) => assert.ok(names.has(n), 'missing icon ' + n));
});

test('all scripts referenced by index.html exist and parse', () => {
  const html = read('index.html');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 8);
  for (const s of scripts) { assert.ok(fs.existsSync(path.join(root, s)), s); new (require('vm').Script)(read(s), { filename: s }); }
  assert.match(html, /Content-Security-Policy/);
});

test('lessons contain no executable markup', () => {
  for (const f of fs.readdirSync(path.join(root, 'lessons'))) assert.ok(!/<script|javascript:/i.test(read('lessons/' + f)), f);
});

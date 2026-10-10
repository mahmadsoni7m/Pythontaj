/* PythonТаҷ — pure logic (no DOM). Works in the WebView and in Node (tests). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.PT = root.PT || {}; Object.assign(root.PT, api); }
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const SUPPORTED_SCHEMA = 1;
  const PASS_RATIO = 0.6;

  /* ---------- versions ---------- */
  // Compares ints or dotted strings ("1.2.10" > "1.2.9"). Returns -1, 0, 1.
  function compareVersions(a, b) {
    const pa = String(a).replace(/^v/i, '').split('.').map((x) => parseInt(x, 10) || 0);
    const pb = String(b).replace(/^v/i, '').split('.').map((x) => parseInt(x, 10) || 0);
    const n = Math.max(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
      const x = pa[i] || 0, y = pb[i] || 0;
      if (x < y) return -1;
      if (x > y) return 1;
    }
    return 0;
  }

  /* ---------- url / validation ---------- */
  function isHttps(url) {
    try { return new URL(url).protocol === 'https:'; } catch (e) { return false; }
  }
  function isSafeRelPath(p) {
    return typeof p === 'string' && /^lessons\/lesson-\d{3,}\.json$/.test(p);
  }
  const isStr = (x) => typeof x === 'string';
  const isInt = (x) => Number.isInteger(x);

  function validateManifest(m) {
    const errors = [];
    if (!m || typeof m !== 'object') return ['manifest объект нест'];
    if (!isInt(m.contentSchema)) errors.push('contentSchema');
    if (!isInt(m.minAppContent)) errors.push('minAppContent');
    if (!isStr(m.curriculumVersion)) errors.push('curriculumVersion');
    if (!Array.isArray(m.modules)) errors.push('modules');
    if (!Array.isArray(m.lessons)) errors.push('lessons');
    else {
      const seen = new Set();
      m.lessons.forEach((e, i) => {
        const w = 'lessons[' + i + ']';
        if (!e || !isStr(e.id) || !/^lesson-\d{3,}$/.test(e.id)) return errors.push(w + '.id');
        if (seen.has(e.id)) errors.push(w + ' такрор');
        seen.add(e.id);
        if (!isInt(e.number)) errors.push(w + '.number');
        if (!isStr(e.title)) errors.push(w + '.title');
        if (!isInt(e.version) || e.version < 1) errors.push(w + '.version');
        if (!isSafeRelPath(e.path)) errors.push(w + '.path');
        if (!isStr(e.sha256) || !/^[0-9a-f]{64}$/.test(e.sha256)) errors.push(w + '.sha256');
        if (!isInt(e.size)) errors.push(w + '.size');
      });
    }
    return errors;
  }

  function validateLesson(d) {
    const errors = [];
    if (!d || typeof d !== 'object') return ['дарс объект нест'];
    if (d.schema !== SUPPORTED_SCHEMA) errors.push('schema');
    ['id', 'module', 'title', 'description'].forEach((k) => { if (!isStr(d[k])) errors.push(k); });
    ['number', 'version', 'points'].forEach((k) => { if (!isInt(d[k])) errors.push(k); });
    ['objectives', 'explanation', 'examples', 'notes', 'mistakes', 'quiz'].forEach((k) => {
      if (!Array.isArray(d[k])) errors.push(k);
    });
    if (errors.length) return errors;
    if (!d.explanation.every(isStr)) errors.push('explanation');
    d.examples.forEach((x, i) => {
      if (!x || !isStr(x.title) || !isStr(x.code) || !isStr(x.output) || !Array.isArray(x.steps)) errors.push('examples[' + i + ']');
    });
    const e = d.exercise;
    if (!e || !isStr(e.prompt) || !isStr(e.starter) || !isStr(e.solution) || !isStr(e.hint) ||
        !Array.isArray(e.tests) || !e.tests.length || !Array.isArray(e.mustContain)) errors.push('exercise');
    else e.tests.forEach((t, i) => { if (!t || !isStr(t.stdin) || !isStr(t.expected)) errors.push('exercise.tests[' + i + ']'); });
    if (d.quiz.length < 1) errors.push('quiz');
    d.quiz.forEach((q, i) => {
      if (!q || !isStr(q.q) || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4 ||
          !isInt(q.answer) || q.answer < 0 || q.answer >= q.options.length || !isStr(q.explanation)) errors.push('quiz[' + i + ']');
    });
    return errors;
  }

  /* ---------- sha256 ---------- */
  async function sha256Hex(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      return require('crypto').createHash('sha256').update(u8).digest('hex');
    }
    const buf = await crypto.subtle.digest('SHA-256', u8);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---------- manifest / lesson status ---------- */
  // local: { [id]: {version, sha256} } of downloaded lessons.
  function lessonStatus(entry, local) {
    const l = local && local[entry.id];
    if (!l) return 'missing';
    if (compareVersions(l.version, entry.version) < 0 || l.sha256 !== entry.sha256) return 'update';
    return 'ok';
  }

  // Compare remote manifest with previously known manifest and local downloads.
  function diffManifest(prev, next, local) {
    const prevIds = new Set(prev && prev.lessons ? prev.lessons.map((e) => e.id) : []);
    const res = { newLessons: [], updated: [], missing: [], upToDate: [] };
    next.lessons.forEach((e) => {
      const st = lessonStatus(e, local);
      const isNew = prev ? !prevIds.has(e.id) : false;
      if (isNew) res.newLessons.push(e.id);
      if (st === 'update') res.updated.push(e.id);
      else if (st === 'missing') res.missing.push(e.id);
      else res.upToDate.push(e.id);
    });
    return res;
  }

  /* ---------- quiz ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    const a = arr.slice();
    const r = rnd || Math.random;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  // Builds a randomized quiz: [{index, q, options:[{text, correct}], explanation}]
  function buildQuiz(questions, rnd) {
    return shuffle(questions.map((q, index) => ({
      index, q: q.q, explanation: q.explanation,
      options: shuffle(q.options.map((text, i) => ({ text, correct: i === q.answer })), rnd),
    })), rnd);
  }
  // picks: array of booleans (true if correct). Returns score summary.
  function scoreQuiz(results) {
    const total = results.length;
    const correct = results.filter(Boolean).length;
    const ratio = total ? correct / total : 0;
    return { correct, total, ratio, passed: total > 0 && ratio >= PASS_RATIO };
  }

  /* ---------- exercise validation ---------- */
  function normalizeOutput(s) {
    return String(s).replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\s+$/, '');
  }
  function outputsMatch(actual, expected) {
    return normalizeOutput(actual) === normalizeOutput(expected);
  }
  // runs: [{ok, stdout}] aligned with exercise.tests
  function checkExercise(exercise, code, runs) {
    const missing = (exercise.mustContain || []).filter((m) => !String(code).includes(m));
    const tests = exercise.tests.map((t, i) => {
      const r = runs[i];
      const passed = !!(r && r.ok && outputsMatch(r.stdout, t.expected));
      return { passed, expected: t.expected, actual: r ? r.stdout : '', error: r && r.error ? r.error : null };
    });
    const allPass = tests.length > 0 && tests.every((t) => t.passed);
    return { passed: allPass && missing.length === 0, missing, tests };
  }

  /* ---------- progress ---------- */
  function emptyProgress() {
    return { v: 1, completed: {}, quiz: {}, exercises: {}, points: 0, history: [], streak: { current: 0, best: 0, last: '' },
      activity: {}, bookmarks: [], recent: [], stats: { runs: 0, quizCorrect: 0, quizTotal: 0 } };
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(key, n) {
    const [y, m, d] = key.split('-').map(Number);
    return dayKey(new Date(y, m - 1, d + n));
  }
  function touchStreak(streak, today) {
    if (streak.last === today) return streak;
    const cont = streak.last === addDays(today, -1);
    const current = cont ? streak.current + 1 : 1;
    return { current, best: Math.max(streak.best, current), last: today };
  }
  function currentStreak(streak, today) {
    if (!streak.last) return 0;
    return streak.last === today || streak.last === addDays(today, -1) ? streak.current : 0;
  }
  function logActivity(p, kind, lessonId, points, now) {
    const d = dayKey(now);
    p.activity[d] = (p.activity[d] || 0) + 1;
    p.streak = touchStreak(p.streak, d);
    p.history.unshift({ at: (now || new Date()).toISOString(), kind, lessonId, points: points || 0 });
    if (p.history.length > 200) p.history.length = 200;
  }
  function recordExercise(p, lessonId, passed, now) {
    const e = p.exercises[lessonId] || { passed: false, attempts: 0 };
    e.attempts++;
    let gained = 0;
    if (passed) {
      if (!e.passed) { gained = 10; p.points += gained; e.at = (now || new Date()).toISOString(); }
      e.passed = true;
      logActivity(p, 'exercise', lessonId, gained, now);
    }
    p.exercises[lessonId] = e;
    return gained + completeIfReady(p, lessonId, now);
  }
  function recordQuiz(p, lessonId, summary, now) {
    const q = p.quiz[lessonId] || { best: 0, total: summary.total, attempts: 0, passed: false };
    q.attempts++;
    q.total = summary.total;
    q.best = Math.max(q.best, summary.correct);
    p.stats.quizCorrect += summary.correct;
    p.stats.quizTotal += summary.total;
    let gained = 0;
    if (summary.passed && !q.passed) { q.passed = true; gained = 10; p.points += gained; }
    p.quiz[lessonId] = q;
    logActivity(p, 'quiz', lessonId, gained, now);
    return gained + completeIfReady(p, lessonId, now);
  }
  function completeIfReady(p, lessonId, now) {
    if (p.completed[lessonId]) return 0;
    const ex = p.exercises[lessonId], q = p.quiz[lessonId];
    if (ex && ex.passed && q && q.passed) {
      p.completed[lessonId] = { at: (now || new Date()).toISOString() };
      logActivity(p, 'lesson', lessonId, 0, now);
      return 0;
    }
    return 0;
  }
  // entries sorted by number. Lesson 1 and every lesson after a completed one is unlocked.
  function isUnlocked(entries, index, p) {
    if (index <= 0) return true;
    return !!p.completed[entries[index - 1].id];
  }
  function courseStats(entries, p) {
    const total = entries.length;
    const done = entries.filter((e) => p.completed[e.id]).length;
    return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
  }
  function quizAccuracy(p) {
    return p.stats.quizTotal ? Math.round((p.stats.quizCorrect / p.stats.quizTotal) * 100) : 0;
  }
  function dailyProgress(p, goal, now) {
    const done = p.activity[dayKey(now)] || 0;
    return { done, goal, reached: done >= goal };
  }
  function nextLessonIndex(entries, p) {
    const i = entries.findIndex((e) => !p.completed[e.id]);
    return i === -1 ? entries.length - 1 : i;
  }
  function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  // Daily challenge = exercise of one unlocked lesson, stable for the whole day.
  function dailyChallenge(entries, p, now) {
    const open = entries.filter((e, i) => isUnlocked(entries, i, p));
    if (!open.length) return null;
    return open[hashStr(dayKey(now)) % open.length];
  }

  const LEVELS = [0, 40, 100, 200, 350, 550, 800, 1100];
  // XP -> level (1..8). Returns {level, cur, next, pct}; next is null at the top level.
  function levelFor(points) {
    let lvl = 0;
    for (let i = 0; i < LEVELS.length; i++) if (points >= LEVELS[i]) lvl = i;
    const cur = LEVELS[lvl], next = lvl + 1 < LEVELS.length ? LEVELS[lvl + 1] : null;
    return { level: lvl + 1, cur, next, pct: next ? Math.round(((points - cur) / (next - cur)) * 100) : 100 };
  }

  const ACHIEVEMENTS = [
    { id: 'first', title: 'Қадами аввал', desc: 'Дарси аввалро анҷом диҳед', test: (p) => Object.keys(p.completed).length >= 1 },
    { id: 'five', title: 'Панҷ дарс', desc: '5 дарсро анҷом диҳед', test: (p) => Object.keys(p.completed).length >= 5 },
    { id: 'ten', title: 'Даҳ дарс', desc: '10 дарсро анҷом диҳед', test: (p) => Object.keys(p.completed).length >= 10 },
    { id: 'half', title: 'Нимаи роҳ', desc: 'Нисфи курсро анҷом диҳед', test: (p, c) => c.total > 0 && c.done * 2 >= c.total },
    { id: 'all', title: 'Устоди Python', desc: 'Тамоми курсро анҷом диҳед', test: (p, c) => c.total > 0 && c.done >= c.total },
    { id: 'streak3', title: 'Се рӯз пай дар пай', desc: 'Силсилаи 3 рӯзӣ', test: (p) => p.streak.best >= 3 },
    { id: 'streak7', title: 'Ҳафта бе танаффус', desc: 'Силсилаи 7 рӯзӣ', test: (p) => p.streak.best >= 7 },
    { id: 'pts100', title: '100 холл', desc: '100 холл ҷамъ кунед', test: (p) => p.points >= 100 },
    { id: 'perfect', title: 'Санҷиши комил', desc: 'Викторинаро бе хато гузаред', test: (p) => Object.values(p.quiz).some((q) => q.total > 0 && q.best === q.total) },
    { id: 'runner', title: 'Барномасоз', desc: '10 маротиба код иҷро кунед', test: (p) => p.stats.runs >= 10 },
  ];
  function achievementsFor(p, entries) {
    const c = courseStats(entries || [], p);
    return ACHIEVEMENTS.map((a) => ({ id: a.id, title: a.title, desc: a.desc, unlocked: !!a.test(p, c) }));
  }

  /* ---------- text helpers ---------- */
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // Escape first, then turn `code` into <code>. Nothing else becomes markup.
  function richText(s) {
    return escapeHtml(s).replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  /* ---------- python syntax highlighting ---------- */
  const KEYWORDS = new Set(['False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
    'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda',
    'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield']);
  const BUILTINS = new Set(['print', 'input', 'len', 'range', 'int', 'float', 'str', 'bool', 'list', 'dict', 'set', 'tuple',
    'type', 'sum', 'min', 'max', 'sorted', 'open', 'abs', 'round', 'enumerate', 'zip', 'map', 'filter', 'isinstance',
    'super', 'iter', 'next', 'reversed', 'any', 'all', 'pow', 'repr']);
  const TOKEN_RE = new RegExp([
    '(#[^\\n]*)',
    '([rRbBfFuU]{0,2}(?:"""[\\s\\S]*?(?:"""|$)|\'\'\'[\\s\\S]*?(?:\'\'\'|$)))',
    '([rRbBfFuU]{0,2}(?:"(?:\\\\.|[^"\\\\\\n])*"?|\'(?:\\\\.|[^\'\\\\\\n])*\'?))',
    '(\\b\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b|\\.\\d+)',
    '(@[A-Za-z_]\\w*)',
    '([A-Za-z_\\u0400-\\u04FF][\\w\\u0400-\\u04FF]*)',
    '([\\s\\S])',
  ].join('|'), 'g');

  function highlight(code) {
    let out = '', m, prev = '';
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(code)) !== null) {
      const t = m[0];
      const e = escapeHtml(t);
      if (m[1]) out += '<span class="tk-com">' + e + '</span>';
      else if (m[2] || m[3]) out += '<span class="tk-str">' + e + '</span>';
      else if (m[4]) out += '<span class="tk-num">' + e + '</span>';
      else if (m[5]) out += '<span class="tk-dec">' + e + '</span>';
      else if (m[6]) {
        let cls = '';
        if (KEYWORDS.has(t)) cls = 'tk-kw';
        else if (prev === 'def' || prev === 'class') cls = 'tk-def';
        else if (BUILTINS.has(t)) cls = 'tk-bi';
        else if (code[TOKEN_RE.lastIndex] === '(') cls = 'tk-fn';
        out += cls ? '<span class="' + cls + '">' + e + '</span>' : e;
        prev = t;
        continue;
      } else out += e;
      if (!/\s/.test(t)) prev = '';
    }
    return out;
  }

  /* ---------- editor helpers ---------- */
  // Indent for a new line after pressing Enter: keep current indent, +4 after ':'.
  function nextIndent(line) {
    const m = /^[ \t]*/.exec(line)[0];
    return /:\s*(#.*)?$/.test(line.replace(/\s+$/, '')) ? m + '    ' : m;
  }

  const ERROR_HINTS = {
    SyntaxError: 'Хатои синтаксис: код дуруст навишта нашудааст. Қавсҳо, нохунакҳо ва «:»-ро санҷед.',
    IndentationError: 'Хатои фосилаи сатр: блок бояд бо 4 фосила оғоз шавад.',
    NameError: 'Ин ном муайян нашудааст: тағйирёбанда пеш аз истифода сохта нашудааст ё ном хато навишта шудааст.',
    TypeError: 'Навъи нодуруст: амал бо ин навъи қиматҳо имконнопазир аст (масалан, матн + адад).',
    ValueError: 'Қимати нодуруст: навъ дуруст аст, вале қимат мувофиқ нест (масалан, int("абв")).',
    ZeroDivisionError: 'Тақсим ба сифр имконнопазир аст.',
    IndexError: 'Индекс аз ҳудуд берун аст: элементи чунин индекс нест.',
    KeyError: 'Чунин калид дар луғат нест.',
    AttributeError: 'Ин объект чунин атрибут ё метод надорад.',
    FileNotFoundError: 'Файл ёфт нашуд.',
    EOFError: 'Маълумоти вурудӣ намерасад: дар майдони «Вурудӣ» сатрҳои кофӣ нависед.',
    PermissionError: 'Ин амал дар PythonТаҷ иҷозат дода намешавад.',
    ModuleNotFoundError: 'Ин модул дастрас нест: дар PythonТаҷ танҳо китобхонаи стандартӣ ҳаст.',
    RecursionError: 'Такрори функсия аз ҳад зиёд шуд (рекурсияи беохир).',
  };
  function errorHint(type) { return ERROR_HINTS[type] || 'Хатои иҷро. Паёми Python-ро дар поён хонед.'; }

  return {
    SUPPORTED_SCHEMA, PASS_RATIO, compareVersions, isHttps, isSafeRelPath, validateManifest, validateLesson, sha256Hex,
    lessonStatus, diffManifest, mulberry32, shuffle, buildQuiz, scoreQuiz, normalizeOutput, outputsMatch, checkExercise,
    emptyProgress, dayKey, addDays, touchStreak, currentStreak, recordExercise, recordQuiz, isUnlocked, courseStats,
    quizAccuracy, dailyProgress, nextLessonIndex, dailyChallenge, achievementsFor, ACHIEVEMENTS, escapeHtml, richText,
    highlight, nextIndent, errorHint, levelFor, LEVELS,
  };
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../js/lib.js');
const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data/manifest.json'), 'utf8'));

test('compareVersions', () => {
  assert.equal(L.compareVersions('1.2.10', '1.2.9'), 1);
  assert.equal(L.compareVersions('v1.0.0', '1.0.0'), 0);
  assert.equal(L.compareVersions('1.0', '1.0.1'), -1);
  assert.equal(L.compareVersions(3, 2), 1);
});

test('manifest and all lessons validate', () => {
  assert.deepEqual(L.validateManifest(manifest), []);
  assert.ok(manifest.lessons.length >= 42);
  for (const e of manifest.lessons) {
    const d = JSON.parse(fs.readFileSync(path.join(root, e.path), 'utf8'));
    assert.deepEqual(L.validateLesson(d), [], e.id);
  }
});

test('sha256 in manifest matches files', async () => {
  for (const e of manifest.lessons) {
    const raw = fs.readFileSync(path.join(root, e.path));
    assert.equal(await L.sha256Hex(raw), e.sha256, e.id);
    assert.equal(raw.length, e.size);
  }
});

test('validators reject broken data', () => {
  assert.ok(L.validateManifest({}).length > 0);
  const bad = JSON.parse(JSON.stringify(manifest));
  bad.lessons[0].path = '../evil.json';
  assert.ok(L.validateManifest(bad).length > 0);
  bad.lessons[0].path = 'lessons/lesson-001.json';
  bad.lessons[0].sha256 = 'xyz';
  assert.ok(L.validateManifest(bad).length > 0);
  const d = JSON.parse(fs.readFileSync(path.join(root, manifest.lessons[0].path), 'utf8'));
  d.quiz[0].answer = 9;
  assert.ok(L.validateLesson(d).length > 0);
  assert.ok(L.validateLesson(null).length > 0);
});

test('lessonStatus and diffManifest', () => {
  const e = { id: 'lesson-001', version: 2, sha256: 'a'.repeat(64) };
  assert.equal(L.lessonStatus(e, {}), 'missing');
  assert.equal(L.lessonStatus(e, { 'lesson-001': { version: 1, sha256: 'a'.repeat(64) } }), 'update');
  assert.equal(L.lessonStatus(e, { 'lesson-001': { version: 2, sha256: 'b'.repeat(64) } }), 'update');
  assert.equal(L.lessonStatus(e, { 'lesson-001': { version: 2, sha256: 'a'.repeat(64) } }), 'ok');
  const prev = { lessons: [{ id: 'lesson-001' }] };
  const next = { lessons: [e, { id: 'lesson-002', version: 1, sha256: 'c'.repeat(64) }] };
  const d = L.diffManifest(prev, next, { 'lesson-001': { version: 1, sha256: 'a'.repeat(64) } });
  assert.deepEqual(d.newLessons, ['lesson-002']);
  assert.deepEqual(d.updated, ['lesson-001']);
  assert.deepEqual(d.missing, ['lesson-002']);
  assert.deepEqual(L.diffManifest(null, next, {}).newLessons, []); // first sync: nothing is "new"
});

test('quiz building keeps the correct answer and scoring thresholds', () => {
  const qs = [{ q: 'a', options: ['x', 'y', 'z'], answer: 1, explanation: 'e' }];
  for (let i = 0; i < 30; i++) {
    const b = L.buildQuiz(qs, L.mulberry32(i));
    assert.equal(b[0].options.filter((o) => o.correct).length, 1);
    assert.equal(b[0].options.find((o) => o.correct).text, 'y');
  }
  assert.equal(L.scoreQuiz([true, true, false]).passed, true);
  assert.equal(L.scoreQuiz([true, false, false]).passed, false);
  assert.equal(L.scoreQuiz([]).passed, false);
});

test('exercise checking', () => {
  const ex = { tests: [{ stdin: '', expected: 'Салом\n' }], mustContain: ['print'] };
  assert.equal(L.checkExercise(ex, 'print("Салом")', [{ ok: true, stdout: 'Салом\n' }]).passed, true);
  assert.equal(L.checkExercise(ex, 'print("Салом")', [{ ok: true, stdout: 'Салом  \r\n\n' }]).passed, true); // whitespace tolerant
  assert.equal(L.checkExercise(ex, 'print("x")', [{ ok: true, stdout: 'x\n' }]).passed, false);
  const noPrint = L.checkExercise(ex, 'x = 1', [{ ok: true, stdout: 'Салом\n' }]);
  assert.equal(noPrint.passed, false); assert.deepEqual(noPrint.missing, ['print']);
  assert.equal(L.checkExercise(ex, 'print()', [{ ok: false, stdout: 'Салом\n', error: { type: 'X' } }]).passed, false);
});

test('streak logic', () => {
  let s = { current: 0, best: 0, last: '' };
  s = L.touchStreak(s, '2026-10-01'); assert.equal(s.current, 1);
  s = L.touchStreak(s, '2026-10-01'); assert.equal(s.current, 1);
  s = L.touchStreak(s, '2026-10-02'); assert.equal(s.current, 2);
  s = L.touchStreak(s, '2026-10-05'); assert.equal(s.current, 1); assert.equal(s.best, 2);
  assert.equal(L.currentStreak(s, '2026-10-06'), 1);
  assert.equal(L.currentStreak(s, '2026-10-09'), 0);
  assert.equal(L.addDays('2026-10-31', 1), '2026-11-01');
});

test('progress: completion needs exercise AND quiz, unlock chain, no double points', () => {
  const p = L.emptyProgress();
  const E = manifest.lessons;
  assert.equal(L.isUnlocked(E, 0, p), true);
  assert.equal(L.isUnlocked(E, 1, p), false);
  L.recordExercise(p, E[0].id, false);
  assert.equal(p.points, 0);
  L.recordExercise(p, E[0].id, true);
  assert.equal(p.points, 10);
  assert.equal(p.completed[E[0].id], undefined);
  L.recordExercise(p, E[0].id, true);
  assert.equal(p.points, 10);
  L.recordQuiz(p, E[0].id, L.scoreQuiz([true, false, false]));
  assert.equal(p.completed[E[0].id], undefined);
  L.recordQuiz(p, E[0].id, L.scoreQuiz([true, true, false]));
  assert.ok(p.completed[E[0].id]);
  assert.equal(p.points, 20);
  L.recordQuiz(p, E[0].id, L.scoreQuiz([true, true, true]));
  assert.equal(p.points, 20);
  assert.equal(L.isUnlocked(E, 1, p), true);
  assert.equal(L.courseStats(E, p).done, 1);
  assert.ok(L.achievementsFor(p, E).find((a) => a.id === 'first').unlocked);
  assert.equal(L.nextLessonIndex(E, p), 1);
});

test('daily challenge is stable within a day and only uses unlocked lessons', () => {
  const p = L.emptyProgress();
  const E = manifest.lessons;
  const d = new Date(2026, 9, 9);
  assert.equal(L.dailyChallenge(E, p, d).id, 'lesson-001');
  assert.equal(L.dailyChallenge(E, p, d).id, L.dailyChallenge(E, p, d).id);
});

test('richText never lets markup through; highlight escapes', () => {
  assert.equal(L.richText('<img src=x onerror=1> `a<b`'), '&lt;img src=x onerror=1&gt; <code>a&lt;b</code>');
  assert.ok(!L.highlight('print("<script>")').includes('<script>'));
  assert.ok(L.highlight('x = 1').includes('tk-num'));
});

test('editor helpers and error hints', () => {
  assert.equal(L.nextIndent('if x:'), '    ');
  assert.equal(L.nextIndent('    y = 1'), '    ');
  assert.equal(L.nextIndent('def f():  # c'), '    ');
  assert.ok(L.errorHint('ZeroDivisionError').includes('сифр'));
  assert.ok(L.errorHint('Weird').length > 0);
});

test('isHttps / safe paths', () => {
  assert.equal(L.isHttps('https://a.github.io/x'), true);
  assert.equal(L.isHttps('http://a.github.io/x'), false);
  assert.equal(L.isHttps('javascript:alert(1)'), false);
  assert.equal(L.isSafeRelPath('lessons/lesson-001.json'), true);
  assert.equal(L.isSafeRelPath('lessons/../x.json'), false);
});

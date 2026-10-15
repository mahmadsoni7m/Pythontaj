/* PythonТаҷ — application shell, router and screens. */
(function () {
  'use strict';
  const t = (k, p) => I18N.t(k, p);
  const esc = PT.escapeHtml;
  const $ = (s, r) => (r || document).querySelector(s);
  const S = { lesson: null, file: null, console: { log: [] }, dl: {}, quiz: null, upd: {}, sync: null, cleanup: null, routeKey: '' };
  const A = {}; // actions (data-a="...")
  const $screen = () => document.getElementById('screen');

  /* ---------- helpers ---------- */
  function fmtBytes(n) { return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
  function fmtDate(iso) {
    if (!iso) return t('never');
    const d = new Date(iso);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function toast(msg, kind) {
    const old = $('.toast'); if (old) old.remove();
    const d = document.createElement('div');
    d.className = 'toast ' + (kind || ''); d.textContent = msg; d.setAttribute('role', 'status');
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2600);
  }
  function modal(html) {
    return new Promise((resolve) => {
      const m = document.createElement('div');
      m.className = 'modal'; m.innerHTML = '<div class="box" role="dialog">' + html + '</div>';
      document.body.appendChild(m);
      const done = (v) => { m.remove(); resolve(v); };
      m.addEventListener('click', (e) => { if (e.target === m) done(null); const b = e.target.closest('[data-m]'); if (b) done(b.dataset.m); });
      const inp = m.querySelector('input'); if (inp) { inp.focus(); inp.select(); }
      m.result = () => (inp ? inp.value : null);
      m.addEventListener('click', (e) => { const b = e.target.closest('[data-m="ok"]'); if (b && inp) { m.remove(); resolve(inp.value); } }, true);
    });
  }
  const confirmBox = (msg, danger) => modal('<p>' + esc(msg) + '</p><div class="row mt"><button class="btn grow" data-m="no">' + t('cancel') +
    '</button><button class="btn grow ' + (danger ? 'danger' : 'primary') + '" data-m="yes">' + t('yes') + '</button></div>').then((v) => v === 'yes');
  const promptBox = (title, value) => modal('<h3>' + esc(title) + '</h3><input class="field mt" value="' + esc(value || '') + '" maxlength="60"><div class="row mt"><button class="btn grow" data-m="__cancel__">' +
    t('cancel') + '</button><button class="btn grow primary" data-m="ok">' + t('ok') + '</button></div>').then((v) => (v === null || v === '__cancel__' ? null : v));
  const online = () => navigator.onLine !== false;

  function appbar(title, o) {
    o = o || {};
    return '<div class="appbar">' + (o.back === false ? '' : '<button class="iconbtn" data-a="back" aria-label="' + t('back') + '">' + icon('arrowl') + '</button>') +
      '<h1>' + esc(title) + '</h1>' + (o.right || '') + '</div>';
  }
  function bar(p) { return '<div class="bar"><i style="width:' + Math.max(0, Math.min(100, p)) + '%"></i></div>'; }
  const chip = (txt, cls, ic) => '<span class="chip ' + (cls || '') + '">' + (ic ? icon(ic, 'sm') : '') + esc(txt) + '</span>';
  function moduleOf(id) { const m = Content.manifest.modules.find((x) => x.id === id); return m ? m.title : ''; }

  /* ---------- routing ---------- */
  const TABS = [['home', 'home', 'home'], ['path', 'course', 'book'], ['play', 'play', 'code'], ['progress', 'progress', 'chart'], ['settings', 'settings', 'sliders']];
  function renderTabs(active) {
    const tb = document.getElementById('tabbar');
    if (!active) { tb.hidden = true; $screen().classList.remove('has-tab'); return; }
    tb.hidden = false; $screen().classList.add('has-tab');
    tb.innerHTML = TABS.map(([r, k, ic]) => '<a href="#/' + r + '" data-a="tab" data-r="' + r + '" class="' + (r === active ? 'on' : '') + '"><span class="pill">' + icon(ic) + '</span>' + t(k) + '</a>').join('');
  }
  const ROUTES = [
    [/^#\/home$/, home], [/^#\/path$/, pathScreen], [/^#\/lesson\/(lesson-\d+)$/, lessonScreen], [/^#\/play$/, playScreen],
    [/^#\/files$/, filesScreen], [/^#\/file\/(.+)$/, fileScreen], [/^#\/console$/, consoleScreen], [/^#\/progress$/, progressScreen],
    [/^#\/downloads$/, downloadsScreen], [/^#\/settings$/, settingsScreen], [/^#\/update$/, updateScreen], [/^#\/onboarding$/, onboardingScreen],
  ];
  let renderToken = 0;
  async function render(keepScroll) {
    const token = ++renderToken;
    const hash = location.hash || '#/home';
    const scr = $screen();
    const prevTop = keepScroll ? scr.scrollTop : 0;
    if (S.cleanup) { try { S.cleanup(); } catch (e) { /* ignore */ } S.cleanup = null; }
    for (const [re, fn] of ROUTES) {
      const m = re.exec(hash);
      if (!m) continue;
      let out;
      try { out = await fn.apply(null, m.slice(1)); } catch (e) { console.error(e); out = { html: '<div class="empty">' + icon('info') + '<p>' + t('error_generic') + '</p></div>' }; }
      if (token !== renderToken || !out) return;
      scr.innerHTML = out.html;
      renderTabs(out.tab);
      scr.classList.toggle('has-dock', !!out.dock);
      scr.scrollTop = keepScroll ? prevTop : 0;
      if (out.after) out.after();
      S.routeKey = hash;
      return;
    }
    location.replace('#/home');
  }
  const refresh = () => render(true);
  window.addEventListener('hashchange', () => render(false));

  /* ---------- onboarding ---------- */
  function onboardingScreen() {
    const slides = ['onb1', 'onb2', 'onb3', 'onb4', 'onb5'];
    let i = 0;
    const draw = () => {
      $screen().innerHTML = '<div class="onb"><div class="row" style="justify-content:flex-end"><button class="btn sm" data-a="onbSkip">' + t('skip') + '</button></div>' +
        '<div class="scene">' + Art.scene(i) + '</div><h1>' + t(slides[i] + '_t') + '</h1><p class="sub">' + t(slides[i] + '_d') + '</p>' +
        '<div class="dots">' + slides.map((_, j) => '<i class="' + (j === i ? 'on' : '') + '"></i>').join('') + '</div>' +
        '<button class="btn primary block" data-a="onbNext">' + (i === slides.length - 1 ? t('begin') : t('next')) + '</button></div>';
    };
    A.onbNext = () => { if (i < slides.length - 1) { i++; draw(); } else A.onbSkip(); };
    A.onbSkip = () => { Settings.set('onboarded', true); location.replace('#/home'); };
    return { html: '', tab: null, after: draw };
  }

  /* ---------- home ---------- */
  function greeting() { const h = new Date().getHours(); return h < 12 ? t('greet_m') : h < 18 ? t('greet_d') : t('greet_e'); }
  function weekStrip(P) {
    const today = PT.dayKey(), wd = t('wd').split(',');
    let h = '<div class="week">';
    for (let k = 6; k >= 0; k--) {
      const d = PT.addDays(today, -k), on = (P.activity[d] || 0) > 0;
      h += '<div>' + wd[new Date(d + 'T00:00:00').getDay()] + '<i class="' + (on ? 'on' : '') + (k === 0 ? ' today' : '') + '">' + (on ? icon('check') : '') + '</i></div>';
    }
    return h + '</div>';
  }
  function home() {
    const P = Progress.get(), E = Content.entries(), cs = PT.courseStats(E, P), today = PT.dayKey();
    const ni = PT.nextLessonIndex(E, P), next = E[ni];
    const goal = Settings.get('goal'), dp = PT.dailyProgress(P, goal);
    const streak = PT.currentStreak(P.streak, today), lv = PT.levelFor(P.points);
    const updates = Content.updateCount(), newN = Content.newIds.size;
    let banners = '';
    if (!online()) banners += '<div class="banner">' + icon('wifioff') + '<span>' + t('offline') + '</span></div>';
    if (Content.needsAppUpdate) banners += '<a class="banner info" href="#/update">' + icon('info') + '<span class="grow">' + t('need_app_update') + '</span></a>';
    if (Content.downloadedCount() === 0) banners += '<a class="banner info" href="#/downloads">' + icon('download') + '<span class="grow">' + t('banner_first') + '</span>' + icon('right') + '</a>';
    else {
      if (newN) banners += '<a class="banner info" href="#/downloads">' + icon('zap') + '<span class="grow">' + t('banner_new') + ' (' + newN + ')</span>' + icon('right') + '</a>';
      if (updates) banners += '<a class="banner info" href="#/downloads">' + icon('refresh') + '<span class="grow">' + t('banner_upd') + ' (' + updates + ')</span>' + icon('right') + '</a>';
    }
    const recentId = P.recent[0], recent = recentId && Content.entry(recentId);
    const ch = PT.dailyChallenge(E, P);
    const mods = Content.manifest.modules.map((m, mi) => {
      const L = E.filter((e) => e.module === m.id), d = L.filter((e) => P.completed[e.id]).length;
      return '<div class="mod" data-a="goPath"><div class="n">' + (mi + 1) + '</div><h3>' + esc(m.title) + '</h3><div class="small muted mt" style="margin-top:6px">' + d + '/' + L.length + ' ' + t('lessons_word') + '</div><div class="mt" style="margin-top:8px">' + bar(L.length ? d / L.length * 100 : 0) + '</div></div>';
    }).join('');
    return { tab: 'home', html:
      '<div class="top"><div><div class="hi">' + greeting() + '</div><h1>' + t('welcome') + '</h1></div><div class="row" style="gap:8px"><span class="pill fire">' + icon('flame', 'sm') + streak + '</span><span class="pill xp">' + icon('star', 'sm') + P.points + '</span></div></div>' +
      '<div style="height:12px"></div>' + banners +
      (next ? '<div class="card hero"><div class="txt"><div class="small muted">' + esc(moduleOf(next.module)) + '</div><h2 style="margin:4px 0 12px;font-size:22px">' + esc(next.title) + '</h2>' +
        bar(cs.percent) + '<div class="small muted" style="margin:8px 0 16px">' + t('lesson_n') + ' ' + next.number + ' · ' + cs.done + ' ' + t('of') + ' ' + cs.total + '</div>' +
        '<button class="btn light block" data-a="open" data-id="' + next.id + '">' + icon('play', 'sm') + t('continue') + '</button></div>' + Art.mascot({ cls: 'hero-art' }) + '</div>' : '') +
      '<div class="card"><div class="row between"><h3>' + icon('flame', 'sm') + ' ' + t('your_week') + '</h3><span class="chip y">' + Math.min(dp.done, goal) + '/' + goal + ' ' + t('goal_unit') + '</span></div><div class="mt">' + weekStrip(P) + '</div>' +
      (dp.reached ? '<p class="small ok center" style="margin:12px 0 0">' + t('goal_reached') + '</p>' : '') + '</div>' +
      '<div class="card"><div class="row"><div class="ring" style="--p:' + lv.pct + ';--c:var(--gold)"><b>' + lv.level + '</b></div><div class="grow"><div class="small muted">' + t('level_card') + '</div><h3 style="font-size:18px">' + t('lvl' + lv.level) + '</h3>' +
      '<div class="small muted" style="margin:2px 0 8px">' + (lv.next ? (lv.next - P.points) + ' ' + t('pts') + ' ' + t('xp_next') : '★') + '</div>' + bar(lv.pct) + '</div></div></div>' +
      (ch ? '<div class="card tap" data-a="open" data-id="' + ch.id + '"><div class="row"><div class="li ico" style="border:0;padding:0;background:rgba(255,111,181,.16);color:var(--pink)">' + icon('zap') + '</div><div class="grow"><h3>' + t('challenge') + '</h3><div class="small muted">' + esc(ch.title) + ' · ' + t('challenge_d') + '</div></div>' + icon('right') + '</div></div>' : '') +
      '<h2>' + t('modules') + '</h2><div class="hscroll">' + mods + '</div>' +
      (recent && (!next || recent.id !== next.id) ? '<h2>' + t('recent') + '</h2>' + lessonRow(recent) : '') };
  }
  A.goPath = () => { location.replace('#/path'); };
  function lessonRow(e) {
    const P = Progress.get(), st = Content.status(e), done = !!P.completed[e.id];
    return '<div class="card tap" data-a="open" data-id="' + e.id + '"><div class="row"><div class="li ico" style="border:0;padding:0;' + (done ? 'background:rgba(53,224,161,.18);color:var(--green)' : '') + '">' + (done ? icon('check') : e.number) + '</div>' +
      '<div class="grow"><h3>' + esc(e.title) + '</h3><div class="small muted">' + esc(moduleOf(e.module)) + '</div></div>' +
      (Content.newIds.has(e.id) ? chip(t('new_badge'), 'p') : '') + (st === 'ok' ? '' : icon('download', 'sm')) + '</div></div>';
  }

  /* ---------- path (winding trail) ---------- */
  const OFFS = [0, 44, 68, 44, 0, -44, -68, -44];
  function pathScreen() {
    const P = Progress.get(), E = Content.entries(), cs = PT.courseStats(E, P), ni = PT.nextLessonIndex(E, P);
    let html = appbar(t('course'), { back: false, right: '<span class="pill">' + cs.done + '/' + cs.total + '</span><a class="iconbtn" href="#/downloads" aria-label="' + t('downloads') + '">' + icon('download') + '</a>' });
    Content.manifest.modules.forEach((m, mi) => {
      const list = E.filter((e) => e.module === m.id);
      if (!list.length) return;
      const d = list.filter((e) => P.completed[e.id]).length;
      html += '<div class="mbanner"><div class="k">' + t('module_word') + ' ' + (mi + 1) + '</div><h3>' + esc(m.title) + '</h3>' + bar(d / list.length * 100) + '</div><div class="trail">';
      list.forEach((e, k) => {
        const idx = E.indexOf(e), unlocked = PT.isUnlocked(E, idx, P), done = !!P.completed[e.id], cur = idx === ni && !done, st = Content.status(e);
        const cls = done ? 'done' : !unlocked ? 'lock' : cur ? 'cur' : '';
        const inner = done ? icon('check') : !unlocked ? icon('lock') : cur ? icon('play') : e.number;
        html += '<div class="stop" style="transform:translateX(' + OFFS[k % OFFS.length] + 'px)">' + (cur ? '<span class="start">' + t('start_tag') + '</span>' : '') +
          '<button class="node ' + cls + '" data-a="' + (unlocked ? 'open' : 'locked') + '" data-id="' + e.id + '" aria-label="' + esc(e.title) + '">' + inner +
          (unlocked && st !== 'ok' ? '<span class="dl">' + icon(st === 'update' ? 'refresh' : 'cloud') + '</span>' : '') + '</button>' +
          '<div class="cap ' + (unlocked ? '' : 'lock') + '">' + esc(e.title) + '<small>' + (Content.newIds.has(e.id) ? t('new_badge') + ' · ' : '') + e.points + ' ' + t('pts') + '</small></div></div>';
      });
      html += '</div>';
    });
    return { html, tab: 'path' };
  }
  A.locked = () => { Sound.play('bad'); toast(t('locked_toast')); };

  /* ---------- lesson ---------- */
  const codeBlock = (code, name) => '<div class="win"><div class="bar2"><i></i><i></i><i></i><span>' + esc(name || 'main.py') + '</span></div><div class="codewrap"><pre class="ln">' +
    Array.from({ length: code.split('\n').length }, (_, i) => i + 1).join('\n') + '</pre><pre class="code">' + PT.highlight(code) + '</pre></div></div>';
  const rich = (arr) => arr.map((x) => '<p>' + PT.richText(x) + '</p>').join('');
  const list = (arr, cls) => '<ul class="' + (cls || '') + '">' + arr.map((x) => '<li>' + PT.richText(x) + '</li>').join('') + '</ul>';

  async function lessonScreen(id) {
    const E = Content.entries(), idx = E.findIndex((e) => e.id === id), entry = E[idx], P = Progress.get();
    if (!entry) return { html: appbar('') + '<div class="empty">' + icon('info') + '</div>' };
    if (!PT.isUnlocked(E, idx, P)) { setTimeout(() => toast(t('locked_toast')), 50); location.replace('#/path'); return null; }
    const data = await Content.getLesson(id);
    Progress.touchRecent(id); Content.markSeen(id);
    const bm = P.bookmarks.includes(id);
    if (!data) {
      const busy = S.dl[id] === 'busy', fail = S.dl[id] === 'fail';
      return { tab: null, html: appbar(t('lesson_n') + ' ' + entry.number) + '<div class="card center"><div style="width:120px;margin:0 auto">' + Art.mascot({}) + '</div><h2 style="margin-top:6px">' + esc(entry.title) + '</h2><p class="muted">' + t('not_dl_d') + '</p>' +
        (fail ? '<p class="err small">' + t('dl_failed') + '</p>' : '') + (!online() ? '<p class="small muted">' + t('offline') + '</p>' : '') +
        '<button class="btn primary block" data-a="dl" data-id="' + id + '" ' + (busy ? 'disabled' : '') + '>' + (busy ? '<span class="spin"></span>' + t('loading') : icon('download', 'sm') + (fail ? t('retry') : t('download_lesson'))) + ' · ' + fmtBytes(entry.size) + '</button></div>' };
    }
    const ex = data.exercise, done = !!P.completed[id];
    const showStdin = ex.tests.some((x) => x.stdin);
    S.lesson = { id, data, entry, editor: null, tab: 'code', fails: 0, busy: false, stage: 0, exercisePassed: false };
    S.quiz = null;
    const head = '<div class="lhead"><button class="iconbtn" data-a="back" aria-label="' + t('close') + '">' + icon('x') + '</button><div class="seg4">' +
      [t('st_theory'), t('st_examples'), t('st_practice'), t('st_quiz')].map((n, i) => '<button data-a="stageGo" data-s="' + i + '" class="' + (i === 0 ? 'on' : '') + '" aria-label="' + esc(n) + '"></button>').join('') + '</div>' +
      '<button class="iconbtn ' + (bm ? 'on' : '') + '" data-a="bookmark" data-id="' + id + '" aria-label="' + t('bookmark') + '">' + icon('bookmark') + '</button></div>';
    const theory = '<div class="stagename">' + t('st_theory') + '</div><div class="row wrap mb">' + chip(moduleOf(data.module), 'p', 'layers') + chip(t('lesson_n') + ' ' + data.number, '') + chip(data.points + ' ' + t('pts'), 'y', 'star') +
      '<span id="donechip">' + (done ? chip(t('lesson_done'), 'g', 'check') : '') + '</span></div>' +
      '<h1>' + esc(data.title) + '</h1><p class="muted" style="margin-top:8px;font-size:16.5px">' + esc(data.description) + '</p>' +
      '<div class="sec goal" style="margin-top:16px"><div class="label">' + icon('target', 'sm') + t('objectives') + '</div>' + list(data.objectives, 'checks') + '</div>' +
      '<div class="sec explain"><div class="label">' + icon('book', 'sm') + t('explanation') + '</div>' + rich(data.explanation) + '</div>' +
      '<div class="sec note"><div class="label">' + icon('bulb', 'sm') + t('notes') + '</div>' + list(data.notes) + '</div>' +
      '<div class="sec mistake"><div class="label">' + icon('alert', 'sm') + t('mistakes') + '</div>' + list(data.mistakes) + '</div>' +
      '<div class="center mt"><button class="btn sm danger" data-a="rmLesson" data-id="' + id + '">' + icon('trash', 'sm') + t('remove_lesson') + '</button></div>';
    let examples = '<div class="stagename">' + t('st_examples') + '</div>';
    data.examples.forEach((x, i) => {
      examples += '<div class="sec"><div class="label">' + icon('code', 'sm') + t('example') + ' ' + (i + 1) + '</div><h3>' + esc(x.title) + '</h3>' + codeBlock(x.code, 'example_' + (i + 1) + '.py') +
        (x.stdin ? '<div class="small muted">' + t('stdin') + ':</div><pre class="out wait">' + esc(x.stdin) + '</pre>' : '') +
        (x.steps.length ? '<ol class="steps">' + x.steps.map((st) => '<li>' + PT.richText(st) + '</li>').join('') + '</ol>' : '') +
        '<div class="small muted mt">' + t('expected_output') + ':</div><pre class="out">' + esc(x.output.replace(/\n$/, '') || t('no_output')) + '</pre>' +
        '<div id="exout' + i + '"></div></div>';
    });
    const practice = '<div class="stagename">' + t('st_practice') + '</div><div class="sec task" id="exsec"><div class="label">' + icon('terminal', 'sm') + t('exercise') + '</div><p style="font-size:16px">' + PT.richText(ex.prompt) + '</p>' +
      '<div class="tabs2"><button data-a="extab" data-tab="code" class="on">' + t('code_tab') + '</button><button data-a="extab" data-tab="result">' + t('result_tab') + '</button></div>' +
      '<div id="tab-code"><div id="edhost"></div>' + (showStdin ? '<div class="small muted mt">' + t('stdin') + ' — ' + t('stdin_hint') + '</div><textarea class="stdin" id="stdin" spellcheck="false">' + esc(ex.tests[0].stdin) + '</textarea>' : '') +
      '<div class="small muted mt">' + t('expected_output') + ':</div><pre class="out wait">' + esc(ex.tests[0].expected.replace(/\n$/, '') || t('no_output')) + '</pre>' +
      '<div id="hintbox" class="sec note mt" hidden>' + PT.richText(ex.hint) + '</div></div>' +
      '<div id="tab-result" hidden><div id="resbox"><div class="muted small">' + t('no_output') + '</div></div></div>' +
      '<div class="toolbar"><button class="iconbtn" data-a="hint" aria-label="' + t('hint') + '">' + icon('help') + '</button><button class="iconbtn" data-a="exReset" aria-label="' + t('reset') + '">' + icon('refresh') + '</button>' +
      '<button class="btn primary" id="runbtn" data-a="exSubmit">' + icon('play', 'sm') + t('run') + '</button></div><div id="solbox"></div></div>';
    const html = head + '<div class="stage" data-s="0">' + theory + '</div><div class="stage" data-s="1" hidden>' + examples + '</div><div class="stage" data-s="2" hidden>' + practice + '</div>' +
      '<div class="stage" data-s="3" hidden><div class="stagename">' + t('st_quiz') + '</div><div class="sec" id="quizbox"></div></div>' +
      '<div class="dock"><button class="btn back" id="dback" data-a="stagePrev" hidden aria-label="' + t('prev') + '">' + icon('left') + '</button><button class="btn primary" id="dnext" data-a="stageNext">' + t('continue') + icon('right', 'sm') + '</button></div>';
    return { tab: null, dock: true, html, after: async () => {
      const draft = await DB.getKV('kv', 'draft:' + id, null);
      let timer;
      S.lesson.editor = createEditor($('#edhost'), { value: draft != null ? draft : ex.starter, height: 240,
        onChange: (v) => { clearTimeout(timer); timer = setTimeout(() => DB.setKV('kv', 'draft:' + id, v), 600); } });
      renderQuiz();
    } };
  }
  function showStage(n) {
    const L = S.lesson; if (!L) return;
    L.stage = Math.max(0, Math.min(3, n));
    document.querySelectorAll('.stage').forEach((el) => { el.hidden = Number(el.dataset.s) !== L.stage; });
    document.querySelectorAll('.seg4 button').forEach((b, i) => { b.className = i < L.stage ? 'done' : i === L.stage ? 'on' : ''; });
    const back = $('#dback'), next = $('#dnext');
    if (back) back.hidden = L.stage === 0;
    if (next) {
      next.innerHTML = L.stage === 3 ? t('finish') : t('continue') + icon('right', 'sm');
      // The exercise has its own Run/Check button; no redundant Continue button.
      next.hidden = L.stage === 2;
    }
    $screen().scrollTop = 0;
  }
  A.stageNext = () => { if (S.lesson.stage === 2) return; if (S.lesson.stage < 3) showStage(S.lesson.stage + 1); else location.hash = '#/path'; };
  A.stagePrev = () => showStage(S.lesson.stage - 1);
  A.stageGo = (d) => showStage(Number(d.s));
  function celebrate(entry) {
    const E = Content.entries(), next = E[E.findIndex((e) => e.id === entry.id) + 1];
    const d = document.createElement('div');
    d.className = 'cele';
    d.innerHTML = '<div class="mas">' + Art.mascot({ mood: 'cheer' }) + '</div><h1>' + t('cel_title') + '</h1><p class="muted" style="position:relative;margin:0">' + esc(entry.title) + '</p>' +
      '<div class="xp">+' + entry.points + ' ' + t('pts') + '</div><div class="btns">' + (next ? '<button class="btn primary" data-m="next">' + t('next_lesson') + '</button>' : '') + '<button class="btn" data-m="list">' + t('to_list') + '</button></div>';
    document.body.appendChild(d);
    const c = Art.confetti(); if (c) d.prepend(c);
    Sound.play('ok');
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      d.remove(); location.hash = b.dataset.m === 'next' && next ? '#/lesson/' + next.id : '#/path';
    });
  }
    function renderRun(res) {
    if (res.unavailable) return '<div class="banner">' + icon('info') + '<span>' + t('no_runtime') + '</span></div>';
    let h = '<pre class="out ' + (res.ok ? '' : 'bad') + '">' + esc(res.stdout || (res.ok ? t('no_output') : '')) + '</pre>';
    if (res.timedOut) h += '<p class="err mt">' + t('timeout') + '</p>';
    if (res.stopped) h += '<p class="err mt">' + t('stopped') + '</p>';
    if (res.error) {
      h += '<div class="sec mistake mt"><div class="label">' + icon('x', 'sm') + esc(res.error.type) + (res.error.line ? ' · ' + t('error_in_line') + ' ' + res.error.line : '') + '</div>' +
        '<p>' + esc(PT.errorHint(res.error.type)) + '</p><pre class="out bad">' + esc(res.error.traceback) + '</pre></div>';
    }
    if (res.truncated) h += '<p class="small muted">…</p>';
    return h;
  }
  function setBusy(b) {
    S.lesson && (S.lesson.busy = b);
    const run = $('#runbtn');
    if (run) { run.innerHTML = b ? icon('stop', 'sm') + t('stop') : icon('play', 'sm') + t('run'); run.dataset.a = b ? 'exStop' : 'exSubmit'; }
    if (run) run.disabled = b;
  }
  A.extab = (d) => {
    S.lesson.tab = d.tab;
    $('#tab-code').hidden = d.tab !== 'code'; $('#tab-result').hidden = d.tab !== 'result';
    document.querySelectorAll('.tabs2 button').forEach((b) => b.classList.toggle('on', b.dataset.tab === d.tab));
  };
  A.hint = () => { const h = $('#hintbox'); h.hidden = !h.hidden; A.extab({ tab: 'code' }); };
  A.exReset = async () => { if (await confirmBox(t('reset') + '?')) S.lesson.editor.setValue(S.lesson.data.exercise.starter); };
  A.exStop = () => Py.stop();
  A.exRun = async () => {
    const L = S.lesson; if (L.busy) return;
    A.extab({ tab: 'result' }); setBusy(true);
    $('#resbox').innerHTML = '<div class="row"><span class="spin"></span>' + t('running') + '</div>';
    try {
      const st = $('#stdin'), res = await Py.run(L.editor.getValue(), st ? st.value : '', 10);
      if (!res.unavailable) { Progress.get().stats.runs++; Progress.save(); }
      $('#resbox') && ($('#resbox').innerHTML = renderRun(res));
    } catch (e) { $('#resbox').innerHTML = '<p class="err">' + t('error_generic') + '</p>'; }
    setBusy(false);
  };
  A.exSubmit = async () => {
    const L = S.lesson; if (L.busy) return;
    const ex = L.data.exercise, code = L.editor.getValue(), P = Progress.get();
    A.extab({ tab: 'result' }); setBusy(true);
    $('#resbox').innerHTML = '<div class="row"><span class="spin"></span>' + t('running') + '</div>';
    const runs = [];
    try {
      for (const tc of ex.tests) {
        const r = await Py.run(code, tc.stdin, 10);
        if (r.unavailable) { $('#resbox').innerHTML = renderRun(r); setBusy(false); return; }
        runs.push(r);
        if (r.timedOut || r.stopped) break;
      }
    } catch (e) { $('#resbox').innerHTML = '<p class="err">' + t('error_generic') + '</p>'; setBusy(false); return; }
    P.stats.runs++;
    const chk = PT.checkExercise(ex, code, runs);
    const wasDone = !!P.completed[L.id];
    const gained = PT.recordExercise(P, L.id, chk.passed);
    L.exercisePassed = !!chk.passed;
    Progress.save();
    let h = '<div class="sec ' + (chk.passed ? 'goal' : 'mistake') + '"><div class="label">' + icon(chk.passed ? 'check' : 'x', 'sm') + (chk.passed ? t('exercise_ok') : t('test_failed')) + '</div>';
    chk.tests.forEach((r, i) => {
      h += '<div class="test">' + icon(r.passed ? 'check' : 'x', 'sm') + '<div class="grow"><b>' + (r.passed ? t('test_passed') : t('test_failed')) + '</b> #' + (i + 1) + '</div></div>';
    });
    if (chk.missing.length) h += '<p class="small err">' + t('must_use') + ' ' + chk.missing.map((m) => '<code>' + esc(m) + '</code>').join(' ') + '</p>';
    const bad = chk.tests.findIndex((r) => !r.passed);
    if (bad >= 0) {
      const r = chk.tests[bad], tc = ex.tests[bad];
      h += (tc.stdin ? '<div class="small muted">' + t('stdin') + ':</div><pre class="out wait">' + esc(tc.stdin) + '</pre>' : '') +
        '<div class="small muted mt">' + t('expected_s') + ':</div><pre class="out">' + esc(tc.expected) + '</pre><div class="small muted mt">' + t('got_s') + ':</div>' + renderRun(runs[bad] || { ok: false, stdout: '' });
    }
    $('#resbox').innerHTML = h + '</div>';
    if (chk.passed) {
      Sound.play('ok');
      if (gained) toast('+' + gained + ' ' + t('pts'), 'ok');
      if (P.completed[L.id] && !wasDone) { $('#donechip').innerHTML = chip(t('lesson_done'), 'g', 'check'); setTimeout(() => celebrate(L.entry), 900); }
      // A successful exercise proceeds directly to the quiz; no extra Continue/Submit button.
      setTimeout(() => { if (S.lesson === L && L.exercisePassed) showStage(3); }, 350);
    } else {
      Sound.play('bad'); L.fails++;
      if (L.fails >= 2) $('#solbox').innerHTML = '<button class="btn sm" data-a="exSolution">' + icon('help', 'sm') + t('show_solution') + '</button>';
    }
    setBusy(false);
  };
  A.exSolution = () => {
    const ex = S.lesson.data.exercise;
    $('#solbox').innerHTML = '<div class="small muted">' + t('solution') + ':</div>' + codeBlock(ex.solution) + '<button class="btn sm mt" data-a="useSolution">' + t('code_tab') + '</button>';
  };
  A.useSolution = () => { S.lesson.editor.setValue(S.lesson.data.exercise.solution); A.extab({ tab: 'code' }); };


  /* quiz */
  function renderQuiz() {
    const box = $('#quizbox'); if (!box) return;
    const L = S.lesson, P = Progress.get(), q = S.quiz, best = P.quiz[L.id];
    const head = '<div class="label">' + icon('award', 'sm') + t('quiz') + '</div>';
    if (!q) {
      box.innerHTML = head + (best ? '<p class="muted small">' + t('score') + ': ' + best.best + '/' + best.total + '</p>' : '') +
        '<button class="btn primary block" data-a="quizStart">Оғози викторина</button>';
      return;
    }
    if (q.finished) {
      const s = q.summary;
      box.innerHTML = head + '<div class="center"><div class="ring" style="--p:' + Math.round(s.ratio * 100) + ';margin:6px auto"><b>' + s.correct + '/' + s.total + '</b></div><h3 class="mt">' + (s.passed ? t('quiz_pass') : t('quiz_fail')) + '</h3>' +
        '<p class="muted">Дуруст: ' + s.correct + ' · Хато: ' + (s.total - s.correct) + '</p>' +
        (q.gained ? '<p class="ok">+' + q.gained + ' ' + t('pts') + '</p>' : '') +
        (s.passed ? '' : '<p class="muted">Барои гирифтани хол ҳамаи саволҳоро дуруст ҷавоб деҳ.</p>') +
        '<button class="btn primary block mt" data-a="quizStart">Аз сар оғоз кардан</button></div>';
      return;
    }
    const it = q.items[q.i], n = q.items.length;
    box.innerHTML = head + '<div class="row between small muted"><span>' + t('question_of') + ' ' + (q.i + 1) + '/' + n + '</span></div><div class="mt">' + bar(q.i / n * 100) + '</div>' +
      '<h3 class="mt">' + PT.richText(it.q) + '</h3>' +
      it.options.map((o, i) => {
        let cls = '';
        if (q.picked != null) cls = o.correct ? 'good' : (i === q.picked ? 'bad' : '');
        return '<button class="opt ' + cls + '" data-a="qpick" data-i="' + i + '" ' + (q.picked != null ? 'disabled' : '') + '>' + esc(o.text) + '</button>';
      }).join('') +
      (q.picked != null ? '<div class="sec ' + (q.lastCorrect ? 'goal' : 'mistake') + '"><div class="label">' +
        (q.lastCorrect ? t('correct') : t('wrong')) + '</div>' + PT.richText(it.explanation) + '</div>' +
        '<button class="btn primary block" data-a="qnext">' + (q.i === n - 1 ? 'Анҷом' : 'Минбаъд') + '</button>' : '');
  }
  function startQuiz(items, practice) {
    S.quiz = { items: PT.buildQuiz(items), i: 0, results: [], picked: null, lastCorrect: false, finished: false, practice, wrongAttempts: 0, gained: 0 };
    renderQuiz();
  }
  A.quizStart = () => startQuiz(S.lesson.data.quiz, false);
  A.qretry = () => {
    const q = S.quiz;
    if (!q || q.finished) return;
    q.picked = null;
    renderQuiz();
  };
  A.qnext = () => {
    const q = S.quiz;
    if (!q || q.finished || q.picked == null) return;
    if (q.i < q.items.length - 1) {
      q.i++; q.picked = null; q.lastCorrect = false; renderQuiz(); return;
    }
    q.finished = true;
    q.summary = PT.scoreQuiz(q.results);
    q.summary.passed = q.summary.correct === q.summary.total && q.summary.total > 0;
    if (!q.practice && q.summary.passed) {
      const P = Progress.get(), was = !!P.completed[S.lesson.id];
      q.gained = PT.recordQuiz(P, S.lesson.id, q.summary); Progress.save();
      if (P.completed[S.lesson.id] && !was) {
        $('#donechip').innerHTML = chip(t('lesson_done'), 'g', 'check');
        const en = S.lesson.entry; setTimeout(() => celebrate(en), 900);
      }
    }
    renderQuiz();
  };
  A.qpick = (d) => {
    const q = S.quiz; if (!q || q.finished || q.picked != null) return;
    q.picked = Number(d.i);
    const ok = !!q.items[q.i].options[q.picked].correct;
    q.results[q.i] = ok;
    q.lastCorrect = ok;
    if (!ok) q.wrongAttempts = (q.wrongAttempts || 0) + 1;
    Sound.play(ok ? 'ok' : 'bad');
    renderQuiz();
  };
  /* ---------- downloads ---------- */
  async function doDownload(id) {
    S.dl[id] = 'busy'; refresh();
    try { await Content.download(id); delete S.dl[id]; toast(t('dl_done'), 'ok'); }
    catch (e) { S.dl[id] = 'fail'; toast(t('dl_failed') + (e.message === 'hash' ? ': ' + t('hash_bad') : e.message === 'schema' ? ': ' + t('schema_bad') : ''), 'err'); }
    refresh();
  }
  A.dl = (d) => doDownload(d.id);
  A.rmLesson = async (d) => {
    if (!(await confirmBox(t('remove_confirm'), true))) return;
    await Content.remove(d.id); toast(t('removed')); location.hash = '#/path';
  };
  A.dlAll = async () => {
    const todo = Content.entries().filter((e) => Content.status(e) !== 'ok' && S.dl[e.id] !== 'busy');
    for (const e of todo) { S.dl[e.id] = 'busy'; }
    refresh();
    for (const e of todo) {
      try { await Content.download(e.id); delete S.dl[e.id]; } catch (err) { S.dl[e.id] = 'fail'; }
      refresh();
    }
    const failed = Object.values(S.dl).filter((v) => v === 'fail').length;
    toast(failed ? t('dl_failed') + ': ' + failed : t('dl_done'), failed ? 'err' : 'ok');
  };
  A.sync = async () => {
    S.sync = 'busy'; refresh();
    const r = await Content.sync();
    S.sync = null;
    toast(r.ok ? t('sync_ok') : r.error === 'need-app-update' ? t('need_app_update') : t('sync_fail'), r.ok ? 'ok' : 'err');
    refresh();
  };
  async function downloadsScreen() {
    const E = Content.entries(), failed = E.filter((e) => S.dl[e.id] === 'fail').length;
    let free = '';
    try {
      if (window.AndroidApp && AndroidApp.freeBytes) free = fmtBytes(Number(AndroidApp.freeBytes()));
      else if (navigator.storage && navigator.storage.estimate) { const s = await navigator.storage.estimate(); free = fmtBytes(Math.max(0, (s.quota || 0) - (s.usage || 0))); }
    } catch (e) { /* ignore */ }
    const src = { remote: 'src_remote', cache: 'src_cache', bundled: 'src_bundled' }[Content.source];
    let html = appbar(t('downloads'), { right: '<button class="iconbtn" data-a="sync" aria-label="' + t('check_updates') + '">' + icon('refresh') + '</button>' }) +
      (!online() ? '<div class="banner">' + icon('wifioff') + '<span>' + t('offline') + '</span></div>' : '') +
      '<div class="card"><div class="grid2"><div class="stat"><b>' + Content.downloadedCount() + '/' + E.length + '</b><span>' + t('downloaded') + ' · ' + fmtBytes(Content.downloadedBytes()) + '</span></div>' +
      '<div class="stat"><b>' + (free || '—') + '</b><span>' + t('storage_free') + '</span></div></div>' +
      '<p class="small muted mt" style="margin-bottom:0">' + t('last_sync') + ': ' + fmtDate(Content.lastSync) + ' · ' + t(src) + (S.sync ? ' · ' + t('syncing') : '') + '</p></div>' +
      '<div class="row mb"><button class="btn primary grow" data-a="dlAll">' + icon('download', 'sm') + t('dl_all') + '</button>' + (failed ? '<button class="btn grow" data-a="dlAll">' + t('retry_failed') + '</button>' : '') + '</div>';
    E.forEach((e) => {
      const st = Content.status(e), busy = S.dl[e.id] === 'busy', fail = S.dl[e.id] === 'fail', loc = Content.local[e.id];
      html += '<div class="card"><div class="row"><div class="grow"><h3>' + e.number + '. ' + esc(e.title) + (Content.newIds.has(e.id) ? ' ' + chip(t('new_badge'), 'p') : '') + '</h3>' +
        '<div class="small muted">' + t('size') + ': ' + fmtBytes(e.size) + ' · v' + e.version + (loc ? ' · ' + fmtDate(loc.downloadedAt) : '') + '</div>' +
        '<div class="mt">' + (fail ? chip(t('dl_failed'), 'r', 'x') : st === 'ok' ? chip(t('st_ok'), 'g', 'check') : st === 'update' ? chip(t('st_update'), 'p', 'refresh') : chip(t('st_missing'), '', 'cloud')) + '</div></div>' +
        (busy ? '<span class="spin"></span>' : st === 'ok' ? '<button class="iconbtn" data-a="rmLesson2" data-id="' + e.id + '" aria-label="' + t('delete') + '">' + icon('trash') + '</button>' :
          '<button class="iconbtn" data-a="dl" data-id="' + e.id + '" aria-label="' + t('download_lesson') + '">' + icon(fail ? 'refresh' : 'download') + '</button>') + '</div></div>';
    });
    return { html, tab: null };
  }
  A.rmLesson2 = async (d) => { if (await confirmBox(t('remove_confirm'), true)) { await Content.remove(d.id); toast(t('removed')); refresh(); } };

  /* ---------- playground ---------- */
  const SESSION = 'console';
  async function playScreen() {
    const files = (await DB.all('files')).sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 3);
    const card = (a, ic, title, d) => '<div class="card tap" data-a="' + a + '"><div class="row"><div class="li ico" style="border:0;padding:0">' + icon(ic) + '</div><div class="grow"><h3>' + title + '</h3><div class="small muted">' + d + '</div></div>' + icon('right') + '</div></div>';
    return { tab: 'play', html: appbar(t('playground'), { back: false }) + (!Py.available() ? '<div class="banner">' + icon('info') + '<span>' + t('no_runtime') + '</span></div>' : '') +
      card('newFile', 'plus', t('new_script'), t('new_script_d')) + card('goConsole', 'terminal', t('console'), t('console_d')) + card('goFiles', 'folder', t('files'), t('files_d')) +
      '<h2>' + t('recent_files') + '</h2>' + (files.length ? files.map(fileRow).join('') : '<div class="empty">' + icon('file') + '<div>' + t('no_files') + '</div></div>') };
  }
  const fileRow = (f) => '<div class="card tap" data-a="openFile" data-id="' + esc(f.id) + '"><div class="row"><div style="color:var(--primary)">' + icon('file') + '</div><div class="grow"><h3>' + esc(f.name) + '</h3><div class="small muted">' + fmtDate(f.updated) + '</div></div>' + icon('right') + '</div></div>';
  A.goConsole = () => { location.hash = '#/console'; };
  A.goFiles = () => { location.hash = '#/files'; };
  A.openFile = (d) => { location.hash = '#/file/' + encodeURIComponent(d.id); };
  async function uniqueName(name, skipId) {
    name = (name || '').trim();
    if (!/^[\p{L}\p{N}_\- .]{1,50}$/u.test(name)) return null;
    if (!/\.py$/i.test(name)) name += '.py';
    const all = await DB.all('files');
    return all.some((f) => f.name.toLowerCase() === name.toLowerCase() && f.id !== skipId) ? null : name;
  }
  A.newFile = async () => {
    const v = await promptBox(t('file_name'), 'main.py'); if (v == null) return;
    const name = await uniqueName(v); if (!name) return toast(t('name_bad'), 'err');
    const f = { id: 'f' + Date.now().toString(36), name, code: '# ' + name + '\n', updated: new Date().toISOString() };
    await DB.put('files', f); A.openFile(f);
  };
  async function filesScreen() {
    const files = (await DB.all('files')).sort((a, b) => b.updated.localeCompare(a.updated));
    return { tab: null, html: appbar(t('files'), { right: '<button class="iconbtn" data-a="newFile" aria-label="' + t('new_file') + '">' + icon('plus') + '</button>' }) +
      (files.length ? files.map((f) => '<div class="card"><div class="row"><div class="grow tapx" data-a="openFile" data-id="' + esc(f.id) + '"><h3>' + esc(f.name) + '</h3><div class="small muted">' + fmtDate(f.updated) + ' · ' + fmtBytes(new Blob([f.code]).size) + '</div></div>' +
        '<button class="iconbtn" data-a="renameFile" data-id="' + esc(f.id) + '" aria-label="' + t('rename') + '">' + icon('edit') + '</button><button class="iconbtn" data-a="delFile" data-id="' + esc(f.id) + '" aria-label="' + t('delete') + '">' + icon('trash') + '</button></div></div>').join('') :
        '<div class="empty">' + icon('folder') + '<div>' + t('no_files') + '</div></div>') };
  }
  A.renameFile = async (d) => {
    const f = await DB.get('files', d.id), v = await promptBox(t('rename_file'), f.name); if (v == null) return;
    const name = await uniqueName(v, f.id); if (!name) return toast(t('name_bad'), 'err');
    f.name = name; f.updated = new Date().toISOString(); await DB.put('files', f); refresh();
  };
  A.delFile = async (d) => { if (await confirmBox(t('delete_confirm'), true)) { await DB.del('files', d.id); refresh(); } };
  async function fileScreen(rawId) {
    const id = decodeURIComponent(rawId), f = await DB.get('files', id);
    if (!f) { location.replace('#/files'); return null; }
    S.file = { f, editor: null, busy: false, dirty: false };
    return { tab: null, html: appbar(f.name, { right: '<button class="iconbtn" data-a="fSave" aria-label="' + t('save') + '">' + icon('save') + '</button>' }) +
      '<div class="tabs2"><button data-a="ftab" data-tab="code" class="on">' + t('code_tab') + '</button><button data-a="ftab" data-tab="result">' + t('result_tab') + '</button></div>' +
      '<div id="fcode"><div id="edhost"></div><div class="small muted mt">' + t('stdin') + ' — ' + t('stdin_hint') + '</div><textarea class="stdin" id="fstdin" spellcheck="false"></textarea></div>' +
      '<div id="fres" hidden><div id="resbox"></div></div>' +
      '<div class="toolbar"><button class="btn primary" id="frun" data-a="fRun">' + icon('play', 'sm') + t('run') + '</button></div>',
    after: () => {
      let timer;
      S.file.editor = createEditor($('#edhost'), { value: f.code, height: 320, onChange: (v) => { S.file.dirty = true; clearTimeout(timer); timer = setTimeout(saveFile, 800); } });
      S.cleanup = () => { clearTimeout(timer); if (S.file && S.file.dirty) saveFile(); };
    } };
  }
  async function saveFile(show) {
    const F = S.file; if (!F) return;
    F.f.code = F.editor.getValue(); F.f.updated = new Date().toISOString(); F.dirty = false;
    await DB.put('files', F.f); if (show) toast(t('saved'), 'ok');
  }
  A.fSave = () => saveFile(true);
  A.ftab = (d) => { $('#fcode').hidden = d.tab !== 'code'; $('#fres').hidden = d.tab !== 'result'; document.querySelectorAll('.tabs2 button').forEach((b) => b.classList.toggle('on', b.dataset.tab === d.tab)); };
  A.fStop = () => Py.stop();
  A.fRun = async () => {
    const F = S.file; if (F.busy) return; F.busy = true;
    const btn = $('#frun'); btn.innerHTML = icon('stop', 'sm') + t('stop'); btn.dataset.a = 'fStop';
    A.ftab({ tab: 'result' }); $('#resbox').innerHTML = '<div class="row"><span class="spin"></span>' + t('running') + '</div>';
    await saveFile();
    try { const res = await Py.run(F.editor.getValue(), $('#fstdin').value, 10); if (!res.unavailable) { Progress.get().stats.runs++; Progress.save(); } $('#resbox').innerHTML = renderRun(res); }
    catch (e) { $('#resbox').innerHTML = '<p class="err">' + t('error_generic') + '</p>'; }
    F.busy = false; btn.innerHTML = icon('play', 'sm') + t('run'); btn.dataset.a = 'fRun';
  };
  function consoleScreen() {
    const draw = () => S.console.log.map((e) => '<div class="mb"><pre class="code"><span class="tk-kw">&gt;&gt;&gt;</span> ' + esc(e.src) + '</pre>' + (e.res ? renderRun(Object.assign({}, e.res, { ok: e.res.ok })) : '') + '</div>').join('');
    return { tab: null, html: appbar(t('console'), { right: '<button class="iconbtn" data-a="cClear" aria-label="' + t('console_clear') + '">' + icon('trash') + '</button>' }) +
      (!Py.available() ? '<div class="banner">' + icon('info') + '<span>' + t('no_runtime') + '</span></div>' : '') +
      '<div id="clog">' + draw() + '</div><textarea class="stdin" id="cin" rows="2" spellcheck="false" autocapitalize="off" autocorrect="off" placeholder="' + esc(t('console_ph')) + '"></textarea>' +
      '<div class="toolbar"><button class="btn primary" data-a="cRun">' + icon('play', 'sm') + t('run') + '</button></div>',
    after: () => { const l = $('#clog'); if (l) l.lastElementChild && l.lastElementChild.scrollIntoView(); } };
  }
  A.cClear = () => { S.console.log = []; Py.resetRepl(SESSION); refresh(); };
  A.cRun = async () => {
    const inp = $('#cin'), src = inp.value; if (!src.trim()) return;
    const res = await Py.runRepl(SESSION, src);
    S.console.log.push({ src, res });
    refresh();
  };

  /* ---------- progress ---------- */
  function progressScreen() {
    const P = Progress.get(), E = Content.entries(), cs = PT.courseStats(E, P), today = PT.dayKey(), lv = PT.levelFor(P.points);
    const days = []; for (let i = 6; i >= 0; i--) days.push(PT.addDays(today, -i));
    const max = Math.max(1, ...days.map((d) => P.activity[d] || 0));
    const ach = PT.achievementsFor(P, E), wd = t('wd').split(',');
    const kinds = { lesson: 'k_lesson', exercise: 'k_exercise', quiz: 'k_quiz' };
    return { tab: 'progress', html: appbar(t('progress'), { back: false }) +
      '<div class="card hero"><div class="row" style="position:relative"><div class="ring big" style="--p:' + lv.pct + ';--c:#fff"><b style="background:#6c4be8;color:#fff">' + lv.level + '</b></div><div class="grow"><div class="small muted">' + t('level_card') + '</div><h2 style="margin:2px 0 6px">' + t('lvl' + lv.level) + '</h2>' +
      '<div class="small muted">' + P.points + ' ' + t('pts') + (lv.next ? ' · ' + (lv.next - P.points) + ' ' + t('xp_next') : '') + '</div></div></div></div>' +
      '<div class="grid2"><div class="stat">' + icon('flame') + '<b>' + PT.currentStreak(P.streak, today) + '</b><span>' + t('streak') + ' · ' + t('best_streak') + ': ' + P.streak.best + '</span></div><div class="stat">' + icon('book') + '<b>' + cs.done + '/' + cs.total + '</b><span>' + t('lessons_done') + '</span></div>' +
      '<div class="stat">' + icon('target') + '<b>' + PT.quizAccuracy(P) + '%</b><span>' + t('accuracy') + '</span></div><div class="stat">' + icon('download') + '<b>' + Content.downloadedCount() + '</b><span>' + t('lessons_cache') + '</span></div></div>' +
      '<h2>' + t('week') + '</h2><div class="card"><div class="bars">' + days.map((d) => '<div><i style="height:' + Math.round((P.activity[d] || 0) / max * 72 + 6) + 'px"></i><span class="tiny muted">' + wd[new Date(d + 'T00:00:00').getDay()] + '</span></div>').join('') + '</div></div>' +
      '<h2>' + t('achievements') + '</h2><div class="grid3">' + ach.map((a) => '<div class="medal ' + (a.unlocked ? 'on' : '') + '"><div class="m">' + icon('trophy') + '</div><div class="small"><b>' + esc(a.title) + '</b></div><div class="tiny muted">' + esc(a.desc) + '</div></div>').join('') + '</div>' +
      '<h2>' + t('statistics') + '</h2><div class="card"><div class="li"><span class="grow">' + t('runs') + '</span><b>' + P.stats.runs + '</b></div><div class="li"><span class="grow">' + t('exercises_ok') + '</span><b>' + Object.values(P.exercises).filter((x) => x.passed).length + '</b></div><div class="li"><span class="grow">' + t('quizzes') + '</span><b>' + Object.keys(P.quiz).length + '</b></div></div>' +
      '<h2>' + t('history') + '</h2><div class="card">' + (P.history.length ? P.history.slice(0, 15).map((h) => { const e = Content.entry(h.lessonId); return '<div class="li"><div class="grow"><b>' + t(kinds[h.kind] || 'k_quiz') + '</b><div class="small muted">' + (e ? esc(e.title) : '') + ' · ' + fmtDate(h.at) + '</div></div>' + (h.points ? chip('+' + h.points, 'y') : '') + '</div>'; }).join('') : '<div class="muted small">' + t('no_history') + '</div>') + '</div>' };
  }

  /* ---------- settings ---------- */
  const seg = (name, opts, cur) => '<div class="seg">' + opts.map(([v, l]) => '<button data-a="set" data-k="' + name + '" data-v="' + v + '" class="' + (String(cur) === String(v) ? 'on' : '') + '">' + l + '</button>').join('') + '</div>';
  function settingsScreen() {
    const s = Settings.all(), repo = PT_CONFIG.GITHUB_REPO;
    return { tab: 'settings', html: appbar(t('settings'), { back: false }) +
      '<div class="card"><h3>' + icon('globe', 'sm') + ' ' + t('language') + '</h3><div class="mt">' + seg('lang', [['tk', 'Тоҷикӣ'], ['ru', 'Русский'], ['en', 'English']], s.lang) + '</div></div>' +
      '<div class="card"><h3>' + icon('moon', 'sm') + ' ' + t('theme') + '</h3><div class="mt">' + seg('theme', [['dark', t('dark')], ['light', t('light')]], s.theme) + '</div>' +
      '<div class="li mt"><span class="grow">' + icon('volume', 'sm') + ' ' + t('sound') + '</span><div class="switch ' + (s.sound ? 'on' : '') + '" role="switch" aria-checked="' + s.sound + '" data-a="toggleSound"></div></div></div>' +
      '<div class="card"><h3>' + icon('target', 'sm') + ' ' + t('daily_goal') + '</h3><div class="mt">' + seg('goal', [[1, '1'], [2, '2'], [3, '3'], [5, '5']], s.goal) + '</div></div>' +
      '<div class="card"><h3>' + icon('download', 'sm') + ' ' + t('lesson_updates') + '</h3><p class="small muted">' + t('last_sync') + ': ' + fmtDate(Content.lastSync) + '</p><div class="row"><a class="btn grow" href="#/downloads">' + t('downloads') + '</a><button class="btn grow" data-a="sync">' + t('check_updates') + '</button></div></div>' +
      '<div class="card"><h3>' + icon('refresh', 'sm') + ' ' + t('update_app') + '</h3><p class="small muted">' + t('version') + ' ' + PT_CONFIG.APP_VERSION + '</p><a class="btn block" href="#/update">' + t('check_updates') + '</a></div>' +
      '<div class="card"><h3>' + icon('save', 'sm') + ' ' + t('data') + '</h3><div class="row wrap mt"><button class="btn sm grow" data-a="exportP">' + icon('share', 'sm') + t('export') + '</button><label class="btn sm grow">' + icon('upload', 'sm') + t('import') + '<input type="file" accept="application/json,.json" hidden id="impfile"></label></div>' +
      '<button class="btn sm danger block mt" data-a="resetP">' + icon('trash', 'sm') + t('reset_all') + '</button></div>' +
      '<div class="card"><h3>' + icon('info', 'sm') + ' ' + t('about') + '</h3><p class="small muted" style="margin:6px 0 0">PythonТаҷ ' + PT_CONFIG.APP_VERSION + '<br>' + t('runtime') + ': ' + esc(Py.available() ? Py.version() || '—' : '—') + '<br>' +
      (repo && !/__GITHUB_REPO__/.test(repo) ? 'github.com/' + esc(repo) : '') + '</p></div>',
    after: () => { const f = $('#impfile'); if (f) f.addEventListener('change', importFile); } };
  }
  A.set = (d) => {
    const v = d.k === 'goal' ? Number(d.v) : d.v; Settings.set(d.k, v);
    if (d.k === 'lang') I18N.setLang(v);
    if (d.k === 'theme') document.documentElement.dataset.theme = v;
    render(true);
  };
  A.toggleSound = () => { Settings.set('sound', !Settings.get('sound')); if (Settings.get('sound')) Sound.play('ok'); render(true); };
  A.exportP = async () => {
    const text = Progress.exportJson();
    if (window.AndroidApp && AndroidApp.shareText) { AndroidApp.shareText('pythontaj-progress.json', text); toast(t('exported'), 'ok'); }
    else { try { await navigator.clipboard.writeText(text); toast(t('no_native_share'), 'ok'); } catch (e) { toast(t('error_generic'), 'err'); } }
  };
  async function importFile(ev) {
    const file = ev.target.files[0]; if (!file) return;
    try { if (file.size > 2e6) throw new Error('big'); await Progress.importJson(await file.text()); toast(t('imported'), 'ok'); render(true); }
    catch (e) { toast(t('import_bad'), 'err'); }
  }
  A.resetP = async () => { if (await confirmBox(t('reset_confirm'), true)) { await Progress.reset(); toast(t('removed')); render(true); } };

  /* ---------- app update ---------- */
  async function updateScreen() {
    const U = S.upd, repo = PT_CONFIG.GITHUB_REPO, configured = repo && !/__GITHUB_REPO__/.test(repo);
    let body;
    if (!configured) body = '<p class="muted">' + t('upd_not_configured') + '</p>';
    else if (U.state === 'checking') body = '<div class="row"><span class="spin"></span>' + t('upd_checking') + '</div>';
    else if (U.state === 'error') body = '<p class="err">' + t('upd_failed') + '</p><button class="btn block" data-a="checkUpd">' + t('retry') + '</button>';
    else if (U.state === 'ready') {
      const newer = PT.compareVersions(U.tag, PT_CONFIG.APP_VERSION) > 0;
      body = '<div class="row between"><span>' + t('latest_ver') + '</span><b>' + esc(U.tag) + '</b></div><p class="' + (newer ? '' : 'ok') + ' mt">' + (newer ? t('upd_avail') : t('up_to_date')) + '</p>' +
        (U.notes ? '<h3>' + t('notes_word') + '</h3><pre class="out wait" style="white-space:pre-wrap">' + esc(U.notes.slice(0, 1500)) + '</pre>' : '') +
        (newer && U.apk ? (window.AndroidApp && AndroidApp.installUpdate ? '<button class="btn primary block mt" data-a="installUpd" ' + (U.busy ? 'disabled' : '') + '>' + icon('download', 'sm') + t('dl_install') + '</button>' : '<p class="small muted mt">' + t('upd_native') + '</p>') : '') +
        (U.url ? '<a class="btn block mt" target="_blank" rel="noopener" href="' + esc(U.url) + '">' + t('open_release') + '</a>' : '') +
        (U.msg ? '<p class="small mt ' + (U.err ? 'err' : 'ok') + '">' + esc(U.msg) + '</p>' : '');
    } else body = '<button class="btn primary block" data-a="checkUpd">' + t('check_updates') + '</button>';
    return { tab: null, html: appbar(t('upd_title')) + '<div class="card"><div class="row between"><span>' + t('cur_ver') + '</span><b>' + PT_CONFIG.APP_VERSION + '</b></div><div class="mt">' + body + '</div></div>' };
  }
  A.checkUpd = async () => {
    const U = S.upd; U.state = 'checking'; U.msg = ''; refresh();
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 15000);
      const r = await fetch('https://api.github.com/repos/' + PT_CONFIG.GITHUB_REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' }, signal: ctl.signal });
      clearTimeout(tm);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const apk = (j.assets || []).find((a) => /\.apk$/i.test(a.name)), sha = (j.assets || []).find((a) => /\.apk\.sha256$/i.test(a.name));
      Object.assign(U, { state: 'ready', tag: String(j.tag_name || ''), notes: j.body || '', url: j.html_url, apk: apk && apk.browser_download_url, sha: sha && sha.browser_download_url });
    } catch (e) { U.state = 'error'; }
    refresh();
  };
  A.installUpd = () => {
    const U = S.upd;
    if (!U.apk || !U.sha) { U.msg = t('upd_failed'); U.err = true; return refresh(); }
    U.busy = true; U.msg = t('upd_progress') + '...'; U.err = false; refresh();
    try { AndroidApp.installUpdate(U.apk, U.sha, PT_CONFIG.GITHUB_REPO); } catch (e) { U.busy = false; U.msg = t('upd_failed'); U.err = true; refresh(); }
  };
  window.__ptNative = window.__ptNative || {};
  window.__ptNative.onUpdate = function (json) {
    try {
      const e = JSON.parse(json), U = S.upd;
      U.msg = e.stage === 'progress' ? t('upd_progress') + ' ' + e.percent + '%' : e.stage === 'verified' ? t('upd_verify') : e.stage === 'install' ? t('upd_install') : (e.message || t('upd_failed'));
      U.err = e.stage === 'error'; U.busy = e.stage !== 'error' && e.stage !== 'install';
      if (location.hash === '#/update') refresh();
    } catch (err) { /* ignore */ }
  };

  /* ---------- global actions ---------- */
  A.back = () => { if (history.length > 1) history.back(); else location.hash = '#/home'; };
  A.tab = (d, el, e) => { e.preventDefault(); location.replace('#/' + d.r); };
  A.open = (d) => { location.hash = '#/lesson/' + d.id; };
  A.bookmark = (d, el) => { const on = Progress.toggleBookmark(d.id); el.classList.toggle('on', on); };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]');
    if (!el || el.closest('.modal')) return;
    const fn = A[el.dataset.a];
    if (fn) fn(el.dataset, el, e);
  });
  window.addEventListener('online', () => { if (S.routeKey === '#/home' || S.routeKey === '#/downloads') refresh(); });
  window.addEventListener('offline', () => { if (S.routeKey === '#/home' || S.routeKey === '#/downloads') refresh(); });

  /* ---------- boot ---------- */
  async function boot() {
    const sl = document.getElementById('splash-logo'); if (sl) sl.innerHTML = LOGO; // no inline scripts (CSP)
    I18N.setLang(Settings.get('lang'));
    document.documentElement.dataset.theme = Settings.get('theme');
    const minSplash = new Promise((r) => setTimeout(r, 1500));
    try { await DB.open(); await Progress.load(); await Content.init(); }
    catch (e) { console.error(e); document.getElementById('splash').querySelector('p').textContent = t('error_generic'); return; }
    await minSplash;
    if (!Settings.get('onboarded')) location.replace('#/onboarding');
    else if (!location.hash || location.hash === '#/onboarding') location.replace('#/home');
    await render(false);
    const sp = document.getElementById('splash'); sp.style.opacity = 0; sp.style.transition = 'opacity .3s'; setTimeout(() => sp.remove(), 320);
    if (online()) Content.sync().then((r) => { if (r.ok && (S.routeKey === '#/home' || S.routeKey === '#/path')) refresh(); });
  }
  window.PTApp = { A, S, render };
  document.addEventListener('DOMContentLoaded', boot);
})();

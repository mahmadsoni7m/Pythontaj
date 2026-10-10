/* Settings (localStorage, small) and learning progress (IndexedDB). */
(function () {
  const DEFAULTS = { lang: 'tk', theme: 'dark', sound: true, goal: 2, onboarded: false };
  let settings = Object.assign({}, DEFAULTS);
  try { settings = Object.assign(settings, JSON.parse(localStorage.getItem('pt.settings') || '{}')); } catch (e) { /* ignore */ }

  window.Settings = {
    get: (k) => settings[k],
    set(k, v) { settings[k] = v; try { localStorage.setItem('pt.settings', JSON.stringify(settings)); } catch (e) { /* ignore */ } },
    all: () => Object.assign({}, settings),
  };

  let progress = PT.emptyProgress();
  let timer = null;
  window.Progress = {
    async load() {
      const p = await DB.getKV('kv', 'progress', null);
      progress = p && p.v === 1 ? Object.assign(PT.emptyProgress(), p) : PT.emptyProgress();
    },
    get: () => progress,
    save() { clearTimeout(timer); timer = setTimeout(() => DB.setKV('kv', 'progress', progress), 150); },
    flush() { clearTimeout(timer); return DB.setKV('kv', 'progress', progress); },
    async reset() { progress = PT.emptyProgress(); await this.flush(); },
    exportJson() { return JSON.stringify({ app: 'PythonTaj', exportedAt: new Date().toISOString(), progress, bookmarks: progress.bookmarks }, null, 2); },
    async importJson(text) {
      const o = JSON.parse(text);
      const p = o && o.progress;
      if (!o || o.app !== 'PythonTaj' || !p || p.v !== 1 || typeof p.completed !== 'object' || typeof p.points !== 'number') throw new Error('bad');
      progress = Object.assign(PT.emptyProgress(), p);
      await this.flush();
    },
    touchRecent(id) {
      progress.recent = [id].concat(progress.recent.filter((x) => x !== id)).slice(0, 10);
      this.save();
    },
    toggleBookmark(id) {
      const i = progress.bookmarks.indexOf(id);
      if (i >= 0) progress.bookmarks.splice(i, 1); else progress.bookmarks.push(id);
      this.save();
      return i < 0;
    },
  };

  window.Sound = {
    ctx: null,
    play(kind) {
      if (!Settings.get('sound')) return;
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        const c = this.ctx, o = c.createOscillator(), g = c.createGain();
        const f = kind === 'ok' ? [660, 880] : kind === 'bad' ? [260, 200] : [520, 520];
        o.type = 'sine'; o.connect(g); g.connect(c.destination);
        o.frequency.setValueAtTime(f[0], c.currentTime); o.frequency.setValueAtTime(f[1], c.currentTime + 0.1);
        g.gain.setValueAtTime(0.08, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.28);
        o.start(); o.stop(c.currentTime + 0.3);
      } catch (e) { /* audio not available */ }
    },
  };
})();

/* Lesson content service: manifest sync, verified downloads, offline storage (IndexedDB).
   Remote lessons are treated as DATA only: they are parsed as JSON, validated and never executed. */
(function () {
  const C = window.PT_CONFIG;

  function remoteBase() {
    const b = C.REMOTE_BASE;
    if (!b || /__REMOTE_BASE__/.test(b) || !PT.isHttps(b)) return null;
    return b.endsWith('/') ? b : b + '/';
  }
  async function fetchBytes(url) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), C.FETCH_TIMEOUT_MS || 20000);
    try {
      const r = await fetch(url, { cache: 'no-store', signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return new Uint8Array(await r.arrayBuffer());
    } finally { clearTimeout(timer); }
  }
  const decode = (u8) => new TextDecoder('utf-8').decode(u8);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const Content = {
    manifest: null,       // current manifest (remote, cached or bundled)
    source: 'bundled',    // 'remote' | 'cache' | 'bundled'
    local: {},            // id -> {version, sha256, size, downloadedAt}
    newIds: new Set(),
    lastSync: null,
    needsAppUpdate: false,

    async init() {
      const all = await DB.all('lessons');
      this.local = {};
      all.forEach((l) => { this.local[l.id] = { version: l.version, sha256: l.sha256, size: l.size, downloadedAt: l.downloadedAt }; });
      this.lastSync = await DB.getKV('meta', 'lastSync', null);
      this.newIds = new Set(await DB.getKV('meta', 'newIds', []));
      const cached = await DB.getKV('meta', 'manifest', null);
      if (cached && PT.validateManifest(cached).length === 0) { this.manifest = cached; this.source = 'cache'; }
      else await this.loadBundled();
    },
    async loadBundled() {
      const bytes = await fetchBytes('data/manifest.json');
      const m = JSON.parse(decode(bytes));
      if (PT.validateManifest(m).length) throw new Error('bundled manifest invalid');
      this.manifest = m; this.source = 'bundled';
    },
    entries() { return this.manifest ? this.manifest.lessons.slice().sort((a, b) => a.number - b.number) : []; },
    entry(id) { return this.entries().find((e) => e.id === id); },
    status(entry) { return PT.lessonStatus(entry, this.local); },
    downloadedCount() { return Object.keys(this.local).length; },
    downloadedBytes() { return Object.values(this.local).reduce((s, l) => s + (l.size || 0), 0); },
    updateCount() { return this.entries().filter((e) => this.status(e) === 'update').length; },

    /** Checks the remote manifest. Never throws; returns {ok, source, diff, error}. */
    async sync() {
      const base = remoteBase();
      if (!base) return { ok: false, source: this.source, error: 'not-configured' };
      try {
        const bytes = await fetchBytes(base + 'data/manifest.json');
        const m = JSON.parse(decode(bytes));
        const errs = PT.validateManifest(m);
        if (errs.length) throw new Error('manifest: ' + errs.slice(0, 3).join(','));
        if (m.minAppContent > PT.SUPPORTED_SCHEMA || m.contentSchema > PT.SUPPORTED_SCHEMA) {
          this.needsAppUpdate = true;
          return { ok: false, source: this.source, error: 'need-app-update' };
        }
        this.needsAppUpdate = false;
        const prev = await DB.getKV('meta', 'manifest', null);
        const diff = PT.diffManifest(prev, m, this.local);
        diff.newLessons.forEach((id) => this.newIds.add(id));
        this.manifest = m; this.source = 'remote';
        this.lastSync = new Date().toISOString();
        await DB.setKV('meta', 'manifest', m);
        await DB.setKV('meta', 'lastSync', this.lastSync);
        await DB.setKV('meta', 'newIds', Array.from(this.newIds));
        return { ok: true, source: 'remote', diff };
      } catch (e) {
        return { ok: false, source: this.source, error: String(e && e.message || e) };
      }
    },

    /** Downloads + verifies + stores one lesson. A failure never touches an existing valid copy. */
    async download(id, attempts) {
      const entry = this.entry(id);
      if (!entry) throw new Error('unknown lesson');
      const base = remoteBase();
      const urls = [];
      if (base && this.source === 'remote') urls.push(base + entry.path);
      urls.push(entry.path); // bundled copy shipped with the app (fallback)
      let lastErr = null;
      for (const url of urls) {
        for (let a = 0; a < (attempts || 2); a++) {
          try {
            if (/^https?:/i.test(url) && !PT.isHttps(url)) throw new Error('https-only');
            const bytes = await fetchBytes(url);
            const sha = await PT.sha256Hex(bytes);
            if (sha !== entry.sha256) throw new Error('hash');
            const data = JSON.parse(decode(bytes));
            if (PT.validateLesson(data).length) throw new Error('schema');
            if (data.id !== entry.id || data.version !== entry.version) throw new Error('schema');
            const rec = { id, version: entry.version, sha256: sha, size: bytes.length, downloadedAt: new Date().toISOString(), data };
            await DB.put('lessons', rec);
            this.local[id] = { version: rec.version, sha256: sha, size: rec.size, downloadedAt: rec.downloadedAt };
            this.newIds.delete(id);
            await DB.setKV('meta', 'newIds', Array.from(this.newIds));
            return rec;
          } catch (e) {
            lastErr = e;
            await sleep(400 * (a + 1));
          }
        }
      }
      throw lastErr || new Error('download failed');
    },
    async remove(id) {
      await DB.del('lessons', id);
      delete this.local[id];
    },
    async getLesson(id) {
      const r = await DB.get('lessons', id);
      return r ? r.data : null;
    },
    async markSeen(id) {
      if (this.newIds.delete(id)) await DB.setKV('meta', 'newIds', Array.from(this.newIds));
    },
  };
  window.Content = Content;
})();

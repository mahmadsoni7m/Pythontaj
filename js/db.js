/* IndexedDB wrapper with an in-memory fallback (e.g. when storage is blocked). */
(function () {
  const STORES = { lessons: 'id', meta: 'key', files: 'id', kv: 'key' };
  let dbp = null;
  const mem = { lessons: new Map(), meta: new Map(), files: new Map(), kv: new Map() };
  let useMem = false;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve) => {
      if (!window.indexedDB) { useMem = true; return resolve(null); }
      const req = indexedDB.open('pythontaj', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        Object.keys(STORES).forEach((s) => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: STORES[s] }); });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { useMem = true; resolve(null); };
      req.onblocked = () => { useMem = true; resolve(null); };
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      if (!db) return resolve(fn(null, store));
      const t = db.transaction(store, mode);
      const os = t.objectStore(store);
      const r = fn(os, store);
      t.oncomplete = () => resolve(r && r.result !== undefined ? r.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }
  window.DB = {
    open,
    get(store, key) {
      return open().then((db) => new Promise((res, rej) => {
        if (!db) return res(mem[store].get(key));
        const r = db.transaction(store).objectStore(store).get(key);
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      }));
    },
    all(store) {
      return open().then((db) => new Promise((res, rej) => {
        if (!db) return res(Array.from(mem[store].values()));
        const r = db.transaction(store).objectStore(store).getAll();
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      }));
    },
    put(store, value) {
      return tx(store, 'readwrite', (os) => { if (!os) mem[store].set(value[STORES[store]], value); else os.put(value); });
    },
    del(store, key) {
      return tx(store, 'readwrite', (os) => { if (!os) mem[store].delete(key); else os.delete(key); });
    },
    clear(store) {
      return tx(store, 'readwrite', (os) => { if (!os) mem[store].clear(); else os.clear(); });
    },
    // convenience for key-value records
    getKV(store, key, def) { return this.get(store, key).then((r) => (r ? r.value : def)); },
    setKV(store, key, value) { return this.put(store, { key, value }); },
    get usingMemory() { return useMem; },
  };
})();

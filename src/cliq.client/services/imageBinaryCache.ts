import AsyncStorage from '@react-native-async-storage/async-storage';

// Binary image cache (stores base64 data URIs) keyed by logical cacheKey (e.g., postId:index)
// Cross-platform: memory + (web: localStorage) / (native: AsyncStorage)
// Short TTL (default 55s) to align with signed URL lifetimes.

interface Entry { dataUri: string; expiresAt: number; }
interface LargeEntryMeta { expiresAt: number; size: number; }

const memory = new Map<string, Entry>();
const IN_FLIGHT: Record<string, Promise<string | undefined>> = {};
// Default local blob retention (24h). Signed URL lifetime is independent; once fetched we keep the bytes.
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24h
// Raised cap to 2.5MB base64 (~1.8MB binary) to reduce refetch while still avoiding runaway usage.
// Configurable via setImageBinaryCacheConfig.
// Max size (characters of base64) we will inline persist (localStorage / AsyncStorage). Larger images go to IndexedDB (web) or are memory-only (native).
let MAX_INLINE_BASE64 = 2_500_000;

const debugState = {
  hits: 0,
  misses: 0,
  persistedLoads: 0,
  persistedStores: 0,
  skippedLarge: 0,
  largeStored: 0,
  largeLoaded: 0,
  expirations: 0,
  inflightDeduped: 0,
  lastReasons: [] as string[],
  debug: false,
};

function dbg(msg: string, extra?: any) {
  if (!debugState.debug) return;
  if (extra !== undefined) {
    // eslint-disable-next-line no-console
    console.log(`[ImageBinCache] ${msg}`, extra);
  } else {
    // eslint-disable-next-line no-console
    console.log(`[ImageBinCache] ${msg}`);
  }
}

dbg('module-loaded');

const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';
const supportsIndexedDB = isWeb && 'indexedDB' in window;

// IndexedDB (web) for large binary blobs
let idbInitPromise: Promise<IDBDatabase | null> | null = null;
function openDb(): Promise<IDBDatabase | null> {
  if (!supportsIndexedDB) return Promise.resolve(null);
  if (idbInitPromise) return idbInitPromise;
  idbInitPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('cliqImageCache', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('largeImages')) {
        db.createObjectStore('largeImages');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbg('idb-open-error', req.error); resolve(null); };
  });
  return idbInitPromise;
}

async function idbGet(key: string): Promise<Blob | null> {
  const db = await openDb(); if (!db) return null;
  return new Promise(resolve => {
    const tx = db.transaction('largeImages', 'readonly');
    const store = tx.objectStore('largeImages');
    const r = store.get(key);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => resolve(null);
  });
}

async function idbPut(key: string, value: Blob): Promise<void> {
  const db = await openDb(); if (!db) return;
  return new Promise(resolve => {
    const tx = db.transaction('largeImages', 'readwrite');
    const store = tx.objectStore('largeImages');
    store.put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb(); if (!db) return;
  return new Promise(resolve => {
    const tx = db.transaction('largeImages', 'readwrite');
    tx.objectStore('largeImages').delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

function now() { return Date.now(); }
function isExpired(e?: { expiresAt: number }) { return !e || e.expiresAt <= now(); }

async function loadPersisted(key: string): Promise<Entry | undefined> {
  try {
    if (isWeb) {
      const raw = localStorage.getItem('img:' + key);
      if (!raw) return;
      const parsed: Entry = JSON.parse(raw);
  if (isExpired(parsed)) { localStorage.removeItem('img:' + key); debugState.expirations++; dbg(`expired (persisted) ${key}`); return; }
      memory.set(key, parsed);
  debugState.persistedLoads++;
  dbg(`loaded-from-persist ${key}`);
      return parsed;
    } else {
      const raw = await AsyncStorage.getItem('img:' + key);
      if (!raw) return;
      const parsed: Entry = JSON.parse(raw);
  if (isExpired(parsed)) { await AsyncStorage.removeItem('img:' + key); debugState.expirations++; dbg(`expired (persisted) ${key}`); return; }
      memory.set(key, parsed);
  debugState.persistedLoads++;
  dbg(`loaded-from-persist ${key}`);
      return parsed;
    }
  } catch { /* ignore */ }
}

async function persist(key: string, entry: Entry) {
  try {
  if (entry.dataUri.length > MAX_INLINE_BASE64) { debugState.skippedLarge++; debugState.lastReasons.push(`skip-inline-large:${key}:${entry.dataUri.length}`); dbg(`skip-inline-large ${key} size=${entry.dataUri.length}`); return; }
    const raw = JSON.stringify(entry);
    if (isWeb) {
      localStorage.setItem('img:' + key, raw);
    } else {
      await AsyncStorage.setItem('img:' + key, raw);
    }
  debugState.persistedStores++;
  dbg(`persisted ${key}`);
  } catch { /* storage might be full; ignore */ }
}

export async function getCachedImageDataUri(cacheKey: string, signedUrl: string | undefined, ttl: number = DEFAULT_TTL, force = false): Promise<string | undefined> {
  if (!signedUrl) return undefined;
  if (!force) {
    const mem = memory.get(cacheKey);
    if (!isExpired(mem)) { debugState.hits++; dbg(`hit ${cacheKey}`); return mem!.dataUri; }
  if (mem && isExpired(mem)) debugState.expirations++;
  }
  if (!force && !memory.has(cacheKey)) {
    const loaded = await loadPersisted(cacheKey);
    if (loaded && !isExpired(loaded)) { debugState.hits++; dbg(`hit-persist ${cacheKey}`); return loaded.dataUri; }
    // Try large blob in IDB (web only)
    if (supportsIndexedDB) {
      const metaRaw = localStorage.getItem('img-meta:' + cacheKey);
      if (metaRaw) {
        try {
          const meta: LargeEntryMeta = JSON.parse(metaRaw);
          if (!isExpired(meta)) {
            const blob = await idbGet(cacheKey);
            if (blob) {
              const objectUrl = URL.createObjectURL(blob);
              memory.set(cacheKey, { dataUri: objectUrl, expiresAt: meta.expiresAt });
              debugState.largeLoaded++; debugState.hits++; dbg(`hit-large-idb ${cacheKey}`);
              return objectUrl;
            }
          } else {
            localStorage.removeItem('img-meta:' + cacheKey); idbDelete(cacheKey); debugState.expirations++; dbg(`expired-large-meta ${cacheKey}`);
          }
        } catch {/* ignore corrupt meta */}
      }
    }
  }
  if (IN_FLIGHT[cacheKey]) { debugState.inflightDeduped++; dbg(`deduped ${cacheKey}`); return IN_FLIGHT[cacheKey]; }
  // Fetch and store
  dbg(`fetch ${cacheKey}`);
  const p = fetch(signedUrl, { cache: 'no-store' }) // avoid relying on browser heuristics
    .then(async resp => {
      if (!resp.ok) throw new Error('fetch-failed-' + resp.status);
      const blob = await resp.blob();
      const size = blob.size; // bytes
      const expiresAt = now() + ttl;
      if (size * 1.37 < MAX_INLINE_BASE64) { // heuristic: base64 ~1.37x
        const dataUri = await blobToDataUri(blob);
        const entry: Entry = { dataUri, expiresAt };
        memory.set(cacheKey, entry);
        persist(cacheKey, entry); // fire & forget
        dbg(`store-inline ${cacheKey} size=${size}`);
        return dataUri;
      } else if (supportsIndexedDB) {
        // Store blob in IDB and meta in sessionStorage
        idbPut(cacheKey, blob).then(()=>{ dbg(`store-large-idb ${cacheKey} size=${size}`); });
  localStorage.setItem('img-meta:' + cacheKey, JSON.stringify({ expiresAt, size } satisfies LargeEntryMeta));
        debugState.largeStored++;
        const objectUrl = URL.createObjectURL(blob);
        memory.set(cacheKey, { dataUri: objectUrl, expiresAt });
        return objectUrl;
      } else {
        // Fallback: memory only base64 (may be large) but not persisted
        const dataUri = await blobToDataUri(blob);
        memory.set(cacheKey, { dataUri, expiresAt });
        dbg(`store-memory-large-only ${cacheKey} size=${size}`);
        return dataUri;
      }
    })
    .catch(err => {
      delete IN_FLIGHT[cacheKey];
    debugState.lastReasons.push(`network-error:${cacheKey}:${(err as Error)?.message}`);
      dbg(`error ${cacheKey} ${(err as Error)?.message}`);
      throw err;
    })
    .finally(() => { delete IN_FLIGHT[cacheKey]; });

  IN_FLIGHT[cacheKey] = p;
  debugState.misses++;
  return p;
}

export function invalidateCachedImage(cacheKey: string) {
  memory.delete(cacheKey);
  try {
    if (isWeb) localStorage.removeItem('img:' + cacheKey); else AsyncStorage.removeItem('img:' + cacheKey);
  if (isWeb) { localStorage.removeItem('img-meta:' + cacheKey); if (supportsIndexedDB) idbDelete(cacheKey); }
  } catch {/* ignore */}
  dbg(`invalidate ${cacheKey}`);
}

async function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

// Debug / inspection helpers
export function enableImageBinaryCacheDebug(enable = true) { debugState.debug = enable; }
export function getImageBinaryCacheStats() { return { ...debugState, lastReasons: [...debugState.lastReasons].slice(-10) }; }
export function setImageBinaryCacheConfig(opts: { maxInlineBase64?: number }) { if (opts.maxInlineBase64) MAX_INLINE_BASE64 = opts.maxInlineBase64; }
export function peekCachedDataUri(cacheKey: string): string | undefined { const e = memory.get(cacheKey); return e && !isExpired(e) ? e.dataUri : undefined; }

// Simple cross-platform cache for short-lived signed image URLs.
// Keys are logical identifiers (e.g., postId:index) to avoid depending on the expiring URL string.
// Because signed URLs expire (~60s), we store an adjusted expiry (default 55s) and auto-refresh when stale.
// On web, we persist to sessionStorage so a full page refresh within the TTL avoids refetching.

import { ApiClient } from 'services/apiClient';
import type { PostImageUrlDto } from 'services/generated/generatedClient';

const DEFAULT_TTL_MS = 55_000; // slightly under 60s to proactively refresh

interface CacheEntry {
  url: string;
  expiresAt: number; // epoch ms
  // Optional in-flight promise to de-dupe concurrent fetches
  promise?: Promise<string>;
}

const cache = new Map<string, CacheEntry>();
const STORAGE_KEY = 'cliq:imageCache:v1';
const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';

// Hydrate from sessionStorage (web only)
if (isWeb) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: Record<string, CacheEntry> = JSON.parse(raw);
      const now = Date.now();
      Object.entries(parsed).forEach(([k, v]) => {
        if (v && v.url && v.expiresAt > now) {
          cache.set(k, v);
        }
      });
    }
  } catch {/* ignore */}
}

const keyFor = (postId: string | number, index: number) => `${postId}:${index}`;

function isExpired(entry: CacheEntry | undefined) {
  if (!entry) return true;
  return Date.now() > entry.expiresAt;
}

function persist() {
  if (!isWeb) return;
  try {
    const obj: Record<string, CacheEntry> = {};
    cache.forEach((v, k) => { if (v.url && !isExpired(v)) obj[k] = { url: v.url, expiresAt: v.expiresAt }; });
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {/* ignore */}
}

export async function getSignedImageUrl(
  postId: string | number,
  index: number,
  force = false,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<string | undefined> {
  const key = keyFor(postId, index);
  const existing = cache.get(key);
  if (!force && existing && !isExpired(existing)) {
    return existing.url;
  }
  // If a fetch is already in-flight reuse it unless force
  if (!force && existing?.promise) return existing.promise;

  const fetchPromise = ApiClient
    .call(client => client.post_GetPostImage(postId as any, index, 60))
    .then((dto: PostImageUrlDto) => {
      const fresh: CacheEntry | undefined = dto?.url
        ? { url: dto.url, expiresAt: Date.now() + ttlMs }
        : undefined;
      if (fresh) {
        cache.set(key, fresh);
  persist();
        return fresh.url;
      }
      return undefined;
    })
    .finally(() => {
      // Clear the promise reference (preserve entry with url)
      const latest = cache.get(key);
      if (latest && latest.promise) {
        delete latest.promise;
      }
    });

  cache.set(key, { url: existing?.url || '', expiresAt: existing?.expiresAt || 0, promise: fetchPromise });
  persist();
  return fetchPromise;
}

export function primeSignedImageUrl(postId: string | number, index: number, url: string, ttlMs: number = DEFAULT_TTL_MS) {
  const key = keyFor(postId, index);
  cache.set(key, { url, expiresAt: Date.now() + ttlMs });
  persist();
}

export function invalidateSignedImageUrl(postId: string | number, index: number) {
  cache.delete(keyFor(postId, index));
  persist();
}

export function clearImageUrlCache() {
  cache.clear();
  persist();
}

// Return cached URL if present & not expired (without triggering network)
export function peekSignedImageUrl(postId: string | number, index: number): string | undefined {
  const entry = cache.get(keyFor(postId, index));
  if (!entry || isExpired(entry)) return undefined;
  return entry.url;
}

export function hasValidSignedImageUrl(postId: string | number, index: number): boolean {
  const entry = cache.get(keyFor(postId, index));
  return !!entry && !isExpired(entry) && !!entry.url;
}

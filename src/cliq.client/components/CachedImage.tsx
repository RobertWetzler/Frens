import React, { useEffect, useState } from 'react';
import { Image, ActivityIndicator, View, ImageProps } from 'react-native';
import { getCachedImageDataUri, invalidateCachedImage, getImageBinaryCacheStats, peekCachedDataUri } from 'services/imageBinaryCache';

interface CachedImageProps extends Omit<ImageProps, 'source'> {
  cacheKey: string;
  signedUrl?: string; // short-lived signed URL
  ttlMs?: number; // legacy name (will be treated as local cache TTL)
  cacheTtlMs?: number; // preferred explicit local cache TTL
  forceRefreshToken?: any; // change to force refetch
  onExpired?: () => void; // called when original URL 403s upstream (handled externally)
  showWhileFetching?: 'spinner' | 'none';
  onResolved?: (uri: string, fromCache: boolean) => void; // notify parent when final cache URI ready
}

export const CachedImage: React.FC<CachedImageProps> = ({ cacheKey, signedUrl, ttlMs, cacheTtlMs, forceRefreshToken, style, onExpired, showWhileFetching = 'spinner', onResolved, ...rest }) => {
  const [uri, setUri] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!signedUrl) return;
    // Fast path: sync peek (memory or previously loaded blob URL)
    const peek = peekCachedDataUri(cacheKey);
    if (peek) {
      setUri(peek);
      setLoading(false);
      onResolved?.(peek, true);
      // eslint-disable-next-line no-console
      console.log('[CachedImage] instant-hit', cacheKey);
      return;
    }
    setLoading(true);
    // eslint-disable-next-line no-console
    console.log('[CachedImage] load-start', { cacheKey });
  const effectiveTtl = cacheTtlMs || ttlMs || 24 * 60 * 60 * 1000; // default 24h
  getCachedImageDataUri(cacheKey, signedUrl, effectiveTtl)
  .then(u => { if (!cancelled) { setUri(u); setError(null); if (u) onResolved?.(u, false); /* eslint-disable-next-line no-console */ console.log('[CachedImage] loaded', { cacheKey, uriSample: u?.slice(0,30) }); } })
      .catch(e => { if (!cancelled) { setError(e instanceof Error ? e : new Error(String(e))); /* eslint-disable-next-line no-console */ console.warn('[CachedImage] error', cacheKey, e); } })
      .finally(() => { if (!cancelled) { setLoading(false); /* eslint-disable-next-line no-console */ console.log('[CachedImage] load-end', cacheKey, getImageBinaryCacheStats()); } });
    return () => { cancelled = true; };
  }, [cacheKey, signedUrl, ttlMs, forceRefreshToken]);

  if (!signedUrl) return null;

  if (!uri) {
    if (showWhileFetching === 'spinner') {
      return (
        <View style={[style, { justifyContent:'center', alignItems:'center', overflow:'hidden' }]}> 
          <ActivityIndicator />
        </View>
      );
    }
    return <View style={style} />;
  }

  return (
    <Image
      {...rest}
      source={{ uri }}
      style={style}
      onError={(e) => {
        invalidateCachedImage(cacheKey);
        onExpired?.();
        rest.onError?.(e as any);
        // eslint-disable-next-line no-console
        console.warn('[CachedImage] onError image render', cacheKey, uri?.slice(0,40));
      }}
      onLoadStart={() => { /* eslint-disable-next-line no-console */ console.log('[CachedImage] onLoadStart', cacheKey, uri?.slice(0,40)); }}
      onLoadEnd={() => { /* eslint-disable-next-line no-console */ console.log('[CachedImage] onLoadEnd', cacheKey); }}
    />
  );
};

import React, { useEffect, useState } from 'react';
import { Image, ActivityIndicator, View, ImageProps, Platform, StyleSheet } from 'react-native';
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

/**
 * Map React Native resizeMode values to CSS object-fit.
 * RNW's Image uses background-image on a <div> which older Safari
 * fails to paint for blob:/data: URIs. A native <img> with object-fit
 * works universally.
 */
const resizeModeToCss: Record<string, string> = {
  cover: 'cover',
  contain: 'contain',
  stretch: 'fill',
  center: 'none',
};

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

  // On web, use a native <img> element instead of RNW's Image component.
  // RNW renders <Image> as a <div> with background-image CSS, which older
  // Safari fails to paint for blob: / data: URIs. A real <img> works everywhere.
  if (Platform.OS === 'web') {
    const flatStyle: any = StyleSheet.flatten(style) || {};
    // Determine objectFit from the resizeMode prop or from style (Avatar passes it in style)
    const rm: string = (rest as any).resizeMode || flatStyle.resizeMode || 'cover';
    const objectFit = resizeModeToCss[rm] || 'cover';

    // Strip RN-only keys that are not valid CSS
    const { resizeMode: _rm, tintColor: _tc, overlayColor: _oc, ...cssStyle } = flatStyle;

    const imgStyle: React.CSSProperties = {
      ...(cssStyle as React.CSSProperties),
      objectFit: objectFit as React.CSSProperties['objectFit'],
      display: 'block',
    };

    return React.createElement('img', {
      src: uri,
      style: imgStyle,
      draggable: false,
      loading: 'eager' as const,
      onError: () => {
        invalidateCachedImage(cacheKey);
        onExpired?.();
        // eslint-disable-next-line no-console
        console.warn('[CachedImage] onError (web img)', cacheKey, uri?.slice(0, 40));
      },
      onLoad: () => {
        // eslint-disable-next-line no-console
        console.log('[CachedImage] onLoad (web img)', cacheKey);
      },
    });
  }

  // Native path – keep RN <Image> as-is
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

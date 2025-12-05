import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Modal, Animated, PanResponder, Dimensions } from 'react-native';
import { PostImageIndexedUrlDto, PostImagesUrlDto } from 'services/generated/generatedClient';
import { getSignedImageUrl, primeSignedImageUrl, invalidateSignedImageUrl, peekSignedImageUrl, hasValidSignedImageUrl } from 'services/imageUrlCache';
import { CachedImage } from './CachedImage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';
import { useApi } from 'hooks/useApi';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PostImageGridProps {
  postId: string;
  hasImage: boolean;
  imageCount?: number;
  localImages?: Array<{ uri: string; fileName: string }>;
}

export const PostImageGrid: React.FC<PostImageGridProps> = ({
  postId,
  hasImage,
  imageCount: propImageCount,
  localImages,
}) => {
  const { theme } = useTheme();
  const styles = useStyles();

  // Multi-image state
  const imageCount = propImageCount ?? (hasImage ? 1 : 0);
  const [thumbs, setThumbs] = useState<PostImageIndexedUrlDto[]>([]);
  const [fullScreenIndex, setFullScreenIndex] = useState<number | null>(null);
  // signedUrls: short-lived signed S3 URLs (never used directly for <Image>)
  const [signedUrls, setSignedUrls] = useState<Record<number, string>>({});
  // loadedUrls: stable blob:/data: URIs (or final cached) actually rendered
  const [loadedUrls, setLoadedUrls] = useState<Record<number, string>>({});
  const [aspectRatios, setAspectRatios] = useState<Record<number, number>>({});
  // Track retry attempts per image index to avoid infinite loops on persistent 403
  const retryCountsRef = useRef<Record<number, number>>({});

  // Zoom state for fullscreen image
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const lastScale = useRef(1);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);
  const lastTapTime = useRef(0);
  const initialDistance = useRef<number | null>(null);

  // If we have local images, use those instead of fetching from server
  const isOptimistic = localImages && localImages.length > 0;

  // Batch load first up to 3 images (only if not optimistic)
  const initialIndices = hasImage && !isOptimistic ? [0, 1, 2].filter(i => i < imageCount) : [];
  const indicesToFetch = initialIndices.filter(i => !hasValidSignedImageUrl(postId, i));
  const { data: batchData, isLoading: batchLoading, error: batchError, refetch: fetchBatch } = useApi<PostImagesUrlDto | null>(
    (client) => indicesToFetch.length > 0 ? client.post_GetPostImages(postId, indicesToFetch, 60) : Promise.resolve(null),
    [postId, imageCount, indicesToFetch.join(':')],
    { immediate: false }
  );

  useEffect(() => { if (indicesToFetch.length > 0) fetchBatch(); }, [postId, imageCount, indicesToFetch.length]);

  useEffect(() => {
    if (!batchData) return;
    const imgs = batchData.images || [];
    const merged = [...thumbs];
    imgs.forEach(i => {
      if (!merged.find(m => m.index === i.index)) merged.push(i);
    });
    setThumbs(merged.slice(0, 3));
    if (imgs.length) {
      const mapEntries: [number, string][] = [];
      imgs.forEach(i => {
        if (i.url) {
          primeSignedImageUrl(postId, i.index, i.url);
          mapEntries.push([i.index, i.url]);
        }
      });
      if (mapEntries.length) setSignedUrls(prev => ({ ...prev, ...Object.fromEntries(mapEntries) }));
    }
  }, [batchData, postId]);

  // Hydrate local state from global cache on mount (for page refresh within TTL)
  useEffect(() => {
    if (!hasImage || isOptimistic) return;
    const initialSigned: Record<number, string> = {};
    const hydratedThumbs: PostImageIndexedUrlDto[] = [];
    for (let idx = 0; idx < Math.min(3, imageCount); idx++) {
      const url = peekSignedImageUrl(postId, idx);
      if (url) {
        initialSigned[idx] = url;
        hydratedThumbs.push({ index: idx, url } as PostImageIndexedUrlDto);
      }
    }
    if (hydratedThumbs.length) setThumbs(prev => {
      const map = new Map<number, PostImageIndexedUrlDto>();
      [...prev, ...hydratedThumbs].forEach(t => map.set(t.index, t));
      return Array.from(map.values()).sort((a, b) => a.index - b.index).slice(0, 3);
    });
    if (Object.keys(initialSigned).length) setSignedUrls(prev => ({ ...initialSigned, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazy load individual image when navigating fullscreen
  const fetchSingle = useCallback(async (index: number, force = false) => {
    if (index == null || index < 0 || index >= imageCount || isOptimistic) return;
    if (!force && signedUrls[index] !== undefined) return;
    try {
      const url = await getSignedImageUrl(postId, index, force);
      if (url) {
        setSignedUrls(prev => ({ ...prev, [index]: url }));
      }
    } catch (e) {
      console.log('Failed to fetch image index', index, e);
    }
  }, [signedUrls, postId, imageCount, isOptimistic]);

  // Handle image load errors (e.g., 403 due to expired signed URL) by forcing a refetch.
  const handleImageError = useCallback((index: number) => {
    if (index == null || isOptimistic) return;
    const retries = retryCountsRef.current[index] || 0;
    if (retries >= 3) {
      console.log(`Image index ${index} exceeded retry attempts`);
      return;
    }
    retryCountsRef.current[index] = retries + 1;
    setSignedUrls(prev => { const next = { ...prev }; delete next[index]; return next; });
    invalidateSignedImageUrl(postId, index);
    setTimeout(() => fetchSingle(index, true), 50);
  }, [fetchSingle, postId, isOptimistic]);

  useEffect(() => {
    if (fullScreenIndex == null) return;
    fetchSingle(fullScreenIndex);
    fetchSingle(fullScreenIndex + 1);
    fetchSingle(fullScreenIndex - 1);
  }, [fullScreenIndex, fetchSingle]);

  const resetZoom = useCallback(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    lastScale.current = 1;
    lastTranslateX.current = 0;
    lastTranslateY.current = 0;
  }, [scale, translateX, translateY]);

  const openFullScreen = (index: number) => { 
    resetZoom();
    setFullScreenIndex(index); 
  };
  const closeFullScreen = () => {
    resetZoom();
    setFullScreenIndex(null);
  };
  const goNext = () => {
    resetZoom();
    setFullScreenIndex(i => (i == null ? i : Math.min(imageCount - 1, i + 1)));
  };
  const goPrev = () => {
    resetZoom();
    setFullScreenIndex(i => (i == null ? i : Math.max(0, i - 1)));
  };

  // Pan responder for zoom and pan gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only handle if we have multiple touches (pinch) or we're already zoomed
        return evt.nativeEvent.touches.length >= 2 || lastScale.current > 1;
      },
      onPanResponderGrant: (evt) => {
        // Handle double tap to zoom
        const now = Date.now();
        if (now - lastTapTime.current < 300 && evt.nativeEvent.touches.length === 1) {
          if (lastScale.current > 1) {
            resetZoom();
          } else {
            // Zoom to 2x at tap location
            const touch = evt.nativeEvent.touches[0];
            const touchX = touch.pageX - SCREEN_WIDTH / 2;
            const touchY = touch.pageY - SCREEN_HEIGHT / 2;
            
            Animated.parallel([
              Animated.spring(scale, { toValue: 2, useNativeDriver: true, friction: 7 }),
              Animated.spring(translateX, { toValue: -touchX * 0.5, useNativeDriver: true, friction: 7 }),
              Animated.spring(translateY, { toValue: -touchY * 0.5, useNativeDriver: true, friction: 7 }),
            ]).start();
            lastScale.current = 2;
            lastTranslateX.current = -touchX * 0.5;
            lastTranslateY.current = -touchY * 0.5;
          }
        }
        lastTapTime.current = now;
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        
        // Pinch to zoom
        if (touches.length === 2) {
          const touch1 = touches[0];
          const touch2 = touches[1];
          const distance = Math.sqrt(
            Math.pow(touch2.pageX - touch1.pageX, 2) + 
            Math.pow(touch2.pageY - touch1.pageY, 2)
          );
          
          if (!initialDistance.current) {
            initialDistance.current = distance;
          } else {
            const newScale = Math.max(1, Math.min(4, lastScale.current * (distance / initialDistance.current)));
            scale.setValue(newScale);
          }
        } 
        // Pan when zoomed
        else if (touches.length === 1 && lastScale.current > 1) {
          const maxTranslate = (lastScale.current - 1) * SCREEN_WIDTH / 2;
          const maxTranslateY = (lastScale.current - 1) * SCREEN_HEIGHT / 2;
          
          const newX = lastTranslateX.current + gestureState.dx;
          const newY = lastTranslateY.current + gestureState.dy;
          
          translateX.setValue(Math.max(-maxTranslate, Math.min(maxTranslate, newX)));
          translateY.setValue(Math.max(-maxTranslateY, Math.min(maxTranslateY, newY)));
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        
        if (touches.length === 0) {
          // Save current scale and position
          lastScale.current = (scale as any)._value;
          lastTranslateX.current = (translateX as any)._value;
          lastTranslateY.current = (translateY as any)._value;
          
          // Reset if zoomed out too much
          if (lastScale.current < 1.1) {
            resetZoom();
          }
          
          // Reset initial distance for next pinch
          initialDistance.current = null;
        }
      },
    })
  ).current;

  // Compute aspect ratio for each loaded image
  useEffect(() => {
    if (isOptimistic) return;
    thumbs.forEach(t => {
      const renderUri = loadedUrls[t.index];
      if (aspectRatios[t.index] || !renderUri) return;
      if (renderUri.startsWith('http')) return;
      Image.getSize(renderUri, (w, h) => {
        if (w && h) {
          setAspectRatios(prev => ({ ...prev, [t.index]: Math.min(2, Math.max(0.75, w / h)) }));
        }
      }, err => console.log('Image.getSize error', err));
    });
  }, [thumbs, loadedUrls, aspectRatios, isOptimistic]);

  // Render a single thumbnail (for server images)
  const renderSingleThumb = (img: PostImageIndexedUrlDto | undefined, style: any, showOverlay?: string) => {
    if (!img) {
      return (
        <View key={'thumb-placeholder'} style={[styles.thumbCommon, style]}>
          <View style={styles.thumbPlaceholder}><ActivityIndicator color={theme.colors.primary} /></View>
        </View>
      );
    }
    return (
      <TouchableOpacity key={img.index} style={[styles.thumbCommon, style]} activeOpacity={0.9} onPress={() => openFullScreen(img.index)}>
        {img.url ? (
          <CachedImage
            cacheKey={`${postId}:${img.index}`}
            signedUrl={signedUrls[img.index] || img.url}
            style={styles.thumbImage}
            resizeMode="cover"
            onExpired={() => handleImageError(img.index)}
            onResolved={(uri) => {
              if (uri && (uri.startsWith('blob:') || uri.startsWith('data:'))) {
                setLoadedUrls(prev => prev[img.index]?.startsWith('blob:') || prev[img.index]?.startsWith('data:') ? prev : ({ ...prev, [img.index]: uri }));
              }
            }}
          />
        ) : (
          <View style={styles.thumbPlaceholder}><ActivityIndicator color={theme.colors.primary} /></View>
        )}
        {showOverlay && (
          <View style={styles.moreOverlay}><Text style={styles.moreOverlayText}>{showOverlay}</Text></View>
        )}
      </TouchableOpacity>
    );
  };

  // Render a local optimistic image thumbnail
  const renderLocalThumb = (img: { uri: string; fileName: string }, index: number, style: any, showOverlay?: string) => {
    return (
      <TouchableOpacity key={index} style={[styles.thumbCommon, style]} activeOpacity={0.9} onPress={() => openFullScreen(index)}>
        <Image source={{ uri: img.uri }} style={styles.thumbImage} resizeMode="cover" />
        {showOverlay && (
          <View style={styles.moreOverlay}><Text style={styles.moreOverlayText}>{showOverlay}</Text></View>
        )}
      </TouchableOpacity>
    );
  };

  const renderImageGrid = () => {
    if (!hasImage) return null;

    // Optimistic local images path
    if (isOptimistic) {
      const images = localImages!;
      
      if (images.length === 1) {
        return (
          <View style={styles.singleWrapper}>
            {renderLocalThumb(images[0], 0, styles.singleImage)}
          </View>
        );
      }

      if (images.length === 2) {
        return (
          <View style={styles.twoRoot}>
            {renderLocalThumb(images[0], 0, [styles.twoImage, { marginRight: 4 }])}
            {renderLocalThumb(images[1], 1, styles.twoImage)}
          </View>
        );
      }

      // 3+ images
      const extra = Math.max(0, images.length - 3);
      return (
        <View style={styles.gridRoot}>
          <View style={styles.gridLeft}>
            {renderLocalThumb(images[0], 0, styles.gridLeftImage)}
          </View>
          <View style={styles.gridRight}>
            {renderLocalThumb(images[1], 1, styles.gridRightTop)}
            {renderLocalThumb(images[2], 2, styles.gridRightBottom, extra > 0 ? `+${extra}` : undefined)}
          </View>
        </View>
      );
    }

    // Server images path
    if (batchLoading && thumbs.length === 0) {
      return <View style={styles.imageWrapper}><ActivityIndicator color={theme.colors.primary} /></View>;
    }
    if (batchError) {
      return <Text style={styles.imageError}>Images failed to load</Text>;
    }

    const count = imageCount;
    if (count === 1) {
      const t0 = thumbs[0];
      return (
        <View style={styles.singleWrapper}>
          {renderSingleThumb(t0, styles.singleImage)}
        </View>
      );
    }

    if ((count === 2 && thumbs.length >= 2) || thumbs.length === 2) {
      return (
        <View style={styles.twoRoot}>
          {thumbs.slice(0, 2).map((t, i) => renderSingleThumb(t, [styles.twoImage, i === 0 ? { marginRight: 4 } : null]))}
        </View>
      );
    }

    // Layout for 3 or more
    const left = thumbs[0];
    const rightTop = thumbs[1];
    const rightBottom = thumbs[2];
    const extra = Math.max(0, count - 3);

    return (
      <View style={styles.gridRoot}>
        <View style={styles.gridLeft}>
          {left && renderSingleThumb(left, styles.gridLeftImage)}
        </View>
        <View style={styles.gridRight}>
          {rightTop && renderSingleThumb(rightTop, styles.gridRightTop)}
          {rightBottom && renderSingleThumb(rightBottom, styles.gridRightBottom, extra > 0 ? `+${extra}` : undefined)}
          {!rightBottom && extra > 0 && (
            <TouchableOpacity style={[styles.thumbCommon, styles.gridRightBottom]} onPress={() => openFullScreen(0)}>
              <View style={styles.moreOverlay}><Text style={styles.moreOverlayText}>{`+${extra}`}</Text></View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Fullscreen modal
  const renderFullScreen = () => {
    if (fullScreenIndex == null) return null;

    const currentScale = lastScale.current;
    const showNavButtons = currentScale <= 1.1; // Only show nav buttons when not zoomed

    let imageSource;
    if (isOptimistic && localImages) {
      imageSource = <Image source={{ uri: localImages[fullScreenIndex]?.uri }} style={styles.fullScreenImage} resizeMode="contain" />;
    } else {
      const signed = signedUrls[fullScreenIndex];
      const renderUrl = loadedUrls[fullScreenIndex];
      imageSource = signed ? (
        <CachedImage
          cacheKey={`${postId}:${fullScreenIndex}`}
          signedUrl={renderUrl || signed}
          style={styles.fullScreenImage}
          resizeMode="contain"
          onExpired={() => handleImageError(fullScreenIndex)}
          onResolved={(uri) => {
            if (uri && (uri.startsWith('blob:') || uri.startsWith('data:'))) {
              setLoadedUrls(prev => prev[fullScreenIndex!]?.startsWith('blob:') || prev[fullScreenIndex!]?.startsWith('data:') ? prev : ({ ...prev, [fullScreenIndex!]: uri }));
            }
          }}
        />
      ) : (
        <ActivityIndicator size="large" color={theme.colors.primary} />
      );
    }

    return (
      <Modal visible={true} transparent animationType="fade" onRequestClose={closeFullScreen}>
        <View style={styles.fullScreenOverlay}>
          <TouchableOpacity style={styles.fullScreenClose} onPress={closeFullScreen}>
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          {showNavButtons && fullScreenIndex > 0 && (
            <TouchableOpacity style={[styles.navButton, styles.navLeft]} onPress={goPrev}>
              <Ionicons name="chevron-back" size={42} color="#fff" />
            </TouchableOpacity>
          )}
          {showNavButtons && fullScreenIndex < imageCount - 1 && (
            <TouchableOpacity style={[styles.navButton, styles.navRight]} onPress={goNext}>
              <Ionicons name="chevron-forward" size={42} color="#fff" />
            </TouchableOpacity>
          )}
          <Animated.View 
            style={[
              styles.fullScreenBackdrop,
              {
                transform: [
                  { scale },
                  { translateX },
                  { translateY },
                ]
              }
            ]}
            {...panResponder.panHandlers}
          >
            {imageSource}
          </Animated.View>
          <Text style={styles.counterText}>{`${(fullScreenIndex + 1)} / ${imageCount}`}</Text>
        </View>
      </Modal>
    );
  };

  return (
    <>
      {renderImageGrid()}
      {renderFullScreen()}
    </>
  );
};

const useStyles = makeStyles(theme => ({
  imageWrapper: {
    width: '100%',
    aspectRatio: 1.6,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  imageError: {
    color: 'red',
    fontSize: 12
  },
  gridRoot: {
    flexDirection: 'row',
    width: '100%',
    height: 220,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10
  },
  gridLeft: {
    flex: 2,
    marginRight: 4
  },
  gridRight: {
    flex: 1,
    justifyContent: 'space-between'
  },
  gridLeftImage: {
    flex: 1
  },
  gridRightTop: {
    flex: 1,
    marginBottom: 4
  },
  gridRightBottom: {
    flex: 1
  },
  thumbCommon: {
    backgroundColor: theme.colors.backgroundAlt || '#111',
    borderRadius: 8,
    overflow: 'hidden'
  },
  thumbImage: {
    width: '100%',
    height: '100%'
  },
  thumbPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  singleWrapper: {
    width: '100%',
    height: 260,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10
  },
  singleImage: {
    flex: 1
  },
  moreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  moreOverlayText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '600'
  },
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  fullScreenClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 3
  },
  fullScreenBackdrop: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -32,
    padding: 12,
    zIndex: 3
  },
  navLeft: {
    left: 10
  },
  navRight: {
    right: 10
  },
  counterText: {
    position: 'absolute',
    bottom: 30,
    color: '#fff',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  twoRoot: {
    flexDirection: 'row',
    width: '100%',
    height: 220,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10
  },
  twoImage: {
    flex: 1
  },
}));

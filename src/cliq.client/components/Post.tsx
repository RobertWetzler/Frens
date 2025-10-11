import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, Image, ActivityIndicator, Platform, Modal } from 'react-native';
import { PostImageUrlDto, PostDto as PostType, PostImagesUrlDto, PostImageIndexedUrlDto } from 'services/generated/generatedClient'
import { ApiClient } from 'services/apiClient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';
import { useApi } from 'hooks/useApi';

interface PostProps {
  post: PostType,
  navigation?: any;
  isNavigable?: boolean;
  animationDelay?: number;
  shouldAnimate?: boolean;
  renderPreContent?: React.ReactNode | (() => React.ReactNode);
  renderFooterContent?: React.ReactNode | (() => React.ReactNode);
  showDefaultCommentButton?: boolean;
}

const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const Post: React.FC<PostProps> = ({ post, navigation, isNavigable = true, animationDelay = 0, shouldAnimate = false, renderPreContent, renderFooterContent, showDefaultCommentButton = true }) => {
  const translateY = useRef(new Animated.Value(shouldAnimate ? 100 : 0)).current;
  const opacity = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;
  const scale = useRef(new Animated.Value(shouldAnimate ? 0.8 : 1)).current;

  useEffect(() => {
    // Reset animation values when shouldAnimate changes
    if (shouldAnimate) {
      translateY.setValue(100);
      opacity.setValue(0);
      scale.setValue(0.8);
      
      // Start the elastic spring animation with staggered delay
      const animateIn = () => {
        console.log(`Starting animation for post ${post.id}`);
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            tension: 50,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            tension: 100,
            friction: 7,
            useNativeDriver: true,
          }),
        ]).start(() => {
          console.log(`Animation completed for post ${post.id}`);
        });
      };

      // Apply staggered delay
      const timer = setTimeout(animateIn, animationDelay);
      return () => clearTimeout(timer);
    } else {
      // If not animating, ensure values are set to final state
      translateY.setValue(0);
      opacity.setValue(1);
      scale.setValue(1);
    }
  }, [shouldAnimate, animationDelay, opacity, translateY, scale, post.id]);

  const sharedWithText = post.sharedWithCircles && post.sharedWithCircles.length > 0 
    ? post.sharedWithCircles.map(c => c.name).join(", ")
    : "you";

  const formatDate = (date: Date) => {
    const now = new Date();
    const isCurrentYear = now.getFullYear() === date.getFullYear();
    
    const options: Intl.DateTimeFormatOptions = {
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    
    if (!isCurrentYear) {
      options.year = 'numeric';
    }
    
    return date.toLocaleString('en-US', options);
  };

  const { theme } = useTheme();
  const styles = useStyles();

  // Multi-image state
  const imageCount = (post as any).imageCount ?? (post.hasImage ? 1 : 0);
  const [thumbs, setThumbs] = useState<PostImageIndexedUrlDto[]>([]); // first up to 3
  const [fullScreenIndex, setFullScreenIndex] = useState<number | null>(null);
  const [loadedUrls, setLoadedUrls] = useState<Record<number, string>>({}); // index -> url
  const [aspectRatios, setAspectRatios] = useState<Record<number, number>>({});
  // Track retry attempts per image index to avoid infinite loops on persistent 403
  const retryCountsRef = useRef<Record<number, number>>({});

  // Batch load first up to 3 images
  const indicesToFetch = post.hasImage ? [0,1,2].filter(i => i < imageCount) : [];
  const { data: batchData, isLoading: batchLoading, error: batchError, refetch: fetchBatch } = useApi<PostImagesUrlDto | null>(
    (client) => indicesToFetch.length > 0 ? client.post_GetPostImages(post.id, indicesToFetch, 60) : Promise.resolve(null),
    [post.id, imageCount],
    { immediate: false }
  );

  useEffect(() => { if (indicesToFetch.length > 0) fetchBatch(); }, [post.id, imageCount]);

  useEffect(() => {
    if (!batchData) return;
    const imgs = batchData.images || [];
    setThumbs(imgs.slice(0,3));
    setLoadedUrls(prev => ({ ...prev, ...Object.fromEntries(imgs.map(i => [i.index, i.url])) }));
  }, [batchData]);

  // Lazy load individual image when navigating fullscreen
  const fetchSingle = useCallback(async (index: number, force = false) => {
    if (index == null || index < 0 || index >= imageCount) return;
    if (!force && loadedUrls[index] !== undefined) return; // skip if already have unless forced
    try {
      const urlDto: PostImageUrlDto = await ApiClient.call(client => client.post_GetPostImage(post.id, index, 60));
      if (urlDto?.url) {
        setLoadedUrls(prev => ({ ...prev, [index]: urlDto.url }));
      }
    } catch (e) {
      console.log('Failed to fetch image index', index, e);
    }
  }, [loadedUrls, post.id, imageCount]);

  // Handle image load errors (e.g., 403 due to expired signed URL) by forcing a refetch.
  const handleImageError = useCallback((index: number) => {
    if (index == null) return;
    const retries = retryCountsRef.current[index] || 0;
    if (retries >= 3) { // cap retries
      console.log(`Image index ${index} exceeded retry attempts`);
      return;
    }
    retryCountsRef.current[index] = retries + 1;
    // Remove stale URL so fetchSingle won't early-exit
    setLoadedUrls(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    // Force refresh shortly after state update
    setTimeout(() => fetchSingle(index, true), 50);
  }, [fetchSingle]);

  useEffect(() => {
    if (fullScreenIndex == null) return;
    fetchSingle(fullScreenIndex);
    // Prefetch neighbors
    fetchSingle(fullScreenIndex + 1);
    fetchSingle(fullScreenIndex - 1);
  }, [fullScreenIndex, fetchSingle]);

  const openFullScreen = (index: number) => { setFullScreenIndex(index); };
  const closeFullScreen = () => setFullScreenIndex(null);
  const goNext = () => setFullScreenIndex(i => (i == null ? i : Math.min(imageCount - 1, i + 1)));
  const goPrev = () => setFullScreenIndex(i => (i == null ? i : Math.max(0, i - 1)));

  // Compute aspect ratio for each loaded image (only thumbnails for now)
  useEffect(() => {
    thumbs.forEach(t => {
      if (aspectRatios[t.index] || !t.url) return;
      Image.getSize(t.url, (w, h) => {
        if (w && h) {
          setAspectRatios(prev => ({ ...prev, [t.index]: Math.min(2, Math.max(0.75, w / h)) }));
        }
      }, err => console.log('Image.getSize error', err));
    });
  }, [thumbs, aspectRatios]);

  // Grid rendering helpers
  // Safe thumbnail renderer (guards against undefined during initial async fetch)
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
          <Image
            source={{ uri: img.url }}
            style={styles.thumbImage}
            resizeMode="cover"
            onError={() => handleImageError(img.index)}
          />
        ) : (
          <View style={styles.thumbPlaceholder}><ActivityIndicator color={theme.colors.primary} /></View>
        )}
        {showOverlay && (
          <View style={styles.moreOverlay}> <Text style={styles.moreOverlayText}>{showOverlay}</Text></View>
        )}
      </TouchableOpacity>
    );
  };

  const renderImageGrid = () => {
    if (!post.hasImage) return null;
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

    // NEW: exactly two images -> even split layout
    if ((count === 2 && thumbs.length >= 2) || thumbs.length === 2) {
      return (
        <View style={styles.twoRoot}>
          {thumbs.slice(0,2).map((t,i) => renderSingleThumb(t, [styles.twoImage, i === 0 ? { marginRight:4 } : null]))}
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

  // Fullscreen content
  const renderFullScreen = () => {
    if (fullScreenIndex == null) return null;
    const url = loadedUrls[fullScreenIndex];
    return (
      <Modal visible={true} transparent animationType="fade" onRequestClose={closeFullScreen}>
        <View style={styles.fullScreenOverlay}>
          <TouchableOpacity style={styles.fullScreenClose} onPress={closeFullScreen}>
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          {fullScreenIndex > 0 && (
            <TouchableOpacity style={[styles.navButton, styles.navLeft]} onPress={goPrev}>
              <Ionicons name="chevron-back" size={42} color="#fff" />
            </TouchableOpacity>
          )}
          {fullScreenIndex < imageCount - 1 && (
            <TouchableOpacity style={[styles.navButton, styles.navRight]} onPress={goNext}>
              <Ionicons name="chevron-forward" size={42} color="#fff" />
            </TouchableOpacity>
          )}
          <View style={styles.fullScreenBackdrop}>
            {url ? (
              <Image
                source={{ uri: url }}
                style={styles.fullScreenImage}
                resizeMode="contain"
                onError={() => handleImageError(fullScreenIndex)}
              />
            ) : (
              <ActivityIndicator size="large" color={theme.colors.primary} />
            )}
            <Text style={styles.counterText}>{`${(fullScreenIndex + 1)} / ${imageCount}`}</Text>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }, { scale }], opacity }] }>
      <View style={styles.header}>
        <View style={styles.authorContainer}>
          <Text style={styles.author}>{post.user.name}</Text>
          <Text style={styles.sharedWith}> to {sharedWithText}</Text>
        </View>
        <Text style={styles.date}>{formatDate(post.date)}</Text>
      </View>
      {/* Slot for specialized pre-content (e.g., Event title) */}
      {renderPreContent ? (typeof renderPreContent === 'function' ? renderPreContent() : renderPreContent) : null}
          <Text style={styles.content}>{post.text}</Text>
      {/* Image grid */}
      {renderImageGrid()}
      {/* Full-screen modal viewer */}
      {renderFullScreen()}
      {/* Slot for specialized footer content (e.g., Event details) */}
      {renderFooterContent ? (typeof renderFooterContent === 'function' ? renderFooterContent() : renderFooterContent) : null}
      {isNavigable && showDefaultCommentButton && (
        <TouchableOpacity
          style={styles.commentButton}
          onPress={() => navigation?.navigate('Comments', { postId: post.id })}
        >
          <Ionicons name="chatbox-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.actionButtonText}>{post.commentCount} comments</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const useStyles = makeStyles(theme => ({
  container: {
    backgroundColor: theme.colors.card,
    padding: 15,
    paddingHorizontal: 10,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.separator,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  authorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
  },
  author: {
    fontWeight: 'bold',
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  sharedWith: {
    fontSize: 16,
    color: theme.colors.textMuted,
    fontWeight: 'normal',
  },
  date: {
    color: theme.colors.textMuted,
    fontSize: 14,
    marginLeft: 8,
  },
  content: {
    fontSize: 16,
    marginBottom: 10,
    color: theme.colors.textPrimary,
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 1.6,
    borderRadius: 10,
    overflow: 'hidden',
    // backgroundColor: theme.colors.backgroundAlt || theme.colors.background,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  imageError: {
  color: 'red',
    fontSize: 12
  },
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  actionButtonText: {
    marginLeft: 4,
    color: theme.colors.primary,
  },
  // Grid styles
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
    flex:1,
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
    flex:1
  },
  moreOverlay: {
    position: 'absolute',
    top:0,
    left:0,
    right:0,
    bottom:0,
    backgroundColor:'rgba(0,0,0,0.45)',
    justifyContent:'center',
    alignItems:'center'
  },
  moreOverlayText: {
    color:'#fff',
    fontSize:28,
    fontWeight:'600'
  },
  // Fullscreen
  fullScreenOverlay: {
    flex:1,
    backgroundColor:'rgba(0,0,0,0.95)',
    justifyContent:'center',
    alignItems:'center'
  },
  fullScreenClose: {
    position:'absolute',
    top:40,
    right:20,
    zIndex:3
  },
  fullScreenBackdrop: {
    flex:1,
    width:'100%',
    justifyContent:'center',
    alignItems:'center',
    paddingHorizontal:12
  },
  fullScreenImage: {
    width:'100%',
    height:'100%'
  },
  navButton: {
    position:'absolute',
    top:'50%',
    marginTop:-32,
    padding:12,
    zIndex:3
  },
  navLeft: {
    left:10
  },
  navRight: {
    right:10
  },
  counterText: {
    position:'absolute',
    bottom:30,
    color:'#fff',
    fontSize:14,
    backgroundColor:'rgba(0,0,0,0.4)',
    paddingHorizontal:10,
    paddingVertical:4,
    borderRadius:12
  },
  twoRoot: { flexDirection:'row', width:'100%', height:220, borderRadius:10, overflow:'hidden', marginBottom:10 },
  twoImage: { flex:1 },
}));

export default Post;
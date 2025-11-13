import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { ApiClient } from 'services/apiClient';
import { PostImageGrid } from './PostImageGrid';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';
import { OptimisticPost, feedEvents, FEED_POST_STATUS_UPDATED } from 'hooks/feedEvents';
import Username from './Username';

interface PostProps {
  post: OptimisticPost,
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

  // Retry handler for failed posts
  const handleRetry = useCallback(async () => {
    if (!post._optimisticId || post._status !== 'failed') return;

    // Update status to pending
    feedEvents.emit(FEED_POST_STATUS_UPDATED, {
      optimisticId: post._optimisticId,
      status: 'pending',
    });

    // Retry the post creation
    try {
      // Check if it's an event or regular post based on properties
      const isEvent = (post as any).isEvent || (post as any).startDateTime;

      if (isEvent) {
        const response = await ApiClient.call(c =>
          c.event_CreateEvent({
            title: (post as any).title || '',
            text: post.text || '',
            startDateTime: (post as any).startDateTime,
            endDateTime: (post as any).endDateTime,
            circleIds: (post.sharedWithCircles || []).map(c => c.id),
          } as any)
        );
        feedEvents.emit(FEED_POST_STATUS_UPDATED, {
          optimisticId: post._optimisticId,
          status: 'posted',
          actualPost: response,
        });
      } else {
        // Regular post - prepare image file params if we have local images
        // Handle web vs native platform differences
        const fileParams = (post._localImages || []).map(img => ({
          data: img.webFile ? (img.webFile as any) : { uri: img.uri, name: img.fileName, type: img.type },
          fileName: img.fileName,
        }));

        const response = await ApiClient.call(c =>
          c.post_CreatePost(
            post.text || null,
            (post.sharedWithCircles || []).map(c => c.id),
            fileParams
          )
        );
        feedEvents.emit(FEED_POST_STATUS_UPDATED, {
          optimisticId: post._optimisticId,
          status: 'posted',
          actualPost: response,
        });
      }
    } catch (error) {
      console.error('Retry failed:', error);
      feedEvents.emit(FEED_POST_STATUS_UPDATED, {
        optimisticId: post._optimisticId,
        status: 'failed',
        error: 'Retry failed',
      });
    }
  }, [post]);

  useEffect(() => {
    // Reset animation values when shouldAnimate changes
    if (shouldAnimate) {
      translateY.setValue(100);
      opacity.setValue(0);
      scale.setValue(0.8);

      // Start the elastic spring animation with staggered delay
      const animateIn = () => {
        // console.log(`Starting animation for post ${post.id}`);
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
          // console.log(`Animation completed for post ${post.id}`);
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

  // Determine shared with text based on privacy settings
  let sharedWithText = "you";
  
  if (post.sharedWithCircles && post.sharedWithCircles.length > 0) {
    sharedWithText = post.sharedWithCircles.map(c => c.name).join(", ");
  } else if (post.sharedWithYouDirectly) {
    sharedWithText = "you";
  }
  
  // If post has shared users (visible only to post owner), show them
  if (post.sharedWithUsers && post.sharedWithUsers.length > 0) {
    const userNames = post.sharedWithUsers.map(u => u.name).join(", ");
    if (post.sharedWithCircles && post.sharedWithCircles.length > 0) {
      sharedWithText = `${sharedWithText} and ${userNames}`;
    } else {
      sharedWithText = userNames;
    }
  }

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

  const imageCount = (post as any).imageCount ?? (post.hasImage ? 1 : 0);

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }, { scale }], opacity }] }>
      <View style={styles.header}>
        <View style={styles.authorContainer}>
          <Username
            user={post.user}
            navigation={navigation}
            styles={{
              username: styles.author
            }}
          />
          <Text style={styles.sharedWith}> to {sharedWithText}</Text>
        </View>
        <Text style={styles.date}>{formatDate(post.date)}</Text>
      </View>
      {/* Slot for specialized pre-content (e.g., Event title) */}
      {renderPreContent ? (typeof renderPreContent === 'function' ? renderPreContent() : renderPreContent) : null}
      <Text style={styles.content}>{post.text}</Text>
      {/* Image grid with fullscreen viewer */}
      <PostImageGrid
        postId={post.id}
        hasImage={post.hasImage}
        imageCount={imageCount}
        localImages={post._localImages}
      />
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
      {/* Status indicator */}
      {post._status && post._status !== 'posted' && (
        <View style={styles.statusIndicator}>
          {post._status === 'pending' && (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={theme.colors.textMuted} style={styles.statusSpinner} />
              <Text style={styles.statusText}>Posting...</Text>
            </View>
          )}
          {post._status === 'failed' && (
            <TouchableOpacity style={styles.statusRow} onPress={handleRetry} activeOpacity={0.7}>
              <Ionicons name="alert-circle" size={14} color={theme.colors.danger} style={styles.statusIcon} />
              <Text style={styles.statusTextError}>Failed to post - Retry?</Text>
            </TouchableOpacity>
          )}
        </View>
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
  statusIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  statusTextError: {
    fontSize: 11,
    color: theme.colors.danger,
    fontWeight: '500',
  },
  statusSpinner: {
    marginRight: 2,
  },
  statusIcon: {
    marginRight: 2,
  },
}));

export default Post;
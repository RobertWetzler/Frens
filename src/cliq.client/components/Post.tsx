import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { PostDto as PostType} from 'services/generated/generatedClient'
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';

interface PostProps {
  post: PostType,
  navigation?: any;
  isNavigable?: boolean;
  animationDelay?: number;
  shouldAnimate?: boolean;
  // Optional render slots for specialized cards (e.g., Event)
  renderPreContent?: React.ReactNode | (() => React.ReactNode);
  renderFooterContent?: React.ReactNode | (() => React.ReactNode);
  // Allow callers to hide the default comment button when they need a custom footer layout
  showDefaultCommentButton?: boolean;
}

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

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [
            { translateY },
            { scale }
          ],
          opacity,
        }
      ]}
    >
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
}));

export default Post;
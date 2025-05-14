import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { PostDto as PostType} from 'services/generated/generatedClient'
import { Ionicons } from '@expo/vector-icons';

interface PostProps {
  post: PostType,
  navigation?: any;
  isNavigable?: boolean;
}

const Post: React.FC<PostProps> = ({ post, navigation, isNavigable = true }) => {
  const sharedWithText = post.sharedWithCircles && post.sharedWithCircles.length > 0 
    ? post.sharedWithCircles.map(c => c.circleName).join(", ")
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.authorContainer}>
          <Text style={styles.author}>{post.user.name}</Text>
          <Text style={styles.sharedWith}> shared with {sharedWithText}</Text>
        </View>
        <Text style={styles.date}>{formatDate(post.date)}</Text>
      </View>
      <Text style={styles.content}>{post.text}</Text>
      {isNavigable && (
        <TouchableOpacity
          style={styles.commentButton}
          onPress={() => navigation?.navigate('Comments', { postId: post.id })}
        >
          <Ionicons name="chatbox-outline" size={20} color="#1DA1F2" />
          <Text style={styles.actionButtonText}>{post.commentCount} comments</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    padding: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',  // Twitter-like separator color
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
  },
  sharedWith: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'normal',
  },
  date: {
    color: '#666',
    fontSize: 14,
    marginLeft: 8,
  },
  content: {
    fontSize: 16,
    marginBottom: 10,
  },
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  actionButtonText: {
    marginLeft: 4,
    color: '#1DA1F2',
  },
});

export default Post;
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
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.author}>{post.user.name}</Text>
        <Text style={styles.date}>{post.date.toLocaleString()}</Text>
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
  author: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  date: {
    color: '#666',
    fontSize: 14,
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
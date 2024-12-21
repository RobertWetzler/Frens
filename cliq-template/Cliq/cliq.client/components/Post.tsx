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
          style={styles.commentButton}  // Add this style
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
    borderRadius: 10,
    padding: 15,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    alignItems: 'center',  // This vertically centers the icon and text
    gap: 4,  // This adds space between the icon and text
  },
  commentButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  // Used just for the "N Comments" button
  actionButtonText: {
    marginLeft: 4,
    color: '#1DA1F2',
    },
});

export default Post;
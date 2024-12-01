import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Post as PostType} from 'services/generated/generatedClient'

interface PostProps {
  post: PostType,
  navigation: any;
}

const Post: React.FC<PostProps> = ({ post, navigation }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.author}>{post.user.name}</Text>
        <Text style={styles.date}>{post.date.toLocaleString()}</Text>
      </View>
      <Text style={styles.content}>{post.text}</Text>
      <TouchableOpacity
        style={styles.commentButton}
        onPress={() => navigation.navigate('Comments', { postId: post.id })}
      >
        <Text style={styles.commentButtonText}>View Comments</Text>
      </TouchableOpacity>
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
    backgroundColor: '#1DA1F2',
    padding: 8,
    borderRadius: 5,
    alignItems: 'center',
  },
  commentButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default Post;
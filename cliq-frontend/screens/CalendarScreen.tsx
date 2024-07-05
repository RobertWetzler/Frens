import React from 'react';
import { View, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import Post from '../components/Post';
import AnimatedBackground from '../components/AnimatedBackground';

const dummyPosts = [
  { id: '1', content: 'Hello, close friends!', author: 'Alice', circle: 'Best Friends' },
  { id: '2', content: 'Movie night tonight?', author: 'Bob', circle: 'Movie Buddies' },
  { id: '3', content: 'Just finished a great book!', author: 'Charlie', circle: 'Book Club' },
];

const HomeScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <AnimatedBackground />
      <FlatList
        data={dummyPosts}
        renderItem={({ item }) => (
          <Post post={item} navigation={navigation} />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  listContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },
});

export default HomeScreen;
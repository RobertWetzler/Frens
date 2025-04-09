import React, { useEffect } from 'react';
import { Text, View, FlatList, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Post from '../components/Post';
import { useAllPosts } from 'hooks/usePosts';
import ShaderBackground from 'components/ShaderBackground';


const HomeScreen = ({ navigation }) => {
    const { posts, isLoading, error, loadPosts } = useAllPosts();
    // Useful for debugging hook transitions
    /*
    useEffect(() => {
        console.log('Posts state:', posts);
        console.log('Is Loading:', isLoading);
        console.log('Error:', error);
    }, [posts, isLoading, error]);  */
    
  const insets = useSafeAreaInsets();
   // Render loading state
   if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
      <ActivityIndicator size={36} color="#0000ff" />
      </SafeAreaView>
    );
  }

  // Render error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
      <ShaderBackground />
      <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={posts}
        renderItem={({ item }) => (
          <Post post={item} navigation={navigation} />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 60 } // Add extra padding for the tab bar
        ]}
        // Add these props for better UX
        refreshing={isLoading}
        onRefresh={() => {
          // Implement pull-to-refresh functionality
          loadPosts();
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No posts found</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  listContent: {
    paddingTop: 16,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    color: '#888',
  },
});

export default HomeScreen;
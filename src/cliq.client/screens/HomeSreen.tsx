import React, { useEffect, useRef } from 'react';
import { Text, View, FlatList, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity, Share, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Post from '../components/Post';
import getEnvVars from 'env'
import { useFeed } from 'hooks/usePosts';
import ShaderBackground from 'components/ShaderBackground';
import { useAuth } from 'contexts/AuthContext';
import { handleShareProfile } from 'utils/share';
import NotificationBell from 'components/NotificationBell';
import NotificationSubscribeButton from 'components/NotificationSubscribeButton';


const HomeScreen = ({ navigation }) => {
    const { posts, notificationCount, isLoading, error, loadFeed } = useFeed();
    const authContext = useAuth();
    const scrollY = useRef(new Animated.Value(0)).current;
    
    // Useful for debugging hook transitions
    /*
    useEffect(() => {
        console.log('Posts state:', posts);
        console.log('Is Loading:', isLoading);
        console.log('Error:', error);
    }, [posts, isLoading, error]);  */

    const insets = useSafeAreaInsets();

    // Header animation values
    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });

    const headerTranslateY = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [0, -50],
        extrapolate: 'clamp',
    });

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
            <Animated.View
                style={[
                    styles.headerContainer,
                    {
                        opacity: headerOpacity,
                        transform: [{ translateY: headerTranslateY }],
                    },
                ]}
            >
                <LinearGradient
                    colors={['#6699FF', '#9966FF','#8C66FF']}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 0, y: 0 }}
                    style={styles.headerGradient}
                >
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Frens</Text>
                        <NotificationBell 
                            onPress={() => navigation.navigate('Notifications')} 
                            iconColor="white"
                            notificationCount={notificationCount}
                        />        
                    </View>
                </LinearGradient>
            </Animated.View>
            
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
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
                // Add these props for better UX
                refreshing={isLoading}
                onRefresh={() => {
                    // Implement pull-to-refresh functionality
                    loadFeed();
                }}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={64} color="#e1e4e8" />
                        <Text style={styles.emptyText}>No posts found</Text>
                        <Text style={styles.emptySubtext}>
                            Connect with friends to see their posts in your feed
                        </Text>
                    </View>
                )}
                ListFooterComponent={() => (
                    <View style={styles.footerContainer}>
                        <NotificationSubscribeButton
                            applicationServerKey={getEnvVars().VAPID_PUBLIC_KEY}
                            onSubscriptionChange={(subscription) => {
                                if (subscription) {
                                    console.log('User subscribed to notifications');
                                    // Send subscription to your server
                                }
                            }}
                            style={posts && posts.length > 0 && { marginTop: 20 }}
                        />
                        <TouchableOpacity 
                            style={[styles.shareButton, posts && posts.length > 0 && { marginTop: 20 }]}
                            onPress={() => handleShareProfile(authContext.user.id)}
                        >
                            <Ionicons name="share-outline" size={20} color="white" style={styles.shareIcon} />
                            <Text style={styles.shareButtonText}>Share profile to add frens</Text>
                        </TouchableOpacity>
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
    headerContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
    },
    headerGradient: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.2)',
        shadowColor: '#8C66FF',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: {
        fontSize: 25,
        fontWeight: 'bold',
        color: 'white',
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    listContent: {
        paddingTop: 80, // Add padding to account for the absolute positioned header
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
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 20,
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 16,
        color: '#8e8e8e',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 22,
    },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1DA1F2',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 25,
        shadowColor: '#1DA1F2',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    shareIcon: {
        marginRight: 8,
    },
    shareButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    footerContainer: {
        alignItems: 'center',
        paddingVertical: 0,
        paddingHorizontal: 16,
    },
});

export default HomeScreen;
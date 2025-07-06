import React, { useEffect, useRef, useState } from 'react';
import { Text, View, FlatList, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity, Share, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Post from '../components/Post';
import getEnvVars from 'env'
import { useFeed } from 'hooks/usePosts';
import { useAuth } from 'contexts/AuthContext';
import { handleShareProfile } from 'utils/share';
import NotificationBell from 'components/NotificationBell';
import NotificationSubscribeButton from 'components/NotificationSubscribeButton';
import PWAInstallBanner from 'components/PWAInstallBanner';
import { useShaderBackground } from 'contexts/ShaderBackgroundContext';


const HomeScreen = ({ navigation }) => {
    const { posts, notificationCount, isLoading, error, loadFeed } = useFeed();
    const authContext = useAuth();
    const { isExpanded, animateToExpanded } = useShaderBackground();
    const scrollY = useRef(new Animated.Value(0)).current;
    const [isPWABannerVisible, setIsPWABannerVisible] = useState(true);
    const [isFirstLoad, setIsFirstLoad] = useState(true);

    // Calculate how many posts should be animated (visible on initial screen load)
    const VISIBLE_POSTS_COUNT = 7;
    const ANIMATION_DELAY = 1000;

    // Useful for debugging hook transitions
    /*
    useEffect(() => {
        console.log('Posts state:', posts);
        console.log('Is Loading:', isLoading);
        console.log('Error:', error);
    }, [posts, isLoading, error]);  */

    // Ensure shader background is expanded when HomeScreen is displayed
    useEffect(() => {
        if (!isExpanded) {
            animateToExpanded();
        }
    }, [isExpanded, animateToExpanded]);

    // Mark that we've moved past first load when posts come in
    useEffect(() => {
        if (posts && posts.length > 0 && !isLoading) {
            // Calculate total animation time: 2s initial delay + time for all visible posts to animate
            const totalAnimationTime = ANIMATION_DELAY + (VISIBLE_POSTS_COUNT * 150) + 600; // +600ms for last animation to complete
            const timer = setTimeout(() => {
                setIsFirstLoad(false);
            }, totalAnimationTime);
            return () => clearTimeout(timer);
        }
    }, [posts, isLoading]);

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
            <SafeAreaView style={[styles.container, isExpanded && styles.expandedContainer]}>
                <ActivityIndicator size={36} color="#0000ff" />
            </SafeAreaView>
        );
    }

    // Render error state
    if (error) {
        return (
            <SafeAreaView style={[styles.container, isExpanded && styles.expandedContainer]}>
                <Text style={styles.errorText}>{error}</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, isExpanded && styles.expandedContainer]}>
            <PWAInstallBanner
                onDismiss={() => setIsPWABannerVisible(false)}
                onVisibilityChange={setIsPWABannerVisible}
            />
            <Animated.View
                style={[
                    styles.headerContainer,
                    {
                        opacity: headerOpacity,
                        transform: [{ translateY: headerTranslateY }],
                        top: isPWABannerVisible ? 66 : 0, // Adjust based on banner visibility (exact banner height)
                    },
                ]}
            >
                <LinearGradient
                    colors={['#6699FF', '#9966FF', '#8C66FF']}
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
                renderItem={({ item, index }) => {
                    const shouldAnimate = isFirstLoad && index < VISIBLE_POSTS_COUNT;
                    const animationDelay = shouldAnimate ? ANIMATION_DELAY + (index * 150) : 0; // 2 second initial delay + stagger
                    
                    return (
                        <Post 
                            post={item} 
                            navigation={navigation}
                            shouldAnimate={shouldAnimate}
                            animationDelay={animationDelay}
                        />
                    );
                }}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[
                    styles.listContent,
                    {
                        paddingTop: isPWABannerVisible ? 122 : 76, // Exact total height: banner(66) + header(56) or just header(56)
                        paddingBottom: insets.bottom + 60
                    }
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
                ListHeaderComponent={() => (
                    <NotificationSubscribeButton
                        applicationServerKey={getEnvVars().VAPID_PUBLIC_KEY}
                        onSubscriptionChange={(subscription) => {
                            if (subscription) {
                                console.log('User subscribed to notifications');
                                // Send subscription to your server
                            }
                        }}
                    />
                )}
                ListFooterComponent={() => (
                    <View style={styles.footerContainer}>
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
    expandedContainer: {
        backgroundColor: 'transparent',
    },
    headerContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000, // High z-index to stay above shader background
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
        // Base padding will be set dynamically in the component
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
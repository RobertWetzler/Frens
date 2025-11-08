import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View, FlatList, SafeAreaView, ActivityIndicator, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Post from '../components/Post';
import getEnvVars from 'env'
import { useFilteredFeed } from 'hooks/usePosts';
import { useAuth } from 'contexts/AuthContext';
import { handleShareProfile } from 'utils/share';
import NotificationBell from 'components/NotificationBell';
import NotificationSubscribeButton from 'components/NotificationSubscribeButton';
import PWAInstallBanner from 'components/PWAInstallBanner';
import CircleFilter from 'components/CircleFilter';
import { useShaderBackground } from 'contexts/ShaderBackgroundContext';
import { EventDto } from 'services/generated/generatedClient';
import Event from 'components/Event';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';


const HomeScreen = ({ navigation }) => {
    const {
        posts,
        circles,
        notificationCount,
        isLoading,
        isRefreshing,
        isFiltering,
        isPostTransition,
        isLoadingMore,
        hasMore,
        error,
        loadFeed,
        loadMore,
        selectedCircleIds,
        updateFilter,
        clearFilter
    } = useFilteredFeed();
    const authContext = useAuth();
    const { isExpanded, animateToExpanded } = useShaderBackground();
    const scrollY = useRef(new Animated.Value(0)).current;
    const [isPWABannerVisible, setIsPWABannerVisible] = useState(true);
    const [isFirstLoad, setIsFirstLoad] = useState(true);
    const [isFilterExpanded, setIsFilterExpanded] = useState(false);
    const { theme } = useTheme();
    const styles = useStyles();

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

    // Mark that we've moved past first load when posts come in (only for initial load)
    useEffect(() => {
        if (posts && posts.length > 0 && !isLoading && isFirstLoad) {
            // Calculate total animation time: 2s initial delay + time for all visible posts to animate
            const totalAnimationTime = ANIMATION_DELAY + (VISIBLE_POSTS_COUNT * 150) + 600; // +600ms for last animation to complete
            const timer = setTimeout(() => {
                setIsFirstLoad(false);
            }, totalAnimationTime);
            return () => clearTimeout(timer);
        }
    }, [posts, isLoading, isFirstLoad]);

    // Track when posts arrive after filtering to trigger re-animation
    const [shouldAnimateAfterFilter, setShouldAnimateAfterFilter] = useState(false);
    
    useEffect(() => {
        if (posts && posts.length > 0 && isPostTransition) {
            setShouldAnimateAfterFilter(true);
            // Reset after animation completes
            const totalAnimationTime = (VISIBLE_POSTS_COUNT * 150) + 600;
            const timer = setTimeout(() => {
                setShouldAnimateAfterFilter(false);
            }, totalAnimationTime);
            return () => clearTimeout(timer);
        }
    }, [posts, isPostTransition]);

    const insets = useSafeAreaInsets();

    // Circle filter handlers
    const handleCircleToggle = (circleId: string) => {
        const newSelectedIds = selectedCircleIds.includes(circleId)
            ? selectedCircleIds.filter(id => id !== circleId)
            : [...selectedCircleIds, circleId];
        updateFilter(newSelectedIds);
        // Close the dropdown after selection
        setIsFilterExpanded(false);
    };

    const handleClearAllFilters = () => {
        clearFilter();
        // Close the dropdown after clearing
        setIsFilterExpanded(false);
    };

    const handleToggleFilterExpanded = () => {
        setIsFilterExpanded(!isFilterExpanded);
    };

    const handleLoadMore = useCallback(() => {
        if (!hasMore || isLoading || isRefreshing || isLoadingMore || isFiltering || isPostTransition) {
            return;
        }
        loadMore();
    }, [hasMore, isLoading, isRefreshing, isLoadingMore, isFiltering, isPostTransition, loadMore]);

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
                <ActivityIndicator size={36} color={theme.colors.primary} />
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
                    colors={(theme.gradients?.accent || ['#4F46E5', '#7C3AED']) as [string, string]}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 0, y: 0 }}
                    style={styles.headerGradient}
                >
                    <View style={styles.header}>
                        <View style={styles.titleRow}>
                            <Text style={[styles.headerTitle, theme.name === 'halloween' && { fontFamily: 'SpookyHalloween', fontWeight: '400' }]}>Frens</Text>
                            {/* <Text style={[styles.headerSubtitle, theme.name === 'halloween' && { fontFamily: 'SpookyHalloween', fontWeight: '400' }]}>Spooky Edition</Text> */}
                        </View>
                        <NotificationBell
                            onPress={() => navigation.navigate('Notifications')}
                            iconColor={theme.colors.primaryContrast}
                            notificationCount={notificationCount}
                        />
                    </View>
                </LinearGradient>
            </Animated.View>

            {/* Circle Filter */}
            <FlatList
                data={posts}
                renderItem={({ item, index }) => {
                    // Animate on initial load OR after filtering
                    const shouldAnimate = (isFirstLoad && index < VISIBLE_POSTS_COUNT) || shouldAnimateAfterFilter;
                    
                    let animationDelay = 0;
                    if (isFirstLoad && index < VISIBLE_POSTS_COUNT) {
                        // Initial load: long delay + stagger
                        animationDelay = ANIMATION_DELAY + (index * 150);
                    } else if (shouldAnimateAfterFilter) {
                        // Filter transition: immediate stagger, no initial delay
                        animationDelay = index * 150;
                    }
                    
                    // Identify Event posts robustly: instance check and discriminator fallback
                    const isEvent = item instanceof EventDto || (item && (item as any).discriminator === 'Event' || (item as any)._discriminator === 'Event');

                    if (isEvent) {
                        return (
                            <Event
                                event={item as EventDto}
                                navigation={navigation}
                                shouldAnimate={shouldAnimate}
                                animationDelay={animationDelay}
                            />
                        );
                    }

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
                ListHeaderComponent={() => (
                    <View>
                        {/* Only show circle filter if user has more than one circle */}
                        {circles && circles.length > 1 && (
                            <View style={styles.filterContainer}>
                                <CircleFilter
                                    circles={circles}
                                    selectedCircleIds={selectedCircleIds}
                                    onCircleToggle={handleCircleToggle}
                                    onClearAll={handleClearAllFilters}
                                    isExpanded={isFilterExpanded}
                                    onToggleExpanded={handleToggleFilterExpanded}
                                    shouldAnimate={isFirstLoad}
                                    animationDelay={ANIMATION_DELAY}
                                />
                                {/* Subtle filtering indicator */}
                                {isFiltering && (
                                    <View style={styles.filteringIndicator}>
                                        <ActivityIndicator size="small" color={theme.colors.textMuted} />
                                        <Text style={styles.filteringText}>Updating feed...</Text>
                                    </View>
                                )}
                            </View>
                        )}
                        <NotificationSubscribeButton
                            applicationServerKey={getEnvVars().VAPID_PUBLIC_KEY}
                            onSubscriptionChange={(subscription) => {
                                if (subscription) {
                                    console.log('User subscribed to notifications');
                                    // Send subscription to your server
                                }
                            }}
                        />
                    </View>
                )}
                contentContainerStyle={[
                    styles.listContent,
                    {
                        paddingTop: isPWABannerVisible ? 122 : 76, // Header height + banner height + spacing
                        paddingBottom: insets.bottom + 60
                    }
                ]}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
                scrollEnabled={!isFilterExpanded} // Disable scrolling when filter dropdown is expanded
                // Add these props for better UX
                refreshing={isRefreshing}
                onRefresh={() => {
                    // Implement pull-to-refresh functionality
                    loadFeed();
                }}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.4}
                ListEmptyComponent={() => {
                    // Don't show empty state while loading, filtering, transitioning, or animating
                    if (isLoading || isFiltering || isPostTransition || shouldAnimateAfterFilter || isFirstLoad) {
                        return null;
                    }
                    
                    return (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="people-outline" size={64} color={theme.colors.separator} />
                            <Text style={styles.emptyText}>No posts found</Text>
                            <Text style={styles.emptySubtext}>
                                Connect with friends to see their posts in your feed
                            </Text>
                        </View>
                    );
                }}
                ListFooterComponent={() => (
                    <View style={styles.footerContainer}>
                        {isLoadingMore && (
                            <ActivityIndicator
                                size="small"
                                color={theme.colors.primary}
                                style={styles.loadingMoreIndicator}
                            />
                        )}
                        {!isLoadingMore && !hasMore && posts && posts.length > 0 && (
                            <Text style={styles.endOfFeedText}>You're all caught up</Text>
                        )}
                        <TouchableOpacity
                            style={[styles.shareButton, posts && posts.length > 0 && { marginTop: 20 }]}
                            onPress={() => handleShareProfile(authContext.user.id)}
                        >
                            <Ionicons name="share-outline" size={20} color={theme.colors.primaryContrast} style={styles.shareIcon} />
                            <Text style={styles.shareButtonText}>Share profile to add frens</Text>
                        </TouchableOpacity>
                    </View>
                )}
            />
        </SafeAreaView>
    );
};
// makeStyles at bottom
const useStyles = makeStyles((theme) => ({
    container: { flex: 1, backgroundColor: theme.colors.backgroundAlt },
    expandedContainer: { backgroundColor: 'transparent' },
    headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 },
    headerGradient: {
        paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.2)',
        shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: { fontSize: 30, fontWeight: 'bold', color: theme.colors.primaryContrast, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
    titleRow: { flexDirection: 'row', alignItems: 'baseline' },
    headerSubtitle: { fontSize: 20, fontWeight: '600', color: theme.colors.primaryContrast, marginLeft: 10, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
    filterContainer: { marginHorizontal: 16, marginVertical: 2 },
    filteringIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, marginTop: 8 },
    filteringText: { marginLeft: 8, fontSize: 14, color: theme.colors.textMuted, fontStyle: 'italic' },
    listContent: {},
    errorText: { color: theme.colors.danger, textAlign: 'center', marginTop: 20 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
    emptyText: { fontSize: 24, fontWeight: 'bold', color: theme.colors.textPrimary, marginTop: 20, marginBottom: 8 },
    emptySubtext: { fontSize: 16, color: theme.colors.textMuted, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
    shareButton: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.primary, paddingVertical: 14, paddingHorizontal: 24,
        borderRadius: 25, shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    },
    shareIcon: { marginRight: 8 },
    shareButtonText: { color: theme.colors.primaryContrast, fontSize: 16, fontWeight: '600' },
    footerContainer: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
    loadingMoreIndicator: { marginBottom: 16 },
    endOfFeedText: { fontSize: 14, color: theme.colors.textMuted, marginBottom: 8 },
}));

export default HomeScreen;

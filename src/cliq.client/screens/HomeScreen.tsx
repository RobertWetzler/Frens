// Home feed screen. Now supports infinite scroll and pull-to-refresh
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View, FlatList, SafeAreaView, ActivityIndicator, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Post from '../components/Post';
import SubscribableCirclesCard from '../components/SubscribableCirclesCard';
import RecommendedFriendsCard from '../components/RecommendedFriendsCard';
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
import { useSnowCollision } from 'contexts/SnowCollisionContext';
import { Svg, Circle, Ellipse, Path, Rect, Line } from 'react-native-svg';


const HomeScreen = ({ navigation }) => {
    // Extended hook data includes pagination + refresh states
    const {
        posts,
        circles,
        availableSubscribableCircles,
        recommendedFriends,
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
    const { setIsPilingActive } = useSnowCollision();
    const scrollY = useRef(new Animated.Value(0)).current;
    const [isPWABannerVisible, setIsPWABannerVisible] = useState(true);
    const [isFirstLoad, setIsFirstLoad] = useState(true);
    const [isFilterExpanded, setIsFilterExpanded] = useState(false);
    const [firstPostHeight, setFirstPostHeight] = useState<number>(0);
    const [isPilingDelayComplete, setIsPilingDelayComplete] = useState(false);
    const { theme } = useTheme();
    const styles = useStyles();
    
    // Only enable snow piling computations when theme is holiday
    const isHolidayTheme = theme.name === 'holiday';

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

    // Disable snow piling during initial animation, enable after delay (only for holiday theme)
    useEffect(() => {
        // Skip all piling computations if not holiday theme
        if (!isHolidayTheme) return;
        
        // Start with piling disabled
        setIsPilingActive(false);
        
        if (posts && posts.length > 0 && !isLoading) {
            // Enable piling after animation completes (ANIMATION_DELAY + some buffer for first post to animate in)
            const pilingDelay = ANIMATION_DELAY + 2000; // Wait for first post animation to complete
            const timer = setTimeout(() => {
                setIsPilingDelayComplete(true);
                setIsPilingActive(true);
                console.log('Snow: Piling enabled after initial animation');
            }, pilingDelay);
            
            return () => clearTimeout(timer);
        }
    }, [posts, isLoading, setIsPilingActive, isHolidayTheme]);

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

    // Toggle filter dropdown
    const handleToggleFilterExpanded = () => {
        setIsFilterExpanded(!isFilterExpanded);
    };

    // Guarded onEndReached handler so we don't fire overlapping requests
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
                {/* <ActivityIndicator size={36} color={theme.colors.primary} /> */}
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
                            {theme.name === 'holiday' && (
                                <View style={{ marginRight: 8 }}>
                                    <Svg width={32} height={40} viewBox="0 0 40 50">
                                        {/* Bottom snowball */}
                                        <Circle cx={20} cy={40} r={10} fill="#FFFFFF" stroke="#E0E0E0" strokeWidth={1} />
                                        {/* Middle snowball */}
                                        <Circle cx={20} cy={26} r={8} fill="#FFFFFF" stroke="#E0E0E0" strokeWidth={1} />
                                        {/* Head */}
                                        <Circle cx={20} cy={14} r={6} fill="#FFFFFF" stroke="#E0E0E0" strokeWidth={1} />
                                        {/* Top hat */}
                                        <Rect x={13} y={6} width={14} height={2} fill="#2C2C2C" />
                                        <Rect x={15} y={0} width={10} height={6} fill="#2C2C2C" />
                                        <Rect x={15} y={3} width={10} height={2} fill="#C41E3A" />
                                        {/* Eyes */}
                                        <Circle cx={17} cy={12} r={1} fill="#2C2C2C" />
                                        <Circle cx={23} cy={12} r={1} fill="#2C2C2C" />
                                        {/* Carrot nose */}
                                        <Path d="M20 14 L26 15 L20 16 Z" fill="#FF6B35" />
                                        {/* Smile */}
                                        <Circle cx={16} cy={17} r={0.7} fill="#2C2C2C" />
                                        <Circle cx={18.5} cy={18} r={0.7} fill="#2C2C2C" />
                                        <Circle cx={21.5} cy={18} r={0.7} fill="#2C2C2C" />
                                        <Circle cx={24} cy={17} r={0.7} fill="#2C2C2C" />
                                        {/* Scarf */}
                                        <Path d="M14 20 Q20 22 26 20" stroke="#C41E3A" strokeWidth={2} fill="none" />
                                        <Rect x={24} y={20} width={3} height={8} rx={1} fill="#C41E3A" />
                                        {/* Buttons */}
                                        <Circle cx={20} cy={24} r={1} fill="#2C2C2C" />
                                        <Circle cx={20} cy={28} r={1} fill="#2C2C2C" />
                                        {/* Arms (sticks) */}
                                        <Line x1={12} y1={26} x2={4} y2={22} stroke="#8B4513" strokeWidth={1.5} strokeLinecap="round" />
                                        <Line x1={28} y1={26} x2={36} y2={22} stroke="#8B4513" strokeWidth={1.5} strokeLinecap="round" />
                                        {/* Twig fingers on left arm */}
                                        <Line x1={4} y1={22} x2={2} y2={19} stroke="#8B4513" strokeWidth={1} strokeLinecap="round" />
                                        <Line x1={4} y1={22} x2={1} y2={23} stroke="#8B4513" strokeWidth={1} strokeLinecap="round" />
                                        {/* Twig fingers on right arm */}
                                        <Line x1={36} y1={22} x2={38} y2={19} stroke="#8B4513" strokeWidth={1} strokeLinecap="round" />
                                        <Line x1={36} y1={22} x2={39} y2={23} stroke="#8B4513" strokeWidth={1} strokeLinecap="round" />
                                    </Svg>
                                </View>
                            )}
                            <Text style={[styles.headerTitle, theme.name === 'halloween' && { fontFamily: 'SpookyHalloween', fontWeight: '400' }]}>Frens</Text>
                            {/* <Text style={[styles.headerSubtitle, theme.name === 'halloween' && { fontFamily: 'SpookyHalloween', fontWeight: '100' }]}>spooky edition</Text> */}
                            {/* <Text style={[styles.headerSubtitle, { fontFamily: 'Holiday', fontSize: 20, fontWeight: '100' }]}>Sleigh edition</Text> */}
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
                            <>
                                <Event
                                    event={item as EventDto}
                                    navigation={navigation}
                                    shouldAnimate={shouldAnimate}
                                    animationDelay={animationDelay}
                                />
                                {/* Show subscribable circles card after the second post (index 1), or after first if only 1-2 posts */}
                                {availableSubscribableCircles && availableSubscribableCircles.length > 0 && 
                                 ((posts && posts.length >= 2 && index === 1) || (posts && posts.length < 2 && index === posts.length - 1)) && (
                                    <SubscribableCirclesCard
                                        circles={availableSubscribableCircles}
                                        shouldAnimate={shouldAnimate}
                                        animationDelay={animationDelay + 150}
                                        onCircleSubscribed={(circleId) => {
                                            // Refresh feed after subscribing to get new posts from that circle
                                            // loadFeed();
                                        }}
                                    />
                                )}
                                {/* Show recommended friends card after subscribable circles (or after second post if no circles) */}
                                {recommendedFriends && recommendedFriends.length > 0 && 
                                 ((posts && posts.length >= 2 && index === 1) || (posts && posts.length < 2 && index === posts.length - 1)) && (
                                    <RecommendedFriendsCard
                                        friends={recommendedFriends}
                                        shouldAnimate={shouldAnimate}
                                        animationDelay={animationDelay + (availableSubscribableCircles?.length > 0 ? 300 : 150)}
                                        onFriendRequestSent={(userId) => {
                                            // Optionally refresh feed after sending friend request
                                        }}
                                    />
                                )}
                            </>
                        );
                    }

                    return (
                        <>
                            <Post
                                post={item}
                                navigation={navigation}
                                shouldAnimate={shouldAnimate}
                                animationDelay={animationDelay}
                                isFirstPost={index === 0}
                                onFirstPostLayout={index === 0 ? setFirstPostHeight : undefined}
                            />
                            {/* Show subscribable circles card after the second post (index 1), or after first if only 1-2 posts */}
                            {availableSubscribableCircles && availableSubscribableCircles.length > 0 && 
                             ((posts && posts.length >= 2 && index === 1) || (posts && posts.length < 2 && index === posts.length - 1)) && (
                                <SubscribableCirclesCard
                                    circles={availableSubscribableCircles}
                                    shouldAnimate={shouldAnimate}
                                    animationDelay={animationDelay + 150}
                                    onCircleSubscribed={(circleId) => {
                                        // Refresh feed after subscribing to get new posts from that circle
                                        loadFeed();
                                    }}
                                />
                            )}
                            {/* Show recommended friends card after subscribable circles (or after second post if no circles) */}
                            {recommendedFriends && recommendedFriends.length > 0 && 
                             ((posts && posts.length >= 2 && index === 1) || (posts && posts.length < 2 && index === posts.length - 1)) && (
                                <RecommendedFriendsCard
                                    friends={recommendedFriends}
                                    shouldAnimate={shouldAnimate}
                                    animationDelay={animationDelay + (availableSubscribableCircles?.length > 0 ? 300 : 150)}
                                    onFriendRequestSent={(userId) => {
                                        // Optionally refresh feed after sending friend request
                                    }}
                                />
                            )}
                        </>
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
                onScroll={(event) => {
                    // Update animated scroll value
                    scrollY.setValue(event.nativeEvent.contentOffset.y);
                    
                    // Only manage piling based on scroll if initial delay is complete AND holiday theme
                    if (isHolidayTheme && isPilingDelayComplete) {
                        // Check if scrolled past first post height (deactivate snow piling)
                        const scrollOffset = event.nativeEvent.contentOffset.y;
                        const threshold = firstPostHeight > 0 ? firstPostHeight / 8 : 150; // Default to 150 if not measured
                        setIsPilingActive(scrollOffset < threshold);
                    }
                }}
                scrollEventThrottle={16}
                scrollEnabled={!isFilterExpanded} // Disable scrolling when filter dropdown is expanded
                // Pull-to-refresh uses hook's refresh state
                refreshing={isRefreshing}
                onRefresh={() => {
                    // Reload first page while keeping filters applied
                    loadFeed();
                }}
                // Infinite scroll
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
                // Footer shows loading-more spinner or end-of-feed note, plus share CTA
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
                        )}x
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
    headerTitle: { fontSize: 38, fontWeight: 'bold', color: theme.colors.primaryContrast, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
    titleRow: { flexDirection: 'row', alignItems: 'baseline' },
    headerSubtitle: { fontSize: 17, fontWeight: '600', color: theme.colors.primaryContrast, marginLeft: 5, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
    filterContainer: { marginHorizontal: 16, marginVertical: 5, marginTop: 8 },
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

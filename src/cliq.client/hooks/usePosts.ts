import { useState, useEffect, useCallback } from 'react';
import { FeedDto, PostDto, CirclePublicDto } from '../services/generated/generatedClient';
import { ApiClient } from 'services/apiClient';

export function useFeed() {
    const [posts, setPosts] = useState<PostDto[]>([]);
    const [notificationCount, setNotificationCount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadFeed = async () => {
        try {
            setIsLoading(true);
            // TODO add pagination
            const feedResponse = await ApiClient.call(c => c.post_GetFeed());
            setPosts(feedResponse.posts);
            setNotificationCount(feedResponse.notificationCount)
            setError(null);
        } catch (err) {
            console.log("Failed to load feed with err " + err)
            setError('Failed to load feed');
            setPosts([]);
            setNotificationCount(0);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadFeed();
    }, []);

    return { posts, notificationCount, isLoading, error, loadFeed };
}

export function usePost(postId: string, includeComments: true) {
    const [post, setPost] = useState<PostDto>();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadPost = async () => {
        try {
            setIsLoading(true);
            const post = await ApiClient.call(c => c.post_GetPost(postId, includeComments));
            console.log("Loaded post with result: " + post);
            setPost(post);
            setError(null);
        } catch (err) {
            console.log("Failed to load post with err " + err)
            setError('Failed to load posts');
            setPost(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPost();
    }, []);

    return { post, isLoading, error, loadPost };
}

export function useFilteredFeed() {
    const [posts, setPosts] = useState<PostDto[]>([]);
    const [notificationCount, setNotificationCount] = useState<number>(0);
    const [circles, setCircles] = useState<CirclePublicDto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFiltering, setIsFiltering] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isPostTransition, setIsPostTransition] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedCircleIds, setSelectedCircleIds] = useState<string[]>([]);

    const loadFeedInternal = useCallback(async (
        circleIds?: string[],
        options?: { isFilterUpdate?: boolean; isManualRefresh?: boolean }
    ) => {
        const { isFilterUpdate = false, isManualRefresh = false } = options ?? {};
        try {
            if (isFilterUpdate) {
                setIsFiltering(true);
                setIsPostTransition(true);
            } else if (isManualRefresh) {
                setIsRefreshing(true);
            } else {
                setIsLoading(true);
            }

            let feedResponse: FeedDto;
            if (circleIds && circleIds.length > 0) {
                // Filter by specific circles
                const circleIdsParam = circleIds.join(',');
                feedResponse = await ApiClient.call(c => c.post_GetFilteredFeed(1, 20, circleIdsParam));
            } else {
                // Get all posts
                feedResponse = await ApiClient.call(c => c.post_GetFeed());
            }
            
            if (isFilterUpdate) {
                // For filter updates, clear posts first to trigger exit animation
                setPosts([]);
                // Then set new posts after a brief delay to trigger enter animation
                setTimeout(() => {
                    setPosts(feedResponse.posts || []);
                    setIsPostTransition(false);
                }, 300); // Brief delay for smooth transition
            } else {
                setPosts(feedResponse.posts || []);
            }

            setNotificationCount(feedResponse.notificationCount || 0);
            setCircles(feedResponse.userCircles || []);
            setError(null);
            
            // Mark initial load as complete after first successful load
            if (isInitialLoad) {
                setIsInitialLoad(false);
            }
        } catch (err) {
            console.log("Failed to load filtered feed with err " + err)
            setError('Failed to load feed');
            setPosts([]);
            setNotificationCount(0);
            setCircles([]);
            setIsPostTransition(false);
        } finally {
            if (isFilterUpdate) {
                setIsFiltering(false);
            } else if (isManualRefresh) {
                setIsRefreshing(false);
            } else {
                setIsLoading(false);
            }
        }
    }, [isInitialLoad]);

    const updateFilter = useCallback((circleIds: string[]) => {
        setSelectedCircleIds(circleIds);
        loadFeedInternal(circleIds, { isFilterUpdate: true }); // Skip loading state for smooth filtering
    }, [loadFeedInternal]);

    const clearFilter = useCallback(() => {
        setSelectedCircleIds([]);
        loadFeedInternal([], { isFilterUpdate: true }); // Skip loading state for smooth filtering
    }, [loadFeedInternal]);

    useEffect(() => {
        loadFeedInternal(selectedCircleIds); // Initial load should show loading state
    }, []);

    const refreshFeed = useCallback(() => {
        return loadFeedInternal(selectedCircleIds, { isManualRefresh: true });
    }, [loadFeedInternal, selectedCircleIds]);

    return {
        posts,
        circles,
        notificationCount,
        isLoading: isLoading && isInitialLoad, // Only show loading on initial load
        isFiltering,
        isPostTransition, // New state for post transition animations
        isRefreshing,
        error,
        loadFeed: refreshFeed,
        selectedCircleIds,
        updateFilter,
        clearFilter
    };
}

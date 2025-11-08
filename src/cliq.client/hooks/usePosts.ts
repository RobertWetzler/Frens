import { useState, useEffect, useCallback, useRef } from 'react';
import { FeedDto, PostDto, CirclePublicDto } from '../services/generated/generatedClient';
import { ApiClient } from 'services/apiClient';

const FEED_PAGE_SIZE = 20;

type FeedFetchMode = 'initial' | 'refresh' | 'filter' | 'append';

interface FeedFetchOptions {
    page: number;
    circleIdsOverride?: string[];
    mode: FeedFetchMode;
}

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
            const post = await ApiClient.call(c => c.post_GetPost(postId, includeComments, false));
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
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isFiltering, setIsFiltering] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isPostTransition, setIsPostTransition] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedCircleIds, setSelectedCircleIds] = useState<string[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const filterAnimationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearPendingFilterAnimation = useCallback(() => {
        if (filterAnimationTimeoutRef.current) {
            clearTimeout(filterAnimationTimeoutRef.current);
            filterAnimationTimeoutRef.current = null;
        }
    }, []);

    const fetchFeed = useCallback(async ({ page: pageToLoad, circleIdsOverride, mode }: FeedFetchOptions) => {
        const targetCircleIds = circleIdsOverride ?? selectedCircleIds;
        const isAppendMode = mode === 'append';
        const isFilterMode = mode === 'filter';
        const isInitialMode = mode === 'initial';
        const isRefreshMode = mode === 'refresh';

        try {
            if (isAppendMode) {
                setIsLoadingMore(true);
            } else if (isFilterMode) {
                setIsFiltering(true);
                setIsPostTransition(true);
            } else if (isRefreshMode) {
                setIsRefreshing(true);
            } else if (isInitialMode) {
                setIsLoading(true);
            }

            let feedResponse: FeedDto;
            if (targetCircleIds && targetCircleIds.length > 0) {
                const circleIdsParam = targetCircleIds.join(',');
                feedResponse = await ApiClient.call(c => c.post_GetFilteredFeed(pageToLoad, FEED_PAGE_SIZE, circleIdsParam));
            } else {
                feedResponse = await ApiClient.call(c => c.post_GetFeedWithPaging(pageToLoad, FEED_PAGE_SIZE));
            }

            const incomingPosts = feedResponse.posts || [];
            setNotificationCount(feedResponse.notificationCount || 0);
            setCircles(feedResponse.userCircles || []);
            setError(null);
            setHasMore(incomingPosts.length === FEED_PAGE_SIZE);
            setPage(pageToLoad);

            if (isAppendMode) {
                setPosts(prevPosts => {
                    if (!prevPosts || prevPosts.length === 0) {
                        return incomingPosts;
                    }
                    const existingIds = new Set(prevPosts.map(p => p.id));
                    const merged = [...prevPosts];
                    incomingPosts.forEach(post => {
                        if (!existingIds.has(post.id)) {
                            merged.push(post);
                            existingIds.add(post.id);
                        }
                    });
                    return merged;
                });
            } else if (isFilterMode) {
                clearPendingFilterAnimation();
                setPosts([]);
                filterAnimationTimeoutRef.current = setTimeout(() => {
                    setPosts(incomingPosts);
                    setIsPostTransition(false);
                    filterAnimationTimeoutRef.current = null;
                }, 300);
            } else {
                setPosts(incomingPosts);
            }

            if (isInitialMode && isInitialLoad) {
                setIsInitialLoad(false);
            }
        } catch (err) {
            console.log("Failed to load filtered feed with err " + err)
            setError('Failed to load feed');
            if (!isAppendMode) {
                setPosts([]);
                setNotificationCount(0);
                setCircles([]);
            }
            if (isFilterMode) {
                clearPendingFilterAnimation();
                setIsPostTransition(false);
            }
        } finally {
            if (isAppendMode) {
                setIsLoadingMore(false);
            } else if (isFilterMode) {
                setIsFiltering(false);
            } else if (isRefreshMode) {
                setIsRefreshing(false);
            } else if (isInitialMode) {
                setIsLoading(false);
            }
        }
    }, [selectedCircleIds, isInitialLoad, clearPendingFilterAnimation]);

    const loadFeed = useCallback(async () => {
        await fetchFeed({ page: 1, mode: 'refresh' });
    }, [fetchFeed]);

    const updateFilter = useCallback((circleIds: string[]) => {
        setHasMore(true);
        setPage(1);
        setSelectedCircleIds(circleIds);
        fetchFeed({ page: 1, circleIdsOverride: circleIds, mode: 'filter' });
    }, [fetchFeed]);

    const clearFilter = useCallback(() => {
        setHasMore(true);
        setPage(1);
        setSelectedCircleIds([]);
        fetchFeed({ page: 1, circleIdsOverride: [], mode: 'filter' });
    }, [fetchFeed]);

    const loadMore = useCallback(() => {
        if (isLoading || isLoadingMore || isFiltering || isPostTransition || isRefreshing || !hasMore) {
            return;
        }
        const nextPage = page + 1;
        fetchFeed({ page: nextPage, mode: 'append' });
    }, [fetchFeed, hasMore, isFiltering, isLoading, isLoadingMore, isPostTransition, isRefreshing, page]);

    useEffect(() => {
        if (!isInitialLoad) {
            return;
        }
        fetchFeed({ page: 1, mode: 'initial' });
    }, [fetchFeed, isInitialLoad]);

    useEffect(() => {
        return () => {
            clearPendingFilterAnimation();
        };
    }, [clearPendingFilterAnimation]);

    return { 
        posts, 
        circles,
        notificationCount, 
        isLoading: isLoading && isInitialLoad, // Only show loading spinner on initial load
        isRefreshing,
        isFiltering,
        isPostTransition, // New state for post transition animations
        isLoadingMore,
        hasMore,
        error, 
        loadFeed, // Manual refresh skips global loading state
        loadMore,
        selectedCircleIds,
        updateFilter,
        clearFilter
    };
}

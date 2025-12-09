import { useState, useEffect, useCallback, useRef } from 'react';
import { FeedDto, PostDto, CirclePublicDto } from '../services/generated/generatedClient';
import { ApiClient } from 'services/apiClient';
import { feedEvents, FEED_POST_CREATED, FEED_POST_STATUS_UPDATED, FEED_POST_DELETED, OptimisticPost } from './feedEvents';

// Logical page size for server paging. Matches server default behavior.
const FEED_PAGE_SIZE = 20;

// Fetch modes help control UX state transitions (spinners/animations)
// - initial: first page on screen mount
// - refresh: pull-to-refresh reloading page 1
// - filter: updating the circle filter (animate-out/animate-in)
// - append: infinite scroll next page
type FeedFetchMode = 'initial' | 'refresh' | 'filter' | 'append';

// Options for a single fetch call
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
            // Server requires explicit includeImageUrl flag; keep it false here to minimize payload
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

    // Listen for delete events
    useEffect(() => {
        const deleteSubscription = feedEvents.addListener(FEED_POST_DELETED, (deletedPostId) => {
            if (deletedPostId === postId) {
                setPost(prevPost => {
                    if (prevPost) {
                        return {
                            ...prevPost,
                            _status: 'deleted',
                        } as OptimisticPost;
                    }
                    return prevPost;
                });
            }
        });

        return () => {
            deleteSubscription.remove();
        };
    }, [postId]);

    return { post, isLoading, error, loadPost };
}

export function useFilteredFeed() {
    const [posts, setPosts] = useState<OptimisticPost[]>([]);
    const [notificationCount, setNotificationCount] = useState<number>(0);
    const [circles, setCircles] = useState<CirclePublicDto[]>([]);
    // Global "initial" loading. Only shows on first load for nicer UX.
    const [isLoading, setIsLoading] = useState(true);
    // Pull-to-refresh state (does not block scroll or show global spinner)
    const [isRefreshing, setIsRefreshing] = useState(false);
    // Circle-filter update state (drives subtle "updating feed" label under filter)
    const [isFiltering, setIsFiltering] = useState(false);
    // Tracks whether we've passed the very first load (controls initial animations)
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    // Flag used by Home to re-trigger entrance animations when filters change
    const [isPostTransition, setIsPostTransition] = useState(false);
    // Infinite-scroll state
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedCircleIds, setSelectedCircleIds] = useState<string[]>([]);
    const selectedCircleIdsRef = useRef<string[]>([]);
    // Paging cursor (1-based) and whether more data is available
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    // Timer holder for filter transition enter animation delay
    const filterAnimationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Make sure we don't leave dangling timeouts between rapid filter changes/unmounts
    const clearPendingFilterAnimation = useCallback(() => {
        if (filterAnimationTimeoutRef.current) {
            clearTimeout(filterAnimationTimeoutRef.current);
            filterAnimationTimeoutRef.current = null;
        }
    }, []);

    // Core fetch function shared by initial, refresh, filter, and append flows
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
                // Unfiltered path uses paging endpoint for infinite scroll
                feedResponse = await ApiClient.call(c => c.post_GetFeedWithPaging(pageToLoad, FEED_PAGE_SIZE));
            }

            const incomingPosts = feedResponse.posts || [];
            setNotificationCount(feedResponse.notificationCount || 0);
            setCircles(feedResponse.userCircles || []);
            setError(null);
            setHasMore(incomingPosts.length === FEED_PAGE_SIZE);
            setPage(pageToLoad);

            if (isAppendMode) {
                // Append while de-duplicating by id (guards against race conditions)
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
                // Filter transition: animate out old posts, then set new posts slightly later
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

    // Exposed refresh: reload first page, keep current filters, show pull-to-refresh UI
    const loadFeed = useCallback(async () => {
        await fetchFeed({ page: 1, mode: 'refresh' });
    }, [fetchFeed]);

    // Update current circle filter and animate feed transition
    const updateFilter = useCallback((circleIds: string[]) => {
        setHasMore(true);
        setPage(1);
        setSelectedCircleIds(circleIds);
        fetchFeed({ page: 1, circleIdsOverride: circleIds, mode: 'filter' });
    }, [fetchFeed]);

    // Clear filter and animate feed transition back to unfiltered
    const clearFilter = useCallback(() => {
        setHasMore(true);
        setPage(1);
        setSelectedCircleIds([]);
        fetchFeed({ page: 1, circleIdsOverride: [], mode: 'filter' });
    }, [fetchFeed]);

    // Infinite scroll trigger: load the next page if not already busy and if more exists
    const loadMore = useCallback(() => {
        if (isLoading || isLoadingMore || isFiltering || isPostTransition || isRefreshing || !hasMore) {
            return;
        }
        const nextPage = page + 1;
        fetchFeed({ page: nextPage, mode: 'append' });
    }, [fetchFeed, hasMore, isFiltering, isLoading, isLoadingMore, isPostTransition, isRefreshing, page]);

    // Initial load: fetch first page with initial spinner
    useEffect(() => {
        selectedCircleIdsRef.current = selectedCircleIds;
    }, [selectedCircleIds]);

    useEffect(() => {
        const subscription = feedEvents.addListener(FEED_POST_CREATED, (newPost) => {
            const circleIdsForPost = new Set((newPost.sharedWithCircles || []).map(circle => circle.id));
            const currentFilter = selectedCircleIdsRef.current;

            if (currentFilter.length > 0) {
                const matchesFilter = currentFilter.some(circleId => circleIdsForPost.has(circleId));
                if (!matchesFilter) {
                    return;
                }
            }

            setPosts(prevPosts => {
                const withoutDuplicate = prevPosts.filter(post => post.id !== newPost.id);
                return [newPost, ...withoutDuplicate];
            });
        });

        const statusSubscription = feedEvents.addListener(FEED_POST_STATUS_UPDATED, ({ optimisticId, status, actualPost, error }) => {
            setPosts(prevPosts => {
                return prevPosts.map(post => {
                    // Find the optimistic post by either matching the optimistic ID or the actual post ID
                    if (post._optimisticId === optimisticId || post.id === optimisticId) {
                        if (status === 'posted' && actualPost) {
                            // Replace optimistic post with actual post, preserving status for display
                            // Remove _localImages since we now have server images
                            return {
                                ...actualPost,
                                _optimisticId: optimisticId,
                                _status: 'posted',
                            } as OptimisticPost;
                        } else if (status === 'failed') {
                            // Update status to failed, keep local images for retry/display
                            return {
                                ...post,
                                _status: 'failed',
                                _error: error,
                            } as OptimisticPost;
                        } else if (status === 'pending') {
                            // Handle retry: reset to pending
                            return {
                                ...post,
                                _status: 'pending',
                                _error: undefined,
                            } as OptimisticPost;
                        }
                    }
                    return post;
                });
            });
        });

        const deleteSubscription = feedEvents.addListener(FEED_POST_DELETED, (postId) => {
            // Mark as deleted first (for animation)
            setPosts(prevPosts => {
                return prevPosts.map(post => {
                    if (post.id === postId) {
                        return {
                            ...post,
                            _status: 'deleted',
                        } as OptimisticPost;
                    }
                    return post;
                });
            });

            // Actually remove the post after animation completes (1.4s total: 800ms delay + 400ms animation + 200ms buffer)
            setTimeout(() => {
                setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
            }, 1400);
        });

        return () => {
            subscription.remove();
            statusSubscription.remove();
            deleteSubscription.remove();
        };
    }, []);

    useEffect(() => {
        if (!isInitialLoad) {
            return;
        }
        fetchFeed({ page: 1, mode: 'initial' });
    }, [fetchFeed, isInitialLoad]);

    // Cleanup: ensure no timer is left running after unmount
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

import { useState, useEffect } from 'react';
import { FeedDto, PostDto } from '../services/generated/generatedClient';
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
            const feedResponse = await ApiClient.call(c => c.feed());
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
            const post = await ApiClient.call(c => c.postGET(postId, includeComments));
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

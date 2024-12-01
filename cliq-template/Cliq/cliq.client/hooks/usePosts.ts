import { useState, useEffect } from 'react';
import { Post } from '../services/generated/generatedClient';
import { ApiClient } from 'services/apiClient';

export function usePosts() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadPosts = async () => {
        try {
            setIsLoading(true);
            const posts = await ApiClient.Instance.postAll();
            setPosts(posts);
            setError(null);
        } catch (err) {
            console.log("")
            setError('Failed to load posts');
            setPosts([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPosts();
    }, []);

    return { posts, isLoading, error, loadPosts };
}

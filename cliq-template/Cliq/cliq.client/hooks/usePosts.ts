import { useState, useEffect } from 'react';
import { PostService, PostType } from '../services/postService';

export function usePosts() {
    const [posts, setPosts] = useState<PostType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadPosts = async () => {
        try {
            setIsLoading(true);
            const {posts} = await PostService.fetchPosts();
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

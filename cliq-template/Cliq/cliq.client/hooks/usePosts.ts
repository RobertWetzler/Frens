import { useState, useEffect } from 'react';
import { PostDto } from '../services/generated/generatedClient';
import { ApiClient } from 'services/apiClient';

export function useAllPosts() {
    const [posts, setPosts] = useState<PostDto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadPosts = async () => {
        try {
            setIsLoading(true);
            const posts = await ApiClient.Instance.postAll();
            setPosts(posts);
            setError(null);
        } catch (err) {
            console.log("Failed to load posts with err " + err)
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

export function usePost(postId: string, includeComments: true) {
    const [post, setPost] = useState<PostDto>();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadPost = async () => {
        try {
            setIsLoading(true);
            const post = await ApiClient.Instance.postGET(postId, includeComments);
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

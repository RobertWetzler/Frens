// types.ts
export interface User {
    id: string;
    name: string;
    avatar: string;
}

export interface Comment {
    id: string;
    user: User;
    content: string;
    timestamp: string;
}

export interface BasePost {
    id: string;
    user: User;
    content: string;
    timestamp: string;
    likes: number;
    comments: Comment[];
    type: 'text' | 'event';
}

export interface TextPost extends BasePost {
    type: 'text';
}

export interface EventPost extends BasePost {
    type: 'event';
    rsvpYes: string[];
    rsvpNo: string[];
    eventDate: string;
}

export type Post = TextPost | EventPost;

// api.ts
//import { Post, User } from './types';

const API_BASE = '/api';
const MOCK_MODE = true;

export const mockPosts: Post[] = [
    {
        id: '1',
        type: 'event',
        user: {
            id: '1',
            name: 'Alex Chen',
            avatar: '/api/placeholder/32/32'
        },
        content: "I'm going climbing tonight at the Boulder Gym! Anyone want to join?",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        likes: 5,
        comments: [],
        rsvpYes: ['2', '3'],
        rsvpNo: ['4'],
        eventDate: new Date(Date.now() + 3600000).toISOString()
    },
    {
        id: '2',
        type: 'text',
        user: {
            id: '2',
            name: 'Sarah Williams',
            avatar: '/api/placeholder/32/32'
        },
        content: "Just finished my first marathon! 🏃‍♀️",
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        likes: 12,
        comments: [
            {
                id: '1',
                user: {
                    id: '3',
                    name: 'Mike Johnson',
                    avatar: '/api/placeholder/32/32'
                },
                content: 'Congratulations! 🎉',
                timestamp: new Date(Date.now() - 3600000).toISOString()
            }
        ]
    }
];

const fetchPosts = async (): Promise<Post[]> => {
    if (MOCK_MODE) {
        return mockPosts;
    }
    const response = await fetch(`${API_BASE}/posts`);
    return response.json();
};

const likePost = async (postId: string): Promise<void> => {
    if (MOCK_MODE) return;
    await fetch(`${API_BASE}/posts/${postId}/like`, { method: 'POST' });
};

const addComment = async (postId: string, content: string): Promise<void> => {
    if (MOCK_MODE) return;
    await fetch(`${API_BASE}/posts/${postId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
    });
};

const rsvpToEvent = async (postId: string, response: 'yes' | 'no'): Promise<void> => {
    if (MOCK_MODE) return;
    await fetch(`${API_BASE}/posts/${postId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response })
    });
};

// App.tsx
import React, { useState, useEffect } from 'react';
//import { Post } from './types';
//import { fetchPosts, likePost, addComment, rsvpToEvent } from './api';

const TimeAgo: React.FC<{ timestamp: string }> = ({ timestamp }) => {
    const getTimeAgo = (date: Date) => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    return <span>{getTimeAgo(new Date(timestamp))}</span>;
};

const PostCard: React.FC<{ post: Post }> = ({ post }) => {
    const [isCommenting, setIsCommenting] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [liked, setLiked] = useState(false);

    const handleLike = async () => {
        await likePost(post.id);
        setLiked(!liked);
    };

    const handleComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim()) return;
        await addComment(post.id, commentText);
        setCommentText('');
        setIsCommenting(false);
    };

    const handleRSVP = async (response: 'yes' | 'no') => {
        await rsvpToEvent(post.id, response);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <div className="flex items-center mb-3">
                <img
                    src={post.user.avatar}
                    alt={post.user.name}
                    className="w-8 h-8 rounded-full mr-2"
                />
                <div>
                    <div className="font-semibold text-sm">{post.user.name}</div>
                    <div className="text-xs text-gray-500">
                        <TimeAgo timestamp={post.timestamp} />
                    </div>
                </div>
            </div>

            <p className="text-sm mb-3">{post.content}</p>

            {post.type === 'event' && (
                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <div className="text-sm font-medium mb-2">
                        Event Time: {new Date(post.eventDate).toLocaleString()}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleRSVP('yes')}
                            className="bg-green-500 text-white px-4 py-1 rounded-full text-sm"
                        >
                            Going ({post.rsvpYes.length})
                        </button>
                        <button
                            onClick={() => handleRSVP('no')}
                            className="bg-red-500 text-white px-4 py-1 rounded-full text-sm"
                        >
                            Can't Go ({post.rsvpNo.length})
                        </button>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                <button
                    onClick={handleLike}
                    className={`flex items-center gap-1 ${liked ? 'text-blue-500' : ''}`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    {post.likes}
                </button>
                <button
                    onClick={() => setIsCommenting(!isCommenting)}
                    className="flex items-center gap-1"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {post.comments.length}
                </button>
            </div>

            {isCommenting && (
                <form onSubmit={handleComment} className="mt-2">
                    <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add a comment..."
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </form>
            )}

            {post.comments.length > 0 && (
                <div className="mt-2 space-y-2">
                    {post.comments.map((comment: Comment) => (
                        <div key={comment.id} className="bg-gray-50 rounded-lg p-2">
                            <div className="flex items-center gap-2">
                                <img
                                    src={comment.user.avatar}
                                    alt={comment.user.name}
                                    className="w-6 h-6 rounded-full"
                                />
                                <span className="text-sm font-medium">{comment.user.name}</span>
                            </div>
                            <p className="text-sm mt-1">{comment.content}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const NewPostButton: React.FC = () => {
    return (
        <button className="fixed bottom-4 right-4 bg-blue-500 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
        </button>
    );
};

const App2: React.FC = () => {
    const [posts, setPosts] = useState<Post[]>([]);

    useEffect(() => {
        const loadPosts = async () => {
            const fetchedPosts = await fetchPosts();
            setPosts(fetchedPosts);
        };
        loadPosts();
    }, []);

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow-sm fixed top-0 left-0 right-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-3">
                    <h1 className="text-xl font-semibold">Social Feed</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 pt-16 pb-20">
                {posts.map(post => (
                    <PostCard key={post.id} post={post} />
                ))}
            </main>

            <NewPostButton />
        </div>
    );
};

export default App2;
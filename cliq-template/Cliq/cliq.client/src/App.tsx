import React, { useState } from 'react';
import { PlusCircle, Calendar, MessageSquare, ThumbsUp, Users, X } from 'lucide-react';

// Type definitions
type PostType = 'text' | 'event';

interface BasePost {
    id: number;
    type: PostType;
    content: string;
    author: string;
    timestamp: string;
}

interface EventPost extends BasePost {
    type: 'event';
    rsvp: { yes: number; no: number };
    userRsvp: 'yes' | 'no' | null;
}

interface TextPost extends BasePost {
    type: 'text';
    likes: number;
    userLiked: boolean;
}

type Post = EventPost | TextPost;

interface NewPostState {
    type: PostType;
    content: string;
}

const App: React.FC = () => {
    const [posts, setPosts] = useState<Post[]>([
        {
            id: 1,
            type: 'event',
            content: "I'm going climbing tonight at 7pm!",
            author: "Alex",
            timestamp: "2h ago",
            rsvp: { yes: 3, no: 1 },
            userRsvp: null
        },
        {
            id: 2,
            type: 'text',
            content: "Just finished my first React project! 🎉",
            author: "Sarah",
            timestamp: "4h ago",
            likes: 5,
            userLiked: false
        }
    ]);

    const [showNewPost, setShowNewPost] = useState<boolean>(false);
    const [newPost, setNewPost] = useState<NewPostState>({ type: 'text', content: '' });
    const [notification, setNotification] = useState<string | null>(null);

    const showNotification = (message: string): void => {
        setNotification(message);
        setTimeout(() => setNotification(null), 3000);
    };

    const handlePost = (): void => {
        if (!newPost.content.trim()) {
            showNotification("Please enter some content for your post");
            return;
        }

        const basePost = {
            id: Date.now(),
            ...newPost,
            author: "You",
            timestamp: "Just now",
        };

        const newPostWithDetails = newPost.type === 'event'
            ? { ...basePost, rsvp: { yes: 0, no: 0 }, userRsvp: null }
            : { ...basePost, likes: 0, userLiked: false };

        setPosts(prev => [newPostWithDetails as Post, ...prev]);

        setShowNewPost(false);
        setNewPost({ type: 'text', content: '' });
        showNotification("Post created successfully!");
    };

    const handleRSVP = (postId: number, response: 'yes' | 'no'): void => {
        setPosts(prev => prev.map(post => {
            if (post.id === postId && post.type === 'event') {
                const currentResponse = post.userRsvp;
                const newRsvp = { ...post.rsvp };

                if (currentResponse === response) {
                    newRsvp[response]--;
                    return { ...post, rsvp: newRsvp, userRsvp: null };
                } else {
                    if (currentResponse) newRsvp[currentResponse]--;
                    newRsvp[response]++;
                    return { ...post, rsvp: newRsvp, userRsvp: response };
                }
            }
            return post;
        }));
    };

    const handleLike = (postId: number): void => {
        setPosts(prev => prev.map(post => {
            if (post.id === postId && post.type === 'text') {
                return {
                    ...post,
                    likes: post.userLiked ? post.likes - 1 : post.likes + 1,
                    userLiked: !post.userLiked
                };
            }
            return post;
        }));
    };

    const renderPostActions = (post: Post) => {
        if (post.type === 'event') {
            return (
                <div className="flex gap-2">
                    <button
                        onClick={() => handleRSVP(post.id, 'yes')}
                        className={`flex-1 py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors ${post.userRsvp === 'yes'
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                    >
                        <Users className="w-4 h-4" />
                        Going ({post.rsvp.yes})
                    </button>
                    <button
                        onClick={() => handleRSVP(post.id, 'no')}
                        className={`flex-1 py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors ${post.userRsvp === 'no'
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                    >
                        <Users className="w-4 h-4" />
                        Can't Go ({post.rsvp.no})
                    </button>
                </div>
            );
        }

        return (
            <button
                onClick={() => handleLike(post.id)}
                className={`py-2 px-4 rounded flex items-center gap-2 transition-colors ${post.userLiked
                        ? 'text-blue-500'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
            >
                <ThumbsUp className="w-4 h-4" />
                {post.likes} likes
            </button>
        );
    };

    return (
        <div className="max-w-md mx-auto min-h-screen bg-gray-50">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center z-10">
                <h1 className="text-xl font-bold">Social Feed</h1>
                <button
                    onClick={() => setShowNewPost(true)}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <PlusCircle className="w-6 h-6" />
                </button>
            </div>

            {/* Notification */}
            {notification && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2">
                    <span>{notification}</span>
                    <button onClick={() => setNotification(null)} className="text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* New Post Modal */}
            {showNewPost && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-20">
                    <div className="bg-white rounded-lg w-full max-w-md p-4 animate-fade-in">
                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => setNewPost(prev => ({ ...prev, type: 'text' }))}
                                className={`flex-1 py-2 px-4 rounded transition-colors ${newPost.type === 'text'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-200 hover:bg-gray-300'
                                    }`}
                            >
                                <MessageSquare className="w-4 h-4 inline mr-2" />
                                Text
                            </button>
                            <button
                                onClick={() => setNewPost(prev => ({ ...prev, type: 'event' }))}
                                className={`flex-1 py-2 px-4 rounded transition-colors ${newPost.type === 'event'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-200 hover:bg-gray-300'
                                    }`}
                            >
                                <Calendar className="w-4 h-4 inline mr-2" />
                                Event
                            </button>
                        </div>
                        <textarea
                            value={newPost.content}
                            onChange={(e) => setNewPost(prev => ({ ...prev, content: e.target.value }))}
                            placeholder={newPost.type === 'event' ? "What's the plan?" : "What's on your mind?"}
                            className="w-full h-32 p-2 border rounded-lg mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowNewPost(false)}
                                className="flex-1 py-2 px-4 border rounded hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePost}
                                className="flex-1 py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                            >
                                Post
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Posts Feed */}
            <div className="p-4 space-y-4">
                {posts.map(post => (
                    <div key={post.id} className="bg-white rounded-lg p-4 shadow-sm hover:shadow transition-shadow">
                        <div className="flex items-center mb-2">
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                                {post.author[0]}
                            </div>
                            <div className="ml-2">
                                <div className="font-semibold">{post.author}</div>
                                <div className="text-sm text-gray-500">{post.timestamp}</div>
                            </div>
                        </div>
                        <p className="mb-4">{post.content}</p>

                        {renderPostActions(post)}
                    </div>
                ))}
            </div>

            {/* Bottom Spacer for Mobile */}
            <div className="h-16" />
        </div>
    );
};

export default App;
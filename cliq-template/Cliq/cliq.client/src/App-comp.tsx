// src/types/index.ts
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
  
  // src/api/posts.ts
  import { Post } from '../types';
  import { mockPosts } from './mockData';
  
  const API_BASE = '/api';
  const MOCK_MODE = true;
  
  export const PostsAPI = {
    fetchPosts: async (): Promise<Post[]> => {
      if (MOCK_MODE) return mockPosts;
      const response = await fetch(`${API_BASE}/posts`);
      return response.json();
    },
  
    likePost: async (postId: string): Promise<void> => {
      if (MOCK_MODE) return;
      await fetch(`${API_BASE}/posts/${postId}/like`, { method: 'POST' });
    },
  
    addComment: async (postId: string, content: string): Promise<void> => {
      if (MOCK_MODE) return;
      await fetch(`${API_BASE}/posts/${postId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
    },
  
    rsvpToEvent: async (postId: string, response: 'yes' | 'no'): Promise<void> => {
      if (MOCK_MODE) return;
      await fetch(`${API_BASE}/posts/${postId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response })
      });
    }
  };
  
  // src/hooks/usePosts.ts
  import { useState, useEffect } from 'react';
  import { Post } from '../types';
  import { PostsAPI } from '../api/posts';
  
  export const usePosts = () => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
  
    const fetchPosts = async () => {
      try {
        setLoading(true);
        const fetchedPosts = await PostsAPI.fetchPosts();
        setPosts(fetchedPosts);
      } catch (err) {
        setError('Failed to fetch posts');
      } finally {
        setLoading(false);
      }
    };
  
    useEffect(() => {
      fetchPosts();
    }, []);
  
    return { posts, loading, error, refetchPosts: fetchPosts };
  };
  
  // src/hooks/usePostActions.ts
  import { useState } from 'react';
  import { PostsAPI } from '../api/posts';
  
  export const usePostActions = () => {
    const [isProcessing, setIsProcessing] = useState(false);
  
    const likePost = async (postId: string) => {
      try {
        setIsProcessing(true);
        await PostsAPI.likePost(postId);
      } finally {
        setIsProcessing(false);
      }
    };
  
    const addComment = async (postId: string, content: string) => {
      try {
        setIsProcessing(true);
        await PostsAPI.addComment(postId, content);
      } finally {
        setIsProcessing(false);
      }
    };
  
    const rsvpToEvent = async (postId: string, response: 'yes' | 'no') => {
      try {
        setIsProcessing(true);
        await PostsAPI.rsvpToEvent(postId, response);
      } finally {
        setIsProcessing(false);
      }
    };
  
    return { likePost, addComment, rsvpToEvent, isProcessing };
  };
  
  // src/components/common/TimeAgo.tsx
  import React from 'react';
  
  interface TimeAgoProps {
    timestamp: string;
  }
  
  export const TimeAgo: React.FC<TimeAgoProps> = ({ timestamp }) => {
    const getTimeAgo = (date: Date) => {
      const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
      if (seconds < 60) return 'just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      return `${Math.floor(hours / 24)}d ago`;
    };
  
    return <span className="text-xs text-gray-500">{getTimeAgo(new Date(timestamp))}</span>;
  };
  
  // src/components/common/Avatar.tsx
  import React from 'react';
  
  interface AvatarProps {
    src: string;
    alt: string;
    size?: 'sm' | 'md';
  }
  
  export const Avatar: React.FC<AvatarProps> = ({ src, alt, size = 'md' }) => {
    const sizeClasses = {
      sm: 'w-6 h-6',
      md: 'w-8 h-8'
    };
  
    return (
      <img 
        src={src} 
        alt={alt} 
        className={`${sizeClasses[size]} rounded-full`}
      />
    );
  };
  
  // src/components/post/PostHeader.tsx
  import React from 'react';
  import { User } from '../../types';
  import { Avatar } from '../common/Avatar';
  import { TimeAgo } from '../common/TimeAgo';
  
  interface PostHeaderProps {
    user: User;
    timestamp: string;
  }
  
  export const PostHeader: React.FC<PostHeaderProps> = ({ user, timestamp }) => (
    <div className="flex items-center mb-3">
      <Avatar src={user.avatar} alt={user.name} />
      <div className="ml-2">
        <div className="font-semibold text-sm">{user.name}</div>
        <TimeAgo timestamp={timestamp} />
      </div>
    </div>
  );
  
  // src/components/post/PostActions.tsx
  import React from 'react';
  
  interface PostActionsProps {
    likes: number;
    comments: number;
    liked: boolean;
    onLike: () => void;
    onComment: () => void;
  }
  
  export const PostActions: React.FC<PostActionsProps> = ({
    likes,
    comments,
    liked,
    onLike,
    onComment
  }) => (
    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
      <button
        onClick={onLike}
        className={`flex items-center gap-1 ${liked ? 'text-blue-500' : ''}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        {likes}
      </button>
      <button onClick={onComment} className="flex items-center gap-1">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {comments}
      </button>
    </div>
  );
  
  // src/components/post/EventDetails.tsx
  import React from 'react';
  
  interface EventDetailsProps {
    eventDate: string;
    rsvpYes: string[];
    rsvpNo: string[];
    onRSVP: (response: 'yes' | 'no') => void;
  }
  
  export const EventDetails: React.FC<EventDetailsProps> = ({
    eventDate,
    rsvpYes,
    rsvpNo,
    onRSVP
  }) => (
    <div className="bg-gray-50 rounded-lg p-3 mb-3">
      <div className="text-sm font-medium mb-2">
        Event Time: {new Date(eventDate).toLocaleString()}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onRSVP('yes')}
          className="bg-green-500 text-white px-4 py-1 rounded-full text-sm"
        >
          Going ({rsvpYes.length})
        </button>
        <button
          onClick={() => onRSVP('no')}
          className="bg-red-500 text-white px-4 py-1 rounded-full text-sm"
        >
          Can't Go ({rsvpNo.length})
        </button>
      </div>
    </div>
  );
  
  // src/components/post/Comments.tsx
  import React from 'react';
  import { Comment as CommentType } from '../../types';
  import { Avatar } from '../common/Avatar';
  
  interface CommentsProps {
    comments: CommentType[];
  }
  
  export const Comments: React.FC<CommentsProps> = ({ comments }) => (
    <div className="mt-2 space-y-2">
      {comments.map(comment => (
        <div key={comment.id} className="bg-gray-50 rounded-lg p-2">
          <div className="flex items-center gap-2">
            <Avatar src={comment.user.avatar} alt={comment.user.name} size="sm" />
            <span className="text-sm font-medium">{comment.user.name}</span>
          </div>
          <p className="text-sm mt-1">{comment.content}</p>
        </div>
      ))}
    </div>
  );
  
  // src/components/post/PostCard.tsx
  import React, { useState } from 'react';
  import { Post } from '../../types';
  import { PostHeader } from './PostHeader';
  import { PostActions } from './PostActions';
  import { EventDetails } from './EventDetails';
  import { Comments } from './Comments';
  import { usePostActions } from '../../hooks/usePostActions';
  
  interface PostCardProps {
    post: Post;
    onUpdate: () => void;
  }
  
  export const PostCard: React.FC<PostCardProps> = ({ post, onUpdate }) => {
    const [isCommenting, setIsCommenting] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [liked, setLiked] = useState(false);
    
    const { likePost, addComment, rsvpToEvent, isProcessing } = usePostActions();
  
    const handleLike = async () => {
      if (isProcessing) return;
      await likePost(post.id);
      setLiked(!liked);
      onUpdate();
    };
  
    const handleComment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!commentText.trim() || isProcessing) return;
      await addComment(post.id, commentText);
      setCommentText('');
      setIsCommenting(false);
      onUpdate();
    };
  
    const handleRSVP = async (response: 'yes' | 'no') => {
      if (isProcessing) return;
      await rsvpToEvent(post.id, response);
      onUpdate();
    };
  
    return (
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <PostHeader user={post.user} timestamp={post.timestamp} />
        
        <p className="text-sm mb-3">{post.content}</p>
  
        {post.type === 'event' && (
          <EventDetails
            eventDate={post.eventDate}
            rsvpYes={post.rsvpYes}
            rsvpNo={post.rsvpNo}
            onRSVP={handleRSVP}
          />
        )}
  
        <PostActions
          likes={post.likes}
          comments={post.comments.length}
          liked={liked}
          onLike={handleLike}
          onComment={() => setIsCommenting(!isCommenting)}
        />
  
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
  
        {post.comments.length > 0 && <Comments comments={post.comments} />}
      </div>
    );
  };
  
  // src/components/layout/Header.tsx
  import React from 'react';
  
  export const Header: React.FC = () => (
    <header className="bg-white shadow-sm fixed top-0 left-0 right-0 z-10">
      <div className="max-w-2xl mx-auto px-4 py-3">
        <h1 className="text-xl font-semibold">Social Feed</h1>
      </div>
    </header>
  );
  
  // src/components/layout/NewPostButton.tsx
  import React from 'react';
  
  interface NewPostButtonProps {
    onClick: () => void;
  }
  
  export const NewPostButton: React.FC<NewPostButtonProps> = ({ onClick }) => (
    <button 
      onClick={onClick}
      className="fixed bottom-4 right-4 bg-blue-500 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
  
  // src/App.tsx
  import React from 'react';
  import { Header } from './components/layout/Header';
  import { NewPostButton } from './components/layout/NewPostButton';
  import { PostCard } from './components/post/PostCard';
  import { usePosts } from './hooks/us
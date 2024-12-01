// src/services/postService.ts
import { apiGet } from './api';

// TODO: Future optimization, can we do the mapping of API response -> Typescript via Swagger file?
export interface PostType {
    id: string;
    userId: string;
    userName: string; // Make user object/DTO?
    date: string;
    text: string;
    authorAvatar?: string;
    commentCount?: number;
}

export class PostService {
    static async fetchPosts(page = 1, pageSize = 20): Promise<{
        posts: PostType[];
        // total: number;
    }> {
        try {
            const response = await apiGet('/api/post', {
                page,
                pageSize,
                include: ['author', 'comments']
            });
            return {
                posts: response.data.map(this.transformPost),
                // TODO: compute total server-side as optimization?
                //total: response.metadata.totalCount
            };
        } catch (error) {
            console.error('Error fetching posts:', error);
            throw error;
        }
    }

    // Optional: transform raw API data to frontend model
    private static transformPost(rawPost: any): PostType {
        return {
            id: rawPost.id,
            userId: rawPost.userId,
            userName: rawPost.userName,
            date: rawPost.date,
            text: rawPost.text,
            authorAvatar: rawPost.authorAvator || null,
            commentCount: rawPost.commentCount || 0
        };
    }
}

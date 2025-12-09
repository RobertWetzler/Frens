import { EventEmitter } from 'expo-modules-core';
import { PostDto } from 'services/generated/generatedClient';

export const FEED_POST_CREATED = 'FEED_POST_CREATED';
export const FEED_POST_STATUS_UPDATED = 'FEED_POST_STATUS_UPDATED';
export const FEED_POST_DELETED = 'FEED_POST_DELETED';

export type PostStatus = 'pending' | 'posted' | 'failed' | 'deleted';

export interface OptimisticPost extends PostDto {
    _optimisticId?: string;
    _status?: PostStatus;
    _error?: string;
    _localImages?: Array<{ uri: string; fileName: string; type: string; webFile?: File }>;
}

type FeedEventsMap = {
    [FEED_POST_CREATED]: (post: OptimisticPost) => void;
    [FEED_POST_STATUS_UPDATED]: (data: { optimisticId: string; status: PostStatus; actualPost?: PostDto; error?: string }) => void;
    [FEED_POST_DELETED]: (postId: string) => void;
};

export const feedEvents = new EventEmitter<FeedEventsMap>();

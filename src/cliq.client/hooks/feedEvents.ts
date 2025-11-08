import { EventEmitter } from 'expo-modules-core';
import { PostDto } from 'services/generated/generatedClient';

export const FEED_POST_CREATED = 'FEED_POST_CREATED';
export const FEED_POST_STATUS_UPDATED = 'FEED_POST_STATUS_UPDATED';

export type PostStatus = 'pending' | 'posted' | 'failed';

export interface OptimisticPost extends PostDto {
    _optimisticId?: string;
    _status?: PostStatus;
    _error?: string;
}

type FeedEventsMap = {
    [FEED_POST_CREATED]: (post: OptimisticPost) => void;
    [FEED_POST_STATUS_UPDATED]: (data: { optimisticId: string; status: PostStatus; actualPost?: PostDto; error?: string }) => void;
};

export const feedEvents = new EventEmitter<FeedEventsMap>();

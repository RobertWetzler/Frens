import { EventEmitter } from 'expo-modules-core';
import { PostDto } from 'services/generated/generatedClient';

export const FEED_POST_CREATED = 'FEED_POST_CREATED';

type FeedEventsMap = {
    [FEED_POST_CREATED]: (post: PostDto) => void;
};

export const feedEvents = new EventEmitter<FeedEventsMap>();

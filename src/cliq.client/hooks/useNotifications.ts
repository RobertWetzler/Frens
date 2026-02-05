import { useState, useEffect } from 'react';
import { NotificationDto, NotificationFeedDto } from '../services/generated/generatedClient';
import { ApiClient } from 'services/apiClient';

interface NotificationTarget {
    screen: 'Comments' | 'Profile';
    params: Record<string, string>;
}

interface IEnrichedNotification { metadata: any; fromId: string; fromName: string; createdAt; kind: 'circle'; }
class NewSubscribableCircle implements IEnrichedNotification {
    id: string;
    fromId: string;
    fromName: string;
    circleId: string;
    circleName: string;
    isAlreadyMember: boolean;
    metadata: any;
    createdAt: any;
    kind: 'circle' = 'circle';
    constructor(id, fromid, fromName, circleId, circleName, isAlreadyMember, createdAt, metadata) {
        this.id = id
        this.fromId = fromid
        this.fromName = fromName
        this.circleId = circleId
        this.circleName = circleName
        this.isAlreadyMember = isAlreadyMember
        this.createdAt = createdAt
        this.metadata = metadata
    }
}

interface GenericNotification {
    kind: 'generic';
    id: string;
    type: string;
    title: string;
    message: string;
    createdAt: any;
    metadata: any;
    target?: NotificationTarget;
}

const resolveTarget = (type: string, metadata: any): NotificationTarget | undefined => {
    switch (type) {
        case 'FriendRequestAccepted':
            return metadata?.AccepterId ? { screen: 'Profile', params: { userId: metadata.AccepterId } } : undefined;
        case 'NewPost':
        case 'NewComment':
        case 'CommentReply':
        case 'CarpoolReply':
        case 'PostMention':
        case 'CommentMention':
            return metadata?.PostId ? { screen: 'Comments', params: { postId: metadata.PostId } } : undefined;
        case 'NewEvent':
            return metadata?.EventId ? { screen: 'Comments', params: { postId: metadata.EventId } } : undefined;
        default:
            return undefined;
    }
};

const parseNotification = (notification: NotificationDto): (NewSubscribableCircle | GenericNotification) | null => {
    if (!notification.metadata) return null;
    let metadata: any;
    try {
        metadata = JSON.parse(notification.metadata);
    } catch {
        return null;
    }
    const type = metadata?.Type;
    if (!type) return null;
    if (type === 'FriendRequest') {
        return null;
    }
    if (type === 'NewSubscribableCircle' || type === 'NewSubscribableCircleNoFollow') {
        return new NewSubscribableCircle(
            notification.id,
            metadata["AuthorId"],
            metadata["AuthorName"],
            metadata["CircleId"],
            metadata["CircleName"],
            metadata["IsAlreadyMember"],
            notification.createdAt,
            metadata
        );
    }

    return {
        kind: 'generic',
        id: notification.id,
        type,
        title: notification.title,
        message: notification.message,
        createdAt: notification.createdAt,
        metadata,
        target: resolveTarget(type, metadata)
    };
};

// TODO: Make a generic hook for API calls.
export function useNotificationFeed() {
    const [notificationFeed, setNotificationFeed] = useState<NotificationFeedDto>();
    const [processedNotifications, setProcessedNotifications] = useState<(NewSubscribableCircle | GenericNotification)[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadNotifications = async () => {
        try {
            setIsLoading(true);
            const notifications = await ApiClient.call(c => c.notification_GetNotifications());
            setNotificationFeed(notifications);
            const parsed = notifications.notifications
                .map(parseNotification)
                .filter((item): item is (NewSubscribableCircle | GenericNotification) => item !== null);
            setProcessedNotifications(parsed);
            setError(null);
        } catch (err) {
            setError('Failed to load notifications');
            setNotificationFeed(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadNotifications();
    }, []);

    return { notificationFeed: notificationFeed, processedNotifications: processedNotifications, isLoading, error, loadNotifications };
}

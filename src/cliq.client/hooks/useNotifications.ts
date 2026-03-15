import { useState, useEffect } from 'react';
import { NotificationDto, NotificationFeedDto } from '../services/generated/generatedClient';
import { ApiClient } from 'services/apiClient';


interface IEnrichedNotification { metadata: any; fromId: string; fromName: string; createdAt }
class NewSubscribableCircle implements IEnrichedNotification {
    id: string;
    fromId: string;
    fromName: string;
    circleId: string;
    circleName: string;
    isAlreadyMember: boolean;
    metadata: any;
    createdAt: any;
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

class InterestDiscoveryNotification implements IEnrichedNotification {
    id: string;
    fromId: string;
    fromName: string;
    interestId: string;
    interestName: string;
    interestDisplayName: string;
    friendCount: number;
    metadata: any;
    createdAt: any;
    constructor(id, fromId, fromName, interestId, interestName, interestDisplayName, friendCount, createdAt, metadata) {
        this.id = id
        this.fromId = fromId
        this.fromName = fromName
        this.interestId = interestId
        this.interestName = interestName
        this.interestDisplayName = interestDisplayName
        this.friendCount = friendCount
        this.createdAt = createdAt
        this.metadata = metadata
    }
}

// class NewComment implements IEnrichedNotification {
//   fromId: string;
//   fromName: string;
//   commentId: string;
//   postId: string;
//   commentText: string;
//   metadata: any;

//   constructor(fromid, fromName, commentId, postId, commentText, metadata)
//   {
//     this.fromId = fromid
//     this.fromName = fromName
//     this.commentId = commentId
//     this.postId = postId
//     this.commentText = commentText
//     this.metadata = metadata
//   }
// }


// TODO: Make a generic hook for API calls.
export function useNotificationFeed() {
    const [notificationFeed, setNotificationFeed] = useState<NotificationFeedDto>();
    const [processedNotifications, setProcessedNotifications] = useState<(NewSubscribableCircle | InterestDiscoveryNotification)[]>();
    // const [combinedNotificationFeed, setCombinedNotificationFeed] = useState<(NewSubscribableCircle[]>();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadNotifications = async () => {
        try {
            setIsLoading(true);
            console.log("getting notifications")
            const notifications = await ApiClient.call(c => c.notification_GetNotifications());
            console.log("setting notif feed")
            setNotificationFeed(notifications);
            const processedNotifications = notifications.notifications.map((n) => {
                console.log("processing notif")
                let metadata = JSON.parse(n.metadata)
                if (metadata["Type"] == "NewSubscribableCircle") {
                    console.log("Returning newsubcircle notif")
                    return new NewSubscribableCircle(
                        n.id,
                        metadata["AuthorId"],
                        metadata["AuthorName"],
                        metadata["CircleId"],
                        metadata["CircleName"],
                        metadata["IsAlreadyMember"],
                        n.createdAt,
                        metadata)
                }
                if (metadata["Type"] == "InterestDiscovery") {
                    return new InterestDiscoveryNotification(
                        n.id,
                        metadata["AuthorId"],
                        metadata["AuthorName"],
                        metadata["InterestId"],
                        metadata["InterestName"],
                        metadata["InterestDisplayName"],
                        metadata["FriendCount"] || 1,
                        n.createdAt,
                        metadata)
                }
                console.log("Not returning newsubcircle notif")
            }
            ).filter(Boolean);
            setProcessedNotifications(processedNotifications);

            // Make combined feed
            
            setError(null);
        } catch (err) {
            console.log("Failed to load notifications with err " + err)
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

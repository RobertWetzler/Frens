import { useState, useEffect } from 'react';
import { NotificationDto } from '../services/generated/generatedClient';
import { ApiClient } from 'services/apiClient';

// TODO: Make a generic hook for API calls.
export function useNotifications() {
    const [notifications, setNotifications] = useState<NotificationDto>();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadNotifications = async () => {
        try {
            setIsLoading(true);
            const notifications = await ApiClient.call(c => c.notification_GetNotifications());
            setNotifications(notifications);
            setError(null);
        } catch (err) {
            console.log("Failed to load notifications with err " + err)
            setError('Failed to load notifications');
            setNotifications(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadNotifications();
    }, []);

    return { notifications, isLoading, error, loadNotifications };
}

import { useState, useCallback } from 'react';
import { ApiClient } from 'services/apiClient';
import { PushSubscriptionDto } from 'services/generated/generatedClient';

interface UseAddNotificationsOptions {
  applicationServerKey: string | ArrayBuffer;
}

interface UseAddNotificationsReturn {
  subscribe: () => Promise<PushSubscription | null>;
  isLoading: boolean;
  error: string | null;
  subscription: PushSubscription | null;
  isSupported: boolean;
}

export const useAddNotifications = (
  options: UseAddNotificationsOptions
): UseAddNotificationsReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  // Check if the new Declarative Web Push API is supported
  const isSupported = typeof window !== 'undefined' && 'pushManager' in window;

  const subscribe = useCallback(async (): Promise<PushSubscription | null> => {
    if (!isSupported) {
      setError('Declarative Web Push is not supported in this browser');
      console.warn('Declarative Web Push is not supported in this browser');
      console.log('window', window);
      console.log('window.pushManager', window.pushManager);
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request notification permission first
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Subscribe using the new window.pushManager API
      const newSubscription = await window.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: options.applicationServerKey
      });
      // console.log('New notification subscription:', newSubscription);
      console.log('subscription endpoint:', newSubscription.endpoint);
      // console.log(JSON.stringify(newSubscription)); // logs endpoint + encrypted key data
      const p256dh = btoa(String.fromCharCode(...new Uint8Array(newSubscription.getKey('p256dh'))));
      const auth = btoa(String.fromCharCode(...new Uint8Array(newSubscription.getKey('auth'))));
      // console.log({ endpoint: newSubscription.endpoint, p256dh, auth });
      await ApiClient.call(c =>
        c.subscriptions(new PushSubscriptionDto({
          endpoint: newSubscription.endpoint,
          p256DH: p256dh,
          auth: auth
        })));
      // TODO check if the response is successful
      setSubscription(newSubscription);
      return newSubscription;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to subscribe to notifications';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [options.applicationServerKey, isSupported]);

  return {
    subscribe,
    isLoading,
    error,
    subscription,
    isSupported
  };
};
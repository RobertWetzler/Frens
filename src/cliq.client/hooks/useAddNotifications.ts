import { useState, useCallback, useEffect } from 'react';
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
  hasExistingSubscription: boolean;
  isPWAInstalled: boolean;
}

export const useAddNotifications = (
  options: UseAddNotificationsOptions
): UseAddNotificationsReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [hasExistingSubscription, setHasExistingSubscription] = useState(true);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);

  // Check if the new Declarative Web Push API is supported
  const isSupported = typeof window !== 'undefined' && 'pushManager' in window;

  // Check for PWA installation status
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkPWAInstalled = () => {
      // Check for standalone mode (covers most PWA installations)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      
      // Check for iOS Safari standalone mode
      const isIOSStandalone = (window.navigator as any).standalone === true;
      
      setIsPWAInstalled(isStandalone || isIOSStandalone);
    };

    checkPWAInstalled();

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkPWAInstalled);

    return () => {
      mediaQuery.removeEventListener('change', checkPWAInstalled);
    };
  }, []);

  // Check for existing subscription and permission state
  useEffect(() => {
    const checkExistingSubscription = async () => {
      if (!isSupported) return;

      try {
        const [permissionState, existingSubscription] = await Promise.all([
          window.pushManager.permissionState(),
          window.pushManager.getSubscription()
        ]);

        if (permissionState === 'granted' && existingSubscription?.endpoint) {
          setHasExistingSubscription(true);
          setSubscription(existingSubscription);
        }
        else {
          setHasExistingSubscription(false);
          setSubscription(null);
        }
      } catch (err) {
        console.warn('Failed to check existing subscription:', err);
        setHasExistingSubscription(false);
      }
    };

    checkExistingSubscription();
  }, [isSupported]);

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

      console.log("window.pushManager: ", window.pushManager);
      // TODO: Send this to server to signal that user is actively using this subscription
      const existingSubscription = await window.pushManager.getSubscription();

      const permissionState = await window.pushManager.permissionState();
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
      setHasExistingSubscription(true);
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
    isSupported,
    hasExistingSubscription,
    isPWAInstalled
  };
};
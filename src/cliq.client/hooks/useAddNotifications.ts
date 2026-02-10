import { useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
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
  const isSupported = typeof window !== 'undefined' && typeof (window as any).pushManager !== 'undefined';

  // Check for PWA installation status (web only). Avoid using matchMedia in native.
  useEffect(() => {
    if (Platform.OS !== 'web') return; // Not relevant outside web
    if (typeof window === 'undefined') return;

    const supportsMatchMedia = typeof window.matchMedia === 'function';

    const checkPWAInstalled = () => {
      try {
        const isStandalone = supportsMatchMedia ? window.matchMedia('(display-mode: standalone)').matches : false;
        const isIOSStandalone = (window.navigator as any)?.standalone === true; // iOS Safari
        setIsPWAInstalled(isStandalone || isIOSStandalone);
      } catch {
        setIsPWAInstalled(false);
      }
    };

    checkPWAInstalled();

    if (supportsMatchMedia) {
      try {
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handler = () => checkPWAInstalled();
        mediaQuery.addEventListener?.('change', handler);
        return () => {
          try { mediaQuery.removeEventListener?.('change', handler); } catch { /* ignore */ }
        };
      } catch { /* ignore */ }
    }
  }, []);

  // Check for existing subscription and permission state
  useEffect(() => {
    const checkExistingSubscription = async () => {
      if (!isSupported) return;

      try {
        // If the browser already has notification permission granted, the user
        // has subscribed before. This covers cross-domain migration (e.g.
        // cliq-server.fly.dev → frenssocial.com) where getSubscription()
        // returns null on the new origin but permission persists.
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          setHasExistingSubscription(true);
          return;
        }

        const pm = (window as any).pushManager as any | undefined;
        if (!pm) return;

        const [permissionState, existingSubscription] = await Promise.all([
          pm.permissionState(),
          pm.getSubscription()
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
  console.log('window.pushManager', (window as any).pushManager);
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

  console.log('window.pushManager: ', (window as any).pushManager);
      // TODO: Send this to server to signal that user is actively using this subscription
  const pm = (window as any).pushManager as any | undefined;
  if (!pm) throw new Error('pushManager not available');
  const existingSubscription = await pm.getSubscription();

  const permissionState = await pm.permissionState();
      // Subscribe using the new window.pushManager API
  const newSubscription = await pm.subscribe({
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
        c.notification_StoreSubscription(new PushSubscriptionDto({
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
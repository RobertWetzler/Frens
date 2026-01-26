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
  pushType: 'declarative' | 'service-worker' | 'none';
}

// Check if Declarative Web Push is available (Safari/WebKit)
const hasDeclarativePush = (): boolean => {
  return typeof window !== 'undefined' && typeof (window as any).pushManager !== 'undefined';
};

// Check if traditional Service Worker push is available
const hasServiceWorkerPush = (): boolean => {
  return typeof navigator !== 'undefined' && 
         'serviceWorker' in navigator && 
         'PushManager' in window;
};

// Get the appropriate push manager
const getPushManager = async (): Promise<{ 
  pushManager: PushManager | null; 
  type: 'declarative' | 'service-worker' | 'none' 
}> => {
  // First try Declarative Web Push (Safari/WebKit)
  if (hasDeclarativePush()) {
    return { 
      pushManager: (window as any).pushManager as PushManager, 
      type: 'declarative' 
    };
  }
  
  // Fall back to Service Worker based push (Chrome, Firefox, Edge, Android)
  if (hasServiceWorkerPush()) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration.pushManager) {
        return { 
          pushManager: registration.pushManager, 
          type: 'service-worker' 
        };
      }
    } catch (err) {
      console.warn('Failed to get service worker registration:', err);
    }
  }
  
  return { pushManager: null, type: 'none' };
};

export const useAddNotifications = (
  options: UseAddNotificationsOptions
): UseAddNotificationsReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [hasExistingSubscription, setHasExistingSubscription] = useState(true);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [pushType, setPushType] = useState<'declarative' | 'service-worker' | 'none'>('none');

  // Check if any push notification method is supported
  const isSupported = hasDeclarativePush() || hasServiceWorkerPush();

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
        const { pushManager, type } = await getPushManager();
        setPushType(type);
        
        if (!pushManager) return;

        // For Declarative Web Push, use permissionState method
        // For SW-based push, check Notification.permission
        let permissionState: NotificationPermission | PermissionState;
        if (type === 'declarative' && 'permissionState' in pushManager) {
          permissionState = await (pushManager as any).permissionState();
        } else {
          permissionState = Notification.permission;
        }

        const existingSubscription = await pushManager.getSubscription();

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
      setError('Push notifications are not supported in this browser');
      console.warn('Push notifications are not supported in this browser');
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

      const { pushManager, type } = await getPushManager();
      setPushType(type);
      
      if (!pushManager) {
        throw new Error('Push manager not available');
      }
      
      console.log(`Using ${type} push notifications`);

      // Subscribe to push notifications
      const newSubscription = await pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: options.applicationServerKey
      });
      
      console.log('subscription endpoint:', newSubscription.endpoint);
      
      const p256dh = btoa(String.fromCharCode(...new Uint8Array(newSubscription.getKey('p256dh')!)));
      const auth = btoa(String.fromCharCode(...new Uint8Array(newSubscription.getKey('auth')!)));
      
      await ApiClient.call(c =>
        c.notification_StoreSubscription(new PushSubscriptionDto({
          endpoint: newSubscription.endpoint,
          p256DH: p256dh,
          auth: auth
        })));
      
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
    isPWAInstalled,
    pushType
  };
};
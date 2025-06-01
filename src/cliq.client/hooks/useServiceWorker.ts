import { useEffect } from 'react';
import { Platform } from 'react-native';

export const useServiceWorker = () => {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    console.log('Trying to register service worker');
    
    if ('serviceWorker' in navigator) {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('SW registered: ', registration);
        } catch (registrationError) {
          console.log('SW registration failed: ', registrationError);
        }
      };

      // Register immediately, don't wait for load event
      registerSW();
    } else {
      console.log('Service Worker not supported in this browser.');
    }
  }, []);
};
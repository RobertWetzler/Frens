// This file now supports a generated dev IP file produced by scripts/gen-dev-ip.js
// The script writes dev-ip.generated.js exporting { url, ip, port } or a string fallback.
let generatedDev;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  generatedDev = require('./dev-ip.generated');
} catch (_) {
  generatedDev = null;
}

// Normalize generated export shape
let generatedUrl = null;
if (generatedDev) {
  if (typeof generatedDev === 'string') generatedUrl = generatedDev;
  else if (typeof generatedDev === 'object' && generatedDev.url) generatedUrl = generatedDev.url;
  else if (generatedDev.default) generatedUrl = generatedDev.default;
}

const DEFAULT_DEV_URL = 'https://localhost:7188';

const ENV = {
  development: {
    API_URL: generatedUrl || process.env.DEV_API_URL || DEFAULT_DEV_URL,
    VAPID_PUBLIC_KEY: 'BCs0Nh-yet4gbF_-xqsSEAJLFFE9iDcXBE2dade9YzkDyy-6UaJ8uFh2tcIT__ht38M2PqwlLs7Bu_aHL7_HmDA'
  },
  production: {
    // TODO: Change to Frens domain once I buy a domain name
    API_URL: 'https://cliq-server.fly.dev', // Production API endpoint
    VAPID_PUBLIC_KEY: 'BIw5zCVYA6Mh7HjPtZhqlt9ZNp5mNOh6sZaT7znRtiPIaWEWy4e7KOtYfs7erRMKTy4sKqEAqnrj-Tvd3SpRCZY'
  }
};

const detectEnvironment = () => {
  // 1. Explicit override via env vars (Expo recommends EXPO_PUBLIC_ prefix for runtime usage)
  const explicit = process?.env?.APP_ENV || process?.env?.EXPO_PUBLIC_APP_ENV;
  if (explicit === 'development' || explicit === 'production') return explicit;

  // 2. React Native (Expo) detection: navigator.product === 'ReactNative'
  const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
  if (isReactNative) {
    // Use __DEV__ global provided by Metro / React Native
    // __DEV__ is true for development bundles, false for production (EAS build / release)
    // If for some reason __DEV__ is undefined, fall back to NODE_ENV
    if (typeof __DEV__ !== 'undefined') return __DEV__ ? 'development' : 'production';
    return (process?.env?.NODE_ENV === 'development') ? 'development' : 'production';
  }

  // 3. Web (browser) detection; guard window + location safely
  if (typeof window !== 'undefined' && window?.location) {
    const hostname = window.location.hostname || '';
    const port = window.location.port || '';
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.includes('roberts-macbook-air') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.includes('expo') ||
      port === '19006'
    ) {
      return 'development';
    }
  }

  // 4. Fallback: production
  return 'production';
};

const getEnvVars = (env = null) => {
  // Auto-detect environment if not specified
  const environment = env || detectEnvironment();
  return ENV[environment];
};

export default getEnvVars;
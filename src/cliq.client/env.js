const ENV = {
  development: {
    //API_URL: 'https://localhost:7188', // Your .NET server port
    //API_URL: 'https://192.0.0.2:7188', 
    //API_URL: 'https://192.0.0.2:7188', 
    // Use for hotspot development on MacBook
    //API_URL: 'https://roberts-macbook-air.local:7188',
    API_URL: 'https://192.168.0.109:7189',
    VAPID_PUBLIC_KEY: 'BCs0Nh-yet4gbF_-xqsSEAJLFFE9iDcXBE2dade9YzkDyy-6UaJ8uFh2tcIT__ht38M2PqwlLs7Bu_aHL7_HmDA'
  },
  production: {
    // TODO: Change to Frens domain once I buy a domain name
    API_URL: 'https://cliq-server.fly.dev', // Production API endpoint
    VAPID_PUBLIC_KEY: 'BIw5zCVYA6Mh7HjPtZhqlt9ZNp5mNOh6sZaT7znRtiPIaWEWy4e7KOtYfs7erRMKTy4sKqEAqnrj-Tvd3SpRCZY'
  }
};

const detectEnvironment = () => {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      
      // Check if running on localhost or development servers
      if (hostname === 'localhost' || 
          hostname === '127.0.0.1' ||
          hostname.includes('roberts-macbook-air') || 
          hostname.includes('192.168') || 
          hostname.includes('expo') || 
          window.location.port === '19006') {
          return 'development';
      }
  }
  
  // Default to production for deployed apps or server-side rendering
  return 'production';
};

const getEnvVars = (env = null) => {
  // Auto-detect environment if not specified
  const environment = env || detectEnvironment();
  return ENV[environment];
};

export default getEnvVars;
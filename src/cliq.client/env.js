const ENV = {
  development: {
    API_URL: 'https://localhost:7188', // Your .NET server port
    //API_URL: 'http://172.20.10.3:5265', // Your .NET server port
  },
  production: {
    // TODO: Change to Frens domain once I buy a domain name
    API_URL: 'https://cliq-server.fly.dev', // Production API endpoint
  }
};

const detectEnvironment = () => {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      
      // Check if running on localhost or development servers
      if (hostname === 'localhost' || 
          hostname === '127.0.0.1' || 
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
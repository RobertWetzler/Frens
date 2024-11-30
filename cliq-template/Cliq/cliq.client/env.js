const ENV = {
    development: {
      API_URL: 'https://localhost:7188', // Your .NET server port
    },
    production: {
      API_URL: 'https://frens-app.com/api', // Production API endpoint
    }
  };
  
  const getEnvVars = (env = 'development') => {
    return ENV[env];
  };
  
  export default getEnvVars;
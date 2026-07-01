// CENTRAL CONFIGURATION FOR NORTHSTAR APIS
export const CONFIG = {
  // Set apiBaseUrl to 'mock' to run the simulated offline dashboard in the browser
  // For live backend integration, set to your API URL: e.g. 'https://api.northstar.com'
  apiBaseUrl: 'mock',
  
  endpoints: {
    upload: '/upload',
    dashboard: '/dashboard',
    forecast: '/forecast',
    recommendations: '/recommendations',
    chat: '/chat'
  }
};

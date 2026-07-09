// CENTRAL CONFIGURATION FOR NORTHSTAR APIS
export const CONFIG = {
  // Set to 'mock' to run the offline dashboard preview in the browser
  // For live backend integration, set to your API URL:
  apiBaseUrl: 'https://northstar-business-consultant-api.onrender.com',
  chatBaseUrl: 'https://northstar-ai-chat-api.onrender.com',
  
  // Graceful fallback to mock data if the Render server experiences cold-start timeouts
  useMockFallback: true,
  
  endpoints: {
    analyze: '/analyze-business',
    chat: '/Chat'
  }
};

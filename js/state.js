// STATE MANAGEMENT ENGINE — STAYS ALIVE UNTIL BROWSER WINDOW CLOSES
export const STATE = {
  isUploaded: false,
  fileName: '',
  dashboardData: null,
  forecastData: null,
  recommendationsData: null,
  analysisResult: null,
  chatSessionId: null,
  chatHistory: [],

  saveToSession() {
    try {
      sessionStorage.setItem('northstar_state', JSON.stringify({
        isUploaded: this.isUploaded,
        fileName: this.fileName,
        dashboardData: this.dashboardData,
        forecastData: this.forecastData,
        recommendationsData: this.recommendationsData,
        analysisResult: this.analysisResult,
        chatSessionId: this.chatSessionId,
        chatHistory: this.chatHistory
      }));
    } catch (e) {
      console.warn('sessionStorage is not accessible:', e);
    }
  },

  loadFromSession() {
    try {
      const data = sessionStorage.getItem('northstar_state');
      if (data) {
        const parsed = JSON.parse(data);
        this.isUploaded = parsed.isUploaded || false;
        this.fileName = parsed.fileName || '';
        this.dashboardData = parsed.dashboardData || null;
        this.forecastData = parsed.forecastData || null;
        this.recommendationsData = parsed.recommendationsData || null;
        this.analysisResult = parsed.analysisResult || null;
        this.chatSessionId = parsed.chatSessionId || null;
        this.chatHistory = parsed.chatHistory || [];
      }
    } catch (e) {
      console.warn('sessionStorage is not accessible:', e);
    }
  },

  clearSession() {
    try {
      sessionStorage.removeItem('northstar_state');
      sessionStorage.removeItem('northstar_file_base64');
    } catch (e) {
      console.warn('sessionStorage is not accessible:', e);
    }
    this.isUploaded = false;
    this.fileName = '';
    this.dashboardData = null;
    this.forecastData = null;
    this.recommendationsData = null;
    this.analysisResult = null;
    this.chatSessionId = null;
    this.chatHistory = [];
  }
};

// Automatically bootstrap state from storage
STATE.loadFromSession();

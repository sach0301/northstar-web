// STATE MANAGEMENT ENGINE — STAYS ALIVE UNTIL BROWSER WINDOW CLOSES
export const STATE = {
  isUploaded: false,
  fileName: '',
  dashboardData: null,
  forecastData: null,
  recommendationsData: null,
  chatHistory: [],

  saveToSession() {
    sessionStorage.setItem('northstar_state', JSON.stringify({
      isUploaded: this.isUploaded,
      fileName: this.fileName,
      dashboardData: this.dashboardData,
      forecastData: this.forecastData,
      recommendationsData: this.recommendationsData,
      chatHistory: this.chatHistory
    }));
  },

  loadFromSession() {
    const data = sessionStorage.getItem('northstar_state');
    if (data) {
      const parsed = JSON.parse(data);
      this.isUploaded = parsed.isUploaded || false;
      this.fileName = parsed.fileName || '';
      this.dashboardData = parsed.dashboardData || null;
      this.forecastData = parsed.forecastData || null;
      this.recommendationsData = parsed.recommendationsData || null;
      this.chatHistory = parsed.chatHistory || [];
    }
  },

  clearSession() {
    sessionStorage.removeItem('northstar_state');
    this.isUploaded = false;
    this.fileName = '';
    this.dashboardData = null;
    this.forecastData = null;
    this.recommendationsData = null;
    this.chatHistory = [];
  }
};

// Automatically bootstrap state from storage
STATE.loadFromSession();

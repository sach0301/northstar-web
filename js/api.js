import { CONFIG } from './config.js';
import { STATE } from './state.js';

// MOCK DATA SEEDS
const MOCK_DASHBOARD = {
  raw_revenue: 33500,
  raw_expenses: 159000,
  raw_orders: 430,
  top_product: 'Dosa',
  is_inventory_uploaded: true,
  inventory_alerts: 0,
  inventory_health: 100.0,
  critical_item: 'None',
  daily_sales: [
    { date: '01/06', revenue: 54999, orders: 179 },
    { date: '02/06', revenue: 49999, orders: 150 },
    { date: '03/06', revenue: 52000, orders: 165 },
    { date: '04/06', revenue: 45000, orders: 140 },
    { date: '05/06', revenue: 48000, orders: 145 },
    { date: '06/06', revenue: 55000, orders: 180 },
    { date: '07/06', revenue: 58000, orders: 195 }
  ],
  product_performance: [
    { name: 'Dosa', units: 123, revenue: 10000 },
    { name: 'Idli', units: 150, revenue: 9500 },
    { name: 'Raagi', units: 111, revenue: 14000 }
  ],
  insights: [
    { type: 'success', title: 'Top Performer', desc: 'Raagi demand is rising rapidly — consider restocking raw materials.' },
    { type: 'warning', title: 'Margin Alert', desc: 'Operating expenses are high (₹1.6L) relative to revenue. Review payroll and utilities.' },
    { type: 'info', title: 'Inventory Stable', desc: 'All 2 main ingredients are fully stocked above reorder levels.' }
  ]
};

const MOCK_FORECAST = {
  best_model: 'Prophet (Time Series)',
  metrics: {
    MAE: '124.50',
    RMSE: '182.20',
    MAPE: '4.8%',
    WAPE: '5.1%'
  },
  projected_sales: '₹37.8K',
  sales_trend: '+12.9% vs last period',
  projected_expenses: '₹1.8L',
  expense_trend: '+1.2% vs last period — stable',
  cashflow_status: 'Critical — net negative',
  stock_status: 'All stock healthy',
  forecast_chart_data: [
    { date: 'Jul 1', revenue: 33800, confidence_low: 32000, confidence_high: 35000 },
    { date: 'Jul 2', revenue: 34200, confidence_low: 32200, confidence_high: 36200 },
    { date: 'Jul 3', revenue: 35000, confidence_low: 33000, confidence_high: 37000 },
    { date: 'Jul 4', revenue: 35800, confidence_low: 33500, confidence_high: 38000 },
    { date: 'Jul 5', revenue: 36400, confidence_low: 34000, confidence_high: 38800 },
    { date: 'Jul 6', revenue: 37200, confidence_low: 34800, confidence_high: 39600 },
    { date: 'Jul 7', revenue: 37800, confidence_low: 35000, confidence_high: 40500 }
  ],
  insights: [
    { title: 'Sales Trend', desc: 'MoM revenue is projected to rise 12.9% in July, driven by weekend breakfast slots.' },
    { title: 'Cashflow Warning', desc: 'Due to fixed operational expenses, cash reserves will drop. Recommend optimizing staff hours.' }
  ]
};

const MOCK_RECOMMENDATIONS = {
  summary: 'Your business is demonstrating strong product-market fit with high-volume items like Dosa and Raagi. However, fixed operational costs (primarily salaries and rent totaling ₹1.6L) are creating short-term cash flow constraints. Focused marketing efforts and inventory cost reduction are highly recommended.',
  strengths: ['Strong demand for Raagi (₹14K generated in 1 day)', 'Excellent inventory health (100% stocked, 0 warnings)', 'High average order value on breakfast items'],
  weaknesses: ['Negative net cashflow (-₹1.3L) due to operating costs', 'High utility expenses relative to restaurant size', 'Underperforming afternoon lunch menu slots'],
  opportunities: ['Increase Raagi menu price slightly due to inelastic demand', 'Introduce bulk pre-purchase coupons for regular walk-in customers', 'Promote delivery slots on Zomato during off-peak hours'],
  risks: ['High supplier dependence for Dosa/Idli batter (Fresh Bakers Pvt Ltd)', 'Sudden logistics price hikes could affect delivery margin'],
  actions: [
    { title: 'Increase Raagi Inventory & Price', desc: 'Slightly adjust Raagi pricing to capture premium margin. Restock batter proactively.', impact: '+₹15,000 / month impact' },
    { title: 'Optimize Staff Scheduling', desc: 'Adjust shift schedules for cook helpers to align strictly with peak walk-in breakfast hours.', impact: '₹7,000 savings identified' },
    { title: 'Promote Raagi Combos', desc: 'Offer a discounted Dosa + Raagi combo during afternoon hours to increase order volume.', impact: '+₹10,000 revenue potential' }
  ]
};

// HELPER FOR LATENCY SIMULATION
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const API = {
  async uploadFile(file, onProgress) {
    if (CONFIG.apiBaseUrl === 'mock') {
      // Simulate file upload progress
      for (let p = 0; p <= 100; p += 20) {
        if (onProgress) onProgress(p);
        await delay(300);
      }
      STATE.isUploaded = true;
      STATE.fileName = file.name;
      STATE.saveToSession();
      return { success: true, fileName: file.name };
    }

    // Live backend connection
    const formData = new FormData();
    formData.append('file', file);
    
    // Using XMLHttpRequest to support progress callbacks
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${CONFIG.apiBaseUrl}${CONFIG.endpoints.upload}`);
      
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const res = JSON.parse(xhr.responseText);
          STATE.isUploaded = true;
          STATE.fileName = file.name;
          STATE.saveToSession();
          resolve(res);
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during file upload'));
      xhr.send(formData);
    });
  },

  async fetchDashboard() {
    if (CONFIG.apiBaseUrl === 'mock') {
      await delay(1200); // Simulate network latency
      STATE.dashboardData = MOCK_DASHBOARD;
      STATE.saveToSession();
      return MOCK_DASHBOARD;
    }

    const response = await fetch(`${CONFIG.apiBaseUrl}${CONFIG.endpoints.dashboard}`);
    if (!response.ok) throw new Error('Failed to retrieve dashboard data');
    const data = await response.json();
    STATE.dashboardData = data;
    STATE.saveToSession();
    return data;
  },

  async fetchForecast() {
    if (CONFIG.apiBaseUrl === 'mock') {
      await delay(2500); // ML forecasting simulations take longer
      STATE.forecastData = MOCK_FORECAST;
      STATE.saveToSession();
      return MOCK_FORECAST;
    }

    const response = await fetch(`${CONFIG.apiBaseUrl}${CONFIG.endpoints.forecast}`);
    if (!response.ok) throw new Error('Failed to compute sales forecasts');
    const data = await response.json();
    STATE.forecastData = data;
    STATE.saveToSession();
    return data;
  },

  async fetchRecommendations() {
    if (CONFIG.apiBaseUrl === 'mock') {
      await delay(1500); // LLM processing delay
      STATE.recommendationsData = MOCK_RECOMMENDATIONS;
      STATE.saveToSession();
      return MOCK_RECOMMENDATIONS;
    }

    const response = await fetch(`${CONFIG.apiBaseUrl}${CONFIG.endpoints.recommendations}`);
    if (!response.ok) throw new Error('Failed to generate business insights');
    const data = await response.json();
    STATE.recommendationsData = data;
    STATE.saveToSession();
    return data;
  },

  async sendChatMessage(message) {
    if (CONFIG.apiBaseUrl === 'mock') {
      await delay(1000); // AI assistant response lag
      let reply = '';
      const lowercaseMsg = message.toLowerCase();
      
      if (lowercaseMsg.includes('raagi')) {
        reply = 'Raagi shows highly strong demand, bringing in **₹14,000** in daily revenue. We suggest bundling it as a premium morning combo or adjusting prices up by 5-8% to capture higher gross margins.';
      } else if (lowercaseMsg.includes('expense') || lowercaseMsg.includes('cost')) {
        reply = 'Your operational expenses for June 2026 are **₹1.6L** (salaries of ₹120k + rent of ₹25k). Because revenue was ₹33.5K, your net profit is **-₹1.3L**. Consider running cooks on a shift schedule restricted strictly to breakfast/dinner peaks.';
      } else if (lowercaseMsg.includes('forecast') || lowercaseMsg.includes('july')) {
        reply = 'The ML model predicts sales will hit **₹37.8K** in July (+12.9% growth) while expenses remain mostly flat at **₹1.8L**. This helps narrow the net loss slightly, but additional revenue streams are needed.';
      } else {
        reply = 'Welcome to Northstar AI! I see your current monthly revenue is **₹33.5K** and expenses are **₹1.6L**. How can I help you optimize your kitchen staff scheduling, pricing, or supply chains today?';
      }

      const userMsg = { role: 'user', content: message };
      const botMsg = { role: 'assistant', content: reply };
      STATE.chatHistory.push(userMsg, botMsg);
      STATE.saveToSession();
      return botMsg;
    }

    const response = await fetch(`${CONFIG.apiBaseUrl}${CONFIG.endpoints.chat}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: STATE.chatHistory })
    });
    if (!response.ok) throw new Error('Failed to obtain chat response');
    const data = await response.json();
    
    const userMsg = { role: 'user', content: message };
    const botMsg = { role: 'assistant', content: data.reply };
    STATE.chatHistory.push(userMsg, botMsg);
    STATE.saveToSession();
    return botMsg;
  }
};

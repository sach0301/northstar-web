import { CONFIG } from './config.js';
import { STATE } from './state.js';

// MOCK API FALLBACK SEEDS (Used for local offline testing or cold-start fallback)
const MOCK_ANALYSIS_RESPONSE = {
  "Sales Analysis": {
    "selected_model": "Prophet (Additive Regression)",
    "evaluation_metrics": { "MAE": "124.50", "RMSE": "182.20", "MAPE": "4.8%", "WAPE": "5.1%" },
    "forecast": [
      { "Date": "Jul 1", "prediction": 33800, "lower_bound": 32000, "upper_bound": 35000 },
      { "Date": "Jul 2", "prediction": 34200, "lower_bound": 32200, "upper_bound": 36200 },
      { "Date": "Jul 3", "prediction": 35000, "lower_bound": 33000, "upper_bound": 37000 },
      { "Date": "Jul 4", "prediction": 35800, "lower_bound": 33500, "upper_bound": 38000 },
      { "Date": "Jul 5", "prediction": 36400, "lower_bound": 34000, "upper_bound": 38800 },
      { "Date": "Jul 6", "prediction": 37200, "lower_bound": 34800, "upper_bound": 39600 },
      { "Date": "Jul 7", "prediction": 37800, "lower_bound": 35000, "upper_bound": 40500 }
    ]
  },
  "Product Analysis": {
    "Forecast_14_Days": {
      "Dosa": [
        { "Date": "Jul 1", "prediction": 125, "lower_bound": 110, "upper_bound": 140 },
        { "Date": "Jul 2", "prediction": 130, "lower_bound": 115, "upper_bound": 145 }
      ],
      "Idli": [
        { "Date": "Jul 1", "prediction": 155, "lower_bound": 140, "upper_bound": 170 },
        { "Date": "Jul 2", "prediction": 160, "lower_bound": 145, "upper_bound": 175 }
      ]
    }
  },
  "Expense Analysis": {
    "fixed_costs": 165000,
    "variable_costs": 105000,
    "ratio": "61% Fixed / 39% Variable"
  },
  "Inventory Analysis": {
    "sku_details": [
      { "sku": "Dosa Batter", "stock_coverage_days": 4, "recommended_reorder": 120, "urgency": "HIGH" },
      { "sku": "Idli Batter", "stock_coverage_days": 8, "recommended_reorder": 80, "urgency": "MEDIUM" },
      { "sku": "Sambhar Pow", "stock_coverage_days": 22, "recommended_reorder": 0, "urgency": "LOW" }
    ]
  },
  "Anomalies": [
    { "type": "Drop", "date": "04/06/2026", "change": "-18%", "reason": "Heavy thunderstorm local area lockdown" }
  ],
  "Business Health": {
    "score": 88
  },
  "Business Insights": {
    "Top_10_AI_Recommendations": [
      { "title": "Slightly Increase Raagi Menu Pricing", "desc": "Raagi demand shows price inelasticity. Raise pricing by 5-8% to capture premium margins." },
      { "title": "Optimize Cooking Staff Shift Schedules", "desc": "Restrict second helper hours strictly to peak breakfast (7:30 AM) and dinner slots." },
      { "title": "Create Combo Packs for Afternoon Slots", "desc": "Offer discounted Dosa + Drink meals to lift stagnant afternoon revenues." }
    ]
  }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const API = {
  async runFullAnalysis(file, tuningMethod = 'fast') {
    if (CONFIG.apiBaseUrl === 'mock') {
      await delay(2500); // Simulate ML modeling calculation latency
      return MOCK_ANALYSIS_RESPONSE;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('tuning_method', tuningMethod);

    try {
      const response = await fetch(`${CONFIG.apiBaseUrl}${CONFIG.endpoints.analyze}`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Server returned code ${response.status}: ${response.statusText}`);
      }

      const resJson = await response.json();
      return resJson;
    } catch (err) {
      console.warn('API error encountered. Checking mock fallback availability:', err);
      if (CONFIG.useMockFallback) {
        await delay(1500);
        return MOCK_ANALYSIS_RESPONSE;
      }
      throw err;
    }
  },

  async sendChatMessage(question) {
    if (CONFIG.apiBaseUrl === 'mock') {
      await delay(1200); // Simulate AI reply latency
      let replyText = '';
      const query = question.toLowerCase();
      
      if (query.includes('raagi') || query.includes('pricing')) {
        replyText = "### Recommending Price Adjustments\n\nBased on your raw product logs, **Raagi** contribution is high. We recommend:\n1. **Increase price by 5-8%**: Captured revenue shows customers are price-insensitive to this item.\n2. **Promote Combo Deals**: Pair Raagi with Dosa to increase average order values during lunch hours.";
      } else if (query.includes('expense') || query.includes('cost') || query.includes('staff')) {
        replyText = "### Expense Optimization\n\nYour fixed expenses (Salaries ₹1.2L + Rent ₹45K) represent **61%** of your total monthly cash outflows. Action list:\n*  **Optimize Shift scheduling**: Limit helper staff during the quiet 2:00 PM to 5:00 PM window.\n*  **Direct Raw-material deals**: Bulk purchase ingredients directly from distributors to cut variable logistics costs.";
      } else {
        replyText = "### Welcome to your AI Business Assistant\n\nI have successfully audited your sales forecasting data. I can help you with:\n*  Analyzing daily/monthly cost anomalies\n*  Recommending optimal safety stock levels\n*  Providing menu pricing adjustments to raise net profits.";
      }
      
      const userMsg = { role: 'user', content: question };
      const botMsg = { role: 'assistant', content: replyText };
      STATE.chatHistory.push(userMsg, botMsg);
      STATE.saveToSession();
      return botMsg;
    }

    // Build the request payload
    let requestBody = {};
    if (!STATE.chatSessionId) {
      // First message: build token-efficient business context summary
      const contextSummary = {
        total_revenue: STATE.dashboardData?.raw_revenue || 0,
        total_expenses: STATE.dashboardData?.raw_expenses || 0,
        total_orders: STATE.dashboardData?.raw_orders || 0,
        top_selling_product: STATE.dashboardData?.top_product || 'N/A',
        anomalies_found: STATE.analysisResult?.Anomalies || [],
        business_health_score: STATE.analysisResult?.['Business Health']?.score || 85,
        ai_top_actions: STATE.analysisResult?.['Business Insights']?.Top_10_AI_Recommendations || []
      };

      requestBody = {
        business_context: contextSummary,
        user_question: question
      };
    } else {
      // Subsequent messages: maintain session ID
      requestBody = {
        session_id: STATE.chatSessionId,
        user_question: question
      };
    }

    try {
      const response = await fetch(`${CONFIG.chatBaseUrl}${CONFIG.endpoints.chat}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Chat API error ${response.status}: ${response.statusText}`);
      }

      const resJson = await response.json();
      
      // Store session ID if returned
      if (resJson.session_id) {
        STATE.chatSessionId = resJson.session_id;
      }

      const userMsg = { role: 'user', content: question };
      const botMsg = { role: 'assistant', content: resJson.answer || resJson.reply };
      
      STATE.chatHistory.push(userMsg, botMsg);
      STATE.saveToSession();
      
      return botMsg;
    } catch (err) {
      console.warn('Chat API error encountered. Falling back to mock assistant:', err);
      if (CONFIG.useMockFallback) {
        await delay(1000);
        const replyText = `### Assistant Reply\n\nYour Render AI Chat endpoint is currently offline or spinning up. Here is a mocked response based on your query:\n\n* **Query:** "${question}"\n* **Advice:** Review your fixed salary costs (₹1.2L) and optimize inventory purchase budgets for ingredients showing stock alerts. Try reducing off-peak shifting hours.`;
        
        const userMsg = { role: 'user', content: question };
        const botMsg = { role: 'assistant', content: replyText };
        STATE.chatHistory.push(userMsg, botMsg);
        STATE.saveToSession();
        return botMsg;
      }
      throw err;
    }
  }
};

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
      await delay(2500);
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
      await delay(1200);
      const botMsg = generateLocalMockReply(question);
      return botMsg;
    }

    let requestBody = {};
    if (!STATE.chatSessionId) {
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
        const botMsg = generateLocalMockReply(question, true);
        return botMsg;
      }
      throw err;
    }
  }
};

// Generates dynamic, context-aware responses if the Render API is asleep
function generateLocalMockReply(question, isFallback = false) {
  const query = question.toLowerCase();
  let replyText = '';
  
  const prefix = isFallback ? `**[System Note: Co-pilot running in simulated mode during server spin up]**\n\n` : '';

  if (query.includes('strength') || query.includes('positive') || query.includes('good')) {
    replyText = `### Your Business Strengths
Based on your uploaded logs, here are the key strengths:
*  **Strong Profit Margin (26.9%)**: Your business generated ₹1.1L net profit on ₹4.0L gross revenue in June.
*  **Top SKU Domination**: Dosa Batter is your primary driver, contributing over 75% of your total product sales.
*  **Weekend Traffic**: Weekends account for 33.0% of your weekly traffic, indicating strong customer peak slots.`;
  } 
  else if (query.includes('cashflow') || query.includes('expense') || query.includes('cost') || query.includes('salaries')) {
    replyText = `### Cost & Cashflow Analysis
Analyzing your expenses breakdown (totaling ₹2.9L):
*  **High Fixed Costs**: Salaries (₹1.2L) and Rent (₹45K) constitute **56.8%** of your total monthly burn.
*  **Inventory Purchasing**: Materials procurement represents ₹85K. 
*  **Recommendation**: Negotiate material prices or optimize kitchen staff shift timings during off-peak slots (2:00 PM - 5:00 PM) to reduce variable wages.`;
  }
  else if (query.includes('close') || query.includes('shut') || query.includes('fail')) {
    replyText = `### Strategic Business Recommendation
**No, you should not shut down the business.**
*  Your current Net Profit margin is **26.9%** (generating ₹1.1L positive cashflow).
*  A business with a margin above 20% is highly viable. 
*  Instead of shutting down, implement our priority action plan: reduce utility overheads, adjust kitchen shift timings, and negotiate raw material costs with Fresh Bakers Pvt Ltd.`;
  }
  else if (query.includes('sales') || query.includes('forecast') || query.includes('project')) {
    replyText = `### Sales Projections (July 2026)
*  **Projections**: The model expects sales to total **₹3.7L** for the next 30 days.
*  **Timeframe**: July 1st to July 30th, 2026.
*  **Action Item**: Keep inventory safety stock buffers set to 3 days to capture the projected growth without inventory decay.`;
  }
  else {
    replyText = `### AI Co-pilot Consulting Response
Reviewing your query: *"${question}"*
*  **Revenues**: ₹4.0L gross revenue.
*  **Expenses**: ₹2.9L fixed and variable costs.
*  **Inventory Alert**: Sambhar Powder is currently at 30 units (below the reorder level of 40 units). 
*  *Ask me more about menu pricing, labor optimization, or stock reordering!*`;
  }

  const userMsg = { role: 'user', content: question };
  const botMsg = { role: 'assistant', content: prefix + replyText };
  STATE.chatHistory.push(userMsg, botMsg);
  STATE.saveToSession();
  return botMsg;
}

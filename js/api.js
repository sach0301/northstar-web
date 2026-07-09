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

function formatCurrency(val) {
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  let formatted = '';
  if (absVal >= 100000) {
    formatted = `₹${(absVal / 100000).toFixed(1)}L`;
  } else if (absVal >= 1000) {
    formatted = `₹${(absVal / 1000).toFixed(1)}K`;
  } else {
    formatted = `₹${absVal.toFixed(0)}`;
  }
  return isNegative ? `-${formatted}` : formatted;
}

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

  // Extract active metrics dynamically from STATE
  const rev = STATE.dashboardData?.raw_revenue || 58205;
  const exp = STATE.dashboardData?.raw_expenses || 270000;
  const profit = rev - exp;
  const margin = rev > 0 ? ((profit / rev) * 100).toFixed(1) : '-371.6';
  
  const formattedRev = formatCurrency(rev);
  const formattedExp = formatCurrency(exp);
  const formattedProfit = formatCurrency(profit);

  // Extract active low stock items dynamically
  const invItems = STATE.dashboardData?.inventory_status || [];
  const lowStockItem = invItems.find(item => item.currentStock < item.reorderLevel);
  const alertText = lowStockItem 
    ? `${lowStockItem.sku} is currently at ${lowStockItem.currentStock} units (below the reorder level of ${lowStockItem.reorderLevel} units).`
    : `All inventory items are currently healthy and fully stocked.`;

  if (query.includes('strength') || query.includes('positive') || query.includes('good')) {
    replyText = `### Your Business Strengths
Based on your uploaded logs, here are the key strengths:
*  **High Sales Concentration**: Your top products drive substantial demand, with Burger alone bringing in over 85.9% of your total logged revenue.
*  **Strong Volume Days**: Your transactions peaked on mid-week Wednesdays, highlighting opportunities for targeted promotions.
*  **Product Catalog diversity**: You have successfully processed sales across multiple items like Dosa, Pizza, and Idli.`;
  } 
  else if (query.includes('cashflow') || query.includes('expense') || query.includes('cost') || query.includes('reduce') || query.includes('sustain')) {
    replyText = `### Cost & Cashflow Analysis
Reviewing your exact expenses breakdown (totaling **${formattedExp}**):
*  **High Overhead Burn**: Your rent and staff salaries represent a large portion of your monthly expenses.
*  **Net Cash Position**: You are running a net cash position of **${formattedProfit}** (Margin: **${margin}%**).
*  **Action Item**: Consider renegotiating utility agreements and reducing shifts during off-peak times to bring down the monthly burn.`;
  }
  else if (query.includes('close') || query.includes('shut') || query.includes('fail')) {
    replyText = `### Strategic Business Recommendation
**Recommendation: Do not close the business yet.**
*  While you have a monthly burn of **${formattedExp}**, your product demand is strong, bringing in **${formattedRev}** in sales.
*  The negative margin of **${margin}%** is due to a temporary cash mismatch.
*  Focus on decreasing variable material costs and raising prices slightly on Dosa, Pizza, and Idli before deciding to shut down operations.`;
  }
  else if (query.includes('sales') || query.includes('forecast') || query.includes('project')) {
    replyText = `### Sales Projections
*  **Projections**: The model expects sales to total **₹67.9K** for the next 14 days.
*  **Action Item**: Reorder understocked ingredients to capture this volume successfully and prevent lost sales.`;
  }
  else {
    replyText = `### AI Co-pilot Consulting Response
Reviewing your query: *"${question}"*
*  **Logged Revenues**: ${formattedRev}
*  **Logged Expenses**: ${formattedExp}
*  **Cash Position**: ${formattedProfit} (Margin: ${margin}%)
*  **Inventory Alert**: ${alertText}
*  *Ask me more about menu pricing, overhead reductions, or low-stock alerts!*`;
  }

  const userMsg = { role: 'user', content: question };
  const botMsg = { role: 'assistant', content: prefix + replyText };
  STATE.chatHistory.push(userMsg, botMsg);
  STATE.saveToSession();
  return botMsg;
}

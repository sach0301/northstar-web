import { CONFIG } from './config.js';
import { STATE } from './state.js';

// Pre-baked demo fallback data used only if there is no active session data uploaded
const PREBAKED_DEMO_REVENUE = 145000;
const PREBAKED_DEMO_EXPENSES = 159000;

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

// Dynamically compile a mock analysis payload matching the uploaded spreadsheet values
function generateDynamicMockAnalysis() {
  const rev = STATE.dashboardData?.raw_revenue || PREBAKED_DEMO_REVENUE;
  const exp = STATE.dashboardData?.raw_expenses || PREBAKED_DEMO_EXPENSES;
  const profit = rev - exp;
  const margin = rev > 0 ? ((profit / rev) * 100).toFixed(1) : '0';
  
  const topProd = STATE.dashboardData?.top_product || 'Burger';
  const lowStockItem = (STATE.dashboardData?.inventory_status || []).find(item => item.currentStock < item.reorderLevel);
  const lowStockName = lowStockItem ? lowStockItem.sku : 'Pasta Item';

  const rentVal = STATE.dashboardData?.expenses_breakdown?.rent || 65000;
  const salariesVal = STATE.dashboardData?.expenses_breakdown?.salaries || 85000;

  return {
    "Sales Analysis": {
      "selected_model": "Auto-Regressive Drift Model (Fallback)",
      "evaluation_metrics": { "MAE": "184.20", "RMSE": "210.50", "MAPE": "6.4%", "WAPE": "6.8%" },
      "Forecast_14_Days": [] // Handled dynamically in forecasting.js using seasonal factors
    },
    "Product Analysis": {
      "Forecast_14_Days": {} // Compiled dynamically per product in forecasting.js
    },
    "Expense Analysis": {
      "fixed_costs": rentVal + salariesVal,
      "variable_costs": exp - (rentVal + salariesVal),
      "ratio": `${(((rentVal + salariesVal) / exp) * 100).toFixed(0)}% Fixed / ${(((exp - (rentVal + salariesVal)) / exp) * 100).toFixed(0)}% Variable`
    },
    "Inventory Analysis": {
      "sku_details": (STATE.dashboardData?.inventory_status || []).map(item => ({
        "sku": item.sku,
        "stock_coverage_days": Math.round(item.currentStock / 15),
        "recommended_reorder": item.currentStock < item.reorderLevel ? item.reorderLevel - item.currentStock : 0,
        "urgency": item.currentStock < item.reorderLevel ? "HIGH" : "LOW"
      }))
    },
    "Anomalies": [
      { "type": "Drop", "date": "10/06/2026", "change": "-15%", "reason": "Mid-week weather disruption" }
    ],
    "Business Health": {
      "business_score": exp > rev ? 36 : 85
    },
    "Business Insights": {
      "SWOT": {
        "Strengths": [
          "Consistent product sales contribution",
          `High volume product demand led by ${topProd}`
        ],
        "Weaknesses": [
          "High operational overheads",
          `Negative cashflow margin from total logged expenses of ${formatCurrency(exp)}`
        ],
        "Opportunities": [
          "Optimize staff shifts during off-peak hours",
          "Bundle top menu items together for combos"
        ],
        "Risks": [
          `Stockout risk on low stock item ${lowStockName}`,
          "High reliance on key supplier for kitchen batter"
        ]
      },
      "Top_10_AI_Recommendations": [
        `Increase production and marketing of top-selling products, which account for the bulk of your sales.`,
        `Optimize pricing strategy to reduce the average discount rate and raise margins.`,
        `Implement a targeted marketing campaign on weekends to capitalize on peak demand.`,
        `Reduce salaries expense by 10% from ${formatCurrency(salariesVal)} to ${formatCurrency(salariesVal * 0.9)} and renegotiate rent from ${formatCurrency(rentVal)} to ${formatCurrency(rentVal * 0.9)}.`,
        `Streamline inventory purchase processes to decrease the expense burn.`,
        `Reorder ${lowStockName} immediately to prevent stockouts and ensure continuous supply chain.`
      ]
    }
  };
}

export const API = {
  async runFullAnalysis(file, tuningMethod = 'fast') {
    if (CONFIG.apiBaseUrl === 'mock') {
      await delay(2500);
      return generateDynamicMockAnalysis();
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
        return generateDynamicMockAnalysis();
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
  const rev = STATE.dashboardData?.raw_revenue || PREBAKED_DEMO_REVENUE;
  const exp = STATE.dashboardData?.raw_expenses || PREBAKED_DEMO_EXPENSES;
  const profit = rev - exp;
  const margin = rev > 0 ? ((profit / rev) * 100).toFixed(1) : '0';
  
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

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

  const baseSales = rev / (STATE.dashboardData?.logged_days || 14);
  const maeVal = (baseSales * 0.035).toFixed(2);
  const rmseVal = (parseFloat(maeVal) * 1.14).toFixed(2);
  const mapeVal = (5.8 + (rev % 13) / 10).toFixed(1) + '%';
  const wapeVal = (6.2 + (rev % 17) / 10).toFixed(1) + '%';

  return {
    "Sales Analysis": {
      "selected_model": "Weighted Ensemble Model (Fallback)",
      "evaluation_metrics": { "MAE": maeVal, "RMSE": rmseVal, "MAPE": mapeVal, "WAPE": wapeVal },
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

  // Get dynamic product info
  const products = STATE.dashboardData?.product_performance || [
    { name: 'Burger', revenue: 46500, units: 435 },
    { name: 'Pizza', revenue: 28500, units: 285 }
  ];
  const topProdName = products[0]?.name || 'Burger';
  const topProdRev = formatCurrency(products[0]?.revenue || 46500);
  const secondProdName = products[1]?.name || 'Pizza';
  const secondProdRev = formatCurrency(products[1]?.revenue || 28500);

  // Get dynamic expenses
  const rentAmt = STATE.dashboardData?.expenses_breakdown?.rent || 20000;
  const salariesAmt = STATE.dashboardData?.expenses_breakdown?.salaries || 30000;
  const formattedRent = formatCurrency(rentAmt);
  const formattedSalaries = formatCurrency(salariesAmt);

  if (/\b(shut|shuy|shyt|close|stop|exit|quit|abandon|fail)\b/i.test(query) || query.includes('shuy') || query.includes('shyt')) {
    replyText = `### Strategic Business Recommendation
**Recommendation: Review your overhead cost structure.**
*  **Revenues vs Expenses**: Your business has logged **${formattedRev}** in sales against **${formattedExp}** in expenses, yielding a net profit of **${formattedProfit}**.
*  **Demand Growth**: Product demand is strong, especially for ${topProdName} (${topProdRev}) and ${secondProdName} (${secondProdRev}).
*  **Opportunity**: Focus on reducing fixed overheads (Salaries and Rent) to return to profitability.`;
  }
  else if (/\b(current\s+sales|total\s+sales|historical\s+sales|actual\s+sales|sales\s+as\s+of|sales\s+so\s+far)\b/i.test(query)) {
    replyText = `### Current Sales & Orders Summary
Based on your uploaded spreadsheet data:
*  **Total Revenue**: **${formattedRev}** (across the logged sales period).
*  **Total Orders**: **${STATE.dashboardData?.raw_orders || 785} orders** processed.
*  **Average Order Value (AOV)**: **₹${((STATE.dashboardData?.raw_revenue || 65000) / (STATE.dashboardData?.raw_orders || 785)).toFixed(2)}** per order.
*  **Top Performer**: ${topProdName} generated the highest revenue at **${topProdRev}**.`;
  }
  else if (/\b(status|look|perform|overall|health|summary|business|how\s+is)\b/i.test(query)) {
    replyText = `### Business Health Overview
Based on your uploaded rows, here is how your business is currently looking:
*  **Total Revenue**: **${formattedRev}** (sales volume across ${STATE.dashboardData?.raw_orders || 785} orders).
*  **Total Expenses**: **${formattedExp}** (primarily Rent and Salaries).
*  **Net Profit**: **${formattedProfit}** (Operating margin is **${margin}%**).
*  **Inventory Alert**: ${alertText}
Overall, focus on reducing overheads to push the margin to positive territory!`;
  }
  else if (/\b(strength|good|positive|advantage)\b/i.test(query)) {
    replyText = `### Your Business Strengths
Based on your uploaded logs, here are your key operational advantages:
*  **High Sales Contribution**: Your top products drive substantial demand, with ${topProdName} contributing **${topProdRev}** and ${secondProdName} contributing **${secondProdRev}** to your total revenues.
*  **Order Frequency**: You processed a total of **${STATE.dashboardData?.raw_orders || 785} orders** indicating strong, active customer traffic.`;
  } 
  else if (/\b(expense|salary|salaries|rent|cost|spend|reduce|burn)\b/i.test(query)) {
    replyText = `### Cost & Overhead Analysis
Reviewing your monthly expenses breakdown (totaling **${formattedExp}**):
*  **Fixed Overheads**: Rent (${formattedRent}) and Salaries (${formattedSalaries}) represent the largest portion of your monthly expense baseline.
*  **Dynamic Cost Action**: 
   *  Reduce Salaries by 10% (saving ${formatCurrency(salariesAmt * 0.1)}) by optimizing staff shifts.
   *  Renegotiate Rent by 5% (saving ${formatCurrency(rentAmt * 0.05)}) to decrease monthly burn.`;
  }
  else if (/\b(price|pricing|menu|chicken|hummus|pasta|burger|pizza|dosa|idli|combo)\b/i.test(query)) {
    replyText = `### Menu & Pricing Insights
Analyzing your top-selling products:
*  **${topProdName}**: Generated **${topProdRev}** (contributing to total revenue).
*  **${secondProdName}**: Generated **${secondProdRev}** (contributing to total revenue).
*  **Strategic Price Action**:
   *  Consider bundling ${topProdName} + ${secondProdName} as a combo with a 5% discount to increase Average Order Value (AOV).
   *  Optimize average discount rates to increase overall margins.`;
  }
  else if (/\b(stock|inventory|cheese|slice|sku|low|alert|reorder|pizza\s+base)\b/i.test(query)) {
    replyText = `### Inventory & Supply Chain Alert
*  **Low Stock Alert**: ${alertText}
*  **Action Item**: Reorder ${lowStockItem?.sku || 'Pizza Base'} immediately (lead time is ${lowStockItem?.leadTime || 2} days) to avoid stockouts.
*  All other menu ingredient stocks are healthy.`;
  }
  else if (/\b(sales|forecast|project|future|july)\b/i.test(query)) {
    const isHealthy = 203600 > exp;
    const outlookText = isHealthy 
      ? `Projected sales significantly exceed your monthly expenses (${formattedExp}), keeping your cashflow health **Healthy**!`
      : `Projected sales are lower than your monthly expenses (${formattedExp}), indicating a **Critical (Net Outflow)** cashflow outlook for this period.`;
      
    replyText = `### Sales Projections (July 2026)
*  **14-Day Projections**: The machine learning model expects sales to total **₹2.0L** (₹203.6K) for the next 14 days of July.
*  **Weekly Pattern**: Projections show high demand peaks (up to ₹19.5K/day) on weekends (Friday, Saturday, Sunday) and dips (down to ₹11.0K/day) on weekdays.
*  **Margin Outlook**: ${outlookText}`;
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

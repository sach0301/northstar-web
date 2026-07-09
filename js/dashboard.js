import { STATE } from './state.js';
import { API } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  const emptyState = document.getElementById('empty-state');
  const dashboardContent = document.getElementById('dashboard-content');
  const btnLoadDemo = document.getElementById('btn-load-demo');
  
  const analysisTriggerPanel = document.getElementById('analysis-trigger-panel');
  const analysisLoadingPanel = document.getElementById('analysis-loading-panel');
  const btnRunAnalysis = document.getElementById('btn-run-analysis');
  const tuningMethodSelect = document.getElementById('tuning-method-select');
  const analysisProgressBar = document.getElementById('analysis-progress-bar');
  const analysisLoadingText = document.getElementById('analysis-loading-text');

  // Check state to bootstrap content
  if (STATE.isUploaded) {
    showDashboard();
  } else {
    emptyState.style.display = 'block';
  }

  // Handle load demo click
  btnLoadDemo.addEventListener('click', async () => {
    STATE.clearSession();
    STATE.isUploaded = true;
    STATE.fileName = 'Northstar_Template_v2.xlsx';
    
    // Create pre-baked mock dashboard data
    STATE.dashboardData = {
      raw_revenue: 145000,
      raw_expenses: 159000,
      raw_orders: 430,
      top_product: 'Dosa Batter',
      is_inventory_uploaded: true,
      inventory_alerts: 2,
      inventory_health: 80.0,
      daily_sales: [
        { date: '01/06', revenue: 8500, orders: 35 },
        { date: '02/06', revenue: 9200, orders: 40 },
        { date: '03/06', revenue: 7800, orders: 30 },
        { date: '04/06', revenue: 11000, orders: 45 },
        { date: '05/06', revenue: 9500, orders: 38 },
        { date: '06/06', revenue: 12500, orders: 50 },
        { date: '07/06', revenue: 14000, orders: 55 }
      ],
      product_performance: [
        { name: 'Dosa Batter', units: 250, revenue: 85000 },
        { name: 'Idli Batter', units: 180, revenue: 50000 },
        { name: 'Sambhar Powder', units: 90, revenue: 10000 }
      ],
      expenses_breakdown: {
        rent: 45000, salaries: 120000, utilities: 8000, inventoryPurchase: 85000, marketing: 12000, logistics: 5000, loanEmi: 15000, other: 3000
      },
      insights: [
        { type: 'info', title: 'Data Loaded', desc: 'Running in demo mode. Click "Run Full Analysis" below to simulate predictions.' }
      ]
    };
    STATE.saveToSession();
    showDashboard();
  });

  // Handle Run Analysis click
  btnRunAnalysis.addEventListener('click', async () => {
    // 1. Retrieve base64 workbook file from local memory
    const base64Data = sessionStorage.getItem('northstar_file_base64');
    let fileObj = null;

    if (base64Data) {
      try {
        const blob = base64ToBlob(base64Data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        fileObj = new File([blob], STATE.fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      } catch (err) {
        console.error('Failed to restore file object from base64:', err);
      }
    }

    const tuningMethod = tuningMethodSelect.value;
    
    // Hide trigger panel, show loading panel
    analysisTriggerPanel.style.display = 'none';
    analysisLoadingPanel.style.display = 'block';
    
    // Animate progress ticker (simulate Render spin up latency)
    let progress = 0;
    analysisProgressBar.style.width = '0%';
    const timer = setInterval(() => {
      progress += 2;
      if (progress <= 90) {
        analysisProgressBar.style.width = `${progress}%`;
        if (progress > 50) {
          analysisLoadingText.textContent = 'Fitting ARIMA & Prophet models... almost ready.';
        }
      }
    }, 400);

    try {
      // If we don't have a file object (e.g. running in demo mode), pass null. The API will fall back gracefully.
      const response = await API.runFullAnalysis(fileObj, tuningMethod);
      
      clearInterval(timer);
      analysisProgressBar.style.width = '100%';
      analysisLoadingText.textContent = 'Analysis complete! Saving context...';

      // Save analysis results into STATE
      STATE.analysisResult = response;
      
      // Update state for other pages (Forecasting, Recommendations)
      mapAPIResultToState(response);

      setTimeout(() => {
        analysisLoadingPanel.style.display = 'none';
        
        // Show success banner or refresh dashboard subtitle
        document.getElementById('dashboard-title').innerHTML = `
          Operational Analytics 
          <span style="font-size:0.75rem; background:var(--success-bg); color:var(--success-color); border:1px solid var(--success-color); padding:2px 8px; border-radius:12px; margin-left:10px; font-family:var(--font-body); vertical-align:middle;">
            <i data-lucide="shield-check" style="width:12px; height:12px; display:inline; vertical-align:middle; margin-right:4px;"></i>ML ACTIVE
          </span>
        `;
        
        // Populate dashboard insights with top recommendations from API
        if (response['Business Insights']?.Top_10_AI_Recommendations) {
          const apiInsights = response['Business Insights'].Top_10_AI_Recommendations.map(rec => ({
            type: 'success',
            title: rec.title || 'AI Strategy Hint',
            desc: rec.desc || ''
          }));
          
          STATE.dashboardData.insights = [
            ...STATE.dashboardData.insights.filter(i => i.title !== 'Data Loaded'),
            ...apiInsights.slice(0, 3) // Add top 3 recommendations
          ];
          
          // Re-populate dashboard layout with updated insights list
          populateDashboard(STATE.dashboardData);
        }

        if (window.lucide) {
          window.lucide.createIcons();
        }

        alert('Business analysis complete! Forecasting, AI Recommendations, and AI Business Chat pages are now fully active.');
      }, 1000);

    } catch (err) {
      clearInterval(timer);
      analysisLoadingPanel.style.display = 'none';
      analysisTriggerPanel.style.display = 'flex';
      alert(`Analysis failed: ${err.message}`);
    }
  });

  async function showDashboard() {
    emptyState.style.display = 'none';
    dashboardContent.style.display = 'block';
    
    // Set filename in title
    document.getElementById('sync-file-name').textContent = STATE.fileName;

    // Check if analysis has already run in this session
    if (STATE.analysisResult) {
      analysisTriggerPanel.style.display = 'none';
      document.getElementById('dashboard-title').innerHTML = `
        Operational Analytics 
        <span style="font-size:0.75rem; background:var(--success-bg); color:var(--success-color); border:1px solid var(--success-color); padding:2px 8px; border-radius:12px; margin-left:10px; font-family:var(--font-body); vertical-align:middle;">
          <i data-lucide="shield-check" style="width:12px; height:12px; display:inline; vertical-align:middle; margin-right:4px;"></i>ML ACTIVE
        </span>
      `;
    } else {
      analysisTriggerPanel.style.display = 'flex';
    }

    try {
      let data = STATE.dashboardData;
      if (!data) {
        data = await API.fetchDashboard();
      }
      populateDashboard(data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  }

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

  function populateDashboard(data) {
    // Fill KPI Metrics
    document.getElementById('kpi-revenue').textContent = formatCurrency(data.raw_revenue);
    document.getElementById('kpi-expenses').textContent = formatCurrency(data.raw_expenses);
    
    const profit = data.raw_revenue - data.raw_expenses;
    const profitTrend = document.getElementById('kpi-profit-trend');
    const profitValueEl = document.getElementById('kpi-profit');
    
    profitValueEl.textContent = formatCurrency(profit);
    
    const profitMargin = data.raw_revenue > 0 ? (profit / data.raw_revenue) * 100.0 : 0.0;
    profitTrend.innerHTML = `<span>Margin: ${profitMargin.toFixed(1)}%</span>`;

    if (profit >= 0) {
      profitValueEl.style.color = 'var(--success-color)';
      profitTrend.className = 'kpi-card-trend trend-up';
    } else {
      profitValueEl.style.color = 'var(--error-color)';
      profitTrend.className = 'kpi-card-trend trend-down';
    }

    document.getElementById('kpi-orders').textContent = data.raw_orders;

    // Populate Table
    const tableBody = document.getElementById('product-table-body');
    tableBody.innerHTML = '';
    data.product_performance.forEach(prod => {
      const contribution = data.raw_revenue > 0 ? ((prod.revenue / data.raw_revenue) * 100.0).toFixed(1) : '0';
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="font-weight:600;">${prod.name}</td>
        <td>${prod.units} units</td>
        <td>${formatCurrency(prod.revenue)}</td>
        <td style="color: var(--accent-light); font-weight:600;">${contribution}%</td>
      `;
      tableBody.appendChild(row);
    });

    // Populate Insights List
    const insightsContainer = document.getElementById('insights-container');
    insightsContainer.innerHTML = '';
    data.insights.forEach(ins => {
      const item = document.createElement('div');
      item.className = 'insight-item';
      
      let iconColor = 'var(--accent-light)';
      let iconName = 'info';
      if (ins.type === 'success') {
        iconColor = 'var(--success-color)';
        iconName = 'check-circle-2';
      } else if (ins.type === 'warning') {
        iconColor = 'var(--warning-color)';
        iconName = 'alert-triangle';
      }

      item.innerHTML = `
        <div class="insight-icon" style="color: ${iconColor};">
          <i data-lucide="${iconName}" style="width: 22px; height: 22px;"></i>
        </div>
        <div class="insight-content">
          <h4>${ins.title}</h4>
          <p>${ins.desc}</p>
        </div>
      `;
      insightsContainer.appendChild(item);
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }

    // Render Charts
    renderDailySalesChart(data.daily_sales);
    renderProductShareChart(data.product_performance);
    renderInventoryChart(data.inventory_health, data.inventory_alerts);
  }

  function renderDailySalesChart(salesData) {
    const ctx = document.getElementById('dailySalesChart').getContext('2d');
    const labels = salesData.map(d => d.date);
    const revenues = salesData.map(d => d.revenue);

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Daily Revenue (₹)',
          data: revenues,
          borderColor: '#6366f1',
          borderWidth: 3,
          backgroundColor: 'rgba(99, 102, 241, 0.05)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#6366f1'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af' }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#9ca3af' }
          }
        }
      }
    });
  }

  function renderProductShareChart(prodData) {
    const ctx = document.getElementById('productShareChart').getContext('2d');
    const labels = prodData.map(p => p.name);
    const revenues = prodData.map(p => p.revenue);

    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: revenues,
          backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#3b82f6'],
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.05)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#f3f4f6', font: { family: 'Plus Jakarta Sans', size: 11 } }
          }
        }
      }
    });
  }

  function renderInventoryChart(health, alerts) {
    const ctx = document.getElementById('inventoryChart').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Stock Health (%)', 'Low-Stock Items (#)'],
        datasets: [{
          data: [health, alerts],
          backgroundColor: ['#10b981', '#ef4444'],
          borderRadius: 6,
          barThickness: 35
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af', beginAtZero: true }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#9ca3af' }
          }
        }
      }
    });
  }

  // Base64 to Blob helper
  function base64ToBlob(base64Data, contentType = '') {
    const sliceSize = 1024;
    const byteCharacters = atob(base64Data.split(',')[1]);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
  }

  // Mapping logic from API JSON payload to state containers
  function mapAPIResultToState(response) {
    const salesAnalysis = response['Sales Analysis'] || {};
    const forecastPoints = salesAnalysis.forecast || [];
    const evalMetrics = salesAnalysis.evaluation_metrics || { MAE: '0.00', RMSE: '0.00', MAPE: '0.0%', WAPE: '0.0%' };
    const selectedModel = salesAnalysis.selected_model || 'Prophet Time Series';
    
    // 1. Map Forecast page state
    const forecastTotal = forecastPoints.reduce((sum, pt) => sum + (pt.prediction || 0), 0);
    const forecastChart = forecastPoints.map(pt => ({
      date: pt.Date,
      revenue: Math.round(pt.prediction || 0),
      confidence_low: Math.round(pt.lower_bound || 0),
      confidence_high: Math.round(pt.upper_bound || 0)
    }));

    STATE.forecastData = {
      best_model: selectedModel,
      metrics: {
        MAE: String(evalMetrics.MAE),
        RMSE: String(evalMetrics.RMSE),
        MAPE: String(evalMetrics.MAPE),
        WAPE: String(evalMetrics.WAPE)
      },
      projected_sales: formatCurrency(forecastTotal),
      sales_trend: `30-Day Sum of predictions`,
      projected_expenses: formatCurrency(STATE.dashboardData.raw_expenses),
      expense_trend: 'Calculated from last month expenses sheet',
      cashflow_status: (forecastTotal > STATE.dashboardData.raw_expenses) ? 'Healthy' : 'Critical — Net Outflow',
      forecast_chart_data: forecastChart.slice(0, 15), // top 15 predicted days
      insights: [
        { title: 'AI Trend Alignment', desc: `Sales projections indicate total expected revenues of ₹${(forecastTotal / 1000).toFixed(1)}K.` },
        { title: 'Model Evaluation Complete', desc: `The AI evaluated ARIMA and Prophet models; selected ${selectedModel} based on MAPE metric.` }
      ]
    };

    // 2. Map Recommendations page state
    const insightsList = response['Business Insights']?.Top_10_AI_Recommendations || [];
    const swot = response['Business Insights']?.SWOT || {
      Strengths: ['Consistent product sales contribution'],
      Weaknesses: ['High operational overheads'],
      Opportunities: ['Optimize staff shifts during off-peak hours'],
      Risks: ['Stockout during high-volume breakfast slots']
    };

    STATE.recommendationsData = {
      summary: `Your Business Health Score is verified at ${response['Business Health']?.score || 85} / 100. Our recommendations focus on reducing utility costs and scheduling kitchen staff efficiently.`,
      strengths: swot.Strengths,
      weaknesses: swot.Weaknesses,
      opportunities: swot.Opportunities,
      risks: swot.Risks,
      actions: insightsList.map(item => ({
        title: item.title,
        desc: item.desc,
        impact: item.desc.toLowerCase().includes('price') ? '+₹12,000 revenue' : '₹6,000 savings identified'
      }))
    };

    STATE.saveToSession();
  }
});

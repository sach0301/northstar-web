import { STATE } from './state.js';
import { API } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  const emptyState = document.getElementById('empty-state');
  const loadingState = document.getElementById('loading-state');
  const forecastContent = document.getElementById('forecast-content');
  const loadingBarFill = document.getElementById('loading-bar-fill');

  // Check upload state
  if (!STATE.isUploaded) {
    emptyState.style.display = 'block';
    return;
  }

  // Check if forecast data already exists in session
  if (STATE.forecastData) {
    showForecast(STATE.forecastData);
  } else {
    // Run Simulated ML Forecasting
    loadingState.style.display = 'block';
    
    // Animate progress bar loader
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 5;
      if (progress <= 95) {
        loadingBarFill.style.width = `${progress}%`;
      }
    }, 120);

    try {
      const data = await API.fetchForecast();
      
      // Complete loading animation
      clearInterval(progressInterval);
      loadingBarFill.style.width = '100%';
      
      setTimeout(() => {
        loadingState.style.display = 'none';
        showForecast(data);
      }, 300);

    } catch (err) {
      clearInterval(progressInterval);
      loadingState.style.display = 'none';
      console.error('Forecasting calculation failed:', err);
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

  function showForecast(data) {
    forecastContent.style.display = 'block';

    // Populate KPIs
    document.getElementById('forecast-sales').textContent = data.projected_sales;
    document.getElementById('forecast-sales-trend').textContent = data.sales_trend;
    
    document.getElementById('forecast-expenses').textContent = data.projected_expenses;
    document.getElementById('forecast-expense-trend').textContent = data.expense_trend;
    
    const cashflowEl = document.getElementById('forecast-cashflow');
    cashflowEl.textContent = data.cashflow_status;
    if (data.cashflow_status.toLowerCase().includes('critical')) {
      cashflowEl.style.color = 'var(--error-color)';
    } else {
      cashflowEl.style.color = 'var(--success-color)';
    }

    document.getElementById('forecast-model').textContent = data.best_model;

    // Populate Evaluation Metrics
    document.getElementById('metric-mae').textContent = data.metrics.MAE;
    document.getElementById('metric-rmse').textContent = data.metrics.RMSE;
    document.getElementById('metric-mape').textContent = data.metrics.MAPE;
    document.getElementById('metric-wape').textContent = data.metrics.WAPE;

    // Populate Insights List
    const insightsContainer = document.getElementById('forecast-insights-container');
    insightsContainer.innerHTML = '';
    data.insights.forEach(ins => {
      const item = document.createElement('div');
      item.className = 'insight-item';
      item.innerHTML = `
        <div class="insight-icon" style="color: var(--accent-light);">
          <i data-lucide="trending-up" style="width: 22px; height: 22px;"></i>
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

    // Render Forecast Chart with Confidence Band
    renderForecastChart(data.forecast_chart_data);
  }

  function renderForecastChart(chartData) {
    const ctx = document.getElementById('forecastChart').getContext('2d');
    
    const labels = chartData.map(d => d.date);
    const revenues = chartData.map(d => d.revenue);
    const confidenceLow = chartData.map(d => d.confidence_low);
    const confidenceHigh = chartData.map(d => d.confidence_high);

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Lower Bound (95% CI)',
            data: confidenceLow,
            borderColor: 'rgba(99, 102, 241, 0.25)',
            borderWidth: 1.5,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0
          },
          {
            label: 'Upper Bound (95% CI)',
            data: confidenceHigh,
            borderColor: 'rgba(99, 102, 241, 0.25)',
            borderWidth: 1.5,
            borderDash: [5, 5],
            fill: '-1', // Fills the space between this and the previous dataset (Lower Bound)
            backgroundColor: 'rgba(99, 102, 241, 0.04)',
            pointRadius: 0
          },
          {
            label: 'Projected Sales (₹)',
            data: revenues,
            borderColor: '#6366f1',
            borderWidth: 3.5,
            fill: false,
            tension: 0.35,
            pointRadius: 5,
            pointBackgroundColor: '#818cf8'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#f3f4f6',
              font: { family: 'Plus Jakarta Sans' },
              filter: (item) => item.text !== 'Lower Bound (95% CI)' // Hide bound items from legend to keep clean
            }
          }
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
});

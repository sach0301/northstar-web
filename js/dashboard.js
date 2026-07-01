import { STATE } from './state.js';
import { API } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  const emptyState = document.getElementById('empty-state');
  const dashboardContent = document.getElementById('dashboard-content');
  const btnLoadDemo = document.getElementById('btn-load-demo');

  // Check state to bootstrap content
  if (STATE.isUploaded) {
    showDashboard();
  } else {
    emptyState.style.display = 'block';
  }

  // Handle load demo click
  btnLoadDemo.addEventListener('click', async () => {
    STATE.isUploaded = true;
    STATE.fileName = 'Northstar_Template_v2.xlsx';
    STATE.saveToSession();
    showDashboard();
  });

  async function showDashboard() {
    emptyState.style.display = 'none';
    dashboardContent.style.display = 'block';
    
    // Set filename in title
    document.getElementById('sync-file-name').textContent = STATE.fileName;

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
      formatted = `₹${(absVal / 100000).toStringAsFixed(1)}L`;
    } else if (absVal >= 1000) {
      formatted = `₹${(absVal / 1000).toStringAsFixed(1)}K`;
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
    const profitCard = document.getElementById('card-profit');
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
      const contribution = ((prod.revenue / data.raw_revenue) * 100.0).toFixed(1);
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

    // Refresh Lucide Icons for dynamic content
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
    
    // Destructure labels and dataset values
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
          backgroundColor: ['#6366f1', '#10b981', '#f59e0b'],
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
            labels: { color: '#f3f4f6', font: { family: 'Plus Jakarta Sans' } }
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
        labels: ['Inventory Health (%)', 'Low-Stock Alerts (#)'],
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
});

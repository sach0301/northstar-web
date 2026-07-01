import { STATE } from './state.js';
import { API } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  const emptyState = document.getElementById('empty-state');
  const loadingState = document.getElementById('loading-state');
  const recContent = document.getElementById('rec-content');

  // Check upload state
  if (!STATE.isUploaded) {
    emptyState.style.display = 'block';
    return;
  }

  // Load recommendations data
  if (STATE.recommendationsData) {
    showRecommendations(STATE.recommendationsData);
  } else {
    loadingState.style.display = 'block';
    try {
      const data = await API.fetchRecommendations();
      loadingState.style.display = 'none';
      showRecommendations(data);
    } catch (err) {
      loadingState.style.display = 'none';
      console.error('Failed to generate AI recommendations:', err);
    }
  }

  function showRecommendations(data) {
    recContent.style.display = 'block';

    // Populate Summary
    document.getElementById('rec-summary').textContent = data.summary;

    // Helper to populate SWOT Lists
    populateList('swot-strengths-list', data.strengths);
    populateList('swot-weaknesses-list', data.weaknesses);
    populateList('swot-opportunities-list', data.opportunities);
    populateList('swot-risks-list', data.risks);

    // Populate Priority Action Cards
    const actionsContainer = document.getElementById('actions-container');
    actionsContainer.innerHTML = '';
    
    data.actions.forEach((act, idx) => {
      const card = document.createElement('div');
      card.className = 'glass-card feature-card';
      
      let badgeColor = 'var(--accent-light)';
      let badgeBg = 'rgba(99, 102, 241, 0.08)';
      if (act.impact.includes('savings')) {
        badgeColor = 'var(--success-color)';
        badgeBg = 'rgba(16, 185, 129, 0.08)';
      }

      card.innerHTML = `
        <div class="feature-icon" style="color: var(--accent-light);">
          <span>${idx + 1}</span>
        </div>
        <h3 style="font-size:1.15rem; margin-bottom:8px;">${act.title}</h3>
        <p style="margin-bottom:15px; font-size:0.88rem;">${act.desc}</p>
        <span class="hero-badge" style="background:${badgeBg}; border:1px solid ${badgeColor}; color:${badgeColor}; margin-bottom:0; font-size:0.75rem;">
          ${act.impact}
        </span>
      `;
      actionsContainer.appendChild(card);
    });

    // Initialize Accordion Click Handlers
    initAccordions();
  }

  function populateList(id, items) {
    const listEl = document.getElementById(id);
    listEl.innerHTML = '';
    items.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      listEl.appendChild(li);
    });
  }

  function initAccordions() {
    const headers = document.querySelectorAll('.accordion-header');
    
    headers.forEach(header => {
      header.addEventListener('click', () => {
        const item = header.parentElement;
        const content = item.querySelector('.accordion-content');
        
        const isActive = item.classList.contains('active');
        
        // Collapse all items first
        document.querySelectorAll('.accordion-item').forEach(i => {
          i.classList.remove('active');
          i.querySelector('.accordion-content').style.maxHeight = null;
        });

        if (!isActive) {
          item.classList.add('active');
          // Expand current accordion item dynamically using scrollHeight
          content.style.maxHeight = `${content.scrollHeight}px`;
        }
      });
    });
  }
});

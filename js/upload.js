import { API } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const progressContainer = document.getElementById('progress-container');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const uploadStatusText = document.getElementById('upload-status-text');
  const uploadPercentage = document.getElementById('upload-percentage');
  const toastWrapper = document.getElementById('toast-wrapper');

  // Drag over / Drag enter classes
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    }, false);
  });

  // Drag leave / drop classes
  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    }, false);
  });

  // Handle drop
  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  // Handle file select click input
  fileInput.addEventListener('change', (e) => {
    if (fileInput.files.length > 0) {
      handleFileUpload(fileInput.files[0]);
    }
  });

  async function handleFileUpload(file) {
    // Validate file type
    const validExtensions = ['.xlsx', '.csv'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      showToast('Invalid file format. Please upload an Excel (.xlsx) or CSV file.', 'error');
      return;
    }

    // Hide previous notifications, show loading
    toastWrapper.innerHTML = '';
    progressContainer.style.display = 'block';
    progressBarFill.style.width = '0%';
    uploadPercentage.textContent = '0%';
    uploadStatusText.textContent = 'Uploading files...';

    try {
      // 1. Trigger Upload API
      await API.uploadFile(file, (percent) => {
        progressBarFill.style.width = `${percent}%`;
        uploadPercentage.textContent = `${percent}%`;
      });

      // 2. Trigger Dashboard API immediately in the background
      uploadStatusText.textContent = 'Syncing dashboard metrics...';
      await API.fetchDashboard();

      // Show success toast
      showToast(`Successfully synced and updated dashboard from ${file.name}!`, 'success');
      
      // Auto redirect to dashboard after a brief delay
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1500);

    } catch (err) {
      progressContainer.style.display = 'none';
      showToast(`Upload failed: ${err.message}`, 'error');
    }
  }

  function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast-msg toast-${type}`;
    
    const iconName = type === 'success' ? 'check-circle' : 'alert-circle';
    toast.innerHTML = `
      <i class="lucide-${iconName}" style="width: 20px; height: 20px; flex-shrink:0;"></i>
      <span>${message}</span>
    `;
    
    toastWrapper.appendChild(toast);
    
    // Auto-create lucide icon instance inside toast
    if (window.lucide) {
      window.lucide.createIcons({
        attrs: {
          class: 'lucide'
        }
      });
    }
  }
});

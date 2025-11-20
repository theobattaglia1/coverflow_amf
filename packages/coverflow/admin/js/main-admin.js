/**
 * AMF ADMIN — Main Initialization Module
 * Coordinates all admin modules and handles remaining functionality
 */

// Global functions that need to be exposed for inline handlers
window.toggleFullCoversView = function() {
  console.log('🔄 toggleFullCoversView called');
  const mainContainer = document.getElementById('coversMainContainer');
  const recentSection = document.getElementById('recentlyEditedSection');
  const coversControls = document.getElementById('coversControls');
  
  if (mainContainer) {
    const isHidden = mainContainer.style.display === 'none' || !mainContainer.style.display;
    mainContainer.style.display = isHidden ? 'block' : 'none';
    
    // Also show/hide controls
    if (coversControls) {
      coversControls.style.display = isHidden ? 'block' : 'none';
    }
    
    // Toggle button text
    const btn = event?.target;
    if (btn) {
      btn.textContent = isHidden ? 'SHOW LESS ←' : 'VIEW ALL →';
    }
    
    console.log('📊 Toggled covers view:', isHidden ? 'SHOWING ALL' : 'SHOWING RECENT');
  }
};

// Setup drag and drop for folders
window.setupFolderDropZone = function(element, targetPath) {
  if (!element) return;
  
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    element.addEventListener(eventName, preventDefaults, false);
  });
  
  ['dragenter', 'dragover'].forEach(eventName => {
    element.addEventListener(eventName, () => {
      if (window.isDraggingAssets && window.draggedAssets.size > 0) {
        element.classList.add('folder-dragover');
      }
    }, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    element.addEventListener(eventName, () => {
      element.classList.remove('folder-dragover');
    }, false);
  });
  
  element.addEventListener('drop', async (e) => {
    if (!window.isDraggingAssets || window.draggedAssets.size === 0) return;
    
    const assetUrls = Array.from(window.draggedAssets);
    console.log(`Moving ${assetUrls.length} assets to ${targetPath || 'root'}`);
    
    try {
      const result = await apiCall('/api/assets/bulk-move', {
        method: 'POST',
        body: JSON.stringify({
          assetUrls,
          targetFolder: targetPath
        })
      });
      
      if (result.success) {
        showToast(`Moved ${assetUrls.length} assets to ${targetPath || 'root'}`);
        window.draggedAssets.clear();
        window.isDraggingAssets = false;
        loadAssets();
      }
    } catch (err) {
      console.error('Failed to move assets:', err);
      showToast('Failed to move assets', 5000);
    }
  });
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
};

// Setup drag and drop for assets and folders
window.setupDragAndDrop = function() {
  // Asset drag and drop
  const assetDropzone = document.getElementById('assetDropzone');
  if (assetDropzone) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      assetDropzone.addEventListener(eventName, preventDefaults, false);
      document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
      assetDropzone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      assetDropzone.addEventListener(eventName, unhighlight, false);
    });
    
    assetDropzone.addEventListener('drop', handleDropFiles, false);
    
    // Click to upload
    assetDropzone.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'image/*';
      input.onchange = (e) => {
        const files = Array.from(e.target.files);
        handleFiles(files);
      };
      input.click();
    });
  }
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  function highlight(e) {
    assetDropzone.classList.add('dragover');
  }
  
  function unhighlight(e) {
    assetDropzone.classList.remove('dragover');
  }
  
  function handleDropFiles(e) {
    const files = [...e.dataTransfer.files];
    handleFiles(files);
  }
  
  async function handleFiles(files) {
    for (const file of files) {
      await uploadFile(file);
    }
  }
  
  async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', window.currentFolder || '');
    
    try {
      const res = await fetch('/upload-image', {
        method: 'POST',
        body: formData
      });
      
      if (res.ok) {
        showToast('FILE UPLOADED');
        loadAssets();
      } else {
        showToast('UPLOAD FAILED', 5000);
      }
    } catch (err) {
      console.error('Upload error:', err);
      showToast('UPLOAD FAILED', 5000);
    }
  }
};

// Advanced filters setup
window.setupAdvancedFilters = function() {
  const filterToggle = document.querySelector('[onclick="toggleAdvancedFilters()"]');
  if (filterToggle) {
    window.toggleAdvancedFilters = function() {
      const filters = document.getElementById('advancedFilters');
      if (filters) {
        filters.classList.toggle('show');
      }
    };
  }
};

// Media library event listeners
window.setupMediaLibraryEventListeners = function() {
  // Toggle media library expansion
  const expandBtn = document.querySelector('[onclick="toggleMediaLibraryExpansion()"]');
  if (expandBtn) {
    window.toggleMediaLibraryExpansion = function() {
      window.mediaLibraryExpanded = !window.mediaLibraryExpanded;
      const container = document.getElementById('assetGrid');
      if (container) {
        container.classList.toggle('expanded', window.mediaLibraryExpanded);
      }
    };
  }
  
  // Asset multi-select mode
  const multiSelectBtn = document.getElementById('assetMultiSelectToggle');
  if (multiSelectBtn) {
    multiSelectBtn.addEventListener('click', () => {
      window.assetMultiSelectMode = !window.assetMultiSelectMode;
      window.selectedAssets.clear();
      multiSelectBtn.classList.toggle('active', window.assetMultiSelectMode);
      multiSelectBtn.textContent = window.assetMultiSelectMode ? 'EXIT SELECTION' : 'MULTI-SELECT';
      renderAssetsWithView();
    });
  }
  
  // Asset view mode
  const viewModeSelect = document.getElementById('assetViewMode');
  if (viewModeSelect) {
    viewModeSelect.addEventListener('change', (e) => {
      renderAssetsWithView();
    });
  }
  
  // Asset sort
  const sortSelect = document.getElementById('assetSort');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      window.sortBy = e.target.value;
      renderAssetsWithView();
    });
  }
};

// Keyboard shortcuts
window.setupKeyboardShortcuts = function() {
  document.addEventListener('keydown', (e) => {
    // Select all (Cmd/Ctrl + A)
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      if (window.assetMultiSelectMode) {
        e.preventDefault();
        const { images } = getCurrentFolderItems();
        images.forEach(img => window.selectedAssets.add(img.url));
        renderAssetsWithView();
        updateAssetSelectionCounter();
      }
    }
    
    // Escape to cancel operations
    if (e.key === 'Escape') {
      if (window.assetMultiSelectMode) {
        window.assetMultiSelectMode = false;
        window.selectedAssets.clear();
        const btn = document.getElementById('assetMultiSelectToggle');
        if (btn) {
          btn.classList.remove('active');
          btn.textContent = 'MULTI-SELECT';
        }
        renderAssetsWithView();
      }
    }
    
    // Delete selected assets
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.matches('input, textarea')) {
      if (window.selectedAssets.size > 0) {
        e.preventDefault();
        deleteSelectedAssets();
      }
    }
  });
};

// Lazy loading for covers and assets
window.setupLazyLoading = function() {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          imageObserver.unobserve(img);
        }
      });
    });
    
    // Observe all lazy images
    document.querySelectorAll('img.lazy').forEach(img => {
      imageObserver.observe(img);
    });
  }
};

// Infinite scroll for covers
window.setupInfiniteScroll = function() {
  const container = document.getElementById('coversContainer');
  if (!container) return;
  
  let isLoading = false;
  
  window.addEventListener('scroll', () => {
    if (isLoading) return;
    
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      loadMoreCovers();
    }
  });
  
  function loadMoreCovers() {
    if (window.currentCoverPage * window.coversPerPage >= window.filteredCovers.length) {
      return; // No more covers to load
    }
    
    isLoading = true;
    window.currentCoverPage++;
    
    // Simulate loading more covers
    setTimeout(() => {
      renderCovers();
      isLoading = false;
    }, 300);
  }
};

// Show onboarding tips
window.showOnboardingTips = function() {
  if (localStorage.getItem('amf-admin-onboarded')) return;
  
  const tips = [
    { element: '#saveAllBtn', message: 'Save all changes here' },
    { element: '#pushLiveBtn', message: 'Push changes to live site' },
    { element: '#batchModeBtn', message: 'Select multiple covers' },
    { element: '#assetDropzone', message: 'Drop images here to upload' }
  ];
  
  // Show tips one by one
  let currentTip = 0;
  
  function showNextTip() {
    if (currentTip >= tips.length) {
      localStorage.setItem('amf-admin-onboarded', 'true');
      return;
    }
    
    const tip = tips[currentTip];
    const element = document.querySelector(tip.element);
    if (element) {
      // Create and show tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'onboarding-tooltip';
      tooltip.textContent = tip.message;
      tooltip.style.cssText = `
        position: absolute;
        background: var(--accent);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 0.875rem;
        z-index: 1000;
        pointer-events: none;
      `;
      
      const rect = element.getBoundingClientRect();
      tooltip.style.left = rect.left + 'px';
      tooltip.style.top = rect.bottom + 8 + 'px';
      
      document.body.appendChild(tooltip);
      
      setTimeout(() => {
        tooltip.remove();
        currentTip++;
        showNextTip();
      }, 3000);
    } else {
      currentTip++;
      showNextTip();
    }
  }
  
  // Start after a delay
  setTimeout(showNextTip, 1000);
};

// Create help button
window.createHelpButton = function() {
  const helpBtn = document.createElement('button');
  helpBtn.className = 'help-button';
  helpBtn.innerHTML = '?';
  helpBtn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--accent);
    color: white;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    z-index: 1000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;
  
  helpBtn.onclick = () => {
    showToast('HELP: Cmd+S to save, Cmd+A to select all, ESC to cancel', 10000);
  };
  
  document.body.appendChild(helpBtn);
};

// Confirm dialog helper
window.showConfirmDialog = function(message) {
  return new Promise(resolve => {
    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      z-index: 10000;
      max-width: 400px;
    `;
    
    dialog.innerHTML = `
      <p style="margin-bottom: 24px;">${message}</p>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button class="btn" onclick="this.closest('.confirm-dialog').remove(); window.confirmResolve(false);">CANCEL</button>
        <button class="btn btn-danger" onclick="this.closest('.confirm-dialog').remove(); window.confirmResolve(true);">CONFIRM</button>
      </div>
    `;
    
    window.confirmResolve = resolve;
    document.body.appendChild(dialog);
  });
};

// Progress indicator helper
window.showProgressIndicator = function(message = 'Loading...', progress = 0) {
  let indicator = document.getElementById('progressIndicator');
  
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'progressIndicator';
    indicator.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--bg);
      border: 1px solid var(--ink);
      padding: var(--space-lg);
      border-radius: 8px;
      z-index: 9999;
      text-align: center;
      min-width: 200px;
    `;
    
    indicator.innerHTML = `
      <div class="progress-message" style="margin-bottom: var(--space-md);"></div>
      <div class="progress-bar" style="background: #eee; height: 4px; border-radius: 2px; overflow: hidden;">
        <div class="progress-fill" style="background: var(--accent); height: 100%; width: 0%; transition: width 0.3s;"></div>
      </div>
    `;
    
    document.body.appendChild(indicator);
  }
  
  const messageEl = indicator.querySelector('.progress-message');
  const fillEl = indicator.querySelector('.progress-fill');
  
  if (messageEl) messageEl.textContent = message;
  if (fillEl) fillEl.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  
  indicator.style.display = 'block';
};

window.hideProgressIndicator = function() {
  const indicator = document.getElementById('progressIndicator');
  if (indicator) {
    indicator.style.display = 'none';
  }
};

// Initialize everything
window.initializeMainAdmin = function() {
  console.log('🎨 Main Admin Module Initialized');
  
  // Setup various UI components
  setupDragAndDrop();
  setupKeyboardShortcuts();
  setupMediaLibraryEventListeners();
  setupAdvancedFilters();
  setupLazyLoading();
  setupInfiniteScroll();
  
  // Show onboarding and help
  showOnboardingTips();
  createHelpButton();
};

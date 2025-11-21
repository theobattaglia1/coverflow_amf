/**
 * AMF ADMIN — Shared utilities and constants
 * Common functionality used across all admin modules
 */

// Global state management
window.adminState = window.adminState || {
  currentUser: null,
  sessionKeepalive: null,
  hasChanges: false
};

// Toast notification
window.showToast = function(message, duration = 5000) {
  const toast = document.getElementById('toast');
  if (!toast) {
    console.warn('Toast element not found');
    return;
  }
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
};

// Toast with inline UNDO action (used for client-side undo only)
window.showUndoToast = function(message, onUndo, duration = 5000) {
  const toast = document.getElementById('toast');
  if (!toast) {
    console.warn('Toast element not found');
    return;
  }
  toast.innerHTML = `
    <span class="toast-message">${message}</span>
    <button class="toast-undo-btn" type="button">UNDO</button>
  `;
  toast.classList.add('show', 'has-action');
  
  const undoBtn = toast.querySelector('.toast-undo-btn');
  let undone = false;
  
  const cleanup = () => {
    toast.classList.remove('show', 'has-action');
    // Restore to simple text-only to avoid stale markup
    toast.textContent = '';
  };
  
  const timer = setTimeout(() => {
    if (!undone) cleanup();
  }, duration);
  
  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      if (undone) return;
      undone = true;
      clearTimeout(timer);
      cleanup();
      if (typeof onUndo === 'function') {
        try {
          onUndo();
        } catch (err) {
          console.error('UNDO handler failed:', err);
        }
      }
    }, { once: true });
  }
};

// Loading states
window.showLoading = function(type = 'default') {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.style.display = 'block';
  }
};

window.hideLoading = function() {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.style.display = 'none';
  }
};

// Modal management
window.openModal = function() {
  document.getElementById('coverModal')?.classList.add('active');
};

window.closeModal = function() {
  document.getElementById('coverModal')?.classList.remove('active');
  const modalBodyElement = document.getElementById('modalBody');
  if (modalBodyElement) {
    modalBodyElement.innerHTML = '';
  }
};

// Save button state management
window.updateSaveButton = function() {
  const saveBtn = document.getElementById('saveAllBtn');
  const pushBtn = document.getElementById('pushLiveBtn');
  if (saveBtn) {
    saveBtn.classList.toggle('has-changes', window.adminState.hasChanges);
    saveBtn.textContent = window.adminState.hasChanges ? 'SAVE CHANGES' : 'ALL SAVED';
  }
  if (pushBtn) {
    pushBtn.style.display = window.adminState.hasChanges ? 'none' : 'block';
  }
};

// Utility function to safely parse JSON responses
window.safeJsonParse = async function(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    if (text.includes('<!DOCTYPE')) {
      return { error: 'Received HTML response instead of JSON - likely authentication issue' };
    }
    return { error: 'Invalid JSON response', details: text.substring(0, 100) };
  }
};

// Enhanced authentication check
window.checkAuth = async function() {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) {
      if (res.status === 401) {
        console.log('Authentication required, redirecting to login');
        window.location.href = '/login.html';
        return false;
      }
      throw new Error(`Auth check failed: ${res.status}`);
    }
    
    const data = await res.json();
    window.adminState.currentUser = data.user;
    
    // Update UI with user info
    const usernameEl = document.getElementById('username');
    const roleEl = document.getElementById('userRole');
    if (usernameEl) usernameEl.textContent = data.user.username;
    if (roleEl) roleEl.textContent = data.user.role.toUpperCase();
    
    // Start session keepalive
    if (window.adminState.sessionKeepalive) {
      clearInterval(window.adminState.sessionKeepalive);
    }
    window.adminState.sessionKeepalive = setInterval(() => {
      fetch('/api/me').catch(err => console.warn('Session keepalive failed:', err));
    }, 5 * 60 * 1000); // Every 5 minutes
    
    return true;
  } catch (err) {
    console.error('Auth check error:', err);
    window.location.href = '/login.html';
    return false;
  }
};

// Keyboard shortcuts
window.initializeKeyboardShortcuts = function() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
    
    // Cmd/Ctrl + S to save (covers)
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (window.saveChanges) {
        window.saveChanges();
      }
    }
    
    // Global section navigation
    if (e.altKey || e.metaKey || e.ctrlKey) return; // avoid clashing with browser/system
    
    if (e.key === '1') {
      // COVERS
      const coversLink = document.querySelector('.admin-nav a[href="#covers"]');
      const coversSection = document.getElementById('coversSection');
      if (coversSection) {
        coversSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (coversLink) {
        document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
        coversLink.classList.add('active');
      }
    } else if (e.key === '2') {
      // ASSETS
      const assetsLink = document.querySelector('.admin-nav a[href="#assets"]');
      const assetsSection = document.getElementById('assetsSection');
      if (assetsSection) {
        assetsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (assetsLink) {
        document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
        assetsLink.classList.add('active');
      }
    } else if (e.key === '3') {
      // AUDIO
      const audioLink = document.querySelector('.admin-nav a[href="#audio"]');
      const audioSection = document.getElementById('audioSection');
      if (audioSection) {
        audioSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (audioLink) {
        document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
        audioLink.classList.add('active');
      }
    } else if (e.key === '4') {
      // USERS
      const usersLink = document.querySelector('.admin-nav a[href="#users"]');
      const usersSection = document.getElementById('usersSection');
      if (usersSection) {
        usersSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (usersLink) {
        document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
        usersLink.classList.add('active');
      }
    }
    
    // "/" focuses global search when not typing into an input
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      const globalSearch = document.getElementById('globalSearch');
      if (globalSearch) {
        globalSearch.focus();
        globalSearch.select();
      }
    }
  });
};

// Data loading helpers
window.loadJsonData = async function(path, fallback = []) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Error loading ${path}:`, err);
    return fallback;
  }
};

// Common API wrapper with auth handling
window.apiCall = async function(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (response.status === 401) {
      console.log('Session expired, redirecting to login');
      window.location.href = '/login.html';
      return null;
    }
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || error.message || `API call failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (err) {
    console.error(`API call to ${url} failed:`, err);
    showToast(`Error: ${err.message}`, 5000);
    throw err;
  }
};

// Navigation helpers
window.showSection = function(sectionId) {
  document.querySelectorAll('.section').forEach(section => {
    section.style.display = section.id === sectionId ? 'block' : 'none';
  });
  
  // Update nav active state
  document.querySelectorAll('.admin-nav a').forEach(a => {
    const href = a.getAttribute('href');
    a.classList.toggle('active', href === `#${sectionId.replace('Section', '')}`);
  });
};

// Initialize shared functionality
window.initializeShared = function() {
  console.log('🎛️ AMF Admin Shared Module Initialized');
  initializeKeyboardShortcuts();
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.initializeShared);
} else {
  window.initializeShared();
}

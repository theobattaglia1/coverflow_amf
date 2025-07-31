/*
Recommended Automated Test Cases for Folder Management:

1. Folder Creation:
   - Create a folder at root and in a subfolder. Verify it appears in the UI and in assets.json (under children).
   - Attempt to create a duplicate folder. Verify error is shown and no duplicate is created.

2. Folder Deletion:
   - Delete a folder at root and in a subfolder. Verify it is removed from the UI and assets.json.
   - Attempt to delete a non-existent folder. Verify error is shown.

3. Folder Renaming:
   - Rename a folder at root and in a subfolder. Verify the new name appears in the UI and assets.json.
   - Attempt to rename to a duplicate name. Verify error is shown.

4. UI Consistency:
   - After each operation, reload the page and verify the folder structure matches assets.json.
   - Test with legacy assets.json containing only folders, only children, or both.

5. Data Integrity:
   - Run the migration script and verify all folders are under children, with no folders arrays remaining.
*/
/**
 * AMF ADMIN DASHBOARD — SWISS MODERNISM EDITION
 * Professional, fluid interactions with editorial restraint
 */

// State management
let covers = [];
let assets = {};
let folders = [];
let currentFolder = '';
let hasChanges = false;
let batchMode = false;
let selectedCovers = new Set();
let currentUser = null;
let sessionKeepalive = null;

// Media Library state
let mediaLibraryExpanded = false;
let currentView = 'grid';
let assetsPerPage = 24;
let currentPage = 0;
let filteredAssets = [];
let sortBy = 'name';

// Multi-select asset state management
let selectedAssets = new Set();
let assetMultiSelectMode = false;
let lastSelectedAssetIndex = -1;
let draggedAssets = new Set();
let isDraggingAssets = false;

// Audio state management
let audioFiles = [];
let selectedAudioFiles = new Set();
let currentAudioFolder = '';
let audioFolders = [];

// Enhanced state for new features from dashboard.js
let currentViewMode = 'grid';
let showFullView = false;
let currentCoverPage = 1;
let coversPerPage = 20;
let searchTerm = '';
let categoryFilter = '';
let sortOrder = 'date'; // Default to newest first
let recentCovers = [];

// Utility function to safely parse JSON responses
async function safeJsonParse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    // If it's HTML (like a login page), extract error message
    if (text.includes('<!DOCTYPE')) {
      return { error: 'Received HTML response instead of JSON - likely authentication issue' };
    }
    return { error: 'Invalid JSON response', details: text.substring(0, 100) };
  }
}

// Enhanced authentication check with proper error handling
async function checkAuth() {
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
    currentUser = data.user;
    
    // Update UI based on user role
    if (typeof updateUIForUserRole === 'function') {
      updateUIForUserRole(currentUser.role);
    }
    return true;
  } catch (err) {
    console.error('Auth check failed:', err);
    // Only redirect to login if it's actually an auth issue
    // Don't redirect on network errors
    if (err.message.includes('401') || err.message.includes('Auth check failed')) {
      window.location.href = '/login.html';
    }
    return false;
  }
}

// Session keepalive functionality
function startSessionKeepalive() {
  sessionKeepalive = setInterval(async () => {
    try {
      const res = await fetch('/api/me');
      if (!res.ok && res.status === 401) {
        clearInterval(sessionKeepalive);
        showToast('SESSION EXPIRED - PLEASE LOGIN AGAIN');
        setTimeout(() => window.location.href = '/login.html', 2000);
      }
    } catch (err) {
      // Ignore network errors, but log them
      console.warn('Session keepalive failed:', err);
    }
  }, 5 * 60 * 1000); // Check every 5 minutes
}

function stopSessionKeepalive() {
  if (sessionKeepalive) {
    clearInterval(sessionKeepalive);
    sessionKeepalive = null;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  console.log('🚀 Admin Dashboard initializing...');
  try {
    // Try to load user info, but don't redirect if it fails
    const res = await fetch('/api/me');
    if (res.ok) {
      const data = await res.json();
      if (data.user) {
        currentUser = data.user;
        document.getElementById('username').textContent = data.user.username.toUpperCase();
        document.getElementById('userRole').textContent = data.user.role.toUpperCase();
        
        if (data.user.role === 'admin') {
          document.getElementById('usersSection').style.display = 'block';
          loadUsers();
        }
        
        // Start session keepalive only if authenticated
        startSessionKeepalive();
      }
    } else {
      // If not authenticated, redirect to login
      window.location.href = '/login.html';
      return;
    }
  } catch (err) {
    console.error('Failed to load user info:', err);
    // Only redirect if it's clearly an auth issue
    window.location.href = '/login.html';
    return;
  }
  
  await loadCovers();
  await loadAssets();
  await loadAudioFiles(); // Load audio files
  setupEventListeners();
  setupDragAndDrop();
  setupKeyboardShortcuts();
  setupMediaLibraryEventListeners();
  setupSearchAndFilters();
  setupViewModeToggles();
  setupGlobalSearch(); // Initialize global search
  setupEnhancedAssetSearch(); // Initialize enhanced asset search
  setupEnhancedAudioSearch(); // Initialize enhanced audio search
  setupAdvancedFilters(); // Initialize advanced filters
  setupInfiniteScroll();
  setupLazyLoading();
  updateCurrentFolderIndicator();
  renderRecentAssets();
  renderRecentCovers();
  
  // Show onboarding tips and create help button
  showOnboardingTips();
  createHelpButton();
}

// Load covers with smooth animation
async function loadCovers() {
  showLoading('covers');
  
  try {
    const res = await fetch('/data/covers.json');
    covers = await res.json();
    renderCovers();
  } catch (err) {
    showToast('FAILED TO LOAD COVERS', 5000);
    console.error(err);
  } finally {
    hideLoading();
  }
}

// Render covers with editorial layout
function renderCovers(searchTerm = '') {
  // Update search term if provided
  if (searchTerm !== undefined) {
    this.searchTerm = searchTerm.toLowerCase();
  }
  
  // Use the new enhanced rendering system
  renderCurrentView();
}

// Create cover element with professional styling
function createCoverElement(cover, index) {
  const div = document.createElement('div');
  div.className = 'cover-item';
  div.dataset.id = cover.id;
  div.style.opacity = '0';
  div.style.transform = `translateY(20px)`;
  div.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
  
  // Add subtle rotation for visual interest
  const rotation = (index % 3 === 0) ? -0.5 : (index % 3 === 1) ? 0.5 : 0;
  div.style.transform += ` rotate(${rotation}deg)`;
  
  div.innerHTML = `
    <img src="${cover.frontImage || '/placeholder.jpg'}" 
         alt="${cover.albumTitle || 'Untitled'}" 
         class="cover-image"
         loading="lazy">
    <div class="cover-index">${index + 1}</div>
    <div class="cover-meta">
      <div style="font-weight: 700;">${cover.albumTitle || 'UNTITLED'}</div>
      <div style="opacity: 0.8;">${cover.coverLabel || '—'}</div>
    </div>
  `;
  
  // Click handler
  div.addEventListener('click', (e) => {
    if (batchMode) {
      toggleCoverSelection(cover.id);
    } else {
      editCover(cover);
    }
  });
  
  return div;
}

// Edit cover with modal
function editCover(cover) {
  const modal = document.getElementById('coverModal');
  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = `
    <form id="editCoverForm" style="display: grid; gap: var(--space-lg);">
      <div class="form-group">
        <label class="form-label">ALBUM TITLE</label>
        <input type="text" class="form-input" name="albumTitle" value="${cover.albumTitle || ''}" required>
      </div>
      <div class="form-group">
        <label class="form-label">ARTIST NAME</label>
        <input type="text" class="form-input" name="coverLabel" value="${cover.coverLabel || ''}" required>
      </div>
      <div class="form-group">
        <label class="form-label">CATEGORIES</label>
        <input type="text" class="form-input" name="category" value="${Array.isArray(cover.category) ? cover.category.join(', ') : (cover.category ? cover.category : '')}" 
               placeholder="ARTISTS, SONGWRITERS, PRODUCERS">
      </div>
      <div class="form-group">
        <label class="form-label">SPOTIFY EMBED URL</label>
        <input type="url" class="form-input" name="spotifyEmbed" value="${cover.spotifyEmbed || ''}"
               placeholder="https://open.spotify.com/track/...">
      </div>
      <div class="form-group">
        <label class="form-label">CONTACT EMAIL</label>
        <input type="email" class="form-input" name="contactEmail" value="${cover.contactEmail || ''}"
               placeholder="artist@example.com">
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);">
        <div class="form-group">
          <label class="form-label">FRONT IMAGE</label>
          <div style="position: relative;">
            <img id="frontImagePreview" src="${cover.frontImage || '/placeholder.jpg'}" 
                 style="width: 100%; aspect-ratio: 1; object-fit: cover; margin-bottom: var(--space-sm);">
            <input type="hidden" name="frontImage" value="${cover.frontImage || ''}">
            <button type="button" class="btn" onclick="openImageLibrary('frontImage')" style="width: 100%;">
              CHANGE IMAGE
            </button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">BACK IMAGE</label>
          <div style="position: relative;">
            <img id="backImagePreview" src="${cover.backImage || '/placeholder.jpg'}" 
                 style="width: 100%; aspect-ratio: 1; object-fit: cover; margin-bottom: var(--space-sm);">
            <input type="hidden" name="backImage" value="${cover.backImage || ''}">
            <button type="button" class="btn" onclick="openImageLibrary('backImage')" style="width: 100%;">
              CHANGE IMAGE
            </button>
          </div>
        </div>
      </div>
      <div style="display: flex; gap: var(--space-md); justify-content: flex-end;">
        <button type="button" class="btn" onclick="closeModal()">CANCEL</button>
        <button type="submit" class="btn btn-primary">SAVE CHANGES</button>
      </div>
    </form>
  `;
  // Form submit handler
  document.getElementById('editCoverForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    cover.albumTitle = formData.get('albumTitle');
    cover.coverLabel = formData.get('coverLabel');
    cover.category = formData.get('category').split(',').map(c => c.trim()).filter(Boolean);
    cover.spotifyEmbed = formData.get('spotifyEmbed');
    cover.contactEmail = formData.get('contactEmail');
    cover.frontImage = formData.get('frontImage');
    cover.backImage = formData.get('backImage');
    hasChanges = true;
    console.log('✏️ Cover updated, setting hasChanges to true:', cover.albumTitle);
    updateSaveButton();
    renderCovers();
    closeModal();
    showToast('COVER UPDATED');
  };
  
  // Add modal dropzone functionality
  const modalBodyElement = document.getElementById('modalBody');
  setupModalDropzone(modalBodyElement);
  
  openModal();
}

// Batch mode functionality
function toggleBatchMode() {
  batchMode = !batchMode;
  selectedCovers.clear();
  
  document.body.classList.toggle('batch-active', batchMode);
  
  // Update batch mode button
  const batchBtn = document.getElementById('batchModeBtn');
  if (batchBtn) {
    batchBtn.textContent = batchMode ? 'EXIT BATCH' : 'BATCH MODE';
    batchBtn.classList.toggle('btn-danger', batchMode);
  }
  
  // Create or update batch toolbar
  createBatchToolbar();
  
  // Show/hide batch operations
  const exportBtn = document.getElementById('exportBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  if (exportBtn) exportBtn.style.display = batchMode ? 'block' : 'none';
  if (deleteBtn) deleteBtn.style.display = batchMode ? 'block' : 'none';
  
  // Add batch mode badge to header
  createBatchBadge();
  
  if (!batchMode) {
    renderCovers();
    removeBatchToolbar();
    removeBatchBadge();
  } else {
    // Re-render to show checkboxes
    renderCurrentView();
  }
}

function createBatchToolbar() {
  if (!batchMode) return;
  
  // Remove existing toolbar if present
  removeBatchToolbar();
  
  const toolbar = document.createElement('div');
  toolbar.id = 'batchToolbar';
  toolbar.className = 'batch-toolbar';
  toolbar.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--ink);
    color: var(--bg);
    padding: var(--space-md) var(--space-lg);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: var(--space-md);
    animation: slideUp 0.3s ease-out;
  `;
  
  toolbar.innerHTML = `
    <span class="batch-count">0 selected</span>
    <button class="btn btn-sm" onclick="selectAllCovers()">SELECT ALL</button>
    <button class="btn btn-sm" onclick="clearSelection()">CLEAR</button>
    <button class="btn btn-sm btn-danger" onclick="deleteSelected()">DELETE SELECTED</button>
    <button class="btn btn-sm" onclick="exportCovers()">EXPORT SELECTED</button>
    <button class="btn btn-sm btn-secondary" onclick="toggleBatchMode()">EXIT BATCH</button>
  `;
  
  document.body.appendChild(toolbar);
}

function removeBatchToolbar() {
  const toolbar = document.getElementById('batchToolbar');
  if (toolbar) {
    toolbar.remove();
  }
}

function createBatchBadge() {
  if (!batchMode) return;
  
  // Remove existing badge if present
  removeBatchBadge();
  
  const badge = document.createElement('div');
  badge.id = 'batchBadge';
  badge.className = 'batch-badge';
  badge.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff4444;
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: bold;
    z-index: 999;
    animation: pulse 2s infinite;
  `;
  
  badge.textContent = 'BATCH MODE ACTIVE';
  
  document.body.appendChild(badge);
}

function removeBatchBadge() {
  const badge = document.getElementById('batchBadge');
  if (badge) {
    badge.remove();
  }
}

function toggleCoverSelection(coverId) {
  if (selectedCovers.has(coverId)) {
    selectedCovers.delete(coverId);
  } else {
    selectedCovers.add(coverId);
  }
  
  const coverEl = document.querySelector(`[data-id="${coverId}"]`);
  if (coverEl) {
    coverEl.classList.toggle('selected', selectedCovers.has(coverId));
    
    // Update checkbox if present
    const checkbox = coverEl.querySelector('.cover-checkbox');
    if (checkbox) {
      checkbox.checked = selectedCovers.has(coverId);
    }
  }
  
  // Update batch count and button states
  updateBatchCount();
  
  const hasSelection = selectedCovers.size > 0;
  const exportBtn = document.getElementById('exportBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  if (exportBtn) exportBtn.disabled = !hasSelection;
  if (deleteBtn) deleteBtn.disabled = !hasSelection;
}

// Save changes with visual feedback
async function saveChanges() {
  console.log('💾 saveChanges() called, hasChanges:', hasChanges, 'covers count:', covers.length);
  
  if (!hasChanges) {
    showToast('NO CHANGES TO SAVE');
    console.log('❌ No changes detected, aborting save');
    return;
  }
  
  // Check auth before attempting save
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) {
    return;
  }
  
  showLoading();
  
  try {
    const res = await fetch('/save-covers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(covers)
    });
    
    // Handle authentication errors specifically
    if (res.status === 401) {
      showToast('SESSION EXPIRED - REDIRECTING TO LOGIN');
      setTimeout(() => window.location.href = '/login.html', 1000);
      return;
    }
    
    if (!res.ok) {
      const errorData = await safeJsonParse(res);
      throw new Error(errorData.error || `Server error ${res.status}`);
    }
    
    const result = await res.json();
    hasChanges = false;
    updateSaveButton();
    showToast('CHANGES SAVED SUCCESSFULLY');
    
    // Reload covers to verify save
    await loadCovers();
    
  } catch (err) {
    console.error('Save failed:', err);
    showToast(`FAILED TO SAVE: ${err.message}`, 5000);
  } finally {
    hideLoading();
  }
}

// Update save button state
function updateSaveButton() {
  const saveBtn = document.querySelector('[onclick="saveChanges()"]');
  console.log('🔄 updateSaveButton called, hasChanges:', hasChanges, 'button found:', !!saveBtn);
  
  if (!saveBtn) {
    console.error('❌ Save button not found! Check if onclick="saveChanges()" exists in HTML');
    return;
  }
  
  if (hasChanges) {
    saveBtn.classList.add('btn-primary');
    saveBtn.textContent = 'SAVE CHANGES *';
    console.log('✅ Save button updated to show changes pending');
  } else {
    saveBtn.classList.remove('btn-primary');
    saveBtn.textContent = 'SAVE CHANGES';
    console.log('✅ Save button updated to show no changes');
  }
}

// Push live with confirmation
async function pushLive() {
  if (!confirm('PUSH ALL CHANGES TO LIVE SITE?')) return;
  
  // Check auth before attempting push
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) {
    return;
  }
  
  showLoading();
  
  try {
    const res = await fetch('/push-live', { method: 'POST' });
    
    // Handle authentication errors
    if (res.status === 401) {
      showToast('SESSION EXPIRED - REDIRECTING TO LOGIN');
      setTimeout(() => window.location.href = '/login.html', 1000);
      return;
    }
    
    if (!res.ok) {
      const errorData = await safeJsonParse(res);
      throw new Error(errorData.error || `Push failed: ${res.status}`);
    }
    
    const result = await res.json();
    showToast('SUCCESSFULLY PUSHED TO LIVE');
    
    // Optional: Show validation results
    if (result.validation) {
      console.log('Push validation results:', result.validation);
    }
    
  } catch (err) {
    console.error('Push failed:', err);
    showToast(`FAILED TO PUSH LIVE: ${err.message}`, 5000);
  } finally {
    hideLoading();
  }
}

// Asset management
async function loadAssets() {
  try {
    // Load structured folders from assets.json
    const res = await fetch('/data/assets.json');
    if (!res.ok) throw new Error(`Failed to load assets.json: ${res.status}`);
    
    const data = await res.json();
    console.log('[FRONTEND] Loaded assets.json:', data);
    assets = data;
    
    // Check for non-GCS URLs and warn
    checkForNonGCSUrls();
    renderFolders();
    
    // Load images from GCS
    const gcsRes = await fetch('/api/list-gcs-assets');
    if (gcsRes.status === 401) {
      showToast('AUTHENTICATION REQUIRED FOR GCS ASSETS');
      window.location.href = '/login.html';
      return;
    }
    
    if (!gcsRes.ok) {
      throw new Error(`Failed to load GCS assets: ${gcsRes.status}`);
    }
    
    const gcsData = await gcsRes.json();
    
    // Merge GCS images with existing assets structure
    if (gcsData.images) {
      assets.images = gcsData.images.map(url => {
        const filename = url.split('/').pop().toLowerCase();
        const isVideo = filename.match(/\.(mov|mp4|webm|avi)$/i);
        return { 
          url, 
          type: isVideo ? 'video' : 'image',
          name: url.split('/').pop(),
          source: 'gcs'
        };
      });
    }
    
    renderAssetsWithView();
    renderRecentAssets();
    
  } catch (err) {
    console.error('Failed to load assets:', err);
    showToast(`FAILED TO LOAD ASSETS: ${err.message}`, 5000);
  }
}

function checkForNonGCSUrls() {
  function scan(obj) {
    if (Array.isArray(obj)) return obj.some(scan);
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (typeof obj[key] === 'string' && key === 'url' && !obj[key].startsWith('https://storage.googleapis.com/')) {
          return true;
        }
        if (scan(obj[key])) return true;
      }
    }
    return false;
  }
  if (scan(assets)) {
    console.warn('[ADMIN WARNING] Non-GCS image URL detected in assets.json!');
    const warning = document.createElement('div');
    warning.textContent = 'WARNING: Some image URLs are not GCS URLs!';
    warning.style = 'background: #ffcc00; color: #222; padding: 8px; font-weight: bold; text-align: center;';
    document.body.insertBefore(warning, document.body.firstChild);
  }
}

function renderFolders() {
  const folderTree = document.getElementById('folderTree');
  if (!folderTree) return;
  folderTree.innerHTML = '';
  // Root folder
  const rootItem = document.createElement('li');
  rootItem.className = 'folder-item' + (currentPath === '' ? ' active' : '');
  rootItem.innerHTML = `
    <span onclick="navigateToFolder('')" style="cursor: pointer;">ROOT</span>
  `;
  rootItem.dataset.path = '';
  
  // Add drop zone functionality to root folder
  setupFolderDropZone(rootItem, '');
  
  folderTree.appendChild(rootItem);

  // Helper to merge and deduplicate folders by name
  function mergeFoldersAndChildren(obj) {
    let all = [];
    if (Array.isArray(obj.folders)) all = all.concat(obj.folders);
    if (Array.isArray(obj.children)) all = all.concat(obj.children);
    const seen = new Set();
    return all.filter(f => f && f.type === 'folder' && f.name && !seen.has(f.name) && seen.add(f.name));
  }

  // Render hierarchical folders
  function renderFolder(folder, level = 0) {
    const li = document.createElement('li');
    const indent = level * 20;
    // Merge folders and children arrays, deduplicate by name
    const allChildren = mergeFoldersAndChildren(folder);
    console.log(`[FRONTEND] Rendering folder '${folder.name}' at level ${level}, children:`, allChildren.map(f => f.name));
    const hasChildren = allChildren.length > 0;
    const folderPath = folder.path || folder.name;
    li.className = 'folder-item' + (currentPath === folderPath ? ' active' : '');
    li.dataset.path = folderPath;
    li.style.paddingLeft = `${indent}px`;
    li.innerHTML = `
      <span>${hasChildren ? '▸' : '·'}</span>
      <span onclick="navigateToFolder('${folderPath}')" style="cursor: pointer; text-transform: uppercase;">
        ${folder.name}
      </span>
      <div style="margin-left: auto; opacity: 0.6; display: none;" class="folder-actions">
        <button onclick="renameFolder('${folderPath}')" style="background: none; border: none; color: inherit; cursor: pointer;" title="Rename">✎</button>
        <button onclick="deleteFolder('${folderPath}')" style="background: none; border: none; color: inherit; cursor: pointer;" title="Delete">✕</button>
      </div>
    `;
    li.addEventListener('mouseenter', () => {
      li.querySelector('.folder-actions').style.display = 'flex';
    });
    li.addEventListener('mouseleave', () => {
      li.querySelector('.folder-actions').style.display = 'none';
    });
    
    // Add drop zone functionality to folder
    setupFolderDropZone(li, folderPath);
    
    folderTree.appendChild(li);
    // Render children
    if (hasChildren) {
      allChildren.forEach(child => {
        renderFolder({ ...child, path: folderPath + '/' + child.name }, level + 1);
      });
    }
  }

  // Merge root folders and children, deduplicate by name
  const allRootFolders = mergeFoldersAndChildren(assets);
  console.log('[FRONTEND] Merged root folders:', allRootFolders.map(f => f.name));
  allRootFolders.forEach(folder => renderFolder(folder));
}

function setupFolderDropZone(element, folderName) {
  element.addEventListener('dragover', (e) => {
    if (isDraggingAssets) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      element.classList.add('drop-target');
    }
  });
  
  element.addEventListener('dragleave', (e) => {
    element.classList.remove('drop-target');
  });
  
  element.addEventListener('drop', (e) => {
    if (isDraggingAssets) {
      e.preventDefault();
      element.classList.remove('drop-target');
      
      const draggedAssetUrls = e.dataTransfer.getData('text/plain').split(',');
      if (draggedAssetUrls.length > 0 && draggedAssetUrls[0]) {
        moveSelectedAssetsToFolder(folderName);
      }
    }
  });
}

// DEPRECATED - Use renderAssetsWithView instead
function renderAssets_DEPRECATED(assetsToRender = assets) {
  const assetGrid = document.getElementById('assetsContainer');
  if (!assetGrid) {
    console.error('[FRONTEND] assetGrid element not found');
    return;
  }
  assetGrid.innerHTML = '';
  
  // Get current folder items
  const currentItems = getCurrentFolderItems();
  const assetsToDisplay = currentItems.images || [];
  
  const startIndex = (currentPage - 1) * assetsPerPage;
  const endIndex = startIndex + assetsPerPage;
  const pageAssets = assetsToDisplay.slice(startIndex, endIndex);
  
  pageAssets.forEach((asset, index) => {
    const assetElement = document.createElement('div');
    assetElement.className = 'asset-item';
    assetElement.setAttribute('draggable', true);
    assetElement.dataset.assetIndex = startIndex + index;
    assetElement.dataset.assetUrl = asset.url || asset;
    
    // Check if asset is a video
    const isVideo = asset.url ? asset.url.toLowerCase().match(/\.(mov|mp4|webm|avi)$/i) : 
                    typeof asset === 'string' && asset.toLowerCase().match(/\.(mov|mp4|webm|avi)$/i);
    
    if (isVideo) {
      // Create video element for video files
      const video = document.createElement('video');
      video.src = asset.url || asset;
      video.controls = false;
      video.muted = true;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      
      // Add poster frame
      video.addEventListener('loadeddata', function() {
        video.currentTime = 1; // Show 1 second in as thumbnail
      });
      
      assetElement.appendChild(video);
      
      // Add video indicator
      const videoIndicator = document.createElement('div');
      videoIndicator.className = 'video-indicator';
      videoIndicator.innerHTML = '▶';
      videoIndicator.style.cssText = 'position: absolute; bottom: 5px; right: 5px; background: rgba(0,0,0,0.7); color: white; padding: 2px 6px; border-radius: 3px; font-size: 12px;';
      assetElement.appendChild(videoIndicator);
      
      // Play preview on hover
      assetElement.addEventListener('mouseenter', () => {
        video.play();
      });
      
      assetElement.addEventListener('mouseleave', () => {
        video.pause();
        video.currentTime = 1;
      });
    } else {
      // Original image handling
      const img = document.createElement('img');
      img.src = asset.url || asset;
      img.alt = 'Asset';
      img.loading = 'lazy';
      assetElement.appendChild(img);
    }
    
    // Click handler
    assetElement.addEventListener('click', () => handleAssetClick(asset.url || asset));
    
    // Drag handlers
    assetElement.addEventListener('dragstart', handleDragStart);
    assetElement.addEventListener('dragend', handleDragEnd);
    
    assetGrid.appendChild(assetElement);
  });
  
  renderPagination(filteredAssets.length);
}

// ... existing code ...

// Get items in current folder
function getCurrentFolderItems() {
  if (currentPath === '' || !currentPath) {
    // Merge root folders and children, deduplicate by name
    let allRootFolders = [];
    if (Array.isArray(assets.folders)) allRootFolders = allRootFolders.concat(assets.folders);
    if (Array.isArray(assets.children)) allRootFolders = allRootFolders.concat(assets.children);
    const seenRoot = new Set();
    allRootFolders = allRootFolders.filter(f => f && f.type === 'folder' && f.name && !seenRoot.has(f.name) && seenRoot.add(f.name));
    return {
      folders: allRootFolders,
      images: assets.images || []
    };
  }
  // Navigate to current folder
  const pathParts = currentPath.split('/').filter(Boolean);
  let current = assets;
  for (const part of pathParts) {
    const allFolders = [];
    if (Array.isArray(current.folders)) allFolders.push(...current.folders);
    if (Array.isArray(current.children)) allFolders.push(...current.children);
    const folder = allFolders.find(f => (f.type === 'folder' || !f.type) && f.name === part);
    if (!folder) return { folders: [], images: [] };
    current = folder;
  }
  // Merge children and folders at this level
  let allFolders = [];
  if (Array.isArray(current.children)) allFolders = allFolders.concat(current.children);
  if (Array.isArray(current.folders)) allFolders = allFolders.concat(current.folders);
  const seen = new Set();
  const folders = allFolders.filter(f => f && f.type === 'folder' && f.name && !seen.has(f.name) && seen.add(f.name));
  const images = allFolders.filter(f => f && (f.type === 'image' || f.type === 'video' || (f.url && !f.type)));
  return { folders, images };
}

// Drag and drop functionality
function setupDragAndDrop() {
  // Cover dropzone
  const coverDropzone = document.getElementById('coverDropzone');
  console.log('🎯 Setting up cover dropzone, element found:', !!coverDropzone);
  
  if (!coverDropzone) {
    console.error('❌ Cover dropzone element not found! Check if id="coverDropzone" exists');
    return;
  }
  
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    coverDropzone.addEventListener(eventName, preventDefaults, false);
  });
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  ['dragenter', 'dragover'].forEach(eventName => {
    coverDropzone.addEventListener(eventName, () => {
      coverDropzone.classList.add('active');
    }, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    coverDropzone.addEventListener(eventName, () => {
      coverDropzone.classList.remove('active');
    }, false);
  });
  
  coverDropzone.addEventListener('drop', handleCoverDrop, false);
  
  // Asset dropzone
  const assetDropzone = document.getElementById('assetDropzone');
  if (assetDropzone) {
    setupAssetDropzone(assetDropzone);
  }
}

async function handleCoverDrop(e) {
  const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
  
  if (files.length === 0) {
    showToast('PLEASE DROP IMAGE FILES ONLY');
    return;
  }
  
  for (const file of files) {
    await uploadAndCreateCover(file);
  }
}

async function uploadAndCreateCover(file) {
  console.log('📤 Uploading and creating cover for file:', file.name, 'size:', file.size);
  
  const formData = new FormData();
  formData.append('file', file);
  
  showLoading();
  
  try {
    const res = await fetch('/upload-image', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    
    console.log('[UPLOAD] Server response status:', res.status, res.statusText);
    
    let data;
    try {
      data = await res.json();
      console.log('[UPLOAD] Server response data:', data);
    } catch (err) {
      console.error('[UPLOAD] Failed to parse server response as JSON:', err);
      console.log('[UPLOAD] Raw response:', await res.text());
      showToast('UPLOAD FAILED: INVALID SERVER RESPONSE', 5000);
      return;
    }
    
    if (res.ok && data && data.url) {
      console.log('[UPLOAD] Success! File URL:', data.url);
      console.log('[UPLOAD] Thumbnail URL:', data.thumbnailUrl || 'No thumbnail');
      
      // Test if thumbnail actually loads
      if (data.thumbnailUrl) {
        const testImg = new Image();
        testImg.onload = () => console.log('[UPLOAD] Thumbnail loads successfully!');
        testImg.onerror = () => console.error('[UPLOAD] Thumbnail failed to load:', data.thumbnailUrl);
        testImg.src = data.thumbnailUrl;
      }
      
      // Warn if TIFF
      if (/\.tif{1,2}$/i.test(file.name)) {
        showToast('UPLOAD SUCCESSFUL, BUT TIFF IMAGES MAY NOT PREVIEW IN BROWSERS', 7000);
      } else {
        showToast(`UPLOADED ${file.name.toUpperCase()}`);
      }
      
      // Create new cover
      const newCover = {
        id: Date.now(),
        index: covers.length,
        albumTitle: 'NEW COVER',
        coverLabel: 'ARTIST NAME',
        frontImage: data.url,
        backImage: data.url,
        category: ['artists']
      };
      
      covers.push(newCover);
      hasChanges = true;
      updateSaveButton();
      renderCovers();
      
      // Auto-open edit modal
      setTimeout(() => editCover(newCover), 300);
      
      showToast('COVER CREATED — PLEASE EDIT DETAILS');
    } else {
      console.error('[UPLOAD] Upload failed:', data);
      showToast('UPLOAD FAILED: ' + (data && data.error ? data.error.toUpperCase() : 'UNKNOWN ERROR'), 5000);
      return;
    }
  } catch (err) {
    showToast('FAILED TO UPLOAD IMAGE', 5000);
    console.error(err);
  } finally {
    hideLoading();
  }
}

// Modal image upload functionality for drag & drop in edit modal
async function handleModalImageUpload(file) {
  const dropText = document.getElementById('modalDropzoneText');
  dropText.textContent = 'Uploading...';
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', currentFolder || '');
    const res = await fetch('/upload-image', { method: 'POST', body: formData });
    const data = await res.json();
    if (res.ok && data.url) {
      // Add to assets immediately
      if (!assets.images) assets.images = [];
      assets.images.push({ type: 'image', url: data.url, name: file.name, uploadedAt: new Date().toISOString() });
      // Update the first image input field if present
      const input = document.querySelector("#editCoverForm input[type='text'][name*='Image']");
      if (input) {
        input.value = data.url;
        input.dispatchEvent(new Event('input'));
      }
      showToast('IMAGE UPLOADED');
    } else {
      showToast('UPLOAD FAILED: ' + (data.error || 'Unknown error'), 5000);
    }
  } catch (err) {
    showToast('UPLOAD FAILED: ' + err.message, 5000);
  } finally {
    dropText.textContent = 'Drag & drop or click to upload';
  }
}

function setupModalDropzone(container) {
  // Setup drag & drop for modal
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    container.addEventListener(eventName, preventDefaults, false);
  });
  
  container.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleModalImageUpload(files[0]);
    }
  }, false);
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
}

// Search functionality
function setupEventListeners() {
  // Cover search
  const searchInput = document.getElementById('coverSearch');
  let searchTimeout;
  
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      renderCovers(e.target.value);
    }, 300);
  });
}

// Keyboard shortcuts
// Loading states
// Enhanced loading states with skeleton screens
function showLoading(type = 'default') {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.style.display = 'block';
  }
  
  // Add skeleton screens for specific content types
  if (type === 'covers') {
    showCoversSkeleton();
  } else if (type === 'assets') {
    showAssetsSkeleton();
  }
}

function hideLoading() {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.style.display = 'none';
  }
  
  // Remove skeleton screens
  hideSkeleton();
}

function showCoversSkeleton() {
  const container = document.getElementById('coversContainer');
  if (!container) return;
  
  container.innerHTML = Array(6).fill(0).map(() => `
    <div class="cover-skeleton">
      <div class="skeleton-image"></div>
      <div class="skeleton-text"></div>
      <div class="skeleton-text short"></div>
    </div>
  `).join('');
  
  container.classList.add('skeleton-mode');
}

function showAssetsSkeleton() {
  const container = document.getElementById('assetGrid');
  if (!container) return;
  
  container.innerHTML = Array(12).fill(0).map(() => `
    <div class="asset-skeleton">
      <div class="skeleton-image"></div>
      <div class="skeleton-text short"></div>
    </div>
  `).join('');
  
  container.classList.add('skeleton-mode');
}

function hideSkeleton() {
  const containers = document.querySelectorAll('.skeleton-mode');
  containers.forEach(container => {
    container.classList.remove('skeleton-mode');
  });
}

// Progressive loading indicator
function showProgressIndicator(message = 'Loading...', progress = 0) {
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
        <div class="progress-fill" style="background: var(--ink); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
      </div>
      <div class="progress-percent" style="margin-top: var(--space-sm); font-size: 12px; color: #666;"></div>
    `;
    
    document.body.appendChild(indicator);
  }
  
  indicator.querySelector('.progress-message').textContent = message;
  indicator.querySelector('.progress-fill').style.width = progress + '%';
  indicator.querySelector('.progress-percent').textContent = Math.round(progress) + '%';
  indicator.style.display = 'block';
}

function hideProgressIndicator() {
  const indicator = document.getElementById('progressIndicator');
  if (indicator) {
    indicator.style.display = 'none';
  }
}

// Confirmation dialog utility
function showConfirmDialog(message, onConfirm, onCancel = null) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: var(--bg);
      border: 1px solid var(--ink);
      padding: var(--space-xl);
      border-radius: 8px;
      max-width: 400px;
      text-align: center;
    `;
    
    dialog.innerHTML = `
      <div style="margin-bottom: var(--space-lg); font-weight: bold;">${message}</div>
      <div style="display: flex; gap: var(--space-md); justify-content: center;">
        <button class="btn btn-secondary" id="cancelBtn">CANCEL</button>
        <button class="btn btn-danger" id="confirmBtn">CONFIRM</button>
      </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // Focus management
    dialog.querySelector('#confirmBtn').focus();
    
    // Event handlers
    const cleanup = (result) => {
      document.body.removeChild(overlay);
      resolve(result);
    };
    
    dialog.querySelector('#confirmBtn').onclick = () => {
      cleanup(true);
      if (onConfirm) onConfirm();
    };
    
    dialog.querySelector('#cancelBtn').onclick = () => {
      cleanup(false);
      if (onCancel) onCancel();
    };
    
    // ESC to cancel
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', escHandler);
        cleanup(false);
        if (onCancel) onCancel();
      }
    });
    
    // Click outside to cancel
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup(false);
        if (onCancel) onCancel();
      }
    });
  });
}

// Enhanced modal functions with accessibility
function openModal() {
  const modal = document.getElementById('coverModal');
  if (!modal) return;
  
  modal.classList.add('active');
  
  // Set ARIA attributes
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('role', 'dialog');
  
  // Focus management - focus first focusable element
  const firstFocusable = modal.querySelector('input, button, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (firstFocusable) {
    firstFocusable.focus();
  }
  
  // Trap focus within modal
  setupFocusTrap(modal);
  
  // Prevent body scroll
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modal = document.getElementById('coverModal');
  if (!modal) return;
  
  modal.classList.remove('active');
  
  // Remove ARIA attributes
  modal.removeAttribute('aria-modal');
  modal.removeAttribute('role');
  
  // Restore body scroll
  document.body.style.overflow = '';
  
  // Return focus to trigger element (usually a button)
  const lastActiveElement = document.querySelector('.btn:focus, button:focus');
  if (lastActiveElement) {
    lastActiveElement.focus();
  }
}

function setupFocusTrap(modal) {
  const focusableElements = modal.querySelectorAll(
    'input, button, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  if (focusableElements.length === 0) return;
  
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];
  
  // Handle Tab and Shift+Tab
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    }
    
    // ESC to close
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
  });
}

// Expose modal functions globally
window.openModal = openModal;
window.closeModal = closeModal;

// Infinite scroll implementation
let isLoadingMore = false;
let hasMoreAssets = true;

function setupInfiniteScroll() {
  const assetGrid = document.getElementById('assetGrid');
  if (!assetGrid) return;
  
  const observer = new IntersectionObserver((entries) => {
    const lastEntry = entries[0];
    if (lastEntry.isIntersecting && !isLoadingMore && hasMoreAssets) {
      loadMoreAssets();
    }
  }, {
    threshold: 0.1,
    rootMargin: '100px'
  });
  
  // Create sentinel element
  const sentinel = document.createElement('div');
  sentinel.id = 'loadMoreSentinel';
  sentinel.style.height = '10px';
  assetGrid.parentNode.appendChild(sentinel);
  observer.observe(sentinel);
}

async function loadMoreAssets() {
  if (isLoadingMore || !hasMoreAssets) return;
  
  isLoadingMore = true;
  showProgressIndicator('Loading more assets...', 50);
  
  try {
    // Simulate loading more assets (in real implementation, this would fetch from server)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Increment page and load more
    currentPage++;
    const newAssets = await fetchAssetsPage(currentPage);
    
    if (newAssets.length === 0) {
      hasMoreAssets = false;
      showToast('No more assets to load');
    } else {
      // Append new assets to the current view
      appendAssetsToGrid(newAssets);
      showToast(`Loaded ${newAssets.length} more assets`);
    }
  } catch (error) {
    showToast('Failed to load more assets', 5000);
    console.error('Load more error:', error);
  } finally {
    isLoadingMore = false;
    hideProgressIndicator();
  }
}

function appendAssetsToGrid(newAssets) {
  const assetGrid = document.getElementById('assetGrid');
  if (!assetGrid) return;
  
  newAssets.forEach(asset => {
    const assetElement = createAssetElement(asset);
    assetGrid.appendChild(assetElement);
    
    // Lazy load images
    lazyLoadImage(assetElement.querySelector('img'));
  });
}

// Lazy loading implementation
function setupLazyLoading() {
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        lazyLoadImage(img);
        imageObserver.unobserve(img);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '50px'
  });
  
  // Observe all images with data-src attribute
  document.querySelectorAll('img[data-src]').forEach(img => {
    imageObserver.observe(img);
  });
}

function lazyLoadImage(img) {
  if (!img || !img.dataset.src) return;
  
  // Create a placeholder while loading
  const placeholder = img.cloneNode();
  placeholder.style.filter = 'blur(5px)';
  
  const newImg = new Image();
  newImg.onload = () => {
    img.src = newImg.src;
    img.classList.add('loaded');
    img.style.filter = 'none';
  };
  
  newImg.onerror = () => {
    img.src = '/placeholder.jpg';
    img.classList.add('error');
  };
  
  newImg.src = img.dataset.src;
}

// Enhanced image loading for covers
function createCoverElementWithLazyLoading(cover, index) {
  const div = document.createElement('div');
  div.className = 'cover-item';
  div.dataset.id = cover.id;
  div.dataset.coverId = cover.id;
  
  const isSelected = selectedCovers.has(cover.id);
  const rotation = (index % 3 === 0) ? -0.5 : (index % 3 === 1) ? 0.5 : 0;
  
  div.innerHTML = `
    ${batchMode ? `<input type="checkbox" class="cover-checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleCoverSelection('${cover.id}')">` : ''}
    <img data-src="${cover.frontImage || '/placeholder.jpg'}" 
         alt="${cover.albumTitle || 'Untitled'}" 
         class="cover-image lazy"
         loading="lazy"
         src="/placeholder.jpg">
    <div class="cover-meta">
      <div class="cover-title">${cover.albumTitle || 'UNTITLED'}</div>
      <div class="cover-artist">${cover.artistDetails?.name || cover.coverLabel || 'UNKNOWN ARTIST'}</div>
    </div>
  `;
  
  div.style.transform = `rotate(${rotation}deg)`;
  div.style.opacity = '0';
  div.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  
  div.addEventListener('click', () => handleCoverClick(cover.id));
  
  // Lazy load the image
  setTimeout(() => {
    lazyLoadImage(div.querySelector('img'));
  }, index * 50);
  
  return div;
}

// Toast notifications with click to dismiss
function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = message.toUpperCase();
  toast.classList.add('show');
  
  // Click to dismiss
  toast.onclick = () => {
    toast.classList.remove('show');
  };
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// User management (admin only)
async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    const users = await res.json();
    
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = users.map(user => `
      <div style="display: flex; justify-content: space-between; align-items: center; 
                  padding: var(--space-md) 0; border-bottom: 1px solid var(--grey-100);">
        <div>
          <div style="font-weight: 700;">${user.username.toUpperCase()}</div>
          <div style="font-family: var(--font-mono); font-size: 0.75rem; opacity: 0.7;">
            ${user.role.toUpperCase()}
          </div>
        </div>
        ${user.username !== 'admin' ? `
          <button class="btn btn-danger" onclick="deleteUser('${user.username}')" 
                  style="padding: var(--space-sm) var(--space-md);">
            DELETE
          </button>
        ` : ''}
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

async function addUser(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: formData.get('username'),
        password: formData.get('password'),
        role: formData.get('role')
      })
    });
    
    if (res.ok) {
      showToast('USER CREATED SUCCESSFULLY');
      e.target.reset();
      loadUsers();
    } else {
      const data = await res.json();
      showToast(data.error || 'FAILED TO CREATE USER', 5000);
    }
  } catch (err) {
    showToast('FAILED TO CREATE USER', 5000);
    console.error(err);
  }
}

async function deleteUser(username) {
  if (!confirm(`DELETE USER "${username.toUpperCase()}"?`)) return;
  
  try {
    const res = await fetch(`/api/users/${username}`, { method: 'DELETE' });
    
    if (res.ok) {
      showToast('USER DELETED');
      loadUsers();
    } else {
      throw new Error('Delete failed');
    }
  } catch (err) {
    showToast('FAILED TO DELETE USER', 5000);
    console.error(err);
  }
}

// Export functionality
async function exportCovers() {
  const selected = covers.filter(c => selectedCovers.has(c.id));
  
  if (selected.length === 0) {
    showToast('NO COVERS SELECTED');
    return;
  }
  
  const dataStr = JSON.stringify(selected, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
  
  const exportName = `amf-covers-export-${new Date().toISOString().split('T')[0]}.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportName);
  linkElement.click();
  
  showToast(`EXPORTED ${selected.length} COVERS`);
}

// Delete selected covers
async function deleteSelected() {
  const count = selectedCovers.size;
  if (count === 0) return;
  
  const confirmed = await showConfirmDialog(
    `Are you sure you want to DELETE ${count} selected cover${count > 1 ? 's' : ''}? This action cannot be undone.`
  );
  
  if (!confirmed) return;
  
  showProgressIndicator('Deleting covers...', 0);
  
  try {
    covers = covers.filter(c => !selectedCovers.has(c.id));
    
    // Re-index
    covers.forEach((cover, i) => cover.index = i);
    
    hasChanges = true;
    updateSaveButton();
    toggleBatchMode();
    renderCovers();
    
    showToast(`DELETED ${count} COVER${count > 1 ? 'S' : ''}`);
  } catch (error) {
    showToast('FAILED TO DELETE COVERS', 5000);
    console.error('Delete error:', error);
  } finally {
    hideProgressIndicator();
  }
}

// Asset management functions
let currentPath = '';

// Add this function to update the current folder indicator
function updateCurrentFolderIndicator() {
  let indicator = document.getElementById('currentFolderIndicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'currentFolderIndicator';
    indicator.style.fontFamily = 'var(--font-mono)';
    indicator.style.fontSize = '0.9em';
    indicator.style.marginBottom = '8px';
    indicator.style.color = '#888';
    const dropzone = document.getElementById('assetDropzone');
    if (dropzone && dropzone.parentNode) {
      dropzone.parentNode.insertBefore(indicator, dropzone);
    }
  }
  indicator.textContent = `Current Folder: ${currentPath || 'ROOT'}`;
}

// Create new folder
async function createNewFolder() {
  const name = prompt('ENTER FOLDER NAME:');
  if (!name) return;
  
  showLoading();
  try {
    const res = await fetch('/api/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentPath, name })
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error);
    }
    
    showToast('FOLDER CREATED SUCCESSFULLY');
    await loadAssets();
  } catch (err) {
    showToast(err.message || 'FAILED TO CREATE FOLDER', 5000);
  } finally {
    hideLoading();
  }
}

// Rename folder
async function renameFolder(path) {
  const oldName = path.split('/').pop();
  const newName = prompt('ENTER NEW NAME:', oldName);
  if (!newName || newName === oldName) return;
  
  showLoading();
  try {
    const res = await fetch('/api/folder/rename', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, newName })
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error);
    }
    
    showToast('FOLDER RENAMED SUCCESSFULLY');
    await loadAssets();
  } catch (err) {
    showToast(err.message || 'FAILED TO RENAME FOLDER', 5000);
  } finally {
    hideLoading();
  }
}

// Delete folder
async function deleteFolder(path) {
  if (!confirm(`DELETE FOLDER "${path.split('/').pop().toUpperCase()}" AND ALL ITS CONTENTS?`)) return;
  
  showLoading();
  try {
    const res = await fetch('/api/folder', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error);
    }
    
    showToast('FOLDER DELETED SUCCESSFULLY');
    if (currentPath.startsWith(path)) {
      navigateToFolder('');
    }
    await loadAssets();
  } catch (err) {
    showToast(err.message || 'FAILED TO DELETE FOLDER', 5000);
  } finally {
    hideLoading();
  }
}

// Navigate to folder
function navigateToFolder(path) {
  currentPath = path;
  updateCurrentFolderIndicator();
  
  // Update active folder
  document.querySelectorAll('.folder-item').forEach(item => {
    item.classList.toggle('active', item.dataset && item.dataset.path === path);
  });
  
  renderAssetsWithView();
}

// Update asset name
function updateAssetName(url, name) {
  // Find and update the asset
  function updateInStructure(items) {
    for (let item of items) {
      if (item.type === 'image' && item.url === url) {
        item.name = name;
        return true;
      }
      if (item.children) {
        if (updateInStructure(item.children)) return true;
      }
    }
    return false;
  }
  
  // Check root images
  if (assets.images) {
    const rootImage = assets.images.find(img => img.url === url);
    if (rootImage) {
      rootImage.name = name;
    } else {
      // Check in folders
      if (assets.folders) {
        updateInStructure(assets.folders);
      }
    }
  }
  
  saveAssets();
}

// Delete asset
async function deleteAsset(url) {
  if (!confirm('DELETE THIS ASSET?')) return;
  
  // Remove from structure
  function removeFromStructure(items) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].type === 'image' && items[i].url === url) {
        items.splice(i, 1);
        return true;
      }
      if (items[i].children) {
        if (removeFromStructure(items[i].children)) return true;
      }
    }
    return false;
  }
  
  // Check root images
  if (assets.images) {
    const rootIndex = assets.images.findIndex(img => img.url === url);
    if (rootIndex !== -1) {
      assets.images.splice(rootIndex, 1);
    } else {
      // Check in folders
      if (assets.folders) {
        assets.folders.forEach(folder => {
          if (folder.children) {
            removeFromStructure(folder.children);
          }
        });
      }
    }
  }
  
  await saveAssets();
  renderAssetsWithView();
}

// Copy to clipboard (full URL)
function copyToClipboardFullPath(urlOrPath, isFolder = false) {
  let fullUrl = urlOrPath;
  // If it's a folder, build the full path
  if (isFolder) {
    // Remove leading/trailing slashes
    let cleanPath = urlOrPath.replace(/^\/+|\/+$/g, '');
    fullUrl = window.location.origin + '/admin/assets/' + cleanPath;
  } else {
    // If url is relative, prepend origin
    if (/^\//.test(urlOrPath)) {
      fullUrl = window.location.origin + urlOrPath;
    } else if (!/^https?:\/\//.test(urlOrPath)) {
      fullUrl = window.location.origin + '/' + urlOrPath;
    }
  }
  navigator.clipboard.writeText(fullUrl).then(() => {
    showToast('FULL URL COPIED TO CLIPBOARD');
  }).catch(() => {
    showToast('FAILED TO COPY TO CLIPBOARD', 5000);
  });
}

// Save assets
async function saveAssets() {
  try {
    const res = await fetch('/save-assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assets)
    });

    if (!res.ok) {
      throw new Error(`Server error ${res.status}`);
    }

    console.log("✅ Assets saved");
  } catch (err) {
    console.error("❌ Error saving assets:", err);
    showToast('FAILED TO SAVE ASSETS', 5000);
  }
}

// Setup asset dropzone
function setupAssetDropzone(dropzone) {
  if (!dropzone) return;
  
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Highlight drop zone
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => {
      dropzone.classList.add('active');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => {
      dropzone.classList.remove('active');
    }, false);
  });

  // Handle dropped files
  dropzone.addEventListener('drop', handleAssetDrop, false);

  // Also allow click to upload
  dropzone.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*,audio/*';
    input.multiple = true;
    input.onchange = e => handleAssetUpload(e.target.files);
    input.click();
  });
}

// Handle asset drop
async function handleAssetDrop(e) {
  const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/') || f.type.startsWith('video/') || f.type.startsWith('audio/'));
  
  if (files.length === 0) {
    showToast('PLEASE DROP IMAGE, VIDEO, OR AUDIO FILES ONLY');
    return;
  }
  
  await handleAssetUpload(files);
}

// Handle asset upload
async function handleAssetUpload(files) {
  showLoading();
  let uploadedAny = false;
  let uploadedAssets = [];
  try {
    for (const file of files) {
      // TODO: Future enhancement - convert HEIC to JPEG client-side using heic2any library
      // This would solve the server-side HEIC support issue on platforms like Render
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', currentPath || '');
      // Log currentPath and FormData contents
      console.log('[UPLOAD] currentPath:', currentPath);
      for (let [key, value] of formData.entries()) {
        console.log(`[UPLOAD] FormData: ${key} =`, value);
      }
      const res = await fetch('/upload-image', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      console.log('[UPLOAD] Server response status:', res.status, res.statusText);
      
      let data;
      try {
        data = await res.json();
        console.log('[UPLOAD] Server response data:', data);
      } catch (err) {
        console.error('[UPLOAD] Failed to parse server response as JSON:', err);
        console.log('[UPLOAD] Raw response:', await res.text());
        showToast('UPLOAD FAILED: INVALID SERVER RESPONSE', 5000);
        continue;
      }
      
      if (res.ok && data && data.url) {
        uploadedAny = true;
        uploadedAssets.push(data);
        console.log('[UPLOAD] Success! File URL:', data.url);
        console.log('[UPLOAD] Thumbnail URL:', data.thumbnailUrl || 'No thumbnail');
        
        // Warn if TIFF
        if (/\.tif{1,2}$/i.test(file.name)) {
          showToast('UPLOAD SUCCESSFUL, BUT TIFF IMAGES MAY NOT PREVIEW IN BROWSERS', 7000);
        } else {
          showToast(`UPLOADED ${file.name.toUpperCase()}`);
        }
      } else {
        console.error('[UPLOAD] Upload failed:', data);
        showToast('UPLOAD FAILED: ' + (data && data.error ? data.error.toUpperCase() : 'UNKNOWN ERROR'), 5000);
        continue;
      }
    }
    if (uploadedAny) {
      // Update local assets structure with uploaded files
      updateLocalAssetsWithUploads(uploadedAssets);
      
      // Save the updated assets structure to the server
      await saveAssets();
      
      // Reload assets from server to ensure consistency
      await loadAssets();
      renderAssetsWithView();
    }
  } catch (err) {
    showToast('UPLOAD FAILED: ' + err.message.toUpperCase(), 5000);
    console.error(err);
  } finally {
    hideLoading();
  }
}

// Update local assets structure with newly uploaded files
function updateLocalAssetsWithUploads(uploadedAssets) {
  if (!assets.images) {
    assets.images = [];
  }
  
  for (const uploadedAsset of uploadedAssets) {
    // Add to images array
    const assetEntry = {
      url: uploadedAsset.url,
      type: uploadedAsset.type || 'image',
      filename: uploadedAsset.filename,
      thumbnailUrl: uploadedAsset.thumbnailUrl
    };
    
    // Check if asset already exists
    const existingIndex = assets.images.findIndex(img => 
      (typeof img === 'string' && img === uploadedAsset.url) ||
      (img.url && img.url === uploadedAsset.url)
    );
    
    if (existingIndex === -1) {
      assets.images.push(assetEntry);
      console.log('[UPLOAD] Added asset to local structure:', assetEntry);
    }
    
    // Update folder structure if in a subfolder
    if (currentPath) {
      // Navigate to the correct folder based on the path
      const pathParts = currentPath.split('/').filter(Boolean);
      let current = assets;
      
      for (const part of pathParts) {
        // Ensure children array exists
        if (!current.children) {
          current.children = [];
        }
        
        // Find or create the folder
        let folder = current.children.find(child => child.name === part && child.type === 'folder');
        if (!folder) {
          folder = {
            name: part,
            type: 'folder',
            children: []
          };
          current.children.push(folder);
          console.log('[UPLOAD] Created new folder in structure:', part);
        }
        
        current = folder;
      }
      
      // Add asset to the final folder's children
      if (!current.children) {
        current.children = [];
      }
      
      const folderAssetExists = current.children.some(child => 
        child.url === uploadedAsset.url || child === uploadedAsset.url
      );
      
      if (!folderAssetExists) {
        current.children.push(assetEntry);
        console.log('[UPLOAD] Added asset to folder:', currentPath, assetEntry);
      }
    }
  }
  
  // Re-render folders to show the new assets
  renderFolders();
}

// Make functions globally available
window.createNewFolder = createNewFolder;
window.renameFolder = renameFolder;
window.deleteFolder = deleteFolder;
window.navigateToFolder = navigateToFolder;
window.updateAssetName = updateAssetName;
window.deleteAsset = deleteAsset;
window.copyToClipboardFullPath = copyToClipboardFullPath;

// Media Library Functions
window.toggleMediaLibrary = function() {
  mediaLibraryExpanded = !mediaLibraryExpanded;
  const content = document.getElementById('mediaLibraryContent');
  const toggle = document.getElementById('mediaLibraryToggle');
  const toggleText = toggle.querySelector('.toggle-text');
  
  if (mediaLibraryExpanded) {
    content.style.display = 'block';
    toggle.classList.add('expanded');
    toggleText.textContent = 'COLLAPSE';
  } else {
    content.style.display = 'none';
    toggle.classList.remove('expanded');
    toggleText.textContent = 'EXPAND';
  }
};

window.switchView = function(view) {
  currentView = view;
  
  // Update view mode buttons
  document.querySelectorAll('.view-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  
  // Update asset grid classes
  const assetGrid = document.getElementById('assetsContainer');
  assetGrid.className = `asset-grid ${view}-view`;
  
  // Re-render assets with new view
  renderAssetsWithView();
};

function setupMediaLibraryEventListeners() {
  // View mode buttons
  document.querySelectorAll('.view-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.view);
    });
  });
  
  // Search functionality
  const searchInput = document.getElementById('assetSearch');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        filterAndRenderAssets();
      }, 300);
    });
  }
  
  // Sort functionality
  const sortSelect = document.getElementById('assetSort');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      sortBy = e.target.value;
      filterAndRenderAssets();
    });
  }
}

function renderRecentAssets() {
  const container = document.getElementById('recentAssetsGrid');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Get all assets and sort by date (most recent first)
  const allAssets = getAllAssets();
  const recentAssets = allAssets
    .filter(asset => asset.uploadedAt || asset.lastModified)
    .sort((a, b) => {
      const dateA = new Date(a.uploadedAt || a.lastModified || 0);
      const dateB = new Date(b.uploadedAt || b.lastModified || 0);
      return dateB - dateA;
    })
    .slice(0, 8); // Show last 8 uploads
  
  if (recentAssets.length === 0) {
    container.innerHTML = '<p style="color: var(--grey-500); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.1em;">NO RECENT UPLOADS</p>';
    return;
  }
  
  recentAssets.forEach(asset => {
    const div = document.createElement('div');
    div.className = 'recent-asset-item';
    
    let mediaTag = '';
    const type = getAssetType(asset);
    
    if (type === 'image') {
      mediaTag = `<img src="${asset.url}" alt="${asset.name || 'Asset'}" loading="lazy">`;
    } else if (type === 'video') {
      mediaTag = `<video src="${asset.url}" preload="metadata" style="width:100%;height:100%;object-fit:cover;"></video>`;
    } else if (type === 'audio') {
      mediaTag = `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:var(--grey-200);"><span style="font-size:2rem;">🎵</span></div>`;
    } else {
      mediaTag = `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:var(--grey-200);"><span style="font-size:1rem;">📄</span></div>`;
    }
    
    div.innerHTML = `
      ${mediaTag}
      <div class="asset-name">${asset.name || 'Untitled'}</div>
    `;
    
    div.onclick = () => {
      navigator.clipboard.writeText(asset.url);
      showToast('URL COPIED TO CLIPBOARD');
    };
    
    container.appendChild(div);
  });
}

function getAllAssets() {
  const allAssets = [];
  
  // Add root level images
  if (assets.images) {
    allAssets.push(...assets.images);
  }
  
  // Add images from folders recursively
  function addFromFolder(folder) {
    if (folder.children) {
      folder.children.forEach(child => {
        if (child.type === 'image') {
          allAssets.push(child);
        } else if (child.type === 'folder') {
          addFromFolder(child);
        }
      });
    }
    if (folder.folders) {
      folder.folders.forEach(subfolder => addFromFolder(subfolder));
    }
  }
  
  // Process both folders and children arrays
  if (assets.folders) {
    assets.folders.forEach(folder => addFromFolder(folder));
  }
  if (assets.children) {
    assets.children.forEach(child => {
      if (child.type === 'folder') {
        addFromFolder(child);
      } else if (child.type === 'image') {
        allAssets.push(child);
      }
    });
  }
  
  return allAssets;
}

function getAssetType(asset) {
  if (asset.type) return asset.type;
  
  if (!asset.url) return 'other';
  
  const url = asset.url.toLowerCase();
  if (/\.(mp4|webm|mov|avi)$/i.test(url)) return 'video';
  if (/\.(mp3|wav|m4a|aac|ogg)$/i.test(url)) return 'audio';
  if (/\.(png|jpe?g|gif|bmp|webp|svg|tif{1,2})$/i.test(url)) return 'image';
  return 'other';
}

function getAssetSize(asset) {
  // This would need server support to get actual file sizes
  // For now, return a placeholder
  return asset.size || 'Unknown';
}

function getAssetDate(asset) {
  const date = new Date(asset.uploadedAt || asset.lastModified || Date.now());
  return date.toLocaleDateString();
}

function filterAndRenderAssets() {
  // Use the new enhanced filtering logic
  filteredAssets = getFilteredAssets();
  
  // Update asset count indicator
  updateAssetCountIndicator(filteredAssets.length);
  
  // Render assets with current view mode
  renderAssetsWithView();
}

// Enhanced renderAssets function that supports different views
function renderAssetsWithView() {
  const container = document.getElementById('assetsContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Use filtered assets if available, otherwise get current folder items
  const assetsToShow = filteredAssets.length > 0 || document.getElementById('assetSearch')?.value 
    ? filteredAssets 
    : getCurrentFolderItems().images;
  
  if (assetsToShow.length === 0) {
    container.innerHTML = '<p style="color: var(--grey-500); grid-column: 1/-1; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.1em;">NO ASSETS IN THIS FOLDER</p>';
    return;
  }
  
  // Pagination
  const startIndex = currentPage * assetsPerPage;
  const endIndex = startIndex + assetsPerPage;
  const paginatedAssets = assetsToShow.slice(startIndex, endIndex);
  
  paginatedAssets.forEach((asset, index) => {
    const assetId = asset.url; // Use URL as unique identifier
    const globalIndex = startIndex + index; // Global index for selection tracking
    const isSelected = selectedAssets.has(assetId);
    
    const div = document.createElement('div');
    div.className = `asset-item ${isSelected ? 'selected' : ''}`;
    div.dataset.assetId = assetId;
    div.dataset.assetIndex = globalIndex;
    div.draggable = true;
    
    const type = getAssetType(asset);
    let mediaTag = '';
    
    if (type === 'video') {
      // Use thumbnail for video preview if available
      const thumbnailSrc = asset.thumbnailUrl || asset.url;
      mediaTag = `<div style="position:relative;width:100%;height:180px;background:#222;">
        <img src="${thumbnailSrc}" alt="${asset.name || 'Video'}" loading="lazy" 
             style="width:100%;height:100%;object-fit:cover;" 
             onerror="this.style.display='none'; this.parentElement.querySelector('.video-icon').style.display='flex';">
        <div class="video-icon" style="position:absolute;top:0;left:0;right:0;bottom:0;display:none;align-items:center;justify-content:center;background:#333;color:#fff;font-size:2em;">
          ▶
        </div>
        <div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.8);color:white;padding:2px 6px;font-size:0.7em;font-family:monospace;">
          VIDEO
        </div>
      </div>`;
    } else if (type === 'audio') {
      mediaTag = `<div style="width:100%;height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f5f5f5;border:1px solid #ddd;">
        <div style="font-size:3em;color:#666;margin-bottom:8px;">♪</div>
        <div style="font-size:0.8em;color:#666;text-transform:uppercase;letter-spacing:1px;">AUDIO FILE</div>
        <div style="font-size:0.7em;color:#999;margin-top:4px;">${asset.filename || asset.name || 'Unknown'}</div>
      </div>`;
    } else if (type === 'image') {
      // Use thumbnail if available, fallback to original
      const imageSrc = asset.thumbnailUrl || asset.url;
      const fallbackIcon = 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="200" height="180">
          <rect fill="#f5f5f5" width="200" height="180" stroke="#ddd"/>
          <text x="50%" y="45%" text-anchor="middle" dy=".3em" fill="#999" font-size="12" font-family="monospace">
            BROKEN IMAGE
          </text>
          <text x="50%" y="65%" text-anchor="middle" dy=".3em" fill="#ccc" font-size="10" font-family="monospace">
            ${(asset.filename || asset.name || 'unknown').substring(0, 20)}
          </text>
        </svg>
      `);
      
      mediaTag = `<img src="${imageSrc}" alt="${asset.name || 'Asset'}" loading="lazy" 
                       style="width:100%;height:180px;object-fit:cover;" 
                       onerror="this.src='${fallbackIcon}'">`;
    } else {
      // Generate a file type icon for unsupported formats
      const extension = (asset.filename || asset.name || '').split('.').pop()?.toUpperCase() || 'FILE';
      const fileIcon = 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="200" height="180">
          <rect fill="#f8f8f8" width="200" height="180" stroke="#ddd"/>
          <rect x="30" y="20" width="140" height="120" fill="#fff" stroke="#ccc"/>
          <text x="50%" y="45%" text-anchor="middle" dy=".3em" fill="#666" font-size="16" font-weight="bold" font-family="monospace">
            ${extension}
          </text>
          <text x="50%" y="65%" text-anchor="middle" dy=".3em" fill="#999" font-size="10" font-family="monospace">
            FILE
          </text>
        </svg>
      `);
      
      mediaTag = `<img src="${fileIcon}" alt="${asset.name || 'File'}" style="width:100%;height:180px;object-fit:contain;background:#f8f8f8;">`;
    }
    
    // Multi-select checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'asset-checkbox';
    checkbox.checked = isSelected;
    checkbox.onclick = (e) => {
      e.stopPropagation();
      toggleAssetSelection(assetId, globalIndex, e);
    };
    
    // Render based on current view
    if (currentView === 'list') {
      div.innerHTML = `
        ${mediaTag}
        <div class="list-view-name">${asset.name || 'Untitled'}</div>
        <div class="list-view-size">${getAssetSize(asset)}</div>
        <div class="list-view-date">${getAssetDate(asset)}</div>
        <div class="list-view-type">${type.toUpperCase()}</div>
      `;
      div.onclick = (e) => handleAssetClick(e, assetId, globalIndex);
    } else {
      // Grid and coverflow views use similar markup
      const contentDiv = document.createElement('div');
      contentDiv.className = 'asset-content';
      contentDiv.innerHTML = `
        ${mediaTag}
        <div class="asset-info">
          <input type="text" class="asset-name-input" value="${asset.name || asset.filename || 'UNTITLED'}" 
                 onchange="updateAssetName('${assetId}', this.value)" onclick="event.stopPropagation()">
          <div class="asset-url" onclick="copyAssetUrl('${assetId}')" title="CLICK TO COPY FULL URL">
            ${asset.url}
          </div>
          <button class="btn btn-danger asset-delete" onclick="deleteAsset('${assetId}')" onclick="event.stopPropagation()">DELETE</button>
        </div>
      `;
      
      div.appendChild(checkbox);
      div.appendChild(contentDiv);
      
      // Event handlers for multi-select and drag
      div.addEventListener('click', (e) => handleAssetClick(e, assetId, globalIndex));
      div.addEventListener('dragstart', (e) => handleAssetDragStart(e, assetId));
      div.addEventListener('dragend', (e) => handleAssetDragEnd(e));
    }
    
    container.appendChild(div);
  });
  
  // Add pagination controls if needed
  addPaginationControls(assetsToShow.length);
}

function addPaginationControls(totalAssets) {
  const totalPages = Math.ceil(totalAssets / assetsPerPage);
  if (totalPages <= 1) return;
  
  const container = document.getElementById('assetsContainer');
  const paginationDiv = document.createElement('div');
  paginationDiv.className = 'pagination-controls';
  paginationDiv.style.cssText = `
    grid-column: 1 / -1;
    display: flex;
    justify-content: center;
    gap: var(--space-sm);
    margin-top: var(--space-lg);
    font-family: var(--font-mono);
    font-size: 0.75rem;
  `;
  
  // Previous button
  if (currentPage > 0) {
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← PREV';
    prevBtn.className = 'btn';
    prevBtn.onclick = () => {
      currentPage--;
      renderAssetsWithView();
    };
    paginationDiv.appendChild(prevBtn);
  }
  
  // Page numbers
  const startPage = Math.max(0, currentPage - 2);
  const endPage = Math.min(totalPages - 1, currentPage + 2);
  
  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.textContent = i + 1;
    pageBtn.className = i === currentPage ? 'btn btn-primary' : 'btn';
    pageBtn.onclick = () => {
      currentPage = i;
      renderAssetsWithView();
    };
    paginationDiv.appendChild(pageBtn);
  }
  
  // Next button
  if (currentPage < totalPages - 1) {
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'NEXT →';
    nextBtn.className = 'btn';
    nextBtn.onclick = () => {
      currentPage++;
      renderAssetsWithView();
    };
    paginationDiv.appendChild(nextBtn);
  }
  
  container.appendChild(paginationDiv);
} 

let dashboardImageLibraryTarget = null;

window.openImageLibrary = function(inputField) {
  dashboardImageLibraryTarget = inputField;
  let modal = document.getElementById('dashboardImageLibraryModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dashboardImageLibraryModal';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.background = 'rgba(0,0,0,0.85)';
    modal.style.zIndex = '9999';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.innerHTML = `
      <div style="background: #fff; padding: 32px; max-width: 900px; width: 90vw; max-height: 80vh; overflow-y: auto; border-radius: 8px; position: relative;">
        <button id="closeDashboardImageLibrary" style="position: absolute; top: 16px; right: 16px; font-size: 2rem; background: none; border: none; cursor: pointer;">&times;</button>
        <h2 style="margin-top:0;">Select Image</h2>
        <div id="dashboardImageLibraryGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 16px;"></div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('closeDashboardImageLibrary').onclick = closeImageLibrary;
  } else {
    modal.style.display = 'flex';
  }
  // Populate images
  const grid = document.getElementById('dashboardImageLibraryGrid');
  grid.innerHTML = '';
  const imageExts = ['.png','.jpg','.jpeg','.gif','.webp','.svg','.tif','.tiff'];
  const allImages = (assets.images || []).filter(a => {
    if (!a.url) return false;
    const url = a.url.toLowerCase();
    return imageExts.some(ext => url.endsWith(ext));
  });
  if (allImages.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:#888;">No images found.</div>';
  } else {
    allImages.forEach(img => {
      const div = document.createElement('div');
      div.style.cursor = 'pointer';
      div.style.border = '1px solid #ccc';
      div.style.padding = '4px';
      div.style.background = '#fafafa';
      div.innerHTML = `<img src="${img.url}" style="width:100%; aspect-ratio:1; object-fit:cover;"><div style="font-size:0.8em; text-align:center; margin-top:4px;">${img.name||''}</div>`;
      div.onclick = () => {
        const input = document.querySelector(`#editCoverForm input[name='${dashboardImageLibraryTarget}']`);
        if (input) {
          input.value = img.url;
        }
        // Update preview image
        const preview = document.getElementById(`${dashboardImageLibraryTarget}Preview`);
        if (preview) {
          preview.src = img.url;
        }
        closeImageLibrary();
      };
      grid.appendChild(div);
    });
  }
};

window.closeImageLibrary = function() {
  const modal = document.getElementById('dashboardImageLibraryModal');
  if (modal) modal.style.display = 'none';
  dashboardImageLibraryTarget = null;
}; 

// Multi-select asset functionality
function toggleAssetSelection(assetId, index, event) {
  if (event.shiftKey && lastSelectedAssetIndex !== -1) {
    // Shift+click: select range
    const start = Math.min(lastSelectedAssetIndex, index);
    const end = Math.max(lastSelectedAssetIndex, index);
    const assetsToShow = filteredAssets.length > 0 || document.getElementById('assetSearch')?.value 
      ? filteredAssets 
      : getCurrentFolderItems().images;
    
    for (let i = start; i <= end; i++) {
      if (i < assetsToShow.length) {
        selectedAssets.add(assetsToShow[i].url);
      }
    }
  } else if (event.ctrlKey || event.metaKey) {
    // Ctrl/Cmd+click: toggle individual selection
    if (selectedAssets.has(assetId)) {
      selectedAssets.delete(assetId);
    } else {
      selectedAssets.add(assetId);
    }
  } else {
    // Regular click: toggle individual selection
    if (selectedAssets.has(assetId)) {
      selectedAssets.delete(assetId);
    } else {
      selectedAssets.add(assetId);
    }
  }
  
  lastSelectedAssetIndex = index;
  renderAssetsWithView();
  updateAssetSelectionCounter();
}

function handleAssetClick(event, assetId, index) {
  if (event.target.type === 'checkbox') return; // Already handled by checkbox
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON') return; // Ignore form elements
  
  if (!assetMultiSelectMode) {
    // Normal mode: copy URL to clipboard
    copyAssetUrl(assetId);
    return;
  }
  
  // Multi-select mode
  toggleAssetSelection(assetId, index, event);
}

function selectAllAssets() {
  const assetsToShow = filteredAssets.length > 0 || document.getElementById('assetSearch')?.value 
    ? filteredAssets 
    : getCurrentFolderItems().images;
  selectedAssets.clear();
  assetsToShow.forEach(asset => selectedAssets.add(asset.url));
  renderAssetsWithView();
  updateAssetSelectionCounter();
  showToast(`${assetsToShow.length} ASSETS SELECTED`);
}

function deselectAllAssets() {
  selectedAssets.clear();
  renderAssetsWithView();
  updateAssetSelectionCounter();
  showToast('ALL ASSETS DESELECTED');
}

// Select all assets in current folder
function selectAllAssetsInFolder() {
  selectedAssets.clear();
  
  // Get all assets in current folder using same logic as renderAssetsWithView
  const assetsToSelect = filteredAssets.length > 0 || document.getElementById('assetSearch')?.value 
    ? filteredAssets 
    : getCurrentFolderItems().images;
  
  // Add them all to selection
  assetsToSelect.forEach(asset => {
    selectedAssets.add(asset.url);
  });
  
  renderAssetsWithView();
  updateAssetSelectionCounter();
  showToast(`${assetsToSelect.length} ASSETS SELECTED IN ${currentFolder || 'ROOT'}`);
}

// Copy links of selected assets
async function copySelectedAssetLinks() {
  console.log('[COPY LINKS] Starting with selectedAssets:', selectedAssets);
  
  if (selectedAssets.size === 0) {
    showToast('NO ASSETS SELECTED');
    return;
  }
  
  // Get all selected asset URLs
  const selectedUrls = Array.from(selectedAssets);
  console.log('[COPY LINKS] Selected URLs:', selectedUrls);
  
  // Create JSON with asset information
  const selectedAssetsData = selectedUrls.map(url => {
    // Find asset in the hierarchical structure
    let foundAsset = null;
    
    // Helper function to search recursively
    const findAssetByUrl = (items) => {
      for (const item of items) {
        if (item.url === url) {
          return item;
        }
        if (item.children) {
          const found = findAssetByUrl(item.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    // Search in root images first
    if (assets.images) {
      foundAsset = assets.images.find(img => img.url === url);
    }
    
    // If not found, search in folders
    if (!foundAsset && assets.children) {
      foundAsset = findAssetByUrl(assets.children);
    }
    
    if (!foundAsset) {
      console.warn('[COPY LINKS] Asset not found for URL:', url);
      // Still include the URL even if we can't find metadata
      return {
        name: url.split('/').pop(), // Get filename from URL
        url: url,
        thumbnailUrl: null,
        type: 'unknown',
        size: null,
        created: null
      };
    }
    
    return {
      name: foundAsset.name,
      url: foundAsset.url,
      thumbnailUrl: foundAsset.thumbnailUrl || null,
      type: foundAsset.type || 'image',
      size: foundAsset.size || null,
      created: foundAsset.created || null
    };
  });
  
  console.log('[COPY LINKS] Asset data prepared:', selectedAssetsData);
  
  // Always download JSON file first
  const jsonData = JSON.stringify(selectedAssetsData, null, 2);
  const blob = new Blob([jsonData], { type: 'application/json' });
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `selected-assets-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(downloadUrl);
  
  // Try to copy to clipboard
  try {
    // Create a formatted text with all URLs
    const linksText = selectedUrls.join('\n');
    
    // Check if we're in a secure context (HTTPS)
    if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(linksText);
      console.log('[COPY LINKS] Successfully copied to clipboard');
      showToast(`${selectedAssets.size} LINKS COPIED TO CLIPBOARD & JSON DOWNLOADED`);
    } else {
      // Fallback: create a temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = linksText;
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.width = '2px';
      textarea.style.height = '2px';
      textarea.style.padding = '0';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.boxShadow = 'none';
      textarea.style.background = 'transparent';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          console.log('[COPY LINKS] Fallback copy successful');
          showToast(`${selectedAssets.size} LINKS COPIED TO CLIPBOARD & JSON DOWNLOADED`);
        } else {
          console.log('[COPY LINKS] Fallback copy failed');
          showToast(`${selectedAssets.size} ASSET LINKS DOWNLOADED AS JSON (Copy to clipboard failed)`);
        }
      } catch (err) {
        console.error('[COPY LINKS] Fallback copy error:', err);
        showToast(`${selectedAssets.size} ASSET LINKS DOWNLOADED AS JSON (Copy to clipboard failed)`);
      }
      
      document.body.removeChild(textarea);
    }
  } catch (err) {
    console.error('[COPY LINKS] Clipboard error:', err);
    showToast(`${selectedAssets.size} ASSET LINKS DOWNLOADED AS JSON (Copy to clipboard failed)`);
  }
}

// Batch operation functions for the toolbar
function moveSelectedAssets() {
  if (selectedAssets.size === 0) {
    showToast('NO ASSETS SELECTED');
    return;
  }
  
  // Create a simple folder picker modal
  const folderNames = [];
  const addFolderNames = (children, prefix = '') => {
    children.forEach(child => {
      if (child.type === 'folder') {
        folderNames.push(prefix + child.name);
        if (child.children) {
          addFolderNames(child.children, prefix + child.name + '/');
        }
      }
    });
  };
  
  if (assets.children) {
    addFolderNames(assets.children);
  }
  
  const folderChoice = prompt('Move to folder:\n- ROOT (leave empty)\n- ' + folderNames.join('\n- '), '');
  if (folderChoice === null) return; // User cancelled
  
  const targetFolder = folderChoice.trim() === '' ? '' : folderChoice.trim();
  moveSelectedAssetsToFolder(targetFolder);
}

function downloadSelectedAssets() {
  if (selectedAssets.size === 0) {
    showToast('NO ASSETS SELECTED');
    return;
  }
  
  // For now, show a message about download functionality
  // This would need backend implementation to create a zip file
  showToast(`DOWNLOAD OF ${selectedAssets.size} ASSETS NOT YET IMPLEMENTED`);
  
  // TODO: Implement actual download functionality
  // Could be:
  // 1. Create a zip file on the server with selected assets
  // 2. Return a download link
  // 3. Trigger download in browser
}

function toggleMultiSelectMode() {
  assetMultiSelectMode = !assetMultiSelectMode;
  document.body.classList.toggle('asset-multi-select-mode', assetMultiSelectMode);
  
  const toggleBtn = document.getElementById('assetMultiSelectToggle');
  const selectAllBtn = document.getElementById('selectAllBtn');
  const deselectAllBtn = document.getElementById('deselectAllBtn');
  
  if (toggleBtn) {
    toggleBtn.textContent = assetMultiSelectMode ? 'EXIT MULTI-SELECT' : 'MULTI-SELECT';
  }
  
  if (selectAllBtn) {
    selectAllBtn.style.display = assetMultiSelectMode ? 'inline-block' : 'none';
  }
  
  if (deselectAllBtn) {
    deselectAllBtn.style.display = assetMultiSelectMode ? 'inline-block' : 'none';
  }
  
  if (!assetMultiSelectMode) {
    selectedAssets.clear();
  }
  
  renderAssetsWithView();
  updateAssetSelectionCounter();
  showToast(assetMultiSelectMode ? 'MULTI-SELECT MODE ENABLED' : 'MULTI-SELECT MODE DISABLED');
}

function updateAssetSelectionCounter() {
  const counter = document.getElementById('assetSelectionCounter');
  const batchToolbar = document.getElementById('assetBatchToolbar');
  const selectedCountSpan = document.getElementById('assetSelectedCount');
  
  const count = selectedAssets.size;
  
  if (counter) {
    counter.textContent = count > 0 ? `${count} SELECTED` : '';
    counter.style.display = count > 0 ? 'block' : 'none';
  }
  
  // Show/hide batch toolbar
  if (batchToolbar) {
    batchToolbar.style.display = count > 0 ? 'flex' : 'none';
  }
  
  // Update selected count in batch toolbar
  if (selectedCountSpan) {
    selectedCountSpan.textContent = count;
  }
}

function copyAssetUrl(assetId) {
  navigator.clipboard.writeText(assetId);
  showToast('URL COPIED TO CLIPBOARD');
}

function deleteSelectedAssets() {
  if (selectedAssets.size === 0) return;
  
  const count = selectedAssets.size;
  if (!confirm(`DELETE ${count} SELECTED ASSET${count > 1 ? 'S' : ''}?`)) return;
  
  showLoading();
  
  // Use bulk delete endpoint
  fetch('/api/assets/bulk-delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assetUrls: Array.from(selectedAssets)
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Update local data structure
      if (assets.images) {
        assets.images = assets.images.filter(a => !selectedAssets.has(a.url));
      }
      
      selectedAssets.clear();
      renderAssetsWithView();
      updateAssetSelectionCounter();
      showToast(`${data.deletedCount} ASSET${data.deletedCount > 1 ? 'S' : ''} DELETED`);
    } else {
      throw new Error(data.error || 'Delete failed');
    }
  })
  .catch(error => {
    console.error('Failed to delete assets:', error);
    showToast('FAILED TO DELETE ASSETS', 5000);
  })
  .finally(() => {
    hideLoading();
  });
}

// Drag and drop functionality for multi-select
function handleAssetDragStart(event, assetId) {
  if (!selectedAssets.has(assetId)) {
    // If dragging an unselected item, select it and clear other selections
    selectedAssets.clear();
    selectedAssets.add(assetId);
    renderAssetsWithView();
  }
  
  draggedAssets = new Set(selectedAssets);
  isDraggingAssets = true;
  
  // Set drag data
  event.dataTransfer.setData('text/plain', Array.from(selectedAssets).join(','));
  event.dataTransfer.effectAllowed = 'move';
  
  // Add visual feedback
  document.body.classList.add('dragging-assets');
  
  // Create drag preview showing count
  const dragPreview = document.createElement('div');
  dragPreview.className = 'drag-preview';
  dragPreview.textContent = `${selectedAssets.size} ASSET${selectedAssets.size > 1 ? 'S' : ''}`;
  dragPreview.style.position = 'absolute';
  dragPreview.style.top = '-1000px';
  document.body.appendChild(dragPreview);
  event.dataTransfer.setDragImage(dragPreview, 0, 0);
  
  setTimeout(() => document.body.removeChild(dragPreview), 0);
}

function handleAssetDragEnd(event) {
  isDraggingAssets = false;
  draggedAssets.clear();
  document.body.classList.remove('dragging-assets');
}

// Keyboard navigation for accessibility
function handleAssetKeydown(event, assetId, index) {
  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault();
      toggleAssetSelection(assetId, index);
      break;
    case 'ArrowRight':
    case 'ArrowDown':
      event.preventDefault();
      focusNextAsset(index, 1);
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
      event.preventDefault();
      focusNextAsset(index, -1);
      break;
    case 'Escape':
      if (selectedAssets.size > 0) {
        event.preventDefault();
        deselectAllAssets();
      }
      break;
  }
}

function focusNextAsset(currentIndex, direction) {
  const assets = document.querySelectorAll('.asset-item[tabindex="0"]');
  const currentAsset = Array.from(assets).find(asset => 
    parseInt(asset.dataset.assetIndex) === currentIndex
  );
  
  if (currentAsset) {
    const currentAssetIndex = Array.from(assets).indexOf(currentAsset);
    const nextIndex = currentAssetIndex + direction;
    
    if (nextIndex >= 0 && nextIndex < assets.length) {
      assets[nextIndex].focus();
    }
  }
}

// Asset bulk operations
async function moveSelectedAssetsToFolder(targetFolder) {
  if (selectedAssets.size === 0) {
    showToast('NO ASSETS SELECTED');
    return;
  }
  
  showLoading();
  
  try {
    const assetUrls = Array.from(selectedAssets);
    const response = await fetch('/api/assets/bulk-move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetUrls,
        targetFolder: targetFolder || ''
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Update local data structure
      const assetsToShow = filteredAssets.length > 0 || document.getElementById('assetSearch')?.value 
        ? filteredAssets 
        : getCurrentFolderItems().images;
      const movedAssets = assetsToShow.filter(a => selectedAssets.has(a.url));
      
      // Remove from current location
      if (assets.images) {
        assets.images = assets.images.filter(a => !selectedAssets.has(a.url));
      }
      
      selectedAssets.clear();
      renderAssetsWithView();
      renderFolders();
      updateAssetSelectionCounter();
      
      showToast(`${assetUrls.length} ASSETS MOVED TO ${targetFolder || 'ROOT'}`);
    } else {
      throw new Error('Move operation failed');
    }
  } catch (error) {
    console.error('Failed to move assets:', error);
    showToast('FAILED TO MOVE ASSETS', 5000);
  } finally {
    hideLoading();
  }
}

// Enhanced search and filtering functions
function getFilteredAndSortedCovers() {
  let filtered = covers.filter(cover => {
    // Search filter
    if (searchTerm) {
      const searchFields = [
        cover.albumTitle || '',
        cover.coverLabel || '',
        cover.artistDetails?.name || '',
        ...(Array.isArray(cover.category) ? cover.category : [cover.category || ''])
      ].join(' ').toLowerCase();
      
      if (!searchFields.includes(searchTerm)) {
        return false;
      }
    }
    
    // Category filter
    if (categoryFilter) {
      const categories = Array.isArray(cover.category) ? cover.category : [cover.category || ''];
      if (!categories.includes(categoryFilter)) {
        return false;
      }
    }
    
    return true;
  });
  
  // Sort
  filtered.sort((a, b) => {
    switch (sortOrder) {
      case 'title':
        return (a.albumTitle || '').localeCompare(b.albumTitle || '');
      case 'title-desc':
        return (b.albumTitle || '').localeCompare(a.albumTitle || '');
      case 'date':
        return new Date(b.id) - new Date(a.id); // Newer first (higher ID)
      case 'date-desc':
        return new Date(a.id) - new Date(b.id); // Older first (lower ID)
      default: // 'index'
        return (a.index || 0) - (b.index || 0);
    }
  });
  
  return filtered;
}

function getRecentCovers() {
  // Get the 6-8 most recently edited covers (based on ID as timestamp)
  return [...covers]
    .sort((a, b) => new Date(b.id) - new Date(a.id))
    .slice(0, 8);
}

function renderRecentCovers() {
  const container = document.getElementById('recentCoversContainer');
  if (!container) return;
  
  const recent = getRecentCovers();
  
  container.innerHTML = recent.map(cover => createCompactCoverElement(cover)).join('');
}

function createCompactCoverElement(cover) {
  return `
    <div class="cover-item-compact" data-id="${cover.id}" onclick="editCover(${JSON.stringify(cover).replace(/"/g, '&quot;')})">
      <img src="${cover.frontImage || '/placeholder.jpg'}" 
           alt="${cover.albumTitle || 'Untitled'}" 
           class="cover-image"
           loading="lazy">
      <div class="cover-meta-compact">
        <div>${(cover.albumTitle || 'UNTITLED').slice(0, 20)}</div>
      </div>
    </div>
  `;
}

// View mode functions
function setViewMode(mode) {
  currentViewMode = mode;
  
  // Update view toggle buttons
  document.querySelectorAll('.view-toggle').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === mode);
  });
  
  renderCurrentView();
}

function renderCurrentView() {
  const filtered = getFilteredAndSortedCovers();
  
  // Update pagination
  updatePagination(filtered.length);
  
  // Get current page items
  const start = (currentCoverPage - 1) * coversPerPage;
  const end = start + coversPerPage;
  const pageCovers = filtered.slice(start, end);
  
  const container = document.getElementById('coversContainer');
  
  switch (currentViewMode) {
    case 'list':
      renderListView(pageCovers, container);
      break;
    case 'coverflow':
      renderCoverflowView(pageCovers, container);
      break;
    default: // 'grid'
      renderGridView(pageCovers, container);
      break;
  }
}

function renderGridView(pageCovers, container) {
  container.className = 'covers-grid';
  container.innerHTML = pageCovers.map((cover, index) => createCoverElement(cover, index)).join('');
}

function renderListView(pageCovers, container) {
  container.className = 'covers-list';
  container.innerHTML = pageCovers.map(cover => createListCoverElement(cover)).join('');
}

function renderCoverflowView(pageCovers, container) {
  container.className = 'covers-coverflow';
  container.innerHTML = pageCovers.map(cover => createCoverflowCoverElement(cover)).join('');
  
  // Setup coverflow navigation
  setupCoverflowNavigation();
}

function createListCoverElement(cover) {
  const isSelected = selectedCovers.has(cover.id);
  const rotation = 0;
  
  return `
    <div class="cover-item-list ${isSelected ? 'selected' : ''}" 
         data-id="${cover.id}" 
         data-cover-id="${cover.id}"
         onclick="handleCoverClick('${cover.id}')"
         style="transform: rotate(${rotation}deg)">
      ${batchMode ? `<input type="checkbox" class="cover-checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleCoverSelection('${cover.id}')">` : ''}
      <img src="${cover.frontImage || '/placeholder.jpg'}" 
           alt="${cover.albumTitle || 'Untitled'}" 
           class="cover-image"
           loading="lazy">
      <div class="cover-meta-list">
        <div class="cover-title">${cover.albumTitle || 'UNTITLED'}</div>
        <div class="cover-artist">${cover.artistDetails?.name || cover.coverLabel || 'UNKNOWN ARTIST'}</div>
        <div class="cover-category">${Array.isArray(cover.category) ? cover.category.join(', ') : (cover.category || 'No category')}</div>
      </div>
    </div>
  `;
}

function createCoverflowCoverElement(cover) {
  const isSelected = selectedCovers.has(cover.id);
  
  return `
    <div class="cover-item-coverflow ${isSelected ? 'selected' : ''}" 
         data-id="${cover.id}" 
         data-cover-id="${cover.id}"
         onclick="handleCoverClick('${cover.id}')">
      ${batchMode ? `<input type="checkbox" class="cover-checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleCoverSelection('${cover.id}')">` : ''}
      <img src="${cover.frontImage || '/placeholder.jpg'}" 
           alt="${cover.albumTitle || 'Untitled'}" 
           class="cover-image"
           loading="lazy">
      <div class="cover-meta-coverflow">
        <div>${cover.albumTitle || 'UNTITLED'}</div>
      </div>
    </div>
  `;
}

function setupCoverflowNavigation() {
  const container = document.getElementById('coversContainer');
  const items = container.querySelectorAll('.cover-item-coverflow');
  let focusedIndex = 0;
  
  function updateFocus(index) {
    items.forEach((item, i) => {
      item.classList.toggle('focused', i === index);
    });
    
    // Scroll focused item into view
    if (items[index]) {
      items[index].scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest',
        inline: 'center'
      });
    }
  }
  
  container.addEventListener('click', (e) => {
    const item = e.target.closest('.cover-item-coverflow');
    if (item) {
      const index = Array.from(items).indexOf(item);
      focusedIndex = index;
      updateFocus(index);
    }
  });
  
  // Initialize with first item focused
  if (items.length > 0) {
    updateFocus(0);
  }
}

function handleCoverClick(coverId) {
  if (batchMode) {
    toggleCoverSelection(coverId);
  } else {
    const cover = covers.find(c => c.id === coverId);
    if (cover) {
      editCover(cover);
    }
  }
}

function updatePagination(totalItems) {
  const totalPages = Math.ceil(totalItems / coversPerPage);
  const controls = document.getElementById('paginationControls');
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  
  if (!controls) return;
  
  if (totalPages <= 1) {
    controls.style.display = 'none';
    return;
  }
  
  controls.style.display = 'flex';
  if (pageInfo) pageInfo.textContent = `${currentCoverPage} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentCoverPage <= 1;
  if (nextBtn) nextBtn.disabled = currentCoverPage >= totalPages;
}

function changePage(direction) {
  const filtered = getFilteredAndSortedCovers();
  const totalPages = Math.ceil(filtered.length / coversPerPage);
  
  currentCoverPage = Math.max(1, Math.min(totalPages, currentCoverPage + direction));
  renderCurrentView();
}

// Enhanced search functionality
function setupSearchAndFilters() {
  // Cover search
  const searchInput = document.getElementById('coverSearch');
  if (searchInput) {
    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchTerm = e.target.value.toLowerCase();
        currentCoverPage = 1; // Reset to first page
        renderCurrentView();
      }, 300);
    });
  }
  
  // Category filter
  const categorySelect = document.getElementById('categoryFilter');
  if (categorySelect) {
    categorySelect.addEventListener('change', (e) => {
      categoryFilter = e.target.value;
      currentCoverPage = 1; // Reset to first page
      renderCurrentView();
    });
  }
  
  // Sort order
  const sortSelect = document.getElementById('sortOrder');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      sortOrder = e.target.value;
      renderCurrentView();
    });
  }
}

// View mode toggle setup
function setupViewModeToggles() {
  document.querySelectorAll('.view-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      setViewMode(btn.dataset.view);
    });
  });
}

// Enhanced keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + F to focus search
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      const globalSearch = document.getElementById('globalSearch');
      if (globalSearch) {
        globalSearch.focus();
        globalSearch.select();
      } else {
      const searchInput = document.getElementById('coverSearch');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    }
    
    // Global search functionality
    // Add any additional global search functionality you want to implement
  });
}

function selectAllCovers() {
  const filtered = getFilteredAndSortedCovers();
  filtered.forEach(cover => selectedCovers.add(cover.id));
  renderCurrentView();
  updateBatchCount();
}

function clearSelection() {
  selectedCovers.clear();
  renderCurrentView();
  updateBatchCount();
}

// Enhanced batch operations
function updateBatchCount() {
  const count = selectedCovers.size;
  const batchCount = document.querySelector('.batch-count');
  if (batchCount) {
    batchCount.textContent = `${count} selected`;
  }
  
  // Update batch toolbar visibility
  const batchToolbar = document.querySelector('.batch-toolbar');
  if (batchToolbar) {
    batchToolbar.style.display = count > 0 ? 'flex' : 'none';
  }
}

// Expose global functions for compatibility
window.clearSelection = clearSelection;
window.changePage = changePage;
window.setViewMode = setViewMode;
window.handleCoverClick = handleCoverClick;

// Onboarding and help system
function showOnboardingTips() {
  const hasSeenTips = localStorage.getItem('amf-admin-tips-seen');
  if (hasSeenTips) return;
  
  setTimeout(() => {
    showHelpTip('batch-mode', 'Try using batch mode to select and manage multiple covers at once! Press Ctrl+B or click the BATCH MODE button.', 3000);
    
    setTimeout(() => {
      showHelpTip('search', 'Use Ctrl+F to quickly search through your covers. You can search by title, artist, or category.', 3000);
      
      setTimeout(() => {
        showHelpTip('assets', 'NEW: Select assets to see the batch toolbar at the bottom! You can move, delete, or download multiple assets at once.', 4000);
        
        setTimeout(() => {
          showHelpTip('audio', 'NEW: Check out the Audio section! Upload, play, and manage audio files with the same powerful tools.', 4000);
          
          setTimeout(() => {
            showHelpTip('keyboard', 'Keyboard shortcuts: Ctrl+F (search), Ctrl+B (batch), Ctrl+M (multi-select), ESC (exit modes), Arrow keys (navigate)', 4000);
            localStorage.setItem('amf-admin-tips-seen', 'true');
          }, 4500);
        }, 4000);
      }, 3500);
    }, 3500);
  }, 2000);
}

function showHelpTip(anchor, message, duration = 3000) {
  const tip = document.createElement('div');
  tip.className = 'help-tip';
  tip.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: #333;
    color: white;
    padding: var(--space-md);
    border-radius: 8px;
    max-width: 300px;
    z-index: 9999;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideInRight 0.3s ease-out;
  `;
  
  tip.innerHTML = `
    <div style="margin-bottom: 8px;">${message}</div>
    <button onclick="this.parentNode.remove()" style="background: none; border: 1px solid white; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">GOT IT</button>
  `;
  
  document.body.appendChild(tip);
  
  setTimeout(() => {
    if (tip.parentNode) {
      tip.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => tip.remove(), 300);
    }
  }, duration);
}

// Help button and overlay
function createHelpButton() {
  const helpBtn = document.createElement('button');
  helpBtn.innerHTML = '?';
  helpBtn.className = 'help-button';
  helpBtn.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--ink);
    color: var(--bg);
    border: none;
    font-size: 18px;
    font-weight: bold;
    cursor: pointer;
    z-index: 999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;
  
  helpBtn.onclick = showHelpOverlay;
  document.body.appendChild(helpBtn);
}

function showHelpOverlay() {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;
  
  const helpContent = document.createElement('div');
  helpContent.style.cssText = `
    background: var(--bg);
    border: 1px solid var(--ink);
    padding: var(--space-xl);
    border-radius: 8px;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
  `;
  
  helpContent.innerHTML = `
    <h2 style="margin-top: 0;">Admin Dashboard Help</h2>
    
    <h3>Keyboard Shortcuts</h3>
    <ul>
      <li><kbd>Ctrl/Cmd + F</kbd> - Focus search box</li>
      <li><kbd>Ctrl/Cmd + B</kbd> - Toggle batch mode</li>
      <li><kbd>Ctrl/Cmd + M</kbd> - Toggle multi-select for assets</li>
      <li><kbd>Ctrl/Cmd + A</kbd> - Select all (covers or assets)</li>
      <li><kbd>Escape</kbd> - Exit batch mode or deselect all</li>
      <li><kbd>Ctrl/Cmd + ←/→</kbd> - Navigate pages</li>
      <li><kbd>Delete</kbd> - Delete selected assets</li>
    </ul>
    
    <h3>Cover Management</h3>
    <ul>
      <li>Click any cover to edit its details</li>
      <li>Use batch mode to select multiple covers for bulk operations</li>
      <li>Drag and drop to reorder covers</li>
      <li>Use different view modes: grid, list, or coverflow</li>
    </ul>
    
    <h3>Asset Management</h3>
    <ul>
      <li>Drag and drop files to upload</li>
      <li>Use folders to organize your assets</li>
      <li>Multi-select mode for bulk operations</li>
      <li>Copy asset URLs for use in covers</li>
      <li><strong>NEW:</strong> Batch toolbar appears when assets are selected</li>
      <li><strong>NEW:</strong> Move selected assets between folders</li>
      <li><strong>NEW:</strong> Drag assets directly to folders in the tree</li>
      <li><strong>NEW:</strong> Use arrow keys to navigate between assets</li>
    </ul>
    
    <h3>Audio Management</h3>
    <ul>
      <li><strong>NEW:</strong> Dedicated audio section with playback controls</li>
      <li>Upload and organize audio files in folders</li>
      <li>Edit metadata (filename) for audio files</li>
      <li>Batch operations: move, delete, download audio files</li>
      <li>Click to copy audio URLs</li>
    </ul>
    
    <h3>Tips</h3>
    <ul>
      <li>Images are lazy-loaded for better performance</li>
      <li>Use the search and filter options to find content quickly</li>
      <li>Regular saves are recommended to prevent data loss</li>
      <li>The system auto-saves when you make changes</li>
    </ul>
    
    <div style="text-align: center; margin-top: var(--space-lg);">
      <button class="btn" onclick="this.closest('.fixed').remove()">CLOSE</button>
    </div>
  `;
  
  overlay.appendChild(helpContent);
  overlay.className = 'fixed';
  document.body.appendChild(overlay);
  
  // Close on background click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
  
  // Close on ESC
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', escHandler);
      overlay.remove();
    }
  });
}

// ===== AUDIO MANAGEMENT FUNCTIONS =====

// Audio file management
function loadAudioFiles() {
  // For now, load audio files from the assets.json
  // In the future, this could be a separate endpoint
  fetch('/data/assets.json')
    .then(res => res.json())
    .then(data => {
      // Filter for audio files
      audioFiles = (data.images || []).filter(asset => 
        asset.url && (
          asset.url.includes('.mp3') || 
          asset.url.includes('.wav') || 
          asset.url.includes('.m4a') || 
          asset.url.includes('.ogg') ||
          asset.url.includes('.aac')
        )
      );
      renderAudioFiles();
    })
    .catch(err => {
      console.error('Failed to load audio files:', err);
      showToast('FAILED TO LOAD AUDIO FILES', 'error');
    });
}

function renderAudioFiles() {
  const container = document.getElementById('audioContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  audioFiles.forEach((audio, index) => {
    const audioDiv = document.createElement('div');
    audioDiv.className = `audio-item ${selectedAudioFiles.has(audio.url) ? 'selected' : ''}`;
    audioDiv.dataset.audioId = audio.url;
    
    audioDiv.innerHTML = `
      <div class="audio-item-content">
        <input type="checkbox" class="audio-checkbox" ${selectedAudioFiles.has(audio.url) ? 'checked' : ''} 
               onchange="toggleAudioSelection('${audio.url}')">
        <div class="audio-player">
          <audio controls style="width: 100%;">
            <source src="${audio.url}" type="audio/mpeg">
            Your browser does not support the audio element.
          </audio>
        </div>
        <div class="audio-info">
          <input type="text" class="audio-filename" value="${audio.filename || 'audio-file'}" 
                 onchange="updateAudioMetadata('${audio.url}', 'filename', this.value)">
          <div class="audio-url" onclick="copyAudioUrl('${audio.url}')" title="Click to copy URL">
            ${audio.url}
          </div>
          <button class="btn btn-danger btn-sm" onclick="deleteAudioFile('${audio.url}')">DELETE</button>
        </div>
      </div>
    `;
    
    container.appendChild(audioDiv);
  });
  
  updateAudioSelectionCounter();
}

function toggleAudioSelection(audioUrl) {
  if (selectedAudioFiles.has(audioUrl)) {
    selectedAudioFiles.delete(audioUrl);
  } else {
    selectedAudioFiles.add(audioUrl);
  }
  renderAudioFiles();
}

function updateAudioSelectionCounter() {
  const batchToolbar = document.getElementById('audioBatchToolbar');
  const selectedCountSpan = document.getElementById('audioSelectedCount');
  
  const count = selectedAudioFiles.size;
  
  // Show/hide batch toolbar
  if (batchToolbar) {
    batchToolbar.style.display = count > 0 ? 'flex' : 'none';
  }
  
  // Update selected count in batch toolbar
  if (selectedCountSpan) {
    selectedCountSpan.textContent = count;
  }
}

function copyAudioUrl(url) {
  navigator.clipboard.writeText(url);
  showToast('AUDIO URL COPIED TO CLIPBOARD');
}

function deleteAudioFile(url) {
  if (!confirm('DELETE THIS AUDIO FILE?')) return;
  
  // Call the same delete endpoint as for other assets
  fetch('/api/assets/bulk-delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetUrls: [url] })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      audioFiles = audioFiles.filter(audio => audio.url !== url);
      selectedAudioFiles.delete(url);
      renderAudioFiles();
      showToast('AUDIO FILE DELETED');
    } else {
      showToast('FAILED TO DELETE AUDIO FILE', 'error');
    }
  })
  .catch(err => {
    console.error('Delete failed:', err);
    showToast('DELETE FAILED', 'error');
  });
}

function updateAudioMetadata(url, field, value) {
  // Update the metadata for the audio file
  const audio = audioFiles.find(a => a.url === url);
  if (audio) {
    audio[field] = value;
    // You could add a save endpoint here to persist metadata changes
    showToast('AUDIO METADATA UPDATED');
  }
}

// Audio batch operations
function moveSelectedAudio() {
  if (selectedAudioFiles.size === 0) {
    showToast('NO AUDIO FILES SELECTED');
    return;
  }
  showToast('AUDIO MOVE FUNCTIONALITY NOT YET IMPLEMENTED');
}

function downloadSelectedAudio() {
  if (selectedAudioFiles.size === 0) {
    showToast('NO AUDIO FILES SELECTED');
    return;
  }
  showToast(`DOWNLOAD OF ${selectedAudioFiles.size} AUDIO FILES NOT YET IMPLEMENTED`);
}

function deleteSelectedAudio() {
  if (selectedAudioFiles.size === 0) return;
  
  const count = selectedAudioFiles.size;
  if (!confirm(`DELETE ${count} SELECTED AUDIO FILE${count > 1 ? 'S' : ''}?`)) return;
  
  showLoading();
  
  fetch('/api/assets/bulk-delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetUrls: Array.from(selectedAudioFiles) })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      audioFiles = audioFiles.filter(audio => !selectedAudioFiles.has(audio.url));
      selectedAudioFiles.clear();
      renderAudioFiles();
      showToast(`${count} AUDIO FILE${count > 1 ? 'S' : ''} DELETED`);
    } else {
      showToast('FAILED TO DELETE AUDIO FILES', 'error');
    }
    hideLoading();
  })
  .catch(err => {
    console.error('Bulk delete failed:', err);
    showToast('DELETE FAILED', 'error');
    hideLoading();
  });
}

function deselectAllAudio() {
  selectedAudioFiles.clear();
  renderAudioFiles();
  showToast('ALL AUDIO FILES DESELECTED');
}

function createNewAudioFolder() {
  const name = prompt('ENTER AUDIO FOLDER NAME:');
  if (!name) return;
  
  // Implementation would go here - creating folder in audio structure
  showToast('AUDIO FOLDER CREATED: ' + name.toUpperCase());
}

// Global Search Functionality
function setupGlobalSearch() {
  const globalSearchInput = document.getElementById('globalSearch');
  const globalSearchResults = document.getElementById('globalSearchResults');
  
  if (!globalSearchInput || !globalSearchResults) return;
  
  let searchTimeout;
  
  globalSearchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length === 0) {
      globalSearchResults.style.display = 'none';
      return;
    }
    
    // Debounce search for performance
    searchTimeout = setTimeout(() => {
      performGlobalSearch(query);
    }, 300);
  });
  
  // Hide results when clicking outside
  document.addEventListener('click', (e) => {
    if (!globalSearchInput.contains(e.target) && !globalSearchResults.contains(e.target)) {
      globalSearchResults.style.display = 'none';
    }
  });
  
  // Show results when focusing on search input with content
  globalSearchInput.addEventListener('focus', () => {
    if (globalSearchInput.value.trim().length > 0) {
      globalSearchResults.style.display = 'block';
    }
  });
}

function performGlobalSearch(query) {
  const searchQuery = query.toLowerCase();
  const results = {
    covers: searchCovers(searchQuery),
    assets: searchAssets(searchQuery),
    audio: searchAudio(searchQuery)
  };
  
  displayGlobalSearchResults(results, query);
}

function searchCovers(query) {
  if (!covers || !Array.isArray(covers)) return [];
  
  return covers.filter(cover => 
    (cover.title && cover.title.toLowerCase().includes(query)) ||
    (cover.artist && cover.artist.toLowerCase().includes(query)) ||
    (cover.categories && cover.categories.some(cat => cat.toLowerCase().includes(query))) ||
    (cover.description && cover.description.toLowerCase().includes(query))
  ).slice(0, 5); // Limit to 5 results per section
}

function searchAssets(query) {
  if (!assets) return [];
  
  const assetResults = [];
  
  // Search in root images
  if (assets.images) {
    assets.images.forEach(asset => {
      if ((asset.name && asset.name.toLowerCase().includes(query)) ||
          (asset.filename && asset.filename.toLowerCase().includes(query)) ||
          (asset.url && asset.url.toLowerCase().includes(query))) {
        assetResults.push({
          ...asset,
          folder: 'Root'
        });
      }
    });
  }
  
  // Search in folder hierarchies
  if (assets.children) {
    searchInAssetFolders(assets.children, query, assetResults, []);
  }
  
  return assetResults.slice(0, 5);
}

function searchInAssetFolders(children, query, results, pathArray) {
  children.forEach(child => {
    if (child.type === 'folder') {
      const currentPath = [...pathArray, child.name];
      if (child.children) {
        searchInAssetFolders(child.children, query, results, currentPath);
      }
    } else if (child.type === 'image') {
      if ((child.name && child.name.toLowerCase().includes(query)) ||
          (child.filename && child.filename.toLowerCase().includes(query)) ||
          (child.url && child.url.toLowerCase().includes(query))) {
        results.push({
          ...child,
          folder: pathArray.join('/') || 'Root'
        });
      }
    }
  });
}

function searchAudio(query) {
  // Placeholder for audio search - implement based on your audio data structure
  // This would search through audio files similar to assets
  return [];
}

function displayGlobalSearchResults(results, query) {
  const globalSearchResults = document.getElementById('globalSearchResults');
  if (!globalSearchResults) return;
  
  const totalResults = results.covers.length + results.assets.length + results.audio.length;
  
  if (totalResults === 0) {
    globalSearchResults.innerHTML = `
      <div class="global-search-no-results">
        NO RESULTS FOR "${query.toUpperCase()}"
      </div>
    `;
    globalSearchResults.style.display = 'block';
    return;
  }
  
  let html = '';
  
  // Covers section
  if (results.covers.length > 0) {
    html += `
      <div class="global-search-result-section">
        <div class="global-search-section-header">COVERS (${results.covers.length})</div>
        ${results.covers.map(cover => `
          <div class="global-search-result-item" onclick="navigateToSection('covers', '${cover.id}')">
            <div class="global-search-result-title">${cover.title || 'Untitled'}</div>
            <div class="global-search-result-meta">
              ${cover.artist || 'Unknown Artist'} • ${cover.categories ? cover.categories.join(', ') : 'No Category'}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  // Assets section
  if (results.assets.length > 0) {
    html += `
      <div class="global-search-result-section">
        <div class="global-search-section-header">ASSETS (${results.assets.length})</div>
        ${results.assets.map(asset => `
          <div class="global-search-result-item" onclick="navigateToSection('assets', '${asset.url}')">
            <div class="global-search-result-title">${asset.name || asset.filename || 'Unnamed Asset'}</div>
            <div class="global-search-result-meta">
              ${asset.folder} • ${getAssetDate(asset)}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  // Audio section
  if (results.audio.length > 0) {
    html += `
      <div class="global-search-result-section">
        <div class="global-search-section-header">AUDIO (${results.audio.length})</div>
        ${results.audio.map(audio => `
          <div class="global-search-result-item" onclick="navigateToSection('audio', '${audio.url}')">
            <div class="global-search-result-title">${audio.name || 'Unnamed Audio'}</div>
            <div class="global-search-result-meta">Audio File</div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  globalSearchResults.innerHTML = html;
  globalSearchResults.style.display = 'block';
}

function navigateToSection(section, itemId) {
  // Hide search results
  const globalSearchResults = document.getElementById('globalSearchResults');
  if (globalSearchResults) {
    globalSearchResults.style.display = 'none';
  }
  
  // Clear search input
  const globalSearchInput = document.getElementById('globalSearch');
  if (globalSearchInput) {
    globalSearchInput.value = '';
  }
  
  // Navigate to the appropriate section
  switch (section) {
    case 'covers':
      document.getElementById('coversSection').scrollIntoView({ behavior: 'smooth' });
      // Highlight the specific cover if needed
      setTimeout(() => {
        const coverElement = document.querySelector(`[data-cover-id="${itemId}"]`);
        if (coverElement) {
          coverElement.style.outline = '2px solid var(--accent)';
          setTimeout(() => {
            coverElement.style.outline = '';
          }, 3000);
        }
      }, 500);
      break;
      
    case 'assets':
      document.getElementById('assetsSection').scrollIntoView({ behavior: 'smooth' });
      // You could implement highlighting the specific asset
      break;
      
    case 'audio':
      document.getElementById('audioSection').scrollIntoView({ behavior: 'smooth' });
      break;
  }
  
  showToast(`NAVIGATED TO ${section.toUpperCase()}`);
}

// Make functions globally available
// Note: init() is already called on DOMContentLoaded above

// Enhanced Asset Search and Filtering
let assetViewMode = 'grid';
let assetSearchTerm = '';
let assetTypeFilter = '';
let assetSortOrder = 'date-desc'; // Default to newest first
let assetFolderFilter = '';

function setupEnhancedAssetSearch() {
  // Asset search input
  const assetSearchInput = document.getElementById('assetSearch');
  if (assetSearchInput) {
    let searchTimeout;
    assetSearchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        assetSearchTerm = e.target.value.toLowerCase();
        filterAndRenderAssets();
      }, 300);
    });
  }
  
  // Asset type filter
  const assetTypeFilterSelect = document.getElementById('assetTypeFilter');
  if (assetTypeFilterSelect) {
    assetTypeFilterSelect.addEventListener('change', (e) => {
      assetTypeFilter = e.target.value;
      filterAndRenderAssets();
    });
  }
  
  // Asset sort order
  const assetSortOrderSelect = document.getElementById('assetSortOrder');
  if (assetSortOrderSelect) {
    assetSortOrderSelect.addEventListener('change', (e) => {
      assetSortOrder = e.target.value;
      filterAndRenderAssets();
    });
  }
  
  // Asset folder filter
  const assetFolderFilterSelect = document.getElementById('assetFolderFilter');
  if (assetFolderFilterSelect) {
    assetFolderFilterSelect.addEventListener('change', (e) => {
      assetFolderFilter = e.target.value;
      filterAndRenderAssets();
    });
  }
  
  // Populate folder filter options
  populateAssetFolderFilter();
}

function populateAssetFolderFilter() {
  const select = document.getElementById('assetFolderFilter');
  if (!select || !assets) return;
  
  const folders = ['All Folders'];
  
  // Add root folder
  folders.push('Root');
  
  // Collect all folder names recursively
  function collectFolders(children, path = '') {
    if (!children) return;
    
    children.forEach(child => {
      if (child.type === 'folder') {
        const folderPath = path ? `${path}/${child.name}` : child.name;
        folders.push(folderPath);
        if (child.children) {
          collectFolders(child.children, folderPath);
        }
      }
    });
  }
  
  if (assets.children) {
    collectFolders(assets.children);
  }
  
  // Update select options
  select.innerHTML = folders.map((folder, index) => 
    `<option value="${index === 0 ? '' : folder.toLowerCase()}">${folder.toUpperCase()}</option>`
  ).join('');
}

function setAssetViewMode(mode) {
  assetViewMode = mode;
  
  // Update active button
  document.querySelectorAll('.view-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === mode);
  });
  
  // Re-render assets with new view mode
  renderAssetsWithViewMode();
  showToast(`ASSET VIEW: ${mode.toUpperCase()}`);
}

function renderAssetsWithViewMode() {
  const container = document.getElementById('assetsContainer');
  if (!container) return;
  
  // Apply view mode class
  container.className = `asset-grid asset-view-${assetViewMode}`;
  
  // Re-render current assets
  filterAndRenderAssets();
}

function toggleAssetMultiSelectMode() {
  const toggleText = document.getElementById('assetMultiSelectToggleText');
  if (!toggleText) return;
  
  assetMultiSelectMode = !assetMultiSelectMode;
  toggleText.textContent = assetMultiSelectMode ? 'EXIT MULTI-SELECT' : 'MULTI-SELECT';
  
  const container = document.getElementById('assetsContainer');
  if (container) {
    container.classList.toggle('asset-multi-select-mode', assetMultiSelectMode);
  }
  
  if (!assetMultiSelectMode) {
    deselectAllAssets();
  }
  
  showToast(assetMultiSelectMode ? 'MULTI-SELECT MODE ENABLED' : 'MULTI-SELECT MODE DISABLED');
}

function refreshAssets() {
  showLoading();
  loadAssets().then(() => {
    filterAndRenderAssets();
    populateAssetFolderFilter();
    hideLoading();
    showToast('ASSETS REFRESHED');
  });
}

function getFilteredAssets() {
  let allAssets = [];
  
  // Collect all assets from root and folders
  if (assets.images) {
    allAssets = allAssets.concat(assets.images.map(asset => ({
      ...asset,
      folder: 'root',
      folderDisplay: 'Root'
    })));
  }
  
  function collectFromFolders(children, pathArray = []) {
    if (!children) return;
    
    children.forEach(child => {
      if (child.type === 'folder') {
        const currentPath = [...pathArray, child.name];
        if (child.children) {
          collectFromFolders(child.children, currentPath);
        }
      } else if (child.type === 'image') {
        allAssets.push({
          ...child,
          folder: pathArray.join('/').toLowerCase(),
          folderDisplay: pathArray.join('/') || 'Root'
        });
      }
    });
  }
  
  if (assets.children) {
    collectFromFolders(assets.children);
  }
  
  // Apply filters
  let filteredAssets = allAssets;
  
  // Search filter
  if (assetSearchTerm) {
    filteredAssets = filteredAssets.filter(asset => 
      (asset.name && asset.name.toLowerCase().includes(assetSearchTerm)) ||
      (asset.filename && asset.filename.toLowerCase().includes(assetSearchTerm)) ||
      (asset.url && asset.url.toLowerCase().includes(assetSearchTerm)) ||
      (asset.folderDisplay && asset.folderDisplay.toLowerCase().includes(assetSearchTerm))
    );
  }
  
  // Type filter
  if (assetTypeFilter) {
    filteredAssets = filteredAssets.filter(asset => {
      const assetType = getAssetType(asset);
      return assetType === assetTypeFilter;
    });
  }
  
  // Folder filter
  if (assetFolderFilter) {
    if (assetFolderFilter === 'root') {
      filteredAssets = filteredAssets.filter(asset => asset.folder === 'root');
    } else {
      filteredAssets = filteredAssets.filter(asset => 
        asset.folder.includes(assetFolderFilter)
      );
    }
  }
  
  // Sort assets
  filteredAssets.sort((a, b) => {
    switch (assetSortOrder) {
      case 'date-desc':
        return new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0);
      case 'date-asc':
        return new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0);
      case 'name-asc':
        return (a.name || a.filename || '').localeCompare(b.name || b.filename || '');
      case 'name-desc':
        return (b.name || b.filename || '').localeCompare(a.name || a.filename || '');
      case 'size-desc':
        return (b.size || 0) - (a.size || 0);
      case 'size-asc':
        return (a.size || 0) - (b.size || 0);
      default:
        return 0;
    }
  });
  
  return filteredAssets;
}

function updateAssetCountIndicator(count) {
  const indicator = document.getElementById('assetCountIndicator');
  if (indicator) {
    indicator.textContent = `${count} ASSET${count !== 1 ? 'S' : ''}`;
  }
}

// Enhanced Audio Search and Filtering
let audioViewMode = 'list';
let audioSearchTerm = '';
let audioTypeFilter = '';
let audioSortOrder = 'date-desc'; // Default to newest first
let audioFolderFilter = '';
let audioMultiSelectMode = false;
let filteredAudioFiles = [];

function setupEnhancedAudioSearch() {
  // Audio search input
  const audioSearchInput = document.getElementById('audioSearch');
  if (audioSearchInput) {
    let searchTimeout;
    audioSearchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        audioSearchTerm = e.target.value.toLowerCase();
        filterAndRenderAudio();
      }, 300);
    });
  }
  
  // Audio type filter
  const audioTypeFilterSelect = document.getElementById('audioTypeFilter');
  if (audioTypeFilterSelect) {
    audioTypeFilterSelect.addEventListener('change', (e) => {
      audioTypeFilter = e.target.value;
      filterAndRenderAudio();
    });
  }
  
  // Audio sort order
  const audioSortOrderSelect = document.getElementById('audioSortOrder');
  if (audioSortOrderSelect) {
    audioSortOrderSelect.addEventListener('change', (e) => {
      audioSortOrder = e.target.value;
      filterAndRenderAudio();
    });
  }
  
  // Audio folder filter
  const audioFolderFilterSelect = document.getElementById('audioFolderFilter');
  if (audioFolderFilterSelect) {
    audioFolderFilterSelect.addEventListener('change', (e) => {
      audioFolderFilter = e.target.value;
      filterAndRenderAudio();
    });
  }
  
  // Populate folder filter options
  populateAudioFolderFilter();
}

function populateAudioFolderFilter() {
  const select = document.getElementById('audioFolderFilter');
  if (!select) return;
  
  const folders = ['All Folders', 'Root'];
  
  // TODO: Collect audio folder names when audio structure is implemented
  // For now, just use basic options
  
  select.innerHTML = folders.map((folder, index) => 
    `<option value="${index === 0 ? '' : folder.toLowerCase()}">${folder.toUpperCase()}</option>`
  ).join('');
}

function setAudioViewMode(mode) {
  audioViewMode = mode;
  
  // Update active button
  document.querySelectorAll('.audio-view-modes .view-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === mode);
  });
  
  // Re-render audio with new view mode
  renderAudioWithViewMode();
  showToast(`AUDIO VIEW: ${mode.toUpperCase()}`);
}

function renderAudioWithViewMode() {
  const container = document.getElementById('audioContainer');
  if (!container) return;
  
  // Apply view mode class
  container.className = `audio-grid audio-view-${audioViewMode}`;
  
  // Re-render current audio
  filterAndRenderAudio();
}

function toggleAudioMultiSelectMode() {
  const toggleText = document.getElementById('audioMultiSelectToggleText');
  if (!toggleText) return;
  
  audioMultiSelectMode = !audioMultiSelectMode;
  toggleText.textContent = audioMultiSelectMode ? 'EXIT MULTI-SELECT' : 'MULTI-SELECT';
  
  const container = document.getElementById('audioContainer');
  if (container) {
    container.classList.toggle('audio-multi-select-mode', audioMultiSelectMode);
  }
  
  if (!audioMultiSelectMode) {
    deselectAllAudio();
  }
  
  showToast(audioMultiSelectMode ? 'AUDIO MULTI-SELECT ENABLED' : 'AUDIO MULTI-SELECT DISABLED');
}

function refreshAudio() {
  showLoading();
  loadAudioFiles().then(() => {
    filterAndRenderAudio();
    populateAudioFolderFilter();
    hideLoading();
    showToast('AUDIO FILES REFRESHED');
  });
}

function getFilteredAudioFiles() {
  // TODO: Implement when audio data structure is available
  // For now return empty array
  let allAudio = [];
  
  // Apply filters when audio data is available
  let filteredAudio = allAudio;
  
  // Search filter
  if (audioSearchTerm) {
    filteredAudio = filteredAudio.filter(audio => 
      (audio.name && audio.name.toLowerCase().includes(audioSearchTerm)) ||
      (audio.filename && audio.filename.toLowerCase().includes(audioSearchTerm)) ||
      (audio.artist && audio.artist.toLowerCase().includes(audioSearchTerm))
    );
  }
  
  // Type filter
  if (audioTypeFilter) {
    filteredAudio = filteredAudio.filter(audio => {
      const extension = (audio.filename || audio.url || '').toLowerCase().split('.').pop();
      return extension === audioTypeFilter;
    });
  }
  
  // Sort audio
  filteredAudio.sort((a, b) => {
    switch (audioSortOrder) {
      case 'date-desc':
        return new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0);
      case 'date-asc':
        return new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0);
      case 'name-asc':
        return (a.name || a.filename || '').localeCompare(b.name || b.filename || '');
      case 'name-desc':
        return (b.name || b.filename || '').localeCompare(a.name || a.filename || '');
      case 'duration-desc':
        return (b.duration || 0) - (a.duration || 0);
      case 'duration-asc':
        return (a.duration || 0) - (b.duration || 0);
      default:
        return 0;
    }
  });
  
  return filteredAudio;
}

function filterAndRenderAudio() {
  filteredAudioFiles = getFilteredAudioFiles();
  updateAudioCountIndicator(filteredAudioFiles.length);
  renderAudioFiles();
}

function updateAudioCountIndicator(count) {
  const indicator = document.getElementById('audioCountIndicator');
  if (indicator) {
    indicator.textContent = `${count} TRACK${count !== 1 ? 'S' : ''}`;
  }
}

// Advanced Filters Functionality
let advancedFiltersVisible = false;
let dateFromFilter = '';
let dateToFilter = '';
let tagsFilter = '';

function toggleAdvancedFilters(section) {
  const advancedFilters = document.getElementById('advancedFilters');
  const toggleBtn = document.getElementById('advancedFiltersToggle');
  
  if (!advancedFilters) return;
  
  advancedFiltersVisible = !advancedFiltersVisible;
  
  if (advancedFiltersVisible) {
    advancedFilters.style.display = 'block';
    toggleBtn.textContent = 'HIDE ADVANCED';
    toggleBtn.classList.add('active');
  } else {
    advancedFilters.style.display = 'none';
    toggleBtn.textContent = 'ADVANCED FILTERS';
    toggleBtn.classList.remove('active');
  }
  
  showToast(advancedFiltersVisible ? 'ADVANCED FILTERS SHOWN' : 'ADVANCED FILTERS HIDDEN');
}

function setupAdvancedFilters() {
  // Date range filters
  const dateFromInput = document.getElementById('dateFrom');
  const dateToInput = document.getElementById('dateTo');
  const tagsInput = document.getElementById('tagsFilter');
  
  if (dateFromInput) {
    dateFromInput.addEventListener('change', (e) => {
      dateFromFilter = e.target.value;
      applyAdvancedFilters();
    });
  }
  
  if (dateToInput) {
    dateToInput.addEventListener('change', (e) => {
      dateToFilter = e.target.value;
      applyAdvancedFilters();
    });
  }
  
  if (tagsInput) {
    let tagsTimeout;
    tagsInput.addEventListener('input', (e) => {
      clearTimeout(tagsTimeout);
      tagsTimeout = setTimeout(() => {
        tagsFilter = e.target.value.toLowerCase();
        applyAdvancedFilters();
      }, 300);
    });
  }
}

function applyQuickFilter(filterType) {
  // Remove active class from all quick filter buttons
  document.querySelectorAll('.quick-filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const today = new Date();
  let fromDate = '';
  let toDate = today.toISOString().split('T')[0];
  
  switch (filterType) {
    case 'recent':
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      fromDate = weekAgo.toISOString().split('T')[0];
      break;
      
    case 'month':
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      fromDate = monthAgo.toISOString().split('T')[0];
      break;
      
    case 'favorites':
      // This would filter for favorited items if implemented
      showToast('FAVORITES FILTER - FEATURE COMING SOON');
      return;
      
    case 'clear':
      clearAllFilters();
      return;
  }
  
  // Set date inputs
  const dateFromInput = document.getElementById('dateFrom');
  const dateToInput = document.getElementById('dateTo');
  
  if (dateFromInput && dateToInput) {
    dateFromInput.value = fromDate;
    dateToInput.value = toDate;
    dateFromFilter = fromDate;
    dateToFilter = toDate;
  }
  
  // Mark button as active
  const activeBtn = document.querySelector(`[data-filter="${filterType}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
  
  applyAdvancedFilters();
  showToast(`QUICK FILTER APPLIED: ${filterType.toUpperCase()}`);
}

function clearAllFilters() {
  // Clear date filters
  const dateFromInput = document.getElementById('dateFrom');
  const dateToInput = document.getElementById('dateTo');
  const tagsInput = document.getElementById('tagsFilter');
  
  if (dateFromInput) dateFromInput.value = '';
  if (dateToInput) dateToInput.value = '';
  if (tagsInput) tagsInput.value = '';
  
  dateFromFilter = '';
  dateToFilter = '';
  tagsFilter = '';
  
  // Clear search inputs
  const coverSearch = document.getElementById('coverSearch');
  const assetSearch = document.getElementById('assetSearch');
  const audioSearch = document.getElementById('audioSearch');
  
  if (coverSearch) coverSearch.value = '';
  if (assetSearch) assetSearch.value = '';
  if (audioSearch) audioSearch.value = '';
  
  // Reset filters
  searchTerm = '';
  assetSearchTerm = '';
  audioSearchTerm = '';
  categoryFilter = '';
  assetTypeFilter = '';
  audioTypeFilter = '';
  
  // Clear active states
  document.querySelectorAll('.quick-filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Re-render all sections
  renderCurrentView();
  filterAndRenderAssets();
  filterAndRenderAudio();
  
  showToast('ALL FILTERS CLEARED');
}

function applyAdvancedFilters() {
  // This function would apply date range and tag filters
  // For now, it triggers a re-render of the current section
  renderCurrentView();
  showToast('ADVANCED FILTERS APPLIED');
}

function isDateInRange(itemDate) {
  if (!dateFromFilter && !dateToFilter) return true;
  
  const date = new Date(itemDate);
  const fromDate = dateFromFilter ? new Date(dateFromFilter) : null;
  const toDate = dateToFilter ? new Date(dateToFilter) : null;
  
  if (fromDate && date < fromDate) return false;
  if (toDate && date > toDate) return false;
  
  return true;
}

function matchesTags(itemTags, filterTags) {
  if (!filterTags) return true;
  
  const filterTagsArray = filterTags.split(',').map(tag => tag.trim().toLowerCase());
  const itemTagsArray = (itemTags || '').toLowerCase().split(',').map(tag => tag.trim());
  
  return filterTagsArray.some(filterTag => 
    itemTagsArray.some(itemTag => itemTag.includes(filterTag))
  );
} 

// Make new asset multi-select functions globally available
window.selectAllAssetsInFolder = selectAllAssetsInFolder;
window.copySelectedAssetLinks = copySelectedAssetLinks;
window.deselectAllAssets = deselectAllAssets;
window.moveSelectedAssets = moveSelectedAssets;
window.deleteSelectedAssets = deleteSelectedAssets;
window.downloadSelectedAssets = downloadSelectedAssets;
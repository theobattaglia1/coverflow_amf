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

// Multi-select asset state management
let selectedAssets = new Set();
let assetMultiSelectMode = false;
let lastSelectedAssetIndex = -1;
let draggedAssets = new Set();
let isDraggingAssets = false;

// Enhanced state for new features
let currentViewMode = 'grid';
let showFullView = false;
let currentPage = 1;
let coversPerPage = 20;
let searchTerm = '';
let categoryFilter = '';
let sortOrder = 'index';
let recentCovers = [];

// Initialize
window.addEventListener('DOMContentLoaded', init);

async function init() {
  // Don't check auth here - server already handles it
  // await checkAuth();
  
  // Just load the user info without redirecting
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    
    if (data.user) {
      document.getElementById('username').textContent = data.user.username.toUpperCase();
      document.getElementById('userRole').textContent = data.user.role.toUpperCase();
      
      if (data.user.role === 'admin') {
        document.getElementById('usersSection').style.display = 'block';
        loadUsers();
      }
    }
  } catch (err) {
    console.error('Failed to load user info:', err);
  }
  
  await loadCovers();
  await loadAssets();
  setupEventListeners();
  setupDragAndDrop();
  setupKeyboardShortcuts();
  
  // Initialize enhanced features
  initializeEnhancedCovers();
}

// Load covers from covers.json (or backend)
async function loadCovers() {
  try {
    const res = await fetch('/data/covers.json');
    covers = await res.json();
    renderCovers();
  } catch (err) {
    console.error('Failed to load covers:', err);
    covers = [];
    renderCovers();
  }
}

// Render covers with editorial layout
function renderCovers(searchTerm = '') {
  const container = document.getElementById('coversContainer');
  container.innerHTML = '';
  
  // Filter covers based on search
  const filteredCovers = covers.filter(cover => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      cover.albumTitle?.toLowerCase().includes(search) ||
      cover.coverLabel?.toLowerCase().includes(search) ||
      cover.category?.some(cat => cat.toLowerCase().includes(search))
    );
  });
  
  // Create cover elements with staggered animation
  filteredCovers.forEach((cover, index) => {
    const coverEl = createCoverElement(cover, index);
    container.appendChild(coverEl);
    
    // Staggered fade-in animation
    setTimeout(() => {
      coverEl.style.opacity = '1';
      coverEl.style.transform = coverEl.style.transform.replace('translateY(20px)', 'translateY(0)');
    }, index * 50);
  });
  
  // Initialize Sortable with smooth animations (if available)
  if (!searchTerm && typeof Sortable !== 'undefined') {
    new Sortable(container, {
      animation: 200,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      onEnd: (evt) => {
        // Update cover order
        const newCovers = [...covers];
        const [movedCover] = newCovers.splice(evt.oldIndex, 1);
        newCovers.splice(evt.newIndex, 0, movedCover);
        covers = newCovers;
        
        // Update indices
        covers.forEach((cover, i) => cover.index = i);
        hasChanges = true;
        updateSaveButton();
      }
    });
  }
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
        <input type="text" class="form-input" name="category" value="${Array.isArray(cover.category) ? cover.category.join(', ') : (cover.category || '')}" 
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
            <img src="${cover.frontImage || '/placeholder.jpg'}" style="width: 100%; aspect-ratio: 1; object-fit: cover; margin-bottom: var(--space-sm);">
            <input type="text" class="form-input" name="frontImage" value="${cover.frontImage || ''}" style="margin-bottom: 8px;">
            <button type="button" class="btn" onclick="openImageLibrary('frontImage')" style="width: 100%;">
              CHANGE IMAGE
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">BACK IMAGE</label>
          <div style="position: relative;">
            <img src="${cover.backImage || '/placeholder.jpg'}" style="width: 100%; aspect-ratio: 1; object-fit: cover; margin-bottom: var(--space-sm);">
            <input type="text" class="form-input" name="backImage" value="${cover.backImage || ''}" style="margin-bottom: 8px;">
            <button type="button" class="btn" onclick="openImageLibrary('backImage')" style="width: 100%;">
              CHANGE IMAGE
            </button>
          </div>
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">UPLOAD NEW IMAGE</label>
        <div id="modalDropzone" style="border: 2px dashed #ccc; padding: 16px; text-align: center; cursor: pointer; margin-bottom: 12px;">
          <span id="modalDropzoneText">Drag & drop or click to upload</span>
          <input type="file" id="modalDropzoneInput" style="display:none;" accept="image/*">
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
    
    // Update cover data
    cover.albumTitle = formData.get('albumTitle');
    cover.coverLabel = formData.get('coverLabel');
    cover.category = formData.get('category').split(',').map(c => c.trim()).filter(Boolean);
    cover.spotifyEmbed = formData.get('spotifyEmbed');
    cover.contactEmail = formData.get('contactEmail');
    cover.frontImage = formData.get('frontImage');
    cover.backImage = formData.get('backImage');
    
    hasChanges = true;
    updateSaveButton();
    renderCovers();
    closeModal();
    showToast('COVER UPDATED');
  };
  
  openModal();

  setTimeout(() => {
    const dropzone = document.getElementById('modalDropzone');
    const input = document.getElementById('modalDropzoneInput');
    dropzone.onclick = () => input.click();
    dropzone.ondragover = e => { e.preventDefault(); dropzone.style.background = '#f0f0f0'; };
    dropzone.ondragleave = e => { e.preventDefault(); dropzone.style.background = ''; };
    dropzone.ondrop = e => {
      e.preventDefault();
      dropzone.style.background = '';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleModalImageUpload(e.dataTransfer.files[0]);
      }
    };
    input.onchange = e => {
      if (input.files && input.files[0]) {
        handleModalImageUpload(input.files[0]);
      }
    };
  }, 0);
}

async function handleModalImageUpload(file) {
  const dropText = document.getElementById('modalDropzoneText');
  dropText.textContent = 'Uploading...';
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', currentFolder || ''); // Assuming currentFolder is accessible here
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

// Batch mode functionality
function toggleBatchMode() {
  batchMode = !batchMode;
  selectedCovers.clear();
  
  document.body.classList.toggle('batch-active', batchMode);
  document.getElementById('batchModeBtn').textContent = batchMode ? 'EXIT BATCH' : 'BATCH MODE';
  document.getElementById('exportBtn').style.display = batchMode ? 'block' : 'none';
  document.getElementById('deleteBtn').style.display = batchMode ? 'block' : 'none';
  
  if (!batchMode) {
    renderCovers();
  }
}

function toggleCoverSelection(coverId) {
  if (selectedCovers.has(coverId)) {
    selectedCovers.delete(coverId);
  } else {
    selectedCovers.add(coverId);
  }
  
  const coverEl = document.querySelector(`[data-id="${coverId}"]`);
  coverEl.classList.toggle('selected', selectedCovers.has(coverId));
  
  // Update button states
  const hasSelection = selectedCovers.size > 0;
  document.getElementById('exportBtn').disabled = !hasSelection;
  document.getElementById('deleteBtn').disabled = !hasSelection;
}

// Save changes with visual feedback
async function saveChanges() {
  if (!hasChanges) {
    showToast('NO CHANGES TO SAVE');
    return;
  }
  
  showLoading();
  
  try {
    const res = await fetch('/save-covers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(covers)
    });
    
    if (res.ok) {
      hasChanges = false;
      updateSaveButton();
      showToast('CHANGES SAVED SUCCESSFULLY');
    } else {
      throw new Error('Save failed');
    }
  } catch (err) {
    showToast('FAILED TO SAVE CHANGES', 5000);
    console.error(err);
  } finally {
    hideLoading();
  }
}

// Update save button state
function updateSaveButton() {
  const saveBtn = document.querySelector('[onclick="saveChanges()"]');
  if (hasChanges) {
    saveBtn.classList.add('btn-primary');
    saveBtn.textContent = 'SAVE CHANGES *';
  } else {
    saveBtn.classList.remove('btn-primary');
    saveBtn.textContent = 'SAVE CHANGES';
  }
}

// Push live with confirmation
async function pushLive() {
  if (!confirm('PUSH ALL CHANGES TO LIVE SITE?')) return;
  
  showLoading();
  
  try {
    const res = await fetch('/push-live', { method: 'POST' });
    
    if (res.ok) {
      showToast('SUCCESSFULLY PUSHED TO LIVE');
    } else {
      throw new Error('Push failed');
    }
  } catch (err) {
    showToast('FAILED TO PUSH LIVE', 5000);
    console.error(err);
  } finally {
    hideLoading();
  }
}

// Asset management
async function loadAssets() {
  try {
    const res = await fetch('/api/list-gcs-assets');
    const data = await res.json();
    // data.images is an array of URL strings from GCS
    assets = { images: data.images.map(url => ({ url, name: url.split('/').pop(), type: 'image' })) };
    renderAssets();
  } catch (err) {
    console.error('Failed to load assets:', err);
  }
}

function renderFolders() {
  const folderTree = document.getElementById('folderTree');
  folderTree.innerHTML = '';
  
  // Root folder
  const rootItem = document.createElement('li');
  rootItem.className = 'folder-item' + (currentFolder === '' ? ' active' : '');
  rootItem.textContent = 'ROOT';
  rootItem.onclick = () => selectFolder('');
  
  // Add drop zone functionality to root folder
  setupFolderDropZone(rootItem, '');
  
  folderTree.appendChild(rootItem);
  
  // Other folders
  folders.forEach(folder => {
    const li = document.createElement('li');
    li.className = 'folder-item' + (currentFolder === folder ? ' active' : '');
    li.textContent = folder.toUpperCase();
    li.onclick = () => selectFolder(folder);
    
    // Add drop zone functionality to folder
    setupFolderDropZone(li, folder);
    
    folderTree.appendChild(li);
  });
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

function selectFolder(folder) {
  currentFolder = folder;
  renderFolders();
  renderAssets();
}

function renderAssets() {
  const container = document.getElementById('assetsContainer');
  container.innerHTML = '';
  const folderAssets = currentFolder ? (assets.images || []) : Object.values(assets).flat();
  
  folderAssets.forEach((asset, index) => {
    const assetId = asset.url; // Use URL as unique identifier
    const isSelected = selectedAssets.has(assetId);
    
    let type = asset.type;
    if (!type && asset.url) {
      if (/\.(mp4|webm|mov|avi)$/i.test(asset.url)) type = 'video';
      else if (/\.(mp3|wav|m4a|aac|ogg)$/i.test(asset.url)) type = 'audio';
      else if (/\.(png|jpe?g|gif|bmp|webp)$/i.test(asset.url)) type = 'image';
      else type = 'other';
    }
    
    let mediaTag = '';
    if (type === 'video') {
      mediaTag = `<video src="${asset.url}" controls preload="metadata" style="width:100%;height:180px;object-fit:cover;background:#222;" poster="">
        Sorry, your browser doesn't support embedded videos.
      </video>`;
    } else if (type === 'audio') {
      mediaTag = `<audio src="${asset.url}" controls style="width:100%;margin-bottom:8px;">
        Sorry, your browser doesn't support embedded audio.
      </audio>`;
    } else if (type === 'image') {
      mediaTag = `<img src="${asset.url}" alt="${asset.name || 'Asset'}" loading="lazy" style="width:100%;height:180px;object-fit:cover;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'100\'%3E%3Crect fill=\'%23333\' width=\'200\' height=\'100\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23999\' font-size=\'10\' font-family=\'monospace\'%3EBROKEN%3C/text%3E%3C/svg%3E'">`;
    } else {
      mediaTag = `<div style="width:100%;height:180px;display:flex;align-items:center;justify-content:center;background:#eee;color:#888;font-size:1.2em;">Unsupported</div>`;
    }
    
    const div = document.createElement('div');
    div.className = `asset-item ${isSelected ? 'selected' : ''}`;
    div.dataset.assetId = assetId;
    div.dataset.assetIndex = index;
    div.draggable = true;
    
    // Multi-select checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'asset-checkbox';
    checkbox.checked = isSelected;
    checkbox.onclick = (e) => {
      e.stopPropagation();
      toggleAssetSelection(assetId, index, e);
    };
    
    // Asset content container
    const contentDiv = document.createElement('div');
    contentDiv.className = 'asset-content';
    contentDiv.innerHTML = mediaTag + `
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
    div.addEventListener('click', (e) => handleAssetClick(e, assetId, index));
    div.addEventListener('dragstart', (e) => handleAssetDragStart(e, assetId));
    div.addEventListener('dragend', (e) => handleAssetDragEnd(e));
    
    container.appendChild(div);
  });
  
  // Update selection counter
  updateAssetSelectionCounter();
}

// Multi-select asset functionality
function toggleAssetSelection(assetId, index, event) {
  if (event.shiftKey && lastSelectedAssetIndex !== -1) {
    // Shift+click: select range
    const start = Math.min(lastSelectedAssetIndex, index);
    const end = Math.max(lastSelectedAssetIndex, index);
    const folderAssets = currentFolder ? (assets.images || []) : Object.values(assets).flat();
    
    for (let i = start; i <= end; i++) {
      if (i < folderAssets.length) {
        selectedAssets.add(folderAssets[i].url);
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
  renderAssets();
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
  const folderAssets = currentFolder ? (assets.images || []) : Object.values(assets).flat();
  selectedAssets.clear();
  folderAssets.forEach(asset => selectedAssets.add(asset.url));
  renderAssets();
  showToast(`${folderAssets.length} ASSETS SELECTED`);
}

function deselectAllAssets() {
  selectedAssets.clear();
  renderAssets();
  showToast('ALL ASSETS DESELECTED');
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
  
  renderAssets();
  showToast(assetMultiSelectMode ? 'MULTI-SELECT MODE ENABLED' : 'MULTI-SELECT MODE DISABLED');
}

function updateAssetSelectionCounter() {
  const counter = document.getElementById('assetSelectionCounter');
  if (counter) {
    const count = selectedAssets.size;
    counter.textContent = count > 0 ? `${count} SELECTED` : '';
    counter.style.display = count > 0 ? 'block' : 'none';
  }
}

function copyAssetUrl(assetId) {
  navigator.clipboard.writeText(assetId);
  showToast('URL COPIED TO CLIPBOARD');
}

function updateAssetName(assetId, newName) {
  // Find and update asset name in the data structure
  const folderAssets = currentFolder ? (assets.images || []) : Object.values(assets).flat();
  const asset = folderAssets.find(a => a.url === assetId);
  if (asset) {
    asset.name = newName;
    showToast('ASSET NAME UPDATED');
  }
}

function deleteAsset(assetId) {
  if (!confirm('DELETE THIS ASSET?')) return;
  
  // Remove from assets data structure
  if (assets.images) {
    assets.images = assets.images.filter(a => a.url !== assetId);
  }
  
  // Remove from selection if selected
  selectedAssets.delete(assetId);
  
  renderAssets();
  showToast('ASSET DELETED');
}

// Drag and drop functionality for multi-select
function handleAssetDragStart(event, assetId) {
  if (!selectedAssets.has(assetId)) {
    // If dragging an unselected item, select it and clear other selections
    selectedAssets.clear();
    selectedAssets.add(assetId);
    renderAssets();
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
      // Update local data structure
      const folderAssets = currentFolder ? (assets.images || []) : Object.values(assets).flat();
      const movedAssets = folderAssets.filter(a => selectedAssets.has(a.url));
      
      // Remove from current location
      if (assets.images) {
        assets.images = assets.images.filter(a => !selectedAssets.has(a.url));
      }
      
      // Add to target folder (simplified - would need proper folder structure)
      // This is a placeholder for the actual folder management
      
      selectedAssets.clear();
      renderAssets();
      renderFolders();
      
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

// Drag and drop functionality
function setupDragAndDrop() {
  // Cover dropzone
  const coverDropzone = document.getElementById('coverDropzone');
  
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
  const formData = new FormData();
  formData.append('image', file);
  
  showLoading();
  
  try {
    const res = await fetch('/upload-image', {
      method: 'POST',
      body: formData
    });
    
    const data = await res.json();
    
    if (res.ok) {
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
      throw new Error(data.error || 'Upload failed');
    }
  } catch (err) {
    showToast('FAILED TO UPLOAD IMAGE', 5000);
    console.error(err);
  } finally {
    hideLoading();
  }
}

// Setup asset dropzone functionality
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
  try {
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', currentFolder || '');
      
      const res = await fetch('/upload-image', {
        method: 'POST',
        body: formData
      });
      
      let data;
      try {
        data = await res.json();
      } catch (err) {
        showToast('UPLOAD FAILED: INVALID SERVER RESPONSE', 5000);
        continue;
      }
      
      if (res.ok && data && data.url) {
        uploadedAny = true;
        // Warn if TIFF
        if (/\.tif{1,2}$/i.test(file.name)) {
          showToast('UPLOAD SUCCESSFUL, BUT TIFF IMAGES MAY NOT PREVIEW IN BROWSERS', 7000);
        } else {
          showToast(`UPLOADED ${file.name.toUpperCase()}`);
        }
      } else {
        showToast('UPLOAD FAILED: ' + (data && data.error ? data.error.toUpperCase() : 'UNKNOWN ERROR'), 5000);
        continue;
      }
    }
    if (uploadedAny) {
      await loadAssets();
      renderAssets();
    }
  } catch (err) {
    showToast('UPLOAD FAILED: ' + err.message.toUpperCase(), 5000);
    console.error(err);
  } finally {
    hideLoading();
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
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + F to focus search
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      document.getElementById('coverSearch').focus();
    }
    
    // Cmd/Ctrl + B for batch mode
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      toggleBatchMode();
    }
    
    // Multi-select asset shortcuts
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      if (assetMultiSelectMode) {
        selectAllAssets();
      }
    }
    
    // Escape to deselect all assets
    if (e.key === 'Escape') {
      if (selectedAssets.size > 0) {
        e.preventDefault();
        deselectAllAssets();
      }
    }
    
    // Cmd/Ctrl + M for multi-select mode toggle
    if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
      e.preventDefault();
      toggleMultiSelectMode();
    }
    
    // Delete key to delete selected assets
    if (e.key === 'Delete' && selectedAssets.size > 0) {
      e.preventDefault();
      deleteSelectedAssets();
    }
  });
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
      renderAssets();
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

// Loading states
function showLoading() {
  document.getElementById('loading').style.display = 'block';
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
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
  
  if (!confirm(`DELETE ${count} SELECTED COVERS?`)) return;
  
  covers = covers.filter(c => !selectedCovers.has(c.id));
  
  // Re-index
  covers.forEach((cover, i) => cover.index = i);
  
  hasChanges = true;
  updateSaveButton();
  toggleBatchMode();
  renderCovers();
  
  showToast(`DELETED ${count} COVERS`);
} 

// Image Library Modal for dashboard
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
        <h2 style="margin-top:0;">Select Asset</h2>
        <div id="dashboardImageLibraryGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 16px;"></div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('closeDashboardImageLibrary').onclick = closeImageLibrary;
  } else {
    modal.style.display = 'flex';
  }
  // Populate assets
  const grid = document.getElementById('dashboardImageLibraryGrid');
  grid.innerHTML = '';
  const allAssets = (assets.images || []).concat(...(assets.folders||[]).flatMap(f=>f.children||[]));
  if (allAssets.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:#888;">No assets found.</div>';
  } else {
    allAssets.forEach(asset => {
      let type = asset.type;
      if (!type && asset.url) {
        if (/\.(mp4|webm|mov|avi)$/i.test(asset.url)) type = 'video';
        else if (/\.(mp3|wav|m4a|aac|ogg)$/i.test(asset.url)) type = 'audio';
        else type = 'image';
      }
      let mediaTag = '';
      if (type === 'video') {
        mediaTag = `<video src="${asset.url}" controls style="width:100%;height:100px;object-fit:cover;background:#222;"></video>`;
      } else if (type === 'audio') {
        mediaTag = `<audio src="${asset.url}" controls style="width:100%;margin-bottom:8px;"></audio>`;
      } else {
        mediaTag = `<img src="${asset.url}" style="width:100%; aspect-ratio:1; object-fit:cover;">`;
      }
      const div = document.createElement('div');
      div.style.cursor = 'pointer';
      div.style.border = '1px solid #ccc';
      div.style.padding = '4px';
      div.style.background = '#fafafa';
      div.innerHTML = mediaTag + `<div style="font-size:0.8em; text-align:center; margin-top:4px;">${asset.name||''}</div>`;
      div.onclick = () => {
        // Always set the GCS URL as the value
        const input = document.querySelector(`#editCoverForm input[name='${dashboardImageLibraryTarget}']`);
        if (input) {
          input.value = asset.url;
          input.dispatchEvent(new Event('input'));
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

// ===================
// ENHANCED COVERS INTERFACE FUNCTIONS
// ===================

function initializeEnhancedCovers() {
  // Set up event listeners for enhanced features
  setupSearchAndFilters();
  setupViewModeToggles();
  renderRecentCovers();
  
  // Show progressive disclosure by default
  showFullView = false;
  updateCoversDisplay();
}

function setupSearchAndFilters() {
  const searchInput = document.getElementById('coverSearch');
  const categoryFilter = document.getElementById('categoryFilter');
  const sortOrder = document.getElementById('sortOrder');
  
  let searchTimeout;
  
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchTerm = e.target.value.toLowerCase();
        currentPage = 1;
        renderCurrentView();
      }, 300);
    });
  }
  
  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      categoryFilter = e.target.value;
      currentPage = 1;
      renderCurrentView();
    });
  }
  
  if (sortOrder) {
    sortOrder.addEventListener('change', (e) => {
      sortOrder = e.target.value;
      currentPage = 1;
      renderCurrentView();
    });
  }
}

function setupViewModeToggles() {
  document.querySelectorAll('.view-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const viewMode = button.dataset.view;
      setViewMode(viewMode);
    });
  });
}

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

function toggleFullCoversView() {
  showFullView = !showFullView;
  updateCoversDisplay();
}

function updateCoversDisplay() {
  const recentSection = document.getElementById('recentlyEditedSection');
  const controlsSection = document.getElementById('coversControls');
  const mainContainer = document.getElementById('coversMainContainer');
  
  if (showFullView) {
    recentSection.style.display = 'none';
    controlsSection.style.display = 'flex';
    mainContainer.style.display = 'block';
    renderCurrentView();
  } else {
    recentSection.style.display = 'block';
    controlsSection.style.display = 'none';
    mainContainer.style.display = 'none';
    renderRecentCovers();
  }
}

function setViewMode(mode) {
  currentViewMode = mode;
  
  // Update toggle buttons
  document.querySelectorAll('.view-toggle').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === mode);
  });
  
  // Hide all view containers
  document.getElementById('coversContainer').style.display = 'none';
  document.getElementById('coversListContainer').style.display = 'none';
  document.getElementById('coversCoverflowContainer').style.display = 'none';
  
  // Show current view container
  const containers = {
    'grid': 'coversContainer',
    'list': 'coversListContainer', 
    'coverflow': 'coversCoverflowContainer'
  };
  
  document.getElementById(containers[mode]).style.display = 'block';
  
  renderCurrentView();
}

function renderCurrentView() {
  if (!showFullView) return;
  
  const filtered = getFilteredAndSortedCovers();
  const startIndex = (currentPage - 1) * coversPerPage;
  const endIndex = startIndex + coversPerPage;
  const pageCovers = filtered.slice(startIndex, endIndex);
  
  switch (currentViewMode) {
    case 'grid':
      renderGridView(pageCovers);
      break;
    case 'list':
      renderListView(pageCovers);
      break;
    case 'coverflow':
      renderCoverflowView(pageCovers);
      break;
  }
  
  updatePagination(filtered.length);
}

function renderGridView(pageCovers) {
  const container = document.getElementById('coversContainer');
  container.innerHTML = pageCovers.map(cover => createEnhancedCoverElement(cover)).join('');
  
  // Initialize sortable if not in search mode (and Sortable is available)
  if (!searchTerm && sortOrder === 'index' && typeof Sortable !== 'undefined') {
    new Sortable(container, {
      animation: 200,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      onEnd: (evt) => {
        // Update cover order
        const newCovers = [...covers];
        const [movedCover] = newCovers.splice(evt.oldIndex, 1);
        newCovers.splice(evt.newIndex, 0, movedCover);
        covers = newCovers;
        
        // Update indices
        covers.forEach((cover, i) => cover.index = i);
        hasChanges = true;
        updateSaveButton();
      }
    });
  }
}

function renderListView(pageCovers) {
  const container = document.getElementById('coversListContainer');
  container.innerHTML = pageCovers.map(cover => createListCoverElement(cover)).join('');
}

function renderCoverflowView(pageCovers) {
  const container = document.getElementById('coversCoverflowContainer');
  container.innerHTML = pageCovers.map(cover => createCoverflowCoverElement(cover)).join('');
  
  // Add coverflow scroll behavior
  setupCoverflowNavigation(container);
}

function createEnhancedCoverElement(cover) {
  const isSelected = selectedCovers.has(cover.id);
  const categories = Array.isArray(cover.category) ? cover.category.join(', ') : (cover.category || '');
  
  return `
    <div class="cover-item ${isSelected ? 'selected' : ''}" data-id="${cover.id}">
      ${batchMode ? `<input type="checkbox" class="batch-checkbox" ${isSelected ? 'checked' : ''} onchange="toggleCoverSelection('${cover.id}')">` : ''}
      <img src="${cover.frontImage || '/placeholder.jpg'}" 
           alt="${cover.albumTitle || 'Untitled'}" 
           class="cover-image"
           loading="lazy"
           onclick="handleCoverClick('${cover.id}')">
      <div class="cover-index">${(cover.index || 0) + 1}</div>
      <div class="cover-meta">
        <div>${cover.albumTitle || 'UNTITLED'}</div>
        <div>${cover.coverLabel || '—'}</div>
        <div class="cover-categories">${categories.toUpperCase()}</div>
      </div>
    </div>
  `;
}

function createListCoverElement(cover) {
  const isSelected = selectedCovers.has(cover.id);
  const categories = Array.isArray(cover.category) ? cover.category.join(', ') : (cover.category || '');
  const dateAdded = new Date(parseInt(cover.id)).toLocaleDateString();
  
  return `
    <div class="cover-item-list ${isSelected ? 'selected' : ''}" data-id="${cover.id}" onclick="handleCoverClick('${cover.id}')">
      ${batchMode ? `<input type="checkbox" class="batch-checkbox" ${isSelected ? 'checked' : ''} onchange="toggleCoverSelection('${cover.id}')">` : ''}
      <img src="${cover.frontImage || '/placeholder.jpg'}" 
           alt="${cover.albumTitle || 'Untitled'}" 
           class="cover-thumb"
           loading="lazy">
      <div class="cover-meta-list">
        <div class="cover-title">${cover.albumTitle || 'UNTITLED'}</div>
        <div class="cover-artist">${cover.coverLabel || '—'}</div>
        <div class="cover-categories">${categories}</div>
      </div>
      <div class="cover-date">${dateAdded}</div>
      <div class="cover-actions">
        <button class="btn btn-sm" onclick="editCover(${JSON.stringify(cover).replace(/"/g, '&quot;')}); event.stopPropagation();">EDIT</button>
      </div>
    </div>
  `;
}

function createCoverflowCoverElement(cover) {
  return `
    <div class="cover-item-coverflow" data-id="${cover.id}" onclick="handleCoverClick('${cover.id}')">
      <img src="${cover.frontImage || '/placeholder.jpg'}" 
           alt="${cover.albumTitle || 'Untitled'}" 
           class="cover-image-coverflow"
           loading="lazy">
      <div class="cover-meta">
        <div>${cover.albumTitle || 'UNTITLED'}</div>
        <div>${cover.coverLabel || '—'}</div>
      </div>
    </div>
  `;
}

function setupCoverflowNavigation(container) {
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
  
  if (totalPages <= 1) {
    controls.style.display = 'none';
    return;
  }
  
  controls.style.display = 'flex';
  pageInfo.textContent = `${currentPage} / ${totalPages}`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
}

function changePage(direction) {
  const filtered = getFilteredAndSortedCovers();
  const totalPages = Math.ceil(filtered.length / coversPerPage);
  
  currentPage = Math.max(1, Math.min(totalPages, currentPage + direction));
  renderCurrentView();
}

// Enhanced batch operations
function toggleBatchMode() {
  batchMode = !batchMode;
  
  const batchBtn = document.getElementById('batchModeBtn');
  const batchOps = document.getElementById('batchOperations');
  const exportBtn = document.getElementById('exportBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  
  if (batchMode) {
    batchBtn.textContent = 'EXIT BATCH';
    batchBtn.classList.add('btn-danger');
    batchOps.style.display = 'flex';
    exportBtn.style.display = 'inline-block';
    deleteBtn.style.display = 'inline-block';
    document.body.classList.add('batch-active');
  } else {
    batchBtn.textContent = 'BATCH MODE';
    batchBtn.classList.remove('btn-danger');
    batchOps.style.display = 'none';
    exportBtn.style.display = 'none';
    deleteBtn.style.display = 'none';
    document.body.classList.remove('batch-active');
    selectedCovers.clear();
  }
  
  renderCurrentView();
  updateBatchInfo();
}

function selectAllCovers() {
  const filtered = getFilteredAndSortedCovers();
  filtered.forEach(cover => selectedCovers.add(cover.id));
  updateBatchInfo();
  renderCurrentView();
}

function clearSelection() {
  selectedCovers.clear();
  updateBatchInfo();
  renderCurrentView();
}

function updateBatchInfo() {
  const countEl = document.getElementById('selectedCount');
  if (countEl) {
    countEl.textContent = selectedCovers.size;
  }
}

// Folder management functions
async function createNewFolder() {
  const name = prompt('Enter folder name:');
  if (!name) return;
  
  showLoading();
  try {
    const res = await fetch('/api/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentFolder, name })
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error);
    }
    
    showToast('Folder created successfully');
    await loadAssets();
  } catch (err) {
    showToast(err.message || 'Failed to create folder', 5000);
  } finally {
    hideLoading();
  }
}

async function renameFolder(path) {
  const oldName = path.split('/').pop();
  const newName = prompt('Enter new name:', oldName);
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
    
    showToast('Folder renamed successfully');
    await loadAssets();
  } catch (err) {
    showToast(err.message || 'Failed to rename folder', 5000);
  } finally {
    hideLoading();
  }
}

async function deleteFolder(path) {
  if (!confirm(`Delete folder "${path.split('/').pop()}" and all its contents?`)) return;
  
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
    
    showToast('Folder deleted successfully');
    if (currentFolder.startsWith(path)) {
      navigateToFolder('');
    }
    await loadAssets();
  } catch (err) {
    showToast(err.message || 'Failed to delete folder', 5000);
  } finally {
    hideLoading();
  }
}

function navigateToFolder(folder) {
  currentFolder = folder;
  
  // Update active folder in UI
  document.querySelectorAll('.folder-item').forEach(item => {
    item.classList.toggle('active', 
      (folder === '' && item.textContent.includes('ROOT')) ||
      item.textContent.includes(folder.toUpperCase())
    );
  });
  
  renderFolders();
  renderAssets();
}

// Make functions available globally
window.toggleFullCoversView = toggleFullCoversView;
window.setViewMode = setViewMode;
window.handleCoverClick = handleCoverClick;
window.changePage = changePage;
window.toggleCoverSelection = toggleCoverSelection;
window.selectAllCovers = selectAllCovers;
window.clearSelection = clearSelection;

// Make folder management functions globally available
window.createNewFolder = createNewFolder;
window.renameFolder = renameFolder;
window.deleteFolder = deleteFolder;
window.navigateToFolder = navigateToFolder;

// Export aliases for consistency with HTML
window.exportSelected = exportCovers; 
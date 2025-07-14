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

// Initialize
document.addEventListener('DOMContentLoaded', init);

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
}

// Load covers with smooth animation
async function loadCovers() {
  showLoading();
  
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
  
  // Initialize Sortable with smooth animations
  if (!searchTerm) {
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
            <img src="${cover.frontImage || '/placeholder.jpg'}" 
                 style="width: 100%; aspect-ratio: 1; object-fit: cover; margin-bottom: var(--space-sm);">
            <button type="button" class="btn" onclick="openImageLibrary('frontImage')" style="width: 100%;">
              CHANGE IMAGE
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">BACK IMAGE</label>
          <div style="position: relative;">
            <img src="${cover.backImage || '/placeholder.jpg'}" 
                 style="width: 100%; aspect-ratio: 1; object-fit: cover; margin-bottom: var(--space-sm);">
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
      // Update all preview images in the modal with old /uploads/ src
      document.querySelectorAll('#coverModal img').forEach(img => {
        if (img.src.includes('/uploads/')) img.src = data.url;
      });
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
    const res = await fetch('/data/assets.json');
    const data = await res.json();
    assets = data.assets || {};
    folders = Object.keys(assets);
    renderFolders();
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
  folderTree.appendChild(rootItem);
  
  // Other folders
  folders.forEach(folder => {
    const li = document.createElement('li');
    li.className = 'folder-item' + (currentFolder === folder ? ' active' : '');
    li.textContent = folder.toUpperCase();
    li.onclick = () => selectFolder(folder);
    folderTree.appendChild(li);
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
  
  const folderAssets = currentFolder ? (assets[currentFolder] || []) : 
    Object.values(assets).flat();
  
  folderAssets.forEach(asset => {
    const div = document.createElement('div');
    div.className = 'asset-item';
    div.innerHTML = `
      <img src="${asset.url}" alt="${asset.name || 'Asset'}" loading="lazy">
    `;
    
    div.onclick = () => {
      navigator.clipboard.writeText(asset.url);
      showToast('URL COPIED TO CLIPBOARD');
    };
    
    container.appendChild(div);
  });
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
  const allImages = (assets.images || []).concat(...(assets.folders||[]).flatMap(f=>f.children||[]).filter(c=>c.type==='image'));
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
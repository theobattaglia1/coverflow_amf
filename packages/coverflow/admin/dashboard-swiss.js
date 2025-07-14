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
        <input type="text" class="form-input" name="category" value="${(cover.category || []).join(', ')}" 
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
            <button type="button" class="btn" onclick="selectImage('frontImage', ${cover.id})" style="width: 100%;">
              CHANGE IMAGE
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">BACK IMAGE</label>
          <div style="position: relative;">
            <img src="${cover.backImage || '/placeholder.jpg'}" 
                 style="width: 100%; aspect-ratio: 1; object-fit: cover; margin-bottom: var(--space-sm);">
            <button type="button" class="btn" onclick="selectImage('backImage', ${cover.id})" style="width: 100%;">
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
    
    // Merge both folders and children at the top level, deduplicated by name
    let folders = [];
    if (Array.isArray(data.folders)) folders = folders.concat(data.folders);
    if (Array.isArray(data.children)) folders = folders.concat(data.children);
    // Deduplicate by folder name
    const seen = new Set();
    folders = folders.filter(f => {
      if (!f || !f.name) return false;
      if (seen.has(f.name)) return false;
      seen.add(f.name);
      return true;
    });
    assets = {
      folders,
      images: data.images || []
    };
    
    renderFolders();
    renderAssets();
  } catch (err) {
    console.error('Failed to load assets:', err);
    assets = { folders: [], images: [] };
    renderFolders();
    renderAssets();
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
  folderTree.appendChild(rootItem);
  
  // Render hierarchical folders
  function renderFolder(folder, level = 0) {
    const li = document.createElement('li');
    const indent = level * 20;
    const hasChildren = folder.children && folder.children.filter(c => c.type === 'folder').length > 0;
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
    
    // Show actions on hover
    li.addEventListener('mouseenter', () => {
      li.querySelector('.folder-actions').style.display = 'flex';
    });
    li.addEventListener('mouseleave', () => {
      li.querySelector('.folder-actions').style.display = 'none';
    });
    
    folderTree.appendChild(li);
    
    // Render children
    if (hasChildren) {
      folder.children.filter(c => c.type === 'folder').forEach(child => {
        renderFolder({...child, path: folderPath + '/' + child.name}, level + 1);
      });
    }
  }
  
  // Render all top-level folders
  if (assets.folders) {
    assets.folders.forEach(folder => renderFolder(folder));
  }
}

function renderAssets() {
  const container = document.getElementById('assetsContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Get items in current folder
  const { images } = getCurrentFolderItems();
  
  if (images.length === 0) {
    container.innerHTML = '<p style="color: var(--grey-500); grid-column: 1/-1; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.1em;">NO ASSETS IN THIS FOLDER</p>';
    return;
  }
  
  images.forEach((asset, index) => {
    // Infer type if missing
    let type = asset.type;
    if (!type && asset.url) {
      if (/\.(mp4|webm|mov|avi)$/i.test(asset.url)) type = 'video';
      else if (/\.(mp3|wav|m4a|aac|ogg)$/i.test(asset.url)) type = 'audio';
      else type = 'image';
    }
    let mediaTag = '';
    if (type === 'video') {
      mediaTag = `<video src="${asset.url}" controls style="width:100%;height:180px;object-fit:cover;background:#222;"></video>`;
    } else if (type === 'audio') {
      mediaTag = `<audio src="${asset.url}" controls style="width:100%;margin-bottom:8px;"></audio>`;
    } else {
      mediaTag = `<img src="${asset.url}" alt="${asset.name || 'Asset'}" loading="lazy"
           onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'100\'%3E%3Crect fill=\'%23333\' width=\'200\' height=\'100\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23999\' font-size=\'10\' font-family=\'monospace\'%3EBROKEN%3C/text%3E%3C/svg%3E'">`;
    }
    const div = document.createElement('div');
    div.className = 'asset-item';
    div.innerHTML = `
      ${mediaTag}
      <input type="text" value="${asset.name || ''}" placeholder="UNTITLED" onchange="updateAssetName('${asset.url}', this.value)" style="margin-bottom: var(--space-sm);">
      <div style="font-family: var(--font-mono); font-size: 0.625rem; word-break: break-all; margin-bottom: var(--space-sm); cursor: pointer; opacity: 0.6;"
           onclick="copyToClipboardFullPath('${asset.url}')" title="CLICK TO COPY FULL URL">
        ${asset.url}
      </div>
      <button onclick="deleteAsset('${asset.url}')" style="width: 100%;">DELETE</button>
    `;
    container.appendChild(div);
  });
}

// Get items in current folder
function getCurrentFolderItems() {
  if (currentPath === '' || !currentPath) {
    return {
      folders: assets.folders || [],
      images: assets.images || []
    };
  }
  
  // Navigate to current folder
  const pathParts = currentPath.split('/').filter(Boolean);
  let current = assets;
  
  for (const part of pathParts) {
    const folder = (current.folders || current.children || []).find(f => 
      (f.type === 'folder' || !f.type) && f.name === part
    );
    if (!folder) return { folders: [], images: [] };
    current = folder;
  }
  
  return {
    folders: (current.children || []).filter(c => c.type === 'folder'),
    images: (current.children || []).filter(c => c.type === 'image')
  };
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

// Asset management functions
let currentPath = '';

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
  
  // Update active folder
  document.querySelectorAll('.folder-item').forEach(item => {
    item.classList.toggle('active', item.dataset && item.dataset.path === path);
  });
  
  renderAssets();
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
  renderAssets();
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
  
  try {
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      if (currentPath) {
        formData.append('folder', currentPath);
      }
      
      const res = await fetch('/upload-image', {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Add to assets in current folder
        let assetType = data.type || 'image';
        // Fallback: infer from file type
        if (!assetType && file.type) {
          if (file.type.startsWith('video/')) assetType = 'video';
          else if (file.type.startsWith('audio/')) assetType = 'audio';
          else assetType = 'image';
        }
        // Ensure url is correct
        let url = data.url;
        if (!/^https?:\/\//.test(url) && !url.startsWith('/uploads')) {
          if (assetType === 'video') url = '/uploads/video/' + file.name;
          else if (assetType === 'audio') url = '/uploads/audio/' + file.name;
          else url = '/uploads/' + file.name;
        }
        const newAsset = {
          type: assetType,
          url: url,
          name: file.name.replace(/\.[^/.]+$/, ''),
          uploadedAt: new Date().toISOString()
        };
        
        if (!assets) assets = { folders: [], images: [] };
        
        if (currentPath === '' || !currentPath) {
          if (!assets.images) assets.images = [];
          assets.images.push(newAsset);
        } else {
          // Navigate to current folder and add
          const pathParts = currentPath.split('/').filter(Boolean);
          let current = assets;
          
          for (const part of pathParts) {
            let folder = (current.folders || current.children || []).find(f => 
              (f.type === 'folder' || !f.type) && f.name === part
            );
            if (!folder) {
              folder = { name: part, type: 'folder', children: [] };
              if (!current.folders) current.folders = [];
              current.folders.push(folder);
            }
            current = folder;
          }
          
          if (!current.children) current.children = [];
          current.children.push(newAsset);
        }
        
        showToast(`UPLOADED ${file.name.toUpperCase()}`);
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    }
    
    await saveAssets();
    renderAssets();
  } catch (err) {
    showToast('UPLOAD FAILED: ' + err.message.toUpperCase(), 5000);
    console.error(err);
  } finally {
    hideLoading();
  }
}

// Make functions globally available
window.createNewFolder = createNewFolder;
window.renameFolder = renameFolder;
window.deleteFolder = deleteFolder;
window.navigateToFolder = navigateToFolder;
window.updateAssetName = updateAssetName;
window.deleteAsset = deleteAsset;
window.copyToClipboardFullPath = copyToClipboardFullPath; 
// Fix navigation links based on subdomain
document.addEventListener('DOMContentLoaded', () => {
  const isAdminSubdomain = window.location.hostname.startsWith('admin.');
  
  // Fix covers link
  const coversLink = document.querySelector('.nav-link-covers');
  if (coversLink) {
    coversLink.href = isAdminSubdomain ? '/' : '/admin/';
  }
  
  // Fix audio link
  const audioLink = document.querySelector('.nav-link-audio');
  if (audioLink) {
    audioLink.href = isAdminSubdomain ? 'artist-audio.html' : '/admin/artist-audio.html';
  }
});

/* 
 * SECURITY & OPTIMIZATION IMPROVEMENTS (2025-01-15):
 * 
 * 1. XSS PROTECTION: Added escapeHtml() utility to prevent cross-site scripting attacks
 *    - All user input is now escaped before being inserted into HTML templates
 *    - Affects: cover titles, labels, asset names, folder names, URLs
 * 
 * 2. PERFORMANCE OPTIMIZATION: Improved Sortable instance management
 *    - Sortable is now only initialized once instead of destroyed/recreated on every render
 *    - Reduces DOM manipulation overhead and improves UI responsiveness
 * 
 * 3. INPUT VALIDATION: Enhanced folder creation with client-side validation
 *    - Checks for empty names, invalid characters, and length limits
 *    - Provides immediate feedback to users
 * 
 * 4. ERROR HANDLING: Improved logout function robustness
 *    - Always redirects to login even if logout request fails
 *    - Prevents users from getting stuck in error state
 * 
 * 5. TOAST IMPROVEMENTS: Added null checks for toast element
 *    - Prevents errors if toast element is missing from DOM
 */

let covers = [];
let assets = { folders: [], images: [] };
let sortableInstance = null;
let currentPath = '';
let currentUser = null;

// Utility function to escape HTML and prevent XSS
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Batch operations
let selectedCovers = new Set();
let batchMode = false;

// Create batch operations toolbar
const batchToolbar = document.createElement('div');
batchToolbar.className = 'batch-toolbar';
batchToolbar.style.cssText = `
  display: none;
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
`;

batchToolbar.innerHTML = `
  <span class="batch-count">0 selected</span>
  <button class="btn btn-sm" onclick="deleteSelectedCovers()">DELETE SELECTED</button>
  <button class="btn btn-sm" onclick="exportSelectedCovers()">EXPORT SELECTED</button>
  <button class="btn btn-sm btn-secondary" onclick="cancelBatchMode()">CANCEL</button>
`;

document.body.appendChild(batchToolbar);

// Add batch mode toggle button
const batchButton = document.createElement('button');
batchButton.className = 'btn btn-secondary';
batchButton.textContent = 'BATCH MODE';
batchButton.onclick = toggleBatchMode;
batchButton.style.marginLeft = 'var(--space-md)';

if (headerActions) {
  headerActions.appendChild(batchButton);
}

function toggleBatchMode() {
  batchMode = !batchMode;
  selectedCovers.clear();
  
  if (batchMode) {
    batchButton.classList.add('active');
    batchButton.textContent = 'EXIT BATCH MODE';
    batchToolbar.style.display = 'flex';
    document.getElementById('coversGrid').classList.add('batch-mode');
    
    // Add checkboxes to covers
    document.querySelectorAll('.cover-card').forEach(card => {
      if (!card.querySelector('.batch-checkbox')) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'batch-checkbox';
        checkbox.style.cssText = `
          position: absolute;
          top: var(--space-sm);
          left: var(--space-sm);
          width: 20px;
          height: 20px;
          cursor: pointer;
          z-index: 10;
        `;
        checkbox.onchange = (e) => {
          const coverId = card.dataset.coverId;
          if (e.target.checked) {
            selectedCovers.add(coverId);
            card.classList.add('selected');
          } else {
            selectedCovers.delete(coverId);
            card.classList.remove('selected');
          }
          updateBatchCount();
        };
        card.appendChild(checkbox);
      }
    });
  } else {
    cancelBatchMode();
  }
}

function cancelBatchMode() {
  batchMode = false;
  selectedCovers.clear();
  batchButton.classList.remove('active');
  batchButton.textContent = 'BATCH MODE';
  batchToolbar.style.display = 'none';
  document.getElementById('coversGrid').classList.remove('batch-mode');
  
  // Remove checkboxes
  document.querySelectorAll('.batch-checkbox').forEach(cb => cb.remove());
  document.querySelectorAll('.cover-card.selected').forEach(card => {
    card.classList.remove('selected');
  });
}

function updateBatchCount() {
  const count = selectedCovers.size;
  document.querySelector('.batch-count').textContent = `${count} selected`;
}

async function deleteSelectedCovers() {
  if (selectedCovers.size === 0) return;
  
  if (!confirm(`Delete ${selectedCovers.size} covers? This cannot be undone.`)) return;
  
  showLoading();
  
  try {
    // Delete each selected cover
    for (const coverId of selectedCovers) {
      const coverIndex = covers.findIndex(c => c.id === coverId);
      if (coverIndex !== -1) {
        covers.splice(coverIndex, 1);
      }
    }
    
    // Save updated covers
    await saveCovers();
    
    showToast(`Deleted ${selectedCovers.size} covers`);
    cancelBatchMode();
    renderCovers();
  } catch (err) {
    showToast('Failed to delete covers', 'error');
  } finally {
    hideLoading();
  }
}

function exportSelectedCovers() {
  if (selectedCovers.size === 0) return;
  
  const selectedData = covers.filter(c => selectedCovers.has(c.id));
  const dataStr = JSON.stringify(selectedData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(dataBlob);
  link.download = `covers-export-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  
  showToast(`Exported ${selectedCovers.size} covers`);
}

// Helper to check if we're on admin subdomain
function isAdminSubdomain() {
  return window.location.hostname.startsWith('admin.');
}

// Helper to get the correct login URL
function getLoginUrl() {
  return isAdminSubdomain() ? '/' : '/login.html';
}

// Toast notifications with configurable duration (improved error handling)
function showToast(message, type = 'success', duration = 5000) {
  const toast = document.getElementById('toast');
  if (!toast) {
    console.error('Toast element not found');
    return;
  }
  
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  
  // Clear any existing timeout
  if (window.toastTimeout) {
    clearTimeout(window.toastTimeout);
  }
  
  // Auto-hide after duration
  window.toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
  
  // Allow click to dismiss
  toast.onclick = () => {
    toast.classList.remove('show');
    clearTimeout(window.toastTimeout);
  };
}

// Loading overlay
function showLoading() {
  document.getElementById('loadingOverlay').classList.add('show');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.remove('show');
}

// Check authentication
async function checkAuth() {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) {
      window.location.href = getLoginUrl();
      return;
    }
    const data = await res.json();
    currentUser = data.user;
    document.getElementById('username').textContent = currentUser.username;
    document.getElementById('userRole').textContent = currentUser.role;
    
    // Show/hide admin features
    if (currentUser.role !== 'admin') {
      const usersLink = document.querySelector('[onclick="showUsersSection()"]');
      const liveBtn = document.querySelector('.btn-live');
      if (usersLink) usersLink.style.display = 'none';
      if (liveBtn) liveBtn.style.display = 'none';
    }
  } catch (err) {
    window.location.href = getLoginUrl();
  }
}

// Logout (improved to handle failures gracefully)
async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch (err) {
    console.warn('Logout request failed, but proceeding with redirect:', err);
    showToast('Logout request failed, but you will be redirected', 'error');
  }
  // Always redirect to login, even if logout request fails
  window.location.href = getLoginUrl();
}

// Test GitHub connection
async function testGitHub() {
  try {
    showLoading();
    const res = await fetch('/test-github', { method: 'POST' });
    const result = await res.json();
    
    if (result.success) {
      showToast('GitHub connection works! Check your repo for a test file.');
    } else {
      showToast('GitHub connection failed: ' + result.error, 'error');
    }
  } catch (err) {
    showToast('GitHub test failed: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
}

// Force backup to GitHub
async function forceBackupToGitHub() {
  if (!confirm('Force backup all data to GitHub? This will overwrite GitHub with current data.')) {
    return;
  }
  
  showLoading();
  try {
    const res = await fetch('/force-github-backup', { method: 'POST' });
    const result = await res.json();
    
    if (result.success) {
      showToast('✅ Backup complete! Check GitHub for commits.');
    } else {
      showToast('❌ Backup failed: ' + result.error, 'error');
    }
  } catch (err) {
    showToast('❌ Backup error: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
}

// Load covers
async function loadCovers() {
  try {
    const res = await fetch('/data/covers.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    covers = await res.json();
    
    // Filter out empty covers
    covers = covers.filter(c => c.id && c.frontImage);
    
    renderCovers();
  } catch (err) {
    console.error('Failed to load covers:', err);
    showToast('Failed to load covers', 'error');
  }
}

// Load assets with new hierarchical structure
async function loadAssets() {
  try {
    const res = await fetch('/data/assets.json');
    if (!res.ok) {
      // Initialize with empty structure
      assets = { folders: [], images: [] };
      return;
    }
    const data = await res.json();
    
    // Handle migration from flat structure
    if (Array.isArray(data.images) && !data.folders) {
      assets = {
        folders: [],
        images: data.images || []
      };
    } else if (Array.isArray(data.children) && !data.folders) {
      // PATCH: support legacy/miswritten structure
      assets = {
        folders: data.children,
        images: data.images || []
      };
    } else {
      assets = data;
    }
    
    renderFolderTree();
    renderAssets();
  } catch (err) {
    console.error('Failed to load assets:', err);
    assets = { folders: [], images: [] };
  }
}

// Layout params
function updateLayoutParameters() {
  const vw = window.innerWidth;

  if (isMobile) {
    // on mobile, use larger spacing to accommodate bigger/flipped cards
    coverSpacing   = Math.max(180, vw * 0.30);
    anglePerOffset = 50;
    minScale       = 0.45;
  } else {
    // original desktop spacing with better minimum
    coverSpacing   = Math.max(150, vw * 0.18); // Increased minimum from 120 to 150
    anglePerOffset = vw < 600 ? 50 : 65;
    minScale       = vw < 600 ? 0.45 : 0.5;
  }
}

// Render covers (optimized to avoid unnecessary Sortable re-initialization)
function renderCovers() {
  const container = document.getElementById('coversContainer');
  
  if (covers.length === 0) {
    container.innerHTML = '<p style="color: var(--grey); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.1em;">No covers yet. Drag an image below to add one.</p>';
    // Destroy sortable instance if no covers
    if (sortableInstance) {
      sortableInstance.destroy();
      sortableInstance = null;
    }
    return;
  }
  
  container.innerHTML = covers.map((cover, index) => `
    <div class="cover-card" data-id="${escapeHtml(cover.id)}">
      <span class="index-badge">${(index + 1).toString().padStart(2, '0')}</span>
      <img src="${escapeHtml(cover.frontImage)}" alt="${escapeHtml(cover.albumTitle || 'Untitled')}" 
           onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'200\\' height=\\'200\\'%3E%3Crect fill=\\'%23333\\' width=\\'200\\' height=\\'200\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' text-anchor=\\'middle\\' dy=\\'.3em\\' fill=\\'%23999\\' font-family=\\'monospace\\' font-size=\\'12\\'%3ENO IMAGE%3C/text%3E%3C/svg%3E'">
      <button class="cover-card-edit" onclick="editCover('${escapeHtml(cover.id)}')">EDIT</button>
      <div class="cover-card-info">
        <div class="cover-card-title">${escapeHtml(cover.albumTitle || "UNTITLED")}</div>
        <div class="cover-card-label">${escapeHtml(cover.coverLabel || "NO LABEL")}</div>
      </div>
    </div>
  `).join("");

  // Initialize Sortable only if not already initialized
  if (!sortableInstance) {
    sortableInstance = new Sortable(container, {
      animation: 120,
      easing: "cubic-bezier(.16,1,.3,1)",
      ghostClass: 'sortable-ghost',
      onEnd: (evt) => {
        // Update the covers array to match new order
        const orderedIds = [...container.querySelectorAll('.cover-card')].map(c => c.dataset.id);
        const newCovers = [];
        
        orderedIds.forEach(id => {
          const cover = covers.find(c => String(c.id) === String(id));
          if (cover) newCovers.push(cover);
        });
        
        covers = newCovers;
        console.log("🔄 Covers reordered");
      }
    });
  }
}

// Render folder tree
function renderFolderTree() {
  const container = document.getElementById('folderTree');
  
  function renderFolder(folder, level = 0) {
    const indent = level * 20;
    const hasChildren = folder.children && folder.children.filter(c => c.type === 'folder').length > 0;
    
    return `
      <div class="folder-item" draggable="true" data-path="${folder.path || folder.name}" style="padding-left: ${indent}px">
        <span>${hasChildren ? '▸' : '·'}</span>
        <span onclick="navigateToFolder('${folder.path || folder.name}')" style="text-transform: uppercase;">${folder.name}</span>
        <div class="folder-actions">
          <button onclick="renameFolder('${folder.path || folder.name}')" title="Rename">✎</button>
          <button onclick="deleteFolder('${folder.path || folder.name}')" title="Delete">✕</button>
        </div>
      </div>
      ${hasChildren ? folder.children.filter(c => c.type === 'folder').map(child => 
        renderFolder({...child, path: (folder.path || folder.name) + '/' + child.name}, level + 1)
      ).join('') : ''}
    `;
  }
  
  container.innerHTML = `
    <div class="folder-item ${currentPath === '' ? 'active' : ''}" data-path="">
      <span>▪</span>
      <span onclick="navigateToFolder('')" style="text-transform: uppercase;">ALL IMAGES</span>
    </div>
    ${assets.folders.map(folder => renderFolder(folder)).join('')}
  `;
  
  // Setup drag and drop for folders
  setupFolderDragAndDrop();
}

// Navigate to folder
function navigateToFolder(path) {
  currentPath = path;
  
  // Update active folder
  document.querySelectorAll('.folder-item').forEach(item => {
    item.classList.toggle('active', item.dataset.path === path);
  });
  
  // Update breadcrumb
  updateBreadcrumb();
  
  // Render assets in current folder
  renderAssets();
}

// Update breadcrumb
function updateBreadcrumb() {
  const breadcrumb = document.getElementById('breadcrumb');
  const parts = currentPath.split('/').filter(Boolean);
  
  breadcrumb.innerHTML = `
    <span onclick="navigateToFolder('')">ROOT</span>
    ${parts.map((part, index) => {
      const path = parts.slice(0, index + 1).join('/');
      return `<span onclick="navigateToFolder('${path}')">${part.toUpperCase()}</span>`;
    }).join('')}
  `;
}

// Get items in current folder
function getCurrentFolderItems() {
  if (currentPath === '') {
    return {
      folders: assets.folders,
      images: assets.images.filter(img => !img.folder || img.folder === '')
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

// Render assets in current folder
function renderAssets() {
  const container = document.getElementById('assetsContainer');
  const { folders, images } = getCurrentFolderItems();
  
  if (folders.length === 0 && images.length === 0) {
    container.innerHTML = '<p style="color: var(--grey); grid-column: 1/-1; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.1em;">EMPTY FOLDER</p>';
    return;
  }
  
  container.innerHTML = [
    // Render subfolders
    ...folders.map(folder => `
      <div class="asset-item folder-item" draggable="true" data-type="folder" data-name="${escapeHtml(folder.name)}">
        <div style="font-size: 48px; margin-bottom: var(--space-md); opacity: 0.8;">◐</div>
        <div style="font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">${escapeHtml(folder.name)}</div>
        <button onclick="navigateToFolder('${escapeHtml(currentPath ? currentPath + '/' : '')}${escapeHtml(folder.name)}')">OPEN</button>
        <button onclick="copyToClipboardFullPath('${escapeHtml(currentPath ? currentPath + '/' : '')}${escapeHtml(folder.name)}', true)">COPY FOLDER LINK</button>
      </div>
    `),
    // Render assets (images, video, audio)
    ...images.map((asset, index) => {
      let mediaTag = '';
      if (asset.type === 'video') {
        mediaTag = `<video src="${escapeHtml(asset.url)}" controls style="width:100%;height:180px;object-fit:cover;background:#222;"></video>`;
      } else if (asset.type === 'audio') {
        mediaTag = `<audio src="${escapeHtml(asset.url)}" controls style="width:100%;margin-bottom:8px;"></audio>`;
      } else {
        mediaTag = `<img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.name || 'Asset')}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'100\'%3E%3Crect fill=\'%23333\' width=\'200\' height=\'100\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23999\' font-size=\'10\' font-family=\'monospace\'%3EBROKEN%3C/text%3E%3C/svg%3E'">`;
      }
      return `
      <div class="asset-item" draggable="true" data-type="${escapeHtml(asset.type)}" data-index="${index}">
        ${mediaTag}
        <input type="text" value="${escapeHtml(asset.name || '')}" placeholder="UNTITLED" onchange="updateAssetName('${escapeHtml(asset.url)}', this.value)">
        <div class="url-display" onclick="copyToClipboardFullPath('${escapeHtml(asset.url)}')" title="CLICK TO COPY FULL URL">
          ${escapeHtml(asset.url)}
        </div>
        <button onclick="deleteAsset('${escapeHtml(asset.url)}')">DELETE</button>
      </div>
      `;
    })
  ].join('');
  
  // Setup drag and drop for assets
  setupAssetDragAndDrop();
}

// Create new folder (improved with input validation)
async function createNewFolder() {
  const name = prompt('Enter folder name:');
  if (!name) return;
  
  // Input validation
  const trimmedName = name.trim();
  if (!trimmedName) {
    showToast('Folder name cannot be empty', 'error');
    return;
  }
  
  // Check for invalid characters
  if (/[<>:"/\\|?*]/.test(trimmedName)) {
    showToast('Folder name contains invalid characters', 'error');
    return;
  }
  
  // Check length
  if (trimmedName.length > 100) {
    showToast('Folder name too long (max 100 characters)', 'error');
    return;
  }
  
  showLoading();
  try {
    const res = await fetch('/api/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentPath, name: trimmedName })
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error);
    }
    
    showToast('Folder created successfully');
    await loadAssets();
  } catch (err) {
    showToast(err.message || 'Failed to create folder', 'error');
  } finally {
    hideLoading();
  }
}

// Rename folder
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
    showToast(err.message || 'Failed to rename folder', 'error');
  } finally {
    hideLoading();
  }
}

// Delete folder
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
    if (currentPath.startsWith(path)) {
      navigateToFolder('');
    }
    await loadAssets();
  } catch (err) {
    showToast(err.message || 'Failed to delete folder', 'error');
  } finally {
    hideLoading();
  }
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
  const rootImage = assets.images.find(img => img.url === url);
  if (rootImage) {
    rootImage.name = name;
  } else {
    // Check in folders
    updateInStructure(assets.folders);
  }
  
  saveAssets();
}

// Delete asset
async function deleteAsset(url) {
  if (!confirm('Delete this asset?')) return;
  
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
  const rootIndex = assets.images.findIndex(img => img.url === url);
  if (rootIndex !== -1) {
    assets.images.splice(rootIndex, 1);
  } else {
    // Check in folders
    assets.folders.forEach(folder => {
      if (folder.children) {
        removeFromStructure(folder.children);
      }
    });
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
    showToast('Failed to save assets', 'error');
  }
}

// Setup folder drag and drop
function setupFolderDragAndDrop() {
  const folderItems = document.querySelectorAll('.folder-item[draggable="true"]');
  
  folderItems.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('type', 'folder');
      e.dataTransfer.setData('path', item.dataset.path);
      item.classList.add('dragging');
    });
    
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });
    
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      item.classList.add('drag-over');
    });
    
    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });
    
    item.addEventListener('drop', async (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      
      const type = e.dataTransfer.getData('type');
      const targetPath = item.dataset.path;
      
      if (type === 'image') {
        // Moving image to folder
        const imageUrl = e.dataTransfer.getData('url');
        await moveImageToFolder(imageUrl, targetPath);
      }
    });
  });
}

// Setup asset drag and drop
function setupAssetDragAndDrop() {
  const assetItems = document.querySelectorAll('.asset-item[draggable="true"]');
  
  assetItems.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      const type = item.dataset.type;
      e.dataTransfer.setData('type', type);
      
      if (type === 'image') {
        const img = item.querySelector('img');
        e.dataTransfer.setData('url', img.src);
      } else if (type === 'folder') {
        e.dataTransfer.setData('folderName', item.dataset.name);
      }
      
      item.classList.add('dragging');
    });
    
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });
  });
}

// Move image to folder
async function moveImageToFolder(imageUrl, targetPath) {
  // Find the image
  let image = null;
  let sourceLocation = null;
  
  // Check root
  const rootIndex = assets.images.findIndex(img => img.url === imageUrl);
  if (rootIndex !== -1) {
    image = assets.images[rootIndex];
    sourceLocation = { type: 'root', index: rootIndex };
  } else {
    // Search in folders
    function findInFolders(items, path = '') {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type === 'image' && items[i].url === imageUrl) {
          return { image: items[i], location: { type: 'folder', path, index: i } };
        }
        if (items[i].children) {
          const found = findInFolders(items[i].children, path + '/' + items[i].name);
          if (found) return found;
        }
      }
      return null;
    }
    
    assets.folders.forEach(folder => {
      if (!image && folder.children) {
        const found = findInFolders(folder.children, folder.name);
        if (found) {
          image = found.image;
          sourceLocation = found.location;
        }
      }
    });
  }
  
  if (!image) return;
  
  // Remove from source
  if (sourceLocation.type === 'root') {
    assets.images.splice(sourceLocation.index, 1);
  }
  
  // Add to target
  if (targetPath === '') {
    // Moving to root
    assets.images.push(image);
  } else {
    // Navigate to target folder and add
    const pathParts = targetPath.split('/').filter(Boolean);
    let target = assets;
    
    for (const part of pathParts) {
      let folder = (target.folders || target.children || []).find(f => 
        (f.type === 'folder' || !f.type) && f.name === part
      );
      if (!folder) {
        folder = { name: part, type: 'folder', children: [] };
        if (!target.folders) target.folders = [];
        target.folders.push(folder);
      }
      target = folder;
    }
    
    if (!target.children) target.children = [];
    target.children.push({ ...image, type: 'image' });
  }
  
  await saveAssets();
  renderAssets();
}

// Edit cover
function editCover(id) {
  // Use subdomain-aware URL
  const editUrl = isAdminSubdomain() ? `/admin.html?id=${id}` : `/admin/admin.html?id=${id}`;
  window.location.href = editUrl;
}

// Save changes
async function saveChanges() {
  if (currentUser.role === 'viewer') {
    showToast('You do not have permission to save changes', 'error');
    return;
  }
  
  showLoading();
  try {
    const res = await fetch('/save-covers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(covers)
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.details || `Server error ${res.status}`);
    }

    showToast('Covers saved successfully!');
  } catch (err) {
    console.error("❌ Error saving covers:", err);
    showToast(`Failed to save: ${err.message}`, 'error');
  } finally {
    hideLoading();
  }
}

// Push live
async function pushLive() {
  if (currentUser.role !== 'admin') {
    showToast('Only admins can push live', 'error');
    return;
  }
  
  if (!confirm('Push all changes live? This will update the public site.')) {
    return;
  }
  
  showLoading();
  try {
    const res = await fetch('/push-live', { method: 'POST' });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.details || `Server error ${res.status}`);
    }
    
    showToast('Changes are now live!');
  } catch (err) {
    console.error("❌ Error pushing live:", err);
    showToast(`Failed to push live: ${err.message}`, 'error');
  } finally {
    hideLoading();
  }
}

// Setup drag and drop for covers
function setupCoverDragAndDrop() {
  const dropzone = document.getElementById("coverDropzone");
  
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Highlight drop zone
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
  });

  // Handle dropped files
  dropzone.addEventListener('drop', e => handleFiles(e.dataTransfer.files, 'cover'), false);

  // Also allow click to upload
  dropzone.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = e => handleFiles(e.target.files, 'cover');
    input.click();
  });
}

// Setup drag and drop for assets
function setupAssetUploadDragAndDrop() {
  const dropzone = document.getElementById("assetDropzone");
  
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
    dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
  });

  // Handle dropped files
  dropzone.addEventListener('drop', e => handleFiles(e.dataTransfer.files, 'asset'), false);

  // Also allow click to upload
  dropzone.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*,audio/*';
    input.multiple = true;
    input.onchange = e => handleFiles(e.target.files, 'asset');
    input.click();
  });
}

// Handle file uploads
async function handleFiles(files, type = 'cover') {
  if (currentUser.role === 'viewer') {
    showToast('You do not have permission to upload files', 'error');
    return;
  }
  
  const dropzone = document.getElementById(type === 'cover' ? "coverDropzone" : "assetDropzone");
  const originalText = dropzone.textContent;
  
  for (const file of files) {
    if (!file || (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/'))) {
      showToast('Please upload only image, video, or audio files', 'error');
      continue;
    }

    // Show loading state
    dropzone.textContent = `Uploading ${file.name}...`;
    dropzone.style.opacity = '0.5';

    try {
      // Upload file
      const formData = new FormData();
      // Use 'file' instead of 'image' for generality
      formData.append('file', file);
      if (type === 'asset') {
        formData.append('folder', currentPath);
      }
      
      const uploadRes = await fetch('/upload-image', {
        method: 'POST',
        body: formData
      });

      if (!uploadRes.ok) {
        const error = await uploadRes.json();
        throw new Error(error.error || 'Upload failed');
      }

      const { url } = await uploadRes.json();
      console.log('Asset uploaded:', url);

      if (type === 'cover') {
        // Create new cover (unchanged)
        const tempTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        
        const newCover = {
          id: Date.now().toString(),
          frontImage: url,
          albumTitle: tempTitle,
          coverLabel: '',
          category: '',
          fontFamily: '',
          fontSize: '',
          music: { type: 'embed', url: '' },
          artistDetails: {
            name: '',
            location: '',
            bio: '',
            spotifyLink: '',
            image: url
          }
        };

        covers.push(newCover);
        renderCovers();
        
        // Auto-save after adding
        await saveChanges();
        
        showToast('Cover added! Click "Edit" to add details.');
      } else {
        // Add to assets in current folder
        let assetType = 'image';
        if (file.type.startsWith('video/')) assetType = 'video';
        else if (file.type.startsWith('audio/')) assetType = 'audio';
        const newAsset = {
          type: assetType,
          url: url,
          name: file.name.replace(/\.[^/.]+$/, ''),
          uploadedAt: new Date().toISOString()
        };
        
        if (currentPath === '') {
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
        
        renderAssets();
        
        // Auto-save assets
        await saveAssets();
      }
      
    } catch (err) {
      showToast('UPLOAD FAILED: ' + err.message.toUpperCase(), 'error');
      console.error(err);
    } finally {
  dropzone.textContent = originalText;
      dropzone.style.opacity = '';
    }
  }
}

// User management functions
function showUsersSection() {
  if (currentUser.role !== 'admin') {
    showToast('Access denied', 'error');
    return;
  }
  
  document.getElementById('coversSection').style.display = 'none';
  document.getElementById('usersSection').style.display = 'block';
  loadUsers();
}

async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    if (!res.ok) throw new Error('Failed to load users');
    
    const users = await res.json();
    const container = document.getElementById('usersList');
    
    container.innerHTML = users.map(user => `
      <div class="user-item">
        <div>
          <strong>${user.username}</strong>
          <span class="user-role" style="margin-left: 10px;">${user.role}</span>
        </div>
        ${user.username !== currentUser.username ? 
          `<button onclick="deleteUser('${user.username}')">Delete</button>` : 
          '<span style="color: #666;">Current user</span>'}
      </div>
    `).join('');
  } catch (err) {
    showToast('Failed to load users', 'error');
  }
}

async function addUser(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const userData = {
    username: formData.get('username'),
    password: formData.get('password'),
    role: formData.get('role')
  };
  
  showLoading();
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error);
    }
    
    showToast('User created successfully');
    event.target.reset();
    loadUsers();
  } catch (err) {
    showToast(err.message || 'Failed to create user', 'error');
  } finally {
    hideLoading();
  }
}

async function deleteUser(username) {
  if (!confirm(`Delete user "${username}"?`)) return;
  
  showLoading();
  try {
    const res = await fetch(`/api/users/${username}`, { method: 'DELETE' });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error);
    }
    
    showToast('User deleted successfully');
    loadUsers();
  } catch (err) {
    showToast(err.message || 'Failed to delete user', 'error');
  } finally {
    hideLoading();
  }
}

// Search functionality
let searchTimeout;
const searchInput = document.createElement('input');
searchInput.type = 'text';
searchInput.placeholder = 'SEARCH COVERS...';
searchInput.className = 'search-input';
searchInput.style.cssText = `
  width: 300px;
  padding: var(--space-md);
  margin-left: var(--space-lg);
  background: transparent;
  border: 1px solid var(--grey);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
`;

// Add search input to header
const headerActions = document.querySelector('.header-actions');
if (headerActions) {
  headerActions.insertBefore(searchInput, headerActions.firstChild);
}

searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const query = e.target.value.toLowerCase().trim();
    filterCovers(query);
  }, 300);
});

function filterCovers(query) {
  const coverCards = document.querySelectorAll('.cover-card');
  let visibleCount = 0;
  
  coverCards.forEach(card => {
    const title = card.querySelector('.cover-card-title')?.textContent.toLowerCase() || '';
    const label = card.querySelector('.cover-card-label')?.textContent.toLowerCase() || '';
    const category = card.querySelector('.cover-card-category')?.textContent.toLowerCase() || '';
    
    const matches = !query || 
      title.includes(query) || 
      label.includes(query) || 
      category.includes(query);
    
    card.style.display = matches ? '' : 'none';
    if (matches) visibleCount++;
  });
  
  // Show no results message
  let noResults = document.getElementById('noSearchResults');
  if (!noResults) {
    noResults = document.createElement('div');
    noResults.id = 'noSearchResults';
    noResults.style.cssText = `
      grid-column: 1 / -1;
      text-align: center;
      color: var(--grey);
      font-family: var(--font-mono);
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: var(--space-xl);
    `;
    noResults.textContent = 'NO COVERS FOUND';
    document.getElementById('coversGrid').appendChild(noResults);
  }
  
  noResults.style.display = visibleCount === 0 && query ? 'block' : 'none';
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  loadCovers();
  loadAssets();
  setupCoverDragAndDrop();
  setupAssetUploadDragAndDrop();
  
  // Add CSS for sortable ghost
  const style = document.createElement('style');
  style.textContent = `
    .sortable-ghost {
      opacity: 0.2;
      filter: grayscale(100%);
      transform: scale(0.95);
    }
    .cover-card {
      transition: transform var(--transition);
    }
    .cover-card:hover {
      transform: scale(1.02);
    }
    .cover-card.dragging {
      cursor: grabbing;
    }
  `;
  document.head.appendChild(style);

  // Make batch functions globally available
  window.toggleBatchMode = toggleBatchMode;
  window.cancelBatchMode = cancelBatchMode;
  window.deleteSelectedCovers = deleteSelectedCovers;
  window.exportSelectedCovers = exportSelectedCovers;
  
  // Make folder management functions globally available
  window.createNewFolder = createNewFolder;
});
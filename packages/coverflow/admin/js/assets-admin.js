/**
 * AMF ADMIN — Assets & Uploads Module
 * Handles all asset management, image library, and upload functionality
 */

// Asset state
window.assets = { images: [], folders: [], children: [] };
window.filteredAssets = [];
window.currentFolder = '';
window.currentPath = '';
window.selectedAssets = new Set();
window.assetMultiSelectMode = false;
window.lastSelectedAssetIndex = -1;
window.draggedAssets = new Set();
window.isDraggingAssets = false;
// Pagination for assets grid (per folder)
window.assetsPerPage = 48;
window.assetCurrentPage = 1;
window.sortBy = 'name';
window.assetViewMode = 'grid';
window.assetTypeFilter = '';
window.assetSortOrder = 'date-desc';

// Image cropper state
window.dashboardImageLibraryTarget = null;
window.currentImageCropper = null;
window.currentCropTargetField = null;

// Load assets from server
window.loadAssets = async function() {
  try {
    // Always start with a sane default
    window.assets = { images: [], folders: [], children: [] };

    // 1) Load structured folders + any pre-defined assets from assets.json
    try {
      const data = window.loadJsonData
        ? await window.loadJsonData('/data/assets.json', {})
        : await fetch('/data/assets.json').then(r => r.json());
      console.log('[FRONTEND] Loaded assets.json:', data);
      window.assets = data || window.assets;
    } catch (err) {
      console.error('Failed to load assets.json:', err);
      showToast(`FAILED TO LOAD ASSETS.JSON: ${err.message}`, 5000);
    }

    // Warn if any non-GCS URLs snuck in
    checkForNonGCSUrls();
    renderFolders();

    // 2) Best-effort: augment with live GCS listing (do not abort UI on failure)
    try {
      console.log('Attempting to load GCS assets...');
      const gcsRes = await fetch('/api/list-gcs-assets');
      if (gcsRes.status === 401) {
        showToast('AUTHENTICATION REQUIRED FOR GCS ASSETS');
        window.location.href = '/login.html';
        return;
      }
      if (!gcsRes.ok) {
        throw new Error(`Failed to load GCS assets: ${gcsRes.status} ${gcsRes.statusText}`);
      }
      const gcsData = await gcsRes.json();
      console.log('GCS response:', gcsData);
      
      if (gcsData.images && gcsData.images.length > 0) {
        const mapped = gcsData.images.map(url => {
          const filename = url.split('/').pop().toLowerCase();
          const isVideo = filename.match(/\.(mov|mp4|webm|avi)$/i);
          return {
            url,
            type: isVideo ? 'video' : 'image',
            name: url.split('/').pop(),
            source: 'gcs'
          };
        });
        // Merge with any existing images instead of overwriting
        const existing = Array.isArray(window.assets.images) ? window.assets.images : [];
        window.assets.images = [...existing, ...mapped];
        console.log(`Loaded ${gcsData.images.length} GCS assets`);
        showToast(`LOADED ${gcsData.images.length} GCS ASSETS`);
      } else {
        console.warn('No GCS images found in response');
        showToast('NO GCS ASSETS FOUND', 3000);
      }
    } catch (err) {
      console.error('Failed to load GCS assets:', err);
      showToast(`GCS LOAD ERROR: ${err.message}`, 5000);
    }

    // Render whatever we have
    console.log('Current assets:', window.assets);
    console.log('Total images:', window.assets.images?.length || 0);
    renderAssetsWithView();
    renderRecentAssets();
  } catch (err) {
    console.error('Failed to load assets (outer):', err);
    showToast(`FAILED TO LOAD ASSETS: ${err.message}`, 5000);
  }
};

// Check for non-GCS URLs
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
  if (scan(window.assets)) {
    console.warn('[ADMIN WARNING] Non-GCS image URL detected in assets.json!');
    const warning = document.createElement('div');
    warning.textContent = 'WARNING: Some image URLs are not GCS URLs!';
    warning.style = 'background: #ffcc00; color: #222; padding: 8px; font-weight: bold; text-align: center;';
    document.body.insertBefore(warning, document.body.firstChild);
  }
}

// Render folders
window.renderFolders = function() {
  const folderTree = document.getElementById('folderTree');
  if (!folderTree) return;
  folderTree.innerHTML = '';
  
  // Root folder
  const rootItem = document.createElement('li');
  rootItem.className = 'folder-item' + (window.currentPath === '' ? ' active' : '');
  rootItem.innerHTML = `<span onclick="navigateToFolder('')" style="cursor: pointer;">ROOT</span>`;
  rootItem.dataset.path = '';
  
  // Add drop zone functionality to root folder
  if (window.setupFolderDropZone) {
    window.setupFolderDropZone(rootItem, '');
  }
  
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
    const allChildren = mergeFoldersAndChildren(folder);
    const hasChildren = allChildren.length > 0;
    const folderPath = folder.path || folder.name;
    
    li.className = 'folder-item' + (window.currentPath === folderPath ? ' active' : '');
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
    
    if (window.setupFolderDropZone) {
      window.setupFolderDropZone(li, folderPath);
    }
    
    folderTree.appendChild(li);
    
    if (hasChildren) {
      allChildren.forEach(child => renderFolder(child, level + 1));
    }
  }

  // Render all root folders
  const rootFolders = mergeFoldersAndChildren(window.assets);
  rootFolders.forEach(folder => renderFolder(folder));
};

// Navigate to folder
window.navigateToFolder = function(path) {
  window.currentPath = path;
  window.currentFolder = path;
  updateCurrentFolderIndicator();
  renderAssetsWithView();
  
  document.querySelectorAll('.folder-item').forEach(item => {
    item.classList.toggle('active', item.dataset.path === path);
  });
};

// Update current folder indicator
window.updateCurrentFolderIndicator = function() {
  const indicator = document.getElementById('currentFolderIndicator');
  if (indicator) {
    const parts = (window.currentPath || '').split('/').filter(Boolean);
    const label = parts.length ? parts.join(' / ') : 'ROOT';
    indicator.textContent = `Current Folder: ${label}`;
  }
};

// Get items in current folder
function getCurrentFolderItems() {
  if (!window.currentPath) {
    // For root folder, show all images including GCS images
    const allImages = window.assets.images || [];
    const folders = window.assets.children || [];
    console.log('Root folder - images:', allImages.length, 'folders:', folders.length);
    return { images: allImages, folders: folders };
  }

  function findFolder(items, targetPath) {
    for (const item of items) {
      if ((item.path || item.name) === targetPath) return item;
      const childFolders = [].concat(item.folders || [], item.children || [])
        .filter(f => f && f.type === 'folder');
      const found = findFolder(childFolders, targetPath);
      if (found) return found;
    }
    return null;
  }

  const targetFolder = findFolder(window.assets.children || [], window.currentPath);
  if (!targetFolder) return { images: [], folders: [] };

  const images = (targetFolder.images || []).concat(targetFolder.children?.filter(c => c.type === 'image') || []);
  const folders = (targetFolder.folders || []).concat(targetFolder.children?.filter(c => c.type === 'folder') || []);
  return { images, folders };
}

// Render assets
window.renderAssetsWithView = function() {
  // Main asset grid container in the Assets section
  const assetGrid = document.getElementById('assetsContainer') || document.getElementById('assetGrid');
  if (!assetGrid) return;

  const { images, folders } = getCurrentFolderItems();
  let assetsToShow = images;
  
  if (!window.assetMultiSelectMode) {
    assetsToShow = [...folders.map(f => ({ ...f, isFolder: true })), ...images];
  }

  // Apply search filter if active
  if (window.filteredAssets.length > 0 || document.getElementById('assetSearch')?.value) {
    assetsToShow = window.filteredAssets.length > 0 ? window.filteredAssets : assetsToShow;
  }

  // Apply type filter (images vs videos)
  if (window.assetTypeFilter) {
    assetsToShow = assetsToShow.filter(asset => {
      if (asset.isFolder) return true; // keep folders visible
      return asset.type === window.assetTypeFilter;
    });
  }

  // Apply sorting
  const sortOrder = window.assetSortOrder || 'date-desc';
  if (sortOrder.startsWith('name')) {
    assetsToShow.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (sortOrder === 'name-desc') assetsToShow.reverse();
  } else if (sortOrder.startsWith('date')) {
    assetsToShow.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
    if (sortOrder === 'date-asc') assetsToShow.reverse();
  } else if (sortOrder.startsWith('size')) {
    assetsToShow.sort((a, b) => (b.size || 0) - (a.size || 0));
    if (sortOrder === 'size-asc') assetsToShow.reverse();
  }

  // Pagination
  const totalAssets = assetsToShow.length;
  const pageSize = window.assetsPerPage || 48;
  const totalPages = Math.max(1, Math.ceil(totalAssets / pageSize));
  if (!window.assetCurrentPage || window.assetCurrentPage < 1) window.assetCurrentPage = 1;
  if (window.assetCurrentPage > totalPages) window.assetCurrentPage = totalPages;
  const startIndex = (window.assetCurrentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageAssets = assetsToShow.slice(startIndex, endIndex);

  // Update asset count indicator
  const countIndicator = document.getElementById('assetCountIndicator');
  if (countIndicator) {
    const suffix = totalAssets === 1 ? 'ASSET' : 'ASSETS';
    countIndicator.textContent = `${totalAssets} ${suffix}`;
  }

  // Clear and render
  assetGrid.innerHTML = '';
  assetGrid.className = `asset-grid asset-view-${window.assetViewMode} ${window.mediaLibraryExpanded ? 'expanded' : ''}`;

  if (pageAssets.length === 0) {
    assetGrid.innerHTML = '<div class="empty-state">No assets in this folder</div>';
  } else {
    // Render items for current page
    pageAssets.forEach((asset, index) => {
    if (asset.isFolder) {
      const folderDiv = createFolderElement(asset);
      assetGrid.appendChild(folderDiv);
    } else {
      const assetDiv = createAssetElement(asset, index);
      assetGrid.appendChild(assetDiv);
      }
    });
  }

  // Update pagination controls
  const pagination = document.getElementById('assetPaginationControls');
  const pageInfo = document.getElementById('assetPageInfo');
  const prevBtn = document.getElementById('assetPrevPage');
  const nextBtn = document.getElementById('assetNextPage');

  if (pagination && pageInfo) {
    if (totalPages > 1) {
      pagination.style.display = 'flex';
      pageInfo.textContent = `${window.assetCurrentPage} / ${totalPages}`;
      if (prevBtn) prevBtn.disabled = window.assetCurrentPage <= 1;
      if (nextBtn) nextBtn.disabled = window.assetCurrentPage >= totalPages;
    } else {
      pagination.style.display = 'none';
    }
  }
};

// Change page in Assets grid
window.changeAssetPage = function(delta) {
  window.assetCurrentPage = (window.assetCurrentPage || 1) + delta;
  if (window.assetCurrentPage < 1) window.assetCurrentPage = 1;
  renderAssetsWithView();
};

// View mode handling for Assets section
window.setAssetViewMode = function(mode) {
  window.assetViewMode = mode;
  
  // Persist preference
  try {
    localStorage.setItem('amfAdmin.assets.viewMode', mode);
  } catch (err) {
    console.warn('Could not persist assets view mode', err);
  }
  
  // Update active button styles
  document.querySelectorAll('.asset-view-modes .view-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === mode);
  });
  
  // Re-render with the new mode
  renderAssetsWithView();
  showToast(`ASSET VIEW: ${mode.toUpperCase()}`, 1500);
};

// Create folder element
function createFolderElement(folder) {
  const div = document.createElement('div');
  div.className = 'folder-card';
  div.dataset.folderPath = folder.path || folder.name;
  
  div.innerHTML = `
    <div class="folder-icon">📁</div>
    <div class="folder-name">${folder.name}</div>
  `;
  
  div.addEventListener('click', () => {
    navigateToFolder(folder.path || folder.name);
  });
  
  return div;
}

// Create asset element
function createAssetElement(asset, index) {
  const div = document.createElement('div');
  div.className = 'asset-item';
  div.dataset.assetId = asset.url;
  div.dataset.assetIndex = index;

  if (window.selectedAssets.has(asset.url)) {
    div.classList.add('selected');
  }

  const isVideo = asset.type === 'video';
  
  div.innerHTML = `
    ${window.assetMultiSelectMode ? `
      <input type="checkbox" class="asset-checkbox" ${window.selectedAssets.has(asset.url) ? 'checked' : ''}>
    ` : ''}
    <div class="asset-preview" ${!window.assetMultiSelectMode ? `onclick="copyAssetUrl('${asset.url}')"` : ''}>
      ${isVideo ? 
        `<video src="${asset.url}" muted loop></video>` : 
        `<img src="${asset.url}" alt="${asset.name || ''}" loading="lazy">`
      }
      <div class="asset-overlay">
        <span class="asset-name">${asset.name || 'Unnamed'}</span>
        ${!window.assetMultiSelectMode ? '<span class="asset-action">CLICK TO COPY URL</span>' : ''}
      </div>
    </div>
  `;

  // Multi-select handling
  if (window.assetMultiSelectMode) {
    const checkbox = div.querySelector('.asset-checkbox');
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        window.selectedAssets.add(asset.url);
      } else {
        window.selectedAssets.delete(asset.url);
      }
      div.classList.toggle('selected', e.target.checked);
      updateAssetSelectionCounter();
    });
    
    div.addEventListener('click', (e) => {
      if (e.target.type !== 'checkbox') {
        handleAssetClick(e, asset.url, index);
      }
    });
  }

  return div;
}

// Copy asset URL
window.copyAssetUrl = function(url) {
  navigator.clipboard.writeText(url).then(() => {
    showToast('URL COPIED TO CLIPBOARD', 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
    showToast('FAILED TO COPY URL', 3000);
  });
};

// Render recent assets
window.renderRecentAssets = function() {
  const container = document.getElementById('recentAssetsContainer');
  if (!container) return;
  
  const allImages = window.assets.images || [];
  const recent = allImages
    .filter(asset => asset.uploadedAt)
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    .slice(0, 6);
  
  container.innerHTML = '';
  
  if (recent.length === 0) {
    container.innerHTML = '<div class="empty-state">No recent uploads</div>';
    return;
  }
  
  recent.forEach(asset => {
    const div = document.createElement('div');
    div.className = 'recent-asset';
    div.innerHTML = `
      <img src="${asset.url}" alt="${asset.name}" onclick="copyAssetUrl('${asset.url}')">
      <div class="asset-name">${asset.name || 'Unnamed'}</div>
    `;
    container.appendChild(div);
  });
};

// Refresh assets from server/GCS
window.refreshAssets = async function() {
  try {
    showLoading();
    window.assetCurrentPage = 1;
    await loadAssets();
    renderAssetsWithView();
    showToast('ASSETS REFRESHED', 2000);
  } finally {
    hideLoading();
  }
};

// Create new folder
window.createNewFolder = async function() {
  const folderName = prompt('Enter folder name:');
  if (!folderName) return;
  
  const cleanName = folderName.trim().replace(/[^a-zA-Z0-9-_ ]/g, '');
  if (!cleanName) {
    showToast('Invalid folder name', 3000);
    return;
  }
  
  const newFolder = {
    type: 'folder',
    name: cleanName,
    path: window.currentPath ? `${window.currentPath}/${cleanName}` : cleanName,
    children: []
  };
  
  // Add to current location
  if (!window.currentPath) {
    if (!window.assets.children) window.assets.children = [];
    window.assets.children.push(newFolder);
  } else {
    // Find current folder and add
    const current = findFolderByPath(window.currentPath);
    if (current) {
      if (!current.children) current.children = [];
      current.children.push(newFolder);
    }
  }
  
  await saveAssets();
  renderFolders();
  renderAssetsWithView();
  showToast('FOLDER CREATED', 2000);
};

// Delete folder
window.deleteFolder = async function(folderPath) {
  if (!confirm(`Delete folder "${folderPath}"? This will also delete all contents.`)) return;
  
  // Remove from assets structure
  function removeFolder(items, targetPath) {
    for (let i = 0; i < items.length; i++) {
      if ((items[i].path || items[i].name) === targetPath) {
        items.splice(i, 1);
        return true;
      }
      const childFolders = [].concat(items[i].folders || [], items[i].children || [])
        .filter(f => f && f.type === 'folder');
      if (removeFolder(childFolders, targetPath)) return true;
    }
    return false;
  }
  
  removeFolder(window.assets.children || [], folderPath);
  
  await saveAssets();
  renderFolders();
  renderAssetsWithView();
  showToast('FOLDER DELETED', 2000);
};

// Rename folder
window.renameFolder = async function(folderPath) {
  const folder = findFolderByPath(folderPath);
  if (!folder) return;
  
  const newName = prompt('Enter new folder name:', folder.name);
  if (!newName || newName === folder.name) return;
  
  const cleanName = newName.trim().replace(/[^a-zA-Z0-9-_ ]/g, '');
  if (!cleanName) {
    showToast('Invalid folder name', 3000);
    return;
  }
  
  folder.name = cleanName;
  // Update path if needed
  const parentPath = folderPath.split('/').slice(0, -1).join('/');
  folder.path = parentPath ? `${parentPath}/${cleanName}` : cleanName;
  
  await saveAssets();
  renderFolders();
  renderAssetsWithView();
  showToast('FOLDER RENAMED', 2000);
};

// Find folder by path
function findFolderByPath(targetPath) {
  function findInItems(items) {
    for (const item of items) {
      if ((item.path || item.name) === targetPath) return item;
      const childFolders = [].concat(item.folders || [], item.children || [])
        .filter(f => f && f.type === 'folder');
      const found = findInItems(childFolders);
      if (found) return found;
    }
    return null;
  }
  return findInItems(window.assets.children || []);
}

// Save assets
async function saveAssets() {
  try {
    await apiCall('/save-assets', {
      method: 'POST',
      body: JSON.stringify(window.assets)
    });
    showToast('ASSETS SAVED', 2000);
  } catch (err) {
    console.error('Failed to save assets:', err);
    showToast('FAILED TO SAVE ASSETS: ' + err.message, 5000);
  }
}

// Upload functionality
window.handleModalImageUpload = async function(file) {
  const dropText = document.getElementById('modalDropzoneText');
  if (dropText) dropText.textContent = 'Uploading...';
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', window.currentFolder || '');
    
    const res = await fetch('/upload-image', { method: 'POST', body: formData });
    const data = await res.json();
    
    if (res.ok && data.url) {
      // Add to assets immediately
      if (!window.assets.images) window.assets.images = [];
      window.assets.images.push({ 
        type: 'image', 
        url: data.url, 
        name: file.name, 
        uploadedAt: new Date().toISOString() 
      });
      
      // Decide which image field to target
      const targetField = window.currentCropTargetField || 'frontImage';
      const form = document.getElementById('editCoverForm');
      
      if (form) {
        const input = form.querySelector(`input[name='${targetField}']`);
        if (input) {
          input.value = data.url;
        }
      }
      
      const preview = document.getElementById(`${targetField}Preview`);
      if (preview) {
        preview.src = data.url;
      }
      
      showToast('IMAGE UPLOADED', 3000);
    } else {
      showToast('UPLOAD FAILED: ' + (data.error || 'Unknown error'), 5000);
    }
  } catch (err) {
    showToast('UPLOAD FAILED: ' + err.message, 5000);
  } finally {
    if (dropText) dropText.textContent = 'Drag & drop or click to upload';
  }
};

// Device image upload handler
window.handleDeviceImageUpload = function(event, targetField) {
  const file = event.target.files[0];
  if (!file) return;
  
  window.currentCropTargetField = targetField;
  handleModalImageUpload(file);
};

// Image library modal
window.openImageLibrary = function(inputField) {
  window.dashboardImageLibraryTarget = inputField;
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
  const allImages = (window.assets.images || []).filter(a => {
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
        const input = document.querySelector(`#editCoverForm input[name='${window.dashboardImageLibraryTarget}']`);
        if (input) {
          input.value = img.url;
        }
        // Update preview image
        const preview = document.getElementById(`${window.dashboardImageLibraryTarget}Preview`);
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
  window.dashboardImageLibraryTarget = null;
};

// Image cropper
window.openImageCropper = function(targetField) {
  try {
    window.currentCropTargetField = targetField;
    const form = document.getElementById('editCoverForm');
    if (!form) return;
    const input = form.querySelector(`input[name='${targetField}']`);
    const preview = document.getElementById(`${targetField}Preview`);
    const imageUrl = (input && input.value) || (preview && preview.src);
    if (!imageUrl) {
      showToast('No image to crop yet. Please choose an image first.', 4000);
      return;
    }
    
    let modal = document.getElementById('imageCropperModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'imageCropperModal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;';
      modal.innerHTML = `
        <div style="background:#111; padding:24px; max-width:900px; width:90vw; max-height:90vh; border-radius:12px; position:relative; display:flex; flex-direction:column; gap:16px;">
          <button type="button" id="closeImageCropper" style="position:absolute; top:12px; right:12px; background:none; border:none; color:#fff; font-size:2rem; cursor:pointer;">×</button>
          <h2 style="margin:0 0 8px 0; color:#fff; font-family:var(--font-mono); font-size:0.9rem; letter-spacing:0.2em;">CROP COVER IMAGE</h2>
          <div style="flex:1; min-height:300px; max-height:60vh; overflow:hidden; background:#000;">
            <img id="imageCropperImage" src="" style="max-width:100%; display:block; margin:0 auto; touch-action:none;">
          </div>
          <div style="display:flex; justify-content:space-between; gap:12px; margin-top:8px;">
            <div style="color:#aaa; font-size:0.8rem; font-family:var(--font-mono);">
              Drag to reframe. Use pinch/scroll to zoom. Output is always a square cover.
            </div>
            <div style="display:flex; gap:8px;">
              <button type="button" id="resetImageCropper" class="btn">RESET</button>
              <button type="button" id="saveImageCropper" class="btn btn-primary">SAVE CROP</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById('closeImageCropper').onclick = closeImageCropper;
      document.getElementById('resetImageCropper').onclick = () => {
        if (window.currentImageCropper) window.currentImageCropper.reset();
      };
      document.getElementById('saveImageCropper').onclick = saveImageCropper;
    } else {
      modal.style.display = 'flex';
    }
    
    const imgEl = document.getElementById('imageCropperImage');
    imgEl.src = imageUrl;
    
    if (window.currentImageCropper) {
      window.currentImageCropper.destroy();
      window.currentImageCropper = null;
    }
    
    // Initialize cropper after image loads
    const initCropper = () => {
      if (window.Cropper) {
        window.currentImageCropper = new Cropper(imgEl, {
          aspectRatio: 1,
          viewMode: 1,
          background: false,
          autoCropArea: 1,
          movable: true,
          zoomable: true,
          zoomOnWheel: true,
          scalable: false,
          rotatable: false,
          responsive: true,
        });
      } else {
        showToast('Image cropper library not loaded.', 4000);
        return;
      }
    };
    
    if (imgEl.complete && imgEl.naturalWidth > 0) {
      initCropper();
    } else {
      imgEl.onload = initCropper;
    }
    
  } catch (err) {
    console.error('Error opening image cropper:', err);
    showToast('Error opening image cropper.', 4000);
  }
};

function closeImageCropper() {
  const modal = document.getElementById('imageCropperModal');
  if (modal) modal.style.display = 'none';
  if (window.currentImageCropper) {
    window.currentImageCropper.destroy();
    window.currentImageCropper = null;
  }
  window.currentCropTargetField = null;
}

async function saveImageCropper() {
  if (!window.currentImageCropper || !window.currentCropTargetField) {
    closeImageCropper();
    return;
  }
  try {
    const canvas = window.currentImageCropper.getCroppedCanvas({ width: 1600, height: 1600 });
    if (!canvas) {
      showToast('Unable to crop image.', 4000);
      return;
    }
    canvas.toBlob(async (blob) => {
      if (!blob) {
        showToast('Unable to export cropped image.', 4000);
        return;
      }
      const formData = new FormData();
      formData.append('file', blob, `${window.currentCropTargetField}-cover.jpg`);
      formData.append('folder', 'covers');
      try {
        const res = await fetch('/upload-image', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok && data.url) {
          const form = document.getElementById('editCoverForm');
          if (form) {
            const input = form.querySelector(`input[name='${window.currentCropTargetField}']`);
            if (input) {
              input.value = data.url;
            }
          }
          const preview = document.getElementById(`${window.currentCropTargetField}Preview`);
          if (preview) {
            preview.src = data.url;
          }
          closeImageCropper();
          showToast('IMAGE CROPPED AND SAVED', 3000);
        } else {
          showToast('Failed to save cropped image.', 4000);
        }
      } catch (err) {
        console.error('Crop upload error:', err);
        showToast('Failed to upload cropped image.', 4000);
      }
    }, 'image/jpeg', 0.9);
  } catch (err) {
    console.error('Error saving cropped image:', err);
    showToast('Error saving cropped image.', 4000);
  }
}

// Multi-select functionality
function handleAssetClick(event, assetId, index) {
  if (event.target.type === 'checkbox') return;
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON') return;
  
  if (!window.assetMultiSelectMode) {
    copyAssetUrl(assetId);
    return;
  }
  
  toggleAssetSelection(assetId, index, event);
}

function toggleAssetSelection(assetId, index, event) {
  if (event.shiftKey && window.lastSelectedAssetIndex !== -1) {
    // Shift+click: select range
    const start = Math.min(window.lastSelectedAssetIndex, index);
    const end = Math.max(window.lastSelectedAssetIndex, index);
    const assetsToShow = window.filteredAssets.length > 0 || document.getElementById('assetSearch')?.value 
      ? window.filteredAssets 
      : getCurrentFolderItems().images;
    
    for (let i = start; i <= end; i++) {
      if (i < assetsToShow.length) {
        window.selectedAssets.add(assetsToShow[i].url);
      }
    }
  } else if (event.ctrlKey || event.metaKey) {
    // Ctrl/Cmd+click: toggle individual selection
    if (window.selectedAssets.has(assetId)) {
      window.selectedAssets.delete(assetId);
    } else {
      window.selectedAssets.add(assetId);
    }
  } else {
    // Regular click: toggle individual selection
    if (window.selectedAssets.has(assetId)) {
      window.selectedAssets.delete(assetId);
    } else {
      window.selectedAssets.add(assetId);
    }
  }
  
  window.lastSelectedAssetIndex = index;
  renderAssetsWithView();
  updateAssetSelectionCounter();
}

function updateAssetSelectionCounter() {
  const counter = document.getElementById('assetSelectionCounter');
  if (counter) {
    counter.textContent = `${window.selectedAssets.size} selected`;
    counter.style.display = window.selectedAssets.size > 0 ? 'block' : 'none';
  }
}

// Enhanced asset search
window.setupEnhancedAssetSearch = function() {
  const searchInput = document.getElementById('assetSearch');
  const typeSelect = document.getElementById('assetTypeFilter');
  const sortSelect = document.getElementById('assetSortOrder');
  if (!searchInput) return;
  
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const searchTerm = e.target.value.toLowerCase();
    
    searchTimeout = setTimeout(() => {
      if (searchTerm) {
        const { images } = getCurrentFolderItems();
        window.filteredAssets = images.filter(asset => 
          asset.name?.toLowerCase().includes(searchTerm) ||
          asset.url?.toLowerCase().includes(searchTerm)
        );
      } else {
        window.filteredAssets = [];
      }
      window.assetCurrentPage = 1;
      renderAssetsWithView();
    }, 300);
  });
  
  // Type filter (images / videos / documents)
  if (typeSelect) {
    typeSelect.addEventListener('change', (e) => {
      window.assetTypeFilter = e.target.value || '';
      window.assetCurrentPage = 1;
      renderAssetsWithView();
    });
  }
  
  // Sort order
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      window.assetSortOrder = e.target.value || 'date-desc';
      window.assetCurrentPage = 1;
      renderAssetsWithView();
    });
  }
};

// Setup drag and drop for assets
window.setupAssetDragAndDrop = function() {
  const dropZone = document.getElementById('assetDropzone');
  if (!dropZone) return;
  
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });
  
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
  });
  
  dropZone.addEventListener('drop', handleDrop, false);
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  function highlight(e) {
    dropZone.classList.add('dragover');
  }
  
  function unhighlight(e) {
    dropZone.classList.remove('dragover');
  }
  
  async function handleDrop(e) {
    const files = [...e.dataTransfer.files];
    for (const file of files) {
      await handleModalImageUpload(file);
    }
    loadAssets(); // Refresh assets list
  }
};

// Modal dropzone setup
window.setupModalDropzone = function(container) {
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
};

// Initialize assets module
window.initializeAssets = function() {
  console.log('🖼️ Assets Module Initialized');
  
  // Restore last used asset view mode first so initial render matches preference
  try {
    const saved = localStorage.getItem('amfAdmin.assets.viewMode');
    if (saved) {
      window.assetViewMode = saved;
    }
  } catch (err) {
    console.warn('Could not read saved assets view mode', err);
  }
  
  loadAssets().then(() => {
    // Reset to first page on initial load
    window.assetCurrentPage = 1;
    renderAssetsWithView();
  });
  setupEnhancedAssetSearch();
  setupAssetDragAndDrop();
};

// Export for shared use
window.assetsModule = {
  loadAssets,
  renderFolders,
  renderAssetsWithView,
  openImageLibrary,
  openImageCropper,
  handleModalImageUpload,
  handleDeviceImageUpload,
  setupModalDropzone
};

/**
 * AMF ADMIN — Covers Management Module
 * Handles all covers-related functionality
 */

// Covers state
window.covers = [];
window.filteredCovers = [];
window.recentCovers = [];
window.batchMode = false;
window.selectedCovers = new Set();
window.currentCoverPage = 1;
window.coversPerPage = 20;
window.searchTerm = '';
window.categoryFilter = '';
window.sortOrder = 'index';
window.currentViewMode = 'grid';
window.showFullView = false;

// Load covers from server
window.loadCovers = async function() {
  try {
    showLoading('covers');
    const data = await loadJsonData('/data/covers.json', []);
    window.covers = data;
    
    // Update recent covers
    const sortedByTime = [...data].sort((a, b) => {
      const timeA = a.lastModified || a.uploadedAt || 0;
      const timeB = b.lastModified || b.uploadedAt || 0;
      return new Date(timeB) - new Date(timeA);
    });
    window.recentCovers = sortedByTime.slice(0, 3);
    
    renderCovers();
    renderRecentCovers();
    updateSaveButton();
    hideLoading();
  } catch (err) {
    console.error('Failed to load covers:', err);
    showToast('Failed to load covers: ' + err.message, 5000);
    hideLoading();
  }
};

// Render covers grid/list/coverflow
window.renderCovers = function(search = '') {
  const container = document.getElementById('coversContainer');
  if (!container) return;
  
  // Apply search and filters
  let filtered = window.covers;
  
  if (search || window.searchTerm) {
    const term = (search || window.searchTerm).toLowerCase();
    filtered = filtered.filter(cover => 
      cover.albumTitle?.toLowerCase().includes(term) ||
      cover.coverLabel?.toLowerCase().includes(term) ||
      cover.artistDetails?.name?.toLowerCase().includes(term)
    );
  }
  
  if (window.categoryFilter) {
    filtered = filtered.filter(cover => 
      cover.category?.includes(window.categoryFilter)
    );
  }
  
  // Sort covers
  if (window.sortOrder === 'alphabetical') {
    filtered.sort((a, b) => (a.albumTitle || '').localeCompare(b.albumTitle || ''));
  } else if (window.sortOrder === 'recent') {
    filtered.sort((a, b) => {
      const timeA = a.lastModified || a.uploadedAt || 0;
      const timeB = b.lastModified || b.uploadedAt || 0;
      return new Date(timeB) - new Date(timeA);
    });
  } else {
    // Default to index order
    filtered.sort((a, b) => (a.index || 0) - (b.index || 0));
  }
  
  window.filteredCovers = filtered;
  
  // Clear container
  container.innerHTML = '';
  container.className = `covers-container covers-${window.currentViewMode}`;
  
  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No covers found</div>';
    return;
  }
  
  // Render based on view mode
  if (window.currentViewMode === 'list') {
    renderCoversListView(filtered);
  } else if (window.currentViewMode === 'coverflow') {
    renderCoversCoverflowView(filtered);
  } else {
    renderCoversGridView(filtered);
  }
  
  updateBatchUI();
};

// Grid view renderer
function renderCoversGridView(covers) {
  const container = document.getElementById('coversContainer');
  
  covers.forEach(cover => {
    const div = createCoverElement(cover);
    container.appendChild(div);
  });
  
  // Enable drag-to-reorder functionality
  if (typeof Sortable !== 'undefined' && !window.batchMode) {
    new Sortable(container, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      handle: '.cover-image-wrapper',
      filter: 'button, input',
      onEnd: function(evt) {
        // Update cover indices based on new order
        const coverElements = container.querySelectorAll('.cover-item');
        coverElements.forEach((el, index) => {
          const coverId = el.dataset.coverId;
          const cover = window.covers.find(c => c.id === coverId);
          if (cover) {
            cover.index = index;
          }
        });
        
        // Mark as having changes
        window.adminState.hasChanges = true;
        updateSaveButton();
        showToast('Cover order updated - remember to save changes');
      }
    });
  }
}

// List view renderer
function renderCoversListView(covers) {
  const container = document.getElementById('coversContainer');
  
  const table = document.createElement('table');
  table.className = 'covers-list-table';
  
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      ${window.batchMode ? '<th></th>' : ''}
      <th>Cover</th>
      <th>Title</th>
      <th>Artist</th>
      <th>Category</th>
      <th>Actions</th>
    </tr>
  `;
  table.appendChild(thead);
  
  const tbody = document.createElement('tbody');
  covers.forEach(cover => {
    const tr = createCoverListRow(cover);
    tbody.appendChild(tr);
  });
  
  table.appendChild(tbody);
  container.appendChild(table);
}

// Coverflow view renderer
function renderCoversCoverflowView(covers) {
  const container = document.getElementById('coversContainer');
  container.innerHTML = '<div class="coverflow-container" id="coverflowContainer"></div>';
  
  const coverflowContainer = document.getElementById('coverflowContainer');
  covers.forEach((cover, index) => {
    const div = createCoverElement(cover);
    div.style.transform = `translateX(${index * 120}px) rotateY(${index === 0 ? 0 : -45}deg)`;
    coverflowContainer.appendChild(div);
  });
}

// Create cover element
function createCoverElement(cover) {
  const div = document.createElement('div');
  div.className = 'cover-item';
  div.dataset.coverId = cover.id;
  
  if (window.selectedCovers.has(cover.id)) {
    div.classList.add('selected');
  }
  
  const imgUrl = cover.frontImage || cover.artistDetails?.image || '/placeholder.jpg';
  
  div.innerHTML = `
    ${window.batchMode ? `<input type="checkbox" class="batch-checkbox" ${window.selectedCovers.has(cover.id) ? 'checked' : ''}/>` : ''}
    <div class="cover-image-wrapper" data-index="${cover.index || 0}">
      <img src="${imgUrl}" alt="${cover.albumTitle || 'Untitled'}" loading="lazy" 
           onerror="this.src='/placeholder.jpg'"
           style="width: 100%; height: 100%; object-fit: cover;">
      <div class="cover-overlay">
        <div class="cover-actions">
          <button onclick="editCover(covers.find(c => c.id === '${cover.id}'))" title="Edit">
            <span>EDIT</span>
          </button>
          <button onclick="duplicateCover('${cover.id}')" title="Duplicate">
            <span>COPY</span>
          </button>
          <button onclick="deleteCover('${cover.id}')" class="danger" title="Delete">
            <span>DELETE</span>
          </button>
        </div>
      </div>
    </div>
    <div class="cover-info">
      <h3>${cover.albumTitle || 'Untitled'}</h3>
      <p>${cover.coverLabel || ''}</p>
      ${cover.category?.length ? `<div class="cover-categories">${cover.category.map(cat => `<span class="category-tag">${cat}</span>`).join('')}</div>` : ''}
    </div>
  `;
  
  // Event listeners
  if (window.batchMode) {
    const checkbox = div.querySelector('.batch-checkbox');
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        window.selectedCovers.add(cover.id);
      } else {
        window.selectedCovers.delete(cover.id);
      }
      div.classList.toggle('selected', e.target.checked);
      updateBatchToolbar();
    });
  }
  
  div.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.type === 'checkbox') return;
    
    if (window.batchMode) {
      const checkbox = div.querySelector('.batch-checkbox');
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change'));
    } else {
      editCover(cover);
    }
  });
  
  return div;
}

// Create cover list row
function createCoverListRow(cover) {
  const tr = document.createElement('tr');
  tr.dataset.coverId = cover.id;
  
  const imgUrl = cover.frontImage || cover.artistDetails?.image || '/placeholder.jpg';
  
  tr.innerHTML = `
    ${window.batchMode ? `<td><input type="checkbox" class="batch-checkbox" ${window.selectedCovers.has(cover.id) ? 'checked' : ''}></td>` : ''}
    <td class="cover-thumb"><img src="${imgUrl}" alt="${cover.albumTitle}" loading="lazy"></td>
    <td>${cover.albumTitle || 'Untitled'}</td>
    <td>${cover.coverLabel || ''}</td>
    <td>${cover.category?.join(', ') || ''}</td>
    <td class="actions">
      <button onclick="editCover(covers.find(c => c.id === '${cover.id}'))" class="btn btn-sm">EDIT</button>
      <button onclick="deleteCover('${cover.id}')" class="btn btn-sm btn-danger">DELETE</button>
    </td>
  `;
  
  return tr;
}

// Render recent covers
window.renderRecentCovers = function() {
  const container = document.getElementById('recentCoversContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (window.recentCovers.length === 0) {
    container.innerHTML = '<div class="empty-state">No recent edits</div>';
    return;
  }
  
  window.recentCovers.forEach(cover => {
    const div = createCoverElement(cover);
    div.classList.add('recent-cover');
    container.appendChild(div);
  });
  
  // Enable drag-to-reorder for recent covers too
  if (typeof Sortable !== 'undefined' && !window.batchMode) {
    new Sortable(container, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      handle: '.cover-image-wrapper',
      filter: 'button, input',
      group: 'covers', // Allow dragging between recent and main grid
      onEnd: function(evt) {
        // If moved from recent to main or vice versa, update both arrays
        updateCoverOrder();
        showToast('Cover order updated - remember to save changes');
      }
    });
  }
};

// Edit cover modal
window.editCover = function(cover) {
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
        <label class="form-label">BACK TEXT CONTENT (HTML supported)</label>
        <textarea class="form-input" name="backText" rows="4" 
                  placeholder="Add text content for the back of the cover (instead of Spotify embed)"
                  style="resize: vertical; font-family: monospace;">${cover.backText || ''}</textarea>
        <small style="color: var(--grey-500); font-size: var(--step--1);">
          Leave empty for Spotify embed. Supports HTML tags like &lt;h3&gt;, &lt;p&gt;, &lt;a&gt;
        </small>
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
                 style="width: 100%; aspect-ratio: 1; object-fit: cover; margin-bottom: var(--space-sm); cursor: pointer;"
                 onclick="window.openImageCropper('frontImage')"
                 title="Click to crop & zoom">
            <input type="hidden" name="frontImage" value="${cover.frontImage || ''}">
            <div style="display: flex; gap: var(--space-sm);">
              <button type="button" class="btn" onclick="window.openImageLibrary('frontImage')" style="flex: 1;">
                CHANGE IMAGE (LIBRARY)
              </button>
              <button type="button" class="btn" onclick="document.getElementById('frontImageFileInput').click()" style="flex: 1;">
                UPLOAD FROM DEVICE
              </button>
            </div>
            <input type="file" id="frontImageFileInput" accept="image/*" style="display: none;"
                   onchange="window.handleDeviceImageUpload(event, 'frontImage')">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">BACK IMAGE</label>
          <div style="position: relative;">
            <img id="backImagePreview" src="${cover.backImage || '/placeholder.jpg'}" 
                 style="width: 100%; aspect-ratio: 1; object-fit: cover; margin-bottom: var(--space-sm); cursor: pointer;"
                 onclick="window.openImageCropper('backImage')"
                 title="Click to crop & zoom">
            <input type="hidden" name="backImage" value="${cover.backImage || ''}">
            <div style="display: flex; gap: var(--space-sm);">
              <button type="button" class="btn" onclick="window.openImageLibrary('backImage')" style="flex: 1;">
                CHANGE IMAGE (LIBRARY)
              </button>
              <button type="button" class="btn" onclick="document.getElementById('backImageFileInput').click()" style="flex: 1;">
                UPLOAD FROM DEVICE
              </button>
            </div>
            <input type="file" id="backImageFileInput" accept="image/*" style="display: none;"
                   onchange="window.handleDeviceImageUpload(event, 'backImage')">
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
    
    // Update cover object
    cover.albumTitle = formData.get('albumTitle');
    cover.coverLabel = formData.get('coverLabel');
    cover.category = formData.get('category').split(',').map(c => c.trim()).filter(Boolean);
    cover.spotifyEmbed = formData.get('spotifyEmbed');
    cover.backText = formData.get('backText');
    cover.contactEmail = formData.get('contactEmail');
    cover.frontImage = formData.get('frontImage');
    cover.backImage = formData.get('backImage');
    
    // Find and update the cover in the covers array
    const coverIndex = window.covers.findIndex(c => c.id === cover.id);
    if (coverIndex !== -1) {
      window.covers[coverIndex] = cover;
    }
    
    window.adminState.hasChanges = true;
    updateSaveButton();
    renderCovers();
    closeModal();
    showToast('COVER UPDATED');
  };
  
  // Add modal dropzone functionality if available
  const modalBodyElement = document.getElementById('modalBody');
  if (window.setupModalDropzone) {
    window.setupModalDropzone(modalBodyElement);
  }
  
  openModal();
};

// Delete cover
window.deleteCover = async function(coverId) {
  if (!confirm('Delete this cover? This cannot be undone.')) return;
  
  window.covers = window.covers.filter(c => c.id !== coverId);
  window.adminState.hasChanges = true;
  updateSaveButton();
  renderCovers();
  showToast('COVER DELETED');
};

// Duplicate cover
window.duplicateCover = function(coverId) {
  const cover = window.covers.find(c => c.id === coverId);
  if (!cover) return;
  
  const newCover = {
    ...cover,
    id: Date.now().toString(),
    albumTitle: cover.albumTitle + ' (Copy)'
  };
  
  window.covers.push(newCover);
  window.adminState.hasChanges = true;
  updateSaveButton();
  renderCovers();
  showToast('COVER DUPLICATED');
};

// Save changes
window.saveChanges = async function() {
  if (!window.adminState.hasChanges) return;
  
  try {
    showLoading();
    
    // Update indices based on current order
    window.covers.forEach((cover, idx) => {
      cover.index = idx;
    });
    
    const result = await apiCall('/save-covers', {
      method: 'POST',
      body: JSON.stringify(window.covers)
    });
    
    window.adminState.hasChanges = false;
    updateSaveButton();
    showToast('ALL CHANGES SAVED');
    hideLoading();
  } catch (err) {
    console.error('Save failed:', err);
    showToast('SAVE FAILED: ' + err.message, 5000);
    hideLoading();
  }
};

// Push live
window.pushLive = async function() {
  if (!confirm('Push all changes to live site? This will make your edits visible to the public.')) return;
  
  try {
    showLoading();
    
    const result = await apiCall('/push-live', {
      method: 'POST'
    });
    
    showToast('SUCCESSFULLY PUSHED TO LIVE');
    
    if (result.validation) {
      console.log('Push validation results:', result.validation);
    }
    
    hideLoading();
  } catch (err) {
    console.error('Push failed:', err);
    showToast(`FAILED TO PUSH LIVE: ${err.message}`, 5000);
    hideLoading();
  }
};

// Batch operations
window.toggleBatchMode = function() {
  window.batchMode = !window.batchMode;
  window.selectedCovers.clear();
  
  document.body.classList.toggle('batch-active', window.batchMode);
  
  const batchBtn = document.getElementById('batchModeBtn');
  if (batchBtn) {
    batchBtn.textContent = window.batchMode ? 'EXIT BATCH' : 'BATCH MODE';
    batchBtn.classList.toggle('btn-danger', window.batchMode);
  }
  
  createBatchToolbar();
  renderCovers();
};

// Create batch toolbar
function createBatchToolbar() {
  let toolbar = document.getElementById('batchToolbar');
  
  if (!window.batchMode) {
    if (toolbar) toolbar.remove();
    return;
  }
  
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.id = 'batchToolbar';
    toolbar.className = 'batch-toolbar';
    toolbar.innerHTML = `
      <div class="batch-toolbar-inner">
        <span class="batch-count">0 selected</span>
        <div class="batch-actions">
          <button class="btn btn-sm" onclick="selectAllCovers()">SELECT ALL</button>
          <button class="btn btn-sm" onclick="deselectAllCovers()">DESELECT ALL</button>
          <button class="btn btn-sm btn-danger" onclick="deleteSelectedCovers()">DELETE SELECTED</button>
        </div>
      </div>
    `;
    document.querySelector('.covers-controls')?.appendChild(toolbar);
  }
  
  updateBatchToolbar();
}

// Update batch UI
function updateBatchToolbar() {
  const countEl = document.querySelector('.batch-count');
  if (countEl) {
    countEl.textContent = `${window.selectedCovers.size} selected`;
  }
}

function updateBatchUI() {
  if (!window.batchMode) return;
  
  document.querySelectorAll('.cover-item').forEach(el => {
    const coverId = el.dataset.coverId;
    const checkbox = el.querySelector('.batch-checkbox');
    if (checkbox) {
      checkbox.checked = window.selectedCovers.has(coverId);
    }
    el.classList.toggle('selected', window.selectedCovers.has(coverId));
  });
  
  updateBatchToolbar();
}

// Batch actions
window.selectAllCovers = function() {
  window.filteredCovers.forEach(cover => {
    window.selectedCovers.add(cover.id);
  });
  updateBatchUI();
};

window.deselectAllCovers = function() {
  window.selectedCovers.clear();
  updateBatchUI();
};

window.deleteSelectedCovers = async function() {
  if (window.selectedCovers.size === 0) return;
  
  if (!confirm(`Delete ${window.selectedCovers.size} covers? This cannot be undone.`)) return;
  
  window.covers = window.covers.filter(cover => !window.selectedCovers.has(cover.id));
  window.selectedCovers.clear();
  window.adminState.hasChanges = true;
  updateSaveButton();
  renderCovers();
  showToast(`${window.selectedCovers.size} COVERS DELETED`);
};

// Search and filter handlers
window.setupSearchAndFilters = function() {
  const searchInput = document.getElementById('coverSearch');
  const categoryFilter = document.getElementById('categoryFilter');
  const sortOrder = document.getElementById('sortOrder');
  
  let searchTimeout;
  
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        window.searchTerm = e.target.value;
        renderCovers();
      }, 300);
    });
  }
  
  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      window.categoryFilter = e.target.value;
      renderCovers();
    });
  }
  
  if (sortOrder) {
    sortOrder.addEventListener('change', (e) => {
      window.sortOrder = e.target.value;
      renderCovers();
    });
  }
};

// View mode toggles
window.setupViewModeToggles = function() {
  document.querySelectorAll('.view-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      window.setViewMode(view);
    });
  });
};

window.setViewMode = function(mode) {
  window.currentViewMode = mode;
  
  document.querySelectorAll('.view-toggle').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === mode);
  });
  
  renderCovers();
};

// Initialize covers module
window.initializeCovers = function() {
  console.log('📚 Covers Module Initialized');
  loadCovers();
  setupSearchAndFilters();
  setupViewModeToggles();
};

// Export for shared use
window.coversModule = {
  loadCovers,
  renderCovers,
  editCover,
  saveChanges,
  pushLive
};

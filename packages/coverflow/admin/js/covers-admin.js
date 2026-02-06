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

function getCoverCategories(cover) {
  if (!cover) return [];
  const raw = cover.category;
  if (Array.isArray(raw)) return raw.map(c => String(c));
  if (typeof raw === 'string') {
    // tolerate comma-separated legacy values
    return raw
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);
  }
  return [];
}

function getCoverTimestampMs(cover) {
  const raw =
    cover?.lastModified ??
    cover?.uploadedAt ??
    cover?.updatedAt ??
    cover?.createdAt ??
    null;
  if (raw === null || raw === undefined || raw === '') return null;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function getAdvancedFilterValues() {
  const dateFrom = document.getElementById('dateFrom')?.value || '';
  const dateTo = document.getElementById('dateTo')?.value || '';
  const tagsRaw = document.getElementById('tagsFilter')?.value || '';
  const tags = tagsRaw
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);
  return { dateFrom, dateTo, tags };
}

function normalizeSortOrder(sortOrder) {
  if (!sortOrder) return 'index';
  if (sortOrder === 'alphabetical') return 'title';
  if (sortOrder === 'recent') return 'date';
  return sortOrder;
}

// Load covers from server
window.loadCovers = async function() {
  try {
    showLoading('covers');
    const data = await loadJsonData('/data/covers.json', []);
    // Normalize IDs so DOM dataset strings always match cover objects (prevents "reorder looks right but doesn't save").
    if (Array.isArray(data)) {
      data.forEach((cover, idx) => {
        if (!cover || typeof cover !== 'object') return;
        if (cover.id === undefined || cover.id === null || cover.id === '') {
          cover.id = `${Date.now()}-${idx}`;
        } else if (typeof cover.id !== 'string') {
          cover.id = String(cover.id);
        }
        if (cover.index !== undefined && cover.index !== null && cover.index !== '') {
          const n = Number(cover.index);
          if (Number.isFinite(n)) cover.index = n;
        }
      });
    }
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

const publicPreviewAspectCache = new Map();
const publicPreviewAspectPending = new Set();
let publicPreviewRelayoutTimer = null;
let publicPreviewSuppressClicksUntil = 0;
let publicPreviewIsReordering = false;

function getCoverImageUrl(cover) {
  return cover?.frontImage || cover?.artistDetails?.image || '/placeholder.jpg';
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function ensureCoverAspectCached(url) {
  if (!url || publicPreviewAspectCache.has(url) || publicPreviewAspectPending.has(url)) return;
  publicPreviewAspectPending.add(url);

  const img = new Image();
  img.onload = () => {
    const aspect = img.naturalWidth && img.naturalHeight ? (img.naturalWidth / img.naturalHeight) : 1;
    publicPreviewAspectCache.set(url, clamp(aspect, 0.3, 3));
    publicPreviewAspectPending.delete(url);

    if (window.currentViewMode === 'public-preview' && !publicPreviewIsReordering) {
      clearTimeout(publicPreviewRelayoutTimer);
      publicPreviewRelayoutTimer = setTimeout(() => {
        try { window.renderCovers(); } catch { /* no-op */ }
      }, 120);
    }
  };
  img.onerror = () => {
    publicPreviewAspectCache.set(url, 1);
    publicPreviewAspectPending.delete(url);
  };
  img.src = url;
}

function destroyCoversSortable() {
  if (window._coversSortable && typeof window._coversSortable.destroy === 'function') {
    try { window._coversSortable.destroy(); } catch { /* no-op */ }
  }
  window._coversSortable = null;
}

// Render covers grid/list/coverflow
window.renderCovers = function(search = '') {
  const container = document.getElementById('coversContainer');
  if (!container) return;
  
  // Apply search and filters
  let filtered = Array.isArray(window.covers) ? [...window.covers] : [];
  
  if (search || window.searchTerm) {
    const term = (search || window.searchTerm).toLowerCase();
    filtered = filtered.filter(cover => 
      cover.albumTitle?.toLowerCase().includes(term) ||
      cover.coverLabel?.toLowerCase().includes(term) ||
      cover.artistDetails?.name?.toLowerCase().includes(term) ||
      getCoverCategories(cover).some(cat => cat.toLowerCase().includes(term))
    );
  }
  
  if (window.categoryFilter) {
    filtered = filtered.filter(cover => 
      getCoverCategories(cover).some(cat => cat.toLowerCase() === window.categoryFilter.toLowerCase())
    );
  }

  // Advanced filters (date range + category "tags")
  const { dateFrom, dateTo, tags } = getAdvancedFilterValues();
  if (tags.length) {
    filtered = filtered.filter(cover => {
      const categories = getCoverCategories(cover).map(c => c.toLowerCase());
      return tags.some(tag => categories.includes(tag));
    });
  }

  if (dateFrom || dateTo) {
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    filtered = filtered.filter(cover => {
      const ms = getCoverTimestampMs(cover);
      // If no timestamp exists on the record, do not hide it.
      if (ms === null) return true;
      if (fromMs !== null && ms < fromMs) return false;
      if (toMs !== null && ms > toMs) return false;
      return true;
    });
  }
  
  // Sort covers
  const sort = normalizeSortOrder(window.sortOrder);
  if (sort === 'title' || sort === 'title-asc') {
    filtered.sort((a, b) => (a.albumTitle || '').localeCompare(b.albumTitle || '') || (a.index || 0) - (b.index || 0));
  } else if (sort === 'title-desc') {
    filtered.sort((a, b) => (b.albumTitle || '').localeCompare(a.albumTitle || '') || (a.index || 0) - (b.index || 0));
  } else if (sort === 'date') {
    filtered.sort((a, b) => (getCoverTimestampMs(b) || 0) - (getCoverTimestampMs(a) || 0) || (a.index || 0) - (b.index || 0));
  } else if (sort === 'date-desc') {
    filtered.sort((a, b) => (getCoverTimestampMs(a) || 0) - (getCoverTimestampMs(b) || 0) || (a.index || 0) - (b.index || 0));
  } else {
    // Default to index/manual order
    filtered.sort((a, b) => (a.index || 0) - (b.index || 0) || (a.albumTitle || '').localeCompare(b.albumTitle || ''));
  }
  
  window.filteredCovers = filtered;
  
  // Clear container
  container.innerHTML = '';
  container.className = `covers-container covers-${window.currentViewMode}`;
  
  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No covers found. Try clearing filters.</div>';
    return;
  }
  
  // Render based on view mode
  if (window.currentViewMode !== 'grid') destroyCoversSortable();
  if (window.currentViewMode === 'list') {
    renderCoversListView(filtered);
  } else if (window.currentViewMode === 'coverflow') {
    renderCoversCoverflowView(filtered);
  } else if (window.currentViewMode === 'public-preview') {
    renderCoversPublicPreviewView(filtered);
  } else {
    renderCoversGridView(filtered);
  }
  
  updateBatchUI();
};

function canReorderCovers() {
  if (typeof Sortable === 'undefined') return false;
  if (window.batchMode) return false;
  if (normalizeSortOrder(window.sortOrder) !== 'index') return false;
  if (window.searchTerm) return false;
  if (window.categoryFilter) return false;

  const { dateFrom, dateTo, tags } = getAdvancedFilterValues();
  if (dateFrom || dateTo || tags.length) return false;
  return true;
}

function getPublicDesktopPositionLabel(orderIndex) {
  const idx = Number.isFinite(orderIndex) ? orderIndex : 0;
  const pattern = [3, 2, 4]; // mirrors public site desktop row rhythm
  const cycleSize = pattern.reduce((a, b) => a + b, 0); // 9
  const cycle = Math.floor(idx / cycleSize);
  let rem = idx % cycleSize;

  for (let rowIdx = 0; rowIdx < pattern.length; rowIdx++) {
    const rowSize = pattern[rowIdx];
    if (rem < rowSize) {
      const row = cycle * pattern.length + rowIdx + 1;
      const slot = rem + 1;
      return `Public layout (desktop): Row ${row}, Slot ${slot} of ${rowSize}`;
    }
    rem -= rowSize;
  }

  return 'Public layout (desktop): position unknown';
}

// Grid view renderer
function renderCoversGridView(covers) {
  const container = document.getElementById('coversContainer');
  
  covers.forEach(cover => {
    const div = createCoverElement(cover);
    container.appendChild(div);
  });
  
  // Enable drag-to-reorder functionality
  if (canReorderCovers()) {
    destroyCoversSortable();
    window._coversSortable = new Sortable(container, {
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

          // Keep index badges/tooltips in sync without a full re-render
          const badge = el.querySelector('.cover-index');
          if (badge) {
            badge.textContent = String(index + 1);
            badge.title = getPublicDesktopPositionLabel(index);
          }
          const wrap = el.querySelector('.cover-image-wrapper');
          if (wrap) wrap.dataset.index = String(index);
        });
        
        // Mark as having changes
        window.adminState.hasChanges = true;
        updateSaveButton();
        showToast('Cover order updated - remember to save changes');
      }
    });
  } else {
    destroyCoversSortable();
  }
}

function renderCoversPublicPreviewView(covers) {
  const container = document.getElementById('coversContainer');
  if (!container) return;

  const hint = document.createElement('div');
  hint.className = 'public-preview-hint';
  hint.textContent = canReorderCovers()
    ? 'PUBLIC PREVIEW — DRAG TO REORDER (MANUAL ORDER). CLICK A COVER TO EDIT.'
    : 'PUBLIC PREVIEW — TO REORDER: SET MANUAL ORDER + CLEAR FILTERS. CLICK A COVER TO EDIT.';
  container.appendChild(hint);

  const viewport = document.createElement('div');
  viewport.className = 'public-preview-viewport';
  container.appendChild(viewport);

  const canvas = document.createElement('div');
  canvas.className = 'public-preview-canvas';
  viewport.appendChild(canvas);

  // Always preview manual order (the public site uses the ARRAY order in covers.json).
  const ordered = (Array.isArray(covers) ? covers : [])
    .map((c, pos) => ({ c, pos }))
    .sort((a, b) => {
      const ai = Number(a.c?.index);
      const bi = Number(b.c?.index);
      const aHas = Number.isFinite(ai);
      const bHas = Number.isFinite(bi);
      if (aHas && bHas) return ai - bi || a.pos - b.pos;
      if (aHas) return -1;
      if (bHas) return 1;
      return a.pos - b.pos;
    })
    .map(x => x.c);

  const seededRand = (seed, min, max) => {
    const x = Math.sin(seed * 9973) * 43758.5453;
    const t = x - Math.floor(x);
    return min + t * (max - min);
  };

  const viewportW = viewport.clientWidth || 900;
  const scale = clamp(viewportW / 1200, 0.5, 0.9);
  const rowPattern = [3, 2, 4]; // public desktop rhythm
  const baseHeight = 220;
  const tileHeightPx = baseHeight * scale;
  const startXBase = 28 * scale;

  let rowY = 0;
  let rowIndex = 0;
  let i = 0;
  let maxRight = 0;

  while (i < ordered.length) {
    const rowSize = rowPattern[rowIndex % rowPattern.length];
    let cursorX = startXBase + (rowIndex % 2 === 1 ? 90 * scale : 0);

    for (let k = 0; k < rowSize && i < ordered.length; k++, i++) {
      const cover = ordered[i];
      const url = getCoverImageUrl(cover);
      ensureCoverAspectCached(url);

      const aspect = clamp(publicPreviewAspectCache.get(url) || 1, 0.3, 3);
      const widthPx = tileHeightPx * aspect;
      const jitterY = seededRand(i, -10, 10) * scale;
      const gapX = (80 * scale) + seededRand(i * 3, 12 * scale, 60 * scale);

      const x = cursorX;
      const y = rowY + jitterY;

      const item = document.createElement('div');
      item.className = 'public-preview-item';
      item.style.left = `${x}px`;
      item.style.top = `${y}px`;
      item.style.width = `${Math.round(widthPx)}px`;
      item.style.height = `${Math.round(tileHeightPx)}px`;
      item.dataset.coverId = cover.id;
      item.title = `${cover.albumTitle || 'Untitled'} — ${cover.artistDetails?.name || ''}`.trim();

      const img = document.createElement('img');
      img.className = 'cover-image';
      img.loading = 'lazy';
      img.src = url;
      img.alt = cover.albumTitle || cover.artistDetails?.name || 'Cover';
      img.onerror = () => { img.src = '/placeholder.jpg'; };
      item.appendChild(img);

      const idxBadge = document.createElement('div');
      idxBadge.className = 'cover-index';
      idxBadge.textContent = String(i + 1);
      idxBadge.title = getPublicDesktopPositionLabel(i);
      item.appendChild(idxBadge);

      const meta = document.createElement('div');
      meta.className = 'cover-meta';
      const title = document.createElement('div');
      title.textContent = cover.albumTitle || 'Untitled';
      const sub = document.createElement('div');
      sub.textContent = cover.artistDetails?.name || cover.coverLabel || '';
      meta.appendChild(title);
      meta.appendChild(sub);
      item.appendChild(meta);

      item.addEventListener('click', () => {
        if (window.batchMode) return;
        if (publicPreviewSuppressClicksUntil && performance.now() < publicPreviewSuppressClicksUntil) return;
        if (typeof window.editCover === 'function') window.editCover(cover);
      });

      canvas.appendChild(item);

      cursorX += widthPx + gapX;
      maxRight = Math.max(maxRight, cursorX);
    }

    rowIndex++;
    const gapY = (84 * scale) + seededRand(rowIndex, 10 * scale, 32 * scale);
    rowY += tileHeightPx + gapY;
  }

  canvas.style.width = `${Math.ceil(maxRight + startXBase)}px`;
  canvas.style.height = `${Math.ceil(rowY + startXBase)}px`;

  // Enable drag-to-reorder directly in the preview when manual ordering is active.
  if (typeof Sortable !== 'undefined' && canReorderCovers()) {
    destroyCoversSortable();
    window._coversSortable = new Sortable(canvas, {
      animation: 150,
      delay: 120,
      delayOnTouchOnly: true,
      touchStartThreshold: 8,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      onStart: function() {
        publicPreviewIsReordering = true;
      },
      onEnd: function() {
        publicPreviewIsReordering = false;
        publicPreviewSuppressClicksUntil = performance.now() + 250;

        const items = Array.from(canvas.querySelectorAll('.public-preview-item'));
        items.forEach((el, index) => {
          const coverId = el.dataset.coverId;
          const cover = window.covers.find(c => c.id === coverId);
          if (cover) cover.index = index;
        });

        window.adminState.hasChanges = true;
        updateSaveButton();
        showToast('Cover order updated - remember to save changes');

        // Re-render to recompute the collage layout using the new order.
        setTimeout(() => {
          if (window.currentViewMode === 'public-preview') renderCovers();
        }, 0);
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
  const manualIndex = Number.isFinite(cover.index) ? cover.index : 0;
  
  div.innerHTML = `
    ${window.batchMode ? `<input type="checkbox" class="batch-checkbox" ${window.selectedCovers.has(cover.id) ? 'checked' : ''}/>` : ''}
    <div class="cover-image-wrapper" data-index="${manualIndex}">
      <img src="${imgUrl}" alt="${cover.albumTitle || 'Untitled'}" loading="lazy" 
           onerror="this.src='/placeholder.jpg'"
           style="width: 100%; height: 100%; object-fit: cover;">
      ${normalizeSortOrder(window.sortOrder) === 'index' ? `<div class="cover-index" title="${getPublicDesktopPositionLabel(manualIndex)}">${manualIndex + 1}</div>` : ''}
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
  const target = window.covers.find(c => c.id === coverId);
  if (!target) return;
  
  if (!confirm(`Delete cover "${target.albumTitle || 'Untitled'}"? This cannot be undone.`)) return;
  
  // Keep a copy for potential undo
  const index = window.covers.findIndex(c => c.id === coverId);
  const deletedCover = { ...target };
  
  window.covers = window.covers.filter(c => c.id !== coverId);
  window.adminState.hasChanges = true;
  updateSaveButton();
  renderCovers();
  
  // Offer quick UNDO (client-side only)
  if (window.showUndoToast) {
    window.showUndoToast('COVER DELETED', () => {
      window.covers.splice(index, 0, deletedCover);
      window.adminState.hasChanges = true;
      updateSaveButton();
      renderCovers();
    });
  } else {
    showToast('COVER DELETED');
  }
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
  
  if (window.showUndoToast) {
    window.showUndoToast('COVER DUPLICATED', () => {
      window.covers = window.covers.filter(c => c.id !== newCover.id);
      window.adminState.hasChanges = true;
      updateSaveButton();
      renderCovers();
    });
  } else {
    showToast('COVER DUPLICATED');
  }
};

// Save changes
window.saveChanges = async function() {
  if (!window.adminState.hasChanges) return;
  
  try {
    showLoading();
    
    // Persist manual order as ARRAY order (public site consumes covers.json array order).
    const covers = Array.isArray(window.covers) ? window.covers : [];
    const ordered = covers
      .map((c, pos) => ({ c, pos }))
      .sort((a, b) => {
        const ai = Number(a.c?.index);
        const bi = Number(b.c?.index);
        const aHas = Number.isFinite(ai);
        const bHas = Number.isFinite(bi);
        if (aHas && bHas) return ai - bi || a.pos - b.pos;
        if (aHas) return -1;
        if (bHas) return 1;
        return a.pos - b.pos;
      })
      .map(x => x.c);

    ordered.forEach((cover, idx) => { cover.index = idx; });
    window.covers = ordered;
    
    const result = await apiCall('/save-covers', {
      method: 'POST',
      body: JSON.stringify(ordered)
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
  // Guardrail: pushing live without saving is a very common footgun.
  if (window.adminState?.hasChanges) {
    const ok = confirm('You have UNSAVED changes.\n\nClick OK to SAVE first, then you can PUSH LIVE.\nClick Cancel to abort.');
    if (!ok) return;
    await window.saveChanges();
    if (window.adminState?.hasChanges) return; // save failed / aborted
  }

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
  
  const idsToDelete = new Set(window.selectedCovers);
  const deleted = window.covers.filter(cover => idsToDelete.has(cover.id));
  
  window.covers = window.covers.filter(cover => !idsToDelete.has(cover.id));
  window.selectedCovers.clear();
  window.adminState.hasChanges = true;
  updateSaveButton();
  renderCovers();
  
  if (window.showUndoToast && deleted.length) {
    window.showUndoToast(`${deleted.length} COVERS DELETED`, () => {
      // Reinsert deleted covers (append to end to avoid complex index tracking)
      window.covers = window.covers.concat(deleted);
      window.adminState.hasChanges = true;
      updateSaveButton();
      renderCovers();
    });
  } else {
    showToast(`${deleted.length} COVERS DELETED`);
  }
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
    // Keep UI and state in sync (prevents confusing "NEWEST FIRST" label when we are in manual order)
    if (sortOrder.value !== window.sortOrder && Array.from(sortOrder.options).some(o => o.value === window.sortOrder)) {
      sortOrder.value = window.sortOrder;
    } else {
      window.sortOrder = sortOrder.value;
    }
    sortOrder.addEventListener('change', (e) => {
      window.sortOrder = e.target.value;
      renderCovers();
    });
  }

  // Advanced filter inputs
  const dateFrom = document.getElementById('dateFrom');
  const dateTo = document.getElementById('dateTo');
  const tagsFilter = document.getElementById('tagsFilter');

  if (dateFrom) {
    dateFrom.addEventListener('change', () => renderCovers());
  }
  if (dateTo) {
    dateTo.addEventListener('change', () => renderCovers());
  }
  if (tagsFilter) {
    tagsFilter.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => renderCovers(), 250);
    });
  }

  // Advanced filters toggle button
  const advancedToggleBtn = document.getElementById('advancedFiltersToggle');
  const advancedPanel = document.getElementById('advancedFilters');
  if (advancedToggleBtn && advancedPanel) {
    advancedToggleBtn.setAttribute('aria-controls', 'advancedFilters');
    advancedToggleBtn.setAttribute('aria-expanded', advancedPanel.style.display === 'none' ? 'false' : 'true');
  }
};

// Advanced filters: show/hide panel
window.toggleAdvancedFilters = function(_section) {
  const filters = document.getElementById('advancedFilters');
  if (!filters) return;

  const toggleBtn = document.getElementById('advancedFiltersToggle');
  const isHidden = filters.style.display === 'none' || !filters.style.display;
  filters.style.display = isHidden ? 'block' : 'none';
  if (toggleBtn) toggleBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
};

// Quick filters: set advanced inputs + re-render
window.applyQuickFilter = function(filter) {
  const filters = document.getElementById('advancedFilters');
  if (filters && (filters.style.display === 'none' || !filters.style.display)) {
    filters.style.display = 'block';
    const toggleBtn = document.getElementById('advancedFiltersToggle');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
  }

  // Visual active state
  document.querySelectorAll('.quick-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  const dateFrom = document.getElementById('dateFrom');
  const dateTo = document.getElementById('dateTo');
  const tagsFilter = document.getElementById('tagsFilter');
  const sortOrder = document.getElementById('sortOrder');

  const today = new Date();
  const fmt = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  if (filter === 'recent') {
    const from = new Date(today);
    from.setDate(from.getDate() - 7);
    if (dateFrom) dateFrom.value = fmt(from);
    if (dateTo) dateTo.value = fmt(today);
    window.sortOrder = 'date';
    if (sortOrder) sortOrder.value = 'date';
    showToast('FILTER: LAST 7 DAYS', 2000);
  } else if (filter === 'month') {
    const from = new Date(today);
    from.setDate(from.getDate() - 30);
    if (dateFrom) dateFrom.value = fmt(from);
    if (dateTo) dateTo.value = fmt(today);
    window.sortOrder = 'date';
    if (sortOrder) sortOrder.value = 'date';
    showToast('FILTER: LAST MONTH', 2000);
  } else if (filter === 'favorites') {
    if (tagsFilter) tagsFilter.value = 'favorite';
    showToast('FILTER: FAVORITES', 2000);
  }

  renderCovers();
};

window.clearAllFilters = function() {
  // Reset state
  window.searchTerm = '';
  window.categoryFilter = '';
  window.sortOrder = 'index';

  // Reset inputs
  const coverSearch = document.getElementById('coverSearch');
  const categoryFilter = document.getElementById('categoryFilter');
  const sortOrder = document.getElementById('sortOrder');
  const dateFrom = document.getElementById('dateFrom');
  const dateTo = document.getElementById('dateTo');
  const tagsFilter = document.getElementById('tagsFilter');

  if (coverSearch) coverSearch.value = '';
  if (categoryFilter) categoryFilter.value = '';
  if (sortOrder) sortOrder.value = 'index';
  if (dateFrom) dateFrom.value = '';
  if (dateTo) dateTo.value = '';
  if (tagsFilter) tagsFilter.value = '';

  // Clear quick filter active state
  document.querySelectorAll('.quick-filter-btn').forEach(btn => btn.classList.remove('active'));

  renderCovers();
  showToast('FILTERS CLEARED', 1500);
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
  
  // Persist preferred view mode for next visit
  try {
    localStorage.setItem('amfAdmin.covers.viewMode', mode);
  } catch (err) {
    console.warn('Could not persist covers view mode', err);
  }
  
  document.querySelectorAll('.view-toggle').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === mode);
  });
  
  renderCovers();
  
  // Lightweight feedback
  showToast(`VIEW: ${mode.toUpperCase()}`, 1200);
};

// Initialize covers module
window.initializeCovers = function() {
  console.log('📚 Covers Module Initialized');
  loadCovers();
  setupSearchAndFilters();
  setupViewModeToggles();
  
  // Default to Public Preview, but preserve explicit user preference going forward.
  const viewModeKey = 'amfAdmin.covers.viewMode';
  const migrationKey = 'amfAdmin.covers.viewMode.migratedToPublicPreviewDefault';
  const allowed = new Set(['grid', 'list', 'coverflow', 'public-preview']);

  let initialMode = 'public-preview';
  try {
    const savedRaw = localStorage.getItem(viewModeKey);
    const saved = savedRaw && allowed.has(savedRaw) ? savedRaw : null;
    const migrated = localStorage.getItem(migrationKey) === '1';

    if (!migrated) {
      // If they were on the old default ("grid") or had no preference, move them to Public Preview once.
      if (!saved || saved === 'grid') {
        initialMode = 'public-preview';
        localStorage.setItem(viewModeKey, initialMode);
      } else {
        initialMode = saved;
      }
      localStorage.setItem(migrationKey, '1');
    } else if (saved) {
      initialMode = saved;
    }
  } catch (err) {
    console.warn('Could not read saved covers view mode', err);
  }
  window.setViewMode(initialMode);
};

// Export for shared use
window.coversModule = {
  loadCovers,
  renderCovers,
  editCover,
  saveChanges,
  pushLive
};

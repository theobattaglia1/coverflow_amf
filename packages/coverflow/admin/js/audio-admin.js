/**
 * AMF ADMIN — Audio Management Module
 * Handles all audio-related functionality
 */

// Audio state
window.audioFiles = [];
window.selectedAudioFiles = new Set();
window.currentAudioFolder = '';
window.audioFolders = [];

// Artist hubs for audio
window.audioArtists = [];
window.audioArtistFilter = ''; // '' = all artists, 'UNASSIGNED' = no match

// Utility: infer artist name for an audio file based on known artists and filename/url
function inferArtistForAudio(audio, artists) {
  const haystack = (audio.filename || audio.name || audio.url || '').toLowerCase();
  let bestMatch = '';
  let bestLength = 0;
  artists.forEach(artist => {
    const name = (artist.name || '').toLowerCase();
    if (!name) return;
    if (haystack.includes(name) && name.length > bestLength) {
      bestMatch = artist.name;
      bestLength = name.length;
    }
  });
  return bestMatch;
}

// Build artist hubs from covers.json
function buildAudioArtistsFromCovers(covers) {
  const map = new Map();
  (covers || []).forEach(cover => {
    const categories = (cover.category || []).map(c => String(c).toLowerCase());
    const isArtistType = categories.some(c => c === 'artist' || c === 'songwriter' || c === 'producer');
    if (!isArtistType) return;

    // Prefer explicit artistDetails.name, fall back to albumTitle
    const baseName = (cover.artistDetails?.name || cover.albumTitle || '').trim();
    if (!baseName) return;

    if (!map.has(baseName)) {
      map.set(baseName, {
        name: baseName,
        id: cover.id || baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        coverImage: cover.frontImage || cover.artistDetails?.image || ''
      });
    }
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// Load audio files + artist hubs
window.loadAudioFiles = function() {
  // Load assets (for audio files) and covers (for artist list) in parallel,
  // using shared safe JSON loader to tolerate HTML/error responses.
  return Promise.all([
    window.loadJsonData ? window.loadJsonData('/data/assets.json', {}) : fetch('/data/assets.json').then(r => r.json()).catch(() => ({})),
    window.loadJsonData ? window.loadJsonData('/data/covers.json', []) : fetch('/data/covers.json').then(r => r.json()).catch(() => [])
  ])
    .then(([assetsData, coversData]) => {
      // 1) Build artist hubs
      window.audioArtists = buildAudioArtistsFromCovers(coversData);
      
      // 2) Filter for audio files from assets
      window.audioFiles = (assetsData.images || []).filter(asset => 
        asset.url && (
          asset.url.toLowerCase().includes('.mp3') || 
          asset.url.toLowerCase().includes('.wav') || 
          asset.url.toLowerCase().includes('.m4a') || 
          asset.url.toLowerCase().includes('.ogg') ||
          asset.url.toLowerCase().includes('.aac') ||
          asset.type === 'audio'
        )
      );
      
      // 3) Infer artist per audio file
      window.audioFiles.forEach(audio => {
        if (!audio.artist) {
          const inferred = inferArtistForAudio(audio, window.audioArtists);
          if (inferred) {
            audio.artist = inferred;
          } else {
            audio.artist = ''; // unassigned
          }
        }
      });
      
      renderAudioArtists();
      renderAudioFolders();
      renderAudioFiles();
    })
    .catch(err => {
      console.error('Failed to load audio files:', err);
      showToast('FAILED TO LOAD AUDIO FILES', 'error');
    });
};

// Render audio files
window.renderAudioFiles = function() {
  const container = document.getElementById('audioContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  let filesToRender = window.audioFiles;
  
  // Apply artist hub filter if any
  if (window.audioArtistFilter) {
    if (window.audioArtistFilter === 'UNASSIGNED') {
      filesToRender = filesToRender.filter(a => !a.artist);
    } else {
      filesToRender = filesToRender.filter(a => a.artist === window.audioArtistFilter);
    }
  }
  
  filesToRender.forEach((audio) => {
    const audioDiv = document.createElement('div');
    audioDiv.className = `audio-item ${window.selectedAudioFiles.has(audio.url) ? 'selected' : ''}`;
    audioDiv.dataset.audioId = audio.url;
    
    audioDiv.innerHTML = `
      <div class="audio-item-content">
        <input type="checkbox" class="audio-checkbox" ${window.selectedAudioFiles.has(audio.url) ? 'checked' : ''} 
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
          <div class="audio-artist-label">
            ${audio.artist ? audio.artist : '<span class="audio-artist-unassigned">UNASSIGNED ARTIST</span>'}
          </div>
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
};

// Render artist hubs (with drop target support for audio uploads)
function renderAudioArtists() {
  const container = document.getElementById('audioArtistHubs');
  if (!container) return;
  
  container.innerHTML = '';
  
  const totalTracks = window.audioFiles.length;
  
  // Helper to create artist card with drop support
  function createArtistCard(artistName, count, isActive, avatarStyle = '', avatarClass = '') {
    const card = document.createElement('button');
    card.className = 'audio-artist-card' + (isActive ? ' active' : '');
    card.type = 'button';
    card.innerHTML = `
      <div class="audio-artist-avatar ${avatarClass}" style="${avatarStyle}"></div>
      <div class="audio-artist-meta">
        <div class="audio-artist-name">${artistName}</div>
        <div class="audio-artist-count">${count} track${count === 1 ? '' : 's'}</div>
      </div>
    `;
    return card;
  }
  
  // Helper to setup drop target on a card
  function setupDropTarget(card, targetArtist) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      card.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
      card.addEventListener(eventName, () => card.classList.add('drop-target'), false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      card.addEventListener(eventName, () => card.classList.remove('drop-target'), false);
    });
    
    card.addEventListener('drop', async (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0 && window.uploadAudioFiles) {
        showToast(`UPLOADING TO ${targetArtist || 'GENERAL'}...`);
        await window.uploadAudioFiles(files, targetArtist);
      }
    }, false);
  }
  
  // "All audio" hub
  const allDiv = createArtistCard('ALL AUDIO', totalTracks, !window.audioArtistFilter, '', 'all');
  allDiv.addEventListener('click', () => {
    window.audioArtistFilter = '';
    renderAudioArtists();
    renderAudioFiles();
  });
  container.appendChild(allDiv);
  
  // Per-artist hubs
  window.audioArtists.forEach(artist => {
    const count = window.audioFiles.filter(a => a.artist === artist.name).length;
    const avatarStyle = artist.coverImage ? `background-image:url('${artist.coverImage}')` : '';
    const card = createArtistCard(artist.name, count, window.audioArtistFilter === artist.name, avatarStyle);
    
    card.addEventListener('click', () => {
      window.audioArtistFilter = artist.name;
      renderAudioArtists();
      renderAudioFiles();
    });
    
    // Enable drop on artist cards
    setupDropTarget(card, artist.name);
    
    container.appendChild(card);
  });
  
  // Unassigned hub if needed
  const unassignedCount = window.audioFiles.filter(a => !a.artist).length;
  if (unassignedCount > 0) {
    const unassigned = createArtistCard('UNASSIGNED', unassignedCount, window.audioArtistFilter === 'UNASSIGNED', '', 'unassigned');
    unassigned.addEventListener('click', () => {
      window.audioArtistFilter = 'UNASSIGNED';
      renderAudioArtists();
      renderAudioFiles();
    });
    // Enable drop on unassigned (uploads to general audio folder)
    setupDropTarget(unassigned, '');
    container.appendChild(unassigned);
  }
}

// Render audio folder tree based on artists (virtual folders per artist)
function renderAudioFolders() {
  const tree = document.getElementById('audioFolderTree');
  if (!tree) return;
  
  tree.innerHTML = '';
  
  // Helper to create a folder item
  function createFolderItem(label, key, isActive) {
    const li = document.createElement('li');
    li.className = 'folder-item' + (isActive ? ' active' : '');
    li.dataset.artistKey = key;
    li.innerHTML = `<span style="cursor:pointer;">${label}</span>`;
    li.addEventListener('click', () => {
      if (key === '__ALL__') {
        window.audioArtistFilter = '';
      } else if (key === '__UNASSIGNED__') {
        window.audioArtistFilter = 'UNASSIGNED';
      } else {
        window.audioArtistFilter = key;
      }
      renderAudioArtists();
      renderAudioFolders();
      renderAudioFiles();
    });
    tree.appendChild(li);
  }
  
  // ALL AUDIO folder
  createFolderItem('ALL ARTISTS', '__ALL__', !window.audioArtistFilter);
  
  // One folder per artist
  window.audioArtists.forEach(artist => {
    const isActive = window.audioArtistFilter === artist.name;
    createFolderItem(artist.name.toUpperCase(), artist.name, isActive);
  });
  
  // Unassigned folder
  const unassignedCount = window.audioFiles.filter(a => !a.artist).length;
  if (unassignedCount > 0) {
    const isActive = window.audioArtistFilter === 'UNASSIGNED';
    createFolderItem('UNASSIGNED', '__UNASSIGNED__', isActive);
  }
}

// Toggle audio selection
window.toggleAudioSelection = function(audioUrl) {
  if (window.selectedAudioFiles.has(audioUrl)) {
    window.selectedAudioFiles.delete(audioUrl);
  } else {
    window.selectedAudioFiles.add(audioUrl);
  }
  renderAudioFiles();
};

// Update audio selection counter
function updateAudioSelectionCounter() {
  const batchToolbar = document.getElementById('audioBatchToolbar');
  const selectedCountSpan = document.getElementById('audioSelectedCount');
  
  const count = window.selectedAudioFiles.size;
  
  // Show/hide batch toolbar
  if (batchToolbar) {
    batchToolbar.style.display = count > 0 ? 'flex' : 'none';
  }
  
  // Update selected count in batch toolbar
  if (selectedCountSpan) {
    selectedCountSpan.textContent = count;
  }
}

// Copy audio URL
window.copyAudioUrl = function(url) {
  navigator.clipboard.writeText(url);
  showToast('AUDIO URL COPIED TO CLIPBOARD');
};

// Delete audio file
window.deleteAudioFile = function(url) {
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
      window.audioFiles = window.audioFiles.filter(audio => audio.url !== url);
      window.selectedAudioFiles.delete(url);
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
};

// Update audio metadata
window.updateAudioMetadata = function(url, field, value) {
  // Update the metadata for the audio file
  const audio = window.audioFiles.find(a => a.url === url);
  if (audio) {
    audio[field] = value;
    // You could add a save endpoint here to persist metadata changes
    showToast('AUDIO METADATA UPDATED');
  }
};

// Audio batch operations
window.moveSelectedAudio = function() {
  if (window.selectedAudioFiles.size === 0) {
    showToast('NO AUDIO FILES SELECTED');
    return;
  }
  showToast('AUDIO MOVE FUNCTIONALITY NOT YET IMPLEMENTED');
};

window.downloadSelectedAudio = function() {
  if (window.selectedAudioFiles.size === 0) {
    showToast('NO AUDIO FILES SELECTED');
    return;
  }
  showToast(`DOWNLOAD OF ${window.selectedAudioFiles.size} AUDIO FILES NOT YET IMPLEMENTED`);
};

window.deleteSelectedAudio = function() {
  if (window.selectedAudioFiles.size === 0) return;
  
  const count = window.selectedAudioFiles.size;
  if (!confirm(`DELETE ${count} SELECTED AUDIO FILE${count > 1 ? 'S' : ''}?`)) return;
  
  showLoading();
  
  fetch('/api/assets/bulk-delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetUrls: Array.from(window.selectedAudioFiles) })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      window.audioFiles = window.audioFiles.filter(audio => !window.selectedAudioFiles.has(audio.url));
      window.selectedAudioFiles.clear();
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
};

window.deselectAllAudio = function() {
  window.selectedAudioFiles.clear();
  renderAudioFiles();
  showToast('ALL AUDIO FILES DESELECTED');
};

window.createNewAudioFolder = function() {
  const name = prompt('ENTER AUDIO FOLDER NAME:');
  if (!name) return;
  
  // Implementation would go here - creating folder in audio structure
  showToast('AUDIO FOLDER CREATED: ' + name.toUpperCase());
};

// Search audio files
window.searchAudio = function(query) {
  if (!window.audioFiles || !Array.isArray(window.audioFiles)) return [];
  
  return window.audioFiles.filter(audio => 
    (audio.name && audio.name.toLowerCase().includes(query)) ||
    (audio.filename && audio.filename.toLowerCase().includes(query)) ||
    (audio.url && audio.url.toLowerCase().includes(query))
  ).slice(0, 5); // Limit to 5 results
};

// Enhanced audio search
window.setupEnhancedAudioSearch = function() {
  const searchInput = document.getElementById('audioSearch');
  if (!searchInput) return;
  
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const searchTerm = e.target.value.toLowerCase();
    
    searchTimeout = setTimeout(() => {
      if (searchTerm) {
        const filtered = window.audioFiles.filter(audio => 
          audio.name?.toLowerCase().includes(searchTerm) ||
          audio.filename?.toLowerCase().includes(searchTerm) ||
          audio.url?.toLowerCase().includes(searchTerm)
        );
        // Re-render with filtered results
        renderFilteredAudioFiles(filtered);
      } else {
        renderAudioFiles();
      }
    }, 300);
  });
};

// Render filtered audio files
function renderFilteredAudioFiles(filteredFiles) {
  const container = document.getElementById('audioContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (filteredFiles.length === 0) {
    container.innerHTML = '<div class="empty-state">No audio files found</div>';
    return;
  }
  
  filteredFiles.forEach((audio, index) => {
    const audioDiv = document.createElement('div');
    audioDiv.className = `audio-item ${window.selectedAudioFiles.has(audio.url) ? 'selected' : ''}`;
    audioDiv.dataset.audioId = audio.url;
    
    audioDiv.innerHTML = `
      <div class="audio-item-content">
        <input type="checkbox" class="audio-checkbox" ${window.selectedAudioFiles.has(audio.url) ? 'checked' : ''} 
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

// ============================================
// AUDIO UPLOAD FUNCTIONALITY
// ============================================

// Accepted audio file types
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.aiff'];
const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/aac', 'audio/flac', 'audio/ogg', 'audio/aiff'];

// Check if a file is an audio file
function isAudioFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  return AUDIO_EXTENSIONS.includes(ext) || AUDIO_MIME_TYPES.includes(file.type);
}

// Upload a single audio file
async function uploadAudioFile(file, targetArtist = '') {
  // Determine folder path based on artist
  let folder = 'audio';
  if (targetArtist && targetArtist !== '' && targetArtist !== 'UNASSIGNED') {
    // Create artist-specific folder path
    const artistSlug = targetArtist.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    folder = `audio/${artistSlug}`;
  }
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  
  console.log(`[AUDIO UPLOAD] Uploading "${file.name}" to folder "${folder}"`);
  
  const response = await fetch('/upload-image', {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(errorData.error || `Upload failed with status ${response.status}`);
  }
  
  const data = await response.json();
  console.log(`[AUDIO UPLOAD] Success:`, data);
  return data;
}

// Upload multiple audio files
async function uploadAudioFiles(files, targetArtist = '') {
  const audioFiles = Array.from(files).filter(isAudioFile);
  
  if (audioFiles.length === 0) {
    showToast('NO AUDIO FILES SELECTED', 'error');
    return [];
  }
  
  showLoading();
  const results = [];
  const errors = [];
  
  for (let i = 0; i < audioFiles.length; i++) {
    const file = audioFiles[i];
    try {
      updateLoadingMessage(`UPLOADING ${i + 1}/${audioFiles.length}: ${file.name}`);
      const result = await uploadAudioFile(file, targetArtist);
      results.push(result);
      
      // Add to local audio files array immediately
      const newAudioEntry = {
        url: result.url || result.gcsUrl,
        filename: file.name,
        artist: targetArtist || '',
        type: 'audio',
        size: file.size,
        uploadedAt: new Date().toISOString()
      };
      window.audioFiles.push(newAudioEntry);
      
    } catch (err) {
      console.error(`[AUDIO UPLOAD] Failed to upload ${file.name}:`, err);
      errors.push({ file: file.name, error: err.message });
    }
  }
  
  hideLoading();
  
  // Refresh display
  renderAudioArtists();
  renderAudioFolders();
  renderAudioFiles();
  
  // Show result message
  if (errors.length === 0) {
    showToast(`${results.length} AUDIO FILE${results.length > 1 ? 'S' : ''} UPLOADED SUCCESSFULLY`);
  } else if (results.length > 0) {
    showToast(`${results.length} UPLOADED, ${errors.length} FAILED`, 'warning');
  } else {
    showToast('ALL UPLOADS FAILED', 'error');
  }
  
  return results;
}

// Helper to update loading message
function updateLoadingMessage(message) {
  const loadingText = document.querySelector('.loading-overlay .loading-text, .loading-message');
  if (loadingText) {
    loadingText.textContent = message;
  }
}

// Setup dropzone for audio uploads
function setupAudioDropzone() {
  const dropzone = document.getElementById('audioDropzone');
  if (!dropzone) {
    console.warn('[AUDIO] Dropzone element not found');
    return;
  }
  
  console.log('[AUDIO] Setting up dropzone...');
  
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });
  
  // Highlight dropzone when dragging over
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => {
      dropzone.classList.add('dragover');
    }, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => {
      dropzone.classList.remove('dragover');
    }, false);
  });
  
  // Handle dropped files
  dropzone.addEventListener('drop', async (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      // Upload to current artist filter if set, otherwise general audio folder
      const targetArtist = (window.audioArtistFilter && window.audioArtistFilter !== 'UNASSIGNED') 
        ? window.audioArtistFilter 
        : '';
      await uploadAudioFiles(files, targetArtist);
    }
  }, false);
  
  // Also allow click to select files
  dropzone.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = AUDIO_EXTENSIONS.join(',') + ',' + AUDIO_MIME_TYPES.join(',');
    
    input.onchange = async (e) => {
      if (e.target.files.length > 0) {
        const targetArtist = (window.audioArtistFilter && window.audioArtistFilter !== 'UNASSIGNED') 
          ? window.audioArtistFilter 
          : '';
        await uploadAudioFiles(e.target.files, targetArtist);
      }
    };
    
    input.click();
  });
  
  // Update dropzone text to be more helpful
  const dropzoneText = dropzone.querySelector('.dropzone-text');
  if (dropzoneText) {
    dropzoneText.innerHTML = `
      <span style="font-size: 2rem; display: block; margin-bottom: 8px;">🎵</span>
      DROP AUDIO FILES HERE<br>
      <span style="font-size: 0.8em; opacity: 0.7;">or click to browse • MP3, WAV, M4A, AAC, FLAC, OGG</span>
    `;
  }
  
  console.log('[AUDIO] Dropzone setup complete');
}

// ============================================
// INITIALIZATION
// ============================================

// Initialize audio module
window.initializeAudio = function() {
  console.log('🎵 Audio Module Initialized');
  loadAudioFiles();
  setupEnhancedAudioSearch();
  setupAudioDropzone();
};

// Simple refresh hook for audio section (used by REFRESH button)
window.refreshAudio = function() {
  showLoading();
  loadAudioFiles()
    .catch(err => {
      console.error('Audio refresh failed:', err);
    })
    .finally(() => {
      hideLoading();
    });
};

// Expose upload functions globally
window.uploadAudioFiles = uploadAudioFiles;
window.uploadAudioFile = uploadAudioFile;

// Export for shared use
window.audioModule = {
  loadAudioFiles,
  renderAudioFiles,
  searchAudio,
  deleteAudioFile,
  updateAudioMetadata,
  uploadAudioFiles,
  uploadAudioFile
};

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

// ============================================
// SUBFOLDER SYSTEM (Alias/Playlist-style)
// ============================================
// Subfolders are like playlists - songs can belong to multiple subfolders
// without being duplicated. The song exists once, subfolders are just references.

// Structure: { "Artist Name": ["EP 2024", "Singles", "Demos"], ... }
window.artistSubfolders = {};

// Current subfolder filter (null = show all songs for current artist)
window.currentSubfolder = null;

// Get subfolders for an artist
function getArtistSubfolders(artistName) {
  if (!artistName) return [];
  return window.artistSubfolders[artistName] || [];
}

// Create a new subfolder for an artist
window.createSubfolder = function(artistName, folderName) {
  if (!artistName || !folderName) return false;
  
  if (!window.artistSubfolders[artistName]) {
    window.artistSubfolders[artistName] = [];
  }
  
  // Check if already exists
  if (window.artistSubfolders[artistName].includes(folderName)) {
    showToast('SUBFOLDER ALREADY EXISTS', 'error');
    return false;
  }
  
  window.artistSubfolders[artistName].push(folderName);
  saveSubfoldersToStorage();
  return true;
};

// Rename a subfolder
window.renameSubfolder = function(artistName, oldName, newName) {
  if (!artistName || !oldName || !newName) return false;
  
  const folders = window.artistSubfolders[artistName];
  if (!folders) return false;
  
  const index = folders.indexOf(oldName);
  if (index === -1) return false;
  
  // Update folder name
  folders[index] = newName;
  
  // Update all audio files that reference this subfolder
  window.audioFiles.forEach(audio => {
    if (audio.artist === artistName && audio.subfolders) {
      const subIdx = audio.subfolders.indexOf(oldName);
      if (subIdx !== -1) {
        audio.subfolders[subIdx] = newName;
      }
    }
  });
  
  saveSubfoldersToStorage();
  return true;
};

// Delete a subfolder (removes references from songs, doesn't delete songs)
window.deleteSubfolder = function(artistName, folderName) {
  if (!artistName || !folderName) return false;
  
  const folders = window.artistSubfolders[artistName];
  if (!folders) return false;
  
  const index = folders.indexOf(folderName);
  if (index === -1) return false;
  
  // Remove folder
  folders.splice(index, 1);
  
  // Remove subfolder reference from all audio files
  window.audioFiles.forEach(audio => {
    if (audio.artist === artistName && audio.subfolders) {
      const subIdx = audio.subfolders.indexOf(folderName);
      if (subIdx !== -1) {
        audio.subfolders.splice(subIdx, 1);
      }
    }
  });
  
  // Reset current subfolder if it was deleted
  if (window.currentSubfolder === folderName) {
    window.currentSubfolder = null;
  }
  
  saveSubfoldersToStorage();
  return true;
};

// Add song(s) to a subfolder (creates alias, not copy)
window.addToSubfolder = function(audioUrls, artistName, folderName) {
  if (!Array.isArray(audioUrls)) audioUrls = [audioUrls];
  
  let addedCount = 0;
  audioUrls.forEach(url => {
    const audio = window.audioFiles.find(a => a.url === url);
    if (audio && audio.artist === artistName) {
      if (!audio.subfolders) audio.subfolders = [];
      if (!audio.subfolders.includes(folderName)) {
        audio.subfolders.push(folderName);
        addedCount++;
      }
    }
  });
  
  saveSubfoldersToStorage();
  return addedCount;
};

// Remove song(s) from a subfolder (removes alias, song still exists)
window.removeFromSubfolder = function(audioUrls, folderName) {
  if (!Array.isArray(audioUrls)) audioUrls = [audioUrls];
  
  let removedCount = 0;
  audioUrls.forEach(url => {
    const audio = window.audioFiles.find(a => a.url === url);
    if (audio && audio.subfolders) {
      const index = audio.subfolders.indexOf(folderName);
      if (index !== -1) {
        audio.subfolders.splice(index, 1);
        removedCount++;
      }
    }
  });
  
  saveSubfoldersToStorage();
  return removedCount;
};

// Save subfolders to localStorage (and optionally sync to server)
function saveSubfoldersToStorage() {
  try {
    localStorage.setItem('amf_audio_subfolders', JSON.stringify(window.artistSubfolders));
    
    // Also save subfolder assignments in audio files
    localStorage.setItem('amf_audio_subfolder_assignments', JSON.stringify(
      window.audioFiles.map(a => ({ url: a.url, subfolders: a.subfolders || [] }))
    ));
  } catch (e) {
    console.warn('[AUDIO] Failed to save subfolders to localStorage:', e);
  }
}

// Load subfolders from localStorage
function loadSubfoldersFromStorage() {
  try {
    const saved = localStorage.getItem('amf_audio_subfolders');
    if (saved) {
      window.artistSubfolders = JSON.parse(saved);
    }
    
    // Restore subfolder assignments to audio files
    const assignments = localStorage.getItem('amf_audio_subfolder_assignments');
    if (assignments) {
      const parsed = JSON.parse(assignments);
      parsed.forEach(item => {
        const audio = window.audioFiles.find(a => a.url === item.url);
        if (audio && item.subfolders?.length) {
          audio.subfolders = item.subfolders;
        }
      });
    }
  } catch (e) {
    console.warn('[AUDIO] Failed to load subfolders from localStorage:', e);
  }
}

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
        // Initialize subfolders array if not present
        if (!audio.subfolders) {
          audio.subfolders = [];
        }
      });
      
      // 4) Load subfolder data from localStorage
      loadSubfoldersFromStorage();
      
      renderAudioArtists();
      renderAudioFolders();
      renderAudioFiles();
    })
    .catch(err => {
      console.error('Failed to load audio files:', err);
      showToast('FAILED TO LOAD AUDIO FILES', 'error');
    });
};

// ============================================
// AUDIO PLAYER STATE
// ============================================
window.currentlyPlayingUrl = null;
window.audioElement = null;

// Format duration from seconds
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Get filename without extension for display
function getDisplayName(audio) {
  const filename = audio.filename || audio.name || audio.url.split('/').pop() || 'Untitled';
  return filename.replace(/\.(mp3|wav|m4a|aac|flac|ogg|aiff)$/i, '');
}

// Escape HTML for safe insertion
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

// ============================================
// RENDER AUDIO LIST (iTunes-style)
// ============================================
window.renderAudioFiles = function() {
  const container = document.getElementById('audioContainer');
  if (!container) return;
  
  let filesToRender = window.audioFiles;
  
  // Apply artist hub filter if any
  if (window.audioArtistFilter) {
    if (window.audioArtistFilter === 'UNASSIGNED') {
      filesToRender = filesToRender.filter(a => !a.artist);
    } else {
      filesToRender = filesToRender.filter(a => a.artist === window.audioArtistFilter);
    }
  }
  
  // Apply subfolder filter if any (only when viewing an artist)
  if (window.currentSubfolder && window.audioArtistFilter && window.audioArtistFilter !== 'UNASSIGNED') {
    filesToRender = filesToRender.filter(a => 
      a.subfolders && a.subfolders.includes(window.currentSubfolder)
    );
  }
  
  // Build iTunes-style table
  container.innerHTML = `
    <div class="audio-list">
      <div class="audio-table-header">
        <span></span>
        <span></span>
        <span>TITLE</span>
        <span>ARTIST</span>
        <span>TIME</span>
        <span></span>
      </div>
      <div class="audio-rows" id="audioRows">
        ${filesToRender.length === 0 ? '<div style="padding: 40px; text-align: center; color: var(--grey-500);">No audio files</div>' : ''}
      </div>
    </div>
    <div class="audio-now-playing" id="audioNowPlaying">
      <div class="audio-now-playing-controls">
        <button class="audio-now-playing-btn" onclick="audioSkipPrev()" title="Previous">⏮</button>
        <button class="audio-now-playing-btn play" id="nowPlayingPlayBtn" onclick="audioTogglePlay()" title="Play/Pause">▶</button>
        <button class="audio-now-playing-btn" onclick="audioSkipNext()" title="Next">⏭</button>
      </div>
      <div class="audio-now-playing-info">
        <div class="audio-now-playing-title" id="nowPlayingTitle">-</div>
        <div class="audio-now-playing-artist" id="nowPlayingArtist">-</div>
      </div>
      <div class="audio-progress">
        <span class="audio-time" id="audioCurrentTime">0:00</span>
        <div class="audio-progress-bar" id="audioProgressBar" onclick="audioSeek(event)">
          <div class="audio-progress-fill" id="audioProgressFill"></div>
        </div>
        <span class="audio-time" id="audioDuration">0:00</span>
      </div>
    </div>
  `;
  
  const rowsContainer = document.getElementById('audioRows');
  
  filesToRender.forEach((audio, index) => {
    const isPlaying = window.currentlyPlayingUrl === audio.url;
    const isSelected = window.selectedAudioFiles.has(audio.url);
    const displayName = getDisplayName(audio);
    const escapedUrl = escapeHtml(audio.url);
    
    const row = document.createElement('div');
    row.className = `audio-row${isSelected ? ' selected' : ''}${isPlaying ? ' playing' : ''}`;
    row.dataset.url = audio.url;
    row.draggable = true;
    
    // Build subfolder badges
    const subfolderBadges = (audio.subfolders && audio.subfolders.length > 0) 
      ? audio.subfolders.map(sf => `<span class="audio-subfolder-badge">${escapeHtml(sf)}</span>`).join('')
      : '';
    
    // Show add-to-subfolder button only when viewing an artist with subfolders
    const showSubfolderBtn = window.audioArtistFilter && 
                              window.audioArtistFilter !== 'UNASSIGNED' && 
                              getArtistSubfolders(window.audioArtistFilter).length > 0;
    
    row.innerHTML = `
      <input type="checkbox" class="audio-row-checkbox" 
             ${isSelected ? 'checked' : ''} 
             onchange="toggleAudioSelection('${escapedUrl}')">
      <button class="audio-play-btn" onclick="playAudio('${escapedUrl}')" title="Play">
        ${isPlaying ? '❚❚' : '▶'}
      </button>
      <div class="audio-title-cell">
        <input type="text" class="audio-title-input" value="${escapeHtml(displayName)}" 
               onchange="updateAudioMetadata('${escapedUrl}', 'filename', this.value)"
               title="${escapedUrl}">
        ${subfolderBadges ? `<div class="audio-subfolder-badges">${subfolderBadges}</div>` : ''}
      </div>
      <div class="audio-artist ${!audio.artist ? 'unassigned' : ''}" 
           onclick="showMoveModal('${escapedUrl}')" 
           title="Click to change artist">
        ${audio.artist || 'UNASSIGNED'}
      </div>
      <div class="audio-duration" data-url="${escapedUrl}">--:--</div>
      <div class="audio-actions">
        ${showSubfolderBtn ? `<button class="audio-action-btn" onclick="showSubfolderModal('${escapedUrl}')" title="Add to subfolder">📁</button>` : ''}
        <button class="audio-action-btn" onclick="copyAudioUrl('${escapedUrl}')" title="Copy URL">📋</button>
        <button class="audio-action-btn" onclick="showMoveModal('${escapedUrl}')" title="Move artist">↗</button>
        <button class="audio-action-btn danger" onclick="${window.currentSubfolder ? `removeFromCurrentSubfolder('${escapedUrl}')` : `deleteAudioFile('${escapedUrl}')`}" title="${window.currentSubfolder ? 'Remove from folder' : 'Delete'}">✕</button>
      </div>
    `;
    
    // Add drag events for reordering
    row.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', audio.url);
      row.classList.add('dragging');
    });
    
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
    });
    
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dragging = document.querySelector('.audio-row.dragging');
      if (dragging && dragging !== row) {
        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          row.parentNode.insertBefore(dragging, row);
        } else {
          row.parentNode.insertBefore(dragging, row.nextSibling);
        }
      }
    });
    
    // Double-click to play
    row.addEventListener('dblclick', () => {
      playAudio(audio.url);
    });
    
    rowsContainer.appendChild(row);
    
    // Load duration asynchronously
    loadAudioDuration(audio.url);
  });
  
  // Update count indicator
  const countIndicator = document.getElementById('audioCountIndicator');
  if (countIndicator) {
    countIndicator.textContent = `${filesToRender.length} TRACK${filesToRender.length !== 1 ? 'S' : ''}`;
  }
  
  updateAudioSelectionCounter();
  
  // Restore now playing state
  if (window.currentlyPlayingUrl) {
    updateNowPlayingBar();
  }
};

// Load audio duration for a track
function loadAudioDuration(url) {
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.src = url;
  audio.onloadedmetadata = () => {
    const durationEl = document.querySelector(`.audio-duration[data-url="${CSS.escape(url)}"]`);
    if (durationEl) {
      durationEl.textContent = formatDuration(audio.duration);
    }
    // Store duration in the audio file object
    const audioFile = window.audioFiles.find(a => a.url === url);
    if (audioFile) {
      audioFile.duration = audio.duration;
    }
  };
}

// ============================================
// AUDIO PLAYBACK CONTROLS
// ============================================

// Play a specific audio file
window.playAudio = function(url) {
  // If clicking the same track, toggle play/pause
  if (window.currentlyPlayingUrl === url && window.audioElement) {
    if (window.audioElement.paused) {
      window.audioElement.play();
    } else {
      window.audioElement.pause();
    }
    updatePlayingState();
    return;
  }
  
  // Stop current audio if playing
  if (window.audioElement) {
    window.audioElement.pause();
    window.audioElement = null;
  }
  
  // Create new audio element
  window.audioElement = new Audio(url);
  window.currentlyPlayingUrl = url;
  
  window.audioElement.addEventListener('timeupdate', updateProgress);
  window.audioElement.addEventListener('ended', handleAudioEnded);
  window.audioElement.addEventListener('play', updatePlayingState);
  window.audioElement.addEventListener('pause', updatePlayingState);
  
  window.audioElement.play();
  updateNowPlayingBar();
  renderAudioFiles(); // Re-render to show playing state
};

// Toggle play/pause for current track
window.audioTogglePlay = function() {
  if (!window.audioElement) return;
  
  if (window.audioElement.paused) {
    window.audioElement.play();
  } else {
    window.audioElement.pause();
  }
};

// Skip to previous track
window.audioSkipPrev = function() {
  const currentIndex = getCurrentPlayingIndex();
  if (currentIndex > 0) {
    const filteredFiles = getFilteredAudioFiles();
    playAudio(filteredFiles[currentIndex - 1].url);
  }
};

// Skip to next track
window.audioSkipNext = function() {
  const currentIndex = getCurrentPlayingIndex();
  const filteredFiles = getFilteredAudioFiles();
  if (currentIndex < filteredFiles.length - 1) {
    playAudio(filteredFiles[currentIndex + 1].url);
  }
};

// Seek in current track
window.audioSeek = function(event) {
  if (!window.audioElement) return;
  
  const bar = document.getElementById('audioProgressBar');
  const rect = bar.getBoundingClientRect();
  const percent = (event.clientX - rect.left) / rect.width;
  window.audioElement.currentTime = percent * window.audioElement.duration;
};

// Get filtered audio files based on current filter
function getFilteredAudioFiles() {
  let files = window.audioFiles;
  if (window.audioArtistFilter) {
    if (window.audioArtistFilter === 'UNASSIGNED') {
      files = files.filter(a => !a.artist);
    } else {
      files = files.filter(a => a.artist === window.audioArtistFilter);
    }
  }
  return files;
}

// Get index of currently playing track
function getCurrentPlayingIndex() {
  if (!window.currentlyPlayingUrl) return -1;
  const filteredFiles = getFilteredAudioFiles();
  return filteredFiles.findIndex(a => a.url === window.currentlyPlayingUrl);
}

// Update progress bar
function updateProgress() {
  if (!window.audioElement) return;
  
  const currentTime = window.audioElement.currentTime;
  const duration = window.audioElement.duration;
  
  document.getElementById('audioCurrentTime').textContent = formatDuration(currentTime);
  document.getElementById('audioDuration').textContent = formatDuration(duration);
  
  const percent = (currentTime / duration) * 100;
  document.getElementById('audioProgressFill').style.width = `${percent}%`;
}

// Handle audio ended
function handleAudioEnded() {
  // Auto-play next track
  audioSkipNext();
}

// Update playing state UI
function updatePlayingState() {
  const playBtn = document.getElementById('nowPlayingPlayBtn');
  if (playBtn && window.audioElement) {
    playBtn.textContent = window.audioElement.paused ? '▶' : '❚❚';
  }
  
  // Update row play buttons
  document.querySelectorAll('.audio-row').forEach(row => {
    const btn = row.querySelector('.audio-play-btn');
    const isPlaying = row.dataset.url === window.currentlyPlayingUrl;
    row.classList.toggle('playing', isPlaying && !window.audioElement?.paused);
    if (btn) {
      btn.textContent = (isPlaying && !window.audioElement?.paused) ? '❚❚' : '▶';
    }
  });
}

// Update now playing bar
function updateNowPlayingBar() {
  const nowPlaying = document.getElementById('audioNowPlaying');
  if (!nowPlaying) return;
  
  if (window.currentlyPlayingUrl) {
    const audio = window.audioFiles.find(a => a.url === window.currentlyPlayingUrl);
    if (audio) {
      document.getElementById('nowPlayingTitle').textContent = getDisplayName(audio);
      document.getElementById('nowPlayingArtist').textContent = audio.artist || 'UNASSIGNED';
      nowPlaying.classList.add('active');
    }
  } else {
    nowPlaying.classList.remove('active');
  }
}

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
    window.currentSubfolder = null; // Reset subfolder when changing artist
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
      // Only reset subfolder if changing to a different artist
      if (window.audioArtistFilter !== artist.name) {
        window.currentSubfolder = null;
      }
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
      window.currentSubfolder = null;
      renderAudioArtists();
      renderAudioFiles();
    });
    // Enable drop on unassigned (uploads to general audio folder)
    setupDropTarget(unassigned, '');
    container.appendChild(unassigned);
  }
  
  // ============================================
  // SUBFOLDERS SECTION (when artist is selected)
  // ============================================
  if (window.audioArtistFilter && window.audioArtistFilter !== 'UNASSIGNED') {
    renderSubfoldersSection(container);
  }
}

// Render subfolders section for current artist
function renderSubfoldersSection(container) {
  const artistName = window.audioArtistFilter;
  const subfolders = getArtistSubfolders(artistName);
  const artistTracks = window.audioFiles.filter(a => a.artist === artistName);
  
  // Create subfolders container
  const subfoldersDiv = document.createElement('div');
  subfoldersDiv.className = 'audio-subfolders-section';
  subfoldersDiv.innerHTML = `
    <div class="audio-subfolders-header">
      <span class="audio-subfolders-title">FOLDERS</span>
      <button class="audio-subfolder-add-btn" onclick="promptCreateSubfolder()" title="Create new folder">+</button>
    </div>
    <div class="audio-subfolders-list" id="audioSubfoldersList"></div>
  `;
  
  container.appendChild(subfoldersDiv);
  
  const listEl = document.getElementById('audioSubfoldersList');
  
  // "All Songs" option (shows all songs for this artist)
  const allSongsBtn = document.createElement('button');
  allSongsBtn.className = `audio-subfolder-btn${!window.currentSubfolder ? ' active' : ''}`;
  allSongsBtn.innerHTML = `
    <span class="audio-subfolder-name">ALL SONGS</span>
    <span class="audio-subfolder-count">${artistTracks.length}</span>
  `;
  allSongsBtn.addEventListener('click', () => {
    window.currentSubfolder = null;
    renderAudioArtists();
    renderAudioFiles();
  });
  listEl.appendChild(allSongsBtn);
  
  // Render each subfolder
  subfolders.forEach(folderName => {
    const count = artistTracks.filter(a => a.subfolders?.includes(folderName)).length;
    
    const btn = document.createElement('button');
    btn.className = `audio-subfolder-btn${window.currentSubfolder === folderName ? ' active' : ''}`;
    btn.draggable = false;
    btn.innerHTML = `
      <span class="audio-subfolder-name">${escapeHtml(folderName)}</span>
      <span class="audio-subfolder-count">${count}</span>
      <span class="audio-subfolder-actions">
        <button class="audio-subfolder-action" onclick="event.stopPropagation(); promptRenameSubfolder('${escapeHtml(folderName)}')" title="Rename">✎</button>
        <button class="audio-subfolder-action danger" onclick="event.stopPropagation(); confirmDeleteSubfolder('${escapeHtml(folderName)}')" title="Delete folder">✕</button>
      </span>
    `;
    
    btn.addEventListener('click', () => {
      window.currentSubfolder = folderName;
      renderAudioArtists();
      renderAudioFiles();
    });
    
    // Enable drop on subfolder to add songs
    setupSubfolderDropTarget(btn, folderName);
    
    listEl.appendChild(btn);
  });
}

// Setup drop target on subfolder buttons
function setupSubfolderDropTarget(element, folderName) {
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    element.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });
  
  ['dragenter', 'dragover'].forEach(eventName => {
    element.addEventListener(eventName, () => element.classList.add('drop-target'), false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    element.addEventListener(eventName, () => element.classList.remove('drop-target'), false);
  });
  
  element.addEventListener('drop', (e) => {
    const audioUrl = e.dataTransfer.getData('text/plain');
    if (audioUrl && window.audioArtistFilter) {
      const added = addToSubfolder(audioUrl, window.audioArtistFilter, folderName);
      if (added > 0) {
        showToast(`ADDED TO ${folderName.toUpperCase()}`);
        renderAudioArtists();
        renderAudioFiles();
      }
    }
  }, false);
}

// Prompt to create new subfolder
window.promptCreateSubfolder = function() {
  const artistName = window.audioArtistFilter;
  if (!artistName || artistName === 'UNASSIGNED') {
    showToast('SELECT AN ARTIST FIRST', 'error');
    return;
  }
  
  const folderName = prompt('ENTER FOLDER NAME:');
  if (!folderName || !folderName.trim()) return;
  
  if (createSubfolder(artistName, folderName.trim())) {
    showToast(`FOLDER "${folderName.toUpperCase()}" CREATED`);
    renderAudioArtists();
  }
};

// Prompt to rename subfolder
window.promptRenameSubfolder = function(oldName) {
  const artistName = window.audioArtistFilter;
  const newName = prompt('RENAME FOLDER:', oldName);
  if (!newName || !newName.trim() || newName === oldName) return;
  
  if (renameSubfolder(artistName, oldName, newName.trim())) {
    showToast(`FOLDER RENAMED TO "${newName.toUpperCase()}"`);
    if (window.currentSubfolder === oldName) {
      window.currentSubfolder = newName.trim();
    }
    renderAudioArtists();
    renderAudioFiles();
  }
};

// Confirm delete subfolder
window.confirmDeleteSubfolder = function(folderName) {
  const artistName = window.audioArtistFilter;
  if (!confirm(`DELETE FOLDER "${folderName}"?\n\nThis will not delete the songs, only the folder.`)) return;
  
  if (deleteSubfolder(artistName, folderName)) {
    showToast(`FOLDER "${folderName.toUpperCase()}" DELETED`);
    renderAudioArtists();
    renderAudioFiles();
  }
};

// Remove from current subfolder
window.removeFromCurrentSubfolder = function(url) {
  if (!window.currentSubfolder) return;
  
  const removed = removeFromSubfolder(url, window.currentSubfolder);
  if (removed > 0) {
    showToast('REMOVED FROM FOLDER');
    renderAudioFiles();
    renderAudioArtists();
  }
};

// Show modal to add song to subfolder
window.showSubfolderModal = function(url) {
  const artistName = window.audioArtistFilter;
  if (!artistName || artistName === 'UNASSIGNED') return;
  
  const subfolders = getArtistSubfolders(artistName);
  if (subfolders.length === 0) {
    showToast('NO SUBFOLDERS - CREATE ONE FIRST');
    return;
  }
  
  const audio = window.audioFiles.find(a => a.url === url);
  if (!audio) return;
  
  // Create modal
  let modal = document.getElementById('audioSubfolderModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'audioSubfolderModal';
    modal.className = 'audio-move-modal';
    document.body.appendChild(modal);
  }
  
  const currentFolders = audio.subfolders || [];
  
  modal.innerHTML = `
    <div class="audio-move-content">
      <div class="audio-move-title">ADD TO FOLDER</div>
      <div class="audio-move-list">
        ${subfolders.map(sf => `
          <div class="audio-move-option ${currentFolders.includes(sf) ? 'selected' : ''}" 
               data-folder="${escapeHtml(sf)}" data-url="${escapeHtml(url)}">
            <span>${currentFolders.includes(sf) ? '☑' : '☐'} ${escapeHtml(sf)}</span>
          </div>
        `).join('')}
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn" onclick="closeSubfolderModal()">DONE</button>
      </div>
    </div>
  `;
  
  // Toggle folder assignment on click
  modal.querySelectorAll('.audio-move-option').forEach(option => {
    option.addEventListener('click', () => {
      const folder = option.dataset.folder;
      const audioUrl = option.dataset.url;
      const audioFile = window.audioFiles.find(a => a.url === audioUrl);
      
      if (!audioFile.subfolders) audioFile.subfolders = [];
      
      if (audioFile.subfolders.includes(folder)) {
        // Remove from folder
        removeFromSubfolder(audioUrl, folder);
        option.classList.remove('selected');
        option.querySelector('span').textContent = `☐ ${folder}`;
      } else {
        // Add to folder
        addToSubfolder(audioUrl, artistName, folder);
        option.classList.add('selected');
        option.querySelector('span').textContent = `☑ ${folder}`;
      }
    });
  });
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeSubfolderModal();
  });
  
  modal.classList.add('active');
};

window.closeSubfolderModal = function() {
  const modal = document.getElementById('audioSubfolderModal');
  if (modal) {
    modal.classList.remove('active');
    // Refresh UI
    renderAudioArtists();
    renderAudioFiles();
  }
};

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

// ============================================
// MOVE AUDIO FUNCTIONALITY
// ============================================

// Currently selected URL for move (single item)
window.moveTargetUrl = null;

// Show move modal for single or multiple files
window.showMoveModal = function(url = null) {
  // Determine which files to move
  let urlsToMove = [];
  if (url) {
    urlsToMove = [url];
    window.moveTargetUrl = url;
  } else if (window.selectedAudioFiles.size > 0) {
    urlsToMove = Array.from(window.selectedAudioFiles);
    window.moveTargetUrl = null;
  } else {
    showToast('NO AUDIO FILES SELECTED');
    return;
  }
  
  // Create modal if it doesn't exist
  let modal = document.getElementById('audioMoveModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'audioMoveModal';
    modal.className = 'audio-move-modal';
    document.body.appendChild(modal);
  }
  
  const count = urlsToMove.length;
  
  // Build artist options
  const artistOptions = window.audioArtists.map(artist => `
    <div class="audio-move-option" data-artist="${escapeHtml(artist.name)}">
      <div class="audio-artist-avatar" style="${artist.coverImage ? `background-image:url('${artist.coverImage}')` : 'background: var(--grey-300)'}; width: 24px; height: 24px; border-radius: 50%;"></div>
      <span>${artist.name}</span>
    </div>
  `).join('');
  
  modal.innerHTML = `
    <div class="audio-move-content">
      <div class="audio-move-title">MOVE ${count} TRACK${count > 1 ? 'S' : ''} TO ARTIST</div>
      <div class="audio-move-list">
        <div class="audio-move-option" data-artist="">
          <span style="opacity: 0.5;">— UNASSIGNED —</span>
        </div>
        ${artistOptions}
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn" onclick="closeMoveModal()">CANCEL</button>
      </div>
    </div>
  `;
  
  // Add click handlers to options
  modal.querySelectorAll('.audio-move-option').forEach(option => {
    option.addEventListener('click', () => {
      const targetArtist = option.dataset.artist;
      executeMove(urlsToMove, targetArtist);
      closeMoveModal();
    });
  });
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeMoveModal();
    }
  });
  
  modal.classList.add('active');
};

// Close move modal
window.closeMoveModal = function() {
  const modal = document.getElementById('audioMoveModal');
  if (modal) {
    modal.classList.remove('active');
  }
  window.moveTargetUrl = null;
};

// Execute the move operation
async function executeMove(urls, targetArtist) {
  showLoading();
  
  let successCount = 0;
  let failCount = 0;
  
  for (const url of urls) {
    const audio = window.audioFiles.find(a => a.url === url);
    if (audio) {
      // Update local state immediately
      audio.artist = targetArtist;
      successCount++;
      
      // Optionally: call backend to persist the change
      // For now, we'll update locally and save when user saves
    }
  }
  
  hideLoading();
  
  // Clear selection
  window.selectedAudioFiles.clear();
  
  // Re-render
  renderAudioArtists();
  renderAudioFiles();
  
  showToast(`MOVED ${successCount} TRACK${successCount > 1 ? 'S' : ''} TO ${targetArtist || 'UNASSIGNED'}`);
}

// Audio batch operations
window.moveSelectedAudio = function() {
  if (window.selectedAudioFiles.size === 0) {
    showToast('NO AUDIO FILES SELECTED');
    return;
  }
  showMoveModal();
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

// Render filtered audio files (search results)
function renderFilteredAudioFiles(filteredFiles) {
  const container = document.getElementById('audioContainer');
  if (!container) return;
  
  // Build iTunes-style table for search results
  container.innerHTML = `
    <div class="audio-list">
      <div class="audio-table-header">
        <span></span>
        <span></span>
        <span>TITLE</span>
        <span>ARTIST</span>
        <span>TIME</span>
        <span></span>
      </div>
      <div class="audio-rows" id="audioRows">
        ${filteredFiles.length === 0 ? '<div style="padding: 40px; text-align: center; color: var(--grey-500);">No matches found</div>' : ''}
      </div>
    </div>
  `;
  
  const rowsContainer = document.getElementById('audioRows');
  
  filteredFiles.forEach((audio) => {
    const isPlaying = window.currentlyPlayingUrl === audio.url;
    const isSelected = window.selectedAudioFiles.has(audio.url);
    const displayName = getDisplayName(audio);
    const escapedUrl = escapeHtml(audio.url);
    
    const row = document.createElement('div');
    row.className = `audio-row${isSelected ? ' selected' : ''}${isPlaying ? ' playing' : ''}`;
    row.dataset.url = audio.url;
    
    row.innerHTML = `
      <input type="checkbox" class="audio-row-checkbox" 
             ${isSelected ? 'checked' : ''} 
             onchange="toggleAudioSelection('${escapedUrl}')">
      <button class="audio-play-btn" onclick="playAudio('${escapedUrl}')" title="Play">
        ${isPlaying ? '❚❚' : '▶'}
      </button>
      <input type="text" class="audio-title-input" value="${escapeHtml(displayName)}" 
             onchange="updateAudioMetadata('${escapedUrl}', 'filename', this.value)"
             title="${escapedUrl}">
      <div class="audio-artist ${!audio.artist ? 'unassigned' : ''}" 
           onclick="showMoveModal('${escapedUrl}')" 
           title="Click to change artist">
        ${audio.artist || 'UNASSIGNED'}
      </div>
      <div class="audio-duration">${audio.duration ? formatDuration(audio.duration) : '--:--'}</div>
      <div class="audio-actions">
        <button class="audio-action-btn" onclick="copyAudioUrl('${escapedUrl}')" title="Copy URL">📋</button>
        <button class="audio-action-btn" onclick="showMoveModal('${escapedUrl}')" title="Move">↗</button>
        <button class="audio-action-btn danger" onclick="deleteAudioFile('${escapedUrl}')" title="Delete">✕</button>
      </div>
    `;
    
    row.addEventListener('dblclick', () => playAudio(audio.url));
    rowsContainer.appendChild(row);
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
      <span style="font-size: 1.2rem; margin-right: 8px;">🎵</span>
      DROP AUDIO FILES HERE
      <span style="font-size: 0.75em; opacity: 0.5; margin-left: 8px;">or click • MP3, WAV, M4A, AAC, FLAC, OGG</span>
    `;
    dropzoneText.style.display = 'flex';
    dropzoneText.style.alignItems = 'center';
    dropzoneText.style.justifyContent = 'center';
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

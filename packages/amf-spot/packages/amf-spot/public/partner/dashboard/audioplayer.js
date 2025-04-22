// Audio Player Implementation
document.addEventListener('DOMContentLoaded', function() {
  console.log('[AudioPlayer] Initializing...');
  
  // Get artist ID from URL
  const pathParts = window.location.pathname.split('/');
  const artistIndex = pathParts.indexOf('dashboard') - 1;
  const artist = pathParts[artistIndex] || 'default-artist';
  
  // Create main audio section
  createAudioPlayer();
  
  // Load audio data
  loadAudioData(artist);
  
  // Setup keyboard shortcuts
  setupKeyboardShortcuts();
});

// Store the current state of the player
const state = {
  currentPlaylist: 'showcase',
  playlists: {
    showcase: { name: 'Showcase', tracks: [] },
    archive: { name: 'Archive', tracks: [] },
    singles: { name: 'Singles', tracks: [] }
  },
  currentTrack: null,
  currentView: 'grid',
  isPlaying: false,
  comments: [],
  audioElement: null
};

// Create the audio player DOM structure
function createAudioPlayer() {
  console.log('[AudioPlayer] Creating audio player section');
  
  // Find existing audio section or create new one
  let audioSection = document.querySelector('.audio-section');
  if (!audioSection) {
    audioSection = document.createElement('div');
    audioSection.className = 'audio-section';
    
    // Insert after coverflow or at beginning of body
    const coverflow = document.getElementById('coverflow-hero');
    if (coverflow && coverflow.nextElementSibling) {
      coverflow.parentNode.insertBefore(audioSection, coverflow.nextElementSibling);
    } else if (coverflow) {
      coverflow.parentNode.appendChild(audioSection);
    } else {
      document.body.appendChild(audioSection);
    }
  }
  
  // Audio container
  const audioContainer = document.createElement('div');
  audioContainer.className = 'audio-container';
  
  // Audio header
  const audioHeader = document.createElement('div');
  audioHeader.className = 'audio-header';
  
  const audioTitle = document.createElement('h2');
  audioTitle.className = 'audio-title';
  audioTitle.textContent = 'Music';
  
  const audioActions = document.createElement('div');
  audioActions.className = 'audio-actions';
  
  // Playlist selector
  const playlistSelector = document.createElement('div');
  playlistSelector.className = 'playlist-selector';
  
  const playlistSelected = document.createElement('div');
  playlistSelected.className = 'playlist-selected';
  playlistSelected.innerHTML = `
    <span>Showcase</span>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `;
  
  const playlistDropdown = document.createElement('div');
  playlistDropdown.className = 'playlist-dropdown';
  
  // Add each playlist to the dropdown
  Object.keys(state.playlists).forEach(key => {
    const playlistItem = document.createElement('div');
    playlistItem.className = `playlist-item ${key === state.currentPlaylist ? 'active' : ''}`;
    playlistItem.dataset.playlist = key;
    playlistItem.textContent = state.playlists[key].name;
    playlistDropdown.appendChild(playlistItem);
  });
  
  // View toggle
  const viewToggle = document.createElement('div');
  viewToggle.className = 'view-toggle';
  
  const gridButton = document.createElement('button');
  gridButton.className = 'active';
  gridButton.dataset.view = 'grid';
  gridButton.textContent = 'Grid';
  
  const circleButton = document.createElement('button');
  circleButton.dataset.view = 'circle';
  circleButton.textContent = 'Circle';
  
  viewToggle.appendChild(gridButton);
  viewToggle.appendChild(circleButton);
  
  // Player layouts
  const playerLayouts = document.createElement('div');
  playerLayouts.className = 'player-layouts';
  
  // Grid view
  const gridView = document.createElement('div');
  gridView.className = 'grid-view';
  gridView.innerHTML = '<div class="loading">Loading tracks...</div>';
  
  // Circle view
  const circleView = document.createElement('div');
  circleView.className = 'circle-view hidden';
  
  // Comments section
  const commentsSection = document.createElement('div');
  commentsSection.className = 'comments-section';
  
  const commentsHeader = document.createElement('div');
  commentsHeader.className = 'comments-header';
  
  const commentsTitle = document.createElement('h3');
  commentsTitle.className = 'comments-title';
  commentsTitle.textContent = 'Comments';
  
  commentsHeader.appendChild(commentsTitle);
  
  const commentList = document.createElement('div');
  commentList.className = 'comment-list';
  
  const commentForm = document.createElement('div');
  commentForm.className = 'comment-form';
  commentForm.innerHTML = `
    <div class="comment-avatar">
      <span>U</span>
    </div>
    <div class="comment-input-container">
      <textarea class="comment-input" placeholder="Add a comment... (Press 'C' while playing to timestamp)"></textarea>
      <div class="comment-input-actions">
        <button class="timestamp-button" title="Add timestamp at current playback position">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </button>
        <button class="submit-comment">Comment</button>
      </div>
    </div>
  `;
  
  // Assemble the structure
  playlistSelector.appendChild(playlistSelected);
  playlistSelector.appendChild(playlistDropdown);
  
  audioActions.appendChild(playlistSelector);
  audioActions.appendChild(viewToggle);
  
  audioHeader.appendChild(audioTitle);
  audioHeader.appendChild(audioActions);
  
  playerLayouts.appendChild(gridView);
  playerLayouts.appendChild(circleView);
  
  commentsSection.appendChild(commentsHeader);
  commentsSection.appendChild(commentList);
  commentsSection.appendChild(commentForm);
  
  audioContainer.appendChild(audioHeader);
  audioContainer.appendChild(playerLayouts);
  audioContainer.appendChild(commentsSection);
  
  audioSection.appendChild(audioContainer);
  
  // Create hidden audio element
  state.audioElement = document.createElement('audio');
  state.audioElement.id = 'hidden-audio-player';
  state.audioElement.style.display = 'none';
  document.body.appendChild(state.audioElement);
  
  // Add event listeners
  attachEventListeners();
}

// Load audio data from the API
function loadAudioData(artist) {
  console.log(`[AudioPlayer] Loading audio data for artist: ${artist}`);
  
  // Clear grid and circle views
  const gridView = document.querySelector('.grid-view');
  const circleView = document.querySelector('.circle-view');
  
  gridView.innerHTML = '<div class="loading">Loading tracks...</div>';
  circleView.innerHTML = '';
  
  // Fetch audio files from API
  fetch(`/api/${artist}/audio-files`)
    .then(response => {
      if (!response.ok) throw new Error('Failed to load audio files');
      return response.json();
    })
    .then(data => {
      console.log('[AudioPlayer] Audio data loaded:', data);
      
      // If no tracks returned, use placeholder data
      if (!data.files || data.files.length === 0) {
        data = generatePlaceholderData();
      }
      
      // Update playlists with the fetched data
      organizeTracks(data);
      
      // Render the current playlist
      renderPlaylist(state.currentPlaylist);
      
      // Load comments (if any)
      loadComments(artist);
    })
    .catch(error => {
      console.error('[AudioPlayer] Error loading audio files:', error);
      
      // Use placeholder data on error
      const data = generatePlaceholderData();
      organizeTracks(data);
      renderPlaylist(state.currentPlaylist);
    });
}

// Generate placeholder data if API returns empty or fails
function generatePlaceholderData() {
  return {
    files: [
      { id: 1, title: 'Twilight Horizon', artist: 'AMF Studio', duration: '3:42', url: '/audio/track1.mp3', playlist: 'showcase' },
      { id: 2, title: 'Neon Dreams', artist: 'AMF Studio', duration: '4:15', url: '/audio/track2.mp3', playlist: 'showcase' },
      { id: 3, title: 'Midnight Echo', artist: 'AMF Studio', duration: '3:28', url: '/audio/track3.mp3', playlist: 'showcase' },
      { id: 4, title: 'Electric Soul', artist: 'AMF Studio', duration: '5:10', url: '/audio/track4.mp3', playlist: 'showcase' },
      { id: 5, title: 'Summer Nights', artist: 'AMF Studio', duration: '3:55', url: '/audio/track5.mp3', playlist: 'archive' },
      { id: 6, title: 'Urban Flow', artist: 'AMF Studio', duration: '4:22', url: '/audio/track6.mp3', playlist: 'archive' },
      { id: 7, title: 'Crystal Clear', artist: 'AMF Studio', duration: '3:18', url: '/audio/track7.mp3', playlist: 'singles' },
      { id: 8, title: 'Future Waves', artist: 'AMF Studio', duration: '4:02', url: '/audio/track8.mp3', playlist: 'singles' }
    ]
  };
}

// Organize tracks into playlists
function organizeTracks(data) {
  // Reset playlists
  Object.keys(state.playlists).forEach(key => {
    state.playlists[key].tracks = [];
  });
  
  // Sort tracks into playlists
  data.files.forEach(track => {
    const playlist = track.playlist || 'showcase';
    if (state.playlists[playlist]) {
      state.playlists[playlist].tracks.push(track);
    } else {
      state.playlists.showcase.tracks.push(track);
    }
  });
  
  console.log('[AudioPlayer] Tracks organized into playlists:', state.playlists);
}

// Render tracks for the current playlist
function renderPlaylist(playlistKey) {
  console.log(`[AudioPlayer] Rendering playlist: ${playlistKey}`);
  
  const playlist = state.playlists[playlistKey];
  if (!playlist) {
    console.error(`[AudioPlayer] Playlist not found: ${playlistKey}`);
    return;
  }
  
  // Update playlist dropdown display
  document.querySelector('.playlist-selected span').textContent = playlist.name;
  
  // Update active playlist in dropdown
  document.querySelectorAll('.playlist-item').forEach(item => {
    item.classList.toggle('active', item.dataset.playlist === playlistKey);
  });
  
  // Render grid view
  renderGridView(playlist.tracks);
  
  // Render circle view
  renderCircleView(playlist.tracks);
  
  // Update state
  state.currentPlaylist = playlistKey;
}

// Render tracks in grid view
function renderGridView(tracks) {
  const gridView = document.querySelector('.grid-view');
  
  if (!tracks || tracks.length === 0) {
    gridView.innerHTML = '<div class="empty-message">No tracks in this playlist</div>';
    return;
  }
  
  // Clear grid
  gridView.innerHTML = '';
  
  // Create track cards
  tracks.forEach(track => {
    const trackCard = document.createElement('div');
    trackCard.className = 'track-card';
    trackCard.dataset.id = track.id;
    
    const trackInfo = document.createElement('div');
    trackInfo.className = 'track-info';
    
    const trackTitle = document.createElement('h3');
    trackTitle.className = 'track-title';
    trackTitle.textContent = track.title;
    
    const trackArtist = document.createElement('p');
    trackArtist.className = 'track-artist';
    trackArtist.textContent = `${track.artist} · ${track.duration}`;
    
    const playerControls = document.createElement('div');
    playerControls.className = 'player-controls';
    
    const playButton = document.createElement('button');
    playButton.className = 'play-button';
    playButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
    `;
    
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    
    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'time-display';
    timeDisplay.textContent = '0:00';
    
    const commentButton = document.createElement('button');
    commentButton.className = 'comment-button';
    commentButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    `;
    
    // Assemble controls
    progressBar.appendChild(progressFill);
    progressContainer.appendChild(progressBar);
    
    playerControls.appendChild(playButton);
    playerControls.appendChild(progressContainer);
    playerControls.appendChild(timeDisplay);
    playerControls.appendChild(commentButton);
    
    // Assemble track card
    trackInfo.appendChild(trackTitle);
    trackInfo.appendChild(trackArtist);
    trackInfo.appendChild(playerControls);
    
    trackCard.appendChild(trackInfo);
    gridView.appendChild(trackCard);
  });
}

// Render tracks in circle view
function renderCircleView(tracks) {
  const circleView = document.querySelector('.circle-view');
  
  if (!tracks || tracks.length === 0) {
    circleView.innerHTML = '<div class="empty-message">No tracks in this playlist</div>';
    return;
  }
  
  // Clear circle view
  circleView.innerHTML = '';
  
  // Create circle container
  const circleContainer = document.createElement('div');
  circleContainer.className = 'circle-container';
  
  // Create center player
  const centerPlayer = document.createElement('div');
  centerPlayer.className = 'center-player';
  centerPlayer.innerHTML = `
    <h3 class="center-track-title">Select a track</h3>
    <p class="center-track-artist">&nbsp;</p>
    <button class="center-play-button">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
    </button>
    <div class="center-controls">
      <button class="center-comment-button">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>
    </div>
  `;
  
  circleContainer.appendChild(centerPlayer);
  
  // Create track circles arranged in a circle
  tracks.forEach((track, index) => {
    // Calculate position on circle
    const angle = (2 * Math.PI * index) / tracks.length;
    const radius = 180; // Radius of the circle
    const centerX = 230; // Center X position
    const centerY = 230; // Center Y position
    
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    
    // Create track circle
    const trackCircle = document.createElement('div');
    trackCircle.className = 'circle-track';
    trackCircle.dataset.id = track.id;
    trackCircle.dataset.index = index;
    trackCircle.style.left = `${x - 35}px`; // 35 is half the width of circle-track
    trackCircle.style.top = `${y - 35}px`; // 35 is half the height of circle-track
    
    const trackNumber = document.createElement('span');
    trackNumber.textContent = index + 1;
    
    trackCircle.appendChild(trackNumber);
    circleContainer.appendChild(trackCircle);
  });
  
  circleView.appendChild(circleContainer);
}

// Load comments from API or local storage
function loadComments(artist) {
  console.log(`[AudioPlayer] Loading comments for artist: ${artist}`);
  
  // Try to load from API first
  fetch(`/api/${artist}/track-comments`)
    .then(response => {
      if (!response.ok) throw new Error('Failed to load comments');
      return response.json();
    })
    .then(data => {
      console.log('[AudioPlayer] Comments loaded:', data);
      
      if (data.comments && data.comments.length > 0) {
        state.comments = data.comments;
      } else {
        // If no comments from API, try local storage
        const storedComments = localStorage.getItem(`amf-comments-${artist}`);
        if (storedComments) {
          state.comments = JSON.parse(storedComments);
        } else {
          // Use empty array if nothing found
          state.comments = [];
        }
      }
      
      // Render comments if there's a current track
      if (state.currentTrack) {
        renderComments(state.currentTrack.id);
      }
    })
    .catch(error => {
      console.error('[AudioPlayer] Error loading comments:', error);
      
      // Try local storage as fallback
      const storedComments = localStorage.getItem(`amf-comments-${artist}`);
      if (storedComments) {
        state.comments = JSON.parse(storedComments);
      } else {
        state.comments = [];
      }
    });
}

// Save comments to API or local storage
function saveComments(artist) {
  console.log(`[AudioPlayer] Saving comments for artist: ${artist}`);
  
  // Try to save to API
  fetch(`/api/${artist}/track-comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ comments: state.comments })
  })
    .then(response => {
      if (!response.ok) throw new Error('Failed to save comments');
      console.log('[AudioPlayer] Comments saved to API');
    })
    .catch(error => {
      console.error('[AudioPlayer] Error saving comments to API:', error);
      
      // Save to local storage as fallback
      localStorage.setItem(`amf-comments-${artist}`, JSON.stringify(state.comments));
      console.log('[AudioPlayer] Comments saved to local storage');
    });
}

// Render comments for a specific track
function renderComments(trackId) {
  console.log(`[AudioPlayer] Rendering comments for track: ${trackId}`);
  
  const commentList = document.querySelector('.comment-list');
  
  // Filter comments for this track
  const trackComments = state.comments.filter(comment => comment.trackId === trackId);
  
  if (trackComments.length === 0) {
    commentList.innerHTML = '<div class="empty-comments">No comments for this track yet</div>';
    return;
  }
  
  // Clear list
  commentList.innerHTML = '';
  
  // Sort comments by timestamp (if any) or by date
  trackComments.sort((a, b) => {
    if (a.timestamp && b.timestamp) {
      return a.timestamp - b.timestamp;
    } else if (a.timestamp) {
      return -1;
    } else if (b.timestamp) {
      return 1;
    } else {
      return new Date(a.date) - new Date(b.date);
    }
  });
  
  // Render each comment
  trackComments.forEach(comment => {
    const commentItem = document.createElement('div');
    commentItem.className = 'comment-item';
    commentItem.dataset.id = comment.id;
    
    const commentAvatar = document.createElement('div');
    commentAvatar.className = 'comment-avatar';
    commentAvatar.innerHTML = `<span>${comment.author ? comment.author.charAt(0) : 'U'}</span>`;
    
    const commentContent = document.createElement('div');
    commentContent.className = 'comment-content';
    
    const commentHeader = document.createElement('div');
    commentHeader.className = 'comment-header';
    
    const commentAuthor = document.createElement('span');
    commentAuthor.className = 'comment-author';
    commentAuthor.textContent = comment.author || 'User';
    
    const commentTime = document.createElement('span');
    commentTime.className = 'comment-time';
    commentTime.textContent = formatDate(comment.date);
    
    commentHeader.appendChild(commentAuthor);
    commentHeader.appendChild(commentTime);
    
    const commentText = document.createElement('p');
    commentText.className = 'comment-text';
    
    // If comment has a timestamp, add it before the text
    if (comment.timestamp) {
      const commentTimestamp = document.createElement('span');
      commentTimestamp.className = 'comment-timestamp';
      commentTimestamp.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        ${formatTime(comment.timestamp)}
      `;
      commentTimestamp.dataset.time = comment.timestamp;
      commentText.appendChild(commentTimestamp);
    }
    
    // Add comment text node
    commentText.appendChild(document.createTextNode(comment.text));
    
    // Comment actions
    const commentActions = document.createElement('div');
    commentActions.className = 'comment-actions';
    
    const editButton = document.createElement('button');
    editButton.className = 'comment-edit';
    editButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
      </svg>
    `;
    
    const deleteButton = document.createElement('button');
    deleteButton.className = 'comment-delete';
    deleteButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    `;
    
    commentActions.appendChild(editButton);
    commentActions.appendChild(deleteButton);
    
    // Assemble comment item
    commentContent.appendChild(commentHeader);
    commentContent.appendChild(commentText);
    commentContent.appendChild(commentActions);
    
    commentItem.appendChild(commentAvatar);
    commentItem.appendChild(commentContent);
    
    commentList.appendChild(commentItem);
  });
}

// Add a new comment
function addComment(text, timestamp = null) {
  if (!state.currentTrack) return;
  if (!text.trim()) return;
  
  const trackId = state.currentTrack.id;
  
  const comment = {
    id: Date.now(), // Use timestamp as unique ID
    trackId: trackId,
    author: 'User', // Would come from logged-in user
    date: new Date().toISOString(),
    text: text.trim(),
    timestamp: timestamp
  };
  
  // Add to state
  state.comments.push(comment);
  
  // Update UI
  renderComments(trackId);
  
  // Clear input
  document.querySelector('.comment-input').value = '';
  
  // Save to storage
  const artist = getArtistFromUrl();
  saveComments(artist);
  
  console.log('[AudioPlayer] Comment added:', comment);
}

// Edit an existing comment
function editComment(commentId, newText, newTimestamp) {
  const index = state.comments.findIndex(comment => comment.id === commentId);
  
  if (index !== -1) {
    state.comments[index].text = newText.trim();
    
    if (newTimestamp !== undefined) {
      state.comments[index].timestamp = newTimestamp;
    }
    
    // Update UI
    renderComments(state.currentTrack.id);
    
    // Save to storage
    const artist = getArtistFromUrl();
    saveComments(artist);
    
    console.log('[AudioPlayer] Comment edited:', state.comments[index]);
  }
}

// Delete a comment
function deleteComment(commentId) {
  const index = state.comments.findIndex(comment => comment.id === commentId);
  
  if (index !== -1) {
    state.comments.splice(index, 1);
    
    // Update UI
    renderComments(state.currentTrack.id);
    
    // Save to storage
    const artist = getArtistFromUrl();
    saveComments(artist);
    
    console.log('[AudioPlayer] Comment deleted:', commentId);
  }
}

// Play a track
function playTrack(track) {
  console.log('[AudioPlayer] Playing track:', track);
  
  // Stop current track if playing
  if (state.isPlaying) {
    state.audioElement.pause();
  }
  
  // Update current track
  state.currentTrack = track;
  
  // Set audio source
  state.audioElement.src = track.url;
  
  // Play audio
  state.audioElement.play()
    .then(() => {
      state.isPlaying = true;
      updatePlaybackUI();
      
      // Render comments for this track
      renderComments(track.id);
    })
    .catch(error => {
      console.error('[AudioPlayer] Error playing track:', error);
      
      // Show error message
      alert('Error playing track. Audio file may be missing or unsupported.');
      
      // Reset state
      state.isPlaying = false;
      updatePlaybackUI();
    });
}

// Pause the current track
function pauseTrack() {
  if (!state.currentTrack || !state.isPlaying) return;
  
  state.audioElement.pause();
  state.isPlaying = false;
  updatePlaybackUI();
  
  console.log('[AudioPlayer] Paused track:', state.currentTrack);
}

// Resume playing the current track
function resumeTrack() {
  if (!state.currentTrack || state.isPlaying) return;
  
  state.audioElement.play()
    .then(() => {
      state.isPlaying = true;
      updatePlaybackUI();
    })
    .catch(error => {
      console.error('[AudioPlayer] Error resuming track:', error);
    });
  
  console.log('[AudioPlayer] Resumed track:', state.currentTrack);
}

// Toggle play/pause
function togglePlayback() {
  if (state.isPlaying) {
    pauseTrack();
  } else {
    resumeTrack();
  }
}

// Update UI based on playback state
function updatePlaybackUI() {
  if (!state.currentTrack) return;
  
  const trackId = state.currentTrack.id;
  
  // Grid view updates
  const gridCards = document.querySelectorAll('.track-card');
  gridCards.forEach(card => {
    const isCurrentTrack = card.dataset.id == trackId;
    const playButton = card.querySelector('.play-button');
    
    if (isCurrentTrack) {
      card.classList.add('playing');
      
      // Update play button icon
      if (state.isPlaying) {
        playButton.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        `;
    } else {
      // Reset non-current tracks
      card.classList.remove('playing');
      playButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      `;
    }
    
    // Update progress bar if this is the current track
    if (isCurrentTrack) {
      const progressFill = card.querySelector('.progress-fill');
      const timeDisplay = card.querySelector('.time-display');
      
      // Update progress bar with current time
      if (state.audioElement.duration) {
        const percent = (state.audioElement.currentTime / state.audioElement.duration) * 100;
        progressFill.style.width = `${percent}%`;
        
        // Update time display
        timeDisplay.textContent = formatTime(state.audioElement.currentTime);
      }
    }
  });
  
  // Circle view updates
  const circleView = document.querySelector('.circle-view');
  if (!circleView) return;
  
  // Update center player
  const centerPlayer = circleView.querySelector('.center-player');
  if (centerPlayer) {
    // Update track info
    const trackTitle = centerPlayer.querySelector('.center-track-title');
    const trackArtist = centerPlayer.querySelector('.center-track-artist');
    const playButton = centerPlayer.querySelector('.center-play-button');
    
    trackTitle.textContent = state.currentTrack.title;
    trackArtist.textContent = state.currentTrack.artist;
    
    // Update play button
    if (state.isPlaying) {
      playButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="6" y="4" width="4" height="16"></rect>
          <rect x="14" y="4" width="4" height="16"></rect>
        </svg>
      `;
    } else {
      playButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      `;
    }
  }
  
  // Update circle tracks
  const circleTracks = circleView.querySelectorAll('.circle-track');
  circleTracks.forEach(track => {
    const isCurrentTrack = track.dataset.id == trackId;
    
    if (isCurrentTrack) {
      track.classList.add('active');
    } else {
      track.classList.remove('active');
    }
  });
}

// Format time in seconds to MM:SS format
function formatTime(time) {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

// Format date to readable format
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Get artist from URL
function getArtistFromUrl() {
  const pathParts = window.location.pathname.split('/');
  const artistIndex = pathParts.indexOf('dashboard') - 1;
  return pathParts[artistIndex] || 'default-artist';
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
  console.log('[AudioPlayer] Setting up keyboard shortcuts');
  
  document.addEventListener('keydown', function(event) {
    // Only process if we have a current track
    if (!state.currentTrack) return;
    
    // Handle 'Space' for play/pause
    if (event.code === 'Space' && !isInputFocused()) {
      event.preventDefault();
      togglePlayback();
    }
    
    // Handle 'C' for adding timestamped comment
    if (event.code === 'KeyC' && state.isPlaying && !isInputFocused()) {
      addTimestampedComment();
    }
    
    // Handle 'ArrowLeft' for seeking backward
    if (event.code === 'ArrowLeft' && !isInputFocused()) {
      seekRelative(-5); // 5 seconds back
    }
    
    // Handle 'ArrowRight' for seeking forward
    if (event.code === 'ArrowRight' && !isInputFocused()) {
      seekRelative(5); // 5 seconds forward
    }
  });
}

// Check if an input element is currently focused
function isInputFocused() {
  const activeElement = document.activeElement;
  const inputTags = ['INPUT', 'TEXTAREA', 'SELECT'];
  
  return inputTags.includes(activeElement.tagName) || 
         activeElement.isContentEditable;
}

// Seek relative to current position
function seekRelative(seconds) {
  if (!state.audioElement || !state.currentTrack) return;
  
  const newTime = Math.max(0, Math.min(state.audioElement.duration, state.audioElement.currentTime + seconds));
  state.audioElement.currentTime = newTime;
  
  console.log(`[AudioPlayer] Seeking to ${formatTime(newTime)}`);
}

// Add a comment with the current timestamp
function addTimestampedComment() {
  if (!state.audioElement || !state.currentTrack) return;
  
  // Get current timestamp
  const timestamp = state.audioElement.currentTime;
  
  // Focus the comment input
  const commentInput = document.querySelector('.comment-input');
  commentInput.focus();
  
  // Store timestamp in a data attribute
  commentInput.dataset.timestamp = timestamp;
  
  // Add timestamp placeholder at the beginning
  const formattedTime = formatTime(timestamp);
  commentInput.placeholder = `Comment at ${formattedTime}...`;
  
  console.log(`[AudioPlayer] Adding timestamped comment at ${formattedTime}`);
}

// Show comment dialog for a specific track
function showCommentDialog(trackId) {
  // Find track from ID
  let track = null;
  
  Object.values(state.playlists).forEach(playlist => {
    const found = playlist.tracks.find(t => t.id == trackId);
    if (found) track = found;
  });
  
  if (!track) return;
  
  // Create dialog DOM
  const dialogOverlay = document.createElement('div');
  dialogOverlay.className = 'dialog-overlay';
  
  const dialog = document.createElement('div');
  dialog.className = 'dialog';
  
  const dialogHeader = document.createElement('div');
  dialogHeader.className = 'dialog-header';
  
  const dialogTitle = document.createElement('h3');
  dialogTitle.className = 'dialog-title';
  dialogTitle.textContent = `Comments - ${track.title}`;
  
  const closeButton = document.createElement('button');
  closeButton.className = 'dialog-close';
  closeButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;
  
  // Dialog content
  const dialogBody = document.createElement('div');
  dialogBody.className = 'dialog-body';
  
  // Filter comments for this track
  const trackComments = state.comments.filter(comment => comment.trackId == trackId);
  
  if (trackComments.length === 0) {
    dialogBody.innerHTML = '<p>No comments for this track yet.</p>';
  } else {
    // Render comments
    const commentsList = document.createElement('div');
    commentsList.className = 'dialog-comments-list';
    
    trackComments.forEach(comment => {
      const commentItem = document.createElement('div');
      commentItem.className = 'dialog-comment-item';
      
      // Comment content here (similar to renderComments function)
      
      commentsList.appendChild(commentItem);
    });
    
    dialogBody.appendChild(commentsList);
  }
  
  // Comment form
  const commentForm = document.createElement('div');
  commentForm.className = 'dialog-comment-form';
  commentForm.innerHTML = `
    <div class="dialog-form-group">
      <label class="dialog-label">Add a comment</label>
      <textarea class="dialog-textarea" placeholder="Type your comment here..."></textarea>
    </div>
    <div class="dialog-actions">
      <button class="dialog-button dialog-button-secondary">Cancel</button>
      <button class="dialog-button dialog-button-primary">Add Comment</button>
    </div>
  `;
  
  // Assemble dialog
  dialogHeader.appendChild(dialogTitle);
  dialogHeader.appendChild(closeButton);
  
  dialog.appendChild(dialogHeader);
  dialog.appendChild(dialogBody);
  dialog.appendChild(commentForm);
  
  dialogOverlay.appendChild(dialog);
  
  // Add to page
  document.body.appendChild(dialogOverlay);
  
  // Add event listeners
  closeButton.addEventListener('click', () => {
    dialogOverlay.remove();
  });
  
  // Show dialog with animation
  setTimeout(() => {
    dialogOverlay.classList.add('open');
  }, 10);
}

// Attach all event listeners
function attachEventListeners() {
  console.log('[AudioPlayer] Attaching event listeners');
  
  // Playlist selector toggle
  const playlistSelected = document.querySelector('.playlist-selected');
  const playlistDropdown = document.querySelector('.playlist-dropdown');
  
  playlistSelected.addEventListener('click', () => {
    playlistSelected.classList.toggle('open');
    playlistDropdown.classList.toggle('open');
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', event => {
    if (!event.target.closest('.playlist-selector')) {
      playlistSelected.classList.remove('open');
      playlistDropdown.classList.remove('open');
    }
  });
  
  // Playlist item selection
  document.querySelectorAll('.playlist-item').forEach(item => {
    item.addEventListener('click', () => {
      const playlist = item.dataset.playlist;
      if (playlist) {
        renderPlaylist(playlist);
        playlistSelected.classList.remove('open');
        playlistDropdown.classList.remove('open');
      }
    });
  });
  
  // View toggle
  const viewButtons = document.querySelectorAll('.view-toggle button');
  const gridView = document.querySelector('.grid-view');
  const circleView = document.querySelector('.circle-view');
  
  viewButtons.forEach(button => {
    button.addEventListener('click', () => {
      const view = button.dataset.view;
      
      // Update active button
      viewButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Show/hide views
      if (view === 'grid') {
        gridView.classList.remove('hidden');
        circleView.classList.add('hidden');
        state.currentView = 'grid';
      } else if (view === 'circle') {
        gridView.classList.add('hidden');
        circleView.classList.remove('hidden');
        state.currentView = 'circle';
      }
    });
  });
  
  // Audio playback and progress
  state.audioElement.addEventListener('timeupdate', () => {
    // Update progress for current track
    if (state.currentTrack) {
      updatePlaybackUI();
    }
  });
  
  state.audioElement.addEventListener('ended', () => {
    // Reset playback state
    state.isPlaying = false;
    updatePlaybackUI();
    
    console.log('[AudioPlayer] Track ended:', state.currentTrack);
  });
  
  // Click handlers for track cards in grid view
  document.addEventListener('click', event => {
    // Play button click
    const playButton = event.target.closest('.play-button');
    if (playButton) {
      const trackCard = playButton.closest('.track-card');
      if (trackCard) {
        const trackId = trackCard.dataset.id;
        
        // Find track data
        const track = findTrackById(trackId);
        if (track) {
          if (state.currentTrack && state.currentTrack.id == trackId) {
            // Toggle playback for current track
            togglePlayback();
          } else {
            // Play new track
            playTrack(track);
          }
        }
      }
      return;
    }
    
    // Progress bar click
    const progressBar = event.target.closest('.progress-bar');
    if (progressBar && state.currentTrack) {
      const trackCard = progressBar.closest('.track-card');
      if (trackCard && trackCard.dataset.id == state.currentTrack.id) {
        // Calculate position
        const rect = progressBar.getBoundingClientRect();
        const pos = (event.clientX - rect.left) / rect.width;
        
        // Set current time
        if (state.audioElement.duration) {
          state.audioElement.currentTime = pos * state.audioElement.duration;
        }
      }
      return;
    }
    
    // Comment button click
    const commentButton = event.target.closest('.comment-button');
    if (commentButton) {
      const trackCard = commentButton.closest('.track-card');
      if (trackCard) {
        // Focus comment input
        document.querySelector('.comment-input').focus();
      }
      return;
    }
    
    // Circle track click
    const circleTrack = event.target.closest('.circle-track');
    if (circleTrack) {
      const trackId = circleTrack.dataset.id;
      
      // Find track data
      const track = findTrackById(trackId);
      if (track) {
        if (state.currentTrack && state.currentTrack.id == trackId) {
          // Update center play button to show current track
          updateCircleCenter(track);
        } else {
          // Play new track
          playTrack(track);
        }
      }
      return;
    }
    
    // Center play button click
    const centerPlayButton = event.target.closest('.center-play-button');
    if (centerPlayButton && state.currentTrack) {
      // Toggle playback
      togglePlayback();
      return;
    }
    
    // Comment timestamp click
    const commentTimestamp = event.target.closest('.comment-timestamp');
    if (commentTimestamp && state.currentTrack) {
      // Seek to timestamp
      const timestamp = parseFloat(commentTimestamp.dataset.time);
      if (!isNaN(timestamp)) {
        state.audioElement.currentTime = timestamp;
      }
      return;
    }
    
    // Comment edit button
    const editButton = event.target.closest('.comment-edit');
    if (editButton) {
      const commentItem = editButton.closest('.comment-item');
      if (commentItem) {
        const commentId = parseInt(commentItem.dataset.id);
        showEditCommentDialog(commentId);
      }
      return;
    }
    
    // Comment delete button
    const deleteButton = event.target.closest('.comment-delete');
    if (deleteButton) {
      const commentItem = deleteButton.closest('.comment-item');
      if (commentItem) {
        const commentId = parseInt(commentItem.dataset.id);
        if (confirm('Are you sure you want to delete this comment?')) {
          deleteComment(commentId);
        }
      }
      return;
    }
  });
  
  // Comment form submission
  const submitButton = document.querySelector('.submit-comment');
  const commentInput = document.querySelector('.comment-input');
  
  submitButton.addEventListener('click', () => {
    const text = commentInput.value;
    const timestamp = commentInput.dataset.timestamp ? parseFloat(commentInput.dataset.timestamp) : null;
    
    if (text.trim()) {
      addComment(text, timestamp);
      
      // Reset timestamp
      delete commentInput.dataset.timestamp;
      commentInput.placeholder = 'Add a comment... (Press \'C\' while playing to timestamp)';
    }
  });
  
  // Timestamp button click
  const timestampButton = document.querySelector('.timestamp-button');
  timestampButton.addEventListener('click', () => {
    if (state.currentTrack && state.audioElement) {
      commentInput.dataset.timestamp = state.audioElement.currentTime;
      commentInput.placeholder = `Comment at ${formatTime(state.audioElement.currentTime)}...`;
      commentInput.focus();
    }
  });
  
  // Enter key in comment input
  commentInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitButton.click();
    }
  });
}

// Find track by ID across all playlists
function findTrackById(trackId) {
  let foundTrack = null;
  
  Object.values(state.playlists).forEach(playlist => {
    const track = playlist.tracks.find(t => t.id == trackId);
    if (track) foundTrack = track;
  });
  
  return foundTrack;
}

// Update the center display in circle view
function updateCircleCenter(track) {
  const centerPlayer = document.querySelector('.center-player');
  if (!centerPlayer) return;
  
  const trackTitle = centerPlayer.querySelector('.center-track-title');
  const trackArtist = centerPlayer.querySelector('.center-track-artist');
  
  trackTitle.textContent = track.title;
  trackArtist.textContent = track.artist;
}

// Show edit comment dialog
function showEditCommentDialog(commentId) {
  const comment = state.comments.find(c => c.id === commentId);
  if (!comment) return;
  
  // Create dialog DOM
  const dialogOverlay = document.createElement('div');
  dialogOverlay.className = 'dialog-overlay';
  
  const dialog = document.createElement('div');
  dialog.className = 'dialog';
  
  dialog.innerHTML = `
    <div class="dialog-header">
      <h3 class="dialog-title">Edit Comment</h3>
      <button class="dialog-close">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="dialog-body">
      <div class="dialog-form-group">
        <label class="dialog-label">Comment text</label>
        <textarea class="dialog-textarea">${comment.text}</textarea>
      </div>
      ${comment.timestamp ? `
      <div class="dialog-form-group">
        <label class="dialog-label">Timestamp (${formatTime(comment.timestamp)})</label>
        <input type="checkbox" id="edit-timestamp-checkbox" checked>
        <label for="edit-timestamp-checkbox">Include timestamp</label>
      </div>
      ` : ''}
    </div>
    <div class="dialog-actions">
      <button class="dialog-button dialog-button-secondary dialog-cancel">Cancel</button>
      <button class="dialog-button dialog-button-primary dialog-save">Save</button>
    </div>
  `;
  
  // Add to page
  dialogOverlay.appendChild(dialog);
  document.body.appendChild(dialogOverlay);
  
  // Show dialog with animation
  setTimeout(() => {
    dialogOverlay.classList.add('open');
  }, 10);
  
  // Add event listeners
  const closeButton = dialog.querySelector('.dialog-close');
  const cancelButton = dialog.querySelector('.dialog-cancel');
  const saveButton = dialog.querySelector('.dialog-save');
  const textarea = dialog.querySelector('.dialog-textarea');
  
  closeButton.addEventListener('click', () => {
    dialogOverlay.remove();
  });
  
  cancelButton.addEventListener('click', () => {
    dialogOverlay.remove();
  });
  
  saveButton.addEventListener('click', () => {
    const newText = textarea.value;
    let newTimestamp = comment.timestamp;
    
    // Check if timestamp checkbox exists and is checked
    const timestampCheckbox = dialog.querySelector('#edit-timestamp-checkbox');
    if (timestampCheckbox && !timestampCheckbox.checked) {
      newTimestamp = null;
    }
    
    editComment(commentId, newText, newTimestamp);
    dialogOverlay.remove();
  });
}

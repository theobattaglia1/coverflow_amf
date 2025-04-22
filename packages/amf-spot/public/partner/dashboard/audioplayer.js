// Audio Player Implementation
console.log('[AudioPlayer] Script started');

document.addEventListener('DOMContentLoaded', function() {
  console.log('[AudioPlayer] DOM loaded');
  
  // Get artist ID from URL
  const pathParts = window.location.pathname.split('/');
  const artistIndex = pathParts.indexOf('dashboard') - 1;
  const artist = pathParts[artistIndex] || 'default-artist';
  console.log('[AudioPlayer] Artist name:', artist);
  
  // Create audio player section
  createAudioPlayerSection();
  
  // Fetch audio files
  fetchAudioFiles(artist);
  
  console.log('[AudioPlayer] Initialization complete');
});

function createAudioPlayerSection() {
  console.log('[AudioPlayer] Creating audio player section');
  
  // Find the audio section - either use existing one or create new
  let audioSection = document.querySelector('.audio');
  
  if (!audioSection) {
    console.log('[AudioPlayer] Audio section not found, creating new one');
    audioSection = document.createElement('div');
    audioSection.className = 'audio';
    
    // Find an insertion point - after coverflow or before the first section
    const coverflowHero = document.getElementById('coverflow-hero');
    const firstSection = document.querySelector('section, .dashboard section, .comments, .tasks');
    
    if (coverflowHero && coverflowHero.nextElementSibling) {
      coverflowHero.parentNode.insertBefore(audioSection, coverflowHero.nextElementSibling);
      console.log('[AudioPlayer] Inserted after coverflow hero');
    } else if (firstSection && firstSection.parentNode) {
      firstSection.parentNode.insertBefore(audioSection, firstSection);
      console.log('[AudioPlayer] Inserted before first section');
    } else {
      document.body.appendChild(audioSection);
      console.log('[AudioPlayer] Appended to body as fallback');
    }
  } else {
    console.log('[AudioPlayer] Found existing audio section');
    // Clear existing content
    audioSection.innerHTML = '';
  }
  
  // Create audio player container
  const container = document.createElement('div');
  container.className = 'audio-player-container';
  
  // Create header with title and view toggles
  const header = document.createElement('div');
  header.className = 'audio-player-header';
  
  const title = document.createElement('h2');
  title.className = 'audio-player-title';
  title.textContent = 'Audio';
  
  const viewControls = document.createElement('div');
  viewControls.className = 'audio-view-controls';
  
  const gridToggle = document.createElement('button');
  gridToggle.className = 'view-toggle active';
  gridToggle.dataset.view = 'grid';
  gridToggle.textContent = 'Grid';
  
  const circleToggle = document.createElement('button');
  circleToggle.className = 'view-toggle';
  circleToggle.dataset.view = 'circle';
  circleToggle.textContent = 'Circle';
  
  viewControls.appendChild(gridToggle);
  viewControls.appendChild(circleToggle);
  
  header.appendChild(title);
  header.appendChild(viewControls);
  
  // Create grid container
  const grid = document.createElement('div');
  grid.className = 'audio-player-grid';
  
  // Create circle view container
  const circle = document.createElement('div');
  circle.className = 'audio-player-circle';
  
  // Loading message
  const loading = document.createElement('p');
  loading.className = 'audio-loading';
  loading.textContent = 'Loading audio tracks...';
  grid.appendChild(loading);
  
  // Append everything to the container
  container.appendChild(header);
  container.appendChild(grid);
  container.appendChild(circle);
  
  // Add to the audio section
  audioSection.appendChild(container);
  
  // Add event listeners for view toggles
  gridToggle.addEventListener('click', () => switchView('grid'));
  circleToggle.addEventListener('click', () => switchView('circle'));
  
  console.log('[AudioPlayer] Audio player section created');
}

function fetchAudioFiles(artist) {
  console.log(`[AudioPlayer] Fetching audio files for artist: ${artist}`);
  
  fetch(`/api/${artist}/audio-files`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      console.log('[AudioPlayer] Audio data received:', data);
      
      // If no audio files or empty response, use placeholder data
      const audioFiles = data.files && data.files.length > 0 ? data.files : [
        { id: 1, title: 'Demo Track 1', url: '/audio/track1.mp3', duration: '3:45', artist: 'Artist Name' },
        { id: 2, title: 'Demo Track 2', url: '/audio/track2.mp3', duration: '2:58', artist: 'Artist Name' },
        { id: 3, title: 'Demo Track 3', url: '/audio/track3.mp3', duration: '4:12', artist: 'Artist Name' },
        { id: 4, title: 'Demo Track 4', url: '/audio/track4.mp3', duration: '3:24', artist: 'Artist Name' }
      ];
      
      renderAudioTracks(audioFiles);
    })
    .catch(error => {
      console.error('[AudioPlayer] Error fetching audio files:', error);
      
      // Use placeholder data on error
      const placeholderFiles = [
        { id: 1, title: 'Demo Track 1', url: '/audio/track1.mp3', duration: '3:45', artist: 'Artist Name' },
        { id: 2, title: 'Demo Track 2', url: '/audio/track2.mp3', duration: '2:58', artist: 'Artist Name' },
        { id: 3, title: 'Demo Track 3', url: '/audio/track3.mp3', duration: '4:12', artist: 'Artist Name' },
        { id: 4, title: 'Demo Track 4', url: '/audio/track4.mp3', duration: '3:24', artist: 'Artist Name' }
      ];
      
      renderAudioTracks(placeholderFiles);
    });
}

function renderAudioTracks(tracks) {
  console.log('[AudioPlayer] Rendering audio tracks:', tracks.length);
  
  const grid = document.querySelector('.audio-player-grid');
  const circle = document.querySelector('.audio-player-circle');
  
  // Clear loading message and existing content
  grid.innerHTML = '';
  circle.innerHTML = '';
  
  // Create tracks for grid view
  tracks.forEach(track => {
    // Create track card for grid view
    const trackCard = document.createElement('div');
    trackCard.className = 'audio-track';
    trackCard.dataset.id = track.id;
    
    const trackInfo = document.createElement('div');
    trackInfo.className = 'audio-track-info';
    
    const trackTitle = document.createElement('h3');
    trackTitle.className = 'audio-track-title';
    trackTitle.textContent = track.title;
    
    const trackMeta = document.createElement('p');
    trackMeta.className = 'audio-track-meta';
    trackMeta.textContent = track.duration + ' · ' + (track.artist || 'Unknown Artist');
    
    // Create audio player
    const audioPlayer = document.createElement('audio');
    audioPlayer.className = 'custom-audio-player';
    audioPlayer.src = track.url;
    audioPlayer.preload = 'metadata';
    
    // Create custom controls
    const controls = document.createElement('div');
    controls.className = 'audio-controls';
    
    const playButton = document.createElement('button');
    playButton.className = 'play-button';
    playButton.innerHTML = '▶';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    
    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'time-display';
    timeDisplay.textContent = '0:00';
    
    // Assemble controls
    progressBar.appendChild(progressFill);
    controls.appendChild(playButton);
    controls.appendChild(progressBar);
    controls.appendChild(timeDisplay);
    
    // Assemble track card
    trackInfo.appendChild(trackTitle);
    trackInfo.appendChild(trackMeta);
    trackInfo.appendChild(audioPlayer);
    trackInfo.appendChild(controls);
    trackCard.appendChild(trackInfo);
    
    // Add to grid
    grid.appendChild(trackCard);
    
    // Create circle view item
    const circleItem = document.createElement('div');
    circleItem.className = 'circle-track';
    circleItem.dataset.id = track.id;
    circleItem.dataset.title = track.title;
    circleItem.dataset.url = track.url;
    
    // Position circle items in a circle
    const angle = (2 * Math.PI * tracks.indexOf(track)) / tracks.length;
    const radius = 180; // Circle radius
    const centerX = 250;
    const centerY = 250;
    
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    
    circleItem.style.left = `${x - 40}px`; // 40 = half of the item width
    circleItem.style.top = `${y - 40}px`; // 40 = half of the item height
    
    // Add track number
    circleItem.textContent = tracks.indexOf(track) + 1;
    
    // Add to circle view
    circle.appendChild(circleItem);
    
    // Add event listeners
    setupAudioEventListeners(trackCard, audioPlayer, playButton, progressBar, progressFill, timeDisplay);
    
    // Add click event for circle items
    circleItem.addEventListener('click', function() {
      // Remove active class from all items
      document.querySelectorAll('.circle-track').forEach(item => {
        item.classList.remove('active');
      });
      
      // Add active class to clicked item
      this.classList.add('active');
      
      // Play the corresponding audio
      const audioId = this.dataset.id;
      const gridItem = document.querySelector(`.audio-track[data-id="${audioId}"]`);
      if (gridItem) {
        const audio = gridItem.querySelector('audio');
        const button = gridItem.querySelector('.play-button');
        if (audio && button) {
          if (audio.paused) {
            playAudio(audio, button);
          } else {
            pauseAudio(audio, button);
          }
        }
      }
    });
  });
  
  console.log('[AudioPlayer] Tracks rendered successfully');
}

function setupAudioEventListeners(trackCard, audio, playButton, progressBar, progressFill, timeDisplay) {
  // Play/pause button
  playButton.addEventListener('click', function() {
    if (audio.paused) {
      // Pause all other playing audio
      document.querySelectorAll('.custom-audio-player').forEach(player => {
        if (player !== audio && !player.paused) {
          player.pause();
          const btn = player.parentNode.querySelector('.play-button');
          if (btn) btn.innerHTML = '▶';
        }
      });
      
      playAudio(audio, playButton);
    } else {
      pauseAudio(audio, playButton);
    }
  });
  
  // Update progress as audio plays
  audio.addEventListener('timeupdate', function() {
    if (audio.duration) {
      const percent = (audio.currentTime / audio.duration) * 100;
      progressFill.style.width = `${percent}%`;
      
      // Update time display
      const currentMinutes = Math.floor(audio.currentTime / 60);
      const currentSeconds = Math.floor(audio.currentTime % 60).toString().padStart(2, '0');
      timeDisplay.textContent = `${currentMinutes}:${currentSeconds}`;
    }
  });
  
  // Click on progress bar to seek
  progressBar.addEventListener('click', function(e) {
    const rect = progressBar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pos * audio.duration;
  });
  
  // When audio ends
  audio.addEventListener('ended', function() {
    playButton.innerHTML = '▶';
    progressFill.style.width = '0%';
    timeDisplay.textContent = '0:00';
  });
}

function playAudio(audio, button) {
  audio.play();
  button.innerHTML = '❚❚';
}

function pauseAudio(audio, button) {
  audio.pause();
  button.innerHTML = '▶';
}

function switchView(viewType) {
  console.log(`[AudioPlayer] Switching to ${viewType} view`);
  
  const grid = document.querySelector('.audio-player-grid');
  const circle = document.querySelector('.audio-player-circle');
  const gridToggle = document.querySelector('.view-toggle[data-view="grid"]');
  const circleToggle = document.querySelector('.view-toggle[data-view="circle"]');
  
  // Update toggle buttons
  gridToggle.classList.remove('active');
  circleToggle.classList.remove('active');
  
  if (viewType === 'grid') {
    grid.style.display = 'grid';
    circle.style.display = 'none';
    gridToggle.classList.add('active');
  } else {
    grid.style.display = 'none';
    circle.style.display = 'block';
    circleToggle.classList.add('active');
  }
  
  console.log(`[AudioPlayer] View switched to ${viewType}`);
}

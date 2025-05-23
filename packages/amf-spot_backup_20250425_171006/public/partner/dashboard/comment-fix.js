// This file contains functions to fix and enhance the comment functionality
// You'll need to integrate these into your existing audioplayer.js file

// Function to render comments with proper formatting and collapse/expand functionality
function renderCommentsEnhanced(trackId) {
  console.log(`[AudioPlayer] Rendering comments for track: ${trackId}`);
  
  const commentList = document.querySelector('.comment-list');
  
  // Filter comments for this track
  const trackComments = state.comments.filter(comment => comment.trackId == trackId);
  
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
  
  // Create comment header with collapsible functionality
  const commentsHeader = document.createElement('div');
  commentsHeader.className = 'comments-list-header';
  commentsHeader.innerHTML = `
    <div class="comments-count">${trackComments.length} comment${trackComments.length !== 1 ? 's' : ''}</div>
    <button class="comments-collapse-toggle">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="18 15 12 9 6 15"></polyline>
      </svg>
    </button>
  `;
  
  commentList.appendChild(commentsHeader);
  
  // Create comments container
  const commentsContainer = document.createElement('div');
  commentsContainer.className = 'comments-container';
  
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
    if (comment.timestamp !== undefined && comment.timestamp !== null) {
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
      
      // Add click handler to seek to timestamp
      commentTimestamp.addEventListener('click', () => {
        if (state.audioElement && state.currentTrack && state.currentTrack.id == trackId) {
          state.audioElement.currentTime = comment.timestamp;
          if (!state.isPlaying) {
            state.audioElement.play()
              .then(() => {
                state.isPlaying = true;
                updatePlaybackUI();
              })
              .catch(error => {
                console.error('[AudioPlayer] Error playing track:', error);
              });
          }
        }
      });
      
      commentText.appendChild(commentTimestamp);
    }
    
    // Add comment text node
    commentText.appendChild(document.createTextNode(comment.text));
    
    // Comment actions
    const commentActions = document.createElement('div');
    commentActions.className = 'comment-actions';
    
    const editButton = document.createElement('button');
    editButton.className = 'comment-edit';
    editButton.title = 'Edit comment';
    editButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
      </svg>
    `;
    
    const deleteButton = document.createElement('button');
    deleteButton.className = 'comment-delete';
    deleteButton.title = 'Delete comment';
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
    
    commentsContainer.appendChild(commentItem);
  });
  
  commentList.appendChild(commentsContainer);
  
  // Add collapse/expand functionality
  const collapseToggle = commentList.querySelector('.comments-collapse-toggle');
  collapseToggle.addEventListener('click', () => {
    commentsContainer.classList.toggle('collapsed');
    collapseToggle.classList.toggle('collapsed');
    
    // Update icon
    if (commentsContainer.classList.contains('collapsed')) {
      collapseToggle.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      `;
    } else {
      collapseToggle.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      `;
    }
  });
}

// Enhanced function to add a new comment with keyboard shortcut support
function setupEnhancedCommentHandling() {
  const commentInput = document.querySelector('.comment-input');
  const submitButton = document.querySelector('.submit-comment');
  const timestampButton = document.querySelector('.timestamp-button');
  
  // Add Ctrl+Enter shortcut for submitting a comment
  commentInput.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      submitButton.click();
    }
  });
  
  // Improve timestamp button functionality
  timestampButton.addEventListener('click', () => {
    if (state.currentTrack && state.audioElement) {
      const currentTime = state.audioElement.currentTime;
      commentInput.dataset.timestamp = currentTime;
      
      // Update placeholder to show timestamp
      commentInput.placeholder = `Comment at ${formatTime(currentTime)}...`;
      
      // Focus the input
      commentInput.focus();
      
      // Add visual indicator
      timestampButton.classList.add('active');
      setTimeout(() => {
        timestampButton.classList.remove('active');
      }, 500);
    }
  });
  
  // Improve submit button functionality
  submitButton.addEventListener('click', () => {
    if (!state.currentTrack) {
      alert('Please select a track to comment on');
      return;
    }
    
    const text = commentInput.value;
    if (!text.trim()) {
      alert('Please enter a comment');
      return;
    }
    
    // Get timestamp if available
    const timestamp = commentInput.dataset.timestamp ? parseFloat(commentInput.dataset.timestamp) : null;
    
    // Add comment
    const comment = {
      id: Date.now(),
      trackId: state.currentTrack.id,
      author: 'User', // Would come from logged-in user
      date: new Date().toISOString(),
      text: text.trim(),
      timestamp: timestamp
    };
    
    // Add to state
    state.comments.push(comment);
    
    // Clear input
    commentInput.value = '';
    delete commentInput.dataset.timestamp;
    commentInput.placeholder = 'Add a comment... (Press \'C\' while playing to timestamp)';
    
    // Update UI
    renderCommentsEnhanced(state.currentTrack.id);
    
    // Save to storage/server
    const artist = getArtistFromUrl();
    saveComments(artist);
    
    console.log('[AudioPlayer] Comment added:', comment);
  });
}

// Setup keyboard shortcuts for timestamped comments
function setupKeyboardShortcuts() {
  console.log('[AudioPlayer] Setting up keyboard shortcuts');
  
  document.addEventListener('keydown', function(event) {
    // Only process if we have a current track
    if (!state.currentTrack) return;
    
    // Check if comment input is focused
    const commentInput = document.querySelector('.comment-input');
    const isCommentFocused = document.activeElement === commentInput;
    
    // Handle 'Space' for play/pause (only if comment input is not focused)
    if (event.code === 'Space' && !isCommentFocused) {
      event.preventDefault();
      togglePlayback();
    }
    
    // Handle 'C' for adding timestamped comment
    if (event.code === 'KeyC' && state.isPlaying && !isCommentFocused) {
      event.preventDefault();
      
      // Set timestamp in the input
      if (commentInput) {
        const currentTime = state.audioElement.currentTime;
        commentInput.dataset.timestamp = currentTime;
        commentInput.placeholder = `Comment at ${formatTime(currentTime)}...`;
        commentInput.focus();
        
        // Add visual indicator
        const timestampButton = document.querySelector('.timestamp-button');
        if (timestampButton) {
          timestampButton.classList.add('active');
          setTimeout(() => {
            timestampButton.classList.remove('active');
          }, 500);
        }
      }
    }
    
    // Handle 'ArrowLeft' for seeking backward
    if (event.code === 'ArrowLeft' && !isCommentFocused) {
      event.preventDefault();
      if (state.audioElement) {
        state.audioElement.currentTime = Math.max(0, state.audioElement.currentTime - 5);
      }
    }
    
    // Handle 'ArrowRight' for seeking forward
    if (event.code === 'ArrowRight' && !isCommentFocused) {
      event.preventDefault();
      if (state.audioElement) {
        state.audioElement.currentTime = Math.min(
          state.audioElement.duration,
          state.audioElement.currentTime + 5
        );
      }
    }
  });
}

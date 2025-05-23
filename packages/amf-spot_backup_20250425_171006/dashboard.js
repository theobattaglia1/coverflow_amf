(function(){
  'use strict';
  console.debug('[Dashboard] Core script init');

  // derive artist slug from URL
  var parts  = window.location.pathname.split('/').filter(function(s){ return !!s; });
  // Adjust index based on your actual URL structure if needed. Assumes structure like /artist-slug/dashboard
  var artist = parts[parts.length - 2] || 'unknown-artist';
  console.debug('[Dashboard] Artist detected:', artist);

  // define endpoints (excluding audio/comments handled by other scripts)
  var base      = '/api/' + artist;
  var endpoints = {
    tasks:    base + '/tasks',
    // comments: base + '/comments', // Handled by audioplayer.js
    // audio:    base + '/audio-files', // Handled by audioplayer.js
    images:   base + '/image-files', // Note: coverflow.js might handle some images
    events:   base + '/calendar-events'
  };

  // Comment form submission is removed - assuming handled by audioplayer.js

  function fetchAndRender(key) {
    var ul = document.getElementById(key + '-list');
    if (!ul) {
        console.warn('[Dashboard] List container not found for key:', key);
        return; // Don't proceed if the list element doesn't exist
    }
    console.debug('[Dashboard] fetch', key, '→', endpoints[key]);

    fetch(endpoints[key])
      .then(function(res){
        console.debug('[Dashboard]', key, 'status:', res.status);
        // handle OAuth for events
        if (res.status === 401 && key === 'events') {
          ul.innerHTML = '<li>Please <a href="/auth/google">connect your Google Calendar</a></li>';
          throw new Error('Unauthorized');
        }
        if (!res.ok) throw new Error(res.statusText || res.status);
        return res.json();
      })
      .then(function(data){
        ul.innerHTML = ''; // Clear previous items

        // --- MODIFIED PAYLOAD HANDLING ---
        var items = [];
        if (Array.isArray(data)) {
          items = data;
        } else if (data && typeof data === 'object') {
          if (key === 'tasks' && Array.isArray(data.tasks)) {
            items = data.tasks;
          } else if (key === 'images' && Array.isArray(data.files)) { // Handles { files: [...] } payload
            items = data.files;
          } else if (key === 'images' && Array.isArray(data.images)) { // Handles { images: [...] } payload
            items = data.images;
          } else if (key === 'events' && Array.isArray(data.events)) {
            items = data.events;
          } else {
            console.warn('[Dashboard] Unexpected object payload structure for', key, data);
          }
        } else {
           console.warn('[Dashboard] Unexpected payload type for', key, typeof data, data);
        }
        // --- END MODIFIED PAYLOAD HANDLING ---


        if (items.length === 0) {
            ul.innerHTML = '<li class="empty">No ' + key + ' found.</li>';
            return;
        }

        // --- MODIFIED ITEM RENDERING with CHECKS ---
        items.forEach(function(item){
          if (!item) {
              console.warn('[Dashboard] Skipping null/undefined item in', key);
              return; // Skip invalid items
          }

          var li = document.createElement('li');

          try {
            if (key === 'tasks') {
              var dateString = (item.date && typeof item.date === 'string') ? item.date.slice(0, 10) : 'No date';
              li.textContent = (item.title || 'Untitled Task') + ' @ ' + dateString;
            }
            // Removed 'comments' rendering block
            // Removed 'audio' rendering block
            else if (key === 'images') {
              var src = item.url || item.path || item.filename;
               if (src) {
                  var img = document.createElement('img');
                  img.src = src;
                  img.alt = item.title || 'Dashboard Image';
                  img.loading = 'lazy';
                  img.style.maxWidth = '100px';
                  img.style.maxHeight = '100px';
                  img.style.verticalAlign = 'middle';
                  img.style.marginRight = '8px'; // Add some spacing
                  li.appendChild(img);
                  li.appendChild(document.createTextNode(item.title || '')); // Add title text
              } else {
                  li.textContent = item.title || 'Image with missing source';
                  li.classList.add('error');
              }
            }
            else if (key === 'events') {
                var startDate = item.start ? (item.start.dateTime || item.start.date || item.start) : 'No date';
                try { startDate = new Date(startDate).toLocaleString(); } catch(e) { /* ignore */ }
                li.textContent = (item.summary || 'Untitled Event') + ' @ ' + startDate;
            }
            ul.appendChild(li);

          } catch (renderError) {
              console.error('[Dashboard] Error rendering item for key', key, item, renderError);
              var errorLi = document.createElement('li');
              errorLi.textContent = 'Error rendering item.';
              errorLi.classList.add('error');
              ul.appendChild(errorLi);
          }
        });
        // --- END MODIFIED ITEM RENDERING ---
      })
      .catch(function(err){
        if (err.message !== 'Unauthorized') {
          console.error('[Dashboard] Error loading', key, err);
           if (ul) {
             ul.innerHTML = '<li class="error">Failed to load ' + key + '. ' + (err.message || '') + '</li>';
           }
        }
      });
  }

  // Define sections this script is responsible for
  var sectionsToLoad = ['tasks', 'images', 'events'];
  console.debug('[Dashboard] Initializing sections:', sectionsToLoad);
  sectionsToLoad.forEach(fetchAndRender);

  // Add refresh handler for events if button exists
  var refreshButton = document.getElementById('refresh-events');
  if (refreshButton) {
      refreshButton.addEventListener('click', function() {
          console.debug('[Dashboard] Refreshing events...');
          fetchAndRender('events');
      });
  } else {
      console.warn('[Dashboard] Refresh events button not found.');
  }

})();

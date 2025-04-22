(function(){
  'use strict';
  console.debug('[Dashboard] init');

  // derive artist slug from URL
  var parts  = window.location.pathname.split('/').filter(function(s){ return !!s; });
  var artist = parts[0];

  // define endpoints
  var base      = '/api/' + artist;
  var endpoints = {
    tasks:    base + '/tasks',
    comments: base + '/comments',
    audio:    base + '/audio-files',
    images:   base + '/image-files',
    events:   base + '/calendar-events'
  };

  // handle comment submissions
  var commentForm = document.getElementById('comment-form');
  if (commentForm) {
    commentForm.addEventListener('submit', function(e){
      e.preventDefault();
      var input = document.getElementById('comment-input');
      var text  = input.value.trim();
      if (!text) return;

      fetch(endpoints.comments, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: text })
      })
      .then(function(res){
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(function(){
        input.value = '';
        fetchAndRender('comments');
      })
      .catch(function(err){
        console.error('[Dashboard] comment save error', err);
      });
    });
  }

  function fetchAndRender(key) {
    var ul = document.getElementById(key + '-list');
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
        ul.innerHTML = '';

        // pick the right array from the payload
        var items = [];
        if (Array.isArray(data)) {
          items = data;
        } else if (key === 'tasks' && Array.isArray(data.tasks)) {
          items = data.tasks;
        } else if (key === 'comments' && Array.isArray(data.comments)) {
          items = data.comments;
        } else if (key === 'audio' && Array.isArray(data.files)) {
          items = data.files;
        } else if (key === 'images' && Array.isArray(data.images)) {
          items = data.images;
        } else if (key === 'events' && Array.isArray(data.events)) {
          items = data.events;
        } else {
          console.warn('[Dashboard] unexpected payload for', key, data);
        }

        // render each item
        items.forEach(function(item){
          var li = document.createElement('li');

          if (key === 'tasks') {
            li.textContent = item.title + ' @ ' + item.date.slice(0,10);
          }
          else if (key === 'comments') {
            li.textContent = (item.author || 'anon') + ': ' + item.comment;
          }
          else if (key === 'audio') {
            // handle object with url or filename
            var src = item.url || item.path || item.filename;
            var a   = document.createElement('audio');
            a.controls = true;
            a.src = src;
            li.appendChild(a);
          }
          else if (key === 'images') {
            var src = item.url || item.path || item.filename;
            var img = document.createElement('img');
            img.src = src;
            li.appendChild(img);
          }
          else if (key === 'events') {
            li.textContent = item.summary + ' @ ' + item.start;
          }

          ul.appendChild(li);
        });
      })
      .catch(function(err){
        if (err.message !== 'Unauthorized') {
          console.error('[Dashboard] Error loading', key, err);
          ul.innerHTML = '<li class="error">Failed to load ' + key + '</li>';
        }
      });
  }

  // kick off all sections
  ['tasks','comments','audio','images','events'].forEach(fetchAndRender);

})();

(function(){
  'use strict';
  console.debug('[Dashboard] init');

  // extract artist from URL
  var parts  = window.location.pathname.split('/').filter(function(s){return!!s});
  var artist = parts[0];

  // endpoints
  var base      = '/api/' + artist;
  var endpoints = {
    tasks:    base + '/tasks',
    comments: base + '/comments',
    audio:    base + '/audio-files',
    images:   base + '/image-files',
    events:   base + '/calendar-events'
  };

  function fetchAndRender(key) {
    var ul = document.getElementById(key + '-list');
    console.debug('[Dashboard] fetch', key, '→', endpoints[key]);
    fetch(endpoints[key])
      .then(function(res){
        console.debug('[Dashboard]', key, 'status:', res.status);
        if (res.status===401 && key==='events') {
          ul.innerHTML = '<li>Please <a href="/auth/google">connect your Google Calendar</a></li>';
          throw new Error('Unauthorized');
        }
        if (!res.ok) throw new Error(res.statusText||res.status);
        return res.json();
      })
      .then(function(data){
        ul.innerHTML = '';
        data.forEach(function(item){
          var li = document.createElement('li');
          if (key==='tasks')      li.textContent = item.title + ' @ ' + item.date.slice(0,10);
          else if (key==='comments') li.textContent = (item.author||'anon') + ': ' + item.comment;
          else if (key==='audio') {
            var a = document.createElement('audio');
            a.controls = true;
            a.src = '/uploads/audio/' + encodeURIComponent(item);
            li.appendChild(a);
          }
          else if (key==='images') {
            var img = document.createElement('img');
            img.src = '/uploads/images/' + encodeURIComponent(item);
            li.appendChild(img);
          }
          else if (key==='events') li.textContent = item.summary + ' @ ' + item.start;
          ul.appendChild(li);
        });
      })
      .catch(function(err){
        if (err.message!=='Unauthorized') {
          console.error('[Dashboard] Error loading', key, err);
          ul.innerHTML = '<li class="error">Failed to load ' + key + '</li>';
        }
      });
  }

  // initial load
  ['tasks','comments','audio','images','events'].forEach(fetchAndRender);
})();

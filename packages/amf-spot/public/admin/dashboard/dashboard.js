(function(){
  'use strict';
  console.debug('[Dashboard][ADMIN] init');

  // extract artist from URL
  var parts  = window.location.pathname.split('/').filter(function(s){ return !!s; });
  var artist = parts[1];

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
    console.debug('[Dashboard][ADMIN] fetch', key, '→', endpoints[key]);
    fetch(endpoints[key])
      .then(function(res){
        console.debug('[Dashboard][ADMIN]', key, 'status:', res.status);
        if (res.status === 401 && key==='events') {
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
          if (key==='tasks') {
            li.textContent = item.title + ' @ ' + item.date.slice(0,10);
          }
          else if (key==='comments') {
            li.innerHTML = '<strong>' + (item.author||'anon') + ':</strong> ' + item.comment;
          }
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
          else if (key==='events') {
            li.textContent = item.summary + ' @ ' + item.start.slice(0,10);
          }
          ul.appendChild(li);
        });
      })
      .catch(function(err){
        if (err.message!=='Unauthorized') {
          console.error('[Dashboard][ADMIN] Error loading', key, err);
          ul.innerHTML = '<li class="error">Failed to load ' + key + '</li>';
        }
      });
  }

  // forms
  document.getElementById('tasks-form').addEventListener('submit', function(e){
    e.preventDefault();
    var t = document.getElementById('task-title').value;
    var d = document.getElementById('task-date').value;
    fetch(endpoints.tasks,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({title:t,date:d})
    }).then(function(){
      e.target.reset();
      fetchAndRender('tasks');
    });
  });
  document.getElementById('comments-form').addEventListener('submit', function(e){
    e.preventDefault();
    var a = document.getElementById('comment-author').value;
    var c = document.getElementById('comment-text').value;
    fetch(endpoints.comments,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({author:a,comment:c})
    }).then(function(){
      e.target.reset();
      fetchAndRender('comments');
    });
  });
  document.getElementById('audio-form').addEventListener('submit', function(e){
    e.preventDefault();
    var f  = document.getElementById('audio-file').files[0];
    var fm = new FormData();
    fm.append('file',f);
    fetch(base+'/upload-audio',{method:'POST',body:fm})
      .then(function(){ e.target.reset(); fetchAndRender('audio'); });
  });
  document.getElementById('images-form').addEventListener('submit', function(e){
    e.preventDefault();
    var f  = document.getElementById('image-file').files[0];
    var fm = new FormData();
    fm.append('file',f);
    fetch(base+'/upload-image',{method:'POST',body:fm})
      .then(function(){ e.target.reset(); fetchAndRender('images'); });
  });
  document.getElementById('refresh-events').addEventListener('click', function(){
    fetchAndRender('events');
  });

  // initial load
  ['tasks','comments','audio','images','events'].forEach(fetchAndRender);
  console.debug('[Dashboard][ADMIN] ready for', artist);
})();

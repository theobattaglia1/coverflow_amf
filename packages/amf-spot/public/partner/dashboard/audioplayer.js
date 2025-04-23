// FILE: audioplayer.js (multi-track safe hover + timestamp + animation + waveform)

console.log('[AudioPlayer] Initializing...');

document.addEventListener('DOMContentLoaded', async function () {
  var container = document.getElementById('audio-player');
  if (!container) return;

  var artist = getArtistFromURL();
  var data = await fetchJSON('/api/' + artist + '/audio-files');
  var comments = await loadComments(artist);
  var tracks = data.files || [];

  container.innerHTML = '';
  tracks.forEach(function (track, index) {
    renderTrack(container, track, index, artist, comments);
  });
});

function renderTrack(container, track, index, artist, comments) {
  var card = document.createElement('div');
  card.className = 'audio-track';

  var title = document.createElement('h3');
  title.textContent = (index + 1) + '. ' + (track.title || 'Untitled');

  var wrapper = document.createElement('div');
  wrapper.className = 'audio-wrapper';

  var canvas = document.createElement('canvas');
  canvas.className = 'waveform';
  canvas.width = 600;
  canvas.height = 40;

  var overlay = document.createElement('div');
  overlay.className = 'comment-marker-container';

  var ghost = document.createElement('div');
  ghost.className = 'comment-ghost';
  overlay.appendChild(ghost);

  var player = document.createElement('audio');
  player.src = encodeURI(track.url).replace(/\?/g, '');
  player.controls = true;

  overlay.addEventListener('mousemove', function (e) {
    var rect = overlay.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var percent = x / rect.width;
    if (player.duration) {
      ghost.style.left = (percent * 100) + '%';
      ghost.dataset.time = (percent * player.duration).toFixed(2);
    }
  });

  overlay.addEventListener('mouseleave', function () {
    ghost.style.left = '-9999px';
  });

  var commentBox = document.createElement('div');
  commentBox.className = 'comment-box';
  commentBox.innerHTML =
    '<input type="text" class="comment-input" placeholder="Add comment...">' +
    '<button class="comment-submit">Post</button>';

  var thread = document.createElement('div');
  thread.className = 'comment-thread';

  var input = commentBox.querySelector('.comment-input');
  var submit = commentBox.querySelector('.comment-submit');

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit.click();
    }
  });

  submit.onclick = function () {
    var text = input.value.trim();
    if (!text) return;

    var t = parseFloat(input.dataset.timestamp || player.currentTime);

    var comment = {
      id: Date.now(),
      trackId: track.id,
      text: text,
      timestamp: t,
      author: 'User',
      date: new Date().toISOString(),
      parentId: input.dataset.replyTo ? parseInt(input.dataset.replyTo) : null
    };

    input.value = '';
    delete input.dataset.replyTo;
    delete input.dataset.timestamp;

    comments.push(comment);
    saveComments(artist, comments);
    rerenderThread(thread, comments, artist, track.id);
  };

  drawFakeWaveform(canvas);

  wrapper.append(canvas, overlay, player);
  card.append(title, wrapper, commentBox, thread);
  container.appendChild(card);

  rerenderThread(thread, comments, artist, track.id);

  // 👇 Key listener scoped per track (fixes multi-audio)
  document.addEventListener('keydown', function (e) {
    if (e.code === 'KeyC' && ghost && input) {
      e.preventDefault();
      var t = parseFloat(ghost.dataset.time);
      if (!isNaN(t)) {
        input.dataset.timestamp = t;
        input.placeholder = 'Comment at ' + formatTime(t);
        ghost.classList.add('active');
        setTimeout(function () {
          ghost.classList.remove('active');
        }, 300);
        input.focus();
      }
    }
  });
}

function rerenderThread(thread, comments, artist, trackId) {
  thread.innerHTML = '';
  comments
    .filter(function (c) { return c.trackId === trackId && !c.parentId; })
    .forEach(function (parent) {
      var el = buildCommentEl(parent, comments, artist, thread, trackId);
      thread.appendChild(el);

      var replies = comments.filter(function (r) { return r.parentId === parent.id; });
      if (replies.length > 0) {
        var toggle = document.createElement('button');
        toggle.textContent = 'Show ' + replies.length + ' replies';
        toggle.className = 'reply-toggle';
        toggle.onclick = function () {
          toggle.remove();
          replies.forEach(function (reply) {
            thread.appendChild(buildCommentEl(reply, comments, artist, thread, trackId, true));
          });
        };
        thread.appendChild(toggle);
      }
    });
}

function buildCommentEl(comment, comments, artist, thread, trackId, isReply) {
  var el = document.createElement('div');
  el.className = 'comment-item' + (isReply ? ' reply' : '');
  el.dataset.id = comment.id;

  var meta = document.createElement('small');
  meta.textContent = '⏱️ ' + formatTime(comment.timestamp) + ' • ' + timeAgo(comment.date);

  var text = document.createElement('p');
  text.textContent = comment.text;

  var replyBtn = document.createElement('button');
  replyBtn.textContent = '↪️ Reply';
  replyBtn.onclick = function () {
    var input = thread.closest('.audio-track').querySelector('.comment-input');
    input.dataset.replyTo = comment.id;
    input.focus();
  };

  el.append(meta, text, replyBtn);
  return el;
}

function timeAgo(dateStr) {
  var seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  var minutes = Math.floor(seconds / 60);
  var hours = Math.floor(minutes / 60);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes + ' min ago';
  if (hours < 24) return hours + ' hr ago';
  return new Date(dateStr).toLocaleDateString();
}

function drawFakeWaveform(canvas) {
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ddd';
  for (var i = 0; i < canvas.width; i += 4) {
    var h = 10 + Math.random() * 20;
    ctx.fillRect(i, (canvas.height - h) / 2, 2, h);
  }
}

function getArtistFromURL() {
  var parts = window.location.pathname.split('/');
  return parts[parts.indexOf('dashboard') - 1] || 'default-artist';
}

async function fetchJSON(url) {
  var res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch ' + url);
  return await res.json();
}

async function loadComments() {
  return [];
}

function saveComments(artist, comments) {
  // store via API or localStorage
}

function formatTime(sec) {
  var m = Math.floor(sec / 60);
  var s = Math.floor(sec % 60).toString().padStart(2, '0');
  return m + ':' + s;
}

// Add this to rerenderThread() to create visible marker buttons
function injectCommentMarkers(wrapper, comments, player, thread, trackId) {
  // Remove old markers first
  var oldMarkers = wrapper.querySelectorAll('.comment-jump-marker');
  oldMarkers.forEach(function (m) { m.remove(); });

  comments
    .filter(function (c) { return c.trackId === trackId && c.timestamp !== null; })
    .forEach(function (comment) {
      var marker = document.createElement('div');
      marker.className = 'comment-jump-marker';
      marker.style.left = (comment.timestamp / player.duration * 100) + '%';
      marker.title = comment.text;

      marker.onclick = function () {
        player.currentTime = comment.timestamp;
        var target = thread.querySelector('[data-id="' + comment.id + '"]');
        if (target) {
          target.classList.add('highlight');
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(function () {
            target.classList.remove('highlight');
          }, 1000);
        }
      };

      wrapper.querySelector('.comment-marker-container').appendChild(marker);
    });
}

// Replace your rerenderThread() function with this updated version
function rerenderThread(thread, comments, artist, trackId) {
  thread.innerHTML = '';
  var wrapper = thread.closest('.audio-track').querySelector('.audio-wrapper');
  var player = wrapper.querySelector('audio');

  comments
    .filter(function (c) { return c.trackId === trackId && !c.parentId; })
    .forEach(function (parent) {
      var el = buildCommentEl(parent, comments, artist, thread, trackId);
      thread.appendChild(el);

      var replies = comments.filter(function (r) { return r.parentId === parent.id; });
      if (replies.length > 0) {
        var toggle = document.createElement('button');
        toggle.textContent = 'Show ' + replies.length + ' replies';
        toggle.className = 'reply-toggle';
        toggle.onclick = function () {
          toggle.remove();
          replies.forEach(function (reply) {
            thread.appendChild(buildCommentEl(reply, comments, artist, thread, trackId, true));
          });
        };
        thread.appendChild(toggle);
      }
    });

  // Inject markers above waveform 🎯
  injectCommentMarkers(wrapper, comments, player, thread, trackId);
}

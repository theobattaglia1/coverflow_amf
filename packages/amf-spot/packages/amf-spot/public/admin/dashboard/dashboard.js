/* ------------ ADMIN Dashboard – FIXED ------------- */
(async () => {
  'use strict';
  console.log('%c[ADMIN] init', 'color:orange;font-weight:bold');

  // segments: ['', 'admin', '<artist>', 'dashboard', ...]
  const seg = location.pathname.split('/').filter(Boolean);
  console.log('[ADMIN] raw segments:', seg);

  if (seg[0] !== 'admin') {
    console.error('[ADMIN] Not under /admin/:artist/');
    return;
  }
  const artist = seg[1];
  const base   = '/api/' + artist;
  console.log('[ADMIN] detected artist:', artist);
  console.log('[ADMIN] base API path:', base);

  const endpoints = {
    tasks   : `${base}/tasks`,
    comments: `${base}/comments`,
    audio   : `${base}/audio-files`,
    images  : `${base}/image-files`,
    events  : `${base}/calendar-events`
  };

  async function fetchAndRender(key) {
    const list = document.getElementById(key + '-list');
    try {
      console.log(`[ADMIN] fetching ${key} →`, endpoints[key]);
      const res = await fetch(endpoints[key]);
      console.log(`[ADMIN] ${key} status:`, res.status);
      if (!res.ok) throw new Error(res.statusText || res.status);
      const data = await res.json();
      list.innerHTML = '';
      data.forEach(item => {
        const li = document.createElement('li');
        li.textContent = typeof item === 'string'
          ? item
          : (item.title || item.summary || JSON.stringify(item));
        list.appendChild(li);
      });
    } catch (err) {
      console.error(`[ADMIN] Error loading ${key}:`, err);
      list.innerHTML = `<li style="color:red"><strong>Failed to load ${key}</strong></li>`;
    }
  }

  //— Wire the admin forms:
  document.getElementById('tasks-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    await fetch(endpoints.tasks, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        title: document.getElementById('task-title').value,
        date:  document.getElementById('task-date').value
      })
    });
    e.target.reset();
    fetchAndRender('tasks');
  });

  document.getElementById('comments-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    await fetch(endpoints.comments, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        author: document.getElementById('comment-author').value,
        text:   document.getElementById('comment-text').value
      })
    });
    e.target.reset();
    fetchAndRender('comments');
  });

  document.getElementById('audio-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fm = new FormData();
    fm.append('file', document.getElementById('audio-file').files[0]);
    await fetch(`${base}/upload-audio`, { method: 'POST', body: fm });
    e.target.reset();
    fetchAndRender('audio');
  });

  document.getElementById('images-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fm = new FormData();
    fm.append('file', document.getElementById('image-file').files[0]);
    await fetch(`${base}/upload-image`, { method: 'POST', body: fm });
    e.target.reset();
    fetchAndRender('images');
  });

  document.getElementById('refresh-events')?.addEventListener('click',
    () => fetchAndRender('events'));

  // “c” shortcut → focus comment author
  window.addEventListener('keydown', e => {
    if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      document.getElementById('comment-author')?.focus();
    }
  });

  // initial load
  ['tasks','comments','audio','images','events'].forEach(fetchAndRender);
  console.log('%c[ADMIN] ready', 'color:orange');
})();

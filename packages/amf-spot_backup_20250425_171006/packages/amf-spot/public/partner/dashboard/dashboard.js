/* ------------ PARTNER Dashboard – FIXED ------------- */
(async () => {
  'use strict';
  console.log('%c[PARTNER] init', 'color:steelblue;font-weight:bold');

  // segments: ['', '<artist>', 'dashboard', ...]
  const seg = location.pathname.split('/').filter(Boolean);
  console.log('[PARTNER] raw segments:', seg);

  const artist = seg[0];
  const base   = '/api/' + artist;
  console.log('[PARTNER] detected artist:', artist);
  console.log('[PARTNER] base API path:', base);

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
      console.log(`[PARTNER] fetching ${key} →`, endpoints[key]);
      const res = await fetch(endpoints[key]);
      console.log(`[PARTNER] ${key} status:`, res.status);
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
      console.error(`[PARTNER] Error loading ${key}:`, err);
      list.innerHTML = `<li style="color:red"><strong>Failed to load ${key}</strong></li>`;
    }
  }

  document.getElementById('refresh-events')?.addEventListener('click',
    () => fetchAndRender('events'));

  ['tasks','comments','audio','images','events'].forEach(fetchAndRender);
  console.log('%c[PARTNER] ready', 'color:steelblue');
})();

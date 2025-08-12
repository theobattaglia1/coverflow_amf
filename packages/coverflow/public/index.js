(function(){
  const namesEl = document.getElementById('gg-names');
  const container = document.getElementById('gg-container');
  const canvas = document.getElementById('gg-canvas');
  const modal = document.getElementById('gg-modal');
  const viewToggleBtn = document.getElementById('gg-view-toggle');
  const overlays = document.getElementById('gg-overlays');
  const nameList = document.getElementById('gg-name-list');
  const resetChip = document.getElementById('gg-reset');
  const gridEl = document.getElementById('gg-grid');
  const centerLogoFrame = document.querySelector('.gg-center-logo .center-logo-frame');

  let covers = [];
  let isDragging = false;
  let startX = 0, startY = 0;
  let translateX = 0, translateY = 0;
  let velocityX = 0, velocityY = 0;
  let lastT = 0, lastX = 0, lastY = 0;
  let rafId = 0;
  let expandedId = null;
  let centeredId = null; // track which item is centered for click-to-open
  let pointerDown = false;
  let didDrag = false;
  let downX = 0, downY = 0;
  let suppressClicksUntil = 0;
  let currentScale = 0.55; // Midpoint between 0.6 and earlier zoom-out
  let pinchStartDist = 0;
  let pinchStartScale = 1;
  let activeFilter = 'all';
  let spotlightId = null; // mobile-only: highlighted single cover from names list

  // Canonical socials from investors_220220.html
  const CANON_SOCIALS = {
    'hudson ingram': {
      instagram: 'https://www.instagram.com/hudson.ingram/',
      tiktok: 'https://www.tiktok.com/@hudson.ingram'
    },
    'jack schrepferman': {
      instagram: 'https://www.instagram.com/jackschrepferman/'
    },
    'ruby plume': {
      instagram: 'https://www.instagram.com/rubytplume/',
      tiktok: 'https://www.tiktok.com/@rubytplume'
    },
    'tom siletto': {
      instagram: 'https://www.instagram.com/tomsiletto/',
      tiktok: 'https://www.tiktok.com/@tomsilettomusic'
    },
    'conall cafferty': {
      instagram: 'https://www.instagram.com/conallcafferty/',
      tiktok: 'https://www.tiktok.com/@conallcafferty'
    },
    'kate stephenson': {
      instagram: 'https://www.instagram.com/kate_stephenson/',
      tiktok: 'https://www.tiktok.com/@katestephensonmusic'
    },
    'leon sharplin': {
      instagram: 'https://www.instagram.com/leonsharplin/'
    }
  };

  // Canonical Spotify playlists for embeds (override any per-cover links)
  const CANON_SPOTIFY = {
    'jack schrepferman': 'https://open.spotify.com/playlist/5iX6HkjhclKatZdIqDQFzB?si=351d307c22664c88',
    'leon sharplin': 'https://open.spotify.com/playlist/4e8uKKol31jGXrcsb6v1Af?si=07cf9895d54e4560',
    'ruby plume': 'https://open.spotify.com/playlist/6ymQ0s5DAq64L7zmnWhFjh?si=b00be9755c324c59',
    'kate stephenson': 'https://open.spotify.com/playlist/49fc2CryqdBsw4WJluu7OE?si=1298210750704225',
    'conall cafferty': 'https://open.spotify.com/playlist/7HK7bHA4HITa1Jy66GlOco?si=e59522b608604ec5',
    'hudson ingram': 'https://open.spotify.com/playlist/0mkH1SbhZyoHL85DDrEYka?si=25293648a556457d',
    'tom siletto': 'https://open.spotify.com/playlist/4gYEzXxLB9ZZcPMY4aJNQ3?si=3fd16009a45a4cba',
    'about amf': 'https://open.spotify.com/playlist/1WELZ2XjcMzHGNg5zAUUq9?si=1efd9eeb9a3448d6',
    'about all my friends': 'https://open.spotify.com/playlist/1WELZ2XjcMzHGNg5zAUUq9?si=1efd9eeb9a3448d6'
  };

  const ABOUT_TEXT = 'All My Friends is an artist-first management team rooted in creative development. We work with artists, writers, and producers to build and back work that resonates—culturally, emotionally, and with the kind of clarity and depth that holds up over time. We’re grounded in a tight-knit approach—staying hands-on, taste-led, and guided by instinct. We work with good people who make things that matter.';

  // Load fonts/styles from styles.json (light touch)
  fetch('/data/styles.json').then(r=>r.json()).then(style=>{
    document.getElementById('global-styles').innerHTML = `body{font-family:'${style.fontFamily||'Inter'}',sans-serif;}`;
  }).catch(()=>{});

  // Image helpers
  function resolveImageUrl(c){
    return c.frontImage?.startsWith('/uploads/') ? `https://allmyfriendsinc.com${c.frontImage}` : (c.frontImage || '');
  }
  function preloadAspects(list){
    return Promise.all(list.map(c => new Promise(resolve => {
      if (c._aspect && c._aspect > 0) { resolve(); return; }
      const url = resolveImageUrl(c);
      if (!url) { c._aspect = 1.5; resolve(); return; }
      const img = new Image();
      img.onload = () => { c._aspect = img.naturalWidth && img.naturalHeight ? (img.naturalWidth / img.naturalHeight) : 1.5; resolve(); };
      img.onerror = () => { c._aspect = 1.5; resolve(); };
      img.src = url;
    })));
  }

  function matchesRole(cover, roleKey){
    if (!roleKey || roleKey === 'all') return true;
    const synonyms = {
      artist: ['artist', 'artists'],
      writer: ['writer', 'writers', 'songwriter', 'songwriters'],
      producer: ['producer', 'producers']
    };
    // Normalize requested role
    let norm = roleKey.toLowerCase();
    if (norm.endsWith('s')) norm = norm.slice(0, -1);
    if (norm === 'songwriter' || norm === 'songwriters') norm = 'writer';
    const acceptable = new Set(synonyms[norm] || [norm]);

    // Build a lowercase string of all role/category hints on the cover
    const rolesField = cover?.artistDetails?.roles;
    const roleField = cover?.artistDetails?.role;
    const categories = Array.isArray(cover?.category) ? cover.category : [];
    const parts = [];
    if (Array.isArray(rolesField)) parts.push(...rolesField.map(x=>String(x).toLowerCase()));
    else if (rolesField) parts.push(String(rolesField).toLowerCase());
    if (roleField) parts.push(String(roleField).toLowerCase());
    if (categories.length) parts.push(...categories.map(x=>String(x).toLowerCase()));
    const rolesRaw = parts.join(' ');

    for (const token of acceptable){ if (rolesRaw.includes(token)) return true; }
    return false;
  }

  // Load covers
  fetch(`/data/covers.json?cb=${Date.now()}`)
    .then(r=>r.json())
    .then(async data => { 
      covers = data; 
      buildNames(); 
      // Swap placement of Jack Schrepferman and Hudson Ingram in the initial order
      try {
        const findByName = (needle) => covers.findIndex(c => {
          const n = (c.artistDetails?.name || c.coverLabel || c.albumTitle || '').toLowerCase();
          return n.includes(needle);
        });
        const idxJack = findByName('jack schrepferman');
        const idxHudson = findByName('hudson ingram');
        if (idxJack >= 0 && idxHudson >= 0) {
          const tmp = covers[idxJack];
          covers[idxJack] = covers[idxHudson];
          covers[idxHudson] = tmp;
        }
      } catch(e) { /* no-op */ }
      await preloadAspects(covers);
      layoutItems(); 
      // Initialize transform for edge-to-edge feel; responsive to viewport
      setTimeout(() => {
        const isMobile = window.innerWidth <= 768;
        // For desktop, pick a responsive starting scale based on viewport; mobile keeps currentScale
        if (!isMobile) currentScale = Math.max(0.55, Math.min(1.1, getScale()));

        const containerRect = container.getBoundingClientRect();
        const canvasWidth = parseInt(canvas.style.width) || 2000;
        const canvasHeight = parseInt(canvas.style.height) || 1000;
        const scaledWidth = canvasWidth * currentScale;
        const scaledHeight = canvasHeight * currentScale;

        // Center, then bias differently for desktop vs mobile
        // Desktop: move slightly down and to the right
        // Mobile: move up and to the left quite a bit to reveal more covers
        // Nudge initial view slightly to the left for a better first impression
        const biasX = isMobile ? -(containerRect.width * 0.35) : (containerRect.width * 0.06);
        const biasY = isMobile ? -(containerRect.height * 0.22) : (containerRect.height * 0.06);
        translateX = (containerRect.width - scaledWidth) / 2 + biasX;
        translateY = (containerRect.height - scaledHeight) / 2 + biasY;
        applyTransform();
      }, 100);
      buildEditorialOverlays(); 
      startLoop(); 
    })
    .catch(err => console.error('Failed to load covers', err));

  function buildNames(){
    namesEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    // Static: About Us and contact first
    const aboutBtn = document.createElement('button');
    aboutBtn.textContent = 'About Us';
    aboutBtn.addEventListener('click', () => { 
      // Use the real About cover so image matches, then inject the canonical text/playlist
      const aboutCover = covers.find(c => {
        const n = (c.artistDetails?.name || c.coverLabel || c.albumTitle || '').toLowerCase();
        const cat = (c.category || []).map(x=>String(x).toLowerCase());
        return n.includes('about') || cat.includes('about us') || cat.includes('about');
      });
      if (aboutCover) {
        aboutCover.artistDetails = aboutCover.artistDetails || {};
        aboutCover.artistDetails.bio = ABOUT_TEXT;
        aboutCover.artistDetails.spotifyLink = CANON_SPOTIFY['about amf'];
        openModal(aboutCover);
    } else {
        // Fallback
        openModal({
          artistDetails: { name: 'About AMF', role: 'About', bio: ABOUT_TEXT, spotifyLink: CANON_SPOTIFY['about amf'] },
          albumTitle: 'About AMF',
          frontImage: '',
          music: { url: CANON_SPOTIFY['about amf'] }
        });
      }
    });
    frag.appendChild(aboutBtn);

    const contactBtn = document.createElement('button');
    contactBtn.textContent = 'Contact';
    contactBtn.addEventListener('click', () => { window.location.href = 'mailto:hi@allmyfriendsinc.com'; });
    frag.appendChild(contactBtn);

    // Broad filters
    const filters = [
      { key: 'all', label: 'All' },
      { key: 'artists', label: 'Artists' },
      { key: 'writers', label: 'Writers' },
      { key: 'producers', label: 'Producers' }
    ];
    filters.forEach(f => {
      const btn = document.createElement('button');
      btn.textContent = f.label;
      btn.addEventListener('click', () => applyFilter(f.key));
      frag.appendChild(btn);
    });
    const reserved = new Set(['about us.', 'about us', 'contact', 'contact us']);
    const seen = new Set();
    covers
      .map(c => ({ id: c.id, name: c.artistDetails?.name || c.coverLabel || c.albumTitle || 'Untitled' }))
      .filter(item => {
        const key = (item.name || '').toLowerCase().trim();
        if (reserved.has(key)) return false; // avoid duplicates with static buttons
        if (seen.has(key)) return false;     // dedupe repeated names
        seen.add(key);
        return true;
      })
      .sort((a,b)=>a.name.localeCompare(b.name))
      .forEach(item => { /* names no longer in top nav; left sticky handles names */ });
    namesEl.appendChild(frag);

    // Build left sticky alphabetical list
    if (nameList) {
      nameList.innerHTML = '';
      const listFrag = document.createDocumentFragment();
      const reserved = new Set(['about us', 'about us.', 'contact']);
      covers
        .map(c => ({ id: c.id, name: (c.artistDetails?.name || c.coverLabel || c.albumTitle || 'Untitled'), label: (c.artistDetails?.label || c.label || c.coverLabel || '') }))
        .filter(item => !reserved.has((item.name || '').toLowerCase().trim()))
        .sort((a,b)=>a.name.localeCompare(b.name))
        .forEach(item => {
          const a = document.createElement('a');
          a.className = 'name';
          const title = document.createElement('span');
          title.className = 'title';
          title.textContent = item.name;
          a.appendChild(title);
          // Do not render label in the names list; keep it only on the covers
          a.href = '#';
          // Clicking a name centers the corresponding cover
          a.addEventListener('click', (e)=>{
            e.preventDefault(); e.stopPropagation();
            centeredId = item.id;
            if (window.innerWidth <= 768) {
              if (spotlightId && spotlightId !== item.id) clearSpotlight();
              spotlightId = item.id;
              if (resetChip) resetChip.hidden = false;
              glideTo(item.id, () => { applySpotlightVisuals(); });
            } else {
              glideTo(item.id);
            }
          });
          listFrag.appendChild(a);
        });
      nameList.appendChild(listFrag);
    }
  }

  function applyFilter(key){
    activeFilter = (key || 'all').toLowerCase();
    // Spotlight conflicts with filters; clear it when applying any specific filter
    if (activeFilter !== 'all') clearSpotlight();
    if (resetChip) resetChip.hidden = activeFilter === 'all';
    // First, update dimming state by rebuilding items
    layoutItems();

    // If resetting to all, animate items back to their original coordinates
    if (activeFilter === 'all') {
      const items = Array.from(canvas.querySelectorAll('.gg-item'));
      items.forEach(it => {
        const ox = parseFloat(it.dataset.ox || '0');
        const oy = parseFloat(it.dataset.oy || '0');
        gsap.to(it, { duration: 0.6, ease: 'power3.inOut', left: ox, top: oy });
      });
      // Reapply spotlight visuals if any, since layoutItems() rebuilt DOM
      applySpotlightVisuals();
      return;
      }
      
    // Compute a centered row position within the true visible area (accounting for safe-area)
    const viewport = container.getBoundingClientRect();
    const scale = currentScale; // use current transform scale
    const safeBottom = window.innerWidth <= 768 ? getSafeAreaInset('bottom') : 0;
    const visibleTopCanvas = (-translateY + 0) / scale;
    const visibleBottomCanvas = (-translateY + (viewport.height - safeBottom)) / scale;
    const canvasCenterX = (-translateX + viewport.width / 2) / scale;
    const canvasCenterY = (visibleTopCanvas + visibleBottomCanvas) / 2;

    // Collect matching items
    const items = Array.from(canvas.querySelectorAll('.gg-item'));
    const matches = items.filter(it => {
      const id = it.dataset.id;
      const c = covers.find(x => String(x.id) === String(id));
      const keyNorm = activeFilter.replace(/s$/, '');
      return matchesRole(c, keyNorm);
    });

    if (matches.length === 0) return; // nothing to arrange

    const gutter = 24 * getScale();
    // total width in canvas units
    let totalWidth = 0;
    const widths = matches.map(el => el.getBoundingClientRect().width / scale);
    widths.forEach((w, idx) => { totalWidth += w + (idx > 0 ? gutter : 0); });
    let cursorX = canvasCenterX - totalWidth / 2;
    const rowH = (matches[0].getBoundingClientRect().height / scale);
    let targetY = canvasCenterY - rowH / 2;
    // Clamp so the row is fully within visible bounds even if very short
    const margin = 12 / scale;
    if (targetY < visibleTopCanvas + margin) targetY = visibleTopCanvas + margin;
    if (targetY + rowH > visibleBottomCanvas - margin) targetY = Math.max(visibleTopCanvas + margin, visibleBottomCanvas - margin - rowH);

    // Animate each matching item to its spot in the row
    matches.forEach((el, idx) => {
      const w = widths[idx];
      gsap.to(el, { duration: 0.6, ease: 'power3.inOut', left: cursorX, top: targetY });
      cursorX += w + gutter;
    });
  }

  // ESC to reset filter
  window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') { activeFilter = 'all'; if(resetChip) resetChip.hidden = true; layoutItems(); } });
  if (resetChip) resetChip.addEventListener('click', ()=>{ activeFilter = 'all'; resetChip.hidden = true; layoutItems(); });

  function layoutItems(){
    canvas.innerHTML = '';
    const frag = document.createDocumentFragment();

    const scale = getScale();

    // All tiles share the same height initially; widths are derived from each image's native aspect ratio
    const mobile = window.innerWidth <= 768;
    const rowPatterns = mobile
      ? [ [1,1,1], [1,1], [1,1,1] ] // only lengths matter (3,2,3)
      : [ [1,1,1], [1,1], [1,1,1,1] ]; // (3,2,4)
    const baseHeight = mobile ? 280 : 420; // initial shared height in design pixels
    const tileHeightPx = baseHeight * scale;

    const startXBase = 80 * scale; // left margin
    let rowY = 0;          // start flush with top edge
    let rowIndex = 0;
    let i = 0;

    const seededRand = (seed, min, max) => {
      // simple reproducible pseudo-random based on seed
      const x = Math.sin(seed * 9973) * 43758.5453;
      const t = x - Math.floor(x);
      return min + t * (max - min);
    };

    let maxRight = 0;
    while (i < covers.length) {
      const pattern = rowPatterns[rowIndex % rowPatterns.length];
      let rowTall = tileHeightPx;
      let cursorX = startXBase + (rowIndex % 2 === 1 ? 140 * scale : 0);

      for (let k = 0; k < pattern.length && i < covers.length; k++, i++) {
        const c = covers[i];
        const aspect = Math.max(0.3, Math.min(3, c._aspect || 1.5));
        const heightPx = tileHeightPx;
        const widthPx = heightPx * aspect;
        const jitterY = seededRand(i, -12, 12) * scale;      // small vertical wiggle without overlap
        const gapX = (120 * scale) + seededRand(i * 3, 20 * scale, 100 * scale); // variable horizontal gutter

        const x = cursorX;
        const y = rowY + jitterY;

        const item = document.createElement('div');
        item.className = 'gg-item';
        item.style.setProperty('--w', widthPx + 'px');
        item.style.setProperty('--h', heightPx + 'px');
        item.style.left = x + 'px';
        item.style.top = y + 'px';
        item.dataset.ox = x; // remember original position for reset
        item.dataset.oy = y;
        item.dataset.id = c.id;
        item.style.transform = ''; // ensure no leftover per-item transforms

        const imgUrl = resolveImageUrl(c);
        const img = document.createElement('div');
        img.className = 'img';
        if (imgUrl) img.style.backgroundImage = `url('${imgUrl}')`;
        item.appendChild(img);

        const meta = document.createElement('div');
        meta.className = 'meta';
        const title = document.createElement('p');
        title.className = 'title';
        title.textContent = (c.artistDetails?.name || c.coverLabel || c.albumTitle || '').toUpperCase();
        const sub = document.createElement('p');
        sub.className = 'sub';
        // Prefer label from artistDetails.label, fallback to label field, or blank
        const label = c.artistDetails?.label || c.label || c.coverLabel || '';
        sub.textContent = label || '';
        meta.appendChild(title);
        if (label) meta.appendChild(sub);
        item.appendChild(meta);

        // Remove per-item click handler; container delegates clicks to handle Chromium retargeting reliably

        // Dimming logic for non-matching when a filter is active
        if (activeFilter !== 'all') {
          const roleKey = activeFilter.replace(/s$/, '');
          if (!matchesRole(c, roleKey)) item.classList.add('dimmed');
        }

        frag.appendChild(item);
        cursorX += (widthPx / scale) + gapX;
        // rowTall is constant (uniform heights)
        maxRight = Math.max(maxRight, cursorX);
      }
      rowIndex++;
      // move to next row with sufficient space beneath tallest card plus organic gap
      const gapY = (mobile ? 80 : 80) * scale + seededRand(rowIndex, 8 * scale, 40 * scale);
      rowY += rowTall + gapY;
    }

    canvas.appendChild(frag);

    // Size canvas tightly to content so outer margins scale with layout
    canvas.style.width = Math.ceil(maxRight + startXBase) + 'px';
    // Ensure bottom row reaches bottom edge initially
    canvas.style.height = Math.ceil(rowY + startXBase) + 'px';
  }

  function getScale(){
    // Compute a UI scale relative to a 1440x900 design, clamped for comfort
    const sW = window.innerWidth / 1440;
    const sH = window.innerHeight / 900;
    const s = Math.min(sW, sH);
    const min = window.innerWidth <= 768 ? 0.8 : 0.6;
    return Math.max(min, Math.min(1.25, s));
  }

  // Read safe-area insets from CSS env() so we can compute true visible bounds
  function getSafeAreaInset(side){
    try {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
      document.body.appendChild(probe);
      const cs = getComputedStyle(probe);
      const map = {
        top: parseFloat(cs.paddingTop) || 0,
        right: parseFloat(cs.paddingRight) || 0,
        bottom: parseFloat(cs.paddingBottom) || 0,
        left: parseFloat(cs.paddingLeft) || 0
      };
      document.body.removeChild(probe);
      return map[side] || 0;
    } catch { return 0; }
  }

  // Drag with momentum
  container.addEventListener('pointerdown', (e) => {
    // Ignore pointer capture for UI controls so their clicks work (names list, filters, etc.)
    if (e.target.closest('.gg-name-list') || e.target.closest('.gg-filters') || e.target.closest('#gg-contact-float') || e.target.closest('.gg-header')) {
      isDragging = false; pointerDown = false; return;
    }
    // Any pointer drag should exit spotlight mode on mobile
    if (window.innerWidth <= 768) clearSpotlight();
    isDragging = true; container.setPointerCapture?.(e.pointerId);
    startX = e.clientX - translateX; startY = e.clientY - translateY;
    lastT = performance.now(); lastX = e.clientX; lastY = e.clientY;
    pointerDown = true; didDrag = false; downX = e.clientX; downY = e.clientY;
  });
  // Touch: pinch zoom
  container.addEventListener('touchstart', (e)=>{
    if (e.touches.length === 2){
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist = Math.hypot(dx, dy);
      pinchStartScale = currentScale;
    }
}, { passive: true });
  container.addEventListener('touchmove', (e)=>{
    if (e.touches.length === 2 && pinchStartDist){
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchStartDist;
      currentScale = Math.min(1.4, Math.max(0.6, pinchStartScale * ratio));
      applyTransform();
  }
}, { passive: true });
  container.addEventListener('touchend', (e)=>{ if (e.touches.length < 2) pinchStartDist = 0; }, { passive: true });
  container.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    // Add easing to finger follow on mobile to reduce jumpiness
    const followEase = window.innerWidth <= 768 ? 0.2 : 1;
    const targetTX = e.clientX - startX;
    const targetTY = e.clientY - startY;
    translateX += (targetTX - translateX) * followEase;
    translateY += (targetTY - translateY) * followEase;
    const now = performance.now();
    const dt = Math.max(1, now - lastT);
    velocityX = (e.clientX - lastX) / dt * 16;
    velocityY = (e.clientY - lastY) / dt * 16;
    lastT = now; lastX = e.clientX; lastY = e.clientY;
    applyTransform();
    if (pointerDown && !didDrag) {
      const dx = Math.abs(e.clientX - downX);
      const dy = Math.abs(e.clientY - downY);
      if (dx > 6 || dy > 6) { // slightly higher threshold for Chromium precision
        didDrag = true; centeredId = null;
        }
      }
    });
  window.addEventListener('pointerup', () => {
    isDragging = false; pointerDown = false; velocityX = 0; velocityY = 0;
    if (didDrag) {
      suppressClicksUntil = performance.now() + 180; // suppress synthetic click after drag only
      } else {
      suppressClicksUntil = 0;
    }
  });
  // Delegated click handler: works even when Chromium retargets click to container after pointer capture
  container.addEventListener('click', (e)=>{
    if (performance.now() < suppressClicksUntil) { e.preventDefault(); return; }
    let item = e.target.closest?.('.gg-item');
    if (!item) {
      // Chromium retargets click to container after pointer capture; recover item using hit-test
      const hit = (document.elementsFromPoint?.(e.clientX, e.clientY) || [document.elementFromPoint?.(e.clientX, e.clientY)])
        .find(el => el && el.classList && el.classList.contains('gg-item'));
      if (hit) item = hit;
    }
    if (!item || !canvas.contains(item)) return;
    const id = item.dataset.id;
    const c = covers.find(x => String(x.id) === String(id));
    if (!c) return;
    // Special case: Contact cover should open email immediately
    const nm = (c.artistDetails?.name || c.coverLabel || c.albumTitle || '').toLowerCase();
    if (nm.includes('contact')) { e.preventDefault(); window.location.href = 'mailto:hi@allmyfriendsinc.com'; return; }
    if (centeredId === c.id) { e.preventDefault(); openModal(c); }
    else {
      e.preventDefault();
      centeredId = c.id;
      if (window.innerWidth <= 768) {
        // Enter spotlight on mobile when a cover is centered by click
        if (spotlightId && spotlightId !== c.id) clearSpotlight();
        spotlightId = c.id; if (resetChip) resetChip.hidden = false;
        glideTo(c.id, () => { applySpotlightVisuals(); });
      } else {
        glideTo(c.id);
      }
    }
  });
  window.addEventListener('pointercancel', () => { isDragging = false; });

  // Wheel pan
  container.addEventListener('wheel', (e) => {
    // Also allow wheel panning of the grid overlay
    if (!gridEl.classList.contains('hidden')) {
      translateX -= e.deltaX; translateY -= e.deltaY; gridEl.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`; return;
    }
    translateX -= e.deltaX; translateY -= e.deltaY; applyTransform();
}, { passive: true });

  // Re-layout on resize (debounced)
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      layoutItems();
    }, 120);
  });

  function startLoop(){ cancelAnimationFrame(rafId); rafId = requestAnimationFrame(tick); }
  function tick(){
    if (!isDragging) {
      // friction
      velocityX *= 0.92; velocityY *= 0.92;
      translateX += velocityX; translateY += velocityY;
      applyTransform();
    }
    rafId = requestAnimationFrame(tick);
  }

  function applyTransform(){
    canvas.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${currentScale})`;
    overlays.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
  }

  function findItemElById(id){ return canvas.querySelector(`.gg-item[data-id="${CSS.escape(String(id))}"]`); }

  function applySpotlightVisuals(){
    if (!(window.innerWidth <= 768)) return; // mobile-only
    const items = Array.from(canvas.querySelectorAll('.gg-item'));
    items.forEach(el => {
      if (spotlightId && String(el.dataset.id) === String(spotlightId)) {
        el.classList.remove('dimmed');
        gsap.to(el, { duration: 0.4, ease: 'power3.out', scale: 1.25, transformOrigin: 'center center' });
      } else {
        el.classList.add('dimmed');
        gsap.to(el, { duration: 0.3, ease: 'power2.out', scale: 1.0 });
      }
    });
    if (centerLogoFrame) centerLogoFrame.style.opacity = '0.5';
  }

  function clearSpotlight(){
    if (!(window.innerWidth <= 768)) { spotlightId = null; return; }
    const items = Array.from(canvas.querySelectorAll('.gg-item'));
    items.forEach(el => {
      el.classList.remove('dimmed');
      gsap.to(el, { duration: 0.25, ease: 'power2.out', scale: 1.0 });
    });
    spotlightId = null;
    if (resetChip && activeFilter === 'all') resetChip.hidden = true;
    if (centerLogoFrame) centerLogoFrame.style.opacity = '';
  }

  function glideTo(id, onDone){
    const el = findItemElById(id);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewport = container.getBoundingClientRect();
    const targetX = translateX + (viewport.width/2 - (rect.left + rect.width/2));
    const targetY = translateY + (viewport.height/2 - (rect.top + rect.height/2));
    const anim = { x: translateX, y: translateY };
    gsap.to(anim, { duration: 0.8, ease: 'power3.inOut', x: targetX, y: targetY, onUpdate(){ translateX = anim.x; translateY = anim.y; applyTransform(); }, onComplete(){ if (typeof onDone === 'function') onDone(); } });
  }

  // Grid toggle
  viewToggleBtn?.addEventListener('click', () => {
    if (!gridEl) return;
    if (gridEl.classList.contains('hidden')) {
      gridEl.innerHTML = '';
      const firstNine = covers.slice(0, 9);
      firstNine.forEach(c => {
        const div = document.createElement('div');
        div.className = 'gg-grid-item';
        const imgUrl = c.frontImage?.startsWith('/uploads/') ? `https://allmyfriendsinc.com${c.frontImage}` : (c.frontImage || '');
        if (imgUrl) div.style.backgroundImage = `url('${imgUrl}')`;
        // Add title/label overlay to grid items
        const meta = document.createElement('div');
        meta.className = 'grid-meta';
        const t = document.createElement('div'); t.className = 'title'; t.textContent = (c.artistDetails?.name || c.coverLabel || c.albumTitle || '').toUpperCase();
        const s = document.createElement('div'); s.className = 'sub'; const lbl = c.artistDetails?.label || c.label || c.coverLabel || ''; s.textContent = lbl;
        meta.appendChild(t); if (lbl) meta.appendChild(s);
        div.appendChild(meta);
        div.addEventListener('click', ()=>{
          gridEl.classList.add('hidden');
          viewToggleBtn.textContent = 'GRID';
          centeredId = c.id;
          if (window.innerWidth <= 768) {
            if (spotlightId && spotlightId !== c.id) clearSpotlight();
            spotlightId = c.id;
            if (resetChip) resetChip.hidden = false;
            glideTo(c.id, () => { applySpotlightVisuals(); });
          } else {
            glideTo(c.id);
          }
        });
        gridEl.appendChild(div);
      });
      gridEl.classList.remove('hidden');
      viewToggleBtn.textContent = 'ORIGINAL VIEW';
      // Reset grid transform so it’s fully visible, smaller tiles leave breathing room
      translateX = 0; translateY = 0; gridEl.style.transform = 'translate3d(0,0,0)';
      } else {
      gridEl.classList.add('hidden');
      viewToggleBtn.textContent = 'GRID';
    }
  });

  function openModal(cover){
    const content = modal.querySelector('.modal-content');
    const banner = cover.frontImage || cover.artistDetails?.image || '';
    const name = cover.artistDetails?.name || cover.albumTitle || 'Artist';
    const roleText = (()=>{
      const roles = (cover?.artistDetails?.roles || cover?.artistDetails?.role || cover?.category || []).toString();
      if (!roles) return '';
      return roles;
    })();
    const labelText = cover?.artistDetails?.label || cover?.label || cover?.coverLabel || '';
    const keyForSpotify = (cover.artistDetails?.name || cover.albumTitle || '').toLowerCase().trim();
    const spotify = CANON_SPOTIFY[keyForSpotify] || cover.artistDetails?.spotifyLink || cover.music?.url || '';
    const spotifyEmbed = spotify ? spotify.replace('open.spotify.com/', 'open.spotify.com/embed/') : '';
    const safeSpotify = spotifyEmbed.includes('open.spotify.com/embed/') ? spotifyEmbed : '';

    content.innerHTML = `
      <button class="modal-close" aria-label="Close">×</button>
      <div class="modal-artist-header">
        <div class="modal-artist-image">
          ${banner ? `<img src="${banner}" alt="${name}">` : ''}
        </div>
        <div class="modal-artist-info">
          <h2>${name}</h2>
          ${roleText ? `<div class="modal-artist-role">${roleText}</div>` : ''}
          ${labelText ? `<div class=\"modal-artist-label\">${labelText}</div>` : ''}
          ${buildSocialLinksLegacy(cover)}
        </div>
      </div>
      <div class="modal-artist-bio">
        ${(() => {
          const isAbout = /about/i.test(name);
          const bio = isAbout ? ABOUT_TEXT : (cover.artistDetails?.bio || '');
          const short = (window.innerWidth <= 768 && bio && bio.length > 600) ? bio.slice(0, 600) + '…' : bio;
          return short ? `<p class=\"artist-bio\">${short}</p>` : '';
        })()}
      </div>
      ${safeSpotify ? `<div class=\"modal-music-section\"><h3 class=\"modal-section-title\">Music</h3><iframe style=\"border-radius: 12px\" src=\"${safeSpotify}\" width=\"100%\" height=\"520\" allow=\"encrypted-media\" allowfullscreen frameborder=\"0\" loading=\"lazy\"></iframe></div>` : ''}
    `;
  modal.classList.remove('hidden');
  modal.classList.add('show');
    const closeBtn = content.querySelector('.modal-close');
    closeBtn?.addEventListener('click', ()=> closeModal());
    modal.onclick = (e)=>{ if(e.target===modal) closeModal(); };
    const esc = (e)=>{ if(e.key==='Escape'){ closeModal(); window.removeEventListener('keydown', esc);} };
    window.addEventListener('keydown', esc);
  }

  function buildSocialLinksLegacy(cover){
    const links = [];
    const key = (cover.artistDetails?.name || cover.albumTitle || '').toLowerCase().trim();
    const canon = CANON_SOCIALS[key] || {};
    const ig = canon.instagram || cover.artistDetails?.instagram || cover.artistDetails?.ig || null;
    const tiktok = canon.tiktok || cover.artistDetails?.tiktok || null;
    const spotify = cover.artistDetails?.spotifyLink || cover.music?.url || null;
    const ICON_IG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#ffffff" d="M 21.580078 7 C 13.541078 7 7 13.544938 7 21.585938 L 7 42.417969 C 7 50.457969 13.544938 57 21.585938 57 L 42.417969 57 C 50.457969 57 57 50.455062 57 42.414062 L 57 21.580078 C 57 13.541078 50.455062 7 42.414062 7 L 21.580078 7 z M 47 15 C 48.104 15 49 15.896 49 17 C 49 18.104 48.104 19 47 19 C 45.896 19 45 18.104 45 17 C 45 15.896 45.896 15 47 15 z M 32 19 C 39.17 19 45 24.83 45 32 C 45 39.17 39.169 45 32 45 C 24.83 45 19 39.169 19 32 C 19 24.831 24.83 19 32 19 z M 32 23 C 27.029 23 23 27.029 23 32 C 23 36.971 27.029 41 32 41 C 36.971 41 41 36.971 41 32 C 41 27.029 36.971 23 32 23 z"/></svg>';
    const ICON_TT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><g fill="#ffffff"><path d="M41,4h-32c-2.757,0 -5,2.243 -5,5v32c0,2.757 2.243,5 5,5h32c2.757,0 5,-2.243 5,-5v-32c0,-2.757 -2.243,-5 -5,-5zM37.006,22.323c-0.227,0.021 -0.457,0.035 -0.69,0.035c-2.623,0 -4.928,-1.349 -6.269,-3.388c0,5.349 0,11.435 0,11.537c0,4.709 -3.818,8.527 -8.527,8.527c-4.709,0 -8.527,-3.818 -8.527,-8.527c0,-4.709 3.818,-8.527 8.527,-8.527c0.178,0 0.352,0.016 0.527,0.027v4.202c-0.175,-0.021 -0.347,-0.053 -0.527,-0.053c-2.404,0 -4.352,1.948 -4.352,4.352c0,2.404 1.948,4.352 4.352,4.352c2.404,0 4.527,-1.894 4.527,-4.298c0,-0.095 0.042,-19.594 0.042,-19.594h4.016c0.378,3.591 3.277,6.425 6.901,6.685z"/></g></svg>';
    const ICON_SP = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><g fill="#ffffff"><path d="M25.009,1.982c-12.687,0 -23.009,10.322 -23.009,23.009c0,12.687 10.322,23.009 23.009,23.009c12.687,0 23.009,-10.321 23.009,-23.009c0,-12.688 -10.322,-23.009 -23.009,-23.009zM34.748,35.333c-0.289,0.434 -0.765,0.668 -1.25,0.668c-0.286,0 -0.575,-0.081 -0.831,-0.252c-2.473,-1.649 -6.667,-2.749 -10.167,-2.748c-3.714,0.002 -6.498,0.914 -6.526,0.923c-0.784,0.266 -1.635,-0.162 -1.897,-0.948c-0.262,-0.786 0.163,-1.636 0.949,-1.897c0.132,-0.044 3.279,-1.075 7.474,-1.077c3.5,-0.002 8.368,0.942 11.832,3.251c0.69,0.46 0.876,1.391 0.416,2.08zM37.74,29.193c-0.325,0.522 -0.886,0.809 -1.459,0.809c-0.31,0 -0.624,-0.083 -0.906,-0.26c-4.484,-2.794 -9.092,-3.385 -13.062,-3.35c-4.482,0.04 -8.066,0.895 -8.127,0.913c-0.907,0.258 -1.861,-0.272 -2.12,-1.183c-0.259,-0.913 0.272,-1.862 1.184,-2.12c0.277,-0.079 3.854,-0.959 8.751,-1c4.465,-0.037 10.029,0.61 15.191,3.826c0.803,0.5 1.05,1.56 0.548,2.365zM40.725,22.013c-0.373,0.634 -1.041,0.987 -1.727,0.987c-0.344,0 -0.692,-0.089 -1.011,-0.275c-5.226,-3.068 -11.58,-3.719 -15.99,-3.725c-0.021,0 -0.042,0 -0.063,0c-5.333,0 -9.44,0.938 -9.481,0.948c-1.078,0.247 -2.151,-0.419 -2.401,-1.495c-0.25,-1.075 0.417,-2.149 1.492,-2.4c0.185,-0.043 4.573,-1.053 10.39,-1.053c0.023,0 0.046,0 0.069,0c4.905,0.007 12.011,0.753 18.01,4.275c0.952,0.56 1.271,1.786 0.712,2.738z"/></g></svg>';
    if (ig) links.push({ href: ig, aria: 'Instagram', svg: ICON_IG, cls: 'social-ig' });
    if (tiktok) links.push({ href: tiktok, aria: 'TikTok', svg: ICON_TT, cls: 'social-tt' });
    if (spotify) links.push({ href: spotify, aria: 'Spotify', svg: ICON_SP, cls: 'social-sp' });
    if (!links.length) return '';
    return `<div class=\"social-links\">${links.map(l=>`<a class=\"social-link ${l.cls||''}\" target=\"_blank\" rel=\"noopener\" aria-label=\"${l.aria}\" href=\"${l.href}\"></a>`).join('')}</div>`;
  }
  function closeModal(){ modal.classList.remove('show'); setTimeout(()=> modal.classList.add('hidden'), 240); }

  function buildEditorialOverlays(){
    // Deprecated: remove legacy canvas-anchored overlay so it doesn't stick to any cover
    if (!overlays) return;
    overlays.innerHTML = '';
  }
})();

/* orphaned duplicate from earlier merges removed below (kept for reference)
      firstNine.forEach(c => {
        const div = document.createElement('div');
        div.className = 'gg-grid-item';
        const imgUrl = c.frontImage?.startsWith('/uploads/') ? `https://allmyfriendsinc.com${c.frontImage}` : (c.frontImage || '');
        if (imgUrl) div.style.backgroundImage = `url('${imgUrl}')`;
        div.addEventListener('click', ()=>{ gridEl.classList.add('hidden'); viewToggleBtn.textContent = 'GRID'; glideTo(c.id); });
        gridEl.appendChild(div);
      });
      gridEl.classList.remove('hidden');
      viewToggleBtn.textContent = 'ORIGINAL VIEW';
      // Reset grid transform so it’s fully visible, smaller tiles leave breathing room
      translateX = 0; translateY = 0; gridEl.style.transform = 'translate3d(0,0,0)';
      } else {
      gridEl.classList.add('hidden');
      viewToggleBtn.textContent = 'GRID';
    }
  });

  function openModal(cover){
    const content = modal.querySelector('.modal-content');
    const banner = cover.frontImage || cover.artistDetails?.image || '';
    const name = cover.artistDetails?.name || cover.albumTitle || 'Artist';
    const roleText = (()=>{
      const roles = (cover?.artistDetails?.roles || cover?.artistDetails?.role || cover?.category || []).toString();
      if (!roles) return '';
      return roles;
    })();
    const keyForSpotify = (cover.artistDetails?.name || cover.albumTitle || '').toLowerCase().trim();
    const spotify = CANON_SPOTIFY[keyForSpotify] || cover.artistDetails?.spotifyLink || cover.music?.url || '';
    const spotifyEmbed = spotify ? spotify.replace('open.spotify.com/', 'open.spotify.com/embed/') : '';
    const safeSpotify = spotifyEmbed.includes('open.spotify.com/embed/') ? spotifyEmbed : '';

    content.innerHTML = `
      <button class="modal-close" aria-label="Close">×</button>
      <div class="modal-artist-header">
        <div class="modal-artist-image">
          ${banner ? `<img src="${banner}" alt="${name}">` : ''}
        </div>
        <div class="modal-artist-info">
          <h2>${name}</h2>
          ${roleText ? `<div class="modal-artist-role">${roleText}</div>` : ''}
          ${(() => {
            const isAbout = /about/i.test(name);
            const bio = isAbout ? ABOUT_TEXT : (cover.artistDetails?.bio || '');
            return bio ? `<p class=\"artist-bio\">${bio}</p>` : '';
          })()}
          ${buildSocialLinks(cover)}
        </div>
      </div>
      ${safeSpotify ? `<div class=\"modal-music-section\"><h3 class=\"modal-section-title\">Music</h3><iframe style=\"border-radius: 12px\" src=\"${safeSpotify}\" width=\"100%\" height=\"460\" allow=\"encrypted-media\" allowfullscreen frameborder=\"0\" loading=\"lazy\"></iframe></div>` : ''}
    `;
    modal.classList.remove('hidden');
    modal.classList.add('show');
    const closeBtn = content.querySelector('.modal-close');
    closeBtn?.addEventListener('click', ()=> closeModal());
    modal.onclick = (e)=>{ if(e.target===modal) closeModal(); };
    const esc = (e)=>{ if(e.key==='Escape'){ closeModal(); window.removeEventListener('keydown', esc);} };
    window.addEventListener('keydown', esc);
  }

  function buildSocialLinks(cover){
    const links = [];
    const key = (cover.artistDetails?.name || cover.albumTitle || '').toLowerCase().trim();
    const canon = CANON_SOCIALS[key] || {};
    const ig = canon.instagram || cover.artistDetails?.instagram || cover.artistDetails?.ig || null;
    const tiktok = canon.tiktok || cover.artistDetails?.tiktok || null;
    const spotify = cover.artistDetails?.spotifyLink || cover.music?.url || null;
    if (ig) links.push({ href: ig, aria: 'Instagram', cls: 'social-ig' });
    if (tiktok) links.push({ href: tiktok, aria: 'TikTok', cls: 'social-tt' });
    if (spotify) links.push({ href: spotify, aria: 'Spotify', cls: 'social-sp' });
    if (!links.length) return '';
    return `<div class="social-links">${links.map(l=>`<a class="social-link ${l.cls}" target="_blank" rel="noopener" aria-label="${l.aria}" href="${l.href}"></a>`).join('')}</div>`;
  }
  function closeModal(){ modal.classList.remove('show'); setTimeout(()=> modal.classList.add('hidden'), 240); }

  function buildEditorialOverlays(){
    if (!overlays) return;
    overlays.innerHTML = '';
    const blocks = [
      { x: 1480, y: 40, title: '+Get In Touch', lines: ['hi@allmyfriendsinc.com'] }
    ];
    const frag = document.createDocumentFragment();
    blocks.forEach(b => {
      const el = document.createElement('section');
      el.className = 'gg-block';
      el.style.left = b.x + 'px';
      el.style.top = b.y + 'px';
      const h = document.createElement('h4');
      h.textContent = b.title; el.appendChild(h);
      b.lines.forEach(t => { const p = document.createElement('p'); p.textContent = t; el.appendChild(p); });
      frag.appendChild(el);
    });
    overlays.appendChild(frag);
  }
*/



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
  let currentScale = 0.55; // Midpoint between 0.6 and earlier zoom-out
  let pinchStartDist = 0;
  let pinchStartScale = 1;
  let activeFilter = 'all';

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
    const rolesRaw = (cover?.artistDetails?.roles || cover?.artistDetails?.role || '').toString().toLowerCase();
    // Simple contains check for any acceptable token
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
        const biasX = isMobile ? -(containerRect.width * 0.28) : (containerRect.width * 0.06);
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
    aboutBtn.textContent = 'About Us.';
    aboutBtn.addEventListener('click', () => { 
      // Open updated about modal instead of navigating
      const modal = document.createElement('div');
      modal.className = 'artist-modal show';
      modal.innerHTML = `
        <div class="modal-content">
          <h2 style="font-size: 28px; margin-bottom: 16px;">About All My Friends</h2>
          <p style="line-height: 1.6;">All My Friends is an artist-first management team rooted in creative development. We work with artists, writers, and producers to build and back work that resonates—culturally, emotionally, and with the kind of clarity and depth that holds up over time. We’re grounded in a tight-knit approach—staying hands-on, taste-led, and guided by instinct. We work with good people who make things that matter.</p>
        </div>
      `;
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
      document.body.appendChild(modal);
    });
    frag.appendChild(aboutBtn);

    const contactBtn = document.createElement('button');
    contactBtn.textContent = 'contact';
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
    const reserved = new Set(['about us.', 'about us', 'contact']);
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
        .map(c => ({ id: c.id, name: (c.artistDetails?.name || c.coverLabel || c.albumTitle || 'Untitled'), label: (c.artistDetails?.label || '') }))
        .filter(item => !reserved.has((item.name || '').toLowerCase().trim()))
        .sort((a,b)=>a.name.localeCompare(b.name))
        .forEach(item => {
          const a = document.createElement('a');
          a.className = 'name';
          const title = document.createElement('span');
          title.className = 'title';
          title.textContent = item.name;
          a.appendChild(title);
          if (item.label) {
            const sub = document.createElement('span');
            sub.className = 'label';
            sub.textContent = item.label;
            a.appendChild(sub);
          }
          a.href = '#';
          a.addEventListener('click', (e)=>{ e.preventDefault(); glideTo(item.id); centeredId = item.id; });
          listFrag.appendChild(a);
        });
      nameList.appendChild(listFrag);
    }
  }

  function applyFilter(key){
    activeFilter = (key || 'all').toLowerCase();
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
        return;
      }
      
    // Compute a centered row position in CANVAS coordinates
    const viewport = container.getBoundingClientRect();
    const scale = currentScale; // use current transform scale
    const canvasCenterX = (-translateX + viewport.width / 2) / scale;
    const canvasCenterY = (-translateY + viewport.height / 2) / scale;

    // Collect matching items
    const items = Array.from(canvas.querySelectorAll('.gg-item'));
    const matches = items.filter(it => {
      const id = it.dataset.id;
      const c = covers.find(x => String(x.id) === String(id));
      const keyNorm = activeFilter.replace(/s$/, '');
      return matchesRole(c, keyNorm);
    });

    if (matches.length === 0) return; // nothing to arrange

    const gutter = 40 * getScale();
    // total width in canvas units
    let totalWidth = 0;
    const widths = matches.map(el => el.getBoundingClientRect().width / scale);
    widths.forEach((w, idx) => { totalWidth += w + (idx > 0 ? gutter : 0); });
    let cursorX = canvasCenterX - totalWidth / 2;
    const targetY = canvasCenterY - (matches[0].getBoundingClientRect().height / scale) / 2;

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
        const label = c.artistDetails?.label || c.label || '';
        sub.textContent = label ? label.toUpperCase() : '';
        meta.appendChild(title);
        if (label) meta.appendChild(sub);
        item.appendChild(meta);

        item.addEventListener('click', (ev) => {
          // If a drag was detected between pointerdown and pointerup, treat as navigation only
          if (didDrag) return;
          if (centeredId === c.id) {
            openModal(c);
          } else {
            centeredId = c.id;
            glideTo(c.id);
          }
        });

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

  // Drag with momentum
  container.addEventListener('pointerdown', (e) => {
    isDragging = true; container.setPointerCapture(e.pointerId);
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
      if (dx > 4 || dy > 4) {
        didDrag = true; centeredId = null;
      }
    }
  });
  window.addEventListener('pointerup', () => { isDragging = false; pointerDown = false; velocityX = 0; velocityY = 0; });
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

  function glideTo(id){
    const el = findItemElById(id);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewport = container.getBoundingClientRect();
    const targetX = translateX + (viewport.width/2 - (rect.left + rect.width/2));
    const targetY = translateY + (viewport.height/2 - (rect.top + rect.height/2));
    const anim = { x: translateX, y: translateY };
    gsap.to(anim, { duration: 0.8, ease: 'power3.inOut', x: targetX, y: targetY, onUpdate(){ translateX = anim.x; translateY = anim.y; applyTransform(); } });
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
    const spotify = cover.artistDetails?.spotifyLink || cover.music?.url || '';
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
          ${cover.artistDetails?.bio ? `<p class="artist-bio">${cover.artistDetails.bio}</p>` : ''}
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
    const ig = cover.artistDetails?.instagram || cover.artistDetails?.ig || null;
    const tiktok = cover.artistDetails?.tiktok || null;
    const spotify = cover.artistDetails?.spotifyLink || cover.music?.url || null;
    if (ig) links.push({ href: ig, label: 'Instagram', icon: '📸' });
    if (tiktok) links.push({ href: tiktok, label: 'TikTok', icon: '🎵' });
    if (spotify) links.push({ href: spotify, label: 'Spotify', icon: '▶︎' });
    if (!links.length) return '';
    return `<div class="social-links">${links.map(l=>`<a class="social-link" target="_blank" rel="noopener" href="${l.href}"><span>${l.icon}</span>${l.label}</a>`).join('')}</div>`;
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
})();



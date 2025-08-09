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
  let currentScale = 0.6; // Start zoomed out to max
  let pinchStartDist = 0;
  let pinchStartScale = 1;

  // Load fonts/styles from styles.json (light touch)
  fetch('/data/styles.json').then(r=>r.json()).then(style=>{
    document.getElementById('global-styles').innerHTML = `body{font-family:'${style.fontFamily||'Inter'}',sans-serif;}`;
  }).catch(()=>{});

  // Load covers
  fetch(`/data/covers.json?cb=${Date.now()}`)
    .then(r=>r.json())
    .then(data => { covers = data; buildNames(); layoutItems(); buildEditorialOverlays(); startLoop(); })
    .catch(err => console.error('Failed to load covers', err));

  function buildNames(){
    namesEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    // Static: About Us and contact first
    const aboutBtn = document.createElement('button');
    aboutBtn.textContent = 'About Us.';
    aboutBtn.addEventListener('click', () => { window.location.href = '/AMF_Overview.html'; });
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
      covers
        .map(c => ({ id: c.id, name: (c.artistDetails?.name || c.coverLabel || c.albumTitle || 'Untitled').toUpperCase() }))
        .filter(item => item.name !== 'ABOUT US.' && item.name !== 'CONTACT')
        .sort((a,b)=>a.name.localeCompare(b.name))
        .forEach(item => {
          const a = document.createElement('a');
          a.className = 'name';
          a.textContent = item.name;
          a.href = '#';
          a.addEventListener('click', (e)=>{ e.preventDefault(); glideTo(item.id); centeredId = item.id; });
          listFrag.appendChild(a);
        });
      nameList.appendChild(listFrag);
    }
  }

  function applyFilter(key){
    activeFilter = key || 'all';
    if (resetChip) resetChip.hidden = activeFilter === 'all';
    if (activeFilter === 'all') { layoutItems(); return; }
    // Dim non-matching and center matching in a row
    layoutItems(); // render current state first (adds dimming in layout)
    const scale = getScale();
    const viewport = container.getBoundingClientRect();
    const centerY = (viewport.height * 0.5) - (220 * scale)/2;
    const roleKey = activeFilter.slice(0, -1);
    const matches = [];
    const items = Array.from(canvas.querySelectorAll('.gg-item'));
    items.forEach(it => {
      const id = it.dataset.id;
      const c = covers.find(x=>String(x.id)===String(id));
      const roles = (c?.artistDetails?.roles || c?.artistDetails?.role || '').toString().toLowerCase();
      if (roles.includes(roleKey)) matches.push(it);
    });
    let totalW = 0; const gutter = 40 * scale;
    matches.forEach((el, idx)=>{ const w = el.getBoundingClientRect().width; totalW += w + (idx>0?gutter:0); });
    const startX = (viewport.width - totalW)/2;
    let xCursor = startX;
    // Adjust translateX/Y so that first match moves to startX, centerY; others follow by keeping same transform
    if (matches.length){
      const first = matches[0];
      const rect = first.getBoundingClientRect();
      const targetX = translateX + (xCursor - rect.left);
      const targetY = translateY + (centerY - rect.top);
      const anim = { x: translateX, y: translateY };
      gsap.to(anim, { duration: 0.6, ease: 'power3.inOut', x: targetX, y: targetY,
        onUpdate(){ translateX = anim.x; translateY = anim.y; applyTransform(); },
        onComplete(){
          // Snap X so others visually line up; no need to animate each
          xCursor += rect.width + gutter;
        }
      });
    }
  }

  // ESC to reset filter
  window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') { activeFilter = 'all'; if(resetChip) resetChip.hidden = true; layoutItems(); } });
  if (resetChip) resetChip.addEventListener('click', ()=>{ activeFilter = 'all'; resetChip.hidden = true; layoutItems(); });

  function layoutItems(){
    canvas.innerHTML = '';
    const frag = document.createDocumentFragment();

    const scale = getScale();

    // Width/height recipes per row (no absolute deltas)
    const mobile = window.innerWidth <= 768;
    const rowPatterns = mobile
      ? [
          [ { w: 420, h: 280 }, { w: 380, h: 260 }, { w: 420, h: 280 } ],
          [ { w: 440, h: 300 }, { w: 400, h: 280 } ],
          [ { w: 420, h: 280 }, { w: 380, h: 260 }, { w: 420, h: 280 } ]
        ]
      : [
          [ { w: 640, h: 420 }, { w: 520, h: 360 }, { w: 700, h: 440 } ],
          [ { w: 560, h: 380 }, { w: 740, h: 460 } ],
          [ { w: 720, h: 460 }, { w: 520, h: 360 }, { w: 480, h: 340 }, { w: 620, h: 420 } ]
        ];

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
      // compute tallest in row to prevent vertical overlap
      const rowTall = Math.max(...pattern.map(p => p.h)) * scale;
      let cursorX = startXBase + (rowIndex % 2 === 1 ? 140 * scale : 0);

      for (let k = 0; k < pattern.length && i < covers.length; k++, i++) {
        const c = covers[i];
        const recipe = pattern[k];
        const jitterY = seededRand(i, -12, 12) * scale;      // small vertical wiggle without overlap
        const gapX = (120 * scale) + seededRand(i * 3, 20 * scale, 100 * scale); // variable horizontal gutter

        const x = cursorX;
        const y = rowY + jitterY;

        const item = document.createElement('div');
        item.className = 'gg-item';
        item.style.setProperty('--w', (recipe.w * scale) + 'px');
        item.style.setProperty('--h', (recipe.h * scale) + 'px');
        item.style.left = x + 'px';
        item.style.top = y + 'px';
        item.dataset.id = c.id;

        const imgUrl = c.frontImage?.startsWith('/uploads/') ? `https://allmyfriendsinc.com${c.frontImage}` : (c.frontImage || '');
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

        frag.appendChild(item);
        cursorX += recipe.w + gapX;
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
    content.innerHTML = `
      ${banner ? `<img class="artist-photo" src="${banner}" alt="${cover.artistDetails?.name||''}"/>` : ''}
      <div class="artist-info">
        <h2 class="artist-name">${cover.artistDetails?.name || cover.albumTitle || 'Artist'}</h2>
        ${cover.artistDetails?.location ? `<p class="artist-location">${cover.artistDetails.location}</p>` : ''}
        ${cover.artistDetails?.bio ? `<p class="artist-bio">${cover.artistDetails.bio}</p>` : ''}
        ${cover.artistDetails?.spotifyLink ? `<a href="${cover.artistDetails.spotifyLink}" target="_blank" class="spotify-button">Listen on Spotify</a>` : ''}
      </div>`;
    modal.classList.remove('hidden');
    modal.classList.add('show');
    modal.onclick = (e)=>{ if(e.target===modal) closeModal(); };
    const esc = (e)=>{ if(e.key==='Escape'){ closeModal(); window.removeEventListener('keydown', esc);} };
    window.addEventListener('keydown', esc);
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



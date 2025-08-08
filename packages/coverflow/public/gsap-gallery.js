(function(){
  const namesEl = document.getElementById('gg-names');
  const container = document.getElementById('gg-container');
  const canvas = document.getElementById('gg-canvas');
  const modal = document.getElementById('gg-modal');
  const overviewBtn = document.getElementById('gg-overview');
  const overlays = document.getElementById('gg-overlays');

  let covers = [];
  let isDragging = false;
  let startX = 0, startY = 0;
  let translateX = 0, translateY = 0;
  let velocityX = 0, velocityY = 0;
  let lastT = 0, lastX = 0, lastY = 0;
  let rafId = 0;
  let expandedId = null;

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
    covers.map(c => ({ id: c.id, name: c.artistDetails?.name || c.coverLabel || c.albumTitle || 'Untitled' }))
      .sort((a,b)=>a.name.localeCompare(b.name))
      .forEach(item => {
        const btn = document.createElement('button');
        btn.textContent = item.name;
        btn.addEventListener('click', () => glideTo(item.id));
        frag.appendChild(btn);
      });
    namesEl.appendChild(frag);
  }

  function layoutItems(){
    canvas.innerHTML = '';
    const frag = document.createDocumentFragment();

    // Width/height recipes per row (no absolute deltas)
    const rowPatterns = [
      [ { w: 640, h: 420 }, { w: 520, h: 360 }, { w: 700, h: 440 } ],
      [ { w: 560, h: 380 }, { w: 740, h: 460 } ],
      [ { w: 720, h: 460 }, { w: 520, h: 360 }, { w: 480, h: 340 }, { w: 620, h: 420 } ]
    ];

    const startXBase = 80; // left margin
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
      const rowTall = Math.max(...pattern.map(p => p.h));
      let cursorX = startXBase + (rowIndex % 2 === 1 ? 140 : 0);

      for (let k = 0; k < pattern.length && i < covers.length; k++, i++) {
        const c = covers[i];
        const recipe = pattern[k];
        const jitterY = seededRand(i, -12, 12);      // small vertical wiggle without overlap
        const gapX = 120 + seededRand(i * 3, 20, 100); // variable horizontal gutter

        const x = cursorX;
        const y = rowY + jitterY;

        const item = document.createElement('div');
        item.className = 'gg-item';
        item.style.setProperty('--w', recipe.w + 'px');
        item.style.setProperty('--h', recipe.h + 'px');
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

        let clickedOnce = false;
        let clickTimer = null;
        item.addEventListener('click', () => {
          if (!clickedOnce) {
            clickedOnce = true;
            item.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(0.22,1,0.36,1)' });
            clearTimeout(clickTimer);
            clickTimer = setTimeout(() => { clickedOnce = false; }, 450);
          } else {
            clickedOnce = false;
            openModal(c);
          }
        });

        frag.appendChild(item);
        cursorX += recipe.w + gapX;
        maxRight = Math.max(maxRight, cursorX);
      }
      rowIndex++;
      // move to next row with sufficient space beneath tallest card plus organic gap
      const gapY = 80 + seededRand(rowIndex, 10, 60);
      rowY += rowTall + gapY;
    }

    canvas.appendChild(frag);

    canvas.style.width = Math.max(3200, maxRight + 800) + 'px';
    // Ensure bottom row reaches bottom edge initially
    canvas.style.height = Math.max(1600, rowY + 0) + 'px';
  }

  // Drag with momentum
  container.addEventListener('pointerdown', (e) => {
    isDragging = true; container.setPointerCapture(e.pointerId);
    startX = e.clientX - translateX; startY = e.clientY - translateY;
    lastT = performance.now(); lastX = e.clientX; lastY = e.clientY;
  });
  container.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    translateX = e.clientX - startX; translateY = e.clientY - startY;
    const now = performance.now();
    const dt = Math.max(1, now - lastT);
    velocityX = (e.clientX - lastX) / dt * 16;
    velocityY = (e.clientY - lastY) / dt * 16;
    lastT = now; lastX = e.clientX; lastY = e.clientY;
    applyTransform();
  });
  window.addEventListener('pointerup', () => { isDragging = false; });
  window.addEventListener('pointercancel', () => { isDragging = false; });

  // Wheel pan
  container.addEventListener('wheel', (e) => {
    translateX -= e.deltaX; translateY -= e.deltaY; applyTransform();
  }, { passive: true });

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
    canvas.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
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

  overviewBtn?.addEventListener('click', () => {
    gsap.to(canvas, { duration: 0.6, ease: 'power2.out', scale: 0.9, transformOrigin: '50% 50%' });
    setTimeout(()=> gsap.to(canvas, { duration: 0.6, ease: 'power2.out', scale: 1 }), 600);
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



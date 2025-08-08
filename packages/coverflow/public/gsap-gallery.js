(function(){
  const namesEl = document.getElementById('gg-names');
  const container = document.getElementById('gg-container');
  const canvas = document.getElementById('gg-canvas');
  const modal = document.getElementById('gg-modal');
  const overviewBtn = document.getElementById('gg-overview');

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
    .then(data => { covers = data; buildNames(); layoutItems(); startLoop(); })
    .catch(err => console.error('Failed to load covers', err));

  function buildNames(){
    namesEl.innerHTML = '';
    const frag = document.createDocumentFragment();
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
    const cols = 8; // wide grid; we scroll to explore
    const gap = 40;
    const base = 220;
    const frag = document.createDocumentFragment();
    covers.forEach((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (base + gap);
      const y = row * (base + gap);
      const size = base;

      const item = document.createElement('div');
      item.className = 'gg-item';
      item.style.setProperty('--size', size + 'px');
      item.style.left = x + 'px';
      item.style.top = y + 'px';
      item.dataset.id = c.id;

      const imgUrl = c.frontImage?.startsWith('/uploads/') ? `https://allmyfriendsinc.com${c.frontImage}` : (c.frontImage || '');
      const img = document.createElement('div');
      img.className = 'img';
      if (imgUrl) img.style.backgroundImage = `url('${imgUrl}')`;
      item.appendChild(img);

      const caption = document.createElement('div');
      caption.className = 'caption';
      caption.textContent = c.artistDetails?.name || c.coverLabel || c.albumTitle || '';
      item.appendChild(caption);

      let clickedOnce = false;
      let clickTimer = null;
      item.addEventListener('click', () => {
        if (!clickedOnce) {
          clickedOnce = true;
          item.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(0.22,1,0.36,1)' });
          clearTimeout(clickTimer);
          clickTimer = setTimeout(() => { clickedOnce = false; }, 500);
        } else {
          clickedOnce = false;
          openModal(c);
        }
      });

      frag.appendChild(item);
    });

    canvas.appendChild(frag);

    // Expand canvas virtual size
    const totalRows = Math.ceil(covers.length / cols);
    canvas.style.width = cols * (base + gap) + 'px';
    canvas.style.height = totalRows * (base + gap) + 'px';
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
})();



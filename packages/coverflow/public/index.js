// == index.js ==

// 1) Globals
let allCovers = [], covers = [], activeIndex = 0;
let coverSpacing, anglePerOffset, minScale;
const maxAngle = 80,
      isMobile = window.matchMedia('(max-width:768px)').matches;
const coverflowEl   = document.getElementById('coverflow'),
      hoverDisplay  = document.getElementById('hover-credits');

// 2) Trails
const trailCanvas = document.getElementById('trail-canvas'),
      trailCtx    = trailCanvas.getContext('2d');
let particles = [];
function resizeTrailCanvas() {
  trailCanvas.width  = coverflowEl.clientWidth;
  trailCanvas.height = coverflowEl.clientHeight;
}
window.addEventListener('resize', resizeTrailCanvas, { passive: true });
resizeTrailCanvas();

function emitParticles(delta) {
  const count = Math.min(Math.abs(delta) / 5, 10);
  for (let i = 0; i < count; i++) {
    particles.push({
      x: trailCanvas.width / 2,
      y: trailCanvas.height / 2,
      vx: delta * (Math.random() * 0.2 + 0.1),
      vy: (Math.random() - 0.5) * 2,
      life: 60
    });
  }
}

function animateTrails() {
  trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
  particles.forEach((p, i) => {
    trailCtx.globalAlpha = p.life / 60;
    trailCtx.beginPath();
    trailCtx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    trailCtx.fill();
    p.x += p.vx; p.y += p.vy; p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  });
  requestAnimationFrame(animateTrails);
}
animateTrails();

// 3) Ambient glow
function updateAmbient() {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = covers[activeIndex]?.frontImage;
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 10;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0, 10, 10);
    const [r, g, b] = cx.getImageData(0, 0, 10, 10).data;
    document.getElementById('ambient-light')
      .style.backgroundColor = `rgba(${r},${g},${b},0.4)`;
  };
}

// 4) Horizontal swipe/wheel only
let wheelCooldown = false,
    touchStartX   = 0;

coverflowEl.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
coverflowEl.addEventListener('touchstart', e => { touchStartX = e.touches[0].screenX; }, { passive: true });
coverflowEl.addEventListener('touchend', e => {
  const diff = e.changedTouches[0].screenX - touchStartX;
  if (Math.abs(diff) > 60) setActiveIndex(activeIndex + (diff < 0 ? 1 : -1));
}, { passive: true });

window.addEventListener('wheel', e => {
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
  e.preventDefault();
  if (!wheelCooldown) {
    emitParticles(e.deltaX);
    setActiveIndex(activeIndex + (e.deltaX > 0 ? 1 : -1));
    wheelCooldown = true;
    setTimeout(() => wheelCooldown = false, 120);
  }
}, { passive: false });

// 5) Fetch styles & covers
fetch('/data/styles.json')
  .then(r => r.json())
  .then(style => {
    document.getElementById('global-styles').innerHTML = `
      html,body {
        font-family:'${style.fontFamily||'GT America'}',sans-serif;
        font-size:${style.fontSize||16}px;
      }
    `;
  })
  .catch(() => {
    // Fallback if styles.json is not found
    console.log('Using default styles');
  });

// 12) Filter dropdown (hover & click)
const filterButtons   = Array.from(document.querySelectorAll('.filter-label')),
      filterDropdown  = document.createElement('div');
filterDropdown.className = 'filter-dropdown';
document.body.appendChild(filterDropdown);

// Update filter counts
function updateFilterCounts() {
  const counts = {
    all: allCovers.length,
    artist: allCovers.filter(c => c.category?.includes('artist')).length,
    songwriter: allCovers.filter(c => c.category?.includes('songwriter')).length,
    producer: allCovers.filter(c => c.category?.includes('producer')).length
  };
  
  Object.entries(counts).forEach(([filter, count]) => {
    const countEl = document.querySelector(`[data-count="${filter}"]`);
    if (countEl) countEl.textContent = count;
  });
}

// Add mouse tracking for gradient effect
const filterContainer = document.querySelector('.filter-container');
filterContainer.addEventListener('mousemove', (e) => {
  const rect = filterContainer.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  filterContainer.style.setProperty('--mouse-x', `${x}%`);
  filterContainer.style.setProperty('--mouse-y', `${y}%`);
});

filterButtons.forEach(btn => {
  btn.addEventListener('mouseenter', () => {
    const f = btn.dataset.filter;
    const res = allCovers.filter(c => f === 'all' || c.category?.includes(f));
    filterDropdown.innerHTML = res.map(c =>
      `<div class="dropdown-item" data-id="${c.id}">${c.albumTitle||'Untitled'} — ${c.coverLabel||''}</div>`
    ).join('') || `<div class="dropdown-item">No results</div>`;

    filterDropdown.style.display = 'block';
    const r = btn.getBoundingClientRect();
    filterDropdown.style.left = `${r.left}px`;
    filterDropdown.style.top  = `${r.bottom + 5}px`;
  }, { passive: true });

  btn.addEventListener('mouseleave', () => {
    if (!filterDropdown.matches(':hover')) filterDropdown.style.display = 'none';
  }, { passive: true });

  btn.addEventListener('click', () => {
    filterButtons.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    
    const f = btn.dataset.filter;
    covers = (f === 'all' ? [...allCovers] : allCovers.filter(c => c.category?.includes(f)));
    activeIndex = Math.floor((covers.length - 1) / 2);
    renderCovers();
    renderCoverFlow();
    
    // Animate the active state
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => {
      btn.style.transform = '';
    }, 150);
  }, { passive: true });
});

filterDropdown.addEventListener('mouseleave', () => filterDropdown.style.display = 'none', { passive: true });
filterDropdown.addEventListener('click', e => {
  const id = e.target.dataset.id;
  if (!id) return;
  const idx = covers.findIndex(c => c.id.toString() === id);
  if (idx !== -1) {
    setActiveIndex(idx);
    filterDropdown.style.display = 'none';
  }
}, { passive: true });

// 13) Re‑center helper
function setActiveIndex(i) {
  activeIndex = Math.max(0, Math.min(i, covers.length - 1));
  renderCoverFlow();
}

// 14) Reflow on resize
function syncFilters() {
  updateFilterCounts();
}

window.addEventListener('resize', () => {
  updateLayoutParameters();
  renderCoverFlow();
  resizeTrailCanvas();
}, { passive: true });

// Initialize
fetch(`/data/covers.json?cb=${Date.now()}`)
  .then(r => r.json())
  .then(data => {
    allCovers = data;
    covers    = [...allCovers];
    activeIndex = Math.floor((covers.length - 1) / 2);
    updateLayoutParameters();
    renderCovers();
    renderCoverFlow();
    syncFilters(); // Update counts after loading
  })
  .catch(console.error);
// == index.js ==

// 1) Core globals
let allCovers = [];
let covers = [];
let activeIndex = 0;
let coverSpacing, anglePerOffset, minScale;
const maxAngle = 80;

// Handy flag for any device-specific CSS/JS (we keep horizontal axis by default)
const isMobile = window.matchMedia('(max-width:768px)').matches;

// Grab core elements
const coverflowEl = document.getElementById('coverflow');
const hoverDisplay = document.getElementById('hover-credits');

// 2) Particle trails setup (unchanged)
const trailCanvas = document.getElementById('trail-canvas');
const trailCtx    = trailCanvas.getContext('2d');
let particles = [];
function resizeTrailCanvas() {
  trailCanvas.width  = coverflowEl.clientWidth;
  trailCanvas.height = coverflowEl.clientHeight;
}
window.addEventListener('resize', resizeTrailCanvas);
resizeTrailCanvas();

function emitParticles(delta) {
  const count = Math.min(Math.abs(delta) / 5, 10);
  for (let i = 0; i < count; i++) {
    particles.push({
      x: trailCanvas.width  / 2,
      y: trailCanvas.height / 2,
      vx: delta * (Math.random() * 0.2 + 0.1),
      vy: (Math.random() - 0.5) * 2,
      life: 60
    });
  }
}

function animateTrails() {
  trailCtx.clearRect(0,0,trailCanvas.width,trailCanvas.height);
  particles.forEach((p,i) => {
    trailCtx.globalAlpha = p.life / 60;
    trailCtx.beginPath();
    trailCtx.arc(p.x, p.y, 3, 0, Math.PI*2);
    trailCtx.fill();
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) particles.splice(i,1);
  });
  requestAnimationFrame(animateTrails);
}
animateTrails();

// 3) Ambient reactive glow (unchanged)
function updateAmbient() {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = covers[activeIndex]?.frontImage;
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 10;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, 10, 10);
    const [r,g,b] = ctx.getImageData(0,0,10,10).data;
    document.getElementById('ambient-light')
      .style.backgroundColor = `rgba(${r},${g},${b},0.4)`;
  };
}

// 4) Prevent native scroll & use horizontal axis always
let wheelCooldown = false;
let touchStartX = 0;

// Prevent any vertical page scroll on coverflow
coverflowEl.addEventListener('touchmove', e => {
  e.preventDefault();
}, { passive: false });

// Wheel logic: horizontal only
window.addEventListener('wheel', e => {
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
  e.preventDefault();
  if (!wheelCooldown) {
    emitParticles(e.deltaX);
    setActiveIndex(activeIndex + (e.deltaX > 0 ? 1 : -1));
    wheelCooldown = true;
    setTimeout(() => { wheelCooldown = false; }, 120);
  }
}, { passive: false });

// Touch swipe logic: horizontal
coverflowEl.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].screenX;
});
coverflowEl.addEventListener('touchend', e => {
  const endX = e.changedTouches[0].screenX;
  const diff = endX - touchStartX;
  if (Math.abs(diff) > 60) {
    setActiveIndex(activeIndex + (diff < 0 ? 1 : -1));
  }
});

// 5) Fetch styles & covers
fetch('/data/test-styles.json')
  .then(r => r.json())
  .then(style => {
    const tag = document.getElementById('global-styles');
    tag.innerHTML = `
      html, body {
        font-family: '${style.fontFamily||'GT America'}',sans-serif;
        font-size: ${style.fontSize||16}px;
      }
      .cover-label {
        font-family: '${style.overrides?.coverLabel?.fontFamily||style.fontFamily||'GT America'}';
        font-size: ${style.overrides?.coverLabel?.fontSize||14}px;
      }
      .filter-label {
        font-family: '${style.overrides?.filterLabel?.fontFamily||style.fontFamily||'GT America'}';
        font-size: ${style.overrides?.filterLabel?.fontSize||13}px;
      }
      .hover-credits-container {
        font-family: '${style.overrides?.hoverCredits?.fontFamily||style.fontFamily||'GT America'}';
        font-size: ${style.overrides?.hoverCredits?.fontSize||12}px;
      }
    `;
  });

fetch(`/data/covers.json?cachebust=${Date.now()}`)
  .then(r => r.json())
  .then(data => {
    allCovers  = data;
    covers     = [...allCovers];
    activeIndex = Math.floor(covers.length/2);
    updateLayoutParameters();
    renderCovers();
    renderCoverFlow();
  })
  .catch(err => console.error('Error fetching covers:', err));

// 6) Layout & rendering
function updateLayoutParameters() {
  const vw = window.innerWidth;
  coverSpacing   = Math.max(120, vw * 0.18);
  anglePerOffset = vw < 600 ? 50 : 65;
  minScale       = vw < 600 ? 0.45 : 0.5;
}

function renderCovers() {
  coverflowEl.innerHTML = '';
  covers.forEach((cover, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'cover';
    wrapper.dataset.index = i;
    wrapper.dataset.originalIndex = cover.id;
    wrapper.dataset.category = cover.category;

    const flip = document.createElement('div');
    flip.className = 'flip-container';

    const front = document.createElement('div');
    front.className = 'cover-front';
    front.style.backgroundImage = `url('${cover.frontImage}')`;

    const back = document.createElement('div');
    back.className = 'cover-back';

    const bc = document.createElement('div');
    bc.className = 'back-content';

    // CONTACT case
    if (cover.albumTitle?.toLowerCase() === 'contact') {
      const btn = document.createElement('a');
      btn.href = 'mailto:hi@allmyfriendsinc.com';
      btn.innerText = 'Contact Us';
      btn.className = 'expand-btn';
      btn.style.textDecoration = 'none';
      btn.style.textAlign = 'center';
      bc.appendChild(btn);

    } else {
      // Artist Details button
      const btn = document.createElement('button');
      btn.className = 'expand-btn';
      btn.innerText = 'Artist Details';
      bc.appendChild(btn);

      // Labels
      const lf = document.createElement('div');
      lf.className = 'cover-label';
      lf.innerHTML = `<strong>${cover.albumTitle||''}</strong><br/>${cover.coverLabel||''}`;
      wrapper.appendChild(lf);

      const lb = document.createElement('div');
      lb.className = 'back-label';
      lb.innerHTML = `<strong>${cover.albumTitle||''}</strong><br/>${cover.coverLabel||''}`;
      wrapper.appendChild(lb);

      // Spotify embed or link
      if (cover.music?.type === 'embed' && cover.music.url) {
        if (isMobile) {
          const l = document.createElement('a');
          l.href = cover.music.url;
          l.target = '_blank';
          l.className = 'spotify-button';
          l.innerText = 'Play on Spotify';
          bc.appendChild(l);
        } else {
          bc.innerHTML += `
            <iframe style="border-radius:12px"
              src="${cover.music.url.replace('spotify.com/','spotify.com/embed/')}"
              width="100%" height="352" frameborder="0"
              allowfullscreen allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"></iframe>`;
        }
      }
    }

    back.appendChild(bc);
    flip.appendChild(front);
    flip.appendChild(back);
    wrapper.appendChild(flip);

    wrapper.addEventListener('click', () => {
      const idx = +wrapper.dataset.index;
      const off = idx - activeIndex;
      const fc  = wrapper.querySelector('.flip-container');
      if (off === 0 && fc) fc.classList.toggle('flipped');
      else setActiveIndex(idx);
    });

    coverflowEl.appendChild(wrapper);
  });
}

function renderCoverFlow() {
  document.querySelectorAll('.cover').forEach(cover => {
    const i      = +cover.dataset.index;
    const off    = i - activeIndex;
    const eff    = Math.sign(off) * Math.log2(Math.abs(off) + 1);
    const scale  = Math.max(minScale, 1 - Math.abs(off) * 0.08);

    const tx = eff * coverSpacing;
    const ry = Math.max(-maxAngle, Math.min(off * -anglePerOffset, maxAngle));
    cover.style.transform = `translate(-50%,-50%) translateX(${tx}px) scale(${scale}) rotateY(${ry}deg)`;

    cover.style.filter = off === 0 ? 'none' : `blur(${Math.min(Math.abs(off)*1,4)}px)`;
    cover.style.zIndex = covers.length - Math.abs(off);

    const fc = cover.querySelector('.flip-container');
    if (off !== 0) fc?.classList.remove('flipped');
    cover.classList.toggle('cover-active', off === 0);
  });
  updateAmbient();
}

function setActiveIndex(idx) {
  activeIndex = Math.max(0, Math.min(idx, covers.length - 1));
  renderCoverFlow();
}

// 7) Keyboard nav & modal close
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft')  setActiveIndex(activeIndex - 1);
  if (e.key === 'ArrowRight') setActiveIndex(activeIndex + 1);
  if (e.key === 'Escape')     document.querySelector('.artist-modal').classList.add('hidden');
});

// 8) Artist Detail modal logic (unchanged)
document.body.addEventListener('click', e => {
  if (e.target.classList.contains('expand-btn') && e.target.tagName === 'BUTTON') {
    const wrapper = e.target.closest('.cover');
    const id      = wrapper?.dataset.originalIndex;
    const cd      = covers.find(c => c.id == id);
    if (!cd?.artistDetails) return;
    const modal = document.querySelector('.artist-modal');
    modal.querySelector('.artist-photo').src        = cd.artistDetails.image;
    modal.querySelector('.artist-name').innerText   = cd.artistDetails.name;
    modal.querySelector('.artist-location').innerText = cd.artistDetails.location;
    modal.querySelector('.artist-bio').innerText    = cd.artistDetails.bio;
    modal.querySelector('.spotify-link').href       = cd.artistDetails.spotifyLink;
    const player = modal.querySelector('.spotify-player');
    if (cd.artistDetails.spotifyLink.includes('spotify.com')) {
      player.src = cd.artistDetails.spotifyLink.replace('spotify.com/','spotify.com/embed/');
      player.style.display = '';
    } else {
      player.style.display = 'none';
    }
    modal.classList.remove('hidden');
  }
});
document.querySelector('.artist-modal').addEventListener('click', e => {
  if (e.target.classList.contains('artist-modal')) {
    const mc = e.target.querySelector('.modal-content');
    mc.classList.add('pulse-dismiss');
    setTimeout(() => {
      e.target.classList.add('hidden');
      mc.classList.remove('pulse-dismiss');
    }, 250);
  }
});
document.querySelector('.artist-modal .close-btn').addEventListener('click', () => {
  document.querySelector('.artist-modal').classList.add('hidden');
});

// 9) Filter dropdown logic — position above if it would overflow
const filterButtons = Array.from(document.querySelectorAll('.filter-label'));
const filterDropdown = document.createElement('div');
filterDropdown.className = 'filter-dropdown';
document.body.appendChild(filterDropdown);

filterButtons.forEach(btn => {
  btn.addEventListener('mouseenter', () => {
    const filter = btn.dataset.filter;
    const results = allCovers.filter(c => filter === 'all' || c.category?.includes(filter));
    const itemsHtml = results.map(c =>
      `<div class="dropdown-item" data-id="${c.id}">${c.albumTitle||'Untitled'} — ${c.coverLabel||''}</div>`
    ).join('') || `<div class="dropdown-item">No results</div>`;

    filterDropdown.innerHTML = itemsHtml;
    filterDropdown.style.display = 'block';

    const ddHeight = filterDropdown.offsetHeight;
    const rect     = btn.getBoundingClientRect();
    filterDropdown.style.left = `${rect.left}px`;

    // if dropdown would go off bottom, anchor it above the bar
    if (rect.bottom + 5 + ddHeight > window.innerHeight) {
      filterDropdown.style.top = '';
      const bottomVal = window.innerHeight - rect.top + 5;
      filterDropdown.style.bottom = `${bottomVal}px`;
    } else {
      filterDropdown.style.bottom = '';
      filterDropdown.style.top = `${rect.bottom + 5}px`;
    }
  });

  btn.addEventListener('mouseleave', () => {
    setTimeout(() => {
      if (!filterDropdown.matches(':hover')) {
        filterDropdown.style.display = 'none';
      }
    }, 100);
  });

  btn.addEventListener('click', () => {
    filterButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    covers = filter === 'all'
      ? [...allCovers]
      : allCovers.filter(c => c.category?.includes(filter));
    activeIndex = Math.floor(covers.length / 2);
    renderCovers();
    renderCoverFlow();
    filterDropdown.style.display = 'none';
  });
});

filterDropdown.addEventListener('mouseleave', () => {
  filterDropdown.style.display = 'none';
});
filterDropdown.addEventListener('click', e => {
  const id = e.target.dataset.id;
  if (!id) return;
  const idx = covers.findIndex(c => c.id.toString() === id);
  if (idx !== -1) {
    setActiveIndex(idx);
    filterDropdown.style.display = 'none';
  }
});

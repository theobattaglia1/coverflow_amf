// == index.js ==

// 1) Core globals
let allCovers = [];
let covers = [];
let activeIndex = 0;
let coverSpacing, anglePerOffset, minScale;
const maxAngle = 80;
const isMobile = window.matchMedia('(max-width:768px)').matches;

const coverflowEl = document.getElementById('coverflow');
const hoverDisplay = document.getElementById('hover-credits');

// 2) Particle trails
const trailCanvas = document.getElementById('trail-canvas');
const trailCtx    = trailCanvas.getContext('2d');
let particles    = [];

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
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
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
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, 10, 10);
    const [r, g, b] = ctx.getImageData(0, 0, 10, 10).data;
    document.getElementById('ambient-light')
      .style.backgroundColor = `rgba(${r},${g},${b},0.4)`;
  };
}

// 4) Prevent native vertical scroll & handle horizontal swipe/wheel
let wheelCooldown = false;
let touchStartX = 0;

coverflowEl.addEventListener('touchmove', e => {
  e.preventDefault(); // capture all vertical drags
}, { passive: false });

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
  .then(res => res.json())
  .then(style => {
    const tag = document.getElementById('global-styles');
    tag.innerHTML = `
      html, body { font-family:'${style.fontFamily||'GT America'}',sans-serif; font-size:${style.fontSize||16}px; }
      .cover-label { font-family:'${style.overrides?.coverLabel?.fontFamily||style.fontFamily||'GT America'}'; font-size:${style.overrides?.coverLabel?.fontSize||14}px; }
      .filter-label { font-family:'${style.overrides?.filterLabel?.fontFamily||style.fontFamily||'GT America'}'; font-size:${style.overrides?.filterLabel?.fontSize||13}px; }
      .hover-credits-container { font-family:'${style.overrides?.hoverCredits?.fontFamily||style.fontFamily||'GT America'}'; font-size:${style.overrides?.hoverCredits?.fontSize||12}px; }
    `;
  });

fetch(`/data/covers.json?cachebust=${Date.now()}`)
  .then(res => res.json())
  .then(data => {
    allCovers = data;
    covers    = [...allCovers];
    activeIndex = Math.floor(covers.length / 2);
    updateLayoutParameters();
    renderCovers();
    renderCoverFlow();
  })
  .catch(err => console.error('Error fetching covers:', err));

// 6) Layout params
function updateLayoutParameters() {
  const vw = window.innerWidth;
  coverSpacing   = Math.max(120, vw * 0.18);
  anglePerOffset = vw < 600 ? 50 : 65;
  minScale       = vw < 600 ? 0.45 : 0.5;
}

// 7) Render covers
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

    const backContent = document.createElement('div');
    backContent.className = 'back-content';

    if (cover.albumTitle?.toLowerCase() === 'contact') {
      const contactBtn = document.createElement('a');
      contactBtn.href = 'mailto:hi@allmyfriendsinc.com';
      contactBtn.innerText = 'Contact Us';
      contactBtn.className = 'expand-btn';
      contactBtn.style.textDecoration = 'none';
      contactBtn.style.textAlign = 'center';
      backContent.appendChild(contactBtn);
    } else {
      const artistDetailsBtn = document.createElement('button');
      artistDetailsBtn.className = 'expand-btn';
      artistDetailsBtn.innerText = 'Artist Details';
      backContent.appendChild(artistDetailsBtn);

      const labelFront = document.createElement('div');
      labelFront.className = 'cover-label';
      labelFront.innerHTML = `<strong>${cover.albumTitle||''}</strong><br/>${cover.coverLabel||''}`;
      wrapper.appendChild(labelFront);

      const labelBack = document.createElement('div');
      labelBack.className = 'back-label';
      labelBack.innerHTML = `<strong>${cover.albumTitle||''}</strong><br/>${cover.coverLabel||''}`;
      wrapper.appendChild(labelBack);

      if (cover.music?.type === 'embed' && cover.music.url) {
        const iframeHTML = `
          <iframe style="border-radius:12px"
            src="${cover.music.url.replace('spotify.com/','spotify.com/embed/')}"
            width="100%" height="352" frameborder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"></iframe>`;
        backContent.innerHTML += iframeHTML;
      }
    }

    back.appendChild(backContent);
    flip.appendChild(front);
    flip.appendChild(back);
    wrapper.appendChild(flip);

    wrapper.addEventListener('click', () => {
      const idx = parseInt(wrapper.dataset.index, 10);
      const off = idx - activeIndex;
      const fc  = wrapper.querySelector('.flip-container');
      if (off === 0 && fc) fc.classList.toggle('flipped');
      else setActiveIndex(idx);
    });

    coverflowEl.appendChild(wrapper);
  });
}

// 8) Render coverflow (always horizontal)
function renderCoverFlow() {
  document.querySelectorAll('.cover').forEach(cover => {
    const i      = +cover.dataset.index;
    const offset = i - activeIndex;
    const eff    = Math.sign(offset) * Math.log2(Math.abs(offset) + 1);
    const scale  = Math.max(minScale, 1 - Math.abs(offset) * 0.08);

    const tx = eff * coverSpacing;
    const ry = Math.max(-maxAngle, Math.min(offset * -anglePerOffset, maxAngle));
    cover.style.transform = `
      translate(-50%, -50%)
      translateX(${tx}px)
      scale(${scale})
      rotateY(${ry}deg)
    `;
    cover.style.filter = offset === 0 ? 'none' : `blur(${Math.min(Math.abs(offset)*1,4)}px)`;
    cover.style.zIndex = covers.length - Math.abs(offset);

    const fc = cover.querySelector('.flip-container');
    if (offset !== 0) fc?.classList.remove('flipped');
    cover.classList.toggle('cover-active', offset === 0);
  });
  updateAmbient();
}

// 9) setActiveIndex
function setActiveIndex(idx) {
  activeIndex = Math.max(0, Math.min(idx, covers.length - 1));
  renderCoverFlow();
}

// 10) Keyboard nav & modal
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft')  setActiveIndex(activeIndex - 1);
  if (e.key === 'ArrowRight') setActiveIndex(activeIndex + 1);
  if (e.key === 'Escape')     document.querySelector('.artist-modal').classList.add('hidden');
});

// 11) Artist modal logic
document.body.addEventListener('click', e => {
  if (e.target.classList.contains('expand-btn') && e.target.tagName === 'BUTTON') {
    const coverEl = e.target.closest('.cover');
    const id = coverEl?.dataset.originalIndex;
    const cd = covers.find(c => c.id == id);
    if (!cd?.artistDetails) return;
    const modal = document.querySelector('.artist-modal');
    modal.querySelector('.artist-photo').src          = cd.artistDetails.image;
    modal.querySelector('.artist-name').innerText     = cd.artistDetails.name;
    modal.querySelector('.artist-location').innerText = cd.artistDetails.location;
    modal.querySelector('.artist-bio').innerText      = cd.artistDetails.bio;
    modal.querySelector('.spotify-link').href         = cd.artistDetails.spotifyLink;
    if (cd.artistDetails.spotifyLink.includes('spotify.com')) {
      modal.querySelector('.spotify-player').src =
        cd.artistDetails.spotifyLink.replace('spotify.com/','spotify.com/embed/');
      modal.querySelector('.spotify-player').style.display = '';
    } else {
      modal.querySelector('.spotify-player').style.display = 'none';
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

// 12) Filter dropdown logic (dropdown now pops above on mobile)
const filterButtons = Array.from(document.querySelectorAll('.filter-label'));
const filterDropdown = document.createElement('div');
filterDropdown.className = 'filter-dropdown';
document.body.appendChild(filterDropdown);

filterButtons.forEach(btn => {
  btn.addEventListener('mouseenter', () => {
    const filter = btn.dataset.filter;
    const results = allCovers.filter(c => filter === 'all' || c.category?.includes(filter));
    const items = results.map(c =>
      `<div class="dropdown-item" data-id="${c.id}">${c.albumTitle||'Untitled'} — ${c.coverLabel||''}</div>`
    ).join('') || '<div class="dropdown-item">No results</div>';

    filterDropdown.innerHTML = items;
    filterDropdown.style.display = 'block';

    const rect = btn.getBoundingClientRect();
    filterDropdown.style.left = `${rect.left}px`;

    if (isMobile) {
      // position above filter bar
      filterDropdown.style.top = 'auto';
      filterDropdown.style.bottom = `${window.innerHeight - rect.top + 5}px`;
    } else {
      // position below
      filterDropdown.style.bottom = 'auto';
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
    covers = (filter === 'all'
      ? [...allCovers]
      : allCovers.filter(c => c.category?.includes(filter))
    );
    activeIndex = Math.floor(covers.length / 2);
    renderCovers();
    renderCoverFlow();
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

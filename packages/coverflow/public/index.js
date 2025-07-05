// == index.js ==

// 1) Globals
let allCovers = [], covers = [], activeIndex = 0;
let coverSpacing, anglePerOffset, minScale;
const maxAngle = 80,
      isMobile = window.matchMedia('(max-width:768px)').matches;
const coverflowEl   = document.getElementById('coverflow'),
      hoverDisplay  = document.getElementById('hover-credits');

// 2) Trails - Enhanced particle system
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
  const count = Math.min(Math.abs(delta) / 3, 15);
  for (let i = 0; i < count; i++) {
    particles.push({
      x: trailCanvas.width / 2,
      y: trailCanvas.height / 2,
      vx: delta * (Math.random() * 0.3 + 0.1),
      vy: (Math.random() - 0.5) * 3,
      size: Math.random() * 3 + 1,
      life: 80,
      color: `hsla(${Math.random() * 60 + 180}, 70%, 70%, 0.6)`
    });
  }
}

function animateTrails() {
  trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
  particles.forEach((p, i) => {
    trailCtx.globalAlpha = (p.life / 80) * 0.6;
    trailCtx.fillStyle = p.color;
    trailCtx.beginPath();
    trailCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    trailCtx.fill();
    
    // Add subtle glow
    trailCtx.shadowBlur = 10;
    trailCtx.shadowColor = p.color;
    trailCtx.fill();
    trailCtx.shadowBlur = 0;
    
    p.x += p.vx; 
    p.y += p.vy; 
    p.vy += 0.1; // gravity
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  });
  requestAnimationFrame(animateTrails);
}
animateTrails();

// 3) Ambient glow - Enhanced with logo integration
function updateAmbient() {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const cover = covers[activeIndex];
  if (!cover) return;
  
  // Use production URL for uploads
  const imageUrl = cover.frontImage.startsWith('/uploads/') 
    ? `https://allmyfriendsinc.com${cover.frontImage}`
    : cover.frontImage;
  img.src = imageUrl;
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 10;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0, 10, 10);
    const [r, g, b] = cx.getImageData(0, 0, 10, 10).data;
    
    // Update ambient light
    document.getElementById('ambient-light')
      .style.backgroundColor = `rgba(${r},${g},${b},0.4)`;
    
    // Update logo glow to match
    const logoGlow = document.querySelector('.logo-glow');
    if (logoGlow) {
      logoGlow.style.setProperty('--glow-color', `rgba(${r},${g},${b},0.1)`);
    }
  };
}

// ===== Logo Parallax (desktop) =====
(function initLogoParallax(){
  const logo   = document.querySelector('.logo-frame');
  const glow   = document.querySelector('.logo-glow');
  if (!logo) return;

  function parallax(nx, ny){
    const maxShift = 6; // px
    const gxShift  = 12;
    logo.style.transform = `translate(${ -nx*maxShift }px, ${ -ny*maxShift }px)`;
    glow.style.transform = `translate(calc(-50% + ${ -nx*gxShift }px), calc(-50% + ${ -ny*gxShift }px))`;
  }

  window.addEventListener('pointermove', e=>{
    const nx = (e.clientX / window.innerWidth )*2 - 1; // -1..1
    const ny = (e.clientY / window.innerHeight)*2 - 1;
    parallax(nx, ny);
  }, {passive:true});

  // Mobile – use deviceorientation if available
  window.addEventListener('deviceorientation', e=>{
    if (e.gamma == null || e.beta == null) return;
    const nx = e.gamma/45; // approx -1..1
    const ny = e.beta /90; // approx -1..1
    parallax(nx, ny);
  }, {passive:true});
})();

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

// 6) Layout params
function updateLayoutParameters() {
  const vw = window.innerWidth;

  if (isMobile) {
    // on mobile, use larger spacing to accommodate bigger/flipped cards
    coverSpacing   = Math.max(180, vw * 0.30);
    anglePerOffset = 50;
    minScale       = 0.45;
  } else {
    // original desktop spacing with better minimum
    coverSpacing   = Math.max(150, vw * 0.18); // Increased minimum from 120 to 150
    anglePerOffset = vw < 600 ? 50 : 65;
    minScale       = vw < 600 ? 0.45 : 0.5;
  }
}

// 7) Render covers
function renderCovers() {
  if (!coverflowEl) {
    console.error('Coverflow element not found!');
    return;
  }
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
    // If the image starts with /uploads, prepend the production URL
    const imageUrl = cover.frontImage.startsWith('/uploads/') 
      ? `https://allmyfriendsinc.com${cover.frontImage}`
      : cover.frontImage;
    front.style.backgroundImage = `url('${imageUrl}')`;

    const back = document.createElement('div');
    back.className = 'cover-back';

    const backContent = document.createElement('div');
    backContent.className = 'back-content';

    if (cover.albumTitle?.toLowerCase() === 'contact') {
      backContent.innerHTML = `
        <a href="mailto:hi@allmyfriendsinc.com" class="contact-card">
          <div class="contact-icon">✉️</div>
          <span>Say&nbsp;Hello</span>
        </a>`;
    } else {
      // Create an info button overlay for artist details
      const infoOverlay = document.createElement('div');
      infoOverlay.className = 'artist-info-overlay';
      infoOverlay.innerHTML = `
        <button class="info-button" aria-label="View artist details">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        </button>
      `;
      backContent.appendChild(infoOverlay);

      // FRONT label
      const coverLabel = document.createElement('div');
      coverLabel.className = 'cover-label';
      coverLabel.innerHTML = `
        <strong>${cover.albumTitle || ''}</strong><br/>
        ${cover.coverLabel   || ''}
      `;
      wrapper.appendChild(coverLabel);

      // BACK label
      const backLabel = document.createElement('div');
      backLabel.className = 'back-label';
      backLabel.innerHTML = coverLabel.innerHTML;
      wrapper.appendChild(backLabel);

      // Spotify embed
      if (cover.music?.type === 'embed' && cover.music.url) {
        // Create wrapper for elegant Spotify player
        const embedWrapper = document.createElement('div');
        embedWrapper.className = 'spotify-embed-wrapper';
        
        // Add loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'spotify-loading';
        embedWrapper.appendChild(loadingIndicator);
        
        // Create container for the iframe
        const embedContainer = document.createElement('div');
        embedContainer.className = 'spotify-embed-container';
        
        // Extract track/playlist ID from URL
        const spotifyUrl = cover.music.url;
        let embedUrl = spotifyUrl;
        
        // Convert regular Spotify URLs to embed URLs with compact player
        if (spotifyUrl.includes('spotify.com/track/')) {
          embedUrl = spotifyUrl.replace('spotify.com/', 'spotify.com/embed/');
          embedUrl += embedUrl.includes('?') ? '&' : '?';
          embedUrl += 'utm_source=generator&theme=0'; // dark theme
        } else if (spotifyUrl.includes('spotify.com/playlist/') || spotifyUrl.includes('spotify.com/album/')) {
          embedUrl = spotifyUrl.replace('spotify.com/', 'spotify.com/embed/');
          embedUrl += embedUrl.includes('?') ? '&' : '?';
          embedUrl += 'utm_source=generator&theme=0'; // dark theme
        }
        
        // Create iframe
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'border-radius:12px';
        iframe.src = embedUrl;
        iframe.width = '100%';
        iframe.height = '80'; // Compact height for single track
        iframe.frameBorder = '0';
        iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
        iframe.loading = 'lazy';
        
        // Remove loading indicator when iframe loads
        iframe.onload = () => {
          loadingIndicator.remove();
        };
        
        embedContainer.appendChild(iframe);
        embedWrapper.appendChild(embedContainer);
        
        // Add album art preview if available
        if (cover.frontImage) {
          const albumArt = document.createElement('div');
          albumArt.className = 'album-art-preview';
          // Use the same imageUrl we calculated for the front
          albumArt.style.backgroundImage = `url('${imageUrl}')`;
          embedWrapper.appendChild(albumArt);
        }
        
        // Add Spotify branding
        const spotifyBranding = document.createElement('div');
        spotifyBranding.className = 'spotify-branding';
        spotifyBranding.innerHTML = `
          <svg viewBox="0 0 24 24">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          <span>Spotify</span>
        `;
        embedWrapper.appendChild(spotifyBranding);
        
        backContent.appendChild(embedWrapper);
      }
    }

    back.appendChild(backContent);
    flip.appendChild(front);
    flip.appendChild(back);
    wrapper.appendChild(flip);

    wrapper.addEventListener('click', (e) => {
      // Don't flip if clicking on info button
      if (e.target.closest('.info-button')) {
        e.stopPropagation();
        const cid = wrapper.dataset.originalIndex;
        const cd = covers.find(c => c.id == cid);
        if (cd?.artistDetails) {
          openArtistModal(cd);
        }
        return;
      }
      
      // Don't flip if clicking on interactive elements in the back
      if (e.target.closest('.contact-card') || 
          e.target.closest('iframe') || 
          e.target.closest('.spotify-embed-container') ||
          e.target.closest('.back-content a')) {
        e.stopPropagation();
        return;
      }
      
      const idx = +wrapper.dataset.index;
      const off = idx - activeIndex;
      const fc = wrapper.querySelector('.flip-container');
      if (off === 0 && fc) fc.classList.toggle('flipped');
      else setActiveIndex(idx);
    });

    coverflowEl.appendChild(wrapper);
  });
}

// 8) 3D layout
function renderCoverFlow() {
  document.querySelectorAll('.cover').forEach(cover => {
    const i      = +cover.dataset.index;
    const offset = i - activeIndex;
    const eff    = Math.sign(offset) * Math.log2(Math.abs(offset) + 1);
    const scale  = Math.max(minScale, 1 - Math.abs(offset) * 0.08);
    const tx     = eff * coverSpacing;
    const ry     = Math.max(-maxAngle, Math.min(offset * -anglePerOffset, maxAngle));

    // Apply transform without breaking the breathing animation
    if (offset === 0) {
      cover.style.transform = `
        translateX(${tx}px)
        scale(${scale})
        rotateY(${ry}deg)
      `;
    } else {
      cover.style.transform = `
        translate(-50%,-50%)
        translateX(${tx}px)
        scale(${scale})
        rotateY(${ry}deg)
      `;
    }
    
    // Dynamic shadow opacity based on position
    cover.style.setProperty('--shadow-opacity', 
      offset === 0 ? '0.6' : `${0.3 - Math.abs(offset) * 0.05}`);
    
    cover.style.filter = offset === 0 ? 'none' : `blur(${Math.min(Math.abs(offset),4)}px)`;
    
    // Enhanced z-index calculation to ensure proper layering
    const baseZ = 1000; // Start with a high base to avoid conflicts
    cover.style.zIndex = baseZ + (covers.length - Math.abs(offset)) * 10;
    
    cover.querySelector('.flip-container')?.classList.remove('flipped');
    cover.classList.toggle('cover-active', offset === 0);
  });
  updateAmbient();
}

// 9) Keyboard & ESC
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft')  setActiveIndex(activeIndex - 1);
  if (e.key === 'ArrowRight') setActiveIndex(activeIndex + 1);
  if (e.key === 'Escape')     document.querySelector('.artist-modal').classList.add('hidden');
});

// 10) Modal open function
function openArtistModal(coverData) {
  const modal = document.querySelector('.artist-modal'),
        photo = modal.querySelector('.artist-photo'),
        player= modal.querySelector('.spotify-player'),
        link  = coverData.artistDetails.spotifyLink;

  if (coverData.artistDetails.image) {
    photo.src = coverData.artistDetails.image;
    photo.style.display = '';
  } else {
    photo.style.display = 'none';
  }

  if (link?.includes('spotify.com')) {
    player.src = link.replace('spotify.com/','spotify.com/embed/');
    player.style.display = '';
  } else {
    player.style.display = 'none';
  }

  modal.querySelector('.artist-name').innerText     = coverData.artistDetails.name;
  modal.querySelector('.artist-location').innerText = coverData.artistDetails.location;
  modal.querySelector('.artist-bio').innerText      = coverData.artistDetails.bio;
  modal.querySelector('.spotify-link').href         = link;
  modal.classList.remove('hidden');
}

// 11) Modal close
document.querySelector('.artist-modal')
  .addEventListener('click', e => {
    if (e.target.classList.contains('artist-modal')) {
      const mc = e.target.querySelector('.modal-content');
      mc.classList.add('pulse-dismiss');
      setTimeout(() => {
        e.target.classList.add('hidden');
        mc.classList.remove('pulse-dismiss');
      }, 250);
    }
  }, { passive: true });

document.querySelector('.artist-modal .close-btn')
  .addEventListener('click', () => {
    document.querySelector('.artist-modal').classList.add('hidden');
  }, { passive: true });

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

let dropdownTimeout;

filterButtons.forEach(btn => {
  btn.addEventListener('mouseenter', () => {
    clearTimeout(dropdownTimeout);
    const f = btn.dataset.filter;
    const res = allCovers.filter(c => f === 'all' || c.category?.includes(f));
    filterDropdown.innerHTML = res.map(c =>
      `<div class="dropdown-item" data-id="${c.id}">${c.albumTitle||'Untitled'} — ${c.coverLabel||''}</div>`
    ).join('') || `<div class="dropdown-item">No results</div>`;

    filterDropdown.style.display = 'block';
    const r = btn.getBoundingClientRect();
    filterDropdown.style.left = `${r.left}px`;
    filterDropdown.style.top  = `${r.bottom + 2}px`;
  }, { passive: true });

  btn.addEventListener('mouseleave', () => {
    dropdownTimeout = setTimeout(() => {
      if (!filterDropdown.matches(':hover')) filterDropdown.style.display = 'none';
    }, 100); // Small delay to allow moving to dropdown
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

filterDropdown.addEventListener('mouseenter', () => {
  clearTimeout(dropdownTimeout);
}, { passive: true });

filterDropdown.addEventListener('mouseleave', () => {
  filterDropdown.style.display = 'none';
}, { passive: true });
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

let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    updateLayoutParameters();
    renderCoverFlow();
    resizeTrailCanvas();
  }, 100); // Debounce resize events
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
  .catch(err => {
    console.error('Failed to load covers:', err);
  });
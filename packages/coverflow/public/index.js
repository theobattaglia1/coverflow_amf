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
let animationId = null;
let isAnimating = false;

function resizeTrailCanvas() {
  trailCanvas.width  = coverflowEl.clientWidth;
  trailCanvas.height = coverflowEl.clientHeight;
}
window.addEventListener('resize', resizeTrailCanvas, { passive: true });
resizeTrailCanvas();
startAnimation(); // Start the animation system

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
  if (!isAnimating) return;
  
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
  animationId = requestAnimationFrame(animateTrails);
}

// Start/stop animation based on visibility
function startAnimation() {
  if (!isAnimating) {
    isAnimating = true;
    animateTrails();
  }
}

function stopAnimation() {
  isAnimating = false;
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

// Visibility detection
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopAnimation();
  } else {
    startAnimation();
  }
});

// Intersection Observer for viewport detection
const animationObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !document.hidden) {
      startAnimation();
    } else {
      stopAnimation();
    }
  });
}, { threshold: 0.1 });

// Start observing the canvas
animationObserver.observe(trailCanvas);

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

// 7) Cover rendering with elegant lazy loading
function renderCovers() {
  coverflowEl.innerHTML = '';
  
  covers.forEach((c, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'cover';
    wrapper.dataset.index = i;
    wrapper.dataset.originalIndex = c.id;
    
    // Create flip container
    const flipContainer = document.createElement('div');
    flipContainer.className = 'flip-container';
    
    // Front face with lazy loading but using background-image
    const frontFace = document.createElement('div');
    frontFace.className = 'cover-front';
    frontFace.dataset.image = c.frontImage; // Store URL for lazy loading
    
    // Back face
    const backFace = document.createElement('div');
    backFace.className = 'cover-back';
    backFace.innerHTML = `
      <div class="back-content">
        ${c.music?.spotifyEmbed ? 
          `<div class="spotify-embed-container">${c.music.spotifyEmbed}</div>` : 
          (c.contactCard ? c.contactCard : '<p>No content available</p>')
        }
      </div>
    `;
    
    flipContainer.appendChild(frontFace);
    flipContainer.appendChild(backFace);
    wrapper.appendChild(flipContainer);
    
    // Add info button if artist details exist
    if (c.artistDetails) {
      const infoBtn = document.createElement('button');
      infoBtn.className = 'info-button';
      infoBtn.innerHTML = '<span>i</span>';
      infoBtn.setAttribute('aria-label', 'Artist information');
      wrapper.appendChild(infoBtn);
    }
    
    // Add text overlay
    const textOverlay = document.createElement('div');
    textOverlay.className = 'cover-text-overlay';
    textOverlay.innerHTML = `
      <div class="album-title">${c.albumTitle || ''}</div>
      <div class="cover-label">${c.coverLabel || ''}</div>
    `;
    wrapper.appendChild(textOverlay);
    
    // Apply custom styles
    if (c.fontFamily) textOverlay.style.fontFamily = c.fontFamily;
    if (c.fontSize) textOverlay.style.fontSize = c.fontSize + 'px';
    if (c.fontColor) textOverlay.style.color = c.fontColor;
    if (c.textPosition) {
      const [x, y] = c.textPosition.split(',').map(v => v.trim());
      textOverlay.style.left = x + '%';
      textOverlay.style.top = y + '%';
      textOverlay.style.transform = 'translate(-50%, -50%)';
    }
    
    // Click handler
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
      
      if (off === 0 && fc) {
        fc.classList.toggle('flipped');
      } else {
        activeIndex = idx;
        renderCoverFlow();
      }
    });
    
    coverflowEl.appendChild(wrapper);
  });
  
  // Set up lazy loading for background images
  setupLazyLoading();
}

// Lazy loading implementation for background images
let imageObserver;

function setupLazyLoading() {
  // Clean up previous observer
  if (imageObserver) {
    imageObserver.disconnect();
  }
  
  const imageOptions = {
    threshold: 0,
    rootMargin: '200px' // Load images 200px before they enter viewport
  };
  
  imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const element = entry.target;
        const imageUrl = element.dataset.image;
        
        if (imageUrl && !element.classList.contains('loaded')) {
          // Preload the image
          const img = new Image();
          img.onload = () => {
            element.style.backgroundImage = `url('${imageUrl}')`;
            element.classList.add('loaded');
          };
          img.onerror = () => {
            element.style.backgroundImage = `url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="300"%3E%3Crect fill="%23333" width="300" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="14" font-family="monospace"%3EERROR%3C/text%3E%3C/svg%3E')`;
          };
          img.src = imageUrl;
        }
        
        observer.unobserve(element);
      }
    });
  }, imageOptions);
  
  // Observe all cover fronts
  document.querySelectorAll('.cover-front[data-image]').forEach(el => {
    imageObserver.observe(el);
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

// 12) Filter dropdown with proper cleanup
const filterButtons = document.querySelectorAll('.filter-label');
const filterDropdown = document.getElementById('filter-dropdown');
let dropdownTimeout;
let dropdownListeners = new Map();

// Event delegation for dropdown items
filterDropdown.addEventListener('click', (e) => {
  const item = e.target.closest('.dropdown-item');
  if (item) {
    const id = item.dataset.id;
    const index = covers.findIndex(c => c.id == id);
    if (index !== -1) {
      activeIndex = index;
      renderCoverFlow();
      filterDropdown.style.display = 'none';
    }
  }
}, { passive: true });

// Clean up function for dropdown
function cleanupDropdownListeners() {
  dropdownListeners.forEach((listener, element) => {
    element.removeEventListener('mouseenter', listener.enter);
    element.removeEventListener('mouseleave', listener.leave);
    element.removeEventListener('click', listener.click);
  });
  dropdownListeners.clear();
}

// Set up filter buttons with proper cleanup
function setupFilterButtons() {
  cleanupDropdownListeners();
  
  filterButtons.forEach(btn => {
    const listeners = {
      enter: () => {
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
      },
      leave: () => {
        dropdownTimeout = setTimeout(() => {
          if (!filterDropdown.matches(':hover')) filterDropdown.style.display = 'none';
        }, 100);
      },
      click: () => {
        filterButtons.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        
        const f = btn.dataset.filter;
        
        // Special handling for 'about' filter
        if (f === 'about') {
          window.location.href = '/investors.html';
          return;
        }
        
        // Update visible covers without full re-render
        const allCoverElements = document.querySelectorAll('.cover');
        let visibleCovers = [];
        
        allCoverElements.forEach((coverEl, index) => {
          const coverId = coverEl.dataset.originalIndex;
          const cover = allCovers.find(c => c.id == coverId);
          
          if (f === 'all' || (cover && cover.category?.includes(f))) {
            coverEl.style.display = '';
            visibleCovers.push({ element: coverEl, originalIndex: index });
          } else {
            coverEl.style.display = 'none';
          }
        });
        
        // Update dataset indices for visible covers
        visibleCovers.forEach((item, newIndex) => {
          item.element.dataset.index = newIndex;
        });
        
        // Update covers array
        covers = (f === 'all' ? [...allCovers] : allCovers.filter(c => c.category?.includes(f)));
        
        // Reset to center
        activeIndex = Math.floor((visibleCovers.length - 1) / 2);
        renderCoverFlow();
        
        // Animate the active state
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => {
          btn.style.transform = '';
        }, 150);
      }
    };
    
    btn.addEventListener('mouseenter', listeners.enter, { passive: true });
    btn.addEventListener('mouseleave', listeners.leave, { passive: true });
    btn.addEventListener('click', listeners.click, { passive: true });
    
    dropdownListeners.set(btn, listeners);
  });
}

// Initialize filter buttons
setupFilterButtons();

filterDropdown.addEventListener('mouseleave', () => {
  dropdownTimeout = setTimeout(() => {
    filterDropdown.style.display = 'none';
  }, 100);
}, { passive: true });

filterDropdown.addEventListener('mouseenter', () => {
  clearTimeout(dropdownTimeout);
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

// Utility: Debounce function
function debounce(func, wait, immediate) {
  let timeout;
  return function executedFunction() {
    const context = this;
    const args = arguments;
    const later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

// 14) Window resize with proper debouncing
const handleResize = debounce(() => {
  updateLayoutParameters();
  renderCoverFlow();
  resizeTrailCanvas();
}, 250);

window.addEventListener('resize', handleResize, { passive: true });

// Create loading indicator
const loadingIndicator = document.createElement('div');
loadingIndicator.className = 'loading-indicator';
loadingIndicator.innerHTML = `
  <div class="loading-spinner"></div>
  <div class="loading-text">LOADING COVERS...</div>
`;
loadingIndicator.style.cssText = `
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 1000;
`;
document.body.appendChild(loadingIndicator);

// Initialize with loading state
fetch(`/data/covers.json?cb=${Date.now()}`)
  .then(r => {
    if (!r.ok) throw new Error('Failed to load covers');
    return r.json();
  })
  .then(data => {
    allCovers = data;
    covers    = [...allCovers];
    activeIndex = Math.floor((covers.length - 1) / 2);
    updateLayoutParameters();
    renderCovers();
    renderCoverFlow();
    syncFilters(); // Update counts after loading
    
    // Hide loading indicator
    loadingIndicator.style.opacity = '0';
    loadingIndicator.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      loadingIndicator.remove();
    }, 300);
  })
  .catch(err => {
    console.error('Failed to load covers:', err);
    loadingIndicator.innerHTML = `
      <div class="error-message">FAILED TO LOAD COVERS</div>
      <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: white; color: black; border: none; cursor: pointer;">RETRY</button>
    `;
  });

// 15) Keyboard navigation
document.addEventListener('keydown', (e) => {
  // Ignore if user is typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  
  switch(e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      if (activeIndex > 0) {
        activeIndex--;
        renderCoverFlow();
        announceCurrentCover();
      }
      break;
      
    case 'ArrowRight':
      e.preventDefault();
      if (activeIndex < covers.length - 1) {
        activeIndex++;
        renderCoverFlow();
        announceCurrentCover();
      }
      break;
      
    case 'Enter':
    case ' ':
      e.preventDefault();
      const activeCover = document.querySelector('.cover-active .flip-container');
      if (activeCover) {
        activeCover.classList.toggle('flipped');
        announceFlipState(activeCover.classList.contains('flipped'));
      }
      break;
      
    case 'Escape':
      e.preventDefault();
      // Close any open modals
      const modal = document.querySelector('.artist-modal.show');
      if (modal) {
        closeArtistModal();
      } else {
        // Unflip active cover
        const flippedCover = document.querySelector('.cover-active .flip-container.flipped');
        if (flippedCover) {
          flippedCover.classList.remove('flipped');
          announceFlipState(false);
        }
      }
      break;
      
    case 'Home':
      e.preventDefault();
      activeIndex = 0;
      renderCoverFlow();
      announceCurrentCover();
      break;
      
    case 'End':
      e.preventDefault();
      activeIndex = covers.length - 1;
      renderCoverFlow();
      announceCurrentCover();
      break;
  }
});

// Accessibility announcements
const liveRegion = document.createElement('div');
liveRegion.className = 'sr-only';
liveRegion.setAttribute('aria-live', 'polite');
liveRegion.setAttribute('aria-atomic', 'true');
document.body.appendChild(liveRegion);

function announceCurrentCover() {
  const cover = covers[activeIndex];
  if (cover) {
    liveRegion.textContent = `Selected: ${cover.albumTitle || 'Untitled'} by ${cover.coverLabel || 'Unknown'}. Press Enter to flip.`;
  }
}

function announceFlipState(isFlipped) {
  liveRegion.textContent = isFlipped ? 'Cover flipped to back. Press Escape to flip back.' : 'Cover flipped to front.';
}

// Add focus indicator for keyboard navigation
document.addEventListener('keydown', () => {
  document.body.classList.add('keyboard-nav');
}, { once: true });

document.addEventListener('mousedown', () => {
  document.body.classList.remove('keyboard-nav');
});
// == index.js ==

// 1) Globals
let allCovers = [], covers = [], activeIndex = 0;
let coverSpacing, anglePerOffset, minScale;
const maxAngle = 80,
      isMobile = window.matchMedia('(max-width:768px)').matches;
const coverflowEl   = document.getElementById('coverflow'),
      hoverDisplay  = document.getElementById('hover-credits');
const modeToggleBtn = document.getElementById('mode-toggle');
let isOverviewMode  = false; // mobile overview mode
let mosaicLayout     = [];   // positions/sizes for overview mosaic

// Mobile logo scaling - more robust
function applyMobileLogoScaling() {
  const logoFrame = document.querySelector('.logo-frame');
  if (logoFrame) {
    try {
      const logoDoc = logoFrame.contentDocument || logoFrame.contentWindow.document;
      if (logoDoc && logoDoc.head) {
        // Remove any existing mobile scaling styles
        const existingStyle = logoDoc.querySelector('style[data-mobile-scaling]');
        if (existingStyle) {
          existingStyle.remove();
        }
        
        const style = logoDoc.createElement('style');
        style.setAttribute('data-mobile-scaling', 'true');
        style.textContent = `
          @media (max-width: 768px) {
            .logo-wrapper { 
              transform: scale(0.3) !important; /* Much smaller to fit properly */
              transform-origin: center center;
            }
            .logo-container {
              margin-bottom: 5px !important; /* Smaller margin */
              left: 0 !important;
            }
          }
        `;
        logoDoc.head.appendChild(style);
        console.log('✅ Mobile logo scaling applied');
      }
    } catch (e) {
      console.log('Could not access iframe content:', e);
    }
  }
}

// Apply scaling on load and when iframe loads
window.addEventListener('load', () => {
  if (window.innerWidth <= 768) {
    applyMobileLogoScaling();
  }
});

// Also apply when iframe loads
document.addEventListener('DOMContentLoaded', () => {
  const logoFrame = document.querySelector('.logo-frame');
  if (logoFrame) {
    logoFrame.addEventListener('load', () => {
      if (window.innerWidth <= 768) {
        applyMobileLogoScaling();
      }
    });
  }
});

// Apply on resize to handle orientation changes
window.addEventListener('resize', () => {
  if (window.innerWidth <= 768) {
    setTimeout(applyMobileLogoScaling, 100); // Small delay to ensure iframe is ready
  }
});

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

// 4) Enhanced swipe/wheel for mobile vertical layout
let wheelCooldown = false,
    touchStartX   = 0,
    touchStartY   = 0,
    pinchStartDist = null,
    pinchStartScale = 1;

coverflowEl.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
coverflowEl.addEventListener('touchstart', e => { 
  touchStartX = e.touches[0].screenX;
  touchStartY = e.touches[0].screenY;
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    pinchStartDist = Math.hypot(dx, dy);
    pinchStartScale = isOverviewMode ? 0.8 : 1;
  } else {
    pinchStartDist = null;
  }
}, { passive: true });
coverflowEl.addEventListener('touchend', e => {
  const diffX = e.changedTouches[0].screenX - touchStartX;
  const diffY = e.changedTouches[0].screenY - touchStartY;
  const isCurrentlyMobile = window.innerWidth <= 768;
  
  if (isCurrentlyMobile) {
    // Mobile: vertical swipes (reversed direction)
    if (Math.abs(diffY) > 60 && Math.abs(diffY) > Math.abs(diffX)) {
      setActiveIndex(activeIndex + (diffY < 0 ? 1 : -1)); // Reversed: swipe up = next, swipe down = previous
    }
  } else {
    // Desktop: horizontal swipes
    if (Math.abs(diffX) > 60) {
      setActiveIndex(activeIndex + (diffX < 0 ? 1 : -1));
    }
  }
}, { passive: true });

coverflowEl.addEventListener('touchmove', e => {
  if (e.touches.length === 2 && pinchStartDist) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const ratio = dist / pinchStartDist;
    // Enter overview on pinch-out; while in overview, scale smoothly
    if (!isOverviewMode && ratio < 0.96) {
      toggleOverview(true);
      document.body.style.setProperty('--overview-scale', '0.9');
    }
    if (isOverviewMode) {
      const clamped = Math.max(0.75, Math.min(1.0, ratio));
      document.body.style.setProperty('--overview-scale', String(clamped));
    }
  }
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

// 6) Layout params - Enhanced for mobile vertical layout
function updateLayoutParameters() {
  const vw = window.innerWidth;
  const isCurrentlyMobile = vw <= 768;

  if (isCurrentlyMobile) {
    // Mobile uses vertical layout - no coverflow spacing needed
    coverSpacing   = 0;
    anglePerOffset = 0;
    minScale       = 0.95;
    
    // Update container for vertical layout
    const container = document.getElementById('coverflow-container');
    if (container) {
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.alignItems = 'center';
      container.style.gap = 'clamp(16px, 4vh, 32px)';
      container.style.width = '100%';
      container.style.maxWidth = isOverviewMode ? '100%' : '400px';
      container.style.margin = '0 auto';
    }
  } else {
    // Desktop coverflow parameters
    coverSpacing   = Math.max(150, vw * 0.18);
    anglePerOffset = vw < 600 ? 50 : 65;
    minScale       = vw < 600 ? 0.45 : 0.5;
    
    // Reset container for horizontal layout
    const container = document.getElementById('coverflow-container');
    if (container) {
      container.style.display = '';
      container.style.flexDirection = '';
      container.style.alignItems = '';
      container.style.gap = '';
      container.style.width = '';
      container.style.maxWidth = '';
      container.style.margin = '';
    }
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
    if (c.frontImage) {
      frontFace.dataset.image = c.frontImage;
      // Set background image immediately for visible covers
      if (Math.abs(i - activeIndex) <= 5) {
        frontFace.style.backgroundImage = `url('${c.frontImage}')`;
        frontFace.classList.add('loaded');
      }
    }
    
    // Back face
    const backFace = document.createElement('div');
    backFace.className = 'cover-back';
    
    // Create back content based on cover type
    let backContent = '<div class="back-content">';
    
    // Check if cover has custom back text content
    if (c.backText) {
      backContent += `
        <div class="text-content-wrapper">
          <div class="text-content">
            ${c.backText}
          </div>
        </div>
      `;
    } else if (c.albumTitle?.toLowerCase() === 'contact') {
      // Contact card
      backContent += `
        <a href="mailto:hi@allmyfriendsinc.com" class="contact-card">
          <div class="contact-icon">✉️</div>
          <span>Say&nbsp;Hello</span>
        </a>
      `;
    } else if (c.music?.type === 'embed' && c.music.url) {
      // Spotify embed
      const spotifyUrl = c.music.url;
      let embedUrl = spotifyUrl;
      
      // Convert regular Spotify URLs to embed URLs
      if (spotifyUrl.includes('spotify.com/track/')) {
        embedUrl = spotifyUrl.replace('spotify.com/', 'spotify.com/embed/');
        embedUrl += embedUrl.includes('?') ? '&' : '?';
        embedUrl += 'utm_source=generator&theme=0'; // dark theme
      } else if (spotifyUrl.includes('spotify.com/playlist/') || spotifyUrl.includes('spotify.com/album/')) {
        embedUrl = spotifyUrl.replace('spotify.com/', 'spotify.com/embed/');
        embedUrl += embedUrl.includes('?') ? '&' : '?';
        embedUrl += 'utm_source=generator&theme=0'; // dark theme
      }
      
      backContent += `
        <div class="spotify-embed-wrapper">
          <div class="spotify-loading"></div>
          <div class="spotify-embed-container">
            <iframe
              style="border-radius:12px"
              src="${embedUrl}"
              width="100%"
              height="152"
              frameBorder="0"
              allowfullscreen=""
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              onload="this.parentElement.previousElementSibling.remove()">
            </iframe>
          </div>
          ${c.frontImage ? `<div class="album-art-preview" style="background-image: url('${c.frontImage}')"></div>` : ''}
          <div class="spotify-branding">
            <svg viewBox="0 0 24 24">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            <span>Spotify</span>
          </div>
        </div>
      `;
    } else {
      // Default empty back
      backContent += '<p style="color: rgba(255,255,255,0.5); text-align: center;">No content available</p>';
    }
    
    backContent += '</div>';
    backFace.innerHTML = backContent;
    
    flipContainer.appendChild(frontFace);
    flipContainer.appendChild(backFace);
    
    // Add info button inside flip container if artist details exist
    if (c.artistDetails) {
      const infoBtn = document.createElement('button');
      infoBtn.className = 'info-button';
      infoBtn.innerHTML = '<span>+</span>';
      infoBtn.setAttribute('aria-label', 'Artist information');
      flipContainer.appendChild(infoBtn);
    }
    
    wrapper.appendChild(flipContainer);
    
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
      
      // In overview mode, a tap selects and exits to focus
      if (isOverviewMode) {
        const idx = +wrapper.dataset.index;
        activeIndex = idx;
        toggleOverview(false);
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
        // Check if this cover has text content instead of spotify embed
        const coverData = covers[idx];
        if (coverData.backText && !fc.classList.contains('flipped')) {
          // Open text modal instead of flipping
          openTextModal(coverData);
        } else {
          fc.classList.toggle('flipped');
        }
      } else {
        activeIndex = idx;
        renderCoverFlow();
      }
    });
    
    coverflowEl.appendChild(wrapper);
  });
  
  // Set up lazy loading for background images
  setupLazyLoading();

  // Prepare initial mosaic metadata (size/shape variety) for mobile overview
  if (window.innerWidth <= 768) {
    mosaicLayout = covers.map((_, idx) => ({
      size: idx % 7 === 0 ? 'size-l' : idx % 3 === 0 ? 'size-m' : 'size-s',
      shape: idx % 5 === 0 ? 'shape-hex' : idx % 2 === 0 ? 'shape-rounded' : 'shape-circle'
    }));
    document.querySelectorAll('.cover').forEach((el, i) => {
      const meta = mosaicLayout[i];
      el.classList.add(meta.size, meta.shape);
    });
  }
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
          // Set the background image directly
          element.style.backgroundImage = `url('${imageUrl}')`;
          element.classList.add('loaded');
          observer.unobserve(element);
        }
      }
    });
  }, imageOptions);
  
  // Observe all cover fronts that haven't loaded yet
  document.querySelectorAll('.cover-front[data-image]:not(.loaded)').forEach(el => {
    imageObserver.observe(el);
  });
}

// 8) 3D layout - Enhanced for mobile vertical layout
function renderCoverFlow() {
  const isCurrentlyMobile = window.innerWidth <= 768;
  
  document.querySelectorAll('.cover').forEach(cover => {
    const i      = +cover.dataset.index;
    const offset = i - activeIndex;
    
    if (isCurrentlyMobile && !isOverviewMode) {
      // Mobile vertical layout - simpler positioning
      cover.style.position = 'relative';
      cover.style.left = '';
      cover.style.top = '';
      
      if (offset === 0) {
        cover.style.transform = 'scale(1.05)';
        cover.style.opacity = '1';
        cover.style.filter = 'none';
        cover.style.zIndex = '10';
      } else {
        cover.style.transform = 'scale(0.95)';
        cover.style.opacity = '0.7';
        cover.style.filter = 'blur(1px)';
        cover.style.zIndex = '1';
      }
    } else if (isCurrentlyMobile && isOverviewMode) {
      // Overview mosaic - absolute positions calculated after loop
      cover.style.position = 'absolute';
      cover.style.opacity = '1';
      cover.style.filter = 'none';
      cover.style.zIndex = '1';
    } else {
      // Desktop coverflow positioning
      const eff    = Math.sign(offset) * Math.log2(Math.abs(offset) + 1);
      const scale  = Math.max(minScale, 1 - Math.abs(offset) * 0.08);
      const tx     = eff * coverSpacing;
      const ry     = Math.max(-maxAngle, Math.min(offset * -anglePerOffset, maxAngle));

      cover.style.position = 'absolute';
      cover.style.left = '50%';
      cover.style.top = '50%';
      cover.style.opacity = '';
      
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
    }
    
    cover.querySelector('.flip-container')?.classList.remove('flipped');
    cover.classList.toggle('cover-active', !isOverviewMode && offset === 0);
  });
  
  // Scroll to active cover on mobile when not in overview
  if (isCurrentlyMobile && !isOverviewMode) {
    setTimeout(() => {
      const activeCover = document.querySelector('.cover-active');
      if (activeCover) {
        activeCover.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center'
        });
      }
    }, 100);
  }
  
  updateAmbient();

  // Layout overview mosaic positions
  if (isCurrentlyMobile && isOverviewMode) {
    const padding = 10;
    let cursorX = padding;
    let cursorY = padding + 10;
    let rowHeight = 0;

    const containerWidth = coverflowEl.clientWidth;
    const coversEls = Array.from(document.querySelectorAll('.cover'));
    coversEls.forEach((el, i) => {
      const meta = mosaicLayout[i] || { size: 'size-s' };
      // Measure using computed size from CSS classes
      const rect = el.getBoundingClientRect();
      let w = rect.width;
      if (!w || w === 0) {
        // Fallback approximate sizes
        w = meta.size === 'size-l' ? Math.min(window.innerWidth * 0.4, 240)
          : meta.size === 'size-m' ? Math.min(window.innerWidth * 0.34, 200)
          : Math.min(window.innerWidth * 0.28, 160);
      }
      const h = w;
      if (cursorX + w + padding > containerWidth) {
        cursorX = padding;
        cursorY += rowHeight + padding;
        rowHeight = 0;
      }
      const cx = cursorX + w / 2;
      const cy = cursorY + h / 2;
      el.style.left = `${cx}px`;
      el.style.top  = `${cy}px`;
      el.style.transform = 'translate(-50%, -50%)';
      cursorX += w + padding;
      rowHeight = Math.max(rowHeight, h);
    });
    // Subtle organic jitter/rotation
    coversEls.forEach((el, idx) => {
      const jitter = (n) => (Math.random() - 0.5) * n;
      el.style.left = `calc(${el.style.left} + ${jitter(10)}px)`;
      el.style.top  = `calc(${el.style.top} + ${jitter(6)}px)`;
      el.style.rotate = `${jitter(2)}deg`;
    });
  }
}

// 9) Keyboard & ESC
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft')  setActiveIndex(activeIndex - 1);
  if (e.key === 'ArrowRight') setActiveIndex(activeIndex + 1);
  if (e.key === 'Escape')     document.querySelector('.artist-modal').classList.add('hidden');
});

// Text content modal
function openTextModal(cover) {
  const modal = document.querySelector('.artist-modal');
  if (!modal) return;
  
  const modalContent = modal.querySelector('.modal-content');
  
  // Use the front cover image as the banner
  const bannerImage = cover.frontImage || '';
  
  modalContent.innerHTML = `
    ${bannerImage ? `<img src="${bannerImage}" alt="${cover.albumTitle || ''}" class="artist-photo">` : ''}
    <div class="artist-info">
      <h2 class="artist-name">${cover.albumTitle || 'About'}</h2>
      <div class="text-content-modal">
        ${cover.backText}
      </div>
    </div>
  `;
  
  modal.classList.remove('hidden');
  modal.classList.add('show');
  
  // Close on background click
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeArtistModal();
    }
  };
  
  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeArtistModal();
      window.removeEventListener('keydown', handleEscape);
    }
  };
  window.addEventListener('keydown', handleEscape);
}

// 10) Modal open function
function openArtistModal(cover) {
  const modal = document.querySelector('.artist-modal');
  if (!modal) return;
  
  const modalContent = modal.querySelector('.modal-content');
  
  // Use the front cover image as the banner, fallback to artist image
  const bannerImage = cover.frontImage || cover.artistDetails?.image || '';
  
  modalContent.innerHTML = `
    ${bannerImage ? `<img src="${bannerImage}" alt="${cover.artistDetails?.name || ''}" class="artist-photo">` : ''}
    <div class="artist-info">
      <h2 class="artist-name">${cover.artistDetails?.name || 'Unknown Artist'}</h2>
      ${cover.artistDetails?.location ? `<p class="artist-location">${cover.artistDetails.location}</p>` : ''}
      ${cover.artistDetails?.bio ? `<p class="artist-bio">${cover.artistDetails.bio}</p>` : ''}
      ${cover.artistDetails?.spotifyLink ? 
        `<a href="${cover.artistDetails.spotifyLink}" target="_blank" class="spotify-button">
          Listen on Spotify
        </a>` : ''
      }
    </div>
  `;
  
  modal.classList.remove('hidden');
  modal.classList.add('show');
  
  // Close on background click
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeArtistModal();
    }
  };
  
  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeArtistModal();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

function closeArtistModal() {
  const modal = document.querySelector('.artist-modal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 300);
  }
}

// 11) Filter dropdown with proper cleanup
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
        
        // No special redirect needed - contact cover will show normally
        
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
        // Check if active cover has text content
        const coverData = covers[activeIndex];
        if (coverData.backText && !activeCover.classList.contains('flipped')) {
          openTextModal(coverData);
        } else {
          activeCover.classList.toggle('flipped');
          announceFlipState(activeCover.classList.contains('flipped'));
        }
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

// 16) Overview mode toggle & helpers
function toggleOverview(force) {
  const isMobileView = window.innerWidth <= 768;
  const target = typeof force === 'boolean' ? force : !isOverviewMode;
  if (!isMobileView && target) return; // only enable overview on mobile
  isOverviewMode = target;
  document.body.classList.toggle('overview-active', isOverviewMode);
  if (modeToggleBtn) {
    modeToggleBtn.setAttribute('aria-label', isOverviewMode ? 'Switch to flow' : 'Switch to overview');
    modeToggleBtn.title = isOverviewMode ? 'Flow' : 'Overview';
  }
  // When entering overview, start near a modest zoomed-out feel by scrolling to top
  if (isOverviewMode) {
    coverflowEl.scrollTo({ top: 0, behavior: 'smooth' });
  }
  updateLayoutParameters();
  renderCoverFlow();
}

modeToggleBtn?.addEventListener('click', () => toggleOverview());

// 17) Gentle discoverability hint (one-time per session)
(function showGestureHintOnce(){
  const isMobileView = window.innerWidth <= 768;
  if (!isMobileView) return;
  if (sessionStorage.getItem('amf-gesture-hint-shown')) return;
  const hint = document.createElement('div');
  hint.className = 'gesture-hint';
  hint.textContent = 'Pinch to zoom out. Tap ▥ to toggle overview.';
  document.body.appendChild(hint);
  sessionStorage.setItem('amf-gesture-hint-shown', '1');
  setTimeout(()=>{ hint.classList.add('hide'); }, 3500);
  setTimeout(()=>{ hint.remove(); }, 4500);
})();


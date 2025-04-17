// public/index.js
// == index.js ==

// 1) Core globals and mobile flag
let allCovers = [];
let covers = [];
let activeIndex = 0;
let coverSpacing, anglePerOffset, minScale;
const maxAngle = 80;
const isMobile = window.matchMedia('(max-width:768px)').matches;

const coverflowEl = document.getElementById('coverflow');
const hoverDisplay = document.getElementById('hover-credits');

// 2) Particle trails setup
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
      x: trailCanvas.width/2,
      y: trailCanvas.height/2,
      vx: delta*(Math.random()*0.2+0.1),
      vy: (Math.random()-0.5)*2,
      life: 60
    });
  }
}

function animateTrails() {
  trailCtx.clearRect(0,0,trailCanvas.width,trailCanvas.height);
  particles.forEach((p,i) => {
    trailCtx.globalAlpha = p.life/60;
    trailCtx.beginPath();
    trailCtx.arc(p.x,p.y,3,0,Math.PI*2);
    trailCtx.fill();
    p.x += p.vx; p.y += p.vy; p.life--;
    if (p.life <= 0) particles.splice(i,1);
  });
  requestAnimationFrame(animateTrails);
}
animateTrails();

// 3) Ambient reactive glow
function updateAmbient() {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = covers[activeIndex]?.frontImage;
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 10;
    const ctx = c.getContext('2d');
    ctx.drawImage(img,0,0,10,10);
    const [r,g,b] = ctx.getImageData(0,0,10,10).data;
    document.getElementById('ambient-light')
            .style.backgroundColor = `rgba(${r},${g},${b},0.4)`;
  };
}

// 4) Prevent native vertical scroll & handle horizontal swipe/wheel
let wheelCooldown = false, touchStartX = 0;
coverflowEl.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

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

coverflowEl.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].screenX;
});
coverflowEl.addEventListener('touchend', e => {
  const diff = e.changedTouches[0].screenX - touchStartX;
  if (Math.abs(diff) > 60) {
    setActiveIndex(activeIndex + (diff < 0 ? 1 : -1));
  }
});

// 5) Fetch styles & covers data
fetch('/data/test-styles.json')
  .then(r => r.json())
  .then(style => {
    document.getElementById('global-styles').innerHTML = `
      html, body {
        font-family: '${style.fontFamily||'GT America'}', sans-serif;
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
    allCovers = data;
    covers    = [...allCovers];
    activeIndex = Math.floor(covers.length/2);
    updateLayoutParameters();
    renderCovers();
    renderCoverFlow();
  })
  .catch(console.error);

// 6) Layout params
function updateLayoutParameters() {
  const vw = window.innerWidth;
  coverSpacing   = Math.max(120, vw * 0.18);
  anglePerOffset = vw < 600 ? 50 : 65;
  minScale       = vw < 600 ? 0.45 : 0.5;
}

// 7) Render covers (unchanged)
function renderCovers() { /* … your existing code … */ }

// 8) Render coverflow
function renderCoverFlow() { /* … your existing code … */ }

// 9) Keyboard nav & modal logic (unchanged)
window.addEventListener('keydown', /* … */);
document.body.addEventListener('click', /* … */);

// 10) Filter dropdown + click logic (unchanged)
const filterButtons = Array.from(document.querySelectorAll('.filter-label'));
// … existing dropdown & click handlers …

// 11) Recalculate layout on window resize
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    updateLayoutParameters();
    renderCoverFlow();
    resizeTrailCanvas();
  }, 120);
});

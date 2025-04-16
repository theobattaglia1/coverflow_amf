// Particle trails setup
const trailCanvas = document.getElementById('trail-canvas');
const trailCtx = trailCanvas.getContext('2d');
let particles = [];

function resizeTrailCanvas() {
  trailCanvas.width = coverflowEl.clientWidth;
  trailCanvas.height = coverflowEl.clientHeight;
}
window.addEventListener('resize', resizeTrailCanvas);
resizeTrailCanvas();

function emitParticles(vx) {
  const count = Math.min(Math.abs(vx) / 5, 10);
  for (let i = 0; i < count; i++) {
    particles.push({
      x: trailCanvas.width / 2,
      y: trailCanvas.height / 2,
      vx: vx * (Math.random() * 0.2 + 0.1),
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

// Ambient light update
function updateAmbient() {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = covers[activeIndex]?.frontImage;
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 10;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, 10, 10);
    const data = ctx.getImageData(0, 0, 10, 10).data;
    const r = data[0], g = data[1], b = data[2];
    document.getElementById('ambient-light')
      .style.backgroundColor = `rgba(${r},${g},${b},0.4)`;
  };
}

// Kinetic swipe state
let wheelEvents = [], momentumTimer;

function onWheel(e) {
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
  e.preventDefault();
  emitParticles(e.deltaX);

  const now = performance.now();
  wheelEvents.push({ dx: e.deltaX, t: now });
  wheelEvents = wheelEvents.filter(ev => now - ev.t < 100);

  setActiveIndex(activeIndex + (e.deltaX > 0 ? 1 : -1));

  clearTimeout(momentumTimer);
  momentumTimer = setTimeout(applyMomentum, 50);
}

function applyMomentum() {
  const sum = wheelEvents.reduce((s, ev) => s + ev.dx, 0);
  let v = sum / wheelEvents.length / 10;
  function step() {
    if (Math.abs(v) < 0.2) return;
    setActiveIndex(activeIndex + (v > 0 ? 1 : -1));
    v *= 0.9;
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

window.addEventListener('wheel', onWheel, { passive: false });

// Main script rest (unchanged):
let allCovers = [];
let covers = [];
let activeIndex = 0;
let coverSpacing, anglePerOffset, minScale;
const maxAngle = 80;

const coverflowEl = document.getElementById('coverflow');
const hoverDisplay = document.getElementById('hover-credits');

// Inject global font/style
fetch('/data/test-styles.json')
  .then(res => res.json())
  .then(style => {
    const styleTag = document.createElement('style');
    styleTag.id = 'global-styles';
    const font = style.fontFamily || 'GT America';
    const size = style.fontSize || 16;
    styleTag.innerHTML = `
      html, body {
        font-family: '${font}', sans-serif;
        font-size: ${size}px;
      }
      .cover-label {
        font-family: '${style.overrides?.coverLabel?.fontFamily || font}';
        font-size: ${style.overrides?.coverLabel?.fontSize || 14}px;
      }
      .filter-label {
        font-family: '${style.overrides?.filterLabel?.fontFamily || font}';
        font-size: ${style.overrides?.filterLabel?.fontSize || 13}px;
      }
      .hover-credits-container {
        font-family: '${style.overrides?.hoverCredits?.fontFamily || font}';
        font-size: ${style.overrides?.hoverCredits?.fontSize || 12}px;
      }
    `;
    document.head.appendChild(styleTag);
  });

fetch(`/data/covers.json?cachebust=${Date.now()}`)
  .then(res => res.json())
  .then(data => {
    allCovers = data;
    covers = [...allCovers];
    activeIndex = Math.floor(covers.length / 2);
    updateLayoutParameters();
    renderCovers();
    renderCoverFlow();
  })
  .catch(err => console.error('Error fetching covers:', err));

function updateLayoutParameters() {
  const vw = window.innerWidth;
  coverSpacing = Math.max(120, vw * 0.18);
  anglePerOffset = vw < 600 ? 50 : 65;
  minScale = vw < 600 ? 0.45 : 0.5;
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
    const backContent = document.createElement('div');
    backContent.className = 'back-content';
    if (cover.music?.type === 'embed' && cover.music.url) {
      backContent.innerHTML = `
        <iframe style="border-radius:12px"
          src="${cover.music.url.replace('spotify.com/', 'spotify.com/embed/') }"
          width="100%" height="352" frameBorder="0"
          allowfullscreen allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"></iframe>`;
    }
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
    }
    back.appendChild(backContent);
    flip.appendChild(front);
    flip.appendChild(back);
    wrapper.appendChild(flip);
    wrapper.addEventListener('click', () => {
      const i = parseInt(wrapper.dataset.index,10);
      const offset = i - activeIndex;
      const flipContainer = wrapper.querySelector('.flip-container');
      if(offset===0 && flipContainer) flipContainer.classList.toggle('flipped');
      else setActiveIndex(i);
    });
    coverflowEl.appendChild(wrapper);
  });
}

function renderCoverFlow() {
  document.querySelectorAll('.cover').forEach(cover => {
    const i = parseInt(cover.dataset.index, 10);
    const offset = i - activeIndex;
    const effOffset = Math.sign(offset) * Math.log2(Math.abs(offset) + 1);
    const translateX = effOffset * coverSpacing;
    const rotateY = Math.max(-maxAngle, Math.min(offset * -anglePerOffset, maxAngle));
    const scale = Math.max(minScale, 1 - Math.abs(offset) * 0.08);
    cover.style.transform = `translate(-50%, -50%) translateX(${translateX}px) scale(${scale}) rotateY(${rotateY}deg)`;
    cover.style.filter = offset===0 ? 'none' : `blur(${Math.min(Math.abs(offset)*2,8)}px)`;
    cover.style.zIndex = covers.length - Math.abs(offset);
    const flipContainer = cover.querySelector('.flip-container');
    if(offset!==0) flipContainer?.classList.remove('flipped');
    cover.classList.toggle('cover-active', offset===0);
  });
  updateAmbient();
}

function setActiveIndex(idx) {
  activeIndex = Math.max(0,Math.min(idx, covers.length -1));
  renderCoverFlow();
}

// Arrow key navigation + modal close
document.defaultView.addEventListener('keydown', e => {
  if(e.key==='ArrowLeft') setActiveIndex(activeIndex-1);
  if(e.key==='ArrowRight') setActiveIndex(activeIndex+1);
  if(e.key==='Escape'){ document.querySelector('.artist-modal').classList.add('hidden'); }
});

// Modal logic unchanged... etc.

// == index.js ==

// 1) Globals
let allCovers = [], covers = [], activeIndex = 0;
let coverSpacing, anglePerOffset, minScale;
const maxAngle = 80, isMobile = window.matchMedia('(max-width:768px)').matches;
const coverflowEl = document.getElementById('coverflow'),
      hoverDisplay = document.getElementById('hover-credits');

// 2) Trails
const trailCanvas = document.getElementById('trail-canvas'),
      trailCtx    = trailCanvas.getContext('2d');
let particles = [];
function resizeTrailCanvas() {
  trailCanvas.width = coverflowEl.clientWidth;
  trailCanvas.height= coverflowEl.clientHeight;
}
window.addEventListener('resize', resizeTrailCanvas, {passive:true});
resizeTrailCanvas();

function emitParticles(delta) {
  const count = Math.min(Math.abs(delta)/5,10);
  for (let i=0; i<count; i++) {
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
    p.x+=p.vx; p.y+=p.vy; p.life--;
    if (p.life<=0) particles.splice(i,1);
  });
  requestAnimationFrame(animateTrails);
}
animateTrails();

// 3) Ambient glow
function updateAmbient() {
  const img = new Image(); img.crossOrigin='anonymous';
  img.src = covers[activeIndex]?.frontImage;
  img.onload = () => {
    const c = document.createElement('canvas'); c.width=c.height=10;
    const cx = c.getContext('2d');
    cx.drawImage(img,0,0,10,10);
    const [r,g,b] = cx.getImageData(0,0,10,10).data;
    document.getElementById('ambient-light')
      .style.backgroundColor = `rgba(${r},${g},${b},0.4)`;
  };
}

// 4) Horizontal swipe/wheel only
let wheelCooldown=false, touchStartX=0;
coverflowEl.addEventListener('touchmove', e=>e.preventDefault(), {passive:false});
coverflowEl.addEventListener('touchstart', e=>{ touchStartX=e.touches[0].screenX; }, {passive:true});
coverflowEl.addEventListener('touchend', e=>{
  const diff = e.changedTouches[0].screenX - touchStartX;
  if (Math.abs(diff)>60) setActiveIndex(activeIndex + (diff<0?1:-1));
}, {passive:true});
window.addEventListener('wheel', e=>{
  if (Math.abs(e.deltaX)<=Math.abs(e.deltaY)) return;
  e.preventDefault();
  if (!wheelCooldown) {
    emitParticles(e.deltaX);
    setActiveIndex(activeIndex + (e.deltaX>0?1:-1));
    wheelCooldown=true;
    setTimeout(()=>wheelCooldown=false,120);
  }
},{passive:false});

// 5) Fetch styles & covers
fetch('/data/test-styles.json').then(r=>r.json()).then(style=>{
  document.getElementById('global-styles').innerHTML = `
    html,body {
      font-family:'${style.fontFamily||'GT America'}',sans-serif;
      font-size:${style.fontSize||16}px;
    }
  `;
});
fetch(`/data/covers.json?cb=${Date.now()}`)
  .then(r=>r.json())
  .then(data=>{
    allCovers = data;
    covers    = [...allCovers];
    // center exactly in the middle—even for even lengths:
    activeIndex = Math.floor((covers.length - 1) / 2);
    updateLayoutParameters();
    renderCovers();
    renderCoverFlow();
  })
  .catch(console.error);

// 6) Layout params
function updateLayoutParameters(){
  const vw = window.innerWidth;
  coverSpacing   = Math.max(120, vw * 0.18);
  anglePerOffset = vw < 600 ? 50 : 65;
  minScale       = vw < 600 ? 0.45 : 0.5;
}

// 7) Render covers
function renderCovers(){
  coverflowEl.innerHTML = '';
  covers.forEach((cover,i)=>{
    const wrapper = document.createElement('div');
    wrapper.className = 'cover';
    wrapper.dataset.index = i;
    wrapper.dataset.originalIndex = cover.id;
    wrapper.dataset.category = cover.category;

    const flip = document.createElement('div');
    flip.className='flip-container';

    const front = document.createElement('div');
    front.className='cover-front';
    front.style.backgroundImage = `url('${cover.frontImage}')`;

    const back = document.createElement('div');
    back.className='cover-back';

    const backContent = document.createElement('div');
    backContent.className='back-content';

    if (cover.albumTitle?.toLowerCase()==='contact'){
      const contactBtn = document.createElement('a');
      contactBtn.href='mailto:hi@allmyfriendsinc.com';
      contactBtn.innerText='Contact Us';
      contactBtn.className='expand-btn';
      backContent.appendChild(contactBtn);
    } else {
      const artistBtn = document.createElement('button');
      artistBtn.className='expand-btn';
      artistBtn.innerText='Artist Details';
      backContent.appendChild(artistBtn);

      // TOP label
      const topLabel = document.createElement('div');
      topLabel.className='back-label';
      topLabel.innerHTML = `<strong>${cover.albumTitle||''}</strong><br/>${cover.coverLabel||''}`;
      wrapper.appendChild(topLabel);

      if (cover.music?.type==='embed'&&cover.music.url) {
        backContent.innerHTML+=`
          <iframe style="border-radius:12px"
            src="${cover.music.url.replace('spotify.com/','spotify.com/embed/')}"
            width="100%" height="352" frameborder="0"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"></iframe>`;
      }
    }

    back.appendChild(backContent);
    flip.appendChild(front);
    flip.appendChild(back);
    wrapper.appendChild(flip);

    // click/flip
    wrapper.addEventListener('click', ()=>{
      const idx = +wrapper.dataset.index;
      const off = idx - activeIndex;
      const fc  = wrapper.querySelector('.flip-container');
      if(off===0 && fc) fc.classList.toggle('flipped');
      else setActiveIndex(idx);
    });

    coverflowEl.appendChild(wrapper);
  });
}

// 8) 3D layout
function renderCoverFlow(){
  document.querySelectorAll('.cover').forEach(cover=>{
    const i=+cover.dataset.index;
    const offset=i-activeIndex;
    const eff=Math.sign(offset)*Math.log2(Math.abs(offset)+1);
    const scale=Math.max(minScale,1-Math.abs(offset)*0.08);
    const tx=eff*coverSpacing;
    const ry=Math.max(-maxAngle,Math.min(offset*-anglePerOffset,maxAngle));

    cover.style.transform=`
      translate(-50%,-50%)
      translateX(${tx}px)
      scale(${scale})
      rotateY(${ry}deg)
    `;
    cover.style.filter = offset===0 ? 'none' : `blur(${Math.min(Math.abs(offset),4)}px)`;
    cover.style.zIndex = covers.length - Math.abs(offset);
    cover.querySelector('.flip-container')?.classList.remove('flipped');
    cover.classList.toggle('cover-active', offset===0);
  });
  updateAmbient();
}

// 9) Keyboard & ESC
window.addEventListener('keydown', e=>{
  if(e.key==='ArrowLeft') setActiveIndex(activeIndex-1);
  if(e.key==='ArrowRight')setActiveIndex(activeIndex+1);
  if(e.key==='Escape')    document.querySelector('.artist-modal').classList.add('hidden');
});

// 10) Modal open
document.body.addEventListener('click', e=>{
  if(e.target.classList.contains('expand-btn') && e.target.tagName==='BUTTON'){
    const cid= e.target.closest('.cover').dataset.originalIndex;
    const cd = covers.find(c=>c.id==cid);
    if(!cd?.artistDetails) return;
    const modal = document.querySelector('.artist-modal');
    const photo = modal.querySelector('.artist-photo');
    const player= modal.querySelector('.spotify-player');
    const link  = cd.artistDetails.spotifyLink;

    // only set real image
    if(cd.artistDetails.image){
      photo.src = cd.artistDetails.image;
      photo.style.display='';
    } else photo.style.display='none';

    // only set real embed
    if(link?.includes('spotify.com')){
      player.src=link.replace('spotify.com/','spotify.com/embed/');
      player.style.display='';
    } else player.style.display='none';

    modal.querySelector('.artist-name').innerText     = cd.artistDetails.name;
    modal.querySelector('.artist-location').innerText = cd.artistDetails.location;
    modal.querySelector('.artist-bio').innerText      = cd.artistDetails.bio;
    modal.querySelector('.spotify-link').href         = link;
    modal.classList.remove('hidden');
  }
});

// 11) Modal close
document.querySelector('.artist-modal')
  .addEventListener('click', e=>{
    if(e.target.classList.contains('artist-modal')){
      const mc = e.target.querySelector('.modal-content');
      mc.classList.add('pulse-dismiss');
      setTimeout(()=>{
        e.target.classList.add('hidden');
        mc.classList.remove('pulse-dismiss');
      },250);
    }
  },{passive:true});
document.querySelector('.artist-modal .close-btn')
  .addEventListener('click', ()=>document.querySelector('.artist-modal').classList.add('hidden'), {passive:true});

// 12) Filter dropdown (hover & click)
const filterButtons = Array.from(document.querySelectorAll('.filter-label'));
const filterDropdown = document.createElement('div');
filterDropdown.className='filter-dropdown';
document.body.appendChild(filterDropdown);

filterButtons.forEach(btn=>{
  btn.addEventListener('mouseenter',()=>{
    const f=btn.dataset.filter;
    const res=allCovers.filter(c=>f==='all'||c.category?.includes(f));
    filterDropdown.innerHTML = res.map(c=>
      `<div class="dropdown-item" data-id="${c.id}">${c.albumTitle||'Untitled'} — ${c.coverLabel||''}</div>`
    ).join('')||`<div class="dropdown-item">No results</div>`;
    filterDropdown.style.display='block';
    const r=btn.getBoundingClientRect();
    filterDropdown.style.left=`${r.left}px`;
    filterDropdown.style.top= `${r.bottom+5}px`;
  },{passive:true});

  btn.addEventListener('mouseleave',()=>{ if(!filterDropdown.matches(':hover')) filterDropdown.style.display='none'; },{passive:true});

  btn.addEventListener('click',()=>{
    filterButtons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const f=btn.dataset.filter;
    covers = (f==='all'?[...allCovers]:allCovers.filter(c=>c.category?.includes(f)));
    activeIndex = Math.floor((covers.length-1)/2);
    renderCovers();
    renderCoverFlow();
  },{passive:true});
});

filterDropdown.addEventListener('mouseleave',()=>filterDropdown.style.display='none',{passive:true});
filterDropdown.addEventListener('click',e=>{
  const id=e.target.dataset.id;
  if(!id) return;
  const idx=covers.findIndex(c=>c.id.toString()===id);
  if(idx!==-1){
    setActiveIndex(idx);
    filterDropdown.style.display='none';
  }
},{passive:true});

// 13) Re‑center helper
function setActiveIndex(i){
  activeIndex = Math.max(0,Math.min(i,covers.length-1));
  renderCoverFlow();
}

// 14) Sync accordion open on desktop & reflow on resize
const acc = document.querySelector('.filter-accordion');
function syncAccordion(){
  if(window.innerWidth>=769) acc.setAttribute('open','');
  else acc.removeAttribute('open');
}
window.addEventListener('resize',()=>{
  syncAccordion();
  updateLayoutParameters();
  renderCoverFlow();
  resizeTrailCanvas();
},{passive:true});
syncAccordion();

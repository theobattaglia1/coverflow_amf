(() => {
  const ARTIST_ID = 'hudson-ingram';
  const log = msg => console.debug(`${new Date().toISOString()} – ${msg}`);
  let allCovers = [], covers = [], activeIndex = 0;

  const container = document.getElementById('coverflow');
  const filterUI = document.getElementById('filter-ui');
  const input = filterUI.querySelector('input');
  const headers = { 'X-Artist-ID': ARTIST_ID };

  // Fetch styles
  fetch(`/api/styles?ts=${Date.now()}`, { headers })
    .then(r => r.json())
    .then(styles => {
      const styleEl = document.createElement('style');
      let css = '';
      styles.fonts.forEach(f => {
        css += `
@font-face {
  font-family: '${f.name}';
  src: url('${f.url}');
}
`;
      });
      css += `
body {
  font-family: '${styles.fontFamily}';
  font-size: ${styles.fontSize}px;
}
`;
      styleEl.textContent = css;
      document.head.appendChild(styleEl);
      log('styles applied');
    });

  // Fetch covers
  fetch(`/api/covers?ts=${Date.now()}`, { headers })
    .then(r => r.json())
    .then(data => {
      allCovers = data.length ? data : [{ id:'empty', title:'No covers' }];
      covers = allCovers.slice();
      renderCoverFlow();
      log('covers rendered');
    });

  // render function
  function renderCoverFlow() {
    container.innerHTML = '';
    covers.forEach((c,i) => {
      const div = document.createElement('div');
      div.className = i===activeIndex ? 'cover active' : 'cover';
      if(c.url) {
        const img = document.createElement('img');
        img.src = c.url;
        img.alt = c.title;
        div.appendChild(img);
      } else {
        div.textContent = c.title || c.id;
      }
      const x = (i - activeIndex)*220;
      div.style.transform = `translateX(${x}px) scale(${i===activeIndex?1.2:0.8})`;
      container.appendChild(div);
    });
  }

  // filter
  input.addEventListener('input', e=>{
    const term = e.target.value.toLowerCase();
    covers = allCovers.filter(c=> (c.title||'').toLowerCase().includes(term));
    activeIndex = 0;
    renderCoverFlow();
    log('filtered');
  });

  // keyboard
  window.addEventListener('keydown', e=>{
    if(e.key==='ArrowRight' && activeIndex<covers.length-1) {
      activeIndex++; renderCoverFlow(); log('right');
    }
    if(e.key==='ArrowLeft' && activeIndex>0) {
      activeIndex--; renderCoverFlow(); log('left');
    }
  });

  // wheel
  container.addEventListener('wheel', e=>{
    e.preventDefault();
    activeIndex = e.deltaY>0
      ? Math.min(activeIndex+1, covers.length-1)
      : Math.max(activeIndex-1, 0);
    renderCoverFlow(); log('wheel');
  },{passive:false});

  // touch
  let startX=null;
  container.addEventListener('touchstart',e=> startX=e.touches[0].clientX);
  container.addEventListener('touchend',e=>{
    if(startX===null) return;
    const diff = e.changedTouches[0].clientX - startX;
    if(diff>50 && activeIndex>0) activeIndex--;
    if(diff<-50 && activeIndex<covers.length-1) activeIndex++;
    renderCoverFlow(); log('swipe');
    startX=null;
  });

  // resize
  window.addEventListener('resize',()=>{ renderCoverFlow(); log('resize'); });
})();

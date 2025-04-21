;(async function(){
  'use strict';
  console.debug('[Coverflow] init');
  const data = await fetch('/api/coverflow').then(r=>r.json());
  const cont = document.getElementById('coverflow');
  let current = 0;

  function render() {
    Array.from(cont.children).forEach((el,i) => {
      const offset = i - current;
      const abs = Math.abs(offset);
      el.style.opacity = abs>2 ? 0 : 1;
      el.style.transform = \`translateX(\${offset*260}px) translateZ(\${-abs*100}px) rotateY(\${offset*-45}deg)\`;
    });
  }

  data.forEach((item,i)=>{
    const el = document.createElement('div');
    el.className = 'coverflow__item';
    el.innerHTML = \`
      <img src="\${item.image}" alt="\${item.title}"/>
      <div class="coverflow__caption">
        <h3>\${item.title}</h3>
        <p>\${item.subtitle||''}</p>
      </div>\`;
    el.addEventListener('click', ()=>window.location.href=item.link);
    cont.appendChild(el);
  });

  window.addEventListener('keydown', e => {
    if (e.key==='ArrowRight' && current<data.length-1) { current++; render(); }
    if (e.key==='ArrowLeft'  && current>0)               { current--; render(); }
  });

  render();
  console.debug('[Coverflow] ready');
})();

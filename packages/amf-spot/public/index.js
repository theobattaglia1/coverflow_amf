;(async function(){
  let allCovers = [], covers = [], activeIndex = 0;
  const container = document.getElementById('covers-container');
  const input = document.querySelector('#filter-ui input');

  async function load(){
    const res = await fetch('/api/covers');
    allCovers = await res.json();
    covers = allCovers.slice();
    render();
  }

  function render(){
    container.innerHTML = '';
    covers.forEach((c,i) => {
      const el = document.createElement('div');
      el.textContent = c.title;
      el.className = 'cover' + (i===activeIndex?' active':'');
      container.appendChild(el);
    });
  }

  input.addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    covers = allCovers.filter(c=>c.title.toLowerCase().includes(term));
    activeIndex = 0; render();
  });

  window.addEventListener('keydown', e => {
    if(e.key==='ArrowRight' && activeIndex< covers.length-1) activeIndex++, render();
    if(e.key==='ArrowLeft'  && activeIndex>0)          activeIndex--, render();
  });

  await load();
})();

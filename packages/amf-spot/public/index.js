;(function(){
  const container = document.getElementById('covers-container');
  const input = document.querySelector('#filter-ui input');
  let allCovers = [], covers = [], activeIndex = 0;

  // Fetch initial data
  async function fetchData(){
    allCovers = await fetch('/api/covers').then(r=>r.json());
    covers = allCovers;
    render();
  }

  // Render covers into #covers-container
  function render(){
    if (!container) return;
    container.innerHTML = '';
    covers.forEach((c, i) => {
      const div = document.createElement('div');
      div.className = 'cover' + (i === activeIndex ? ' active' : '');
      div.textContent = c.title;
      container.appendChild(div);
    });
  }

  // Filter input
  input.addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    covers = allCovers.filter(c => c.title.toLowerCase().includes(term));
    activeIndex = 0;
    render();
  });

  // Arrow key navigation
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' && activeIndex < covers.length - 1) {
      activeIndex++;
      render();
    }
    if (e.key === 'ArrowLeft' && activeIndex > 0) {
      activeIndex--;
      render();
    }
  });

  fetchData();
})();

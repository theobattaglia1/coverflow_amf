;(async function(){
  let allCovers = [];
  let covers = [];
  let activeIndex = 0;

  const container = document.getElementById('covers-container');
  const input = document.querySelector('#filter-ui input');

  // Fetch data
  async function load() {
    const [cRes] = await Promise.all([
      fetch('/api/covers'),
    ]);
    allCovers = await cRes.json();
    covers = allCovers.slice();
    render();
  }

  // Render into #covers-container
  function render(){
    container.innerHTML = '';
    covers.forEach((c, i) => {
      const el = document.createElement('div');
      el.textContent = c.title;
      el.className = 'cover' + (i === activeIndex ? ' active' : '');
      container.appendChild(el);
    });
  }

  // Filter logic
  input.addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    covers = allCovers.filter(c => c.title.toLowerCase().includes(term));
    activeIndex = 0;
    render();
  });

  // Keyboard navigation
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

  // Initial load
  await load();
})();

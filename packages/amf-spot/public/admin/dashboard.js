// public/admin/dashboard.js
(async function(){
  const cf = document.getElementById('coverflow');
  let dragSrc = null;

  // Fetch and render covers
  async function loadCovers(){
    const res = await fetch('/api/covers', { headers: { 'X-Artist-ID': 'default' } });
    const covers = await res.json();
    cf.innerHTML = '';
    covers.forEach(c => {
      const div = document.createElement('div');
      div.className = 'cover';
      div.textContent = c.id;
      div.draggable = true;
      cf.append(div);
    });
    attachDragDrop();
  }

  // Setup simple HTML5 drag/drop
  function attachDragDrop(){
    cf.querySelectorAll('.cover').forEach(item => {
      item.addEventListener('dragstart', e => {
        dragSrc = e.target;
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      item.addEventListener('drop', e => {
        e.stopPropagation();
        if (dragSrc !== e.target) {
          cf.insertBefore(dragSrc, e.target.nextSibling);
        }
      });
    });
  }

  // Save new order back to server
  document.getElementById('save-order')
    .addEventListener('click', async () => {
      const payload = Array.from(cf.children).map(div => ({ id: div.textContent }));
      await fetch('/api/save-covers', {
        method: 'POST',
        headers: {
          'X-Artist-ID': 'default',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      alert('Cover order saved!');
    });

  // TODO: wire up audio/comments in the next step
  await loadCovers();
})();

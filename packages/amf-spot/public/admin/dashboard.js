/* public/admin/dashboard.js */
(async function(){
  // 1️⃣ Artist ID prompt / cache
  let artistID = localStorage.getItem('artistID');
  if(!artistID){
    artistID = prompt('Enter your X-Artist-ID header (e.g. hudson-ingram):','default');
    localStorage.setItem('artistID', artistID);
  }

  // 2️⃣ Cache‑buster
  const ts = ()=>Date.now();

  // 3️⃣ Fetch styles (e.g. fonts)
  const styleRes = await fetch(\`/api/styles?ts=\${ts()}\`, {
    headers: { 'X-Artist-ID': artistID }
  });
  const { fontFamily, fontSize, fonts } = await styleRes.json();
  // inject font/style
  const styleTag = document.createElement('style');
  styleTag.textContent = \`
    body { font-family: \${fontFamily}, sans-serif; font-size: \${fontSize}px; }
  \`;
  document.head.appendChild(styleTag);

  // 4️⃣ Fetch cover list
  async function loadCovers(){
    const res = await fetch(\`/api/covers?ts=\${ts()}\`, {
      headers: { 'X-Artist-ID': artistID }
    });
    return res.json();
  }

  // 5️⃣ Render covers into #showcase
  const showcase = document.getElementById('showcase');
  async function render(){
    showcase.innerHTML = '';
    const covers = await loadCovers();
    covers.forEach(c => {
      const div = document.createElement('div');
      div.className = 'cover';
      div.draggable = true;
      div.dataset.id = c.id;
      div.dataset.title = c.title || '';
      div.innerHTML = `
        <img src="\${c.url}" alt="\${c.title||''}" />
        <div class="title">\${c.title||'No Title'}</div>
      `;
      attachDnD(div);
      attachEdit(div);
      showcase.appendChild(div);
    });
  }

  // 6️⃣ Drag‑and‑drop reordering
  let dragSrc = null;
  function attachDnD(el){
    el.addEventListener('dragstart', e=>{
      dragSrc = el;
      el.classList.add('dragging');
    });
    el.addEventListener('dragover', e=>{
      e.preventDefault();
      el.classList.add('over');
    });
    el.addEventListener('dragleave', ()=> el.classList.remove('over'));
    el.addEventListener('drop', async e=>{
      e.stopPropagation();
      if(dragSrc !== el){
        showcase.insertBefore(dragSrc, el);
        await saveOrder();
      }
      el.classList.remove('over');
    });
    el.addEventListener('dragend', ()=> el.classList.remove('dragging'));
  }
  async function saveOrder(){
    const ordered = [...document.querySelectorAll('.cover')]
      .map(c=>({ id: c.dataset.id, title: c.dataset.title, url: c.querySelector('img').src }));
    await fetch('/api/save-covers', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'X-Artist-ID': artistID
      },
      body: JSON.stringify(ordered)
    });
    console.debug('Order saved', ordered, new Date().toISOString());
  }

  // 7️⃣ Inline title editing (double‑click)
  function attachEdit(el){
    el.addEventListener('dblclick', async ()=>{
      const newTitle = prompt('Edit title', el.dataset.title);
      if(newTitle != null){
        el.dataset.title = newTitle;
        el.querySelector('.title').textContent = newTitle;
        // persist single cover
        const id = el.dataset.id;
        const url = el.querySelector('img').src;
        await fetch('/save-cover', {
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            'X-Artist-ID': artistID
          },
          body: JSON.stringify({ id, title: newTitle, url })
        });
        console.debug('Title updated', id, newTitle, new Date().toISOString());
      }
    });
  }

  // 8️⃣ Upload new cover
  document.getElementById('upload-btn').addEventListener('click', async ()=>{
    const fileInput = document.getElementById('cover-upload');
    if(!fileInput.files.length) return alert('Choose an image first');
    const form = new FormData();
    form.append('cover', fileInput.files[0]);
    const res = await fetch('/admin/upload-cover', {
      method:'POST',
      headers:{ 'X-Artist-ID': artistID },
      body: form
    });
    const { file } = await res.json();
    // after upload, immediately save into covers.json and re-render
    const newCover = { id: file, url:`/uploads/\${artistID}/\${file}`, title: '' };
    await fetch('/save-cover', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'X-Artist-ID': artistID
      },
      body: JSON.stringify(newCover)
    });
    await render();
    fileInput.value = '';
  });

  // Initial draw
  await render();
  console.debug('Dashboard initialized', new Date().toISOString());
})();

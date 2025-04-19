;(async function(){
    const headers = { 'X-Artist-ID': 'default' }
  
    // Helper to log
    function log(msg){ console.debug(new Date().toISOString(), msg) }
  
    // Fetch & render styles
    const styleFamIn = document.getElementById('style-fontFamily')
    const styleSizeIn = document.getElementById('style-fontSize')
    async function loadStyles(){
      const res = await fetch(`/api/styles?ts=${Date.now()}`, { headers })
      const s = await res.json()
      log('Loaded styles → ' + JSON.stringify(s))
      styleFamIn.value = s.fontFamily
      styleSizeIn.value = s.fontSize
    }
    document.getElementById('save-styles-btn')
      .addEventListener('click', async ()=>{
        const payload = {
          fontFamily: styleFamIn.value,
          fontSize: +styleSizeIn.value,
          fonts: [], overrides: {}
        }
        const res = await fetch('/save-style-settings', {
          method:'POST',
          headers: { ...headers, 'Content-Type':'application/json' },
          body: JSON.stringify(payload)
        })
        const body = await res.json()
        log('Saved styles → ' + JSON.stringify(body))
        alert(body.success ? 'Styles saved!' : 'Error')
      })
  
    // Fetch & render covers list
    const coverList = document.getElementById('cover-list')
    let covers = []
    async function loadCovers(){
      const res = await fetch(`/api/covers?ts=${Date.now()}`, { headers })
      covers = await res.json()
      log('Loaded covers → ' + JSON.stringify(covers))
      coverList.innerHTML = ''
      covers.forEach((c,i)=>{
        const li = document.createElement('li')
        li.draggable = true
        li.textContent = c.id
        li.dataset.idx = i
        coverList.appendChild(li)
      })
      enableDragAndDrop()
    }
  
    // Drag‑and‑drop reordering
    function enableDragAndDrop(){
      let dragEl = null
      coverList.querySelectorAll('li').forEach(li=>{
        li.addEventListener('dragstart', e=>{
          dragEl = li; li.classList.add('dragging')
        })
        li.addEventListener('dragend', e=>{
          li.classList.remove('dragging'); dragEl=null
        })
        li.addEventListener('dragover', e=>{
          e.preventDefault()
          const over = e.target.closest('li')
          if (!over || over===dragEl) return
          const rect = over.getBoundingClientRect()
          const after = e.clientY > rect.top + rect.height/2
          over.parentNode.insertBefore(dragEl, after ? over.nextSibling : over)
        })
      })
    }
  
    document.getElementById('save-covers-btn')
      .addEventListener('click', async ()=>{
        // build new order
        const newOrder = Array.from(coverList.children).map(li=>{
          const idx = +li.dataset.idx
          return covers[idx]
        })
        const res = await fetch('/save-covers', {
          method:'POST',
          headers: { ...headers, 'Content-Type':'application/json' },
          body: JSON.stringify(newOrder)
        })
        const b = await res.json(); log('Saved covers order → '+JSON.stringify(b))
        alert(b.success ? 'Order saved!' : 'Error')
      })
  
    // Image upload
    document.getElementById('upload-image-btn')
      .addEventListener('click', async ()=>{
        const file = document.getElementById('image-file').files[0]
        if (!file) return alert('Pick a file!')
        const fd = new FormData(); fd.append('file', file)
        const res = await fetch('/upload-image', { method:'POST', headers, body: fd })
        const j = await res.json(); log('Image upload → '+JSON.stringify(j))
        alert(j.url ? 'Image uploaded!' : 'Error')
      })
  
    // Font upload
    document.getElementById('upload-font-btn')
      .addEventListener('click', async ()=>{
        const file = document.getElementById('font-file').files[0]
        if (!file) return alert('Pick a font!')
        const fd = new FormData(); fd.append('file', file)
        const res = await fetch('/upload-font', { method:'POST', headers, body: fd })
        const j = await res.json(); log('Font upload → '+JSON.stringify(j))
        alert(j.url ? 'Font uploaded!' : 'Error')
      })
  
    // Initialize dashboard
    await loadStyles()
    await loadCovers()
  })();
  
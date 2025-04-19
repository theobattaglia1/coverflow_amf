;(async function(){
  const app = document.getElementById('app')
  const tabs = document.querySelectorAll('nav a')

  function activate(page){
    tabs.forEach(t => t.classList.toggle('active', t.dataset.page===page))
    load(page)
  }
  tabs.forEach(t => t.addEventListener('click', e=>{
    e.preventDefault()
    activate(t.dataset.page)
  }))

  async function load(page){
    app.innerHTML = ''
    switch(page){
      case 'covers':
        app.innerHTML = '<h2>Loading covers…</h2>'
        try {
          const res = await fetch('/api/covers',{ headers:{ 'X-Artist-ID':'default' } })
          const covers = await res.json()
          app.innerHTML = '<h2>Covers</h2><ul>' +
            covers.map(c=>`<li>\${c.title||c.id}</li>`).join('') +
            '</ul>'
        } catch(err){
          app.innerHTML = '<p style="color:red">Error loading covers</p>'
        }
        break

      case 'styles':
        app.innerHTML = '<h2>Loading styles…</h2>'
        try {
          const res = await fetch('/api/styles',{ headers:{ 'X-Artist-ID':'default' } })
          const s = await res.json()
          app.innerHTML = '<h2>Styles</h2>' +
            '<pre>'+JSON.stringify(s,null,2)+'</pre>'
        } catch(err){
          app.innerHTML = '<p style="color:red">Error loading styles</p>'
        }
        break

      default:
        app.innerHTML = '<h2>'+page.charAt(0).toUpperCase()+page.slice(1)+' (coming soon)</h2>'
    }
  }

  // kick off
  activate('covers')
})()

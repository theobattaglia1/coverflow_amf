;(async () => {
  const logEl = document.getElementById('log-output')
  const log = msg => {
    console.debug(msg)
    logEl.textContent += msg + '\n'
    logEl.scrollTop = logEl.scrollHeight
  }

  let artistID = ''

  // STEP 1: Artist ID form
  document.getElementById('set-artist-id-button').addEventListener('click', () => {
    const val = document.getElementById('artist-id-input').value.trim()
    if (!val) return alert('Please enter an Artist ID')
    artistID = val
    document.getElementById('artist-id-prompt').classList.add('hidden')
    document.getElementById('dashboard').classList.remove('hidden')
    init()
  })

  async function init() {
    log(`Dashboard initialized at ${new Date().toISOString()}`)
    await loadStyles()
    await loadCovers()
  }

  // LOAD & POPULATE STYLES
  async function loadStyles() {
    try {
      const res = await fetch(`/api/styles?ts=${Date.now()}`, {
        headers: { 'X-Artist-ID': artistID }
      })
      const styles = await res.json()
      log(`Fetched styles → ${JSON.stringify(styles)}`)
      document.querySelector('#style-form [name=fontFamily]').value = styles.fontFamily
      document.querySelector('#style-form [name=fontSize]').value = styles.fontSize
    } catch (e) {
      log(`Error loading styles: ${e}`)
    }
  }
  document.getElementById('style-form').addEventListener('submit', async e => {
    e.preventDefault()
    const data = {
      fontFamily: e.target.fontFamily.value,
      fontSize: parseInt(e.target.fontSize.value, 10)
    }
    try {
      const res = await fetch('/save-style-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Artist-ID': artistID
        },
        body: JSON.stringify(data)
      })
      const json = await res.json()
      log(`Saved styles → ${JSON.stringify(json)}`)
    } catch (e) {
      log(`Error saving styles: ${e}`)
    }
  })

  // LOAD & RENDER COVERS
  async function loadCovers() {
    try {
      const res = await fetch(`/api/covers?ts=${Date.now()}`, {
        headers: { 'X-Artist-ID': artistID }
      })
      window.covers = await res.json()
      log(`Fetched covers → ${JSON.stringify(covers)}`)
      renderCovers()
    } catch (e) {
      log(`Error loading covers: ${e}`)
    }
  }

  function renderCovers() {
    const ul = document.getElementById('covers-list')
    ul.innerHTML = ''
    covers.forEach((c, i) => {
      const li = document.createElement('li')
      li.textContent = c.id
      li.draggable = true
      li.dataset.index = i
      // drag & drop handlers
      li.addEventListener('dragstart', e =>
        e.dataTransfer.setData('text/plain', e.target.dataset.index)
      )
      li.addEventListener('dragover', e => e.preventDefault())
      li.addEventListener('drop', e => {
        const from = +e.dataTransfer.getData('text/plain')
        const to = +e.target.dataset.index
        covers.splice(to, 0, covers.splice(from, 1)[0])
        renderCovers()
      })
      ul.appendChild(li)
    })
  }

  // SAVE NEW COVERS ORDER
  document
    .getElementById('save-covers-button')
    .addEventListener('click', async () => {
      try {
        const res = await fetch('/save-covers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Artist-ID': artistID
          },
          body: JSON.stringify(covers)
        })
        const json = await res.json()
        log(`Saved covers order → ${JSON.stringify(json)}`)
      } catch (e) {
        log(`Error saving covers: ${e}`)
      }
    })

  // UPLOAD FORMS (cover, image, font)
  ;['cover', 'image', 'font'].forEach(type => {
    const form = document.getElementById(`upload-${type}-form`)
    form.addEventListener('submit', async e => {
      e.preventDefault()
      const fd = new FormData(form)
      try {
        const url =
          type === 'cover' ? '/admin/upload-cover' : `/upload-${type}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'X-Artist-ID': artistID },
          body: fd
        })
        const json = await res.json()
        log(`Uploaded ${type} → ${JSON.stringify(json)}`)
      } catch (err) {
        log(`Error uploading ${type}: ${err}`)
      }
    })
  })

  // PUSH TO TEST / LIVE
  document.getElementById('push-test-button').addEventListener('click', async () => {
    const res = await fetch('/push-to-test', {
      method: 'POST',
      headers: { 'X-Artist-ID': artistID }
    })
    const json = await res.json()
    log(`Pushed to TEST → ${JSON.stringify(json)}`)
  })
  document.getElementById('push-live-button').addEventListener('click', async () => {
    const res = await fetch('/push-to-live', {
      method: 'POST',
      headers: { 'X-Artist-ID': artistID }
    })
    const json = await res.json()
    log(`Pushed to LIVE → ${JSON.stringify(json)}`)
  })
})()

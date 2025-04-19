;(async function(){
  const fileInput     = document.getElementById('fileInput')
  const uploadBtn     = document.getElementById('uploadBtn')
  const select        = document.getElementById('audioSelect')
  const player        = document.getElementById('audioPlayer')
  const timestampIn   = document.getElementById('timestampIn')
  const commentIn     = document.getElementById('commentIn')
  const addCommentBtn = document.getElementById('addCommentBtn')
  const commentsList  = document.getElementById('commentsList')
  const artistHeader  = { 'X-Artist-ID': 'default' }

  // Upload a file
  uploadBtn.addEventListener('click', async () => {
    if (!fileInput.files.length) return alert('Please select a file first.')
    const form = new FormData()
    form.append('file', fileInput.files[0])
    const res = await fetch('/upload-audio', {
      method: 'POST',
      headers: artistHeader,
      body: form
    })
    if (!res.ok) return alert('Upload failed')
    alert('Upload succeeded!')
    await loadAudioList()
  })

  // Populate dropdown
  async function loadAudioList() {
    const res = await fetch('/audio-files', { headers: artistHeader })
    const files = await res.json()
    select.innerHTML = ''
    files.forEach(f => {
      const opt = document.createElement('option')
      opt.value = f
      opt.textContent = f.split('/').pop()
      select.appendChild(opt)
    })
    if (files.length) {
      select.value = files[0]
      player.src = select.value
      await loadComments()
    }
  }

  // When user picks a different file
  select.addEventListener('change', async () => {
    player.src = select.value
    await loadComments()
  })

  // Add a timestamped comment
  addCommentBtn.addEventListener('click', async () => {
    const payload = {
      file: select.value,
      timestamp: Number(timestampIn.value),
      text: commentIn.value.trim()
    }
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...artistHeader
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) return alert('Comment failed')
    timestampIn.value = ''
    commentIn.value   = ''
    await loadComments()
  })

  // Fetch & render comments
  async function loadComments() {
    const res = await fetch(
      '/api/comments?file=' + encodeURIComponent(select.value),
      { headers: artistHeader }
    )
    const list = await res.json()
    commentsList.innerHTML = ''
    list.forEach(c => {
      const li = document.createElement('li')
      li.textContent = `${c.timestamp}s: ${c.text}`
      commentsList.appendChild(li)
    })
  }

  // Kick things off
  await loadAudioList()
})()

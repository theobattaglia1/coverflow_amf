(async () => {
  const fileInput    = document.getElementById('fileInput');
  const uploadBtn    = document.getElementById('uploadBtn');
  const select       = document.getElementById('audioSelect');
  const player       = document.getElementById('audioPlayer');
  const timestampIn  = document.getElementById('timestampIn');
  const commentIn    = document.getElementById('commentIn');
  const addBtn       = document.getElementById('addCommentBtn');
  const commentsList = document.getElementById('commentsList');

  // sanity‑check
  [ fileInput, uploadBtn, select, player, timestampIn, commentIn, addBtn, commentsList ]
    .forEach((el,i) => {
      if (!el) console.error('Missing element:', [
        'fileInput','uploadBtn','audioSelect','audioPlayer',
        'timestampIn','commentIn','addCommentBtn','commentsList'
      ][i]);
    });

  // 1) Upload handler
  uploadBtn.addEventListener('click', async () => {
    if (!fileInput.files.length) return alert('Please select a file first.');
    const form = new FormData();
    form.append('file', fileInput.files[0]);
    const res = await fetch('/upload-audio', {
      method: 'POST',
      headers: { 'X-Artist-ID': 'default' },
      body: form
    });
    if (!res.ok) return alert('Upload failed');
    alert('Upload successful!');
    await loadAudioList();
  });

  // 2) Populate dropdown
  async function loadAudioList() {
    const res   = await fetch('/audio-files', { headers:{ 'X-Artist-ID':'default' } });
    const files = await res.json();
    select.innerHTML = '';
    files.forEach(f => {
      const o = document.createElement('option');
      o.value = f;
      o.textContent = f.split('/').pop();
      select.appendChild(o);
    });
    if (files.length) {
      select.value = files[0];
      player.src   = select.value;
      await loadComments();
    }
  }

  // 3) Switch file
  select.addEventListener('change', async () => {
    player.src = select.value;
    await loadComments();
  });

  // 4) Manual comment
  addBtn.addEventListener('click', async () => {
    const payload = {
      file: select.value,
      timestamp: Number(timestampIn.value),
      text: commentIn.value.trim()
    };
    const r = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) return alert('Comment failed');
    timestampIn.value = '';
    commentIn.value   = '';
    await loadComments();
  });

  // 5) Render comments
  async function loadComments() {
    const r    = await fetch('/api/comments?file='+encodeURIComponent(select.value));
    const list = await r.json();
    commentsList.innerHTML = '';
    list.forEach(c => {
      const li = document.createElement('li');
      li.textContent = `${c.timestamp}s: ${c.text}`;
      commentsList.appendChild(li);
    });
  }

  // 6) "c" shortcut
  document.addEventListener('keydown', async e => {
    const tag = document.activeElement.tagName;
    if (e.key === 'c' && !['INPUT','TEXTAREA','SELECT','BUTTON'].includes(tag)) {
      const time = Math.floor(player.currentTime);
      const text = prompt(`Add comment at ${time}s:`);
      if (text) {
        await fetch('/api/comments', {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ file: select.value, timestamp: time, text })
        });
        await loadComments();
      }
    }
  });

  // Kick it off
  await loadAudioList();
})();

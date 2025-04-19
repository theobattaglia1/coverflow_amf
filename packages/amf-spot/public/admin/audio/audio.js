;(async function(){
  const select      = document.getElementById('audio-select');
  const player      = document.getElementById('audio-player');
  const tsInput     = document.getElementById('timestamp-input');
  const commentInput= document.getElementById('comment-input');
  const addBtn      = document.getElementById('add-comment-btn');
  const commentsUL  = document.getElementById('comments-list');
  const artistHeader= { 'X-Artist-ID':'default' };

  async function loadAudioList(){
    const res   = await fetch('/audio-files',{ headers: artistHeader });
    const files = await res.json();
    select.innerHTML = '';
    files.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f.split('/').pop();
      select.appendChild(opt);
    });
    if(files.length){
      select.value = files[0];
      player.src  = files[0];
      await loadComments();
    }
  }

  select.addEventListener('change', async () => {
    player.src = select.value;
    await loadComments();
  });

  async function loadComments(){
    const res  = await fetch(
      '/api/comments?file=' + encodeURIComponent(select.value),
      { headers: artistHeader }
    );
    const list = await res.json();
    commentsUL.innerHTML = '';
    list.forEach(c => {
      const li = document.createElement('li');
      li.textContent = \`\${c.timestamp}s: \${c.text}\`;
      commentsUL.appendChild(li);
    });
  }

  addBtn.addEventListener('click', async () => {
    const payload = {
      file: select.value,
      timestamp: Number(tsInput.value),
      text: commentInput.value.trim()
    };
    const res = await fetch('/api/comments', {
      method:'POST',
      headers: {
        'Content-Type':'application/json',
        ...artistHeader
      },
      body: JSON.stringify(payload)
    });
    if(!res.ok) return alert('Failed to add comment');
    tsInput.value = '';
    commentInput.value = '';
    await loadComments();
  });

  await loadAudioList();
})();

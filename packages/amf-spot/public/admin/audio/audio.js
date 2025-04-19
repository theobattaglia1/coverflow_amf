/* public/admin/audio.js */
(async function(){
  const artistID = localStorage.getItem('artistID');
  const sel = document.getElementById('audio-select');
  const player = document.getElementById('player');
  const list  = document.getElementById('comments-list');
  const txt   = document.getElementById('comment-text');
  const btn   = document.getElementById('add-comment');

  // populate audio files
  const files = await fetch('/api/audio-files', {
    headers:{ 'X-Artist-ID': artistID }
  }).then(r=>r.json());
  files.forEach(url=>{
    const opt = new Option(url.split('/').pop(), url);
    sel.add(opt);
  });
  sel.addEventListener('change', ()=> {
    player.src = sel.value;
    loadComments();
  });
  // load comments
  async function loadComments(){
    const audio = sel.value.split('/').pop();
    const comments = await fetch(\`/api/comments?audio=\${audio}\`, {
      headers:{ 'X-Artist-ID': artistID }
    }).then(r=>r.json());
    list.innerHTML = comments
      .map(c=>\`<li>[\${c.time.toFixed(1)}s] \${c.text}</li>\`)
      .join('');
  }
  btn.addEventListener('click', async ()=>{
    const time = player.currentTime;
    const text = txt.value.trim();
    if(!text) return;
    await fetch('/api/comments', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'X-Artist-ID': artistID
      },
      body: JSON.stringify({
        audio: sel.value.split('/').pop(),
        time, text
      })
    });
    txt.value = '';
    loadComments();
  });

  // init first
  sel.dispatchEvent(new Event('change'));
})();

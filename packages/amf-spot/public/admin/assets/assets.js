(async () => {
  const assetInput    = document.getElementById('assetInput');
  const uploadBtn     = document.getElementById('uploadAssetBtn');
  const assetList     = document.getElementById('assetList');
  const commentX      = document.getElementById('commentX');
  const commentY      = document.getElementById('commentY');
  const commentText   = document.getElementById('commentText');
  const annotateBtn   = document.getElementById('addAssetCommentBtn');
  const commentsList  = document.getElementById('assetCommentsList');
  let currentAssetUrl = '';

  // 1) Upload image
  uploadBtn.addEventListener('click', async () => {
    if (!assetInput.files.length) return alert('Pick an image first');
    const form = new FormData();
    form.append('file', assetInput.files[0]);
    const res = await fetch('/upload-image', {
      method: 'POST',
      headers: { 'X-Artist-ID': 'default' },
      body: form
    });
    if (!res.ok) return alert('Upload failed');
    alert('Image uploaded!');
    assetInput.value = '';
    await loadAssets();
  });

  // 2) Load gallery
  async function loadAssets() {
    const res = await fetch('/image-files', { headers:{ 'X-Artist-ID':'default' } });
    const files = await res.json();
    assetList.innerHTML = '';
    files.forEach(url => {
      const li  = document.createElement('li');
      const img = document.createElement('img');
      img.src   = url;
      img.onclick = () => {
        currentAssetUrl = url;
        loadAssetComments();
      };
      li.appendChild(img);
      assetList.appendChild(li);
    });
  }

  // 3) Annotate
  annotateBtn.addEventListener('click', async () => {
    if (!currentAssetUrl) return alert('Select an image first');
    const payload = {
      file: currentAssetUrl,
      x: Number(commentX.value),
      y: Number(commentY.value),
      text: commentText.value.trim()
    };
    const r = await fetch('/api/asset-comments', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) return alert('Annotation failed');
    commentX.value = commentY.value = commentText.value = '';
    await loadAssetComments();
  });

  // 4) Load annotations
  async function loadAssetComments() {
    const r = await fetch('/api/asset-comments?file='+encodeURIComponent(currentAssetUrl));
    const list = await r.json();
    commentsList.innerHTML = '';
    list.forEach(c => {
      const li = document.createElement('li');
      li.textContent = `(${c.x},${c.y}): ${c.text}`;
      commentsList.appendChild(li);
    });
  }

  // init
  await loadAssets();
})();

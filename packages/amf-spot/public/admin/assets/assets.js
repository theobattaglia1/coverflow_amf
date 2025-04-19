(async function() {
  const uploadBtn = document.getElementById('uploadBtn');
  const imgInput  = document.getElementById('imgInput');
  const gallery   = document.getElementById('gallery');
  const lightbox  = document.getElementById('lightbox');
  const lbImg     = document.getElementById('lightbox-img');
  const captionIn = document.getElementById('captionIn');
  const saveBtn   = document.getElementById('saveCaptionBtn');
  const closeBtn  = document.getElementById('closeBtn');

  // Fetch & render images
  async function loadImages() {
    gallery.innerHTML = '';
    const res = await fetch('/image-files', {
      headers: { 'X-Artist-ID': 'default' }
    });
    const images = await res.json();
    images.forEach(src => {
      const img = document.createElement('img');
      img.src = src;
      img.className = 'thumb';
      img.draggable = true;
      img.addEventListener('click', () => openLightbox(src));
      gallery.appendChild(img);
    });
    // TODO: add drag/drop reordering here
  }

  // Upload handler
  uploadBtn.addEventListener('click', async () => {
    const files = Array.from(imgInput.files);
    const form = new FormData();
    files.forEach(f => form.append('file', f));
    const res = await fetch('/upload-image', {
      method: 'POST',
      headers: { 'X-Artist-ID': 'default' },
      body: form
    });
    if (!res.ok) return alert('Upload failed');
    imgInput.value = '';
    await loadImages();
  });

  // Lightbox
  let currentSrc = '';
  function openLightbox(src) {
    currentSrc = src;
    lbImg.src = src;
    // load existing caption
    const stored = localStorage.getItem(src) || '';
    captionIn.value = stored;
    lightbox.classList.remove('hidden');
  }
  saveBtn.addEventListener('click', () => {
    localStorage.setItem(currentSrc, captionIn.value);
    alert('Caption saved');
  });
  closeBtn.addEventListener('click', () => {
    lightbox.classList.add('hidden');
  });

  // Init
  await loadImages();
})();

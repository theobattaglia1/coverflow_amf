(async function(){
  const urlParams = new URLSearchParams(window.location.search);
  let id = urlParams.get('id');
  const cover = id ? (await fetch(`/data/covers-preview.json`).then(r => r.json())).find(c => c.id == id) : {};
  
  if (cover) {
    Object.entries(cover).forEach(([key, value]) => {
      const el = document.getElementById(key);
      if (el) el.value = typeof value === 'object'
        ? JSON.stringify(value, null, 2)
        : value;
    });
    // After the forEach loop, but still inside "if (cover) { ... }"
if (cover.music && cover.music.embedHtml) {
  const mc = document.getElementById('musicContent');
  if (mc) mc.value = cover.music.embedHtml;
}

    if (cover.frontImage) document.getElementById('imgPreview').src = cover.frontImage;
    if (cover.fontFamily) document.getElementById('fontFamily').value = cover.fontFamily;
    if (cover.fontSize) document.getElementById('fontSize').value = cover.fontSize;
  }

  window.saveCover = async function () {
    const form = document.getElementById('coverForm');
    const data = Object.fromEntries(new FormData(form));
    const isNew = !id;
    if (isNew) id = Date.now().toString();

    const body = {
      id,
      category: data.category || '',
      frontImage: data.frontImage || '',
      albumTitle: data.albumTitle || '',
      coverLabel: data.coverLabel || '',
      fontFamily: data.fontFamily || '',
      fontSize: data.fontSize || '',
      music: {
        type: "embed",
        embedHtml: data.musicContent || ''
      }
    };

    console.log("📦 Saving:", body);

    await fetch('/save-cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    window.location = '/admin/dashboard.html';
  };

  // Drag-and-drop image upload
  const dropArea = document.getElementById('dropArea');
  const fileInput = document.getElementById('imageInput');
  const preview = document.getElementById('imgPreview');

  dropArea.addEventListener('click', () => fileInput.click());
  dropArea.addEventListener('dragover', e => {
    e.preventDefault();
    dropArea.classList.add('dragover');
  });
  dropArea.addEventListener('dragleave', () => dropArea.classList.remove('dragover'));
  dropArea.addEventListener('drop', e => {
    e.preventDefault();
    dropArea.classList.remove('dragover');
    handleUpload(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', e => {
    handleUpload(e.target.files[0]);
  });

  async function handleUpload(file) {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch('/upload-image', {
      method: 'POST',
      body: formData
    });
    const { url } = await res.json();
    document.getElementById('frontImage').value = url;
    preview.src = url;
  }
})();

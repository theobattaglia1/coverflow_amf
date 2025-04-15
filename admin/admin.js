(async function(){
  const urlParams = new URLSearchParams(window.location.search);
  let id = urlParams.get('id');

  // Fetch the cover from covers-preview.json
  const cover = id 
    ? (await fetch(`/data/covers-preview.json`).then(r => r.json())).find(c => c.id == id)
    : {};

  // Populate the form fields if a cover exists
  if (cover) {
    // Fill in all matching fields from cover object (except music, which we handle separately)
    Object.entries(cover).forEach(([key, value]) => {
      // Skip 'music' here to handle it later
      if (key === 'music') return; 
      const el = document.getElementById(key);
      if (el) el.value = typeof value === 'object' ? JSON.stringify(value, null, 2) : value;
    });

    // Set image, fonts, etc.
    if (cover.frontImage) document.getElementById('imgPreview').src = cover.frontImage;
    if (cover.fontFamily) document.getElementById('fontFamily').value = cover.fontFamily;
    if (cover.fontSize) document.getElementById('fontSize').value = cover.fontSize;

    // Handle the music field separately
    const musicTypeEl = document.getElementById('musicType');
    const mc = document.getElementById('musicContent');
    if (cover.music) {
      // Set the music type dropdown if exists
      if (musicTypeEl && cover.music.type) {
        musicTypeEl.value = cover.music.type;
      }
      // Load the appropriate field into the textarea based on type
      if (cover.music.type === 'embed') {
        mc.value = cover.music.embedHtml || '';
      } else if (cover.music.type === 'link') {
        mc.value = cover.music.url || '';
      } else {
        mc.value = cover.music.value || '';
      }
    }
    // If the user changes the music type, update the placeholder
    if (musicTypeEl) {
      musicTypeEl.addEventListener('change', function () {
        const type = musicTypeEl.value;
        if (mc) {
          mc.placeholder = type === 'embed'
            ? 'Paste embed HTML here'
            : type === 'link'
              ? 'Paste music URL here'
              : 'Enter music info here';
        }
      });
    }
  }

  // =========================
  // Delete Cover
  // =========================
  window.deleteCover = async function () {
    if (confirm("Are you sure you want to delete this cover?")) {
      await fetch('/delete-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      alert("✅ Cover deleted!");
      window.location.href = '/admin';
    }
  };

  // =========================
  // Single Cover Save (Unified)
  // =========================
  window.saveCover = async function () {
    const form = document.getElementById('coverForm');
    const data = Object.fromEntries(new FormData(form));

    // Debug: Log the form data to verify embed value
    console.log("Form Data:", data);
    
    const isNew = !id;
    if (isNew) id = Date.now().toString();

    // Retrieve music type; default to 'embed'
    const musicTypeEl = document.getElementById('musicType');
    const musicType = musicTypeEl ? musicTypeEl.value : 'embed';
    let musicContent;
    if (musicType === 'embed') {
      musicContent = { type: 'embed', embedHtml: data.musicContent || '' };
    } else if (musicType === 'link') {
      musicContent = { type: 'link', url: data.musicContent || '' };
    } else {
      musicContent = { type: musicType, value: data.musicContent || '' };
    }

    const body = {
      id,
      category: data.category || '',
      frontImage: data.frontImage || '',
      albumTitle: data.albumTitle || '',
      coverLabel: data.coverLabel || '',
      fontFamily: data.fontFamily || '',
      fontSize: data.fontSize || '',
      music: musicContent
    };

    console.log("📦 Saving cover with payload:", body);

    const resp = await fetch('/save-cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      alert("❌ Failed to save cover. Check console for errors.");
      return;
    }

    alert("✅ Cover saved!");

    // If new, optionally redirect
    if (isNew) {
      const covers = await fetch('/data/covers-preview.json').then(r => r.json());
      const newCover = covers.find(c => c.id == id);
      if (newCover) {
        window.location.href = `/admin?cover=${newCover.id}`;
      }
    }
  };

  // =========================
  // Drag-and-drop image upload
  // =========================
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

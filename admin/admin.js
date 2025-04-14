(async function(){
  const urlParams = new URLSearchParams(window.location.search);
  let id = urlParams.get('id');

  // Fetch covers-preview.json and find the cover if 'id' is provided
  const cover = id
    ? (await fetch(`/data/covers-preview.json`).then(r => r.json())).find(c => c.id == id)
    : {};

  // 1. Populate form fields if cover exists
  if (cover) {
    Object.entries(cover).forEach(([key, value]) => {
      const el = document.getElementById(key);
      if (el) {
        el.value = typeof value === 'object'
          ? JSON.stringify(value, null, 2)
          : value;
      }
    });

    // Set frontImage, fontFamily, fontSize, and image preview
    if (cover.frontImage) document.getElementById('imgPreview').src = cover.frontImage;
    if (cover.fontFamily) document.getElementById('fontFamily').value = cover.fontFamily;
    if (cover.fontSize) document.getElementById('fontSize').value = cover.fontSize;

    // 2. Initialize music type and content fields
    const musicTypeEl = document.getElementById('musicType');
    const mc = document.getElementById('musicContent');

    if (cover.music) {
      // If there's a music object, set the dropdown (default: embed)
      if (musicTypeEl && cover.music.type) {
        musicTypeEl.value = cover.music.type;
      }

      // Depending on type, load the correct field into <textarea id="musicContent">
      if (cover.music.type === 'embed') {
        mc.value = cover.music.embedHtml || '';
      } else if (cover.music.type === 'link') {
        mc.value = cover.music.url || '';
      } else {
        mc.value = cover.music.value || '';
      }
    }

    // 3. If the user changes the music type dropdown, update placeholder
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
  // Save (Create/Update) Cover
  // =========================
  window.saveCover = async function () {
    const form = document.getElementById('coverForm');
    const data = Object.fromEntries(new FormData(form));
    const isNew = !id;
    if (isNew) {
      // Assign a new ID if cover doesn't exist
      id = Date.now().toString();
    }

    // Grab the music type dropdown
    const musicTypeEl = document.getElementById('musicType');
    const musicType = musicTypeEl ? musicTypeEl.value : 'embed';

    // Build the music object according to chosen type
    let musicContent;
    if (musicType === 'embed') {
      musicContent = { type: 'embed', embedHtml: data.musicContent || '' };
    } else if (musicType === 'link') {
      musicContent = { type: 'link', url: data.musicContent || '' };
    } else {
      musicContent = { type: musicType, value: data.musicContent || '' };
    }

    // Construct the final cover object
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

    console.log("📦 Saving:", body);

    // Send to /save-cover endpoint
    const resp = await fetch('/save-cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      alert("❌ Failed to save. Check console for details.");
      return;
    }

    alert("✅ Cover saved!");

    // If newly created, optionally redirect to some admin route with the new ID
    if (isNew) {
      // Reload covers-preview to confirm the new cover was saved
      const covers = await fetch('/data/covers-preview.json').then(r => r.json());
      const newCover = covers.find(c => c.id == id);
      if (newCover) {
        // Go to admin route with ?cover=...
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

(async function(){
  const urlParams = new URLSearchParams(window.location.search);
  let id = urlParams.get('id');
  const cover = id ? (await fetch(`/data/covers-preview.json`).then(r => r.json())).find(c => c.id == id) : {};

  if (cover) {
    Object.entries(cover).forEach(([key, value]) => {
      const el = document.getElementById(key);
      if (el) el.value = typeof value === 'object' ? JSON.stringify(value, null, 2) : value;
    });

    if (cover.frontImage) document.getElementById('imgPreview').src = cover.frontImage;

    if (cover.music && cover.music.url) {
      document.getElementById('musicUrl').value = cover.music.url;
    }

    if (cover.artistDetails) {
      document.getElementById('artistName').value = cover.artistDetails.name || '';
      document.getElementById('artistLocation').value = cover.artistDetails.location || '';
      document.getElementById('artistBio').value = cover.artistDetails.bio || '';
      document.getElementById('artistSpotifyLink').value = cover.artistDetails.spotifyLink || '';
      document.getElementById('artistImage').value = cover.artistDetails.image || '';
    }
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
        type: data.musicUrl?.includes('<iframe') ? "embed" : "url",
        url: !data.musicUrl?.includes('<iframe') ? data.musicUrl : '',
        embedHtml: data.musicUrl?.includes('<iframe') ? data.musicUrl : ''
      },
      artistDetails: {
        name: data.artistName || '',
        location: data.artistLocation || '',
        bio: data.artistBio || '',
        spotifyLink: data.artistSpotifyLink || '',
        image: data.artistImage || ''
      }
    };
  
    console.log("📦 Saving:", body);
  
    const res = await fetch('/save-cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  
    const result = await res.json();
  
    if(result.success){
      alert("✅ Cover saved and pushed live successfully!");
      window.location.href = '/admin/dashboard.html';
    } else {
      alert("❌ Error: " + result.error);
    }
  };
  

  window.deleteCover = async function () {
    if (confirm("Are you sure you want to delete this cover?")) {
      await fetch('/delete-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      alert("✅ Cover deleted successfully!");
      window.location.href = '/admin/dashboard.html';
    }
  };

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

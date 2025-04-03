document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const coverId = urlParams.get("id");
  let currentCover = {};

  const elements = {
    coverId: document.getElementById('coverId'),
    category: document.getElementById('category'),
    frontImage: document.getElementById('frontImage'),
    albumTitle: document.getElementById('albumTitle'),
    coverLabel: document.getElementById('coverLabel'),
    musicType: document.getElementById('musicType'),
    musicContent: document.getElementById('musicContent'),
    coverArtPreview: document.getElementById('coverArtPreview'),
    saveBtn: document.querySelector('.save-btn'),
    deleteBtn: document.querySelector('.delete-btn')
  };

  async function loadCover(id) {
    const covers = await (await fetch('/data/covers.json')).json();
    currentCover = covers.find(c => c.id.toString() === id.toString()) || {};
    populateForm();
  }

  function populateForm() {
    elements.coverId.textContent = currentCover.id || 'New Cover';
    elements.category.value = currentCover.category || '';
    elements.frontImage.value = currentCover.frontImage || '';
    elements.albumTitle.value = currentCover.albumTitle || '';
    elements.coverLabel.value = currentCover.coverLabel || '';
    elements.musicType.value = currentCover.music?.type || '';
    elements.musicContent.value = JSON.stringify(currentCover.music || {}, null, 2);
    elements.coverArtPreview.src = currentCover.frontImage || '/admin/placeholder-igor.jpg';
  }

  async function saveCover() {
    const coverData = {
      id: elements.coverId.textContent !== 'New Cover' ? elements.coverId.textContent : null,
      category: elements.category.value,
      frontImage: elements.frontImage.value,
      albumTitle: elements.albumTitle.value,
      coverLabel: elements.coverLabel.value,
      music: JSON.parse(elements.musicContent.value || '{}'),
      musicType: elements.musicType.value,
    };

    await fetch('/save-cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coverData)
    });

    window.location.href = '/admin/dashboard.html';
  }

  async function deleteCover() {
    if (!currentCover.id) return;
    await fetch('/delete-cover', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ id: currentCover.id })
    });
    window.location.href = '/admin/dashboard.html';
  }

  elements.saveBtn.addEventListener('click', saveCover);
  elements.deleteBtn.addEventListener('click', deleteCover);

  if (coverId) loadCover(coverId);
  else populateForm();
});

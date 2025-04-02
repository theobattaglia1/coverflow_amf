let currentCover = {};
let covers = [];
let coverIndex = 0;

async function loadCovers() {
  const response = await fetch('/data/covers.json');
  covers = await response.json();
  currentCover = covers[coverIndex];
  populateForm();
}

function populateForm() {
  document.getElementById('coverId').innerText = currentCover.id;
  document.getElementById('category').value = currentCover.category;
  document.getElementById('frontImage').value = currentCover.frontImage;
  document.getElementById('albumTitle').value = currentCover.albumTitle;
  document.getElementById('coverLabel').value = currentCover.coverLabel;
  document.getElementById('musicType').value = currentCover.music.type;
  document.getElementById('musicContent').value = JSON.stringify(currentCover.music, null, 2);
  document.getElementById('coverArtPreview').src = currentCover.frontImage;
}

function saveCoverData() {
  currentCover.category = document.getElementById('category').value;
  currentCover.frontImage = document.getElementById('frontImage').value;
  currentCover.albumTitle = document.getElementById('albumTitle').value;
  currentCover.coverLabel = document.getElementById('coverLabel').value;
  currentCover.music.type = document.getElementById('musicType').value;
  currentCover.music = JSON.parse(document.getElementById('musicContent').value);
  alert("Cover changes stored locally. Press 'Save' to update covers.json.");
}

async function saveCoversToFile() {
  await fetch('/save-covers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(covers)
  });
  alert('Covers saved successfully!');
}

document.querySelector('.add-cover-btn').onclick = () => {
  const newCover = {
    id: covers.length,
    category: '',
    frontImage: '',
    albumTitle: '',
    coverLabel: '',
    music: { type: 'tracks', tracks: [] }
  };
  covers.push(newCover);
  coverIndex = covers.length - 1;
  currentCover = newCover;
  populateForm();
};

document.querySelector('.save-btn').onclick = saveCoversToFile;
document.querySelector('.delete-btn').onclick = () => {
  covers.splice(coverIndex, 1);
  coverIndex = Math.max(0, coverIndex - 1);
  currentCover = covers[coverIndex] || {};
  populateForm();
  alert("Cover removed locally. Press 'Save' to finalize.");
};

['category', 'frontImage', 'albumTitle', 'coverLabel', 'musicType', 'musicContent'].forEach(id => {
  document.getElementById(id).onchange = saveCoverData;
});

loadCovers();


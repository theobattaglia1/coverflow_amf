let covers = [];
let coverIndex = 0;

async function loadCovers() {
  covers = await (await fetch('/data/covers.json')).json();
  populateCoverList();
}

function populateCoverList() {
  const list = document.getElementById('cover-list');
  list.innerHTML = '';
  covers.forEach((cover, index) => {
    const item = document.createElement('li');
    item.textContent = cover.albumTitle || `Cover ${cover.id}`;
    item.onclick = () => editCover(index);
    list.appendChild(item);
  });
}

function editCover(index) {
  coverIndex = index;
  const cover = covers[index];
  ['category', 'frontImage', 'albumTitle', 'coverLabel', 'musicType', 'musicContent'].forEach(id => {
    document.getElementById(id).value = cover[id] || '';
  });
  document.getElementById('coverArtPreview').src = cover.frontImage;
}

document.querySelector('.save-btn').onclick = async () => {
  await fetch('/save-covers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(covers)
  });
  alert('Saved');
};

document.querySelector('.add-cover-btn').onclick = () => {
  const newCover = { id: Date.now(), category: '', frontImage: '', albumTitle: '', coverLabel: '', musicType: '', musicContent: '{}' };
  covers.push(newCover);
  populateCoverList();
};

document.querySelector('.delete-btn').onclick = () => {
  covers.splice(coverIndex, 1);
  populateCoverList();
};

document.getElementById('frontImageUpload').onchange = async (e) => {
  const file = e.target.files[0];
  const data = new FormData();
  data.append('image', file);
  const res = await (await fetch('/upload', { method: 'POST', body: data })).json();
  covers[coverIndex].frontImage = res.path;
  editCover(coverIndex);
};

document.querySelectorAll('input, textarea').forEach(el => {
  el.onchange = () => {
    covers[coverIndex][el.id] = el.value;
  };
});

new Sortable(document.getElementById('cover-list'), {
  animation: 150,
  onEnd: () => {
    const newOrder = Array.from(document.getElementById('cover-list').children).map(el => covers.find(c => (c.albumTitle || `Cover ${c.id}`) === el.textContent));
    covers = newOrder;
  }
});

loadCovers();


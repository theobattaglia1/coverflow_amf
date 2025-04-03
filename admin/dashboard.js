let covers = [];

async function loadCovers() {
  covers = await (await fetch('/data/covers.json')).json();
  renderCovers(covers);
}

function renderCovers(displayCovers) {
  const container = document.getElementById('coversContainer');
  container.innerHTML = displayCovers.map(cover => `
    <div class="cover-card" data-id="${cover.id}">
      <img src="${cover.frontImage}" alt="${cover.albumTitle}">
      <strong>${cover.albumTitle}</strong><br>
      <small>${cover.coverLabel}</small><br>
      <button onclick="editCover(${cover.id})">✏️ Edit</button>
    </div>
  `).join('');

  new Sortable(container, {
    animation: 150,
    onEnd: saveOrder
  });
}

function editCover(id) {
  window.location.href = `/admin/admin.html?id=${id}`;
}

function saveOrder() {
  const orderedIds = [...document.querySelectorAll('.cover-card')].map(card => parseInt(card.dataset.id));
  covers.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
}

async function saveCovers() {
  await fetch('/save-covers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(covers)
  });
  window.open('/', '_blank');
}

document.getElementById('saveTestBtn').onclick = saveCovers;
document.getElementById('savePublishBtn').onclick = saveCovers;

document.getElementById('search').addEventListener('input', e => {
  const term = e.target.value.toLowerCase();
  const filtered = covers.filter(c => c.albumTitle.toLowerCase().includes(term));
  renderCovers(filtered);
});

loadCovers();

document.getElementById('addNewCoverBtn').onclick = async () => {
  const newId = covers.length ? Math.max(...covers.map(c => c.id)) + 1 : 0;

  const newCover = {
    id: newId,
    category: '',
    frontImage: '',
    albumTitle: '',
    coverLabel: '',
    music: { type: 'tracks', tracks: [] }
  };

  covers.push(newCover);

  await fetch('/save-covers', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(covers)
  });

  window.location.href = `/admin/admin.html?id=${newId}`;
};


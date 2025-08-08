(function(){
  const galleryEl = document.getElementById('gallery');
  const namesStrip = document.getElementById('names-strip');
  const modal = document.getElementById('artist-modal');

  let covers = [];
  let idToIndex = new Map();

  // Load global styles
  fetch('/data/styles.json').then(r=>r.json()).then(style=>{
    document.getElementById('global-styles').innerHTML = `html,body{font-family:'${style.fontFamily||'GT America'}',sans-serif;font-size:${style.fontSize||16}px;}`;
  }).catch(()=>{});

  // Load covers
  fetch(`/data/covers.json?cb=${Date.now()}`)
    .then(r => r.json())
    .then(data => {
      covers = data;
      covers.forEach((c, i) => idToIndex.set(String(c.id), i));
      renderNames();
      renderTiles();
    })
    .catch(err => console.error('Failed to load covers', err));

  function renderNames(){
    namesStrip.innerHTML = '';
    const frag = document.createDocumentFragment();
    covers.map(c => ({
      id: c.id,
      name: c.artistDetails?.name || c.coverLabel || c.albumTitle || 'Untitled'
    }))
    .sort((a,b)=>a.name.localeCompare(b.name))
    .forEach(item => {
      const btn = document.createElement('button');
      btn.textContent = item.name;
      btn.addEventListener('click', () => focusById(item.id));
      frag.appendChild(btn);
    });
    namesStrip.appendChild(frag);
  }

  function renderTiles(){
    galleryEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    covers.forEach((c, i) => {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.id = c.id;
      tile.dataset.index = i;

      const imgUrl = c.frontImage?.startsWith('/uploads/') ? `https://allmyfriendsinc.com${c.frontImage}` : (c.frontImage || '');
      const front = document.createElement('div');
      front.className = 'tile-front';
      if (imgUrl) front.style.backgroundImage = `url('${imgUrl}')`;
      tile.appendChild(front);

      const label = document.createElement('div');
      label.className = 'tile-label';
      label.textContent = c.artistDetails?.name || c.coverLabel || '';
      tile.appendChild(label);

      tile.addEventListener('click', () => openArtistModal(c));

      frag.appendChild(tile);
    });
    galleryEl.appendChild(frag);
  }

  function focusById(id){
    const el = galleryEl.querySelector(`.tile[data-id="${CSS.escape(String(id))}"]`);
    if (!el) return;
    // Scroll into view with smooth behavior
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    el.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(1.06)' },
      { transform: 'scale(1)' }
    ], { duration: 320, easing: 'cubic-bezier(0.22,1,0.36,1)' });
  }

  function openArtistModal(cover){
    if (!modal) return;
    const content = modal.querySelector('.modal-content');
    const banner = cover.frontImage || cover.artistDetails?.image || '';
    content.innerHTML = `
      ${banner ? `<img class="artist-photo" src="${banner}" alt="${cover.artistDetails?.name||''}"/>` : ''}
      <div class="artist-info">
        <h2 class="artist-name">${cover.artistDetails?.name || cover.albumTitle || 'Artist'}</h2>
        ${cover.artistDetails?.location ? `<p class="artist-location">${cover.artistDetails.location}</p>` : ''}
        ${cover.artistDetails?.bio ? `<p class="artist-bio">${cover.artistDetails.bio}</p>` : ''}
        ${cover.artistDetails?.spotifyLink ? `<a href="${cover.artistDetails.spotifyLink}" target="_blank" class="spotify-button">Listen on Spotify</a>` : ''}
      </div>
    `;
    modal.classList.remove('hidden');
    modal.classList.add('show');
    modal.onclick = (e)=>{ if(e.target===modal) closeArtistModal(); };
    const esc = (e)=>{ if(e.key==='Escape'){ closeArtistModal(); window.removeEventListener('keydown', esc);} };
    window.addEventListener('keydown', esc);
  }

  function closeArtistModal(){
    modal.classList.remove('show');
    setTimeout(()=> modal.classList.add('hidden'), 280);
  }
})();



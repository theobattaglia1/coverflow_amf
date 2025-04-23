console.log('[💥 LIVE BUILD] showcase.js ran @ ' + new Date().toISOString());

function safeTransform(angle) {
  return 'rotate(' + angle + 'deg) translateY(-300px) rotate(' + (-angle) + 'deg)';
}

document.addEventListener('DOMContentLoaded', async function () {
  const showcaseContainer = document.getElementById('showcase');
  const ring = document.createElement('div');
  ring.className = 'orbital-ring';
  showcaseContainer.appendChild(ring);

  renderShowcase('This Week');
});

function renderShowcase(filter) {
  fetch('/api/hudson-ingram/showcase')
    .then(res => res.json())
    .then(data => {
      if (!data.media || !data.media.length) {
        data.media = generateFallbackMedia();
      }

      const media = applyTimeFilter(data.media, filter);
      const filled = fillTo12(media);
      renderOrbit(filled);
    });
}

function renderOrbit(items) {
  const ring = document.querySelector('.orbital-ring');
  ring.innerHTML = '';

  items.forEach(function (item, i) {
    const angle = (360 / items.length) * i;
    const card = document.createElement('div');
    card.className = 'orbital-item';
  card.setAttribute('data-title', item.title || '');
    card.style.transform = safeTransform(angle);

    if (item.type === 'image') {
      const img = document.createElement('img');
      img.src = item.src;
      card.appendChild(img);
    } else if (item.type === 'video') {
      const iframe = document.createElement('iframe');
      iframe.src = item.src.replace('watch?v=', 'embed/').split('&')[0] + '?autoplay=1&mute=1&loop=1';
      iframe.width = '100%';
      iframe.height = '100%';
      iframe.frameBorder = '0';
      iframe.allow = 'autoplay; encrypted-media';
      iframe.allowFullscreen = true;
      card.appendChild(iframe);
    }

    card.onclick = function () {
      openLightbox(item);
    };

    ring.appendChild(card);
  });
}

function applyTimeFilter(media, filter) {
  const now = new Date();
  return media.filter(function (item) {
    const uploaded = new Date(item.uploadedAt || now);
    const days = (now - uploaded) / (1000 * 60 * 60 * 24);
    if (filter === 'Today') return days < 1;
    if (filter === 'This Week') return days < 7;
    if (filter === 'This Month') return days < 30;
    if (filter === 'This Year') return uploaded.getFullYear() === now.getFullYear();
    return true;
  });
}

function fillTo12(items) {
  const out = [...items];
  while (out.length < 12 && items.length > 0) {
    out.push(items[out.length % items.length]);
  }
  return out;
}

function generateFallbackMedia() {
  const now = new Date().toISOString();
  const hudson = {
    type: 'image',
    title: 'Hudson Ingram',
    uploadedAt: now,
    src: 'https://allmyfriendsinc.com/uploads/444a59dfe2a66aa5224c7038f7539b15'
  };
  return Array(12).fill(hudson);
}

function openLightbox(item) {
  const modal = document.createElement('div');
  modal.className = 'lightbox-modal';
  modal.innerHTML = '<div class="lightbox-inner"></div>';
  const inner = modal.querySelector('.lightbox-inner');

  if (item.type === 'image') {
    const img = document.createElement('img');
    img.src = item.src;
    inner.appendChild(img);
  } else if (item.type === 'video') {
    const iframe = document.createElement('iframe');
    iframe.src = item.src.replace('watch?v=', 'embed/').split('&')[0] + '?autoplay=1&mute=1';
    iframe.frameBorder = '0';
    iframe.allow = 'autoplay; encrypted-media';
    iframe.allowFullscreen = true;
    inner.appendChild(iframe);
  }

  modal.onclick = function () {
    modal.remove();
  };

  document.body.appendChild(modal);
}

// NEW: renderDualArcLayout with center focus + symmetrical side arcs
function renderDualArcLayout(media) {
  const ring = document.querySelector('.orbital-ring');
  ring.innerHTML = '';

  const left = media.slice(0, 5);
  const center = media[5];
  const right = media.slice(6, 11);

  // Left arc: top-down curve
  left.forEach(function (item, i) {
    const angle = -40 + i * 20;
    const card = buildArcCard(item, angle);
    ring.appendChild(card);
  });

  // Center card
  const centerCard = buildCenterCard(center);
  ring.appendChild(centerCard);

  // Right arc: bottom-up curve
  right.forEach(function (item, i) {
    const angle = 40 - i * 20;
    const card = buildArcCard(item, angle);
    ring.appendChild(card);
  });
}

function buildArcCard(item, angle) {
  const card = document.createElement('div');
  card.className = 'orbital-item';
  card.setAttribute('data-title', item.title || '');
  card.style.transform = 'rotate(' + angle + 'deg) translateY(-220px) rotate(' + (-angle) + 'deg)';

  if (item.type === 'image') {
    const img = document.createElement('img');
    img.src = item.src;
    card.appendChild(img);
  } else if (item.type === 'video') {
    const iframe = document.createElement('iframe');
    iframe.src = item.src.replace('watch?v=', 'embed/').split('&')[0] + '?autoplay=0&mute=1&loop=1';
    iframe.width = '100%';
    iframe.height = '100%';
    iframe.frameBorder = '0';
    iframe.allow = 'autoplay; encrypted-media';
    iframe.allowFullscreen = true;
    card.appendChild(iframe);
  }

  return card;
}

function buildCenterCard(item) {
  const card = document.createElement('div');
  card.className = 'orbital-item center-active';

  if (item.type === 'image') {
    const img = document.createElement('img');
    img.src = item.src;
    card.appendChild(img);
  } else if (item.type === 'video') {
    const iframe = document.createElement('iframe');
    iframe.src = item.src.replace('watch?v=', 'embed/').split('&')[0] + '?autoplay=1&mute=1&loop=1';
    iframe.width = '100%';
    iframe.height = '100%';
    iframe.frameBorder = '0';
    iframe.allow = 'autoplay; encrypted-media';
    iframe.allowFullscreen = true;
    card.appendChild(iframe);
  }

  return card;
}

// Final renderShowcase wired to dual arc layout
function renderShowcase(filter) {
  fetch('/api/hudson-ingram/showcase')
    .then(res => res.json())
    .then(data => {
      if (!data.media || !data.media.length) {
        data.media = generateFallbackMedia();
      }

      const media = applyTimeFilter(data.media, filter);
      const filled = fillTo12(media); // guarantee at least 12
      renderDualArcLayout(filled);
    });
}

// NEW: renderArtCircleLayout using side arcs + center panel
function renderArtCircleLayout(media) {
  const ring = document.querySelector('.orbital-ring');
  ring.innerHTML = '';

  const left = media.slice(0, 5);
  const center = media[5];
  const right = media.slice(6, 11);

  // Left arc: bottom-left to top-left
  left.forEach(function (item, i) {
    const angle = -90 + i * 16;
    const card = buildArcCard(item, angle);
    ring.appendChild(card);
  });

  // Right arc: bottom-right to top-right
  right.forEach(function (item, i) {
    const angle = 90 - i * 16;
    const card = buildArcCard(item, angle);
    ring.appendChild(card);
  });

  // Center info panel
  const panel = document.createElement('div');
  panel.className = 'center-panel';
  panel.innerHTML = `
    <h3>${center.title || 'Untitled'}</h3>
    <p>Uploaded: ${center.uploadedAt ? new Date(center.uploadedAt).toLocaleDateString() : 'N/A'}</p>
    <button onclick="alert('Coming soon')">View Collection</button>
  `;
  ring.appendChild(panel);
}

// Inject this final render connection
function renderShowcase(filter) {
  fetch('/api/hudson-ingram/showcase')
    .then(res => res.json())
    .then(data => {
      if (!data.media || !data.media.length) {
        data.media = generateFallbackMedia();
      }
      const media = applyTimeFilter(data.media, filter);
      const filled = fillTo12(media);
      renderArtCircleLayout(filled);
    });
}

// UPDATED: More horizontal arc + spacing
function renderArtCircleLayout(media) {
  const ring = document.querySelector('.orbital-ring');
  ring.innerHTML = '';

  const left = media.slice(0, 5);
  const center = media[5];
  const right = media.slice(6, 11);

  // Left arc: bottom-left to top-left with smoother curve
  left.forEach(function (item, i) {
    const angle = -70 + i * 14;
    const card = buildArcCard(item, angle);
    ring.appendChild(card);
  });

  // Right arc: bottom-right to top-right
  right.forEach(function (item, i) {
    const angle = 70 - i * 14;
    const card = buildArcCard(item, angle);
    ring.appendChild(card);
  });

  // Center metadata panel
  const panel = document.createElement('div');
  panel.className = 'center-panel';
  panel.innerHTML = `
    <h3>${center.title || 'Untitled'}</h3>
    <p>Uploaded: ${center.uploadedAt ? new Date(center.uploadedAt).toLocaleDateString() : 'N/A'}</p>
    <button onclick="alert('Coming soon')">View Collection</button>
  `;
  ring.appendChild(panel);
}

// FINAL ARC FIX: Side-fanned layout like Art Circles
function renderArtCircleLayout(media) {
  const ring = document.querySelector('.orbital-ring');
  ring.innerHTML = '';

  const left = media.slice(0, 5);
  const center = media[5];
  const right = media.slice(6, 11);

  // Left arc: vertical upward diagonal fan
  left.forEach(function (item, i) {
    const card = buildArcCard(item);
    const x = -180 + i * 35;
    const y = 150 - i * 30;
    card.style.transform = `translate(${x}px, ${y}px)`;
    ring.appendChild(card);
  });

  // Right arc: mirror fan
  right.forEach(function (item, i) {
    const card = buildArcCard(item);
    const x = 180 - i * 35;
    const y = 150 - i * 30;
    card.style.transform = `translate(${x}px, ${y}px)`;
    ring.appendChild(card);
  });

  // Center panel
  const panel = document.createElement('div');
  panel.className = 'center-panel';
  panel.innerHTML = `
    <h3>${center.title || 'Untitled'}</h3>
    <p>Uploaded: ${center.uploadedAt ? new Date(center.uploadedAt).toLocaleDateString() : 'N/A'}</p>
    <button onclick="alert('Coming soon')">View Collection</button>
  `;
  ring.appendChild(panel);
}

console.log('[Showcase] Script loaded');

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('showcase');
  if (!container) return;

  const artist = getArtistFromURL();
  const media = await loadShowcaseMedia(artist);
  renderShowcase(container, media);
  setupScrollEffects(container);
});

function getArtistFromURL() {
  const parts = window.location.pathname.split('/');
  const index = parts.indexOf('dashboard') - 1;
  return parts[index] || 'default-artist';
}

async function loadShowcaseMedia(artist) {
  try {
    const res = await fetch(\`/api/\${artist}/showcase\`);
    const data = await res.json();
    return data.media || [];
  } catch {
    return [
      {
        type: 'image',
        title: 'Fallback Image',
        src: 'https://allmyfriendsinc.com/uploads/444a59dfe2a66aa5224c7038f7539b15'
      },
      {
        type: 'video',
        title: 'Fallback Video',
        src: '/video/sample.mp4'
      }
    ];
  }
}

function renderShowcase(container, media) {
  container.innerHTML = '';
  media.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = \`showcase-card showcase-\${item.type}\`;
    el.style.setProperty('--i', i);

    if (item.type === 'image') {
      el.innerHTML = \`<img src="\${item.src}" alt="\${item.title}" /><div class="caption">\${item.title}</div>\`;
    } else if (item.type === 'video') {
      el.innerHTML = \`
        <video muted loop playsinline preload="none" class="showcase-video">
          <source src="\${item.src}" type="video/mp4" />
        </video>
        <div class="caption">\${item.title}</div>
      \`;
    }

    el.addEventListener('click', () => openLightbox(item));
    container.appendChild(el);
  });
}

function setupScrollEffects(container) {
  container.addEventListener('scroll', () => {
    const cards = container.querySelectorAll('.showcase-card');
    const mid = container.offsetWidth / 2;

    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      const centerOffset = rect.left + rect.width / 2 - mid;
      const scale = Math.max(0.85, 1 - Math.abs(centerOffset / mid));
      card.style.transform = \`scale(\${scale})\`;
      card.style.opacity = scale;

      const video = card.querySelector('video');
      if (video) {
        if (Math.abs(centerOffset) < rect.width / 2) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    });
  });
}

function openLightbox(item) {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';

  const inner = document.createElement('div');
  inner.className = 'lightbox-content';

  const close = document.createElement('button');
  close.className = 'lightbox-close';
  close.innerHTML = '&times;';
  close.onclick = () => overlay.remove();

  if (item.type === 'image') {
    inner.innerHTML = \`<img src="\${item.src}" alt="\${item.title}" />\`;
  } else if (item.type === 'video') {
    inner.innerHTML = \`<video src="\${item.src}" controls autoplay loop style="width: 100%; border-radius: 8px;" />\`;
  }

  overlay.appendChild(close);
  overlay.appendChild(inner);
  document.body.appendChild(overlay);
}

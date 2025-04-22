# Setup Showcase layout, logic, and styles from scratch

# 1. index.html
cat > public/partner/dashboard/index.html << 'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Partner Dashboard</title>

  <!-- Styles -->
  <link rel="stylesheet" href="dashboard.css" />
  <link rel="stylesheet" href="audioplayer.css" />
  <link rel="stylesheet" href="comment-styles.css" />
  <link rel="stylesheet" href="coverflow.css" />
  <link rel="stylesheet" href="showcase.css" />
</head>
<body>
  <main id="dashboard">
    <h1>Partner Dashboard</h1>

    <!-- Showcase -->
    <section id="showcase-section">
      <h2>Showcase</h2>
      <div id="showcase"></div>
    </section>

    <!-- Audio -->
    <section class="audio-section">
      <h2>Audio Preview</h2>
      <div id="audio-player"></div>
    </section>

    <section id="tasks-section">
      <h2>Tasks</h2>
      <div id="tasks"></div>
    </section>

    <section id="comments-section">
      <h2>Team Comments</h2>
      <div id="comments"></div>
    </section>

    <section id="images-section">
      <h2>Image Carousel</h2>
      <div id="carousel"></div>
    </section>

    <section id="events-section">
      <h2>Upcoming Events</h2>
    </section>
  </main>

  <!-- Scripts -->
  <script src="coverflow.js"></script>
  <script src="showcase.js"></script>
  <script src="dashboard.js"></script>
  <script src="audioplayer.js"></script>
</body>
</html>
HTML

# 2. showcase.js
cat > public/partner/dashboard/showcase.js << 'JS'
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
JS

# 3. showcase.css
cat > public/partner/dashboard/showcase.css << 'CSS'
#showcase {
  display: flex;
  overflow-x: scroll;
  gap: 2rem;
  scroll-snap-type: x mandatory;
  padding: 2rem 1rem;
  scroll-behavior: smooth;
  perspective: 1000px;
}

#showcase::-webkit-scrollbar {
  display: none;
}

.showcase-card {
  scroll-snap-align: center;
  flex: 0 0 auto;
  width: 260px;
  min-height: 300px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 10px 24px rgba(0,0,0,0.1);
  transition: transform 0.3s ease, opacity 0.3s ease;
  text-align: center;
  padding: 1rem;
  transform-origin: center center;
}

.showcase-card img,
.showcase-card video {
  max-width: 100%;
  border-radius: 12px;
  object-fit: cover;
}

.caption {
  margin-top: 0.5rem;
  font-size: 0.95rem;
  color: #333;
}

/* Lightbox */
.lightbox-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.lightbox-content {
  max-width: 90%;
  max-height: 90%;
  background: #fff;
  padding: 1rem;
  border-radius: 12px;
  box-shadow: 0 0 40px rgba(0,0,0,0.2);
  position: relative;
}

.lightbox-content img,
.lightbox-content video {
  max-width: 100%;
  max-height: 80vh;
  display: block;
  margin: 0 auto;
}

.lightbox-close {
  position: absolute;
  top: -10px;
  right: -10px;
  background: white;
  color: black;
  border: none;
  font-size: 2rem;
  line-height: 1;
  border-radius: 100%;
  width: 32px;
  height: 32px;
}
CSS

# Done!
echo "✅ Showcase fully rebuilt!"

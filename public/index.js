// == index.js ==

// 1) Core globals
let allCovers = [];
let covers = [];
let activeIndex = 0;
let coverSpacing, anglePerOffset, minScale;
const maxAngle = 80;

// Scroll/touch helpers
let wheelCooldown = false;
let touchStartX = 0;

const coverflowEl = document.getElementById('coverflow');
const hoverDisplay = document.getElementById('hover-credits');

// 2) Inject global font/style
fetch('/data/test-styles.json')
  .then(res => res.json())
  .then(style => {
    const tag = document.getElementById('global-styles');
    const font = style.fontFamily || 'GT America';
    const size = style.fontSize   || 16;
    tag.innerHTML = `
      html, body { font-family:'${font}',sans-serif; font-size:${size}px; }
      .cover-label { font-family:'${style.overrides?.coverLabel?.fontFamily||font}',sans-serif; font-size:${style.overrides?.coverLabel?.fontSize||14}px; }
      .filter-label { font-family:'${style.overrides?.filterLabel?.fontFamily||font}',sans-serif; font-size:${style.overrides?.filterLabel?.fontSize||13}px; }
      .hover-credits-container { font-family:'${style.overrides?.hoverCredits?.fontFamily||font}',sans-serif; font-size:${style.overrides?.hoverCredits?.fontSize||12}px; }
    `;
  })
  .catch(console.error);

// 3) Fetch covers data
fetch(`/data/covers.json?cachebust=${Date.now()}`)
  .then(res => res.json())
  .then(data => {
    allCovers = data;
    covers = [...allCovers];
    activeIndex = Math.floor(covers.length / 2);
    updateLayoutParameters();
    renderCovers();
    renderCoverFlow();
  })
  .catch(err => console.error('Error fetching covers:', err));

// 4) Responsive layout parameters
function updateLayoutParameters() {
  const vw = window.innerWidth;
  coverSpacing   = Math.max(120, vw * 0.18);
  anglePerOffset = vw < 600 ? 50 : 65;
  minScale       = vw < 600 ? 0.45 : 0.5;
}
window.addEventListener('resize', () => {
  updateLayoutParameters();
  renderCoverFlow();
});

// 5) Build cover elements
function renderCovers() {
  coverflowEl.innerHTML = '';
  covers.forEach((cover, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'cover';
    wrapper.dataset.index = i;
    wrapper.dataset.originalIndex = cover.id;
    wrapper.dataset.category = cover.category;

    // Flip container
    const flip = document.createElement('div');
    flip.className = 'flip-container';

    // Front
    const front = document.createElement('div');
    front.className = 'cover-front';
    front.style.backgroundImage = `url('${cover.frontImage}')`;

    // Back
    const back = document.createElement('div');
    back.className = 'cover-back';
    const backContent = document.createElement('div');
    backContent.className = 'back-content';

    if (cover.albumTitle?.toLowerCase() === 'contact') {
      const contactBtn = document.createElement('a');
      contactBtn.href = 'mailto:hi@allmyfriendsinc.com';
      contactBtn.innerText = 'Contact Us';
      contactBtn.className = 'expand-btn';
      backContent.appendChild(contactBtn);
    } else {
      const artistDetailsBtn = document.createElement('button');
      artistDetailsBtn.className = 'expand-btn';
      artistDetailsBtn.innerText = 'Artist Details';
      backContent.appendChild(artistDetailsBtn);

      const labelFront = document.createElement('div');
      labelFront.className = 'cover-label';
      labelFront.innerHTML = `<strong>${cover.albumTitle||''}</strong><br/>${cover.coverLabel||''}`;
      wrapper.appendChild(labelFront);

      const labelBack = document.createElement('div');
      labelBack.className = 'back-label';
      labelBack.innerHTML = `<strong>${cover.albumTitle||''}</strong><br/>${cover.coverLabel||''}`;
      wrapper.appendChild(labelBack);

      if (cover.music?.type === 'embed' && cover.music.url) {
        backContent.innerHTML += `
          <iframe style="border-radius:12px"
            src="${cover.music.url.replace('spotify.com/','spotify.com/embed/')}"
            width="100%" height="352" frameborder="0"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"></iframe>`;
      }
    }

    back.appendChild(backContent);
    flip.appendChild(front);
    flip.appendChild(back);
    wrapper.appendChild(flip);

    // Tap to flip or move
    wrapper.addEventListener('click', () => {
      const idx = parseInt(wrapper.dataset.index, 10);
      const off = idx - activeIndex;
      if (off === 0) {
        flip.classList.toggle('flipped');
      } else {
        setActiveIndex(idx);
      }
    });

    coverflowEl.appendChild(wrapper);
  });
}

// 6) Position & transform covers
function renderCoverFlow() {
  document.querySelectorAll('.cover').forEach(cover => {
    const i      = +cover.dataset.index;
    const offset = i - activeIndex;
    const eff    = Math.sign(offset) * Math.log2(Math.abs(offset) + 1);
    const scale  = Math.max(minScale, 1 - Math.abs(offset) * 0.08);
    const tx     = eff * coverSpacing;
    const ry     = Math.max(-maxAngle, Math.min(offset * -anglePerOffset, maxAngle));

    cover.style.transform = `
      translate(-50%, -50%)
      translateX(${tx}px)
      scale(${scale})
      rotateY(${ry}deg)
    `;
    cover.style.zIndex = covers.length - Math.abs(offset);

    // remove flipped on non-active
    const fc = cover.querySelector('.flip-container');
    if (offset !== 0) fc?.classList.remove('flipped');
    cover.classList.toggle('cover-active', offset === 0);
  });

  // optional: update ambient glow here if implemented
}

// 7) Clamp active index & rerender
function setActiveIndex(idx) {
  activeIndex = Math.max(0, Math.min(idx, covers.length - 1));
  renderCoverFlow();
}

// ─── Scroll & Touch Handlers ────────────────────────────────
// Prevent native page scroll on all touch moves inside coverflow
coverflowEl.addEventListener('touchmove', e => {
  e.preventDefault();
}, { passive: false });

// Desktop wheel: only horizontal, throttled
window.addEventListener('wheel', e => {
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
  e.preventDefault();
  if (!wheelCooldown) {
    setActiveIndex(activeIndex + (e.deltaX > 0 ? 1 : -1));
    wheelCooldown = true;
    setTimeout(() => { wheelCooldown = false; }, 120);
  }
}, { passive: false });

// Mobile swipe: discrete step
coverflowEl.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].screenX;
});
coverflowEl.addEventListener('touchend', e => {
  const endX = e.changedTouches[0].screenX;
  const diff = endX - touchStartX;
  if (Math.abs(diff) > 60) {
    setActiveIndex(activeIndex + (diff < 0 ? 1 : -1));
  }
});

// 8) Keyboard nav & Escape
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft')  setActiveIndex(activeIndex - 1);
  if (e.key === 'ArrowRight') setActiveIndex(activeIndex + 1);
  if (e.key === 'Escape')     document.querySelector('.artist-modal').classList.add('hidden');
});

// 9) Modal logic (unchanged from before)
// ...insert your existing click-to-open, backdrop, and close-button logic here...

// 10) Filter logic (unchanged)
// ...insert your existing dropdown and click handlers here...


// ─── Modal logic (unchanged) ───────────────────────────
document.body.addEventListener("click", (e) => {
  if (e.target.classList.contains("expand-btn") && e.target.tagName === "BUTTON") {
    const coverEl = e.target.closest('.cover');
    const coverId = coverEl?.dataset.originalIndex;
    const cover = covers.find(c => c.id == coverId);
    if (!cover || !cover.artistDetails) return;
    const modal = document.querySelector('.artist-modal');
    modal.querySelector('.artist-photo').src = cover.artistDetails.image;
    modal.querySelector('.artist-name').innerText = cover.artistDetails.name;
    modal.querySelector('.artist-location').innerText = cover.artistDetails.location;
    modal.querySelector('.artist-bio').innerText = cover.artistDetails.bio;
    modal.querySelector('.spotify-link').href = cover.artistDetails.spotifyLink;
    if (cover.artistDetails.spotifyLink.includes("spotify.com")) {
      modal.querySelector('.spotify-player').src =
        cover.artistDetails.spotifyLink.replace("spotify.com/", "spotify.com/embed/");
    } else {
      modal.querySelector('.spotify-player').style.display = 'none';
    }
    modal.classList.remove('hidden');
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft")  setActiveIndex(activeIndex - 1);
  if (e.key === "ArrowRight") setActiveIndex(activeIndex + 1);
  if (e.key === "Escape")     document.querySelector('.artist-modal').classList.add('hidden');
});

document.querySelector('.artist-modal').addEventListener("click", (e) => {
  if (e.target.classList.contains("artist-modal")) {
    const modalContent = e.target.querySelector('.modal-content');
    modalContent.classList.add('pulse-dismiss');
    setTimeout(() => {
      e.target.classList.add('hidden');
      modalContent.classList.remove('pulse-dismiss');
    }, 250);
  }
});
document.querySelector('.artist-modal .close-btn').addEventListener('click', () => {
  document.querySelector('.artist-modal').classList.add('hidden');
});

// ─── Filter logic (unchanged) ───────────────────────────
const filterButtons = Array.from(document.querySelectorAll(".filter-label"));
const filterDropdown = document.createElement("div");
filterDropdown.className = "filter-dropdown";
document.body.appendChild(filterDropdown);

filterButtons.forEach((btn) => {
  btn.addEventListener("mouseenter", () => {
    const filter = btn.dataset.filter;
    const results = allCovers.filter(c => filter === "all" || c.category?.includes(filter));
    const items = results.map(c => `
      <div class="dropdown-item" data-id="${c.id}">
        ${c.albumTitle || "Untitled"} — ${c.coverLabel || ""}
      </div>
    `).join("") || "<div class='dropdown-item'>No results</div>";
    filterDropdown.innerHTML = items;
    filterDropdown.style.display = "block";
    const rect = btn.getBoundingClientRect();
    filterDropdown.style.left = `${rect.left}px`;
    filterDropdown.style.top = `${rect.bottom + 5}px`;
  });
  btn.addEventListener("mouseleave", () => {
    setTimeout(() => {
      if (!filterDropdown.matches(":hover")) filterDropdown.style.display = "none";
    }, 100);
  });
  btn.addEventListener("click", () => {
    filterButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const filter = btn.dataset.filter;
    covers = filter === "all"
      ? [...allCovers]
      : allCovers.filter(c => c.category?.includes(filter));
    activeIndex = Math.floor(covers.length / 2);
    renderCovers();
    renderCoverFlow();
  });
});

filterDropdown.addEventListener("mouseleave", () => { filterDropdown.style.display = "none"; });
filterDropdown.addEventListener("click", (e) => {
  const id = e.target.dataset.id;
  if (!id) return;
  const idx = covers.findIndex(c => c.id.toString() === id);
  if (idx !== -1) {
    setActiveIndex(idx);
    filterDropdown.style.display = "none";
  }
});

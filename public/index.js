let allCovers = [];
let covers = [];
let activeIndex = 0;
let coverSpacing, anglePerOffset, minScale;
const maxAngle = 80;

// ─── Drag‑and‑snap state ──────────────────────────────────────
let isDragging = false;
let dragStartX = 0;
let dragOffset = 0;
let dragIndex = null;

const coverflowEl = document.getElementById("coverflow");
const hoverDisplay = document.getElementById("hover-credits");

// Inject global font/style
fetch('/data/test-styles.json')
  .then(res => res.json())
  .then(style => {
    const styleTag = document.createElement("style");
    styleTag.id = "global-styles";

    const font = style.fontFamily || 'GT America';
    const size = style.fontSize || 16;

    styleTag.innerHTML = `
      html, body {
        font-family: '${font}', sans-serif;
        font-size: ${size}px;
      }
      .cover-label {
        font-family: '${style.overrides?.coverLabel?.fontFamily || font}';
        font-size: ${style.overrides?.coverLabel?.fontSize || 14}px;
      }
      .filter-label {
        font-family: '${style.overrides?.filterLabel?.fontFamily || font}';
        font-size: ${style.overrides?.filterLabel?.fontSize || 13}px;
      }
      .hover-credits-container {
        font-family: '${style.overrides?.hoverCredits?.fontFamily || font}';
        font-size: ${style.overrides?.hoverCredits?.fontSize || 12}px;
      }
    `;

    document.head.appendChild(styleTag);
  });

// Fetch covers
fetch(`/data/covers.json?cachebust=${Date.now()}`)
  .then(res => res.json())
  .then(data => {
    allCovers = data;
    covers = [...allCovers];
    activeIndex = Math.floor(covers.length / 2);
    updateLayoutParameters();
    renderCovers();
    renderCoverFlow(); // no drag
  })
  .catch(err => console.error("Error fetching covers:", err));

function updateLayoutParameters() {
  const vw = window.innerWidth;
  coverSpacing = Math.max(120, vw * 0.18);
  anglePerOffset = vw < 600 ? 50 : 65;
  minScale = vw < 600 ? 0.45 : 0.5;
}

// Build DOM
function renderCovers() {
  coverflowEl.innerHTML = "";

  covers.forEach((cover, i) => {
    const wrapper = document.createElement("div");
    wrapper.className = "cover";
    wrapper.dataset.index = i;
    wrapper.dataset.originalIndex = cover.id;
    wrapper.dataset.category = cover.category;

    const flip = document.createElement("div");
    flip.className = "flip-container";

    const front = document.createElement("div");
    front.className = "cover-front";
    front.style.backgroundImage = `url('${cover.frontImage}')`;

    const back = document.createElement("div");
    back.className = "cover-back";
    const backContent = document.createElement("div");
    backContent.className = "back-content";

    if (cover.music?.type === "embed" && cover.music.url) {
      backContent.innerHTML = `
        <iframe style="border-radius:12px"
          src="${cover.music.url.replace('spotify.com/', 'spotify.com/embed/')}"
          width="100%" height="352" frameBorder="0"
          allowfullscreen allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy">
        </iframe>`;
    }

    if (cover.albumTitle?.toLowerCase() === "contact") {
      const contactBtn = document.createElement("a");
      contactBtn.href = "mailto:hi@allmyfriendsinc.com";
      contactBtn.innerText = "Contact Us";
      contactBtn.className = "expand-btn";
      backContent.appendChild(contactBtn);
    } else {
      const artistDetailsBtn = document.createElement("button");
      artistDetailsBtn.className = "expand-btn";
      artistDetailsBtn.innerText = "Artist Details";
      backContent.appendChild(artistDetailsBtn);

      const labelFront = document.createElement("div");
      labelFront.className = "cover-label";
      labelFront.innerHTML = `<strong>${cover.albumTitle || ""}</strong><br/>${cover.coverLabel || ""}`;
      wrapper.appendChild(labelFront);

      const labelBack = document.createElement("div");
      labelBack.className = "back-label";
      labelBack.innerHTML = `<strong>${cover.albumTitle || ""}</strong><br/>${cover.coverLabel || ""}`;
      wrapper.appendChild(labelBack);
    }

    back.appendChild(backContent);
    flip.appendChild(front);
    flip.appendChild(back);
    wrapper.appendChild(flip);

    wrapper.addEventListener("click", () => {
      const i = parseInt(wrapper.dataset.index, 10);
      const offset = i - activeIndex;
      const fc = wrapper.querySelector(".flip-container");
      if (offset === 0 && fc) {
        fc.classList.toggle("flipped");
      } else {
        setActiveIndex(i);
      }
    });

    coverflowEl.appendChild(wrapper);
  });
}

// Key change: renderCoverFlow can take a fractional dragOffset
function renderCoverFlow(dragOffsetParam = 0) {
  // decide which “index” to center on:
  const indexRef = (dragIndex !== null ? dragIndex : activeIndex);
  // and whether to apply the fractional offset
  const useOffset = (dragIndex !== null ? dragOffsetParam : 0);

  document.querySelectorAll(".cover").forEach((cover) => {
    const i = parseInt(cover.dataset.index, 10);
    const rawOffset = i - indexRef - useOffset;
    const effOffset = Math.sign(rawOffset) * Math.log2(Math.abs(rawOffset) + 1);
    const translateX = effOffset * coverSpacing;
    const rotateY = Math.max(-maxAngle, Math.min(rawOffset * -anglePerOffset, maxAngle));
    const scale = Math.max(minScale, 1 - Math.abs(rawOffset) * 0.08);

    cover.style.transform = `
      translate(-50%, -50%)
      translateX(${translateX}px)
      scale(${scale})
      rotateY(${rotateY}deg)
    `;
    cover.style.zIndex = covers.length - Math.abs(rawOffset);

    const fc = cover.querySelector(".flip-container");
    if (Math.round(rawOffset) !== 0) fc?.classList.remove("flipped");
    cover.classList.toggle("cover-active", Math.round(rawOffset) === 0);
  });
}

function setActiveIndex(idx) {
  activeIndex = Math.max(0, Math.min(idx, covers.length - 1));
  renderCoverFlow();
}

// ─── Desktop wheel navigation (unchanged) ─────────────────
let wheelCooldown = false;
let lastWheelDirection = 0;

window.addEventListener("wheel", (e) => {
  e.preventDefault();
  document.querySelectorAll(".flip-container.flipped").forEach(fc => fc.classList.remove("flipped"));
  if (!wheelCooldown) {
    const dir = e.deltaX > 0 ? 1 : -1;
    if (dir !== lastWheelDirection || !wheelCooldown) {
      setActiveIndex(activeIndex + dir);
      lastWheelDirection = dir;
      wheelCooldown = true;
      setTimeout(() => { wheelCooldown = false; }, 120);
    }
  }
}, { passive: false });

// ─── Touch‑drag & snap for mobile ────────────────────────
coverflowEl.addEventListener("touchstart", (e) => {
  if (e.touches.length !== 1) return;
  isDragging = true;
  dragStartX = e.touches[0].clientX;
  dragOffset = 0;
  dragIndex = activeIndex;
  // disable CSS transitions so covers follow instantly
  document.querySelectorAll(".cover").forEach(c => {
    c.style.transition = "none";
  });
}, { passive: false });

coverflowEl.addEventListener("touchmove", (e) => {
  if (!isDragging) return;
  e.preventDefault();
  const deltaX = dragStartX - e.touches[0].clientX;
  dragOffset = deltaX / coverSpacing;
  renderCoverFlow(dragOffset);
}, { passive: false });

function endDrag() {
  if (!isDragging) return;
  isDragging = false;
  // snap to nearest
  let newIdx = Math.round(dragIndex + dragOffset);
  newIdx = Math.max(0, Math.min(newIdx, covers.length - 1));
  // re‑enable transitions for the snap animation
  document.querySelectorAll(".cover").forEach(c => {
    c.style.transition = "transform 0.5s cubic-bezier(0.22,1,0.36,1), filter 0.3s ease";
  });
  // perform the final snap
  setActiveIndex(newIdx);
  dragIndex = null;
  dragOffset = 0;
}

coverflowEl.addEventListener("touchend",   endDrag);
coverflowEl.addEventListener("touchcancel", endDrag);

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

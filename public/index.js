// index.js

let allCovers = [];
let covers = [];
let activeIndex = 0;

let coverSpacing, anglePerOffset, minScale;
const maxAngle = 80;

// Detect “mobile” breakpoint (must match your CSS @media)
const isMobile = window.innerWidth <= 768;

const coverflowContainer = document.getElementById("coverflow-container");
const coverflowEl        = document.getElementById("coverflow");
const hoverDisplay       = document.getElementById("hover-credits");

// 1) Inject global font/style
fetch('/data/test-styles.json')
  .then(res => res.json())
  .then(style => {
    const styleTag = document.createElement("style");
    styleTag.id = "global-styles";

    const font = style.fontFamily || 'GT America';
    const size = style.fontSize   || 16;

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
  })
  .catch(console.error);

// 2) Fetch covers data
fetch(`/data/covers.json?cachebust=${Date.now()}`)
  .then(res => res.json())
  .then(data => {
    allCovers = data;
    covers    = [...allCovers];
    activeIndex = Math.floor(covers.length / 2);

    updateLayoutParameters();
    renderCovers();
    renderCoverFlow();
  })
  .catch(err => console.error("Error fetching covers:", err));

// 2a) Recompute layout on resize
window.addEventListener("resize", () => {
  updateLayoutParameters();
  renderCoverFlow();
});

// ==== Layout Parameter Calculation ====
function updateLayoutParameters() {
  const vw = window.innerWidth;
  coverSpacing   = Math.max(120, vw * 0.18);
  anglePerOffset = vw < 600 ? 50 : 65;
  minScale       = vw < 600 ? 0.45 : 0.5;
}

// ==== Render Cover Elements ====
function renderCovers() {
  coverflowEl.innerHTML = "";

  covers.forEach((cover, i) => {
    const wrapper = document.createElement("div");
    wrapper.className = "cover";
    wrapper.dataset.index = i;
    wrapper.dataset.originalIndex = cover.id;
    wrapper.dataset.category = cover.category;

    // Flip container
    const flip = document.createElement("div");
    flip.className = "flip-container";

    // Front face
    const front = document.createElement("div");
    front.className = "cover-front";
    front.style.backgroundImage = `url('${cover.frontImage}')`;

    // Back face
    const back = document.createElement("div");
    back.className = "cover-back";

    const backContent = document.createElement("div");
    backContent.className = "back-content";

    // Spotify embed or contact
    if (cover.music?.type === "embed" && cover.music.url) {
      backContent.innerHTML = `
        <iframe style="border-radius:12px"
                src="${cover.music.url.replace('spotify.com/','spotify.com/embed/')}"
                width="100%" height="352" frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"></iframe>`;
    }

    if (cover.albumTitle?.toLowerCase() === "contact") {
      // Contact only
      const contactBtn = document.createElement("a");
      contactBtn.href = "mailto:hi@allmyfriendsinc.com";
      contactBtn.innerText = "Contact Us";
      contactBtn.className = "expand-btn";
      backContent.appendChild(contactBtn);
    } else {
      // Artist Details button
      const artistDetailsBtn = document.createElement("button");
      artistDetailsBtn.className = "expand-btn";
      artistDetailsBtn.innerText = "Artist Details";
      backContent.appendChild(artistDetailsBtn);

      // Labels front & back
      const labelFront = document.createElement("div");
      labelFront.className = "cover-label";
      labelFront.innerHTML = `<strong>${cover.albumTitle||""}</strong><br/>${cover.coverLabel||""}`;
      wrapper.appendChild(labelFront);

      const labelBack = document.createElement("div");
      labelBack.className = "back-label";
      labelBack.innerHTML = `<strong>${cover.albumTitle||""}</strong><br/>${cover.coverLabel||""}`;
      wrapper.appendChild(labelBack);
    }

    back.appendChild(backContent);
    flip.appendChild(front);
    flip.appendChild(back);
    wrapper.appendChild(flip);

    // Tap handler: flip center / move others
    wrapper.addEventListener("click", () => {
      const idx = parseInt(wrapper.dataset.index, 10);
      const offset = idx - activeIndex;
      if (offset === 0) {
        flip.classList.toggle("flipped");
      } else {
        setActiveIndex(idx);
      }
    });

    coverflowEl.appendChild(wrapper);
  });
}

// ==== Position & Transform Covers ====
function renderCoverFlow() {
  document.querySelectorAll(".cover").forEach(cover => {
    const i = parseInt(cover.dataset.index, 10);
    const offset = i - activeIndex;
    const effOffset = Math.sign(offset) * Math.log2(Math.abs(offset) + 1);
    const translateX = effOffset * coverSpacing;
    const rotateY = Math.max(-maxAngle,
                     Math.min(offset * -anglePerOffset, maxAngle));
    const scale = Math.max(minScale, 1 - Math.abs(offset) * 0.08);

    cover.style.transform = `
      translate(-50%, -50%)
      translateX(${translateX}px)
      scale(${scale})
      rotateY(${rotateY}deg)
    `;
    cover.style.zIndex = covers.length - Math.abs(offset);

    // Unflip non-active
    const fc = cover.querySelector(".flip-container");
    if (offset !== 0) fc?.classList.remove("flipped");

    // Highlight active
    cover.classList.toggle("cover-active", offset === 0);
  });
}

// ==== Change Active Index Safely ====
function setActiveIndex(index) {
  activeIndex = Math.max(0, Math.min(index, covers.length - 1));
  renderCoverFlow();
}

// ==== Wheel Scrolling ====
let wheelCooldown      = false;
let lastWheelDirection = 0;

coverflowContainer.addEventListener("wheel", e => {
  // Determine dominant delta
  const delta = isMobile ? e.deltaY : e.deltaX;
  const other = isMobile ? e.deltaX : e.deltaY;
  if (Math.abs(delta) < Math.abs(other)) return;

  e.preventDefault(); // Kill native scroll
  // Reset any flipped cards
  document.querySelectorAll(".flip-container.flipped")
          .forEach(fc => fc.classList.remove("flipped"));

  if (!wheelCooldown) {
    const direction = delta > 0 ? 1 : -1;
    if (direction !== lastWheelDirection || !wheelCooldown) {
      setActiveIndex(activeIndex + direction);
      lastWheelDirection = direction;
      wheelCooldown = true;
      setTimeout(() => wheelCooldown = false, 120);
    }
  }
}, { passive: false });

// ==== Touch Swiping (Mobile) ====
let touchStartY = 0;
let touchEndY   = 0;
let touchCooldown = false;

coverflowContainer.addEventListener("touchstart", e => {
  touchStartY = e.changedTouches[0].clientY;
}, { passive: true });

coverflowContainer.addEventListener("touchmove", e => {
  // Prevent native vertical scroll
  e.preventDefault();
  touchEndY = e.changedTouches[0].clientY;
}, { passive: false });

coverflowContainer.addEventListener("touchend", () => {
  const dy = touchStartY - touchEndY;
  if (Math.abs(dy) < 20 || touchCooldown) return;
  const direction = dy > 0 ? 1 : -1;
  setActiveIndex(activeIndex + direction);
  touchCooldown = true;
  setTimeout(() => touchCooldown = false, 120);
}, { passive: true });

// ==== Keyboard Navigation & Escape ====
window.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft")  setActiveIndex(activeIndex - 1);
  if (e.key === "ArrowRight") setActiveIndex(activeIndex + 1);
  if (e.key === "Escape") {
    document.querySelector(".artist-modal")?.classList.add("hidden");
  }
});

// ==== Artist Details Modal ====
document.body.addEventListener("click", e => {
  if (e.target.classList.contains("expand-btn") && e.target.tagName === "BUTTON") {
    const coverEl = e.target.closest(".cover");
    const id = coverEl?.dataset.originalIndex;
    const cover = covers.find(c => c.id == id);
    if (!cover?.artistDetails) return;

    const modal = document.querySelector(".artist-modal");
    modal.querySelector(".artist-photo").src      = cover.artistDetails.image;
    modal.querySelector(".artist-name").innerText = cover.artistDetails.name;
    modal.querySelector(".artist-location").innerText = cover.artistDetails.location;
    modal.querySelector(".artist-bio").innerText  = cover.artistDetails.bio;
    modal.querySelector(".spotify-link").href     = cover.artistDetails.spotifyLink;

    // Embedded player or hide
    const sp = modal.querySelector(".spotify-player");
    if (cover.artistDetails.spotifyLink.includes("spotify.com")) {
      sp.src = cover.artistDetails.spotifyLink.replace("spotify.com/", "spotify.com/embed/");
      sp.style.display = "";
    } else {
      sp.style.display = "none";
    }

    modal.classList.remove("hidden");
  }
});

// Backdrop / Close button
document.querySelector(".artist-modal")?.addEventListener("click", e => {
  if (e.target.classList.contains("artist-modal")) {
    e.target.classList.add("hidden");
  }
});
document.querySelector(".artist-modal .close-btn")?.addEventListener("click", () => {
  document.querySelector(".artist-modal")?.classList.add("hidden");
});

// ==== Filter Dropdown & Click Logic ====
const filterButtons = Array.from(document.querySelectorAll(".filter-label"));
const filterDropdown = document.createElement("div");
filterDropdown.className = "filter-dropdown";
document.body.appendChild(filterDropdown);

filterButtons.forEach(btn => {
  btn.addEventListener("mouseenter", () => {
    const filter = btn.dataset.filter;
    const results = allCovers.filter(c =>
      filter === "all" || c.category?.includes(filter)
    );
    filterDropdown.innerHTML = results.length
      ? results.map(c => `<div class="dropdown-item" data-id="${c.id}">
          ${c.albumTitle||"Untitled"} — ${c.coverLabel||""}
        </div>`).join("")
      : "<div class='dropdown-item'>No results</div>";

    const rect = btn.getBoundingClientRect();
    filterDropdown.style.left = `${rect.left}px`;
    filterDropdown.style.top  = `${rect.top - filterDropdown.offsetHeight - 8}px`;
    filterDropdown.style.display = "block";
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
    filterDropdown.style.display = "none";
  });
});

filterDropdown.addEventListener("mouseleave", () => {
  filterDropdown.style.display = "none";
});

filterDropdown.addEventListener("click", e => {
  const id = e.target.dataset.id;
  if (!id) return;
  const idx = covers.findIndex(c => c.id.toString() === id);
  if (idx >= 0) {
    setActiveIndex(idx);
    filterDropdown.style.display = "none";
  }
});

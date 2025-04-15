let allCovers = [];
let covers = [];
let activeIndex = 0;
let wheelLock = false;
let coverSpacing, anglePerOffset, minScale;
const maxAngle = 80;

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

    document.head.appendChild(styleTag); // ✅ This now runs AFTER styleTag.innerHTML
  });

// Updated fetch: pulling updated covers from GitHub instead of from local /data folder
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
  .catch(err => console.error("Error fetching covers from server:", err));


function updateLayoutParameters() {
  const vw = window.innerWidth;
  coverSpacing = Math.max(120, vw * 0.18);
  anglePerOffset = vw < 600 ? 50 : 65;
  minScale = vw < 600 ? 0.45 : 0.5;
}

function renderCovers() {
  coverflowEl.innerHTML = "";
  console.log("🟢 Rendering covers:", covers);

  covers.forEach((cover, i) => {
    console.log(`🔍 Cover [${i}] Data:`, cover);

    const wrapper = document.createElement("div");
    wrapper.className = "cover";
    wrapper.dataset.index = i;
    wrapper.dataset.originalIndex = cover.id;
    wrapper.dataset.category = cover.category;

    const flip = document.createElement("div");
    flip.className = "flip-container";

    const front = document.createElement("div");
    front.className = "cover-front";

    const imageUrl = cover.frontImage;
    console.log(`🖼️ Cover [${i}] URL: ${imageUrl}`);

    front.style.backgroundImage = `url('${imageUrl}')`;

    front.onerror = (e) => {
      console.error(`❌ Image load error [${i}] URL:`, imageUrl, e);
    };

    const back = document.createElement("div");  // ✅ This line was missing previously!
    back.className = "cover-back";

    const backContent = document.createElement("div");
    backContent.className = "back-content";

    if (cover.music?.type === "embed" && cover.music.url) {
      backContent.innerHTML = `
        <iframe style="border-radius:12px"
          src="${cover.music.url.replace('spotify.com/', 'spotify.com/embed/')}"
          width="100%"
          height="352"
          frameBorder="0"
          allowfullscreen
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy">
        </iframe>`;
    }

    // Add Artist Details Button to backContent
    const artistDetailsBtn = document.createElement("button");
    artistDetailsBtn.className = "expand-btn";
    artistDetailsBtn.innerText = "Artist Details";

    backContent.appendChild(artistDetailsBtn);

    back.appendChild(backContent);
    flip.appendChild(front);
    flip.appendChild(back);
    wrapper.appendChild(flip);

    const label = document.createElement("div");
    label.className = "cover-label";
    label.innerHTML = `<strong>${cover.albumTitle || ""}</strong><br/>${cover.coverLabel || ""}`;
    wrapper.appendChild(label);

    wrapper.addEventListener("click", (e) => {
      const i = parseInt(wrapper.dataset.index, 10);
      const offset = i - activeIndex;
      const flipContainer = wrapper.querySelector(".flip-container");

      if (offset === 0 && flipContainer) {
        flipContainer.classList.toggle("flipped");
      } else {
        setActiveIndex(i);
      }
    });

    coverflowEl.appendChild(wrapper);
  });
}


function renderCoverFlow() {
  document.querySelectorAll(".cover").forEach((cover) => {
    const i = parseInt(cover.dataset.index, 10);
    const offset = i - activeIndex;
    const effOffset = Math.sign(offset) * Math.log2(Math.abs(offset) + 1);
    const translateX = effOffset * coverSpacing;
    const rotateY = Math.max(-maxAngle, Math.min(offset * -anglePerOffset, maxAngle));
    const scale = Math.max(minScale, 1 - Math.abs(offset) * 0.08);

    cover.style.transform = `
      translate(-50%, -50%)
      translateX(${translateX}px)
      scale(${scale})
      rotateY(${rotateY}deg)
    `;
    cover.style.zIndex = covers.length - Math.abs(offset);

    const flipContainer = cover.querySelector(".flip-container");
    if (offset !== 0) flipContainer?.classList.remove("flipped");

    cover.classList.toggle("cover-active", offset === 0);
  });
}

function setActiveIndex(index) {
  activeIndex = Math.max(0, Math.min(index, covers.length - 1));
  renderCoverFlow();
}

// Filter dropdown logic
const filterButtons = Array.from(document.querySelectorAll(".filter-label"));
const filterDropdown = document.createElement("div");
filterDropdown.className = "filter-dropdown";
document.body.appendChild(filterDropdown);

filterButtons.forEach((btn) => {
  btn.addEventListener("mouseenter", () => {
    const filter = btn.dataset.filter;
    const results = allCovers
      .filter(c => filter === "all" || c.category?.includes(filter));

    const items = results.map(c => {
      return `<div class="dropdown-item" data-id="${c.id}">
        ${c.albumTitle || "Untitled"} — ${c.coverLabel || ""}
      </div>`;
    }).join("") || "<div class='dropdown-item'>No results</div>";

    filterDropdown.innerHTML = items;
    filterDropdown.style.display = "block";

    const rect = btn.getBoundingClientRect();
    filterDropdown.style.left = `${rect.left}px`;
    filterDropdown.style.top = `${rect.bottom + 5}px`;
  });

  btn.addEventListener("mouseleave", () => {
    setTimeout(() => {
      if (!filterDropdown.matches(":hover")) {
        filterDropdown.style.display = "none";
      }
    }, 100);
  });

  btn.addEventListener("click", () => {
    filterButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const filter = btn.dataset.filter;
    covers = filter === "all"
      ? [...allCovers]
      : allCovers.filter(c => c.category?.includes(filter));
    covers.forEach((c, i) => c.index = i);
    activeIndex = Math.floor(covers.length / 2);
    renderCovers();
    renderCoverFlow();
  });
});

filterDropdown.addEventListener("mouseleave", () => {
  filterDropdown.style.display = "none";
});
filterDropdown.addEventListener("click", (e) => {
  const id = e.target.dataset.id;
  if (!id) return;
  const matchIndex = covers.findIndex(c => c.id.toString() === id);
  if (matchIndex !== -1) {
    setActiveIndex(matchIndex);
    filterDropdown.style.display = "none";
  }
});

// Float animation
function animateKeywordDrift() {
  const now = Date.now() / 1000;
  filterButtons.forEach((label, i) => {
    const offset = Math.sin(now + i) * 10;
    label.style.transform = `translateY(${offset}px)`;
  });
  requestAnimationFrame(animateKeywordDrift);
}
animateKeywordDrift();

// Navigation
window.addEventListener("resize", () => {
  updateLayoutParameters();
  renderCoverFlow();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") setActiveIndex(activeIndex - 1);
  if (e.key === "ArrowRight") setActiveIndex(activeIndex + 1);
});
coverflowEl.addEventListener("wheel", (e) => {
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    e.preventDefault();
    if (!wheelLock) {
      setActiveIndex(activeIndex + (e.deltaX > 0 ? 1 : -1));
      wheelLock = true;
      setTimeout(() => { wheelLock = false; }, 150);
    }
  }
}, { passive: false });

let touchStartX = 0;
coverflowEl.addEventListener("touchstart", (e) => {
  touchStartX = e.changedTouches[0].screenX;
});
coverflowEl.addEventListener("touchend", (e) => {
  const touchEndX = e.changedTouches[0].screenX;
  const threshold = 60;
  if (touchEndX < touchStartX - threshold) setActiveIndex(activeIndex + 1);
  else if (touchEndX > touchStartX + threshold) setActiveIndex(activeIndex - 1);
});

// Modal interaction logic
document.body.addEventListener("click", (e) => {
  if (e.target.classList.contains("expand-btn")) {
    const coverId = e.target.closest('.cover').dataset.originalIndex;
    const cover = covers.find(c => c.id == coverId);

    if (!cover.artistDetails) return;

    const modal = document.querySelector('.artist-modal');
    modal.querySelector('.artist-photo').src = cover.artistDetails.image;
    modal.querySelector('.artist-info h1').innerText = cover.artistDetails.name;
    modal.querySelector('.artist-info .location').innerText = cover.artistDetails.location;
    modal.querySelector('.artist-info .bio').innerText = cover.artistDetails.bio;
    modal.querySelector('.spotify-link').href = cover.artistDetails.spotifyLink;

    // Embed Spotify player if a valid link provided
    if (cover.artistDetails.spotifyLink.includes("spotify.com")) {
      const embedUrl = cover.artistDetails.spotifyLink.replace("spotify.com/", "spotify.com/embed/");
      modal.querySelector('.spotify-player').src = embedUrl;
    } else {
      modal.querySelector('.spotify-player').style.display = 'none';
    }

    modal.classList.remove('hidden');
  }

  // Clicking outside modal closes it
  if (e.target.classList.contains("artist-modal")) {
    e.target.classList.add('hidden');
  }
});
// Close modal on Escape key
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.querySelector('.artist-modal');
    if (!modal.classList.contains('hidden')) {
      modal.classList.add('hidden');
    }
  }
});
// Close modal on clicking close button
document.querySelector('.artist-modal .close-btn').addEventListener('click', () => {
  const modal = document.querySelector('.artist-modal');
  modal.classList.add('hidden');
});

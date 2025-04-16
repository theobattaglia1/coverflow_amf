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

    document.head.appendChild(styleTag);
  });

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
  .catch(err => console.error("Error fetching covers:", err));

function updateLayoutParameters() {
  const vw = window.innerWidth;
  coverSpacing = Math.max(120, vw * 0.18);
  anglePerOffset = vw < 600 ? 50 : 65;
  minScale = vw < 600 ? 0.45 : 0.5;
}

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
          width="100%"
          height="352"
          frameBorder="0"
          allowfullscreen
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy">
        </iframe>`;
    }

  if (cover.albumTitle?.toLowerCase() === "contact") {
  // CONTACT: Mailto button only, no labels
  const contactBtn = document.createElement("a");
  contactBtn.href = "mailto:your@email.com";
  contactBtn.innerText = "Contact Us";
  contactBtn.className = "expand-btn";
  contactBtn.style.textDecoration = "none";
  contactBtn.style.textAlign = "center";
  backContent.appendChild(contactBtn);
} else {
  // NON-CONTACT: Artist Details button + labels
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

// Modal logic for Artist Details button
document.body.addEventListener("click", (e) => {
  // Make sure this is the actual Artist Details button, not the contact link
  if (
    e.target.classList.contains("expand-btn") &&
    e.target.tagName === "BUTTON"
  ) {
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

// Escape key closes modal
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.querySelector('.artist-modal');
    if (!modal.classList.contains('hidden')) {
      modal.classList.add('hidden');
    }
  }
});

document.querySelector('.artist-modal').addEventListener("click", (e) => {
  if (e.target.classList.contains("artist-modal")) {
    const modalContent = e.target.querySelector('.modal-content');
    
    // Add pulse animation
    modalContent.classList.add('pulse-dismiss');

    // After animation ends, hide modal
    setTimeout(() => {
      e.target.classList.add('hidden');
      modalContent.classList.remove('pulse-dismiss');
    }, 250); // Match animation duration
  }
});

// X button closes modal
document.querySelector('.artist-modal .close-btn').addEventListener('click', () => {
  const modal = document.querySelector('.artist-modal');
  modal.classList.add('hidden');
});


// Dropdown & Navigation logic remains unchanged...
// Modal open/close logic remains unchanged...

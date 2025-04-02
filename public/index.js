let allCovers = [];
let covers = [];
let activeIndex = 0;
let wheelLock = false;
let coverSpacing, anglePerOffset, minScale;
const maxAngle = 80;

const coverflowEl = document.getElementById("coverflow");

fetch("/data/covers.json")
  .then(res => res.json())
  .then(data => {
    allCovers = data;
    covers = [...allCovers];
    activeIndex = Math.floor(covers.length / 2);
    renderCovers();
    updateLayoutParameters();
    renderCoverFlow();
  });

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

    if (cover.music?.type === "embed") {
      backContent.innerHTML = cover.music.embedHtml;
    } else if (cover.music?.type === "tracks") {
      const list = document.createElement("ul");
      list.className = "track-list";
      cover.music.tracks.forEach((track) => {
        const li = document.createElement("li");
        if (track.url) {
          const a = document.createElement("a");
          a.href = track.url;
          a.target = "_blank";
          a.textContent = track.label;
          li.appendChild(a);
        } else {
          li.textContent = track.label;
        }
        list.appendChild(li);
      });
      backContent.appendChild(list);
    }

    back.appendChild(backContent);
    flip.appendChild(front);
    flip.appendChild(back);
    wrapper.appendChild(flip);

    const label = document.createElement("div");
    label.className = "cover-label";
    label.innerHTML = `<strong>${cover.albumTitle || ""}</strong><br/>${cover.coverLabel || ""}`;
    wrapper.appendChild(label);

    wrapper.addEventListener("click", (e) => {
      if (e.target.closest(".cover-back")) return;
      const offset = parseInt(wrapper.dataset.index, 10) - activeIndex;
      const flipContainer = wrapper.querySelector(".flip-container");

      if (offset === 0) {
        if (!flipContainer.classList.contains("flipped")) {
          flipContainer.classList.add("flipped");
        }
      } else {
        setActiveIndex(parseInt(wrapper.dataset.index, 10));
      }
    });

    coverflowEl.appendChild(wrapper);
  });
}

function updateLayoutParameters() {
  if (window.innerWidth < 768) {
    coverSpacing = 80;
    anglePerOffset = 40;
    minScale = 0.4;
  } else {
    coverSpacing = Math.max(100, window.innerWidth * 0.15);
    anglePerOffset = 75;
    minScale = 0.5;
  }
}

function computeEffectiveOffset(offset) {
  const absOffset = Math.abs(offset);
  if (absOffset <= 1) return offset;
  const compressionFactor = 0.7;
  const extra = absOffset - 1;
  const compressedExtra = extra * compressionFactor;
  return offset < 0 ? -(1 + compressedExtra) : 1 + compressedExtra;
}

function renderCoverFlow() {
  const domCovers = Array.from(document.querySelectorAll(".cover"));

  domCovers.forEach((cover) => {
    const i = parseInt(cover.dataset.index, 10);
    const offset = i - activeIndex;
    const effOffset = computeEffectiveOffset(offset);

    const translateX = effOffset * coverSpacing;
    const rotateY = Math.max(-maxAngle, Math.min(offset * -anglePerOffset, maxAngle));
    const scale = Math.max(minScale, 1 - Math.abs(offset) * 0.1);

    cover.style.transform = `
      translate(-50%, -50%)
      translateX(${translateX}px)
      scale(${scale})
      rotateY(${rotateY}deg)
    `;
    cover.style.zIndex = covers.length - Math.abs(offset);

    const flipContainer = cover.querySelector(".flip-container");
    if (offset !== 0 && flipContainer?.classList.contains("flipped")) {
      flipContainer.classList.remove("flipped");
    }

    if (offset === 0) {
      cover.classList.add("cover-active");
    } else {
      cover.classList.remove("cover-active");
    }
  });
}

function setActiveIndex(index) {
  activeIndex = Math.max(0, Math.min(index, covers.length - 1));
  renderCoverFlow();
}

// Filter logic
document.querySelectorAll(".filter-menu button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-menu button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const filter = btn.dataset.filter;
    covers = filter === "all"
      ? [...allCovers]
      : allCovers.filter((c) => c.category?.includes(filter));
    covers.forEach((c, i) => c.index = i);
    activeIndex = Math.floor(covers.length / 2);
    renderCovers();
    renderCoverFlow();
  });
});

// Nav + resize
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
      setTimeout(() => { wheelLock = false; }, 100);
    }
  }
}, { passive: false });
let touchStartX = 0;
coverflowEl.addEventListener("touchstart", (e) => {
  touchStartX = e.changedTouches[0].screenX;
});
coverflowEl.addEventListener("touchend", (e) => {
  const touchEndX = e.changedTouches[0].screenX;
  const threshold = 80;
  if (touchEndX < touchStartX - threshold) setActiveIndex(activeIndex + 1);
  else if (touchEndX > touchStartX + threshold) setActiveIndex(activeIndex - 1);
});


let covers = [];

async function loadCovers() {
  const res = await fetch('/data/covers-preview.json');
  covers = await res.json();
  renderCovers();
}

function renderCovers() {
  const container = document.getElementById('coversContainer');
  container.innerHTML = covers.map(cover => `
    <div class="cover-card" data-id="${cover.id}">
      <img src="${cover.frontImage}" alt="${cover.albumTitle}">
      <strong>${cover.albumTitle || "Untitled"}</strong><br>
      <small>${cover.coverLabel || "No Label"}</small><br>
      <button onclick="editCover('${cover.id}')">✏️ Edit</button>
    </div>
  `).join("");

  new Sortable(container, {
    animation: 200,
    onEnd: () => {
      const orderedIds = [...document.querySelectorAll('.cover-card')].map(c => c.dataset.id);
      covers = orderedIds.map(id => covers.find(c => c.id.toString() === id));
      console.log("🔄 Covers reordered:", orderedIds);
    }
  });
}

function editCover(id) {
  window.location.href = `/admin/admin.html?id=${id}`;
}

async function saveChanges() {
  const orderedIds = [...document.querySelectorAll('.cover-card')].map(c => c.dataset.id);
  covers = orderedIds.map(id => covers.find(c => c.id.toString() === id));

  try {
    const res = await fetch('/save-covers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(covers)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Server responded ${res.status}: ${errText}`);
    }

    const result = await res.json();
    if (result.success) {
      console.log("✅ Covers saved (preview).");
      alert("✅ Covers saved successfully.");
    } else {
      throw new Error("Unknown server error.");
    }
  } catch (err) {
    console.error("❌ Error saving covers:", err);
    alert("❌ Could not save covers. Check the console.");
  }
}

async function pushLive() {
  try {
    const res = await fetch('/push-live', { method: 'POST' });
    if (res.ok) {
      alert("✅ Changes are now live!");
    } else {
      const err = await res.json();
      console.error("❌ Error pushing live:", err);
      alert("❌ Error pushing live. Check console.");
    }
  } catch (err) {
    console.error("❌ Network error:", err);
    alert("❌ Network error. Check console.");
  }
}

// Drag-and-drop to create new cover
const dropzone = document.getElementById("coverDropzone");
dropzone.addEventListener("dragover", e => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});
dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});
dropzone.addEventListener("drop", async e => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (!file || !file.type.startsWith("image/")) return alert("Invalid image.");

  const formData = new FormData();
  formData.append("image", file);
  const uploadRes = await fetch("/upload-image", { method: "POST", body: formData });
  const { url } = await uploadRes.json();

  const newCover = {
    id: Date.now().toString(),
    frontImage: url,
    albumTitle: "New Cover",
    coverLabel: "",
    category: "",
    music: { type: "embed", embedHtml: "" },
    artistDetails: {
      name: "",
      location: "",
      bio: "",
      spotifyLink: "",
      image: ""
    }
  };
  covers.push(newCover);
  renderCovers();
});

loadCovers();

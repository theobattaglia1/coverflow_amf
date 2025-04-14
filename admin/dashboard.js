let covers = [];
let fonts = [];

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

async function saveCovers() {
  const orderedIds = [...document.querySelectorAll('.cover-card')].map(c => c.dataset.id);
  covers = orderedIds.map(id => covers.find(c => c.id.toString() === id));

  console.log("📤 Attempting POST to /save-covers");

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
      console.log("✅ Covers saved");
      alert("✅ Covers saved.");
    } else {
      console.error("❌ Save failed:", result);
      alert("❌ Server error while saving.");
    }
  } catch (err) {
    console.error("❌ Network or server error:", err.message);
    alert("❌ Could not reach the server.");
  }
  
}

// Drop to create new cover
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
    music: { type: "tracks", tracks: [] }
  };
  covers.push(newCover);
  renderCovers();
});

async function loadFontOptions() {
  const res = await fetch('/data/styles.json');
  const styles = await res.json();
  fonts = styles.fonts || [];

  const fontSelect = document.getElementById("globalFont");
  fontSelect.innerHTML = fonts.map(f => `<option value="${f}">${f}</option>`).join('');
  if (styles.fontFamily) fontSelect.value = styles.fontFamily;
  if (styles.fontSize) document.getElementById("globalSize").value = styles.fontSize;
}

document.getElementById("uploadFont").addEventListener("change", async e => {
  const file = e.target.files[0];
  const formData = new FormData();
  formData.append("font", file);
  const res = await fetch("/upload-font", { method: "POST", body: formData });
  const { fontName } = await res.json();
  fonts.push(fontName);
  await loadFontOptions();
  alert("✅ Font uploaded: " + fontName);
});

document.getElementById("saveStyle").addEventListener("click", async () => {
  const fontFamily = document.getElementById("globalFont").value;
  const fontSize = document.getElementById("globalSize").value;
  await fetch("/save-style-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fontFamily, fontSize, fonts })
  });
  alert("✅ Global styles saved.");
});

async function pushToTest() {
  const res = await fetch('/push-to-test', { method: 'POST' });
  const result = await res.json();
  alert(result.success ? "🚀 Test site updated!" : "❌ Failed to push.");
}

loadCovers();
loadFontOptions();

async function saveChanges() {
  const orderedIds = [...document.querySelectorAll('.cover-card')].map(c => c.dataset.id);
  covers = orderedIds.map(id => covers.find(c => c.id.toString() === id));

  await fetch('/save-preview-covers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(covers)
  });

  alert("✅ Changes saved privately for preview.");
}

function previewSite() {
  window.open('/preview', '_blank');
}

async function pushLive() {
  const res = await fetch('/push-live', { method: 'POST' });
  if (res.ok) {
    alert("✅ Changes are now live!");
  } else {
    alert("❌ Error pushing changes live.");
  }
}

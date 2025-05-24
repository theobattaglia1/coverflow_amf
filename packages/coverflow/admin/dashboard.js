let covers = [];
let assets = { images: [] };
let sortableInstance = null;

// Load covers
async function loadCovers() {
  try {
    const res = await fetch('/data/covers.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    covers = await res.json();
    
    // Filter out empty covers
    covers = covers.filter(c => c.id && c.frontImage);
    
    renderCovers();
  } catch (err) {
    console.error('Failed to load covers:', err);
    alert('Failed to load covers. Check console.');
  }
}

// Load assets
async function loadAssets() {
  try {
    const res = await fetch('/data/assets.json');
    if (!res.ok) {
      // If assets.json doesn't exist, create it
      assets = { images: [] };
      return;
    }
    assets = await res.json();
    renderAssets();
  } catch (err) {
    console.error('Failed to load assets:', err);
    assets = { images: [] };
  }
}

// Render covers
function renderCovers() {
  const container = document.getElementById('coversContainer');
  
  if (covers.length === 0) {
    container.innerHTML = '<p style="color: #999;">No covers yet. Drag an image below to add one!</p>';
    return;
  }
  
  container.innerHTML = covers.map(cover => `
    <div class="cover-card" data-id="${cover.id}">
      <img src="${cover.frontImage}" alt="${cover.albumTitle || 'Untitled'}" 
           onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\'%3E%3Crect fill=\'%23333\' width=\'200\' height=\'200\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23999\' font-family=\'sans-serif\'%3ENo Image%3C/text%3E%3C/svg%3E'">
      <strong>${cover.albumTitle || "Untitled"}</strong>
      <small>${cover.coverLabel || "No Label"}</small>
      <button onclick="editCover('${cover.id}')">✏️ Edit</button>
    </div>
  `).join("");

  // Initialize or reinitialize Sortable
  if (sortableInstance) {
    sortableInstance.destroy();
  }
  
  sortableInstance = new Sortable(container, {
    animation: 200,
    ghostClass: 'sortable-ghost',
    onEnd: (evt) => {
      // Update the covers array to match new order
      const orderedIds = [...container.querySelectorAll('.cover-card')].map(c => c.dataset.id);
      const newCovers = [];
      
      orderedIds.forEach(id => {
        const cover = covers.find(c => String(c.id) === String(id));
        if (cover) newCovers.push(cover);
      });
      
      covers = newCovers;
      console.log("🔄 Covers reordered");
    }
  });
}

// Render assets
function renderAssets() {
  const container = document.getElementById('assetsContainer');
  
  if (!assets.images || assets.images.length === 0) {
    container.innerHTML = '<p style="color: #999; grid-column: 1/-1;">No assets yet. Drag images above to upload!</p>';
    return;
  }
  
  container.innerHTML = assets.images.map((asset, index) => `
    <div class="asset-item">
      <img src="${asset.url}" alt="${asset.name || 'Asset'}" 
           onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'100\'%3E%3Crect fill=\'%23333\' width=\'200\' height=\'100\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23999\' font-size=\'12\'%3EBroken Image%3C/text%3E%3C/svg%3E'">
      <input type="text" value="${asset.name || ''}" placeholder="Name" onchange="updateAssetName(${index}, this.value)">
      <div class="url-display" onclick="copyToClipboard('${asset.url}')" title="Click to copy">
        ${asset.url}
      </div>
      <button onclick="deleteAsset(${index})">🗑️ Delete</button>
    </div>
  `).join("");
}

// Update asset name
function updateAssetName(index, name) {
  assets.images[index].name = name;
  saveAssets();
}

// Delete asset
function deleteAsset(index) {
  if (confirm('Delete this asset?')) {
    assets.images.splice(index, 1);
    saveAssets();
    renderAssets();
  }
}

// Copy to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    // Create a temporary tooltip
    const tooltip = document.createElement('div');
    tooltip.textContent = 'Copied!';
    tooltip.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #18d860; color: white; padding: 10px 20px; border-radius: 5px; z-index: 9999;';
    document.body.appendChild(tooltip);
    setTimeout(() => tooltip.remove(), 1000);
  });
}

// Save assets
async function saveAssets() {
  try {
    const res = await fetch('/save-assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assets)
    });

    if (!res.ok) {
      throw new Error(`Server error ${res.status}`);
    }

    console.log("✅ Assets saved");
  } catch (err) {
    console.error("❌ Error saving assets:", err);
    alert(`❌ Failed to save assets: ${err.message}`);
  }
}

// Edit cover
function editCover(id) {
  window.location.href = `/admin/admin.html?id=${id}`;
}

// Save changes
async function saveChanges() {
  try {
    console.log('Saving covers:', covers);
    
    const res = await fetch('/save-covers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(covers)
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.details || `Server error ${res.status}`);
    }

    const result = await res.json();
    console.log("✅ Covers saved:", result);
    alert("✅ Covers saved successfully!");
  } catch (err) {
    console.error("❌ Error saving covers:", err);
    alert(`❌ Failed to save: ${err.message}`);
  }
}

// Push live
async function pushLive() {
  if (!confirm('Push all changes live? This will update the public site.')) {
    return;
  }
  
  try {
    const res = await fetch('/push-live', { method: 'POST' });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.details || `Server error ${res.status}`);
    }
    
    alert("✅ Changes are now live!");
  } catch (err) {
    console.error("❌ Error pushing live:", err);
    alert(`❌ Failed to push live: ${err.message}`);
  }
}

// Setup drag and drop for covers
function setupCoverDragAndDrop() {
  const dropzone = document.getElementById("coverDropzone");
  
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Highlight drop zone
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
  });

  // Handle dropped files
  dropzone.addEventListener('drop', e => handleFiles(e.dataTransfer.files, 'cover'), false);

  // Also allow click to upload
  dropzone.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = e => handleFiles(e.target.files, 'cover');
    input.click();
  });
}

// Setup drag and drop for assets
function setupAssetDragAndDrop() {
  const dropzone = document.getElementById("assetDropzone");
  
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Highlight drop zone
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
  });

  // Handle dropped files
  dropzone.addEventListener('drop', e => handleFiles(e.dataTransfer.files, 'asset'), false);

  // Also allow click to upload
  dropzone.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true; // Allow multiple files for assets
    input.onchange = e => handleFiles(e.target.files, 'asset');
    input.click();
  });
}

// Handle file uploads
async function handleFiles(files, type = 'cover') {
  const dropzone = document.getElementById(type === 'cover' ? "coverDropzone" : "assetDropzone");
  const originalText = dropzone.textContent;
  
  for (const file of files) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please upload only image files');
      continue;
    }

    // Show loading state
    dropzone.textContent = `Uploading ${file.name}...`;
    dropzone.style.opacity = '0.5';

    try {
      // Upload image
      const formData = new FormData();
      formData.append('image', file);
      
      const uploadRes = await fetch('/upload-image', {
        method: 'POST',
        body: formData
      });

      if (!uploadRes.ok) {
        const error = await uploadRes.json();
        throw new Error(error.error || 'Upload failed');
      }

      const { url } = await uploadRes.json();
      console.log('Image uploaded:', url);

      if (type === 'cover') {
        // Create new cover
        const tempTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        
        const newCover = {
          id: Date.now().toString(),
          frontImage: url,
          albumTitle: tempTitle,
          coverLabel: '',
          category: '',
          fontFamily: '',
          fontSize: '',
          music: { type: 'embed', url: '' },
          artistDetails: {
            name: '',
            location: '',
            bio: '',
            spotifyLink: '',
            image: url
          }
        };

        covers.push(newCover);
        renderCovers();
        
        // Auto-save after adding
        await saveChanges();
        
        alert(`✅ Cover added! Click "Edit" to add details.`);
      } else {
        // Add to assets
        const newAsset = {
          url: url,
          name: file.name.replace(/\.[^/.]+$/, ''),
          uploadedAt: new Date().toISOString()
        };
        
        assets.images.push(newAsset);
        renderAssets();
        
        // Auto-save assets
        await saveAssets();
      }
      
    } catch (err) {
      console.error('Upload error:', err);
      alert(`❌ Upload failed: ${err.message}`);
    }
  }
  
  // Restore dropzone
  dropzone.textContent = originalText;
  dropzone.style.opacity = '1';
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  loadCovers();
  loadAssets();
  setupCoverDragAndDrop();
  setupAssetDragAndDrop();
  
  // Add CSS for sortable ghost
  const style = document.createElement('style');
  style.textContent = `
    .sortable-ghost {
      opacity: 0.4;
      background: #444;
    }
    .cover-card {
      transition: transform 0.2s;
    }
    .cover-card:hover {
      transform: translateY(-2px);
    }
  `;
  document.head.appendChild(style);
});
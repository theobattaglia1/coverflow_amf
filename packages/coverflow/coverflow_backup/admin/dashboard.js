let covers = [];
let sortableInstance = null;

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

function editCover(id) {
  window.location.href = `/admin/admin.html?id=${id}`;
}

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

// Enhanced drag-and-drop handler
function setupDragAndDrop() {
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
    dropzone.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, unhighlight, false);
  });

  function highlight(e) {
    dropzone.classList.add('dragover');
  }

  function unhighlight(e) {
    dropzone.classList.remove('dragover');
  }

  // Handle dropped files
  dropzone.addEventListener('drop', handleDrop, false);

  // Also allow click to upload
  dropzone.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = e => handleFiles(e.target.files);
    input.click();
  });
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  handleFiles(files);
}

async function handleFiles(files) {
  const file = files[0];
  if (!file || !file.type.startsWith('image/')) {
    alert('Please drop an image file');
    return;
  }

  // Show loading state
  const dropzone = document.getElementById("coverDropzone");
  const originalText = dropzone.textContent;
  dropzone.textContent = 'Uploading...';
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

    // Create new cover with a temporary title from filename
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
        image: url // Use same image initially
      }
    };

    covers.push(newCover);
    renderCovers();
    
    // Auto-save after adding
    await saveChanges();
    
    alert(`✅ Cover added! Click "Edit" to add details.`);
    
  } catch (err) {
    console.error('Upload error:', err);
    alert(`❌ Upload failed: ${err.message}`);
  } finally {
    // Restore dropzone
    dropzone.textContent = originalText;
    dropzone.style.opacity = '1';
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  loadCovers();
  setupDragAndDrop();
  
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

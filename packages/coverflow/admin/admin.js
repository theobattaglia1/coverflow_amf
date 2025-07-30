let currentCover = null;
let assets = { folders: [], images: [] };
let currentLibraryPath = '';
let targetInputField = null;
let currentUser = null;

// Helper function to determine if we're on admin subdomain
function isAdminSubdomain() {
  return window.location.hostname.startsWith('admin.');
}

// Helper function to get the correct base path for API calls
function getApiBasePath() {
  if (isAdminSubdomain()) {
    // On admin subdomain, API calls go directly to root
    return '';
  } else {
    // On main domain, we're already in the correct context
    return '';
  }
}

// Helper function to get the correct redirect path
function getRedirectPath(path) {
  if (isAdminSubdomain()) {
    // On admin subdomain, paths are relative to root
    return path.startsWith('/') ? path : '/' + path;
  } else {
    // On main domain, ensure /admin prefix
    if (!path.startsWith('/admin')) {
      return '/admin' + (path.startsWith('/') ? path : '/' + path);
    }
    return path;
  }
}

// Toast notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Check authentication
async function checkAuth() {
  try {
    const res = await fetch(getApiBasePath() + '/api/me');
    if (!res.ok) {
      // Redirect to login
      if (isAdminSubdomain()) {
        window.location.href = '/';
      } else {
        window.location.href = '/login.html';
      }
      return;
    }
    const data = await res.json();
    currentUser = data.user;
    
    // Disable save/delete buttons for viewers
    if (currentUser.role === 'viewer') {
      const saveBtn = document.querySelector('.btn-primary[onclick="saveCover()"]');
      const deleteBtn = document.querySelector('.btn-danger[onclick="deleteCover()"]');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'SAVE (VIEW ONLY)';
      }
      if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.textContent = 'DELETE (VIEW ONLY)';
      }
    }
  } catch (err) {
    console.error('Auth check failed:', err);
    // Redirect to login
    if (isAdminSubdomain()) {
      window.location.href = '/';
    } else {
      window.location.href = '/login.html';
    }
  }
}

// Initialize form
(async function(){
  await checkAuth();
  
  const urlParams = new URLSearchParams(window.location.search);
  let id = urlParams.get('id');
  
  if (id) {
    try {
      const res = await fetch(getApiBasePath() + '/data/covers.json');
      const covers = await res.json();
      currentCover = covers.find(c => c.id == id);
    } catch (err) {
      console.error('Failed to load cover:', err);
    }
  }

  if (currentCover) {
    // Populate form fields
    Object.entries(currentCover).forEach(([key, value]) => {
      const el = document.getElementById(key);
      if (el) el.value = typeof value === 'object' ? JSON.stringify(value, null, 2) : value;
    });

    // Set preview images
    if (currentCover.frontImage) {
      document.getElementById('frontImagePreview').src = currentCover.frontImage;
    }

    if (currentCover.music && currentCover.music.url) {
      document.getElementById('musicUrl').value = currentCover.music.url;
    }

    if (currentCover.artistDetails) {
      document.getElementById('artistName').value = currentCover.artistDetails.name || '';
      document.getElementById('artistLocation').value = currentCover.artistDetails.location || '';
      document.getElementById('artistBio').value = currentCover.artistDetails.bio || '';
      document.getElementById('artistSpotifyLink').value = currentCover.artistDetails.spotifyLink || '';
      document.getElementById('artistImage').value = currentCover.artistDetails.image || '';
      
      if (currentCover.artistDetails.image) {
        document.getElementById('artistImagePreview').src = currentCover.artistDetails.image;
      }
    }
  }

  // Load assets for image library
  await loadAssets();

  // Setup drag and drop
  setupDragAndDrop();
  
  // Setup preview watchers
  document.getElementById('frontImage').addEventListener('input', (e) => {
    document.getElementById('frontImagePreview').src = e.target.value;
  });
  
  document.getElementById('artistImage').addEventListener('input', (e) => {
    document.getElementById('artistImagePreview').src = e.target.value;
  });
})();

// Load assets
async function loadAssets() {
  try {
    const res = await fetch(getApiBasePath() + '/data/assets.json');
    if (!res.ok) {
      assets = { folders: [], images: [] };
      return;
    }
    const data = await res.json();
    
    // Handle migration from flat structure
    if (Array.isArray(data.images) && !data.folders) {
      assets = {
        folders: [],
        images: data.images || []
      };
    } else {
      assets = data;
    }
  } catch (err) {
    console.error('Failed to load assets:', err);
    assets = { folders: [], images: [] };
  }
}

// Save cover
window.saveCover = async function() {
  if (currentUser.role === 'viewer') {
    showToast('You do not have permission to save', 'error');
    return;
  }
  
  const form = document.getElementById('coverForm');
  const data = Object.fromEntries(new FormData(form));
  const urlParams = new URLSearchParams(window.location.search);
  let id = urlParams.get('id');
  const isNew = !id;
  
  if (isNew) {
    id = Date.now().toString();
  }

  const body = {
    id,
    category: data.category || '',
    frontImage: data.frontImage || '',
    albumTitle: data.albumTitle || '',
    coverLabel: data.coverLabel || '',
    fontFamily: data.fontFamily || '',
    fontSize: data.fontSize || '',
    music: {
      type: 'embed',
      url: data.musicUrl || ''
    },
    artistDetails: {
      name: data.artistName || '',
      location: data.artistLocation || '',
      bio: data.artistBio || '',
      spotifyLink: data.artistSpotifyLink || '',
      image: data.artistImage || ''
    },
    createArtistFolder: data.createArtistFolder === 'on'
  };

  // Generate artistId if needed
  if (body.artistDetails.name && !body.artistId) {
    body.artistId = body.artistDetails.name.toLowerCase().replace(/\s+/g, '-');
  }

  console.log("📦 Sending data to server:", body);

  try {
    const response = await fetch(getApiBasePath() + '/save-cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("❌ Saving cover failed:", result);
      showToast("Failed to save: " + (result.error || 'Unknown error'), 'error');
      return;
    }

    console.log("📬 Server responded:", result);
    showToast("Cover saved successfully!");
    
    // Redirect after short delay
    setTimeout(() => {
      window.location.href = getRedirectPath('/');
    }, 1000);
    
  } catch (error) {
    console.error("❌ Saving cover failed:", error);
    showToast("Failed to save: " + error.message, 'error');
  }
};

// Delete cover
window.deleteCover = async function() {
  if (currentUser.role === 'viewer') {
    showToast('You do not have permission to delete', 'error');
    return;
  }
  
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  
  if (!id) {
    showToast('Cannot delete unsaved cover', 'error');
    return;
  }
  
  if (confirm("Are you sure you want to delete this cover?")) {
    try {
const response = await fetch('/delete-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      
      if (!response.ok) {
        throw new Error('Delete failed');
      }
      
      showToast("Cover deleted successfully!");
      setTimeout(() => {
        window.location.href = getRedirectPath('/');
      }, 1000);
    } catch (error) {
      showToast("Failed to delete: " + error.message, 'error');
    }
  }
};

// Preview image
window.previewImage = function(fieldId) {
  const url = document.getElementById(fieldId).value;
  if (!url) {
    showToast('No image URL to preview', 'error');
    return;
  }
  
  const previewId = fieldId + 'Preview';
  const previewEl = document.getElementById(previewId);
  if (previewEl) {
    previewEl.src = url;
  }
  
  // Open in new tab
  window.open(url, '_blank');
};

// Image Library functions
window.openImageLibrary = function(inputFieldId) {
  targetInputField = inputFieldId;
  document.getElementById('imageLibraryModal').classList.add('show');
  renderLibraryFolders();
  navigateToLibraryFolder('');
};

window.closeImageLibrary = function() {
  document.getElementById('imageLibraryModal').classList.remove('show');
  targetInputField = null;
};

function renderLibraryFolders() {
  const container = document.getElementById('libraryFolders');
  
  function renderFolder(folder, level = 0) {
    const indent = level * 20;
    const hasChildren = folder.children && folder.children.filter(c => c.type === 'folder').length > 0;
    
    return `
      <div class="folder-item" data-path="${folder.path || folder.name}" style="padding-left: ${indent}px">
        <span>${hasChildren ? '▸' : '·'}</span>
        <span onclick="navigateToLibraryFolder('${folder.path || folder.name}')" style="text-transform: uppercase;">${folder.name}</span>
      </div>
      ${hasChildren ? folder.children.filter(c => c.type === 'folder').map(child => 
        renderFolder({...child, path: (folder.path || folder.name) + '/' + child.name}, level + 1)
      ).join('') : ''}
    `;
  }
  
  container.innerHTML = `
    <div class="folder-item ${currentLibraryPath === '' ? 'active' : ''}" data-path="">
      <span>▪</span>
      <span onclick="navigateToLibraryFolder('')" style="text-transform: uppercase;">ALL IMAGES</span>
    </div>
    ${assets.folders.map(folder => renderFolder(folder)).join('')}
  `;
}

function navigateToLibraryFolder(path) {
  currentLibraryPath = path;
  
  // Update active folder
  document.querySelectorAll('#libraryFolders .folder-item').forEach(item => {
    item.classList.toggle('active', item.dataset.path === path);
  });
  
  // Render images in current folder
  renderLibraryImages();
}

function renderLibraryImages() {
  const container = document.getElementById('libraryImages');
  const items = getLibraryFolderItems();
  
  if (items.images.length === 0) {
    container.innerHTML = '<p style="color: var(--grey); text-align: center; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.1em;">NO IMAGES IN THIS FOLDER</p>';
    return;
  }
  
  container.innerHTML = items.images.map(image => `
    <div class="image-item" onclick="selectLibraryImage('${image.url}')">
      <img src="${image.url}" alt="${image.name || 'Image'}">
      <div class="name">${image.name || 'UNTITLED'}</div>
    </div>
  `).join('');
}

function getLibraryFolderItems() {
  if (currentLibraryPath === '') {
    return {
      folders: assets.folders,
      images: assets.images.filter(img => !img.folder || img.folder === '')
    };
  }
  
  // Navigate to current folder
  const pathParts = currentLibraryPath.split('/').filter(Boolean);
  let current = assets;
  
  for (const part of pathParts) {
    const folder = (current.folders || current.children || []).find(f => 
      (f.type === 'folder' || !f.type) && f.name === part
    );
    if (!folder) return { folders: [], images: [] };
    current = folder;
  }
  
  return {
    folders: (current.children || []).filter(c => c.type === 'folder'),
    images: (current.children || []).filter(c => c.type === 'image')
  };
}

function selectLibraryImage(url) {
  if (targetInputField) {
    document.getElementById(targetInputField).value = url;
    document.getElementById(targetInputField).dispatchEvent(new Event('input'));
  }
  closeImageLibrary();
  showToast('Image selected');
}

// Drag and drop setup
function setupDragAndDrop() {
  const dropArea = document.getElementById('dropArea');
  const fileInput = document.getElementById('imageInput');

  dropArea.addEventListener('click', () => fileInput.click());
  
  dropArea.addEventListener('dragover', e => {
    e.preventDefault();
    dropArea.classList.add('dragover');
  });
  
  dropArea.addEventListener('dragleave', () => dropArea.classList.remove('dragover'));
  
  dropArea.addEventListener('drop', e => {
    e.preventDefault();
    dropArea.classList.remove('dragover');
    handleUpload(e.dataTransfer.files[0]);
  });
  
  fileInput.addEventListener('change', e => {
    handleUpload(e.target.files[0]);
  });
}

async function handleUpload(file) {
  // Accept both image and video files
  if (!file || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) {
    showToast('PLEASE UPLOAD AN IMAGE OR VIDEO FILE', 'error');
    return;
  }
  
  if (currentUser.role === 'viewer') {
    showToast('YOU DO NOT HAVE PERMISSION TO UPLOAD', 'error');
    return;
  }
  
  const dropArea = document.getElementById('dropArea');
  const originalText = dropArea.innerHTML;
  
  dropArea.innerHTML = `<span class="drop-area-text">UPLOADING ${file.name.toUpperCase()}...</span>`;
  
  try {
    const formData = new FormData();
    formData.append('image', file); // Keep the field name for backward compatibility
    
    const res = await fetch(getApiBasePath() + '/upload-image', {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Upload failed');
    }
    
    const { url } = await res.json();
    document.getElementById('frontImage').value = url;
    
    // Handle preview differently for videos
    if (file.type.startsWith('video/')) {
      // Create a video element for preview
      const preview = document.getElementById('frontImagePreview');
      const videoPreview = document.createElement('video');
      videoPreview.src = url;
      videoPreview.controls = true;
      videoPreview.style.width = '100%';
      videoPreview.style.maxHeight = '300px';
      preview.style.display = 'none';
      preview.parentNode.insertBefore(videoPreview, preview.nextSibling);
    } else {
      document.getElementById('frontImagePreview').src = url;
    }
    
    showToast(`${file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE'} UPLOADED SUCCESSFULLY`);
  } catch (err) {
    showToast('UPLOAD FAILED: ' + err.message.toUpperCase(), 'error');
  } finally {
    dropArea.innerHTML = originalText;
  }
}

// Handle clicking outside modal to close
document.getElementById('imageLibraryModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    closeImageLibrary();
  }
});

// Update back navigation link
document.addEventListener('DOMContentLoaded', () => {
  const backNav = document.querySelector('.back-nav a');
  if (backNav) {
    backNav.href = getRedirectPath('/');
  }
});
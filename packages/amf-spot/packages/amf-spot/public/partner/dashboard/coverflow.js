// Coverflow.js implementation with verbose logging
console.log('[Coverflow] Script started');

document.addEventListener('do-you-remember.m4aMContentLoaded', function() {
  console.log('[Coverflow] do-you-remember.m4aM loaded');
  
  // Get artist ID from URL
  const pathParts = window.location.pathname.split('/');
  console.log('[Coverflow] Path parts:', pathParts);
  
  const artistIndex = pathParts.indexOf('dashboard') - 1;
  console.log('[Coverflow] Artist index:', artistIndex);
  
  const artist = pathParts[artistIndex] || 'default-artist';
  console.log('[Coverflow] Artist name:', artist);
  
  // Check if hero container exists, if not create it
  let coverflowHero = document.getElementById('coverflow-hero');
  if (!coverflowHero) {
    console.log('[Coverflow] Creating hero container');
    coverflowHero = document.createElement('section');
    coverflowHero.id = 'coverflow-hero';
    
    // Find the dashboard heading or first element
    const dashboard = document.querySelector('h1') || document.body.firstChild;
    console.log('[Coverflow] Inserting before element:', dashboard);
    
    if (dashboard && dashboard.parentNode) {
      dashboard.parentNode.insertBefore(coverflowHero, dashboard);
    } else {
      console.log('[Coverflow] Fallback insertion at body start');
      document.body.insertBefore(coverflowHero, document.body.firstChild);
    }
  } else {
    console.log('[Coverflow] Hero container already exists');
  }
  
  // Use hardcoded image URL for covers
  const baseImageUrl = 'https://allmyfriendsinc.com/uploads/444a59dfe2a66aa5224c7038f7539b15'\;
  console.log('[Coverflow] Using image URL:', baseImageUrl);
  
  // Create placeholder covers
  const covers = [
    { title: 'Album 1', imageUrl: baseImageUrl },
    { title: 'Album 2', imageUrl: baseImageUrl },
    { title: 'Album 3', imageUrl: baseImageUrl },
    { title: 'Album 4', imageUrl: baseImageUrl },
    { title: 'Album 5', imageUrl: baseImageUrl }
  ];
  
  console.log('[Coverflow] Created cover items:', covers.length);
  
  // Create the coverflow elements
  createCoverflowElements(coverflowHero, covers);
  
  // Initialize coverflow interactions
  initCoverflowInteractions(coverflowHero);
  
  console.log('[Coverflow] Initialization complete');
});

function createCoverflowElements(container, covers) {
  console.log('[Coverflow] Creating elements in container:', container.id);
  
  // Create coverflow container
  const coverflowContainer = document.createElement('div');
  coverflowContainer.className = 'coverflow-container';
  
  // Create covers
  covers.forEach((cover, index) => {
    console.log(`[Coverflow] Creating cover ${index}: ${cover.title}`);
    
    const coverElement = document.createElement('div');
    coverElement.className = 'coverflow-item';
    coverElement.dataset.index = index;
    
    // Create cover image
    const img = document.createElement('img');
    img.src = cover.imageUrl;
    img.alt = cover.title;
    
    // Create title element
    const title = document.createElement('div');
    title.className = 'coverflow-title';
    title.textContent = cover.title;
    
    // Append elements
    coverElement.appendChild(img);
    coverElement.appendChild(title);
    coverflowContainer.appendChild(coverElement);
  });
  
  // Create navigation arrows
  console.log('[Coverflow] Adding navigation buttons');
  
  const prevBtn = document.createElement('button');
  prevBtn.className = 'coverflow-nav coverflow-prev';
  prevBtn.innerHTML = '&lt;';
  
  const nextBtn = document.createElement('button');
  nextBtn.className = 'coverflow-nav coverflow-next';
  nextBtn.innerHTML = '&gt;';
  
  // Clear container first
  console.log('[Coverflow] Clearing container');
  container.innerHTML = '';
  
  // Append all elements to container
  container.appendChild(prevBtn);
  container.appendChild(coverflowContainer);
  container.appendChild(nextBtn);
  
  console.log('[Coverflow] Elements created and appended');
}

function initCoverflowInteractions(container) {
  console.log('[Coverflow] Initializing interactions');
  
  const items = container.querySelectorAll('.coverflow-item');
  console.log('[Coverflow] Found items:', items.length);
  
  const prevBtn = container.querySelector('.coverflow-prev');
  const nextBtn = container.querySelector('.coverflow-next');
  
  if (!items.length) {
    console.log('[Coverflow] No items found, exiting initialization');
    return;
  }
  
  let activeIndex = Math.floor(items.length / 2);
  console.log('[Coverflow] Starting with active index:', activeIndex);
  
  // Set initial active state
  updateActiveState();
  
  // Add event listeners for navigation
  console.log('[Coverflow] Adding button event listeners');
  
  prevBtn.addEventListener('click', () => {
    console.log('[Coverflow] Previous button clicked');
    activeIndex = (activeIndex - 1 + items.length) % items.length;
    console.log('[Coverflow] New active index:', activeIndex);
    updateActiveState();
  });
  
  nextBtn.addEventListener('click', () => {
    console.log('[Coverflow] Next button clicked');
    activeIndex = (activeIndex + 1) % items.length;
    console.log('[Coverflow] New active index:', activeIndex);
    updateActiveState();
  });
  
  // Add click handlers for individual covers
  console.log('[Coverflow] Adding click handlers to items');
  
  items.forEach((item, index) => {
    item.addEventListener('click', () => {
      console.log(`[Coverflow] Item ${index} clicked`);
      activeIndex = index;
      updateActiveState();
    });
  });
  
  function updateActiveState() {
    console.log('[Coverflow] Updating active state');
    
    items.forEach((item, index) => {
      // Calculate distance from active item
      const distance = Math.abs(index - activeIndex);
      
      // Remove all classes
      item.classList.remove('coverflow-active', 'coverflow-left', 'coverflow-right');
      
      // Apply appropriate classes
      if (index === activeIndex) {
        console.log(`[Coverflow] Setting item ${index} as active`);
        item.classList.add('coverflow-active');
        item.style.zIndex = items.length;
        item.style.transform = 'translateX(0) translateZ(50px) rotateY(0deg) scale(1)';
      } else if (index < activeIndex) {
        item.classList.add('coverflow-left');
        item.style.zIndex = items.length - distance;
        item.style.transform = `translateX(-${distance * 50}px) translateZ(0) rotateY(40deg) scale(${0.8 - distance * 0.1})`;
      } else {
        item.classList.add('coverflow-right');
        item.style.zIndex = items.length - distance;
        item.style.transform = `translateX(${distance * 50}px) translateZ(0) rotateY(-40deg) scale(${0.8 - distance * 0.1})`;
      }
    });
    
    console.log('[Coverflow] Active state updated');
  }
  
  console.log('[Coverflow] Interactions initialized');
}

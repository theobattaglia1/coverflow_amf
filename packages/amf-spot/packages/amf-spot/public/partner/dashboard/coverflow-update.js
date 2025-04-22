// This script injects the coverflow hero at the top of the dashboard
document.addEventListener('DOMContentLoaded', function() {
  // Get artist ID from URL
  const pathParts = window.location.pathname.split('/');
  const artistIndex = pathParts.indexOf('dashboard') - 1;
  const artist = pathParts[artistIndex] || 'default-artist';
  
  // Create coverflow hero section
  const coverflowHero = document.createElement('section');
  coverflowHero.id = 'coverflow-hero';
  
  // Find the main content area to insert before
  const dashboard = document.querySelector('h1') || document.querySelector('.dashboard') || document.body.firstChild;
  
  // Insert coverflow hero at the top of the dashboard
  if (dashboard && dashboard.parentNode) {
    dashboard.parentNode.insertBefore(coverflowHero, dashboard);
  } else {
    // Fallback - insert at the beginning of the body
    document.body.insertBefore(coverflowHero, document.body.firstChild);
  }
  
  // Use the custom image URL for coverflow items
  const baseImageUrl = 'https://allmyfriendsinc.com/uploads/444a59dfe2a66aa5224c7038f7539b15'\;
  
  // Create placeholder covers using the provided image
  const covers = [
    { title: 'Album 1', imageUrl: baseImageUrl },
    { title: 'Album 2', imageUrl: baseImageUrl },
    { title: 'Album 3', imageUrl: baseImageUrl },
    { title: 'Album 4', imageUrl: baseImageUrl },
    { title: 'Album 5', imageUrl: baseImageUrl }
  ];
  
  // Create the coverflow elements
  createCoverflowElements(coverflowHero, covers);
  
  // Initialize coverflow interactions
  initCoverflowInteractions(coverflowHero);
});

function createCoverflowElements(container, covers) {
  // Create coverflow container
  const coverflowContainer = document.createElement('div');
  coverflowContainer.className = 'coverflow-container';
  
  // Create covers
  covers.forEach((cover, index) => {
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
  const prevBtn = document.createElement('button');
  prevBtn.className = 'coverflow-nav coverflow-prev';
  prevBtn.innerHTML = '&lt;';
  
  const nextBtn = document.createElement('button');
  nextBtn.className = 'coverflow-nav coverflow-next';
  nextBtn.innerHTML = '&gt;';
  
  // Clear the container first
  container.innerHTML = '';
  
  // Append all elements to the container
  container.appendChild(prevBtn);
  container.appendChild(coverflowContainer);
  container.appendChild(nextBtn);
}

function initCoverflowInteractions(container) {
  const items = container.querySelectorAll('.coverflow-item');
  const prevBtn = container.querySelector('.coverflow-prev');
  const nextBtn = container.querySelector('.coverflow-next');
  let activeIndex = Math.floor(items.length / 2); // Start with middle item active
  
  if (items.length === 0) return; // Exit if no items
  
  // Set initial active state
  updateActiveState();
  
  // Add event listeners for navigation
  prevBtn.addEventListener('click', () => {
    activeIndex = (activeIndex - 1 + items.length) % items.length;
    updateActiveState();
  });
  
  nextBtn.addEventListener('click', () => {
    activeIndex = (activeIndex + 1) % items.length;
    updateActiveState();
  });
  
  // Add click handlers for individual covers
  items.forEach((item, index) => {
    item.addEventListener('click', () => {
      activeIndex = index;
      updateActiveState();
    });
  });
  
  function updateActiveState() {
    items.forEach((item, index) => {
      // Calculate distance from active item
      const distance = Math.abs(index - activeIndex);
      
      // Remove all classes
      item.classList.remove('coverflow-active', 'coverflow-left', 'coverflow-right');
      
      // Apply appropriate classes
      if (index === activeIndex) {
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
  }
}

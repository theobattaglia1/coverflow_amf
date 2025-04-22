// Coverflow.js implementation
console.log('[Coverflow] Script loaded');

document.addEventListener('do-you-remember.m4aMContentLoaded', function() {
  console.log('[Coverflow] do-you-remember.m4aM loaded');
  
  // Create the coverflow hero section first
  const coverflowHero = document.createElement('section');
  coverflowHero.id = 'coverflow-hero';
  
  // Insert it at the top of the page
  const targetElement = document.querySelector('h1');
  if (targetElement && targetElement.parentNode) {
    targetElement.parentNode.insertBefore(coverflowHero, targetElement);
    console.log('[Coverflow] Hero section inserted before h1');
  } else {
    document.body.insertBefore(coverflowHero, document.body.firstChild);
    console.log('[Coverflow] Hero section inserted at beginning of body');
  }
  
  // Create some placeholder covers using the provided image URL
  const covers = [
    { title: 'Album 1', imageUrl: 'https://allmyfriendsinc.com/uploads/444a59dfe2a66aa5224c7038f7539b15' },
    { title: 'Album 2', imageUrl: 'https://allmyfriendsinc.com/uploads/444a59dfe2a66aa5224c7038f7539b15' },
    { title: 'Album 3', imageUrl: 'https://allmyfriendsinc.com/uploads/444a59dfe2a66aa5224c7038f7539b15' },
    { title: 'Album 4', imageUrl: 'https://allmyfriendsinc.com/uploads/444a59dfe2a66aa5224c7038f7539b15' },
    { title: 'Album 5', imageUrl: 'https://allmyfriendsinc.com/uploads/444a59dfe2a66aa5224c7038f7539b15' }
  ];
  
  // Create the coverflow container
  const coverflowContainer = document.createElement('div');
  coverflowContainer.className = 'coverflow-container';
  
  // Create covers
  covers.forEach(function(cover, index) {
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
  
  // Append all elements to the container
  coverflowHero.appendChild(prevBtn);
  coverflowHero.appendChild(coverflowContainer);
  coverflowHero.appendChild(nextBtn);
  
  // Initialize coverflow interactions
  const items = coverflowHero.querySelectorAll('.coverflow-item');
  let activeIndex = Math.floor(items.length / 2);
  
  // Set initial active state
  updateActiveState();
  
  // Add event listeners for navigation
  prevBtn.addEventListener('click', function() {
    activeIndex = (activeIndex - 1 + items.length) % items.length;
    updateActiveState();
  });
  
  nextBtn.addEventListener('click', function() {
    activeIndex = (activeIndex + 1) % items.length;
    updateActiveState();
  });
  
  // Add click handlers for individual covers
  items.forEach(function(item, index) {
    item.addEventListener('click', function() {
      activeIndex = index;
      updateActiveState();
    });
  });
  
  function updateActiveState() {
    items.forEach(function(item, index) {
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
        item.style.transform = 'translateX(-' + (distance * 50) + 'px) translateZ(0) rotateY(40deg) scale(' + (0.8 - distance * 0.1) + ')';
      } else {
        item.classList.add('coverflow-right');
        item.style.zIndex = items.length - distance;
        item.style.transform = 'translateX(' + (distance * 50) + 'px) translateZ(0) rotateY(-40deg) scale(' + (0.8 - distance * 0.1) + ')';
      }
    });
  }
  
  console.log('[Coverflow] Initialization complete');
});

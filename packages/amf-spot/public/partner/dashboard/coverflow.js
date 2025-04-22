console.log('[Coverflow] Script loaded');

document.addEventListener('DOMContentLoaded', () => {
  console.log('[Coverflow] DOM loaded');

  const carouselContainer = document.getElementById('carousel');
  const coverflowContainer = document.getElementById('coverflow-images');

  if (!carouselContainer || !coverflowContainer) return;

  // Wait a tick to allow images to load from API
  setTimeout(() => {
    const carouselImages = carouselContainer.querySelectorAll('img');

    if (!carouselImages.length) {
      console.warn('[Coverflow] No images found in #carousel to create coverflow');
      return;
    }

    coverflowContainer.innerHTML = '';

    carouselImages.forEach((img, i) => {
      const clone = img.cloneNode(true);
      const wrapper = document.createElement('div');
      wrapper.className = 'coverflow-image';
      wrapper.style.zIndex = carouselImages.length - i;
      wrapper.appendChild(clone);
      coverflowContainer.appendChild(wrapper);
    });

    console.log('[Coverflow] Coverflow initialized');
  }, 300); // allow time for API-rendered images to mount
});

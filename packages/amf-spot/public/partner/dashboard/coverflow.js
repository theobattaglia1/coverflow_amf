// FILE: coverflow.js

console.log('[Coverflow] Script loaded');

document.addEventListener('DOMContentLoaded', () => {
  console.log('[Coverflow] DOM loaded');

  const source = document.getElementById('carousel');
  const target = document.getElementById('coverflow-images');
  if (!source || !target) return;

  // Delay so dashboard.js can load images
  setTimeout(() => {
    const imgs = source.querySelectorAll('img');
    target.innerHTML = '';

    imgs.forEach((img, i) => {
      const clone = img.cloneNode(true);
      const wrapper = document.createElement('div');
      wrapper.className = 'coverflow-image';
      wrapper.style.zIndex = imgs.length - i;
      wrapper.appendChild(clone);
      target.appendChild(wrapper);
    });

    console.log('[Coverflow] Coverflow initialized');
  }, 500);
});

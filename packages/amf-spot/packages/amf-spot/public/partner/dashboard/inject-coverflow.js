// This script injects the required CSS and JS for the coverflow component
document.addEventListener('DOMContentLoaded', function() {
  // Check if styles already exist
  if (!document.querySelector('link[href="coverflow.css"]')) {
    // Add CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'coverflow.css';
    document.head.appendChild(link);
  }
  
  // Check if script already exists
  if (!document.querySelector('script[src="coverflow-update.js"]')) {
    // Add JS (after the DOM is fully loaded)
    const script = document.createElement('script');
    script.src = 'coverflow-update.js';
    document.body.appendChild(script);
  }
});

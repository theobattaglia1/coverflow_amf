// Fix styles by adding a link to the comment-styles.css file
document.addEventListener('DOMContentLoaded', () => {
  // Check if the link already exists
  if (!document.querySelector('link[href="comment-styles.css"]')) {
    const head = document.getElementsByTagName('head')[0];
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = 'comment-styles.css';
    head.appendChild(link);
    console.log('[StyleFix] Added comment styles link to head');
  }
});

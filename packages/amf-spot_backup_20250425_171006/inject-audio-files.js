// Script to inject the audioplayer files
const fs = require('fs');
const path = require('path');

// Define paths
const basePath = '/Users/theobattaglia/Sites/coverflow_amf/packages/amf-spot';
const cssPath = path.join(basePath, 'public/partner/dashboard/audioplayer.css');
const jsPath = path.join(basePath, 'public/partner/dashboard/audioplayer.js');
const htmlPath = path.join(basePath, 'public/partner/dashboard/index.html');

// Check if HTML file exists
if (!fs.existsSync(htmlPath)) {
  console.error('HTML file not found:', htmlPath);
  process.exit(1);
}

// Read HTML content
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Check if our files are already included
const hasCSS = htmlContent.includes('audioplayer.css');
const hasJS = htmlContent.includes('audioplayer.js');

// If needed, add them to the HTML
if (!hasCSS || !hasJS) {
  console.log('Modifying HTML to include audioplayer resources');
  
  if (!hasCSS) {
    // Add CSS link to the head
    htmlContent = htmlContent.replace('</head>', '<link rel="stylesheet" href="audioplayer.css">\n</head>');
    console.log('Added CSS link to head');
  }
  
  if (!hasJS) {
    // Add JS at the end of body
    htmlContent = htmlContent.replace('</body>', '<script src="audioplayer.js"></script>\n</body>');
    console.log('Added JS script to body');
  }
  
  // Save modified HTML
  fs.writeFileSync(htmlPath, htmlContent);
  console.log('Updated HTML file with audioplayer resources');
} else {
  console.log('Audio player resources already included in HTML');
}

console.log('Injection complete!');

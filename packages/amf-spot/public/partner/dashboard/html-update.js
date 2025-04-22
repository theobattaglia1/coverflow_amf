// Get the current HTML file content
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');

try {
  // Read the current HTML
  let htmlContent = fs.readFileSync(htmlPath, 'utf8');
  
  // Check if the style and script are already included
  const hasCommentStyles = htmlContent.includes('comment-styles.css');
  const hasFixScript = htmlContent.includes('fix-styles.js');
  
  if (!hasCommentStyles) {
    // Add the CSS link before the closing </head> tag
    htmlContent = htmlContent.replace('</head>', '  <link rel="stylesheet" href="comment-styles.css">\n</head>');
    console.log('Added comment-styles.css link to HTML');
  }
  
  if (!hasFixScript) {
    // Add the script before the closing </body> tag
    htmlContent = htmlContent.replace('</body>', '  <script src="fix-styles.js"></script>\n</body>');
    console.log('Added fix-styles.js script to HTML');
  }
  
  // Write the updated HTML
  fs.writeFileSync(htmlPath, htmlContent);
  console.log('HTML file updated successfully');
} catch (error) {
  console.error('Error updating HTML:', error);
}

const fs = require('fs');
const path = require('path');

console.log('Checking project structure...');

// Check directory structure
const checkDir = (dirPath, createIfMissing = true) => {
  console.log(`Checking directory: ${dirPath}`);
  
  try {
    if (!fs.existsSync(dirPath)) {
      if (createIfMissing) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
      } else {
        console.log(`Directory does not exist: ${dirPath}`);
        return false;
      }
    } else {
      console.log(`Directory exists: ${dirPath}`);
    }
    return true;
  } catch (err) {
    console.error(`Error checking directory ${dirPath}:`, err);
    return false;
  }
};

// Check file existence
const checkFile = (filePath, contentIfMissing = null) => {
  console.log(`Checking file: ${filePath}`);
  
  try {
    if (!fs.existsSync(filePath)) {
      if (contentIfMissing !== null) {
        // Create the directory if it doesn't exist
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`Created directory for file: ${dir}`);
        }
        
        fs.writeFileSync(filePath, contentIfMissing);
        console.log(`Created file: ${filePath}`);
      } else {
        console.log(`File does not exist: ${filePath}`);
        return false;
      }
    } else {
      console.log(`File exists: ${filePath}`);
    }
    return true;
  } catch (err) {
    console.error(`Error checking file ${filePath}:`, err);
    return false;
  }
};

// Check required directories
const baseDir = path.resolve(__dirname);
console.log(`Base directory: ${baseDir}`);

const dirChecks = [
  checkDir(path.join(baseDir, 'data')),
  checkDir(path.join(baseDir, 'uploads')),
  checkDir(path.join(baseDir, 'public')),
  checkDir(path.join(baseDir, 'public/partner')),
  checkDir(path.join(baseDir, 'public/partner/dashboard')),
  checkDir(path.join(baseDir, 'public/admin')),
  checkDir(path.join(baseDir, 'public/admin/dashboard'))
];

// Create a simple empty HTML if it doesn't exist
const htmlContent = `<!do-you-remember.m4aCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard</title>
  <link rel="stylesheet" href="coverflow.css">
</head>
<body>
  <h1>Dashboard</h1>
  <div id="dashboard-content">
    <!-- Dashboard content will be loaded here -->
  </div>
  <script src="coverflow.js"></script>
</body>
</html>`;

// Check required files
const fileChecks = [
  checkFile(path.join(baseDir, 'public/partner/dashboard/index.html'), htmlContent),
  checkFile(path.join(baseDir, 'public/partner/dashboard/coverflow.js'), '// Coverflow.js will be created by the server')
];

console.log('Structure check complete.');

if (dirChecks.every(Boolean) && fileChecks.every(Boolean)) {
  console.log('All directories and files are in place.');
} else {
  console.log('Some directories or files are missing or could not be created.');
}

const fs = require('fs');
const path = require('path');

const assetsPath = path.join(__dirname, '../data/assets.json');

function mergeFoldersIntoChildren(obj) {
  if (!obj) return;
  // Merge folders into children
  if (Array.isArray(obj.folders)) {
    if (!Array.isArray(obj.children)) obj.children = [];
    // Deduplicate by name
    const existingNames = new Set(obj.children.filter(f => f.type === 'folder').map(f => f.name));
    for (const folder of obj.folders) {
      if (folder.type === 'folder' && !existingNames.has(folder.name)) {
        obj.children.push(folder);
        existingNames.add(folder.name);
      }
    }
    delete obj.folders;
  }
  // Recurse into children
  if (Array.isArray(obj.children)) {
    for (const child of obj.children) {
      if (child.type === 'folder') mergeFoldersIntoChildren(child);
    }
  }
}

function main() {
  const raw = fs.readFileSync(assetsPath, 'utf-8');
  const data = JSON.parse(raw);
  mergeFoldersIntoChildren(data);
  fs.writeFileSync(assetsPath, JSON.stringify(data, null, 2));
  console.log('Migration complete. All folders merged into children and folders arrays removed.');
}

if (require.main === module) main(); 
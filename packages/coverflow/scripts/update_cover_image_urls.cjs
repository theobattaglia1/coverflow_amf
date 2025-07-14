// update_cover_image_urls.js
// Usage: node update_cover_image_urls.js

const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');

const DATA_DIR = path.join(__dirname, '../data');
const coversPath = path.join(DATA_DIR, 'covers.json');
const coversBackupPath = path.join(DATA_DIR, 'covers-backup.json');
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME;

if (!GCS_BUCKET_NAME) {
  console.error('GCS_BUCKET_NAME environment variable not set!');
  process.exit(1);
}

const storage = new Storage();
const bucket = storage.bucket(GCS_BUCKET_NAME);

async function main() {
  // Backup covers.json
  fs.copyFileSync(coversPath, coversBackupPath);
  console.log('Backed up covers.json to covers-backup.json');

  // Read covers
  const covers = JSON.parse(fs.readFileSync(coversPath, 'utf-8'));

  // List all image files in GCS
  const [files] = await bucket.getFiles();
  const imageFiles = files.filter(f => /\.(png|jpe?g|gif|bmp|webp)$/i.test(f.name));
  const gcsUrlMap = {};
  imageFiles.forEach(f => {
    const filename = f.name.split('/').pop();
    gcsUrlMap[filename] = `https://storage.googleapis.com/${bucket.name}/${f.name}`;
  });

  // Update covers
  let updated = 0;
  covers.forEach(cover => {
    ['frontImage', 'backImage'].forEach(field => {
      if (cover[field]) {
        const filename = cover[field].split('/').pop();
        if (gcsUrlMap[filename]) {
          cover[field] = gcsUrlMap[filename];
          updated++;
        }
      }
    });
  });

  // Write updated covers.json
  fs.writeFileSync(coversPath, JSON.stringify(covers, null, 2));
  console.log(`Updated ${updated} image URLs in covers.json`);
}

main().catch(err => {
  console.error('Error updating cover image URLs:', err);
  process.exit(1);
}); 
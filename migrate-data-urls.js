// Create a new file named `migrate-data-urls.js` in your project's root directory.
// Copy the code below into that file.

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'packages/coverflow/data');
const GCS_BUCKET_URL = 'https://storage.googleapis.com/allmyfriends-assets-2025';

async function migrateFile(filename) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    let content = await fs.promises.readFile(filePath, 'utf-8');
    const originalContent = content;
    
    // This regex will find all instances of old upload paths
    // It looks for "url": "/uploads/..." or "frontImage": "/uploads/..." etc.
    const regex = /(["'](frontImage|backImage|recordLabelImage|url)["']\s*:\s*["'])\/uploads\/([^"']*)/g;

    content = content.replace(regex, (match, p1, p2, p3) => {
      const newUrl = `${GCS_BUCKET_URL}/${p3}`;
      console.log(`  Replacing old path "/uploads/${p3}" with "${newUrl}"`);
      return `${p1}${newUrl}`;
    });

    if (content !== originalContent) {
      await fs.promises.writeFile(filePath, content);
      console.log(`✅ Successfully migrated URLs in ${filename}`);
    } else {
      console.log(`ℹ️ No old URLs found in ${filename}. No changes needed.`);
    }

  } catch (error) {
    if (error.code === 'ENOENT') {
        console.warn(`⚠️  Warning: ${filename} not found. Skipping.`);
    } else {
        console.error(`❌ Error processing ${filename}:`, error);
    }
  }
}

async function runMigration() {
  console.log('--- Starting Data Migration ---');
  await migrateFile('covers.json');
  await migrateFile('assets.json');
  console.log('--- Migration Complete ---');
  console.log('Please review the changes in your data files, then commit and push them to your repository.');
}

runMigration();

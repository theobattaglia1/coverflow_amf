// This script now synchronizes your GCS bucket with your local assets.json file.
// It includes extra logging to diagnose why assets might not be added.

import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';

// Corrected path to the data directory, assuming the script is run from the `coverflow_amf` directory.
const DATA_DIR = path.join(process.cwd(), 'packages/coverflow/data');
const GCS_BUCKET_NAME = 'allmyfriends-assets-2025';
const GCS_BUCKET_URL = `https://storage.googleapis.com/${GCS_BUCKET_NAME}`;

// --- FIX: Pointing directly to the new key in your Documents folder ---
const GCS_KEYFILE = '/Users/theobattaglia/Documents/all-my-friends-assets-120e6fc3295f.json';

async function syncGcsToAssets() {
  console.log('--- Starting GCS to assets.json synchronization ---');
  
  const assetsFilePath = path.join(DATA_DIR, 'assets.json');
  let assetsData;

  // 1. Read the existing assets.json file
  try {
    const content = await fs.promises.readFile(assetsFilePath, 'utf-8');
    assetsData = JSON.parse(content);
    console.log('✅ Successfully read existing assets.json');
  } catch (error) {
    console.warn('⚠️ assets.json not found or is invalid. Creating a new one.');
    assetsData = { folders: [], images: [] };
  }

  // Ensure root images array exists
  if (!assetsData.images) {
    assetsData.images = [];
  }
  
  const existingUrls = new Set(assetsData.images.map(img => img.url));
  console.log(`[DEBUG] Found ${existingUrls.size} existing assets in local assets.json.`);
  
  // 2. Fetch all files from the GCS bucket
  try {
    const storage = new Storage({ keyFilename: GCS_KEYFILE });
    const bucket = storage.bucket(GCS_BUCKET_NAME);
    const [files] = await bucket.getFiles();
    console.log(`✅ Found ${files.length} total files in GCS bucket.`);

    let newAssetsAdded = 0;

    // 3. Add any missing GCS files to the assets.json data
    for (const file of files) {
      const publicUrl = `${GCS_BUCKET_URL}/${file.name}`;
      const contentType = file.metadata.contentType || '';
      
      // --- FIX: Include both images and videos in the sync ---
      const isMedia = contentType.startsWith('image/') || contentType.startsWith('video/');
      if (file.name.endsWith('/') || !isMedia) {
          continue;
      }
      
      if (!existingUrls.has(publicUrl)) {
        console.log(`  ➕ Adding new asset: ${file.name}`);
        assetsData.images.push({
          url: publicUrl,
          type: contentType.split('/')[0], // 'image' or 'video'
          filename: path.basename(file.name)
        });
        newAssetsAdded++;
      }
    }
    
    // 4. Write the updated data back to the file if changes were made
    if (newAssetsAdded > 0) {
      await fs.promises.writeFile(assetsFilePath, JSON.stringify(assetsData, null, 2));
      console.log(`✅ Synchronization complete. Added ${newAssetsAdded} new assets to assets.json.`);
    } else {
      console.log('ℹ️ assets.json is already up to date with GCS. No changes needed.');
    }

  } catch (error) {
    console.error('❌ Failed to synchronize with GCS:', error);
    console.error('Please ensure your service account key is correctly located at:', GCS_KEYFILE);
  }

  console.log('--- Synchronization Complete ---');
  console.log('Please review the changes in your data files, then commit and push them to your repository.');
}

syncGcsToAssets();

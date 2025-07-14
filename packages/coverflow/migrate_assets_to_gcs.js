// migrate_assets_to_gcs.js
// Usage: node migrate_assets_to_gcs.js

import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import { Storage } from '@google-cloud/storage';
import process from 'process';

const DATA_DIR = path.join(process.cwd(), 'data');
const coversPath = path.join(DATA_DIR, 'covers.json');
const assetsPath = path.join(DATA_DIR, 'assets.json');
const OLD_BASE_URL = 'https://allmyfriendsinc.com/uploads';
const OLD_LOCAL_PREFIX = '/uploads';

const bucketName = process.env.GCS_BUCKET_NAME;
if (!bucketName) {
  console.error('GCS_BUCKET_NAME environment variable not set!');
  process.exit(1);
}

const storage = new Storage();
const bucket = storage.bucket(bucketName);

async function downloadFile(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadToGCS(buffer, gcsPath, contentType) {
  const file = bucket.file(gcsPath);
  await file.save(buffer, { resumable: false, contentType });
  return `https://storage.googleapis.com/${bucket.name}/${gcsPath}`;
}

function getFilenameFromUrl(url) {
  return url.split('/').pop();
}

function getGcsPath(url, artistName = '') {
  // Try to preserve folder structure if possible
  const parts = url.replace(OLD_BASE_URL, '').replace(OLD_LOCAL_PREFIX, '').split('/').filter(Boolean);
  if (artistName) parts.unshift(artistName.replace(/\s+/g, '_'));
  return parts.join('/');
}

async function migrateCovers(covers) {
  let migrated = 0;
  for (const cover of covers) {
    // frontImage
    if (cover.frontImage && (cover.frontImage.startsWith(OLD_LOCAL_PREFIX) || cover.frontImage.startsWith(OLD_BASE_URL))) {
      const url = cover.frontImage.startsWith(OLD_LOCAL_PREFIX)
        ? `${OLD_BASE_URL}${cover.frontImage.replace(OLD_LOCAL_PREFIX, '')}`
        : cover.frontImage;
      try {
        const buffer = await downloadFile(url);
        const gcsPath = getGcsPath(cover.frontImage, cover.artistDetails?.name);
        const contentType = 'image/' + (path.extname(gcsPath).replace('.', '') || 'png');
        const gcsUrl = await uploadToGCS(buffer, gcsPath, contentType);
        cover.frontImage = gcsUrl;
        migrated++;
        console.log(`✔ Migrated cover frontImage for ${cover.albumTitle || cover.id}`);
      } catch (err) {
        console.error(`✖ Failed to migrate cover frontImage for ${cover.albumTitle || cover.id}:`, err.message);
      }
    }
    // artistDetails.image
    if (cover.artistDetails && cover.artistDetails.image && (cover.artistDetails.image.startsWith(OLD_LOCAL_PREFIX) || cover.artistDetails.image.startsWith(OLD_BASE_URL))) {
      const url = cover.artistDetails.image.startsWith(OLD_LOCAL_PREFIX)
        ? `${OLD_BASE_URL}${cover.artistDetails.image.replace(OLD_LOCAL_PREFIX, '')}`
        : cover.artistDetails.image;
      try {
        const buffer = await downloadFile(url);
        const gcsPath = getGcsPath(cover.artistDetails.image, cover.artistDetails?.name);
        const contentType = 'image/' + (path.extname(gcsPath).replace('.', '') || 'png');
        const gcsUrl = await uploadToGCS(buffer, gcsPath, contentType);
        cover.artistDetails.image = gcsUrl;
        migrated++;
        console.log(`✔ Migrated artist image for ${cover.artistDetails?.name || cover.id}`);
      } catch (err) {
        console.error(`✖ Failed to migrate artist image for ${cover.artistDetails?.name || cover.id}:`, err.message);
      }
    }
  }
  return migrated;
}

async function migrateAssets(assets) {
  let migrated = 0;
  // folders
  if (Array.isArray(assets.folders)) {
    for (const folder of assets.folders) {
      if (Array.isArray(folder.children)) {
        for (const child of folder.children) {
          if (child.url && (child.url.startsWith(OLD_LOCAL_PREFIX) || child.url.startsWith(OLD_BASE_URL))) {
            const url = child.url.startsWith(OLD_LOCAL_PREFIX)
              ? `${OLD_BASE_URL}${child.url.replace(OLD_LOCAL_PREFIX, '')}`
              : child.url;
            try {
              const buffer = await downloadFile(url);
              const gcsPath = getGcsPath(child.url, folder.name);
              const contentType = 'image/' + (path.extname(gcsPath).replace('.', '') || 'png');
              const gcsUrl = await uploadToGCS(buffer, gcsPath, contentType);
              child.url = gcsUrl;
              migrated++;
              console.log(`✔ Migrated asset in folder ${folder.name}`);
            } catch (err) {
              console.error(`✖ Failed to migrate asset in folder ${folder.name}:`, err.message);
            }
          }
        }
      }
    }
  }
  // images (top-level)
  if (Array.isArray(assets.images)) {
    for (const image of assets.images) {
      if (image.url && (image.url.startsWith(OLD_LOCAL_PREFIX) || image.url.startsWith(OLD_BASE_URL))) {
        const url = image.url.startsWith(OLD_LOCAL_PREFIX)
          ? `${OLD_BASE_URL}${image.url.replace(OLD_LOCAL_PREFIX, '')}`
          : image.url;
        try {
          const buffer = await downloadFile(url);
          const gcsPath = getGcsPath(image.url);
          const contentType = 'image/' + (path.extname(gcsPath).replace('.', '') || 'png');
          const gcsUrl = await uploadToGCS(buffer, gcsPath, contentType);
          image.url = gcsUrl;
          migrated++;
          console.log(`✔ Migrated top-level asset`);
        } catch (err) {
          console.error(`✖ Failed to migrate top-level asset:`, err.message);
        }
      }
    }
  }
  return migrated;
}

async function main() {
  console.log('Reading covers.json and assets.json...');
  const covers = JSON.parse(await fs.readFile(coversPath, 'utf-8'));
  const assets = JSON.parse(await fs.readFile(assetsPath, 'utf-8'));

  console.log('Migrating covers...');
  const coversMigrated = await migrateCovers(covers);
  console.log('Migrating assets...');
  const assetsMigrated = await migrateAssets(assets);

  await fs.writeFile(coversPath, JSON.stringify(covers, null, 2));
  await fs.writeFile(assetsPath, JSON.stringify(assets, null, 2));

  console.log('--- Migration Complete ---');
  console.log(`Covers migrated: ${coversMigrated}`);
  console.log(`Assets migrated: ${assetsMigrated}`);
  console.log('Your covers.json and assets.json have been updated with GCS URLs.');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
}); 
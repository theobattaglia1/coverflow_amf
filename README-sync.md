# 📝 AMF Git & Dashboard Sync Cheat Sheet

---

## When You Want to Make Local Changes

1. **Pull the Latest from GitHub**
   ```sh
   git pull origin main
   ```
   _Why:_ Ensures you have the latest dashboard/server changes (like new covers or edits).

2. **Make Your Local Changes**
   - Edit code, data, or covers as needed.

3. **Stage and Commit Your Changes**
   ```sh
   git add .
   git commit -m "Describe your local changes"
   ```

4. **Push Your Changes to GitHub**
   ```sh
   git push origin main
   ```

---

## If You Get a Merge Conflict

- Open the conflicted file(s) (e.g., `covers.json`).
- Edit to resolve the conflict (keep both sets of good changes).
- Then:
  ```sh
  git add packages/coverflow/data/covers.json
  git commit
  git push origin main
  ```

---

## When You Make Changes in the Dashboard

- Click **“Push Live”** in the admin dashboard.
- The server will auto-commit and push the latest data to GitHub.
- **Before making any local changes, always do a `git pull` first!**

---

## Quick Reference Table

| Action                        | Command(s) / Step                                      |
|-------------------------------|--------------------------------------------------------|
| Get latest from GitHub        | `git pull origin main`                                 |
| Stage changes                 | `git add .`                                            |
| Commit changes                | `git commit -m "Your message"`                         |
| Push changes                  | `git push origin main`                                 |
| Resolve merge conflict        | Edit file, then `git add <file>` and `git commit`      |
| Dashboard changes             | Click “Push Live” (then always `git pull` before local)|

---

## Best Practices
- **Always pull before you start working locally.**
- **Always push after you finish your local work.**
- **If you see a conflict, resolve it carefully and commit.**
- **If in doubt, ask before pushing!**

---

## Persistent Admin Data (Render Deployment)
- Production now mounts a Render **Persistent Disk** at `/var/data` to store everything under `packages/coverflow/data`.
- The server reads the override path from the `DATA_DIR_PATH` env variable (currently `/var/data/coverflow-data`), so admin edits survive new deploys.
- On first deploy with the disk attached, the app seeds the disk with whatever JSON files are in the repo. If you already have newer data running in production, download `/data/covers.json` and `/data/assets.json` from the live site and copy them into the disk directory before redeploying to avoid regressions.
- Git auto-sync (`Push Live`) will continue to work for local/dev environments where data lives inside the repo; in production it is automatically skipped because the data directory is outside the repo tree.

## Remote Data Mirror (GCS fallback)
- Set `DATA_SYNC_PROVIDER=gcs` and (optionally) `DATA_SYNC_PREFIX=admin-data` so every save also uploads `covers.json` and `assets.json` to Cloud Storage.
- `DATA_SYNC_FILES` defaults to `covers.json,assets.json`; override if you add more JSON data sources.
- Startup sync (`DATA_SYNC_ON_START`, default `true`) downloads the latest copies from `gs://<DATA_SYNC_BUCKET>/<prefix>/...` before the server begins handling traffic, so new deploys always hydrate with current data even if the local filesystem is fresh.
- Post-save sync (`DATA_SYNC_ON_SAVE`, default `true`) fails the write if the upload cannot complete—this prevents silent divergence between local disk and the canonical bucket.
- Before enabling the feature in production, manually upload the latest `/data/covers.json` and `/data/assets.json` from the live site into the configured bucket/prefix so the first boot pulls the current data set.

---

**Tip:**
You can copy this cheat sheet into a `README-sync.md` in your repo for your team! 
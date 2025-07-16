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

**Tip:**
You can copy this cheat sheet into a `README-sync.md` in your repo for your team! 
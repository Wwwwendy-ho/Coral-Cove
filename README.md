# Coral Cove

Coral Cove flashcards, set up to run on GitHub Pages and as an iPad Home Screen app.

## Files

| File | What it is |
|---|---|
| `index.html` | The Coral Cove app |
| `seed-data.js` | Starting decks, cards and progress, exported from Claude on Oct 7, 2026 |
| `audio-clips.js` | Recorded pronunciation clips |
| `storage.js` | Saves decks and progress on the device itself |
| `manifest.webmanifest`, `icon-*.png` | Home Screen app name and icon |
| `sw.js` | Lets the app open without Wi-Fi |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

## Upload to GitHub

1. Sign in at github.com and click **New repository**. Name it `coral-cove`.
2. Click **uploading an existing file**, drag in every file from this folder, and click **Commit changes**.
   - `.nojekyll` starts with a dot, so your computer may hide it. If it's missing, click
     **Add file → Create new file**, name it `.nojekyll`, leave it empty and commit.
3. Go to **Settings → Pages**. Under "Build and deployment", choose **Deploy from a branch**,
   pick `main` and `/ (root)`, and click **Save**.
4. After a minute or two the site is live at `https://YOUR-USERNAME.github.io/coral-cove/`.

## Set up the iPad

1. Open the link in Safari, tap **Share → Add to Home Screen**, keep **Open as Web App** on, tap **Add**.
2. Settings → Screen Time → Content & Privacy Restrictions → App Store, Media, Web & Games →
   Web Content → **Only Approved Websites**. Remove the defaults and add
   `https://YOUR-USERNAME.github.io`.
3. Open Coral Cove from its Home Screen icon and triple-click the top button to start Guided Access.

## Good to know

- **Progress stays on the iPad.** Each device keeps its own copy. Changes made in the Claude
  version don't appear here, and changes here don't go back to Claude.
- **Always open it from the Home Screen icon**, not Safari. Safari can clear a website's saved data
  after a week without visits; Home Screen apps keep theirs.
- **Photo uploads are turned off** in this version, since they need Claude's online storage.
- **Fonts:** if Screen Time blocks `fonts.googleapis.com`, Coral Cove uses the iPad's built-in font
  instead. Approve `https://fonts.googleapis.com` and `https://fonts.gstatic.com` to keep the
  rounded Coral Cove fonts.
- **Updating later:** upload changed files over the old ones. Decks already saved on the iPad are
  kept; new starting data in `seed-data.js` only applies on a device that has never opened the app.

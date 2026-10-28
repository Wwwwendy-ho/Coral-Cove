# Coral Cove

Coral Cove flashcards as a 3D underwater board game, set up to run on GitHub Pages and as an iPad Home Screen app.
Shelly the turtle (Lumi the anglerfish at night) hops along a path of deck spaces across the reef.
See `CHANGELOG.md` for what's in the current version (Version 99).

## Files

| File | What it is |
|---|---|
| `index.html` | The Coral Cove app |
| `seed-data.js` | Starting decks, cards and progress, exported from Claude on Oct 26, 2026 |
| `three.min.js` | three.js r128, the 3D engine for the reef board and the profile lobby |
| `reef-models.js` | The 3D models (Shelly's friends, fish, scenery, ? blocks), loaded when the board first opens |
| `day-song.mp3`, `night-song.mp3` | Background music for day and night (softened copies: highs rolled off, a little more space at night) |
| `lobby-song.mp3`, `deck-song.mp3`, `timer-song.mp3`, `game-song.mp3` | Profile screen, inside decks, Timed Choice cards (a kalimba ticking in time with the countdown) and minigames: original loops played on sampled instruments by `tools/compose_music.py`. Swap in any MP3 with the same name to change them. |
| `win.mp3` | Celebration music when a deck is finished |
| `audio-clips.js` | Recorded pronunciation clips |
| `voice/` | Natural-voice speech packs (English, Korean, Chinese) used to read cards aloud |
| `storage.js` | Saves decks and progress on the device itself |
| `words.js`, `words-data.js` | Ask Shelly's offline dictionary: English meanings, Chinese words and character parts (built by the scripts in `tools/words/`; loads the first time Ask Shelly opens) |
| `manifest.webmanifest`, `icon-*.png` | Home Screen app name and icon |
| `sw.js` | Lets the app open without Wi-Fi |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |
| `coral-cove/` | A copy of the site, kept for devices that saved the older address ending in `/coral-cove/` |
| `tools/sync_from_artifact.py` | Rebuilds this site (and the `coral-cove/` copy) from a download of the Claude artifact |
| `tools/ipad_patches.py` | The iPad PIN changes, applied on every rebuild |
| `CHANGELOG.md` | What changed in each version |

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
- **PIN on this copy:** the child profile opens and starts a session without the PIN. Ending her session
  and switching profiles mid-session still need it. Leaving a deck early asks her a subtraction question
  instead of the PIN. Grown-up profiles need the PIN to open. (`tools/ipad_patches.py` makes the PIN
  changes on every update.)
- **Photo uploads are turned off** in this version, since they need Claude's online storage.
- **Ask Shelly** works offline for single words and short sentences in Korean, English and Chinese (traditional characters, pinyin with tone marks). Open questions need the Claude version.
- **The party board** (dice, shells, pearls, shop, minigames, story mode, the night shipwreck) exists only in this
  GitHub copy. Shells, pearls and hats are saved with each profile on the device. Story mode appears for profiles
  with a daily plan.
- **Music** starts after the first tap, because browsers don't allow sound before one. The 🎵 button turns it
  on or off. If it won't play, hold 🎵 for a second to see a short note on what happened.
- **3D and offline:** the 3D engine, the models and the celebration music are saved for offline use the first
  time the app opens with Wi-Fi. Each background song is saved the first time it plays. The **Calm motion**
  switch in Settings (or the iPad's Reduce Motion) turns off the movement.
- **Fonts:** if Screen Time blocks `fonts.googleapis.com`, Coral Cove uses the iPad's built-in font
  instead. Approve `https://fonts.googleapis.com` and `https://fonts.gstatic.com` to keep the
  rounded Coral Cove fonts.
- **Syncing from Claude:** `tools/sync_from_artifact.py` replaces `index.html` with the Claude version, which would
  remove the party board. Bring those changes into the Claude version first, or skip the sync.
- **Updating later:** upload changed files over the old ones. Decks already saved on the iPad are
  kept; new decks and cards in `seed-data.js` are added the next time the app opens, without changing
  progress already saved on that device.

## Claude helper

The Library's tutor, worksheet maker and writing and photo feedback can use Claude when the iPad is online.
If Claude can't be reached, or the iPad is offline, every Library feature uses its built-in version instead.
The Anthropic API key stays on Cloudflare, in a small Worker, so it never appears in the public app.

Set it up once, with a grown-up:

1. In the Cloudflare dashboard, go to Workers & Pages, choose Create, then Worker. Paste in the whole of
   `tools/claude-proxy-worker.js` and click Deploy.
2. Open the Worker's Settings, then Variables and Secrets, and add:
   - `ANTHROPIC_API_KEY` (Secret): your key from console.anthropic.com
   - `CORAL_CODE` (Secret): any long passphrase. You'll type the same one into Coral Cove.
   - `MODEL` (Text, optional): the Claude model to use. Defaults to `claude-opus-5-5`.
   - `ALLOW_ORIGIN` (Text, optional): where Coral Cove runs, e.g. `https://wwwwendy-ho.github.io`.
     Defaults to `*`.
3. In Coral Cove, open 📚 Library, then Settings (answer the grown-up maths question). Paste in the Worker's URL and the
   passphrase, then tap "Test it".

Each request is billed to your Anthropic account. Replies are kept short to keep the cost low.

To turn it off, open Library Settings and tap "Turn off". The Library goes back to its offline versions.

## Credits

- 3D models: Quaternius (Ultimate Platformer Pack, Fish Pack) and the Kenney Pirate Kit (kenney.nl), all CC0.
- 3D engine: [three.js](https://threejs.org) r128, MIT licence.
- English backup definitions: [WordNet 3.0](https://wordnet.princeton.edu), Princeton University (WordNet licence). The child-friendly definitions were written for Coral Cove.
- Chinese words and meanings: [CC-CEDICT](https://cc-cedict.org), CC BY-SA 4.0. The Chinese part of `words-data.js` is shared under the same licence.
- Chinese character parts: [cjk-decomp](https://github.com/amake/cjk-decomp) by Aaron Madlon-Kay, Apache License 2.0.
- Word frequencies for choosing which words to include: [wordfreq](https://github.com/rspeer/wordfreq) (data CC BY-SA 4.0).

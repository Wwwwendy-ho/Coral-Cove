# Coral Cove

A marine-themed, Anki-style flashcard app built for a 7–9 year old learner. Kids study decks of cards (sight words, math facts, vocabulary, etc.) using spaced repetition, and a parent PIN gates anything administrative — starting a session, editing decks, or leaving mid-round — so the app can be handed to a child directly.

## What's in this repo

This is a single self-contained web page — there's no build step, no server, and no dependencies to install.

- **`index.html`** — the entire app: markup, styling, and logic all in one file, with a starting set of decks and cards baked in. This is the file to deploy.
- **`build_offline.py`** and **`seed_data.json`** — the tooling used to *produce* `index.html` from the live version of the app plus a snapshot of deck/card data. You only need these if you want to regenerate `index.html` yourself (see "Updating content" below). They aren't needed to run or host the site.

## Hosting it (GitHub Pages)

1. Create a GitHub repository (or use an existing one).
2. Upload `index.html` to the root of the repo (**Add file → Upload files → Commit**).
3. In the repo, go to **Settings → Pages**, and under "Build and deployment" choose **Deploy from a branch**, branch `main`, folder `/root` (sometimes shown as `/ (root)`).
4. GitHub gives you a URL like `https://yourusername.github.io/your-repo-name/`. That's the link to open on any device — phone, tablet, laptop.

Every time you want to push an update, replace `index.html` in the repo with the new version and commit; GitHub Pages republishes automatically within a minute or two.

## Using the app

**First launch:** the app asks you to create a 4-digit parent PIN. This PIN is required for anything a kid shouldn't be able to do on their own.

**Starting a study session:** from the locked "Coral Cove is resting" screen, tap **"I'm a grown-up — Start Session"**, enter the PIN, and pick a deck. Once a session is active, the child can study without needing the PIN again — except to leave a round early (finishing a round normally doesn't require the PIN).

**Admin / Manage Decks mode:** tap **"🔧 Manage Decks"** on the same locked screen and enter the PIN. From here you can create decks, add/edit/delete cards, and archive decks you don't want showing up for the child right now (archived decks are completely hidden from the study view). Tap **"✅ Done"** to leave.

**Stats:** the 📊 button on the home screen (visible in both modes) shows cards reviewed, accuracy, streaks, and a per-deck mastery breakdown.

**Studying:** cards support three modes — flip (tap to reveal the answer), multiple choice, or read-aloud. Swipe down on the current card to peek back at the one you just answered (read-only, to check what you got); swipe up or tap to return. You can't swipe forward past an unanswered card — answering is the only way ahead.

## Locking it down for a child

Two things combine well here:
1. **Open the hosted GitHub Pages link directly** (not through a general browser tab a child could navigate away from) — this app has no "exit" back to anywhere else once it's the only thing open.
2. **Use your device's built-in kiosk mode** — iOS Guided Access (triple-click the side button once it's enabled in Settings → Accessibility) locks the screen to a single app, so a child can't switch away even within the browser.

There's also a Windows desktop-shortcut wrapper available separately (an installer that adds a double-click icon pointing at the offline file) if you'd rather not rely on a browser tab on a Windows machine.

## Updating content

**Easiest — do it in the app itself:** use Manage Decks mode to add, edit, archive, or delete cards and decks directly. This works for the live artifact version right away. For the GitHub Pages copy, you'll periodically want to pull a fresh snapshot into `index.html` (ask for a rebuilt copy any time your decks change and you want the hosted version to match).

**Manually, via the build script:** if you're regenerating `index.html` yourself, you need three things in the same folder: the app's source HTML (named `coral-cove.html`), `build_offline.py`, and `seed_data.json` (your current deck/card data as JSON). Run:

```
python3 build_offline.py
```

This writes a fresh standalone HTML file with `seed_data.json`'s content baked in as the starting point.

## Live artifact vs. offline copy — what's the difference?

The **live artifact** (the version hosted on claude.ai) reads and writes to a shared live database — a parent editing a deck on one device shows up on another, and progress is saved automatically. The **offline copy** (`index.html`, what you host on GitHub Pages) has no server behind it: it starts from a fixed snapshot of your decks each time and doesn't sync anywhere. Both run the same app code; they just differ in whether there's a live backend attached.

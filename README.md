# Coral Cove

A marine-themed, Anki-style flashcard app built for a 7–9 year old learner. Kids study decks of cards (sight words, math facts, vocabulary, etc.) using spaced repetition, and a parent PIN gates anything administrative — starting a session, editing decks, or leaving mid-round — so the app can be handed to a child directly.

## What's in this repo

This is a single self-contained web page — there's no build step, no server, and no dependencies to install.

- **`index.html`** — the entire app: markup, styling, and logic all in one file, with a starting set of decks and cards baked in. This is the file to deploy.
- **`build_offline.py`** and **`seed_data.json`** — the tooling used to *produce* `index.html` from the live version of the app plus a snapshot of deck/card data. You only need these if you want to regenerate `index.html` yourself (see "Updating content" below). They aren't needed to run or host the site.
## Using the app

**First launch:** the app asks you to create a 4-digit parent PIN. This PIN is required for anything a kid shouldn't be able to do on their own.

**Starting a study session:** from the locked "Coral Cove is resting" screen, tap **"I'm a grown-up — Start Session"**, enter the PIN, and pick a deck. Once a session is active, the child can study without needing the PIN again — except to leave a round early (finishing a round normally doesn't require the PIN).

**Admin / Manage Decks mode:** tap **"🔧 Manage Decks"** on the same locked screen and enter the PIN. From here you can create decks, add/edit/delete cards, and archive decks you don't want showing up for the child right now (archived decks are completely hidden from the study view). Tap **"✅ Done"** to leave.

**Stats:** the 📊 button on the home screen (visible in both modes) shows cards reviewed, accuracy, streaks, and a per-deck mastery breakdown.

**Studying:** cards support three modes — flip (tap to reveal the answer), multiple choice, or read-aloud. Swipe down on the current card to peek back at the one you just answered (read-only, to check what you got); swipe up or tap to return. You can't swipe forward past an unanswered card — answering is the only way ahead.

## Locking it down for a child

**Use your device's built-in kiosk mode** — iOS Guided Access (triple-click the side button once it's enabled in Settings → Accessibility) locks the screen to a single app, so a child can't switch away even within the browser.

## Updating content

**Easiest — do it in the app itself:** use Manage Decks mode to add, edit, archive, or delete cards and decks directly. This works for the live artifact version right away. For the GitHub Pages copy, you'll periodically want to pull a fresh snapshot into `index.html` (ask for a rebuilt copy any time your decks change and you want the hosted version to match).

**Manually, via the build script:** if you're regenerating `index.html` yourself, you need three things in the same folder: the app's source HTML (named `coral-cove.html`), `build_offline.py`, and `seed_data.json` (your current deck/card data as JSON). Run:

```
python3 build_offline.py
```

This writes a fresh standalone HTML file with `seed_data.json`'s content baked in as the starting point.

# How Coral Cove is built

A guide for whoever works on the code next. `README.md` covers using the app; this covers where things are and
how they fit together. Function names below can be searched for in the files.

## Files

| File | What it holds |
| --- | --- |
| `src/` | The app's code, in about 30 files (see Editing the code) |
| `index.html` | The whole app in one page, **built from `src/`** by `tools/build.py`. Don't edit it directly |
| `storage.js` | The on-device database used on GitHub Pages (see Saving) |
| `seed-data.js`, `audio-clips.js` | Starting decks, profiles and progress, and recorded pronunciation clips |
| `library.js` | The Library (tutor, worksheets, check my work, progress), exposed through `window.CoralCove` |
| `words.js`, `words-data.js` | Ask Shelly's offline English and Chinese word help and its dictionary |
| `reef-models.js` | The 3D models (GLB files as base64) |
| `three.min.js` | three.js r128 |
| `*.mp3`, `voice/` | Background songs and the natural voice packs |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | Offline support and the Home Screen app |
| `coral-cove/` | An exact copy of the site for iPads saved on the old address (`tools/mirror.sh` keeps it in sync) |
| `tools/` | Build and check scripts (see Tools) |

## Editing the code

The app is one page, `index.html`, but its code lives in `src/` so each part can be found and read on its own:

- `src/page.html` is the page: the head, the screen's outline, and a line like `<!-- include: js/learning.js -->`
  wherever a file goes. Its script block opens with a map of every script file and what it holds. Start there.
- `src/css/`: `base.css` (the main app styles, with its own contents list), `fixes-and-refresh.css` (later
  layers: accessibility fixes, the ocean tokens, art direction, status colours), `swim.css` (the swimming
  mascot), `ask.css` (Ask Shelly), `reef.css` (the Child Mode look) and `reef-3d.css` (the board and lobby).
- `src/js/`: the script, in order. `src/js/reef3d/` holds the 3D board and lobby, and `src/js/vendor/` the
  third-party GLTFLoader.

The script files are not separate programs: they are pieces of one function, and `tools/build.py` joins them
back into one script, in the order `page.html` lists them. So a file can use any variable or function from
another, as when it was all one file. Keep new code in the file it belongs to, and add a new file with a new
include line in `page.html`.

After an edit: `python3 tools/build.py` writes `index.html` (each file in it sits between `/* from src/... */` and
`/* end of src/... */` comment lines, which help when reading errors in the browser), then `sh tools/mirror.sh`,
then `sh tools/check/run.sh`. The check fails if `index.html` wasn't rebuilt, and lint gives `src/` file names and
line numbers.

## The two copies

GitHub is the main copy. The Claude artifact is a viewing copy built from it by `tools/build_claude.py`, which
puts the side files inside the page (Claude can't load them) and loads three.js from cdnjs. Inside Claude,
`storage.js` and the seed data are left out and the app saves to the artifact's own database instead.

Code that must behave differently in the two places checks `reefNoPin()` (true inside Claude, where there is no
seed data). The main difference: the Claude version has no grown-up checks at all.

## Start-up

1. The head loads `seed-data.js`, `audio-clips.js`, `storage.js` (which creates `window.claude.use('db')` when
   Claude's doesn't exist), `library.js` and `words.js`, and registers `sw.js`.
2. The main script defines everything, then the `boot` section opens the store, loads settings and profiles,
   and calls `render()`.
3. The title screen (`renderSplash`) floats over the profile picker until it is tapped; that tap starts the
   music, because browsers only allow sound after a tap.
4. Picking a profile loads its decks. Child profiles open the reef board (`REEF 3D`); grown-up profiles open
   the deck list after the grown-up maths question.

## State and drawing

All screen state lives in one object, `S` (search `var S = {`). Its fields are commented where they are defined.

`render()` redraws the current screen from `S`: `renderScreen()` picks the screen (profile picker, home, study,
feeds, stats, editor, ...) from `S.view` and a few flags. After that, `render()` runs the after-render hooks:
features that react to whatever is on screen (the swimming mascot, the study buddy, music, the Ask Shelly
button) register with `afterRender(name, fn)`. Add new ones the same way rather than wrapping `render()`.

Event handlers change `S` and call `render()` again. The 3D board is the exception: it keeps its own scene
alive between renders (see 3D).

## Saving

The app talks to one small database interface (`store adapter`): profiles, decks, cards and settings.
- Inside Claude it is the artifact's `db` capability, shared between devices.
- On GitHub Pages `storage.js` provides the same interface in the iPad's `localStorage`. Seed data the device
  doesn't have yet is added on open without overwriting progress.
- If neither works, an in-memory store keeps the app usable and shows a warning.

`coveWrapStore` (in `boot`) adds a 45-second cache for card reads; any write clears it.

## Learning engine

The scheduler is Anki-style SM-2 (constants at the top of the script, `DIFFICULTIES` for the three levels).
Each card type (timed choice, sound-out blend, Hangul Blend, Listen & Pick, Echo, Mic, Sentence Builder,
Chinese bridge, Native or Sino?) has its own section with its state on `S` and a render function.

## Grown-up checks

There is no PIN. On GitHub, `reefGrownUpGate(kind)` shows a times question; a right answer calls
`grownUpPassed(kind)`, which carries on to what was asked for (a grown-up profile, ending a session, Edit Mode,
...). Leaving a deck early on the child profile asks a subtraction question instead. Every check goes through
`renderPinPad(kind)`, which skips it in the Claude version (`reefNoPin()`) and inside a grown-up profile
(`reefInsideAdult(kind)`: only opening the profile and Manage Profiles ask). The Library asks the app through
`window.CoralCove.needsGrownUpCheck()`, so its Settings follow the same rules.

## 3D (the reef board and lobby)

- `reef3dBuild` builds the board scene from the decks (zones) and models; `attach()` puts it on screen.
- `reef3dWarm` compiles the effect shaders while the board loads, so the first star burst or dive doesn't pause.
- `reef3dQTick` lowers or raises picture quality (shadows, resolution) from the frame rate, but never during a
  hop, dive, dice roll or day/night switch.
- The party board (dice, shells, pearls, shop, minigames), story mode and the night shipwreck are sections
  inside `REEF 3D`.
- `REEF LOBBY` is the 3D profile picker. `REEF WORLD` is the 2D map used when 3D can't start.
- The three.js GLTFLoader is bundled inside the script, marked `THIRD-PARTY CODE`; don't edit it.

## Sound

`Background music` picks a song per place (day reef, night ship, lobby, deck, timed cards, minigames). Spoken
answers use the voice packs in `voice/` on GitHub, recorded clips where they exist, and the device's voice
otherwise.

## Ask Shelly

The Ask Shelly button opens a chat about the card on screen. Offline answers come first: `askLocal` tries
Korean (`koLocalAnswer`, in `src/js/reef.js`) and then `words.js` (English and Chinese). `words-data.js` loads the
first time Ask Shelly opens. `tools/words/README.md` explains how the dictionary is built.

## The Library

`library.js` adds the Library's modes beside the board. It uses the app only through `window.CoralCove`
(search `window.CoralCove = {`): profiles, decks, cards, the store, speech and the grown-up check.

## Styles

`base.css` and `fixes-and-refresh.css` hold the app styles, in order of application, with the colour tokens as
custom properties on `:root` (each with its dark-mode value beside it). The fonts are `--font-display` (Fredoka)
and `--font-body` (Nunito Sans), from Google Fonts; `sw.js` saves them for offline use. `reef.css` and `reef-3d.css` hold the game
look: Child Mode, the board and the lobby. A later rule with the same selector wins, so look
for an existing rule before adding one; `tools/check/css_audit.py` reports values that are overridden.

## Tools

| Tool | Use |
| --- | --- |
| `tools/build.py` | Builds `index.html` from `src/` |
| `tools/check/run.sh` | Run before every push: build check, lint, style audit, mirror check, word tests, browser smoke test |
| `tools/check/snapshots.js` + `compare.py` | Screenshots and computed styles of 16 screens, to compare before and after a change |
| `tools/build_claude.py` | Builds the Claude version into `build/` |
| `tools/export_seed.py` | Replaces the starting data with a database export from the Claude version |
| `tools/mirror.sh` | Copies the site into `coral-cove/` |
| `tools/words/` | Builds the offline dictionary |
| `tools/compose_music.py` | Makes the songs |

After changing site files: run `python3 tools/build.py`, bump the cache name in `sw.js` (so iPads fetch the new
version), run `sh tools/mirror.sh`, then `sh tools/check/run.sh`.

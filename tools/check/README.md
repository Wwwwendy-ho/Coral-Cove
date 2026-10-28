# Checks

Run these before pushing a change to `src/`, `library.js`, `words.js` or the other site files. Build first (`python3 tools/build.py`).

```
sh tools/check/run.sh
```

It runs, in order:

| Check | File | What it looks for |
|---|---|---|
| Build | `../build.py --check` | `index.html` was rebuilt after the last change in `src/`. |
| Lint | `lint.js` (rules in `.eslintrc.json`) | Undefined names, duplicate declarations, unreachable code, unused variables, and functions nothing can call (followed through chains). The main script is checked whole, as built into `index.html`, and problems are reported at their `src/` file and line. |
| Styles | `css_audit.py` | Classes in the styles that nothing uses, `[data-x="…"]` styles for values never set, unused `@keyframes`, and values a later rule with the same selector always overrides. |
| Word help | `../words/test_words.js` | Ask Shelly's offline English, Chinese and Korean answers. |
| Browser | `smoke.js` | Both profiles in a real browser: the 3D board, the crab, tapping fish, opening a deck, the grown-up maths question (wrong answer, Cancel, right answer), a child leaving a deck early, Ask Shelly offline, the Library, and no page errors. |

## Checking that a change didn't change the look

For changes that shouldn't change how anything looks (tidying styles, moving code), take screenshots before and
after and compare them. `snapshots.js` photographs 16 screens (both profiles, day and night: the lobby, the
board, Ask Shelly, the Library, a deck, stats, Edit Mode) with randomness and animation frozen, and records the
computed style of every element. `compare.py` reports any screen or element that differs.

```
python3 -m http.server 8820 &           # serve the version before the change (for example a git worktree)
node tools/check/snapshots.js /tmp/before 8820
# make the change, serve it
node tools/check/snapshots.js /tmp/after 8820
python3 tools/check/compare.py /tmp/before /tmp/after /tmp/diff
```

The practice word on the deck screen is picked at random and can differ between runs; everything else repeats exactly.

## Cleaning up styles

`cssedit.py` edits only the rules it changes and leaves the rest as it is. It works on the built `index.html` and copies the result back into `src/css/`:

- `python3 tools/check/cssedit.py dead` removes values a later identical rule overrides. It keeps a
  property written twice in one rule (the `100vh` / `100dvh` fallback pattern) and anything overridden by a newer
  CSS feature (`dvh`, `color-mix`, `clamp`, `min`, `max`, `env`), which older iPads need.
- `python3 tools/check/cssedit.py unused CLASS …` removes the selectors that use those classes.

After either, run `sh tools/mirror.sh` and compare screenshots as above.

## First-time setup

```
cd tools/check && npm install && npx playwright install chromium
pip install tinycss2 pillow
```

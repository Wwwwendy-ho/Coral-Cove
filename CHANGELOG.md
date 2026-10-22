# Changelog

## Version 33 (October 22, 2026)

- **Ask Shelly:** a new "Ask Shelly" button (Ask Lumi at night) sits in the bottom-left corner once a profile is open. Ask what a word or sentence means, like "What does jjim mean in galbijjim?". Shelly gives a short answer, the parts of the word with what each part means, and an example sentence. Korean parts show Hangul and romanization.
- On a card, two ready-made questions appear: what the word on the card means, and what its parts are. No typing needed.
- "Read it to me" reads the answer aloud. Closing the panel leaves the card exactly where it was.
- Only the question and the card on screen are sent to Claude. Nothing about the profile is sent.
- This needs Claude, so the button appears in the Claude version only. The GitHub copy looks and works the same as before.

## Version 32 (October 22, 2026)

- **Her decks live in the reef:** the deck list is gone from her profile. Each deck is now something in the reef (a brain coral, sea fan, clam, sponge or anemone) on a sandy ledge for its subject: Kelp Library, Number Reef, Coral Garden and so on. Tap it to dive in.
- **Shipwreck at night:** in dark mode the reef becomes a deep-sea shipwreck. Decks are crates, barrels, anchors, ship's wheels, cannons and lanterns in the Captain's Library, Cargo Hold and Crow's Nest.
- **3D depth:** back rows sit higher and smaller, things cast shadows, light rays (or drifting marine snow at night) move across the water, and the far rocks shift slowly as she scrolls.
- The back button reads "Back to the reef" (or "Back to the wreck" at night).
- Calm motion still turns all the movement off.

## Version 31 (October 22, 2026)

- **Drawn places on the map:** the Kelp Library, Number Wreck, Coral Garden, Treasure Reef and Story Bottle are now little illustrated scenes instead of emoji.
- **Playful map:** tapping a fish, coral, shell or star makes it wiggle, bubble and say its name.
- **How far today:** a row of shells under the map heading fills in gold as decks are finished.
- **Shelly on the study screen:** Shelly (Lumi at night) sits on a little seabed under each card, cheers "Yay!" after a right answer and says "Let's look together." after a miss.
- **Splash and pop sounds** for the deck transitions. They follow the sound switch.
- Dark mode: the study screen no longer has a grey glow at the top.

## Version 30 (October 22, 2026)

A new look for her profile, with ideas borrowed from top-rated kids' learning apps.

- **Cove map:** her decks are grouped into places on an underwater map, one per subject: Kelp Library (Reading), Number Wreck (Math), Coral Garden (More) and so on. Each place keeps the same spot every time, shows how many decks are ready, and fills in pearls as decks are finished. Shelly (Lumi at night) suggests where to go next, and the 🔊 button reads it aloud.
- **Silly transitions:** opening a deck plays a quick "Splash!" with Shelly somersaulting past bubbles and fish. Leaving a deck plays a "Pop!" back up to the map.
- **Treasure Reef:** every finished round opens a treasure chest with a new sea friend and a one-line fact, read aloud. She can visit all her sea friends on the Treasure Reef shelf (20 to find).
- **Tutor tip on a miss:** after a wrong answer she sees the right answer, hears it read aloud, and gets one "Next time…" tip that fits the card (count on your fingers, look at the first letter, read one word at a time).
- **No scores or timers in her mode:** the streak and star counters are off her home screen, the round-end screen shows her new sea friend instead of numbers, and "Beat the clock" cards no longer count down.
- **Calm motion:** a new switch in her Settings turns off every animation. The iPad's own Reduce Motion setting does the same.
- **Chunkier look:** bigger, rounder buttons that press down, brighter deck tiles and a softer study screen.
- Fixed: the ⚙️ Settings button in a child profile's Edit Mode now opens Settings.

Grown-up profiles look and work the same as before.

## iPad PIN update (October 22, 2026)

- The child profile opens and starts a session without the PIN. Ending the session, switching profiles mid-session and leaving a deck early still ask for it.
- Grown-up profiles now need the PIN to open from the profile list.
- This applies to the GitHub copy only. The Claude version works as before.

## Version 29 (October 17, 2026)

Copied from the latest Claude artifact. The site's main address now runs this version. Before this, Version 28 was only in the `coral-cove/` folder, so the main address was still on Version 27. Both addresses now show the same version.

New study modes:
- **Hangul Blend:** Korean words built letter by letter into syllable blocks.
- **Echo (shadowing):** hear a phrase, then say it back.
- **Listen & Pick:** hear a word, then pick what it was, with nothing to read first.
- **Mini Story:** picture-story pages. Each sentence is read aloud, and you tap for the meaning.
- **Sentence Builder** and **Word Bank**.
- **Native or Sino?** for Korean number systems, and **Chinese bridge** for hanja cards.

New decks (Wendy): Hangul Blend, Korean Builder, Korean Echo, Korean Hanja, Korean Listening, Korean Numbers, three Mini Stories (coffee, family, rain) and Sound Twins.

Look, sound and access:
- **Natural voice packs:** recorded neural speech for English, Korean and Chinese (the `voice/` folder), used before the device's built-in voice.
- A new underwater home scene, sea-glass deck tiles, cards with real depth and a smoother flip, a swimming-turtle progress bar, and a calm end-of-round celebration.
- Consistent buttons and focus rings in light and dark mode, bigger tap targets, and friendly empty states.
- **Privacy and data:** a privacy screen and a data download.
- Updated recorded pronunciation clips.

Data: decks, cards and progress were re-exported from Claude on October 17. Devices keep their own progress and pick up the new decks the next time they open the app.

### Privacy update (October 17, 2026)
- The student's name is replaced with "Child" in this public copy, and earlier versions in this repository's history were changed the same way. iPads that already have her profile move it, with all its progress, to the new name the next time Coral Cove opens.

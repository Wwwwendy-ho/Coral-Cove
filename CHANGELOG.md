# Changelog

## Ask Shelly word help, offline (October 28, 2026)

- **Ask Shelly works without the internet** for Korean, English and Chinese words. Type a word or a short sentence, or tap a question about the card on screen.
- **English:** what the word means, in simple words, with an example sentence. Over 5,000 common words (and every English word in the decks) have child-friendly definitions; about 20,000 more have a shorter grown-up definition, marked as one. Word forms are understood: "puppies" is a form of "puppy", "running" of "run".
- **Chinese (traditional characters):** pinyin with tone marks and the meaning, then each character with its own meaning and the parts it is built from (好 = 女 woman + 子 child). Sentences are split into words. Simplified characters typed in are shown in traditional.
- **Korean** keeps its word parts and letters, as before.
- The dictionary (about 3 MB) loads the first time Ask Shelly opens and is saved for offline use.

## Library and night fixes (October 27, 2026)

**Music**
- Every place has its own background music, played on real sampled instruments instead of 8-bit synth sounds:
  - **Profile screen:** easy jazz (vibraphone, walking bass, brushes).
  - **Inside decks:** a dreamy harp over a warm pad, quiet and spacious so it sits well under Shelly's voice.
  - **Timed Choice cards:** a kalimba that ticks firmly on every second, started in step with each card's countdown.
  - **Minigames:** a steel-drum tune with marimba, guitar, upright bass and brushed drums.
- The day and night reef songs are softened. The harsh, high 8-bit lead melody is turned down (the 1.5–3 kHz range where it sits, and the buzz above it), with a little more space at night. The tune is unchanged.
- Music starts almost as soon as you tap: songs download in the background from the moment the app opens, instead of after the first tap.
- The app page is much smaller (8.9 MB → 1.4 MB), so it opens faster: the songs and 3D models load from their own files instead of being packed inside it. This also fixes the reef songs, which had been playing older copies packed into the page.
- All the new music is original, made by `tools/compose_music.py`.

**The Library**
- New 📚 Library (button in the top bar), kept off the board:
  - **Tutor:** ask anything, Socratic help, big-question talks, role-plays in Korean, Chinese and English, debates, explain it 3 ways, teach-back, question of the day, and voice input.
  - **Worksheets:** from a deck, maths, a topic, spiral review, word problems from her interests, cloze, handwriting tracing, put in order, label a diagram, or from a photo. Easy, medium or stretch. Checks on screen with step-by-step explanations. Print or save as PDF with an answer key.
  - **Check my work:** writing feedback with rubrics as "two stars and a wish", and photo marking.
  - **My progress:** mastery per deck and maths skill, tricky spots and misconceptions, sure-or-guessing confidence, an adaptive maths placement check, and a weekly letter for grown-ups.
  - **Maths lab:** facts practice, visual models, manipulatives, mental strategies, geometry, clocks and money, and puzzles.
- Works fully offline with built-in algorithms. When online, it uses Claude through an optional helper that a grown-up runs (`tools/claude-proxy-worker.js`), and falls back to offline if the helper can't be reached.

**Title screen**
- Opening the app shows a title screen: a sunny sea with drifting clouds, a palm island, sparkles on the water, light rays, fish and a reef below, and Shelly bobbing at the waterline. At night it's a moonlit sea with stars and glowing jellyfish. "Tap to dive in" plays the dive into the water and starts the music (browsers won't play sound before a first tap, so the music is already playing on the profile screen).
- The dive from the title screen is smooth: the profile screen is built underneath while the title shows, instead of during the dive.

**No more PIN**
- Grown-up screens (opening a grown-up profile, Edit Mode, switching or managing profiles, changing a profile's mode, starting or ending a session, leaving a deck early on a grown-up profile, Library settings) ask a times question instead of a PIN, like 47 × 6. A wrong answer brings a new question, so guessing doesn't help. Leaving a deck early on the child's profile still asks the easy subtraction question.
- The old PIN is no longer stored in the app.

**Fixes**
- The fish on the title screen swim forwards (they were swimming tail-first).
- Shelly no longer covers the hint under a study card (like "Drag the shell all the way to the right" in Sound Blend, or "Tap the card to flip it"). There's room for her below every card, on every profile.

**Day ⇄ night**
- Switching between day and night is a little show: Shelly swims up to the surface and the water drops below the horizon. The sky then plays a sunset (the sun sinks into an orange glow, the stars come out, the moon rises) or a sunrise (the moon sets, the sky turns pink and gold, the sun comes up), and she dives back down into the new board.
- No visible freeze: the board is rebuilt for the new theme while the sky covers the screen, and the dive back down waits until the new board is ready.

**Board**
- Deck names no longer float over the board. Deck tiles stand out on their own instead: a raised gold rim, a white badge behind the deck's emoji, and a gold star once a deck is all done. The treasure map still lists every deck by name.
- Story mode keeps the dice, but it always rolls exactly the number of spaces to today's next deck (or the Story Bottle), so Shelly lands right on it and dives in. There's no die to pick in story mode, and the clam gate lets her through.
- "I Like to Move It" plays only on the child's profile; other profiles get the usual short chime.

**Night shipwreck**
- The camera glides (about two seconds) instead of snapping when it changes view at the stairs, in the hold and on the sand. In the hold it looks down from high above, so the broken deck edge no longer hides Shelly and the path ahead stays in view.
- The camera now shows the sails and the spiral stair down to the hold clearly.
- Branch-path hops arc over the hull instead of through it.
- Fish no longer swim through the sails.
- Fish stay inside the wreck and swim over the deck below them, so they no longer sink into the deck or hull when Shelly steps onto the sand.
- The Story branch, which starts in the hold, runs along the hold wall instead of through the hull.
- Spaces on the sand are spread a full step apart (two overlapped on phones).
- On the sand the camera moves outside the hull. On deck it slides aside when a mast is in the way.
- Ghost lights drift below the sails instead of through them.

## Party board update (October 26, 2026, GitHub copy)

Made on GitHub, not in the Claude version. Syncing from Claude with `tools/sync_from_artifact.py` would overwrite these changes.

**A party board game**
- **Dice:** after she leaves any deck, a dice block appears over Shelly's head. She taps, Shelly jumps up and hits it, then hops that many spaces with the count going down. Before rolling she can pick a die: 1 to 6, Shelly's die (3 or 4), Lumi's die (1 or 7), Kiko's die (0 gives 3 shells), or Double Dice from the shop.
- **Branch paths:** the Treasure Reef and the Story Bottle sit at the ends of side paths. A roll that reaches a fork asks "Which way?". Reaching the end opens that place, and afterwards Shelly hops back to the main path.
- **Shells and the golden pearl:** shells come from plain spaces, from practising and from minigames. A golden pearl sits on a space; passing it with 10 shells trades them for the pearl, and it moves somewhere new. Shells and pearls are saved with each profile.
- **Hermit Crab's Shop:** a shop space sells Double Dice and hats (party hat, flower crown, pirate hat, gold crown) that Shelly and Lumi wear on the board.
- **Chance Time:** pink "!" spaces spin a wheel with silly outcomes.
- **Whirlpools** swirl her to their partner space, and a **clam gate** on the path opens and closes every turn.
- **Minigames:** a short game after each dice turn, with no timers: Card Match (pairs from the deck she just played), Bubble Numbers and Odd Fish Out. The 🎮 corner replays them any time.
- **Story mode:** for profiles with a daily plan, today's plan is the adventure. The next planned deck is the goal, the dice head toward it, and arriving starts it. A switch on the board turns on free play.
- **? spaces** show their prize in the middle of the screen with a ta-da, instead of reading it aloud.

**The boards**
- **Day:** a brighter reef, with vivid coral along the path, seagrass and clownfish around the anemones.
- **Night:** an abandoned shipwreck, a third buried in the sand and listing to one side. The path runs along its deck, then down a half-broken spiral staircase into the cargo hold below. On board: a captain's cabin with glowing windows, a treasure-strewn hold, a pirate flag with a seashell and crossed anchors, an octopus on a mast, drifting jellyfish, ghost lights, glowing portholes and an eel peeking out of the hull.
- **Hops:** livelier, with a crouch, stretch, squash, varied heights and a spinning last leap.
- **Small fixes:**
  - Tapped fish flee in different ways.
  - Bubbles stay put instead of following Shelly.
  - Tiles sit above the sand.
  - Lumi's outline is even.
  - Lanterns glow at night.

**Phones and speed**
- **Layout:**
  - Fits phones in both orientations: no title on the board, smaller corner buttons, and labels that stay clear of the top buttons.
  - Shelly's line is said once and then fades away.
- **Sharper and smoother:**
  - Sharper on phones.
  - Picture quality now steps back up after a slow moment instead of staying blurry.
  - Struggling devices draw quietly at half speed when nothing moves.
  - The board pauses during the dive into a deck.
- **Music:**
  - Streams straight away on this copy.
  - Stops when the app is closed or the phone is locked.
  - "I Like to Move It" plays for longer.
- No more "No decks here" flash when a profile opens.

## Version 99 (October 26, 2026)

The big one: Coral Cove went from a flat, drawn reef to a 3D game board, like a party board game under the sea. This entry covers everything from Version 33 to Version 99.

**The 3D reef board**
- Her decks are now spaces on a winding 3D path across the sea floor, grouped by subject (Kelp Library, Number Reef, Coral Garden…), ending at the Treasure Reef and the Story Bottle. Plain seashell spaces and **? surprise spaces** sit between the decks.
- **Shelly hops along the path** one space at a time to the deck you tap. She waves hello, dives into a deck, cheers with a spin when a deck is finished, giggles when tapped, and does little twirls while she waits. At night the guide is **Lumi** the anglerfish, whose lure lights up the sand.
- **? blocks:** a floating block over every surprise space. Shelly jumps up and bonks it for a burst of coins and sparkles.
- **Kiko the crab** walks along with Shelly and dances at surprises. Tap Kiko to swap between Mochi and Hermit.
- **A living reef:** schools of fish that scatter when tapped, a dolphin swimming past, a whale far off in the haze (a manta ray at night), drifting bubbles, light rays and moving sunlight on the sand. By day there's a coral rock arch; at night a sunken pirate ship with a lantern.
- **Treasure map:** see the whole board from above on parchment and tap a deck to send Shelly there.
- **Day ⇄ night switch:** the camera looks up at the sky while the sun sets and the moon rises (or the other way round), then tilts back down to the new reef.

**The profile lobby**
- The profile picker is a 3D underwater room. Profiles are big game-board coins, Shelly swims around, and Kiko sits at the side.
- **Feed Shelly:** tap the water to drop a food (flakes, a leaf, a shrimp, a jellyfish, or a rare golden star cookie). Shelly swims over and gulps it, and rare foods get a twirl and sparkles.

**Music and sound**
- **Background music:** a day song and a night song that crossfade when you switch. Turn it on or off with the 🎵 button. Hold 🎵 for a second to see a short note on what the music did, for passing on if it won't play.
- **Celebration music** when a deck is finished, plus a soft underwater hum on the board.
- Music keeps playing when the iPad's side switch is set to silent, like Shelly's voice already did.

**While studying**
- **Spoken praise** after a right answer, naming the effort, in every deck type.
- **Celebration bubbles** float up after a right answer. Tap them to pop them.
- **A splash** when she dives into a deck.
- **Leaving a deck early in her mode asks a subtraction question** (like 20 − 15) instead of the PIN.
- **Ask Shelly** (Lumi at night): ask what a word or sentence means and how it's built. Inside Claude it can answer any question. On the GitHub copy it only explains Korean word parts, worked out on the iPad with no internet needed.

**Grown-up profiles** now get the same game board, transitions, music and praise. Grown-up tools are still in Edit Mode.

**Behind the scenes**
- The 3D models are free (CC0) models from Quaternius and Kenney, kept in `reef-models.js` and loaded the first time the board opens.
- Tuned to keep the iPad cool: lighting and shadows are painted onto the scenery once, still parts are merged together, and the board redraws more slowly when nothing is moving.
- The GitHub copy keeps its own `three.min.js` (the 3D engine), so the board works without Wi-Fi. The models, the 3D engine and the celebration music are saved for offline use. The day and night songs are saved the first time each one plays.
- Starting decks re-exported from Claude on October 26, 2026.

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

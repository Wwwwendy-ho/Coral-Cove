import asyncio, json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        page = await browser.new_page(viewport={'width':420,'height':900})
        await page.goto('file:///tmp/claude-0/-home-claude/ed7e931f-d904-5577-9368-13c4f2703985/scratchpad/preview_debug.html')
        await page.wait_for_timeout(300)

        await page.click('[data-act="new-deck"]')
        await page.wait_for_timeout(150)
        await page.click('[data-act="open-add-card"]')
        await page.fill('#cardFront', 'Solo')
        await page.fill('#cardBack', 'Card')
        await page.click('[data-act="save-card"]')
        await page.wait_for_timeout(150)
        await page.click('[data-act="exit-editor"]')
        await page.wait_for_timeout(150)

        # Directly graduate the card by writing state via mem (skip UI for speed) -- simulate several past Good grades already applied,
        # then use the app's own updateCard through UI for the *next* grade we test (Again from review).
        await page.evaluate("""() => {
          const deckId = Object.keys(window.__mem.cards)[0];
          const card = window.__mem.cards[deckId][0];
          Object.assign(card, { state: 'review', interval: 6, ease: 2.5, reps: 3, lapses: 0, due: Date.now() - 1000, isLeech: false });
        }""")

        await page.click('[data-act="study"]')
        await page.wait_for_timeout(150)
        await page.click('#flipCard'); await page.wait_for_timeout(100)
        await page.click('[data-grade="again"]'); await page.wait_for_timeout(150)

        state = await page.evaluate("() => JSON.parse(JSON.stringify(window.__mem.cards))")
        print('--- after Again on a review-state card (interval=6, ease=2.5 beforehand) ---')
        print(json.dumps(state, indent=2))
        print('expected: state=relearning, lapses=1, ease=2.3 (2.5-0.20), due ~10 min out, interval unchanged (still 6, only used again once it re-graduates)')

        # Now graduate it out of relearning with Good -> should return to review w/ interval = LAPSE_MIN_DAYS(1)
        await page.click('#flipCard'); await page.wait_for_timeout(100)
        await page.click('[data-grade="good"]'); await page.wait_for_timeout(150)
        state2 = await page.evaluate("() => JSON.parse(JSON.stringify(window.__mem.cards))")
        print('--- after Good exits relearning ---')
        print(json.dumps(state2, indent=2))
        print('expected: state=review, interval=1 (lapse minimum), ease stays 2.3')

        await browser.close()

asyncio.run(main())

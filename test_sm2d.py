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
        await page.fill('#cardFront', 'Legacy')
        await page.fill('#cardBack', 'Card')
        await page.click('[data-act="save-card"]')
        await page.wait_for_timeout(150)
        await page.click('[data-act="exit-editor"]')
        await page.wait_for_timeout(150)

        # Strip state/learningStep to mimic a card written by the OLD (pre-upgrade) algorithm,
        # already reviewed once under the old scheme (interval=3, ease=2.5, reps=1, no 'state' key at all).
        await page.evaluate("""() => {
          const deckId = Object.keys(window.__mem.cards)[0];
          const card = window.__mem.cards[deckId][0];
          delete card.state; delete card.learningStep;
          Object.assign(card, { interval: 3, ease: 2.5, reps: 1, lapses: 0, due: Date.now() - 1000 });
        }""")
        before = await page.evaluate("() => JSON.parse(JSON.stringify(window.__mem.cards))")
        print('legacy card before grading (no state key):', json.dumps(before, indent=2))

        await page.click('[data-act="study"]')
        await page.wait_for_timeout(150)
        await page.click('#flipCard'); await page.wait_for_timeout(100)
        await page.click('[data-grade="good"]'); await page.wait_for_timeout(150)

        after = await page.evaluate("() => JSON.parse(JSON.stringify(window.__mem.cards))")
        print('--- after grading legacy card "Good" (should infer state=review since interval>0, NOT restart learning steps) ---')
        print(json.dumps(after, indent=2))
        print('expected: interval = round(3*2.5)=7 (or max(4,7)=7), state=review, reps=2 -- i.e. treated as a review card, not sent back through 1min/10min learn steps')

        await browser.close()

asyncio.run(main())

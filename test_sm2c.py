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
        await page.fill('#cardFront', 'Leechy')
        await page.fill('#cardBack', 'Card')
        await page.click('[data-act="save-card"]')
        await page.wait_for_timeout(150)
        await page.click('[data-act="exit-editor"]')
        await page.wait_for_timeout(150)

        await page.evaluate("""() => {
          const deckId = Object.keys(window.__mem.cards)[0];
          const card = window.__mem.cards[deckId][0];
          Object.assign(card, { state: 'review', interval: 6, ease: 1.32, reps: 3, lapses: 7, due: Date.now() - 1000, isLeech: false });
        }""")

        await page.click('[data-act="study"]')
        await page.wait_for_timeout(150)
        await page.click('#flipCard'); await page.wait_for_timeout(100)
        await page.click('[data-grade="again"]'); await page.wait_for_timeout(150)

        state = await page.evaluate("() => JSON.parse(JSON.stringify(window.__mem.cards))")
        print('--- after 8th lapse (ease floor + leech threshold) ---')
        print(json.dumps(state, indent=2))
        print('expected: lapses=8, isLeech=true, ease clamped at 1.3 floor (was 1.32, -0.20 would be 1.12, floor to 1.3)')

        # check UI badge in editor
        await page.click('[data-act="exit-study"]')
        await page.wait_for_timeout(150)
        await page.click('[data-act="edit-deck"]')
        await page.wait_for_timeout(150)
        row_text = await page.inner_text('.card-row')
        print('editor card row text:', row_text)

        await browser.close()

asyncio.run(main())

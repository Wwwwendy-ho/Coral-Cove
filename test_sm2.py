import asyncio, json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        page = await browser.new_page(viewport={'width':420,'height':900})
        await page.goto('file:///tmp/claude-0/-home-claude/ed7e931f-d904-5577-9368-13c4f2703985/scratchpad/preview_debug.html')
        await page.wait_for_timeout(300)

        # --- Deck A: single card, graded Good, Good (should graduate after 2 Goods, ease unchanged) ---
        await page.click('[data-act="new-deck"]')
        await page.wait_for_timeout(150)
        await page.click('[data-act="open-add-card"]')
        await page.fill('#cardFront', 'Solo')
        await page.fill('#cardBack', 'Card')
        await page.click('[data-act="save-card"]')
        await page.wait_for_timeout(150)
        await page.click('[data-act="exit-editor"]')
        await page.wait_for_timeout(150)
        await page.click('[data-act="study"]')
        await page.wait_for_timeout(150)

        await page.click('#flipCard'); await page.wait_for_timeout(100)
        await page.click('[data-grade="good"]'); await page.wait_for_timeout(150)
        state1 = await page.evaluate("() => JSON.parse(JSON.stringify(window.__mem.cards))")
        print('--- after 1st Good (should still be learning, not graduated) ---')
        print(json.dumps(state1, indent=2))

        still_in_study = await page.query_selector('#flipCard')
        print('still showing a study card after 1st Good (expected True, requeued):', still_in_study is not None)

        await page.click('#flipCard'); await page.wait_for_timeout(100)
        await page.click('[data-grade="good"]'); await page.wait_for_timeout(200)
        state2 = await page.evaluate("() => JSON.parse(JSON.stringify(window.__mem.cards))")
        print('--- after 2nd Good (should graduate: state=review, interval=1, ease=2.5) ---')
        print(json.dumps(state2, indent=2))

        summary = await page.query_selector('.summary-card')
        print('summary shown (deck exhausted after graduating):', summary is not None)

        await browser.close()

asyncio.run(main())

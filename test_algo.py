import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        page = await browser.new_page(viewport={'width':420,'height':900})
        await page.goto('file:///tmp/claude-0/-home-claude/ed7e931f-d904-5577-9368-13c4f2703985/scratchpad/preview.html')
        await page.wait_for_timeout(400)

        # Build a 3-card flip deck
        await page.click('[data-act="new-deck"]')
        await page.wait_for_timeout(200)
        for i in range(1,4):
            await page.click('[data-act="open-add-card"]')
            await page.fill('#cardFront', f'Card {i}')
            await page.fill('#cardBack', f'Answer {i}')
            await page.click('[data-act="save-card"]')
            await page.wait_for_timeout(150)

        await page.click('[data-act="exit-editor"]')
        await page.wait_for_timeout(200)

        # capture due badge before studying
        badge_before = await page.inner_text('.deck-badge')
        print('badge before study:', badge_before)

        await page.click('[data-act="study"]')
        await page.wait_for_timeout(200)

        order_seen = []
        async def current_front():
            return (await page.inner_text('.card-text')).strip()

        f1 = await current_front()
        order_seen.append(f1)
        print('1st card shown:', f1)
        # flip then grade "again" on the first card
        await page.click('#flipCard')
        await page.wait_for_timeout(200)
        await page.click('[data-grade="again"]')
        await page.wait_for_timeout(200)

        f2 = await current_front()
        order_seen.append(f2)
        print('2nd card shown:', f2)
        await page.click('#flipCard')
        await page.wait_for_timeout(200)
        await page.click('[data-grade="good"]')
        await page.wait_for_timeout(200)

        f3 = await current_front()
        order_seen.append(f3)
        print('3rd card shown:', f3)
        await page.click('#flipCard')
        await page.wait_for_timeout(200)
        await page.click('[data-grade="good"]')
        await page.wait_for_timeout(200)

        f4 = await current_front()
        order_seen.append(f4)
        print('4th card shown (should be the requeued "again" card):', f4)
        await page.click('#flipCard')
        await page.wait_for_timeout(200)
        await page.click('[data-grade="good"]')
        await page.wait_for_timeout(300)

        # should now be on summary screen
        summary_visible = await page.query_selector('.summary-card')
        print('summary shown:', summary_visible is not None)
        cards_reviewed = await page.inner_text('.summary-stat .num')
        print('cards reviewed count (first stat):', cards_reviewed)

        await page.click('[data-act="back-home"]')
        await page.wait_for_timeout(300)
        badge_after = await page.inner_text('.deck-badge')
        print('badge after finishing session (all due-dates pushed to future):', badge_after)

        # Immediately restart study - due pool is empty (all future), should fall back to full card pool (cram mode)
        await page.click('[data-act="study"]')
        await page.wait_for_timeout(200)
        cram_first = await current_front()
        print('card shown on immediate re-study (cram fallback):', cram_first)

        await browser.close()
        print('ORDER SEEN:', order_seen)

asyncio.run(main())

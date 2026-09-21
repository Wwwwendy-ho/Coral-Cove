import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        page = await browser.new_page()
        errors = []
        page.on('pageerror', lambda exc: errors.append(str(exc)))
        await page.goto('file://' + '/tmp/claude-0/-home-claude/ed7e931f-d904-5577-9368-13c4f2703985/scratchpad/preview5.html')
        await page.wait_for_timeout(400)

        async def pin(digits='1234'):
            for d in digits:
                await page.click(f'[data-digit="{d}"]')
            await page.wait_for_timeout(300)

        await pin(); await pin()
        await page.click('[data-act="ask-start"]'); await page.wait_for_timeout(150); await pin()

        await page.click('[data-act="new-deck"]'); await page.wait_for_timeout(150); await pin()
        # Add 9 flip cards to exceed ROUND_SIZE (6)
        for i in range(9):
            await page.click('[data-act="open-add-card"]'); await page.wait_for_timeout(80)
            await page.fill('#cardFront', f'word{i}')
            await page.fill('#cardBack', f'meaning{i}')
            await page.click('[data-act="save-card"]'); await page.wait_for_timeout(100)
        await page.click('[data-act="exit-editor"]'); await page.wait_for_timeout(200)

        await page.click('[data-act="study"]'); await page.wait_for_timeout(200)
        text = await page.inner_text('#app')
        # count dots in progress track to confirm round size == 6, not 9
        dots = await page.eval_on_selector_all('.progress-track .dot', 'els => els.length')
        print('ROUND DOT COUNT (should be 6):', dots)
        assert dots == 6, dots

        # play through all 6 cards
        for i in range(6):
            text = await page.inner_text('#app')
            if 'Tap the card to flip it' in text:
                await page.click('#flipCard'); await page.wait_for_timeout(200)
                await page.click('[data-outcome="right"]'); await page.wait_for_timeout(250)

        text = await page.inner_text('#app')
        print('=== SUMMARY ===', text[:400])
        assert 'Great swimming' in text
        assert 'Play Again' in text
        assert 'Oops' in text and 'Tricky' in text and 'Got it' in text and 'Easy' in text

        # click play again -> should start a new round
        await page.click('[data-act="play-again"]')
        await page.wait_for_timeout(300)
        dots2 = await page.eval_on_selector_all('.progress-track .dot', 'els => els.length')
        print('ROUND 2 DOT COUNT:', dots2)
        assert dots2 == 3, dots2  # 9 cards - 6 already reviewed this round (still due since same session) -> remaining 3 due, or could differ due to SM2 scheduling
        text = await page.inner_text('#app')
        assert 'Tap the card to flip it' in text or 'Pick the answer' in text or 'read it out loud' in text.lower()

        print('ERRORS:', errors)
        print('PASSED')
        await browser.close()

asyncio.run(main())

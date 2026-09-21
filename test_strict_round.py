import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        page = await browser.new_page()
        errors = []
        page.on('pageerror', lambda exc: errors.append(str(exc)))
        await page.goto('file://' + '/tmp/claude-0/-home-claude/ed7e931f-d904-5577-9368-13c4f2703985/scratchpad/preview6.html')
        await page.wait_for_timeout(400)

        async def pin(digits='1234'):
            for d in digits:
                await page.click(f'[data-digit="{d}"]')
            await page.wait_for_timeout(300)

        await pin(); await pin()
        await page.click('[data-act="ask-start"]'); await page.wait_for_timeout(150); await pin()
        await page.click('[data-act="new-deck"]'); await page.wait_for_timeout(150); await pin()
        for i in range(9):
            await page.click('[data-act="open-add-card"]'); await page.wait_for_timeout(80)
            await page.fill('#cardFront', f'w{i}')
            await page.fill('#cardBack', f'm{i}')
            await page.click('[data-act="save-card"]'); await page.wait_for_timeout(100)
        await page.click('[data-act="exit-editor"]'); await page.wait_for_timeout(200)

        await page.click('[data-act="study"]'); await page.wait_for_timeout(200)
        dots = await page.eval_on_selector_all('.progress-track .dot', 'els => els.length')
        print('INITIAL DOTS:', dots)
        assert dots == 6

        count = 0
        for i in range(6):
            text = await page.inner_text('#app')
            if 'Session complete' in text or 'Great swimming' in text:
                break
            assert 'Tap the card to flip it' in text, text[:200]
            await page.click('#flipCard'); await page.wait_for_timeout(150)
            # answer wrong every time to try to force requeue behavior
            await page.click('[data-outcome="wrong"]'); await page.wait_for_timeout(200)
            count += 1
            dots_now = await page.eval_on_selector_all('.progress-track .dot', 'els => els.length')
            print(f'after answer {count}, dots total:', dots_now)

        text = await page.inner_text('#app')
        print('FINAL STATE:', text[:300])
        assert 'Great swimming' in text
        assert count == 6, count

        print('ERRORS:', errors)
        print('PASSED')
        await browser.close()

asyncio.run(main())

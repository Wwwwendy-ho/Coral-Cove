import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        page = await browser.new_page()
        errors = []
        page.on('pageerror', lambda exc: errors.append(str(exc)))
        await page.goto('file://' + '/tmp/claude-0/-home-claude/ed7e931f-d904-5577-9368-13c4f2703985/scratchpad/preview7.html')
        await page.wait_for_timeout(400)

        async def pin(digits='1234'):
            for d in digits:
                await page.click(f'[data-digit="{d}"]')
            await page.wait_for_timeout(300)

        await pin(); await pin()
        await page.click('[data-act="ask-start"]'); await page.wait_for_timeout(150); await pin()
        await page.click('[data-act="new-deck"]'); await page.wait_for_timeout(150); await pin()
        for i in range(3):
            await page.click('[data-act="open-add-card"]'); await page.wait_for_timeout(80)
            await page.fill('#cardFront', f'w{i}')
            await page.fill('#cardBack', f'm{i}')
            await page.click('[data-act="save-card"]'); await page.wait_for_timeout(100)
        await page.click('[data-act="exit-editor"]'); await page.wait_for_timeout(200)
        await page.click('[data-act="study"]'); await page.wait_for_timeout(200)

        # answer 2 right, 1 wrong
        outcomes = ['right','right','wrong']
        for o in outcomes:
            text = await page.inner_text('#app')
            if 'Great swimming' in text:
                break
            await page.click('#flipCard'); await page.wait_for_timeout(150)
            await page.click(f'[data-outcome="{o}"]'); await page.wait_for_timeout(200)

        text = await page.inner_text('#app')
        print('=== ROUND SUMMARY ===')
        print(text)
        assert 'Stars' not in text
        assert 'RIGHT' in text.upper()
        assert 'ACCURACY' in text.upper()
        assert '2 / 3' in text
        assert '67%' in text

        # end the whole session via PIN to check session results screen too
        await page.click('[data-act="back-home"]')
        await page.wait_for_timeout(200)
        await page.click('[data-act="end-session"]')
        await page.wait_for_timeout(150)
        await pin()
        text = await page.inner_text('#app')
        print('=== SESSION RESULTS ===')
        print(text)
        assert 'Stars' not in text
        assert 'RIGHT' in text.upper() and 'ACCURACY' in text.upper()

        print('ERRORS:', errors)
        print('PASSED')
        await browser.close()

asyncio.run(main())

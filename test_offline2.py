import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        page = await browser.new_page()
        errors = []
        page.on('pageerror', lambda exc: errors.append(str(exc)))
        await page.goto('file:///mnt/user-data/outputs/coral-cove-offline.html')
        await page.wait_for_timeout(500)
        text = await page.inner_text('#app')
        assert 'Create a Parent PIN' in text

        async def pin(digits='1234'):
            for d in digits:
                await page.click(f'[data-digit="{d}"]')
            await page.wait_for_timeout(300)

        await pin(); await pin()
        await page.click('[data-act="ask-start"]'); await page.wait_for_timeout(150); await pin()
        await page.wait_for_timeout(300)
        text = await page.inner_text('#app')
        # Only math-0 and math-1 should be visible to the student — everything else starts archived.
        assert 'Splash Sight Words' not in text, "archived deck visible to student"
        assert '0 + ___' in text and '1 + ___' in text
        assert '10 cards' in text

        # study the 0 + ___ deck, confirm round size is 6 (critter progress bar, not the old dots)
        await page.click('[data-act="study"] >> nth=0')
        await page.wait_for_timeout(300)
        label = await page.inner_text('.critter-label')
        assert 'of 6' in label, label

        print('ERRORS:', errors)
        print('PASSED')
        await browser.close()

asyncio.run(main())

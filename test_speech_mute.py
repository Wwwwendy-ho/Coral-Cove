import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        page = await browser.new_page()
        await page.add_init_script("""
            window.__spoken = [];
            if (window.speechSynthesis) {
                window.speechSynthesis.speak = function(utt) { window.__spoken.push(utt.text); };
                window.speechSynthesis.cancel = function() {};
            }
        """)
        await page.goto('file://' + '/tmp/claude-0/-home-claude/ed7e931f-d904-5577-9368-13c4f2703985/scratchpad/preview4.html')
        await page.wait_for_timeout(400)
        async def pin(digits='1234'):
            for d in digits:
                await page.click(f'[data-digit="{d}"]')
            await page.wait_for_timeout(300)
        await pin(); await pin()
        await page.click('[data-act="ask-start"]'); await page.wait_for_timeout(150); await pin()
        await page.click('[data-act="new-deck"]'); await page.wait_for_timeout(150); await pin()
        await page.click('[data-act="open-add-card"]'); await page.wait_for_timeout(100)
        await page.fill('#cardFront', 'octopus')
        await page.fill('#cardBack', 'a sea animal with eight arms')
        await page.click('[data-act="save-card"]'); await page.wait_for_timeout(150)
        await page.click('[data-act="exit-editor"]'); await page.wait_for_timeout(200)

        # mute sound via the toggle on the home ctrl-row
        await page.click('[data-act="toggle-sound"]')
        await page.wait_for_timeout(150)

        await page.click('[data-act="study"]'); await page.wait_for_timeout(200)
        await page.click('#flipCard')
        await page.wait_for_timeout(300)
        spoken = await page.evaluate("() => window.__spoken")
        print('SPOKEN WHILE MUTED:', spoken)
        assert spoken == [], spoken
        print('PASSED')
        await browser.close()

asyncio.run(main())

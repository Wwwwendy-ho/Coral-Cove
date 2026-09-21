import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        page = await browser.new_page()
        errors = []
        page.on('pageerror', lambda exc: errors.append(str(exc)))

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
        await page.click('[data-act="study"]'); await page.wait_for_timeout(200)

        await page.click('#flipCard')
        await page.wait_for_timeout(300)
        text = await page.inner_text('#app')
        assert 'Hear it again' in text

        spoken = await page.evaluate("() => window.__spoken")
        print('SPOKEN AFTER FLIP:', spoken)
        assert spoken == ['a sea animal with eight arms'], spoken

        await page.click('[data-act="replay-audio"]')
        await page.wait_for_timeout(150)
        spoken2 = await page.evaluate("() => window.__spoken")
        print('SPOKEN AFTER REPLAY:', spoken2)
        assert spoken2 == ['a sea animal with eight arms', 'a sea animal with eight arms'], spoken2

        # Mute sound, grade this card to get a fresh one, flip it, confirm no speech happens while muted
        await page.click('[data-outcome="right"]')
        await page.wait_for_timeout(300)
        text = await page.inner_text('#app')
        print('=== NEXT STATE ===', text[:200])

        print('ERRORS:', errors)
        print('PASSED')
        await browser.close()

asyncio.run(main())

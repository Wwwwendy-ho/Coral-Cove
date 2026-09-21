import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        page = await browser.new_page()
        errors = []
        page.on('pageerror', lambda exc: errors.append(f'PAGEERROR: {exc}'))
        await page.goto('file://' + '/tmp/claude-0/-home-claude/ed7e931f-d904-5577-9368-13c4f2703985/scratchpad/preview3.html')
        await page.wait_for_timeout(400)

        async def pin(digits='1234'):
            for d in digits:
                await page.click(f'[data-digit="{d}"]')
            await page.wait_for_timeout(300)

        await pin(); await pin()
        await page.click('[data-act="ask-start"]')
        await page.wait_for_timeout(150)
        await pin()

        # --- Create a deck with a flip card, a choice card, and a read card ---
        await page.click('[data-act="new-deck"]')
        await page.wait_for_timeout(150)
        await pin()

        async def add_card(mode, front, back=None, choices=None, note=None):
            await page.click('[data-act="open-add-card"]')
            await page.wait_for_timeout(100)
            if mode != 'flip':
                await page.click(f'[data-mode="{mode}"]')
                await page.wait_for_timeout(100)
            await page.fill('#cardFront', front)
            if mode in ('flip','choice'):
                await page.fill('#cardBack', back)
            if mode == 'choice':
                await page.fill('#cardChoices', choices)
            if mode == 'read' and note:
                await page.fill('#cardNote', note)
            await page.click('[data-act="save-card"]')
            await page.wait_for_timeout(150)

        await add_card('flip', 'octopus', 'a sea animal with 8 arms')
        await add_card('choice', '2 + 2', '4', '3, 5, 6')
        await add_card('read', 'seahorse')
        await page.click('[data-act="exit-editor"]')
        await page.wait_for_timeout(200)

        await page.click('[data-act="study"]')
        await page.wait_for_timeout(200)

        # Go through 3 cards, whichever order they were shuffled in, using outcome/choice as appropriate
        for i in range(3):
            text = await page.inner_text('#app')
            print(f'--- CARD {i} ---')
            print(text[:200])
            if 'Tap the card to flip it' in text:
                await page.click('#flipCard')
                await page.wait_for_timeout(200)
                text2 = await page.inner_text('#app')
                assert 'did you get it right' in text2.lower()
                await page.click('[data-outcome="right"]')
                await page.wait_for_timeout(250)
            elif 'Pick the answer' in text or 'pick the answer' in text.lower():
                await page.click('[data-choice-idx="0"]')
                await page.wait_for_timeout(200)
                text2 = await page.inner_text('#app')
                print('choice feedback:', text2[:250])
                assert 'grade-again' not in text2  # no manual grade buttons should exist
                await page.wait_for_timeout(1200)  # wait for auto-advance
            elif 'read it out loud' in text.lower():
                await page.wait_for_timeout(200)
                text2 = await page.inner_text('#app')
                assert 'did they read it right' in text2.lower()
                await page.click('[data-outcome="right"]')
                await page.wait_for_timeout(250)
            else:
                print('UNEXPECTED STATE:', text[:300])
                raise Exception('unrecognized card state')

        text = await page.inner_text('#app')
        print('=== AFTER 3 CARDS ===', text[:300])
        assert 'Session complete' not in text  # summary screen (old flow) shouldn't matter; just check no crash

        print('ERRORS:', errors)
        print('PASSED')
        await browser.close()

asyncio.run(main())

async def drain():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        page = await browser.new_page()
        errors = []
        page.on('pageerror', lambda exc: errors.append(str(exc)))
        await page.goto('file://' + '/tmp/claude-0/-home-claude/ed7e931f-d904-5577-9368-13c4f2703985/scratchpad/preview3.html')
        await page.wait_for_timeout(400)
        async def pin(digits='1234'):
            for d in digits:
                await page.click(f'[data-digit="{d}"]')
            await page.wait_for_timeout(300)
        await pin(); await pin()
        await page.click('[data-act="ask-start"]'); await page.wait_for_timeout(150); await pin()
        await page.click('[data-act="new-deck"]'); await page.wait_for_timeout(150); await pin()
        await page.click('[data-act="open-add-card"]'); await page.wait_for_timeout(100)
        await page.fill('#cardFront', 'hi'); await page.fill('#cardBack', 'hello')
        await page.click('[data-act="save-card"]'); await page.wait_for_timeout(150)
        await page.click('[data-act="exit-editor"]'); await page.wait_for_timeout(200)
        await page.click('[data-act="study"]'); await page.wait_for_timeout(200)
        for i in range(8):
            text = await page.inner_text('#app')
            if 'Session complete' in text or 'Great swimming' in text:
                print('FINISHED at iter', i, text[:250]); break
            if 'Tap the card to flip it' in text:
                await page.click('#flipCard'); await page.wait_for_timeout(200)
                await page.click('[data-outcome="right"]'); await page.wait_for_timeout(250)
            else:
                print('unexpected', text[:200]); break
        print('ERRORS', errors)
        await browser.close()

asyncio.run(drain())

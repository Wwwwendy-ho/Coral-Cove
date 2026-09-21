import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        page = await browser.new_page()
        errors = []
        page.on('pageerror', lambda exc: errors.append(f'PAGEERROR: {exc}'))
        await page.goto('file://' + '/tmp/claude-0/-home-claude/ed7e931f-d904-5577-9368-13c4f2703985/scratchpad/preview2.html')
        await page.wait_for_timeout(400)

        async def pin(digits='1234'):
            for d in digits:
                await page.click(f'[data-digit="{d}"]')
            await page.wait_for_timeout(350)

        await pin(); await pin()  # setup + confirm
        await page.click('[data-act="ask-start"]')
        await page.wait_for_timeout(150)
        await pin()  # start session

        # Create deck + choice card
        await page.click('[data-act="new-deck"]')
        await page.wait_for_timeout(150)
        await pin()  # edit gate
        await page.click('[data-act="open-add-card"]')
        await page.wait_for_timeout(100)
        await page.click('[data-mode="choice"]')
        await page.wait_for_timeout(100)
        await page.fill('#cardFront', '2 + 2')
        await page.fill('#cardBack', '4')
        await page.fill('#cardChoices', '3, 5, 6')
        await page.click('[data-act="save-card"]')
        await page.wait_for_timeout(150)
        await page.click('[data-act="exit-editor"]')
        await page.wait_for_timeout(200)

        await page.click('[data-act="study"]')
        await page.wait_for_timeout(200)
        text = await page.inner_text('#app')
        assert '2 + 2' in text
        assert 'Pick the answer' in text

        # click first choice option (whatever it is)
        await page.click('[data-choice-idx="0"]')
        await page.wait_for_timeout(200)
        text = await page.inner_text('#app')
        print('=== AFTER CHOICE PICK ===', text[:250])

        # grade "again" - card should stay in the queue (learning state)
        await page.click('[data-grade="again"]')
        await page.wait_for_timeout(200)
        text = await page.inner_text('#app')
        print('=== AFTER AGAIN ===', text[:150])
        assert '2 + 2' in text  # still showing since re-queued

        # this time answer correctly by checking DOM for correct class then click grade good regardless
        # just grade it out via multiple more attempts loop until queue empties (max 6 tries)
        for i in range(6):
            t = await page.inner_text('#app')
            if 'Session complete' in t or "resting" in t:
                break
            if 'Pick the answer' in t:
                await page.click('[data-choice-idx="0"]')
                await page.wait_for_timeout(150)
            grade_btns = await page.query_selector_all('[data-grade]')
            if grade_btns:
                await page.click('[data-grade="easy"]')
                await page.wait_for_timeout(150)
        text = await page.inner_text('#app')
        print('=== AFTER LOOP ===', text[:200])

        # end session
        await page.click('[data-act="end-session"]')
        await page.wait_for_timeout(150)
        await pin()
        text = await page.inner_text('#app')
        print('=== RESULTS ===', text[:300])
        assert 'Session complete' in text

        print('ERRORS:', errors)
        print('PASSED')
        await browser.close()

asyncio.run(main())

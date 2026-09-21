import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        page = await browser.new_page(viewport={'width':420,'height':900})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await page.goto('file:///tmp/claude-0/-home-claude/ed7e931f-d904-5577-9368-13c4f2703985/scratchpad/preview.html')
        await page.wait_for_timeout(500)

        # Create a new deck
        await page.click('[data-act="new-deck"]')
        await page.wait_for_timeout(300)

        # Open add card form
        await page.click('[data-act="open-add-card"]')
        await page.wait_for_timeout(200)

        # Switch to choice mode
        await page.click('[data-mode="choice"]')
        await page.wait_for_timeout(200)
        await page.screenshot(path='shot_editor_choice_form.png')

        # Fill fields
        await page.fill('#cardFront', '5 + 3')
        await page.fill('#cardBack', '8')
        await page.fill('#cardChoices', '7, 9, 6')
        await page.click('[data-act="save-card"]')
        await page.wait_for_timeout(300)
        await page.screenshot(path='shot_editor_card_row.png')

        # Go home and study
        await page.click('[data-act="exit-editor"]')
        await page.wait_for_timeout(300)
        await page.click('[data-act="study"]')
        await page.wait_for_timeout(300)
        await page.screenshot(path='shot_study_choice_unanswered.png')

        # Click a wrong choice (find one that's not index for correct maybe random - click first choice btn)
        btns = await page.query_selector_all('.choice-btn')
        print('num choice buttons', len(btns))
        await btns[0].click()
        await page.wait_for_timeout(300)
        await page.screenshot(path='shot_study_choice_answered.png')

        print('console/page errors:', errors)
        await browser.close()

asyncio.run(main())

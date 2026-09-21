import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        page = await browser.new_page(viewport={'width':420,'height':900})
        await page.goto('file:///tmp/claude-0/-home-claude/ed7e931f-d904-5577-9368-13c4f2703985/scratchpad/preview.html')
        await page.wait_for_timeout(400)
        await page.click('[data-act="new-deck"]')
        await page.wait_for_timeout(200)
        await page.click('[data-act="open-add-card"]')
        await page.click('[data-mode="choice"]')
        await page.fill('#cardFront', '5 + 3')
        await page.fill('#cardBack', '8')
        await page.fill('#cardChoices', '7, 9, 6')
        await page.click('[data-act="save-card"]')
        await page.wait_for_timeout(200)
        await page.click('[data-act="exit-editor"]')
        await page.wait_for_timeout(200)
        await page.click('[data-act="study"]')
        await page.wait_for_timeout(200)
        # find a button whose text is NOT '8' and click it
        btns = await page.query_selector_all('.choice-btn')
        for b in btns:
            t = await b.inner_text()
            if t.strip() != '8':
                await b.click()
                break
        await page.wait_for_timeout(200)
        await page.screenshot(path='shot_study_choice_wrong.png')

        # test grading resets choiceState for next card (add second choice card first) - skip, just click a grade btn
        await page.click('[data-grade="good"]')
        await page.wait_for_timeout(200)
        await page.screenshot(path='shot_study_after_grade.png')
        await browser.close()

asyncio.run(main())

import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        page = await browser.new_page(viewport={'width':420,'height':900})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto('file:///tmp/claude-0/-home-claude/ed7e931f-d904-5577-9368-13c4f2703985/scratchpad/coral-cove-offline.html')
        await page.wait_for_timeout(400)
        has_favicon = await page.eval_on_selector('link[rel="icon"]', 'el => !!el.href && el.href.startsWith("data:image/png")')
        print('favicon link present and valid data URI:', has_favicon)
        deck_count = await page.eval_on_selector_all('.deck-card', 'els => els.length')
        print('decks still render fine:', deck_count)
        print('page errors:', errors)
        await browser.close()

asyncio.run(main())

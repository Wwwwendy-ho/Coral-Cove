import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        page = await browser.new_page()
        errors = []
        page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
        page.on('pageerror', lambda exc: errors.append(f'PAGEERROR: {exc}'))
        await page.goto('file://' + '/tmp/claude-0/-home-claude/ed7e931f-d904-5577-9368-13c4f2703985/scratchpad/preview2.html')
        await page.wait_for_timeout(500)

        # Should show PIN setup (first run, mem store, no pin yet)
        text = await page.inner_text('#app')
        print('=== INITIAL ===')
        print(text[:200])
        assert 'Create a Parent PIN' in text, "expected PIN setup screen"

        # Step 1: enter 1234
        for d in ['1','2','3','4']:
            await page.click(f'[data-digit="{d}"]')
        await page.wait_for_timeout(400)
        text = await page.inner_text('#app')
        print('=== AFTER STEP1 ===', text[:100])
        assert 'Confirm your PIN' in text

        # Step 2: enter 1234 again (confirm)
        for d in ['1','2','3','4']:
            await page.click(f'[data-digit="{d}"]')
        await page.wait_for_timeout(400)
        text = await page.inner_text('#app')
        print('=== AFTER CONFIRM ===', text[:150])
        assert 'Coral Cove is resting' in text, "expected locked screen after pin setup"

        # Start session
        await page.click('[data-act="ask-start"]')
        await page.wait_for_timeout(200)
        text = await page.inner_text('#app')
        assert 'Start Session' in text
        for d in ['1','2','3','4']:
            await page.click(f'[data-digit="{d}"]')
        await page.wait_for_timeout(400)
        text = await page.inner_text('#app')
        print('=== AFTER START PIN ===', text[:200])
        assert 'Coral Cove' in text and 'New Deck' in text, "expected home screen unlocked"

        # Create a deck -> should require edit PIN
        await page.click('[data-act="new-deck"]')
        await page.wait_for_timeout(200)
        text = await page.inner_text('#app')
        print('=== AFTER NEW DECK CLICK ===', text[:150])
        assert 'Parent PIN' in text, "expected edit PIN gate"
        for d in ['1','2','3','4']:
            await page.click(f'[data-digit="{d}"]')
        await page.wait_for_timeout(300)
        text = await page.inner_text('#app')
        print('=== AFTER EDIT PIN ===', text[:200])
        assert 'Add a card' in text or 'add a card' in text.lower()

        # Add a flip card
        await page.click('[data-act="open-add-card"]')
        await page.wait_for_timeout(150)
        await page.fill('#cardFront', 'octopus')
        await page.fill('#cardBack', 'a sea animal with 8 arms')
        await page.click('[data-act="save-card"]')
        await page.wait_for_timeout(200)

        # Go back home
        await page.click('[data-act="exit-editor"]')
        await page.wait_for_timeout(300)
        text = await page.inner_text('#app')
        print('=== HOME AFTER ADD CARD ===', text[:300])

        # Study the deck
        await page.click('[data-act="study"]')
        await page.wait_for_timeout(300)
        text = await page.inner_text('#app')
        print('=== STUDY VIEW ===', text[:200])
        assert 'octopus' in text

        # flip card
        await page.click('#flipCard')
        await page.wait_for_timeout(300)
        text = await page.inner_text('#app')
        print('=== FLIPPED ===', text[:250])
        assert 'How did you do' in text

        # grade good
        await page.click('[data-grade="good"]')
        await page.wait_for_timeout(300)
        text = await page.inner_text('#app')
        print('=== AFTER GRADE ===', text[:200])

        # End session via lock icon
        await page.click('[data-act="end-session"]')
        await page.wait_for_timeout(200)
        text = await page.inner_text('#app')
        assert 'End Session' in text
        for d in ['1','2','3','4']:
            await page.click(f'[data-digit="{d}"]')
        await page.wait_for_timeout(400)
        text = await page.inner_text('#app')
        print('=== SESSION RESULTS ===', text[:400])
        assert 'Session complete' in text
        assert '1' in text  # 1 card reviewed

        # Done -> locked
        await page.click('[data-act="done"]')
        await page.wait_for_timeout(200)
        text = await page.inner_text('#app')
        print('=== BACK TO LOCKED ===', text[:150])
        assert 'Coral Cove is resting' in text

        # Test wrong pin
        await page.click('[data-act="ask-start"]')
        await page.wait_for_timeout(200)
        for d in ['9','9','9','9']:
            await page.click(f'[data-digit="{d}"]')
        await page.wait_for_timeout(400)
        text = await page.inner_text('#app')
        print('=== WRONG PIN ===', text[:200])
        assert "not it" in text.lower()

        # cancel
        await page.click('[data-act="pin-cancel"]')
        await page.wait_for_timeout(200)
        text = await page.inner_text('#app')
        assert 'Coral Cove is resting' in text

        print('=== CONSOLE ERRORS ===', errors)
        print('ALL ASSERTIONS PASSED')
        await browser.close()

asyncio.run(main())

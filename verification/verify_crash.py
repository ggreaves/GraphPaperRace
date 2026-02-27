import os
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Get absolute path to index.html
        cwd = os.getcwd()
        file_path = f"file://{cwd}/index.html"

        print(f"Loading {file_path}")
        page.goto(file_path)

        # Trigger crash
        print("Triggering crash...")
        page.evaluate("""
            player.crashed = true;
            checkGameEnd();
        """)

        # Wait for game over message
        page.wait_for_selector("#game-over-message")

        # Get text
        message = page.inner_text("#game-over-message")
        print(f"Game over message: '{message}'")

        if message == "You crashed":
            print("SUCCESS: Message is correct.")
        else:
            print("FAILURE: Message is incorrect.")

        # Screenshot
        page.screenshot(path="verification/crash_message.png")
        print("Screenshot saved to verification/crash_message.png")

        browser.close()

if __name__ == "__main__":
    run()

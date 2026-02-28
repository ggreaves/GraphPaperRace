const { test, expect } = require('@playwright/test');
const path = require('path');

test('Verify Game Infrastructure', async ({ page }) => {
    // 1. Load the game
    await page.goto('file://' + path.resolve(__dirname, 'index.html'));

    // Wait for canvas
    const canvas = page.locator('#gameCanvas');
    await expect(canvas).toBeVisible();

    // Ensure rendering is ready - slight delay or wait for selector
    await page.waitForTimeout(500);

    // 2. Initial Screenshot (Start Position) - Full page to see context
    await page.screenshot({ path: 'verification_initial.png', fullPage: true });
    console.log('Took initial screenshot');

    // 3. Pan Camera (Drag)
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas bounding box not found");

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    // Drag camera
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 200, startY); // Drag Left
    await page.mouse.up();

    await page.waitForTimeout(200); // Wait for draw

    // 4. Panned Screenshot
    await page.screenshot({ path: 'verification_panned.png', fullPage: true });
    console.log('Took panned screenshot');

    // 5. Click to Move (Player Move)
    await page.mouse.click(startX, startY);

    await page.waitForTimeout(200); // Wait for update

    // 6. Move Screenshot
    await page.screenshot({ path: 'verification_moved.png', fullPage: true });
    console.log('Took moved screenshot');
});

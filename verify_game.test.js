const { test, expect } = require('@playwright/test');
const path = require('path');

test('Verify Game Infrastructure', async ({ page }) => {
    // 1. Load the game
    await page.goto('file://' + path.resolve(__dirname, 'index.html'));

    // Wait for canvas
    const canvas = page.locator('#gameCanvas');
    await expect(canvas).toBeVisible();

    // 2. Initial Screenshot (Start Position)
    await page.screenshot({ path: 'verification_initial.png' });
    console.log('Took initial screenshot');

    // 3. Pan Camera (Drag)
    // Perform mouse drag on canvas
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas bounding box not found");

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    // Drag from center to left (should move camera right, or vice versa depending on logic)
    // Implementation logic: newCamX = cameraStart.x - dx
    // If I drag mouse LEFT (dx < 0), newCamX increases. Camera moves right. View moves left.
    // If I drag mouse RIGHT (dx > 0), newCamX decreases. Camera moves left. View moves right.
    // Let's drag RIGHT (dx > 0) to pan left. But we start at left edge mostly?
    // Player is at x=1400. Canvas is 1000. Camera centers on player approx x=900.
    // Max Cam X = 3000 - 1000 = 2000.
    // Current Cam X ~ 900.
    // Drag Mouse LEFT (-100px). dx = -100. newCamX = 900 - (-100) = 1000.
    // Camera moves RIGHT (+X). View moves LEFT.

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 200, startY); // Drag Left
    await page.mouse.up();

    // 4. Panned Screenshot
    await page.screenshot({ path: 'verification_panned.png' });
    console.log('Took panned screenshot');

    // 5. Click to Move (Player Move)
    // We need to click a valid move.
    // Player is stopped. Valid moves are adjacent grid points.
    // Player at grid (68, 95). Valid: (69, 95), (69, 94), etc.
    // (69, 95) is to the right.
    // In screen space?
    // We panned the camera. We need to click relative to viewport.
    // This is hard to calculate exactly without querying internal state,
    // but we can try to click near the center where the player was, slightly offset.
    // Actually, dragging the mouse left moved the camera right.
    // So the player (who was centered) is now to the LEFT of center on screen.
    // If we click center, we are clicking to the right of the player.
    // This might be a valid move (accelerating right).

    await page.mouse.click(startX, startY);

    // 6. Move Screenshot
    await page.screenshot({ path: 'verification_moved.png' });
    console.log('Took moved screenshot');
});

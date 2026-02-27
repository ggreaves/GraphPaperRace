// Mock DOM environment for Canvas and other browser APIs
document.body.innerHTML = `
  <canvas id="gameCanvas" width="1000" height="800"></canvas>
  <div id="game-over-overlay" class="overlay hidden">
      <h2 id="game-over-message">You Crashed!</h2>
      <button id="play-again-btn">Try Again</button>
  </div>
  <div id="p1-speed"></div>
  <div id="lap-count"></div>
  <button id="restart-btn"></button>
  <button id="play-again-btn"></button>
`;

// Mock Canvas API
HTMLCanvasElement.prototype.getContext = () => ({
    clearRect: jest.fn(),
    fillStyle: '',
    fill: jest.fn(),
    strokeStyle: '',
    lineWidth: 0,
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    shadowBlur: 0,
    shadowColor: '',
    setLineDash: jest.fn(),
    arc: jest.fn(),
    isPointInPath: jest.fn(() => false), // Default to no collision
});

// Mock Path2D
global.Path2D = class {
    moveTo() {}
    bezierCurveTo() {}
    addPath() {}
};

const { checkStartFinish, lineIntersect } = require('./script.js');

describe('lineIntersect', () => {
    test('should return true for intersecting lines', () => {
        // Line 1: (0,0) to (10,10)
        // Line 2: (0,10) to (10,0)
        // Intersection at (5,5)
        expect(lineIntersect(0, 0, 10, 10, 0, 10, 10, 0)).toBe(true);
    });

    test('should return false for parallel lines', () => {
        // Line 1: (0,0) to (10,0)
        // Line 2: (0,5) to (10,5)
        expect(lineIntersect(0, 0, 10, 0, 0, 5, 10, 5)).toBe(false);
    });

    test('should return false for non-intersecting segments', () => {
        // Line 1: (0,0) to (5,5)
        // Line 2: (6,6) to (10,10)
        // Collinear but disjoint
        expect(lineIntersect(0, 0, 5, 5, 6, 6, 10, 10)).toBe(false);
    });
});

describe('checkStartFinish', () => {
    // The finish line is at x=500.
    // Inner boundary y=550, Outer boundary y=700.
    // FL segment: (500, 550) to (500, 700)
    // squareSize is 20.

    // Helper to convert grid coordinates to pixel coordinates
    const toPx = (val) => val * 20;

    test('should return true when crossing the finish line within bounds', () => {
        // Moving from left to right across x=500
        // Old: x=26 (520px), y=30 (600px) - Note: standard movement is Right-to-Left or similar depending on track direction?
        // Wait, the finish line logic in the game checks intersection.
        // Let's check crossing from x=26 (520px) to x=24 (480px) at y=30 (600px).
        // 520 > 500 and 480 < 500.
        // Y=600 is between 550 and 700.

        const oldGX = 26; // 520px
        const oldGY = 30; // 600px
        const newGX = 24; // 480px
        const newGY = 30; // 600px

        expect(checkStartFinish(oldGX, oldGY, newGX, newGY)).toBe(true);
    });

    test('should return true when crossing from right to left (standard lap direction)', () => {
         // Moving from Left to Right (e.g. 480 -> 520) would also intersect the line segment geometrically.
         // The direction logic is handled in the click handler (oX > p.x || oX * squareSize > FL_X1).
         // checkStartFinish only checks intersection.

        const oldGX = 24; // 480px
        const oldGY = 30; // 600px
        const newGX = 26; // 520px
        const newGY = 30; // 600px

        expect(checkStartFinish(oldGX, oldGY, newGX, newGY)).toBe(true);
    });

    test('should return false when moving parallel to the finish line', () => {
        // Moving vertically at x=480 (Left of FL)
        const oldGX = 24;
        const oldGY = 30;
        const newGX = 24;
        const newGY = 31;

        expect(checkStartFinish(oldGX, oldGY, newGX, newGY)).toBe(false);
    });

    test('should return false when crossing x=500 but outside y-bounds (above inner track)', () => {
        // Y < 550 (e.g. 500px -> 25 grid units)
        const oldGX = 26; // 520px
        const oldGY = 20; // 400px (Above FL_Y1=550)
        const newGX = 24; // 480px
        const newGY = 20; // 400px

        expect(checkStartFinish(oldGX, oldGY, newGX, newGY)).toBe(false);
    });

    test('should return false when crossing x=500 but outside y-bounds (below outer track)', () => {
        // Y > 700 (e.g. 800px -> 40 grid units)
        const oldGX = 26; // 520px
        const oldGY = 38; // 760px (Below FL_Y2=700)
        const newGX = 24; // 480px
        const newGY = 38; // 760px

        expect(checkStartFinish(oldGX, oldGY, newGX, newGY)).toBe(false);
    });

    test('should return true when crossing diagonally through the finish line', () => {
        // Old: (520, 580)
        // New: (480, 620)
        // Line passes through x=500 at y=600, which is valid.
        const oldGX = 26;
        const oldGY = 29;
        const newGX = 24;
        const newGY = 31;

        expect(checkStartFinish(oldGX, oldGY, newGX, newGY)).toBe(true);
    });
});

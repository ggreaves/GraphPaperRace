const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const squareSize = 20;

const COLS = canvas.width / squareSize; // 50
const ROWS = canvas.height / squareSize; // 40

// --- Freehand Track Definition ---
// We will define an outer boundary and an inner boundary using Canvas Path2D
// The "trackArea" is the area inside the outer path, EXCLUDING the area inside the inner path.
// The easiest way is to use `fillRule: 'evenodd'` and draw both boundaries in opposite directions,
// but Canvas `isPointInPath` can use 'evenodd' natively if we combine paths.

const trackOuterPath = new Path2D();
trackOuterPath.moveTo(200, 100);
trackOuterPath.bezierCurveTo(600, 100, 900, 100, 900, 400); // Top straight + Right Turn
trackOuterPath.bezierCurveTo(900, 500, 800, 700, 500, 700); // Bottom Right curves
trackOuterPath.bezierCurveTo(300, 700, 100, 600, 100, 400); // Left Hairpin
trackOuterPath.bezierCurveTo(100, 150, 100, 100, 200, 100); // Connect back

const trackInnerPath = new Path2D();
// Draw inside the outer track, forming a closed loop
trackInnerPath.moveTo(300, 250);
trackInnerPath.bezierCurveTo(600, 250, 750, 250, 750, 400);
trackInnerPath.bezierCurveTo(750, 500, 700, 550, 500, 550);
trackInnerPath.bezierCurveTo(400, 550, 250, 500, 250, 400);
trackInnerPath.bezierCurveTo(250, 300, 250, 250, 300, 250);

// The combined track Path2D for easy point-in-path 'evenodd' checking.
// Outer path is clockwise, inner path is counter-clockwise.
const trackPath = new Path2D();
trackPath.addPath(trackOuterPath);
trackPath.addPath(trackInnerPath);


// Start / Finish Line Segment
// Placed on the bottom straight section, spanning from outer to inner boundary mathematically.
const FL_X1 = 500;
const FL_Y1 = 550; // Inner boundary
const FL_X2 = 500;
const FL_Y2 = 700; // Outer boundary

let player;
let gameState = 'playing'; // 'playing', 'gameover'
let possibleMoves = [];
let hoveredMove = null;

function initGame() {
    // Starting position: Grid coordinates slightly before the finish line
    // The finish line is at x=500 (cx=25). We'll start at cx=22, cy=31.
    player = {
        id: 0,
        x: 22, y: 31,
        vx: 0, vy: 0,
        path: [{ x: 22, y: 31 }],
        crashed: false,
        finished: false,
        hasStarted: false,
        laps: 0,
        color: '#00ffaa',
        glow: '#00ffaa'
    };

    gameState = 'playing';
    hoveredMove = null;

    document.getElementById('game-over-overlay').classList.add('hidden');
    updateUI();
    calculatePossibleMoves();
    draw();
}

function calculatePossibleMoves() {
    possibleMoves = [];
    if (gameState !== 'playing') return;

    const p = player;
    if (p.crashed || p.finished) return;

    const currentVx = p.vx;
    const currentVy = p.vy;

    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const newVx = currentVx + dx;
            const newVy = currentVy + dy;

            const newX = p.x + newVx;
            const newY = p.y + newVy;

            // Screen bounds
            if (newX >= 0 && newX <= COLS && newY >= 0 && newY <= ROWS) {
                possibleMoves.push({
                    x: newX,
                    y: newY,
                    vx: newVx,
                    vy: newVy,
                    crashes: checkTrackCollision(newX, newY)
                });
            }
        }
    }
}

// Check if ANY PART of the 20x20 destination square overlaps the track.
// If it does NOT overlap the track at all, it's a grass crash.
function checkTrackCollision(gx, gy) {
    // The grid square is defined from (gx * squareSize) to (gx * squareSize + squareSize)
    // We can sample a grid of points within this square to see if any are in the track path.
    const steps = 4; // Sample a 4x4 grid within the 20px square (every 5px)
    const px = gx * squareSize;
    const py = gy * squareSize;

    let isTouchingTrack = false;
    for (let dx = 0; dx <= steps; dx++) {
        for (let dy = 0; dy <= steps; dy++) {
            const sampleX = px + (dx / steps) * squareSize;
            const sampleY = py + (dy / steps) * squareSize;

            // Check 'evenodd' rule. It returns true if it's inside outer but outside inner.
            if (ctx.isPointInPath(trackPath, sampleX, sampleY, 'evenodd')) {
                isTouchingTrack = true;
                break;
            }
        }
        if (isTouchingTrack) break;
    }

    // Crashes if it is NOT touching the track
    return !isTouchingTrack;
}

// Line segment intersection to check passing the finish line
// Returns true if the segments (p0_x, p0_y)->(p1_x, p1_y) and (p2_x, p2_y)->(p3_x, p3_y) intersect
function lineIntersect(p0_x, p0_y, p1_x, p1_y, p2_x, p2_y, p3_x, p3_y) {
    let s1_x, s1_y, s2_x, s2_y;
    s1_x = p1_x - p0_x;
    s1_y = p1_y - p0_y;
    s2_x = p3_x - p2_x;
    s2_y = p3_y - p2_y;

    let s, t;
    s = (-s1_y * (p0_x - p2_x) + s1_x * (p0_y - p2_y)) / (-s2_x * s1_y + s1_x * s2_y);
    t = (s2_x * (p0_y - p2_y) - s2_y * (p0_x - p2_x)) / (-s2_x * s1_y + s1_x * s2_y);

    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
        return true;
    }
    return false; // No collision
}

function checkStartFinish(oldGX, oldGY, newGX, newGY) {
    const oX = oldGX * squareSize;
    const oY = oldGY * squareSize;
    const nX = newGX * squareSize;
    const nY = newGY * squareSize;

    // Check intersection with FL line
    return lineIntersect(oX, oY, nX, nY, FL_X1, FL_Y1, FL_X2, FL_Y2);
}

canvas.addEventListener('mousemove', (e) => {
    if (gameState !== 'playing') return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    hoveredMove = null;
    let minDist = 15; // Hit radius

    for (let move of possibleMoves) {
        const scx = move.x * squareSize;
        const scy = move.y * squareSize;
        const dist = Math.hypot(mx - scx, my - scy);

        if (dist < minDist) {
            minDist = dist;
            hoveredMove = move;
        }
    }

    draw();
});

canvas.addEventListener('click', (e) => {
    if (gameState !== 'playing' || !hoveredMove) return;

    const p = player;
    const move = hoveredMove;

    const oX = p.x;
    const oY = p.y;

    // Update player
    p.path.push({ x: move.x, y: move.y });
    p.vx = move.vx;
    p.vy = move.vy;
    p.x = move.x;
    p.y = move.y;

    if (move.crashes) {
        p.crashed = true;
    } else {
        // Did we gain velocity? (Race logic starts)
        if (Math.hypot(p.vx, p.vy) > 0 && !p.hasStarted) {
            // Once we move right past start blocks, we are started.
            // Let's ensure we just consider ANY movement from initial zero velocity as a start.
            p.hasStarted = true;
        }

        if (p.hasStarted && checkStartFinish(oX, oY, p.x, p.y)) {
            // Crossed the line!
            // Ensure they completed a lap and didn't just back up. 
            // The finish line is at x=500. They start to the left of it, and should hit it from the right (moving left).
            // E.g. newX.x < oldX.x
            if (oX > p.x || oX * squareSize > FL_X1) {
                p.laps++;
                if (p.laps >= 1) {
                    p.finished = true;
                }
            }
        }
    }

    checkGameEnd();

    if (gameState === 'playing') {
        updateUI();
        calculatePossibleMoves();
        draw();
    }
});

function checkGameEnd() {
    if (player.finished) {
        endGame('Race Finished! Lap Complete!', player.color);
    } else if (player.crashed) {
        endGame('You crashed', '#ff0055');
    }
}

function endGame(message, color) {
    gameState = 'gameover';
    const overlay = document.getElementById('game-over-overlay');
    const msgEl = document.getElementById('game-over-message');

    msgEl.innerText = message;
    msgEl.style.color = color;
    msgEl.style.textShadow = `0 0 20px ${color}`;

    overlay.classList.remove('hidden');

    updateUI();
    draw();
}

function updateUI() {
    document.getElementById('p1-speed').innerText = Math.round(Math.hypot(player.vx, player.vy) * 10) * 10;
    document.getElementById('lap-count').innerText = `${player.laps}/1`;
}

document.getElementById('restart-btn').addEventListener('click', initGame);
document.getElementById('play-again-btn').addEventListener('click', initGame);

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Track Base (Asphalt)
    ctx.fillStyle = '#1e2938'; // Dark asphalt
    ctx.fill(trackPath, 'evenodd');

    // 2. Draw Grid (Optional overlay inside or outside, let's draw everywhere for "graph paper" feel)
    ctx.strokeStyle = 'rgba(30, 60, 100, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += squareSize) {
        ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
    }
    for (let y = 0; y <= canvas.height; y += squareSize) {
        ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    // 3. Draw Track Borders
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00e5ff';
    ctx.stroke(trackOuterPath);
    ctx.stroke(trackInnerPath);
    ctx.shadowBlur = 0; // Reset

    // 4. Draw Start/Finish Line
    ctx.strokeStyle = '#ffd700'; // Gold finish line
    ctx.lineWidth = 5;
    ctx.setLineDash([10, 10]); // Checkered look approximation
    ctx.beginPath();
    ctx.moveTo(FL_X1, FL_Y1);
    ctx.lineTo(FL_X2, FL_Y2);
    ctx.stroke();
    ctx.setLineDash([]); // Reset


    // 5. Draw Player Path
    const p = player;
    if (p.path.length > 0) {
        ctx.beginPath();
        const start = p.path[0];
        ctx.moveTo(start.x * squareSize, start.y * squareSize);

        for (let i = 1; i < p.path.length; i++) {
            ctx.lineTo(p.path[i].x * squareSize, p.path[i].y * squareSize);
        }

        ctx.strokeStyle = p.color;

        // Add glow
        ctx.shadowBlur = p.crashed ? 0 : 10;
        ctx.shadowColor = p.glow;

        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw dots at vertices
        ctx.shadowBlur = 0;
        for (let i = 0; i < p.path.length; i++) {
            ctx.beginPath();
            ctx.arc(p.path[i].x * squareSize, p.path[i].y * squareSize, 4, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();

            if (p.crashed && i === p.path.length - 1) {
                // Draw cross for crash
                ctx.strokeStyle = '#ff0055';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(p.path[i].x * squareSize - 8, p.path[i].y * squareSize - 8);
                ctx.lineTo(p.path[i].x * squareSize + 8, p.path[i].y * squareSize + 8);
                ctx.moveTo(p.path[i].x * squareSize + 8, p.path[i].y * squareSize - 8);
                ctx.lineTo(p.path[i].x * squareSize - 8, p.path[i].y * squareSize + 8);
                ctx.stroke();
            }
        }
    }

    // 6. Draw Possible Moves and Inertia Line
    if (gameState === 'playing') {
        const inertiaX = p.x + p.vx;
        const inertiaY = p.y + p.vy;

        ctx.beginPath();
        ctx.moveTo(p.x * squareSize, p.y * squareSize);
        ctx.lineTo(inertiaX * squareSize, inertiaY * squareSize);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]); // Reset

        if (hoveredMove) {
            ctx.beginPath();
            ctx.arc(hoveredMove.x * squareSize, hoveredMove.y * squareSize, 8, 0, Math.PI * 2);

            if (hoveredMove.crashes) {
                ctx.fillStyle = 'rgba(255, 0, 85, 0.8)'; // Red for crash spots
            } else {
                ctx.fillStyle = player.color;
            }

            ctx.fill();

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
}

// Start
initGame();

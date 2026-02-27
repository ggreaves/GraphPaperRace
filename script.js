const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const squareSize = 20;

const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 2400;

const COLS = WORLD_WIDTH / squareSize; // 150
const ROWS = WORLD_HEIGHT / squareSize; // 120

let camera = { x: 0, y: 0 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let cameraStart = { x: 0, y: 0 };


// --- Silverstone-ish Track Definition ---
const trackOuterPath = new Path2D();
// Start Hamilton Straight (Left/Top boundary)
trackOuterPath.moveTo(1100, 1850);
trackOuterPath.lineTo(1600, 1850);
// Abbey (Right)
trackOuterPath.bezierCurveTo(1900, 1850, 2000, 1750, 2050, 1600);
// Farm (Leftish)
trackOuterPath.quadraticCurveTo(2080, 1500, 2150, 1450);
// Village (Right)
trackOuterPath.quadraticCurveTo(2300, 1400, 2300, 1600);
// The Loop (Left)
trackOuterPath.bezierCurveTo(2300, 1800, 2000, 1800, 1900, 1950);
// Aintree (Left to Wellington)
trackOuterPath.quadraticCurveTo(1850, 2050, 1700, 2050);
// Wellington Straight
trackOuterPath.lineTo(1000, 2050);
// Brooklands (Left)
trackOuterPath.bezierCurveTo(700, 2050, 600, 1700, 800, 1600);
// Luffield (Right 180)
trackOuterPath.bezierCurveTo(1000, 1500, 1100, 1300, 1000, 1100);
// Woodcote (Right)
trackOuterPath.quadraticCurveTo(950, 1000, 1200, 900);
// National Straight
trackOuterPath.lineTo(1600, 800);
// Copse (Right)
trackOuterPath.bezierCurveTo(1900, 750, 2100, 800, 2200, 1000);
// Maggotts / Becketts / Chapel (Esses)
trackOuterPath.bezierCurveTo(2300, 1100, 2400, 1100, 2500, 1000);
trackOuterPath.bezierCurveTo(2600, 900, 2700, 900, 2800, 1100);
// Hangar Straight
trackOuterPath.lineTo(2600, 1800);
// Stowe (Right)
trackOuterPath.bezierCurveTo(2550, 2100, 2300, 2200, 2100, 2100);
// Vale (Straightish)
trackOuterPath.lineTo(1800, 2050);
// Club (Right)
trackOuterPath.bezierCurveTo(1500, 2100, 1300, 2000, 1100, 1850);


const trackInnerPath = new Path2D();
// Offset approx width
// Hamilton Straight Inner (Right/Bottom boundary)
trackInnerPath.moveTo(1100, 1950);
trackInnerPath.lineTo(1600, 1950);
// Abbey
trackInnerPath.bezierCurveTo(1800, 1950, 1900, 1850, 1950, 1650);
// Farm
trackInnerPath.quadraticCurveTo(1980, 1550, 2050, 1550);
// Village
trackInnerPath.quadraticCurveTo(2150, 1550, 2150, 1650);
// The Loop
trackInnerPath.bezierCurveTo(2150, 1750, 2000, 1750, 1950, 1850);
// Aintree
trackInnerPath.quadraticCurveTo(1900, 1950, 1700, 1950);
// Wellington
trackInnerPath.lineTo(1000, 1950);
// Brooklands
trackInnerPath.bezierCurveTo(800, 1950, 750, 1700, 900, 1650);
// Luffield
trackInnerPath.bezierCurveTo(1100, 1600, 1200, 1300, 1100, 1150);
// Woodcote
trackInnerPath.quadraticCurveTo(1050, 1050, 1200, 1000);
// National Straight
trackInnerPath.lineTo(1600, 900);
// Copse
trackInnerPath.bezierCurveTo(1800, 850, 2000, 900, 2100, 1050);
// Maggotts / Becketts
trackInnerPath.bezierCurveTo(2200, 1200, 2400, 1200, 2500, 1100);
trackInnerPath.bezierCurveTo(2550, 1050, 2600, 1050, 2650, 1150);
// Hangar Straight
trackInnerPath.lineTo(2450, 1850);
// Stowe
trackInnerPath.bezierCurveTo(2400, 2000, 2300, 2100, 2100, 2000);
// Vale
trackInnerPath.lineTo(1800, 1950);
// Club
trackInnerPath.bezierCurveTo(1600, 2000, 1400, 2000, 1100, 1950);


const trackPath = new Path2D();
trackPath.addPath(trackOuterPath);
trackPath.addPath(trackInnerPath);


// Start / Finish Line Segment (Hamilton Straight)
// Vertical line? No, Horizontal-ish.
// Outer Y=1850, Inner Y=1950. X approx 1400.
const FL_X1 = 1400;
const FL_Y1 = 1850; // Outer
const FL_X2 = 1400;
const FL_Y2 = 1950; // Inner

let player;
let gameState = 'playing'; // 'playing', 'gameover'
let possibleMoves = [];
let hoveredMove = null;

function initGame() {
    // Starting position: Behind finish line (x=1400), midway in width.
    // X = 1360 (Grid 68)
    // Y = 1900 (Grid 95)
    player = {
        id: 0,
        x: 68, y: 95,
        vx: 0, vy: 0,
        path: [{ x: 68, y: 95 }],
        crashed: false,
        finished: false,
        hasStarted: false,
        laps: 0,
        color: '#00ffaa',
        glow: '#00ffaa'
    };

    // Center camera on player initially
    camera.x = Math.max(0, Math.min((player.x * squareSize) - canvas.width/2, WORLD_WIDTH - canvas.width));
    camera.y = Math.max(0, Math.min((player.y * squareSize) - canvas.height/2, WORLD_HEIGHT - canvas.height));

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

            // Screen bounds (World bounds now)
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

function checkTrackCollision(gx, gy) {
    const steps = 4;
    const px = gx * squareSize;
    const py = gy * squareSize;

    let isTouchingTrack = false;
    for (let dx = 0; dx <= steps; dx++) {
        for (let dy = 0; dy <= steps; dy++) {
            const sampleX = px + (dx / steps) * squareSize;
            const sampleY = py + (dy / steps) * squareSize;

            if (ctx.isPointInPath(trackPath, sampleX, sampleY, 'evenodd')) {
                isTouchingTrack = true;
                break;
            }
        }
        if (isTouchingTrack) break;
    }

    return !isTouchingTrack;
}

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
    return false;
}

function checkStartFinish(oldGX, oldGY, newGX, newGY) {
    const oX = oldGX * squareSize;
    const oY = oldGY * squareSize;
    const nX = newGX * squareSize;
    const nY = newGY * squareSize;

    return lineIntersect(oX, oY, nX, nY, FL_X1, FL_Y1, FL_X2, FL_Y2);
}

canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStart = { x: e.clientX, y: e.clientY };
    cameraStart = { x: camera.x, y: camera.y };
});

canvas.addEventListener('mousemove', (e) => {
    if (gameState !== 'playing') return;

    if (isDragging) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;

        let newCamX = cameraStart.x - dx;
        let newCamY = cameraStart.y - dy;

        const maxCamX = WORLD_WIDTH - canvas.width;
        const maxCamY = WORLD_HEIGHT - canvas.height;

        camera.x = Math.max(0, Math.min(newCamX, maxCamX));
        camera.y = Math.max(0, Math.min(newCamY, maxCamY));

        draw();
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const worldX = mx + camera.x;
    const worldY = my + camera.y;

    hoveredMove = null;
    let minDist = 15;

    for (let move of possibleMoves) {
        const scx = move.x * squareSize;
        const scy = move.y * squareSize;
        const dist = Math.hypot(worldX - scx, worldY - scy);

        if (dist < minDist) {
            minDist = dist;
            hoveredMove = move;
        }
    }

    draw();
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
});

canvas.addEventListener('mouseleave', () => {
    isDragging = false;
});

canvas.addEventListener('click', (e) => {
    if (gameState !== 'playing' || !hoveredMove) return;

    const dist = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
    if (dist > 5) return;

    const p = player;
    const move = hoveredMove;

    const oX = p.x;
    const oY = p.y;

    p.path.push({ x: move.x, y: move.y });
    p.vx = move.vx;
    p.vy = move.vy;
    p.x = move.x;
    p.y = move.y;

    if (move.crashes) {
        p.crashed = true;
    } else {
        if (Math.hypot(p.vx, p.vy) > 0 && !p.hasStarted) {
            p.hasStarted = true;
        }

        if (p.hasStarted && checkStartFinish(oX, oY, p.x, p.y)) {
            // Check direction: Moving West to East (Increasing X)
            // Finish line is vertical-ish at X=1400.
            // oX < p.x implies crossing left to right.
            // Or just check that we are "right" of the line now.
            if (p.x > oX || p.x * squareSize > FL_X1) {
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
        endGame('You Crashed into the Grass!', '#ff0055');
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

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // 1. Draw Track Base
    ctx.fillStyle = '#1e2938';
    ctx.fill(trackPath, 'evenodd');

    // 2. Draw Grid
    ctx.strokeStyle = 'rgba(30, 60, 100, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= WORLD_WIDTH; x += squareSize) {
        ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_HEIGHT);
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += squareSize) {
        ctx.moveTo(0, y); ctx.lineTo(WORLD_WIDTH, y);
    }
    ctx.stroke();

    // 3. Draw Track Borders
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00e5ff';
    ctx.stroke(trackOuterPath);
    ctx.stroke(trackInnerPath);
    ctx.shadowBlur = 0;

    // 4. Draw Start/Finish Line
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 5;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(FL_X1, FL_Y1);
    ctx.lineTo(FL_X2, FL_Y2);
    ctx.stroke();
    ctx.setLineDash([]);


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

        ctx.shadowBlur = p.crashed ? 0 : 10;
        ctx.shadowColor = p.glow;

        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.shadowBlur = 0;
        for (let i = 0; i < p.path.length; i++) {
            ctx.beginPath();
            ctx.arc(p.path[i].x * squareSize, p.path[i].y * squareSize, 4, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();

            if (p.crashed && i === p.path.length - 1) {
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

    // 6. Draw Possible Moves
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
        ctx.setLineDash([]);

        if (hoveredMove) {
            ctx.beginPath();
            ctx.arc(hoveredMove.x * squareSize, hoveredMove.y * squareSize, 8, 0, Math.PI * 2);

            if (hoveredMove.crashes) {
                ctx.fillStyle = 'rgba(255, 0, 85, 0.8)';
            } else {
                ctx.fillStyle = player.color;
            }

            ctx.fill();

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    ctx.restore();

    drawMinimap();
}

function drawMinimap() {
    const margin = 20;
    // Base size for minimap
    const maxMMWidth = 300;
    const maxMMHeight = 240;

    // Scale factor to fit WORLD into minimap box
    // WORLD is 3000x2400.
    // 3000 * s = 300 => s = 0.1
    // 2400 * s = 240 => s = 0.1
    const scale = Math.min(maxMMWidth / WORLD_WIDTH, maxMMHeight / WORLD_HEIGHT);

    const mmWidth = WORLD_WIDTH * scale;
    const mmHeight = WORLD_HEIGHT * scale;

    // Position: Bottom Left
    const mmX = margin;
    const mmY = canvas.height - mmHeight - margin;

    // Background
    ctx.fillStyle = 'rgba(10, 20, 30, 0.9)';
    ctx.fillRect(mmX, mmY, mmWidth, mmHeight);

    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(mmX, mmY, mmWidth, mmHeight);

    ctx.save();
    ctx.translate(mmX, mmY);
    ctx.scale(scale, scale);

    // Draw Track (Simplified)
    ctx.fillStyle = '#2b3a4a';
    ctx.fill(trackPath, 'evenodd');

    // Draw Track Borders (Thinner)
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 40; // Needs to be thick to show up at 0.1 scale
    ctx.stroke(trackOuterPath);
    ctx.stroke(trackInnerPath);

    // Draw Player
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.x * squareSize, player.y * squareSize, 60, 0, Math.PI * 2); // Big dot
    ctx.fill();

    // Draw Viewport Rectangle
    ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)';
    ctx.lineWidth = 30;
    ctx.strokeRect(camera.x, camera.y, canvas.width, canvas.height);

    ctx.restore();
}

// Start
if (typeof module === 'undefined') {
    initGame();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        checkStartFinish,
        lineIntersect
    };
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const squareSize = 20;

// World bounds for camera panning
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 2400;

const COLS = WORLD_WIDTH / squareSize; // 150
const ROWS = WORLD_HEIGHT / squareSize; // 120

let camera = { x: 0, y: 0 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let cameraStart = { x: 0, y: 0 };

const TRACK_WIDTH = 120; // Width of the asphalt
const TRACK_BORDER_WIDTH = 6; // Width of the blue border (drawn outside)

// --- Roebling Road Raceway Definition ---
// Define a SINGLE centerline path. This ensures mathematically parallel edges when stroked.
const trackCenterPath = new Path2D();

// Bottom Straight
trackCenterPath.moveTo(600, 1740);
trackCenterPath.lineTo(2350, 1740);

// Turn 8/9
trackCenterPath.bezierCurveTo(2650, 1740, 2650, 1550, 2550, 1200);

// Turn 6/7
trackCenterPath.bezierCurveTo(2450, 850, 2300, 650, 2100, 650);
trackCenterPath.bezierCurveTo(1950, 650, 1950, 850, 2050, 1200);

// Turn 5
trackCenterPath.bezierCurveTo(2100, 1350, 2000, 1450, 1850, 1450);
trackCenterPath.bezierCurveTo(1650, 1450, 1600, 1350, 1500, 1150);

// Turn 4
trackCenterPath.bezierCurveTo(1380, 950, 1220, 950, 1150, 1150);

// Turn 3
trackCenterPath.bezierCurveTo(1050, 1350, 850, 1450, 650, 1350);

// Turn 1/2
trackCenterPath.bezierCurveTo(350, 1250, 350, 1740, 600, 1740);

// Start / Finish Line Segment
// Center is roughly at X=1500, Y=1740
const FL_X1 = 1500;
const FL_Y1 = 1740 - (TRACK_WIDTH / 2);
const FL_X2 = 1500;
const FL_Y2 = 1740 + (TRACK_WIDTH / 2);

let player;
let gameState = 'playing'; // 'playing', 'gameover'
let possibleMoves = [];
let hoveredMove = null;

function initGame() {
    // Starting position: Behind finish line (x=1500), midway in width.
    // X = 1460 (Grid 73)
    // Y = 1740 (Grid 87)
    player = {
        id: 0,
        x: 73, y: 87,
        vx: 0, vy: 0,
        path: [{ x: 73, y: 87 }],
        crashed: false,
        finished: false,
        hasStarted: false,
        laps: 0,
        color: '#00ffaa',
        glow: '#00ffaa'
    };

    // Center camera on player initially
    camera.x = Math.max(0, Math.min((player.x * squareSize) - canvas.width / 2, WORLD_WIDTH - canvas.width));
    camera.y = Math.max(0, Math.min((player.y * squareSize) - canvas.height / 2, WORLD_HEIGHT - canvas.height));

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

    // Set line width for collision detection to match the track width
    ctx.lineWidth = TRACK_WIDTH;
    ctx.lineCap = 'butt'; // Or 'round' if you want rounded ends, 'butt' is better for continuous
    ctx.lineJoin = 'round'; // Smooth corners

    for (let dx = 0; dx <= steps; dx++) {
        for (let dy = 0; dy <= steps; dy++) {
            const sampleX = px + (dx / steps) * squareSize;
            const sampleY = py + (dy / steps) * squareSize;

            // Check if point is inside the thick stroke
            if (ctx.isPointInStroke(trackCenterPath, sampleX, sampleY)) {
                isTouchingTrack = true;
                break;
            }
        }
        if (isTouchingTrack) break;
    }

    return !isTouchingTrack; // Crashes if NOT touching
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

        // Only allow finishing a lap if they've made a reasonable number of moves 
        // away from the start line. It takes many moves to complete a 3000x2400 track lap.
        if (p.hasStarted && p.path.length > 20 && checkStartFinish(oX, oY, p.x, p.y)) {
            // Check direction: Moving Left to Right (Increasing X)
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

    // 1. Draw Track Borders (Outer stroke, slightly thicker than asphalt)
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = TRACK_WIDTH + TRACK_BORDER_WIDTH;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00e5ff';
    ctx.stroke(trackCenterPath);
    ctx.shadowBlur = 0; // Reset

    // 2. Draw Track Asphalt (Inner stroke)
    ctx.strokeStyle = '#1e2938'; // Dark asphalt
    ctx.lineWidth = TRACK_WIDTH;
    ctx.stroke(trackCenterPath);

    // 3. Draw Grid (Optional overlay inside or outside, let's draw everywhere for "graph paper" feel)
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
    const maxMMWidth = 300;
    const maxMMHeight = 240;

    const scale = Math.min(maxMMWidth / WORLD_WIDTH, maxMMHeight / WORLD_HEIGHT);

    const mmWidth = WORLD_WIDTH * scale;
    const mmHeight = WORLD_HEIGHT * scale;

    const mmX = margin;
    const mmY = canvas.height - mmHeight - margin;

    ctx.fillStyle = 'rgba(10, 20, 30, 0.9)';
    ctx.fillRect(mmX, mmY, mmWidth, mmHeight);

    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(mmX, mmY, mmWidth, mmHeight);

    ctx.save();
    ctx.translate(mmX, mmY);
    ctx.scale(scale, scale);

    // Draw Track Borders (Thick Stroke)
    ctx.strokeStyle = '#00e5ff';
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.lineWidth = TRACK_WIDTH + TRACK_BORDER_WIDTH;
    ctx.stroke(trackCenterPath);

    // Draw Track Asphalt (Inner Stroke)
    ctx.strokeStyle = '#2b3a4a'; // Lighter asphalt for minimap
    ctx.lineWidth = TRACK_WIDTH;
    ctx.stroke(trackCenterPath);

    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.x * squareSize, player.y * squareSize, 60, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)';
    ctx.lineWidth = 30;
    ctx.strokeRect(camera.x, camera.y, canvas.width, canvas.height);

    ctx.restore();
}

// Start
initGame();

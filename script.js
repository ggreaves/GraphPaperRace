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

let socket;
let myPlayerId = null;
let myPlayer = null;
let opponentPlayer = null;
let gameState = 'lobby'; // 'lobby', 'playing', 'gameover'
let possibleMoves = [];
let hoveredMove = null;

// --- DOM Elements ---
let lobbyContainer, gameContainer, joinBtn, readyBtn, nameInput, playersList, playerCountSpan;

document.addEventListener('DOMContentLoaded', () => {
    lobbyContainer = document.getElementById('lobby-container');
    gameContainer = document.getElementById('game-container');
    joinBtn = document.getElementById('join-btn');
    readyBtn = document.getElementById('ready-btn');
    nameInput = document.getElementById('player-name-input');
    playersList = document.getElementById('players-list');
    playerCountSpan = document.getElementById('player-count');

    // UI Event Listeners
    joinBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        socket.emit('join_lobby', name);
    });

    readyBtn.addEventListener('click', () => {
        readyBtn.innerText = "WAITING...";
        socket.emit('player_ready', true);
    });
});

// --- Socket Connection & Lobby Logic ---
socket = io('https://graphpaperrace-567699476890.us-east1.run.app', {
    transports: ['websocket', 'polling']
});

socket.on('server_state', (data) => {
    gameState = data.gameState;
    const players = data.players;

    // Update Lobby UI
    if (gameState === 'lobby') {
        lobbyContainer.classList.remove('hidden');
        gameContainer.classList.add('hidden');
        document.getElementById('game-over-overlay').classList.add('hidden');

        const ids = Object.keys(players);
        playerCountSpan.innerText = ids.length;

        if (ids.length > 0) {
            playersList.classList.remove('hidden');
            playersList.innerHTML = '';

            ids.forEach(id => {
                const p = players[id];
                const isMe = id === socket.id;
                if (isMe) myPlayerId = id;

                const badge = p.ready ? '<span class="status-badge ready">READY</span>' : '<span class="status-badge">WAITING</span>';
                playersList.innerHTML += `<div class="player-row"><span>${p.name} ${isMe ? '(You)' : ''}</span> ${badge}</div>`;
            });

            // Show ready button if joined
            if (players[socket.id]) {
                document.getElementById('name-input-group').classList.add('hidden');
                readyBtn.classList.remove('hidden');

                if (players[socket.id].ready) {
                    readyBtn.innerText = "WAITING FOR OPPONENT...";
                    readyBtn.disabled = true;
                    readyBtn.style.opacity = '0.5';
                } else {
                    readyBtn.innerText = "I'M READY";
                    readyBtn.disabled = false;
                    readyBtn.style.opacity = '1';
                }
            } else {
                document.getElementById('name-input-group').classList.remove('hidden');
                readyBtn.classList.add('hidden');
            }
        } else {
            playersList.classList.add('hidden');
            document.getElementById('name-input-group').classList.remove('hidden');
            readyBtn.classList.add('hidden');
        }
    }
});

socket.on('game_started', () => {
    gameState = 'playing';
    lobbyContainer.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    document.getElementById('game-over-overlay').classList.add('hidden');

    initGamePositions();
});

socket.on('opponent_moved', (data) => {
    if (opponentPlayer) {
        opponentPlayer.x = data.x;
        opponentPlayer.y = data.y;
        opponentPlayer.vx = data.vx;
        opponentPlayer.vy = data.vy;
        opponentPlayer.moves = data.moves;
        opponentPlayer.path.push({ x: data.x, y: data.y });
        updateUI();
        draw();
    }
});

socket.on('game_over', (data) => {
    gameState = 'gameover';

    const overlay = document.getElementById('game-over-overlay');
    const msgEl = document.getElementById('game-over-message');
    const returnBtn = document.getElementById('return-lobby-btn');

    let color = '#fff';
    if (data.winner === myPlayer?.name) {
        msgEl.innerText = "YOU WIN!";
        color = '#00ffaa';
    } else if (data.winner === "Tie") {
        msgEl.innerText = "IT'S A TIE!";
        color = '#ffd700';
    } else {
        msgEl.innerText = "YOU LOSE!";
        color = '#ff0055';
    }

    // Add reason subtitle
    msgEl.innerHTML += `<br><span style="font-size: 1.5rem; color: #aaa;">${data.reason}</span>`;

    msgEl.style.color = color;
    msgEl.style.textShadow = `0 0 20px ${color}`;

    returnBtn.classList.add('hidden'); // Server auto-returns now, but keeping DOM element
    overlay.classList.remove('hidden');

    updateUI();
    draw();
});

// --- Game Logic ---
function initGamePositions() {
    // Determine start positions based on Socket ID sort to separate them slightly
    // Center is roughly at X=1500 (grid 75)

    myPlayer = {
        name: document.getElementById('player-name-input').value || `Driver`,
        x: 73, y: 87, // Player 1 default slot
        vx: 0, vy: 0,
        path: [{ x: 73, y: 87 }],
        crashed: false,
        finished: false,
        hasStarted: false,
        moves: 0,
        color: '#00ffaa',
        glow: '#00ffaa'
    };

    opponentPlayer = {
        name: "Opponent",
        x: 73, y: 89, // Player 2 slot (shifted down slightly)
        vx: 0, vy: 0,
        path: [{ x: 73, y: 89 }],
        crashed: false,
        finished: false,
        hasStarted: false,
        moves: 0,
        color: '#ff00aa', // Pink
        glow: '#ff00aa'
    };

    // Center camera on myPlayer initially
    camera.x = Math.max(0, Math.min((myPlayer.x * squareSize) - canvas.width / 2, WORLD_WIDTH - canvas.width));
    camera.y = Math.max(0, Math.min((myPlayer.y * squareSize) - canvas.height / 2, WORLD_HEIGHT - canvas.height));

    hoveredMove = null;
    updateUI();
    calculatePossibleMoves();
    draw();
}

function calculatePossibleMoves() {
    possibleMoves = [];
    if (gameState !== 'playing') return;

    const p = myPlayer;
    if (!p || p.crashed || p.finished) return;

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
    const offset = squareSize / 2;
    const oX = oldGX * squareSize + offset;
    const oY = oldGY * squareSize + offset;
    const nX = newGX * squareSize + offset;
    const nY = newGY * squareSize + offset;

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

    const p = myPlayer;
    const move = hoveredMove;

    const oX = p.x;
    const oY = p.y;

    p.path.push({ x: move.x, y: move.y });
    p.vx = move.vx;
    p.vy = move.vy;
    p.x = move.x;
    p.y = move.y;
    p.moves++; // Increment moves vector counter

    socket.emit('player_moved', {
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy
    });

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
            if (p.x > oX || (p.x * squareSize + squareSize / 2) > FL_X1) {
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
    if (myPlayer.finished) {
        socket.emit('player_finished');
    } else if (myPlayer.crashed) {
        socket.emit('player_crashed');
    }
}

// Function removed: endGame is now handled cleanly by socket 'game_over' event

function updateUI() {
    if (myPlayer) {
        document.getElementById('p1-speed').innerText = Math.round(Math.hypot(myPlayer.vx, myPlayer.vy) * 10) * 10;
        document.getElementById('p1-vectors').innerText = myPlayer.moves;
        document.getElementById('p1-name-label').innerText = myPlayer.name + ":";
    }

    if (opponentPlayer) {
        document.getElementById('p2-speed').innerText = Math.round(Math.hypot(opponentPlayer.vx, opponentPlayer.vy) * 10) * 10;
        document.getElementById('p2-vectors').innerText = opponentPlayer.moves;
        document.getElementById('p2-name-label').innerText = opponentPlayer.name + ":";
    }
}

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


    // 5. Draw Player Paths
    const playersToDraw = [myPlayer, opponentPlayer].filter(p => p !== null);

    playersToDraw.forEach(p => {
        const offset = squareSize / 2;
        if (p.path.length > 0) {
            ctx.beginPath();
            const start = p.path[0];
            ctx.moveTo(start.x * squareSize + offset, start.y * squareSize + offset);

            for (let i = 1; i < p.path.length; i++) {
                ctx.lineTo(p.path[i].x * squareSize + offset, p.path[i].y * squareSize + offset);
            }

            ctx.strokeStyle = p.color;

            ctx.shadowBlur = p.crashed ? 0 : 10;
            ctx.shadowColor = p.glow;

            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.shadowBlur = 0;
            for (let i = 0; i < p.path.length; i++) {
                ctx.beginPath();
                ctx.arc(p.path[i].x * squareSize + offset, p.path[i].y * squareSize + offset, 4, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();

                if (p.crashed && i === p.path.length - 1) {
                    ctx.strokeStyle = '#ff0055';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    const px = p.path[i].x * squareSize + offset;
                    const py = p.path[i].y * squareSize + offset;
                    ctx.moveTo(px - 8, py - 8);
                    ctx.lineTo(px + 8, py + 8);
                    ctx.moveTo(px + 8, py - 8);
                    ctx.lineTo(px - 8, py + 8);
                    ctx.stroke();
                }
            }
        }
    });

    // 6. Draw Possible Moves
    if (gameState === 'playing' && myPlayer && !myPlayer.crashed && !myPlayer.finished) {
        const offset = squareSize / 2;
        const p = myPlayer;
        const inertiaX = p.x + p.vx;
        const inertiaY = p.y + p.vy;

        ctx.beginPath();
        ctx.moveTo(p.x * squareSize + offset, p.y * squareSize + offset);
        ctx.lineTo(inertiaX * squareSize + offset, inertiaY * squareSize + offset);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);

        if (hoveredMove) {
            const hx = hoveredMove.x * squareSize;
            const hy = hoveredMove.y * squareSize;

            ctx.beginPath();
            if (hoveredMove.crashes) {
                ctx.fillStyle = 'rgba(255, 0, 85, 0.5)';
            } else {
                ctx.fillStyle = 'rgba(0, 255, 170, 0.4)'; // Transparent glow fill
            }

            ctx.fillRect(hx, hy, squareSize, squareSize);

            // Draw 'X' inside square
            ctx.strokeStyle = hoveredMove.crashes ? '#ff0055' : myPlayer.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(hx + 4, hy + 4);
            ctx.lineTo(hx + squareSize - 4, hy + squareSize - 4);
            ctx.moveTo(hx + squareSize - 4, hy + 4);
            ctx.lineTo(hx + 4, hy + squareSize - 4);
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

    if (myPlayer) {
        ctx.fillStyle = myPlayer.color;
        ctx.beginPath();
        ctx.arc(myPlayer.x * squareSize + (squareSize / 2), myPlayer.y * squareSize + (squareSize / 2), 60, 0, Math.PI * 2);
        ctx.fill();
    }

    if (opponentPlayer) {
        ctx.fillStyle = opponentPlayer.color;
        ctx.beginPath();
        ctx.arc(opponentPlayer.x * squareSize + (squareSize / 2), opponentPlayer.y * squareSize + (squareSize / 2), 60, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)';
    ctx.lineWidth = 30;
    ctx.strokeRect(camera.x, camera.y, canvas.width, canvas.height);

    ctx.restore();
}

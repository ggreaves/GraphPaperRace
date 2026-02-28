const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*", // allow all origins since github pages hosts the client
        methods: ["GET", "POST"]
    }
});
const path = require('path');

const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname, '/')));

let players = {}; // Map of socket.id -> { id, name, ready, moves, finished, crashed }
let gameState = 'lobby'; // 'lobby', 'playing', 'gameover'

// Utility to count ready players
function countReady() {
    return Object.values(players).filter(p => p.ready).length;
}

// Reset the entire server state back to lobby mode
function resetGameToLobby() {
    gameState = 'lobby';
    for (let id in players) {
        players[id].ready = false;
        players[id].moves = 0;
        players[id].finished = false;
        players[id].crashed = false;
    }
    io.emit('server_state', { gameState, players });
}

io.on('connection', (socket) => {
    console.log(`[Socket] A user connected: ${socket.id}`);

    // Provide immediate state on connection
    socket.emit('server_state', { gameState, players });

    socket.on('join_lobby', (name) => {
        if (Object.keys(players).length >= 2) {
            socket.emit('lobby_full', 'The lobby is currently full (2 players max).');
            return;
        }

        players[socket.id] = {
            id: socket.id,
            name: name || `Driver_${Math.floor(Math.random() * 1000)}`,
            ready: false,
            moves: 0,
            finished: false,
            crashed: false
        };

        console.log(`[Lobby] ${players[socket.id].name} joined.`);
        io.emit('server_state', { gameState, players });
    });

    socket.on('player_ready', (isReady) => {
        if (players[socket.id]) {
            players[socket.id].ready = isReady;
            io.emit('server_state', { gameState, players });

            // Start game if 2 people are ready
            if (countReady() === 2 && Object.keys(players).length === 2 && gameState === 'lobby') {
                console.log(`[Game] Both players ready. Starting sequence...`);
                gameState = 'playing';
                io.emit('server_state', { gameState, players });
                io.emit('game_started');
            }
        }
    });

    socket.on('player_moved', (data) => {
        if (gameState !== 'playing' || !players[socket.id]) return;

        // Data contains { x, y, pathCount }
        players[socket.id].moves++;

        // Broadcast the move to everyone else
        socket.broadcast.emit('opponent_moved', {
            id: socket.id,
            x: data.x,
            y: data.y,
            vx: data.vx,
            vy: data.vy,
            moves: players[socket.id].moves
        });
    });

    socket.on('player_crashed', () => {
        if (gameState !== 'playing' || !players[socket.id]) return;

        console.log(`[Game] ${players[socket.id].name} crashed!`);
        players[socket.id].crashed = true;

        // Find opponent
        const opponentId = Object.keys(players).find(id => id !== socket.id);
        const opponent = players[opponentId];

        // If someone crashes, the race ends and the opponent wins immediately
        gameState = 'gameover';

        const winnerName = opponent ? opponent.name : 'Nobody';

        io.emit('game_over', {
            winner: winnerName,
            reason: `${players[socket.id].name} crashed.`
        });

        setTimeout(resetGameToLobby, 8000); // Back to lobby in 8s
    });

    socket.on('player_finished', () => {
        if (gameState !== 'playing' || !players[socket.id]) return;

        console.log(`[Game] ${players[socket.id].name} finished lap!`);
        players[socket.id].finished = true;

        // Broadcast that this player finished
        io.emit('server_state', { gameState, players });

        // Check if both finished
        const allFinished = Object.values(players).every(p => p.finished);

        if (allFinished) {
            gameState = 'gameover';

            // Determine winner by fewer moves
            const pArray = Object.values(players);
            let winner, message;

            if (pArray[0].moves < pArray[1].moves) {
                winner = pArray[0].name;
                message = `${pArray[0].name} wins with fewer vectors (${pArray[0].moves} to ${pArray[1].moves})!`;
            } else if (pArray[1].moves < pArray[0].moves) {
                winner = pArray[1].name;
                message = `${pArray[1].name} wins with fewer vectors (${pArray[1].moves} to ${pArray[0].moves})!`;
            } else {
                winner = "Tie";
                message = `It's a dead Tie! Both finished in ${pArray[0].moves} vectors!`;
            }

            console.log(`[Game Over] ${message}`);

            io.emit('game_over', {
                winner: winner,
                reason: message
            });

            setTimeout(resetGameToLobby, 8000);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] User disconnected: ${socket.id}`);
        if (players[socket.id]) {
            const name = players[socket.id].name;
            delete players[socket.id];

            if (gameState === 'playing') {
                gameState = 'gameover';
                io.emit('game_over', {
                    winner: 'Opponent',
                    reason: `${name} disconnected from the race.`
                });
                setTimeout(resetGameToLobby, 5000);
            } else {
                io.emit('server_state', { gameState, players });
            }
        }
    });
});

http.listen(PORT, () => {
    console.log(`[Server] Listening on port ${PORT}`);
});

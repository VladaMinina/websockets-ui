import { players, rooms, games, wsToPlayer } from '../db.js';
import { v4 as uid } from 'uuid';
const handleRequest = (ws, request, server) => {
    console.log('handle message');
    switch (request.type) {
        case 'reg':
            handleRegistration(ws, request, server);
            break;
        case 'create_room':
            handleCreateRoom(ws, request, server);
            break;
        case 'add_user_to_room':
            handleJoinRoom(ws, request, server);
            break;
        case 'add_ships':
            handleAddShips(ws, request);
            break;
        case 'attack':
        case 'randomAttack':
            handleAttack(ws, request);
            break;
        default:
            console.log('Do nothing');
    }
};
function handleRegistration(ws, request, server) {
    const { name, password } = request.data;
    if (players.has(name)) {
        const player = players.get(name);
        if (player && player.password === password) {
            // Send successful login response
            ws.send(JSON.stringify({
                type: 'reg',
                data: { name, index: player.id, error: false, errorText: '' },
                id: 0
            }));
        }
        else {
            // Invalid credentials
            ws.send(JSON.stringify({
                type: 'reg',
                data: { name, index: '', error: true, errorText: 'Invalid credentials' },
                id: 0
            }));
            return;
        }
    }
    else {
        // Register new player
        const id = uid();
        players.set(name, { id, username: name, password, wins: 0 });
        wsToPlayer.set(ws, id);
        wsToPlayer.forEach((value, key) => {
            console.log(`WebSocket Key Summary: [Ready State: ${key.readyState}], Player ID: ${value}`);
        });
        ws.send(JSON.stringify({
            type: 'reg',
            data: { name, index: id, error: false, errorText: '' },
            id: 0
        }));
        return;
    }
    // Send updated room list to all players
    const updateRoomData = Array.from(rooms.values())
        .filter(room => room.players.length === 1)
        .map(room => ({
        roomId: room.id,
        roomUsers: room.players.map(p => ({ name: p.username, index: p.id }))
    }));
    ws.send(JSON.stringify({
        type: 'update_room',
        data: updateRoomData,
        id: 0
    }));
    // Send updated winners leaderboard to all players
    const updateWinnersData = Array.from(players.values())
        .map(player => ({ name: player.username, wins: player.wins }))
        .sort((a, b) => b.wins - a.wins);
    ws.send(JSON.stringify({
        type: 'update_winners',
        data: updateWinnersData,
        id: 0
    }));
}
function handleCreateRoom(ws, request, server) {
    
    console.log(ws.readyState);
    const playerId = wsToPlayer.get(ws);
    console.log(playerId);
    if (!playerId) {
        console.error(`Player ID not found.`);
        ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'PlayerID not found.' },
            id: 0
        }));
        return;
    }
    const roomId = uid();
    const player = players.get(playerId);
    if (!player) {
        console.error(`Player with ID ${playerId} not found.`);
        ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Player not found.' },
            id: 0
        }));
        return;
    }
    rooms.set(roomId, { id: roomId, players: [player], gameId: null });
    const updateRoomData = Array.from(rooms.values())
        .filter(room => room.players.length === 1)
        .map(room => ({
        roomId: room.id,
        roomUsers: room.players.map(p => ({ name: p.username, index: p.id }))
    }));
    server.clients?.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'update_room',
                data: updateRoomData,
                id: 0
            }));
        }
    });
}
function handleJoinRoom(ws, request, server) {
    const roomId = request.data.indexRoom;
    const room = rooms.get(roomId);
    if (!room) {
        ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Room not found.' },
            id: 0
        }));
        return;
    }
    const playerId = wsToPlayer.get(ws);
    if (!playerId) {
        console.error(`Player ID not found.`);
        ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'PlayerID not found.' },
            id: 0
        }));
        return;
    }
    const player = players.get(playerId);
    if (!player) {
        ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Player not found.' },
            id: 0
        }));
        return;
    }
    if (room.players.length >= 2) {
        ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Room is full.' },
            id: 0
        }));
        return;
    }
    room.players.push(player);
    const gameId = uid();
    room.gameId = gameId;
    games.set(gameId, { id: gameId, players: { [room.players[0].id]: { ships: [], shots: [] }, playerId: { ships: [], shots: [] } }, currentPlayer: playerId });
    room.players.forEach((roomPlayer) => {
        const response = JSON.stringify({
            type: 'create_game',
            data: {
                idGame: gameId,
                idPlayer: roomPlayer.id
            },
            id: 0
        });
        const playerSocket = Array.from(wsToPlayer.entries()).find(([socket, id]) => id === roomPlayer.id)?.[0];
        if (playerSocket && playerSocket.readyState === WebSocket.OPEN) {
            playerSocket.send(response);
        }
    });
    rooms.delete(roomId);
    ws.send(JSON.stringify({
        type: 'update_room',
        data: [
            {
                roomId: roomId,
                roomUsers: room.players.map((player) => ({
                    name: player.username,
                    index: player.id
                }))
            }
        ],
        id: 0
    }));
}
function handleAddShips(ws, request) {
    const { gameId, ships, indexPlayer } = request.data;
    const game = games.get(gameId);
    if (!game) {
        ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Game not found' },
            id: 0
        }));
        return;
    }
    game.players[indexPlayer] = { ...game.players[indexPlayer], ships };
    const allPlayersHaveShips = Object.values(game.players).every((player) => player.ships && player.ships.length > 0);
    if (allPlayersHaveShips) {
        for (const [socket, playerId] of Array.from(wsToPlayer.entries())) {
            if (game.players[playerId]) {
                const startGameResponse = JSON.stringify({
                    type: 'start_game',
                    data: {
                        ships: game.players[playerId].ships,
                        currentPlayerIndex: playerId
                    },
                    id: 0
                });
                socket.send(startGameResponse);
            }
        }
    }
}
function handleAttack(ws, request) {
    const { gameId, x, y, indexPlayer } = request.data;
    const game = games.get(gameId);
    if (!game || game.currentPlayer !== indexPlayer) {
        ws.send(JSON.stringify({ error: "Invalid game or not your turn" }));
        return;
    }
    const playerData = game.players[indexPlayer];
    const opponentId = Object.keys(game.players).find(id => id !== indexPlayer);
    const opponentData = game.players[opponentId];
    if (playerData.shots.some(shot => shot.x === x && shot.y === y)) {
        const errorMessage = {
            type: "error",
            data: {
                message: "You have already shot at this position.",
            },
            id: request.id,
        };
        ws.send(JSON.stringify(errorMessage));
        return;
    }
    const targetX = x ?? Math.floor(Math.random() * 10);
    const targetY = y ?? Math.floor(Math.random() * 10);
    playerData.shots.push({ x: targetX, y: targetY });
    let hit = false;
    let sunk = false;
    let shipType = "";
    for (const [playerId, opponentData] of Object.entries(game.players)) {
        for (const ship of opponentData.ships) {
            const positions = getShipPositions(ship);
            for (const cell of positions) {
                if (cell.x === x && cell.y === y) {
                    hit = true;
                    sunk = positions.every(position => {
                        /*The some() method is used to check if any of the shots
                        taken by the opponent match the ship's positions. If all
                         positions of the ship are found in the opponentData.shots,
                        then the ship is considered sunk*/
                        return opponentData.shots.some(shot => shot.x === position.x && shot.y === position.y);
                    });
                    if (sunk) {
                        shipType = ship.type;
                    }
                    break;
                }
            }
            if (hit)
                break;
        }
    }
    const attackFeedback = {
        type: "attack",
        data: {
            position: { x, y },
            currentPlayer: indexPlayer,
            status: hit ? (sunk ? "killed" : "shot") : "miss",
        },
        id: 0,
    };
    ws.send(JSON.stringify(attackFeedback));
    if (hit) {
        const allSunk = areAllShipsSunk(opponentData.ships, playerData.shots);
        if (allSunk) {
            const finishGameMessage = {
                type: "finish",
                data: {
                    winPlayer: indexPlayer,
                },
                id: request.id,
            };
            ws.send(JSON.stringify(finishGameMessage));
            const player = players.get(indexPlayer);
            if (player) {
                player.wins = (player.wins ?? 0) + 1;
                const updateWinnersMessage = {
                    type: "update_winners",
                    data: {
                        name: player.username,
                        wins: player.wins,
                    },
                    id: request.id,
                };
                ws.send(JSON.stringify(updateWinnersMessage));
            }
            return;
        }
    }
    const turnNotification = {
        type: "turn",
        data: {
            currentPlayer: Object.keys(game.players).find(playerId => playerId !== indexPlayer),
        },
        id: 0,
    };
    ws.send(JSON.stringify(turnNotification));
}
function getShipPositions(ship) {
    const positions = [];
    for (let i = 0; i < ship.length; i++) {
        const cell = {
            x: ship.direction ? ship.position.x + i : ship.position.x,
            y: ship.direction ? ship.position.y : ship.position.y + i,
        };
        positions.push(cell);
    }
    return positions;
}
function areAllShipsSunk(ships, shots) {
    return ships.every(ship => {
        const positions = getShipPositions(ship);
        return positions.every(pos => shots.some(shot => shot.x === pos.x && shot.y === pos.y));
    });
}
export { handleRequest };

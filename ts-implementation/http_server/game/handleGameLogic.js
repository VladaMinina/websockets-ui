"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRequest = void 0;
var db_1 = require("../db");
var uuid_1 = require("uuid");
var handleRequest = function (ws, request, server) {
    console.log('handle');
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
exports.handleRequest = handleRequest;
function handleRegistration(ws, request, server) {
    var _a = request.data, name = _a.name, password = _a.password;
    // Register new player
    var id = (0, uuid_1.v4)();
    db_1.players.set(id, { id: id, username: name, password: password, wins: 0 });
    db_1.wsToPlayer.set(ws, id);
    db_1.players.forEach(function (player, username) {
        console.log("Username: ".concat(username, ", Player ID: ").concat(player.id, ", Wins: ").concat(player.wins));
    });
    db_1.wsToPlayer.forEach(function (id, ws) {
        console.log("ID: ".concat(id, ", WS: ").concat(ws.readyState, ","));
    });
    ws.send(JSON.stringify({
        type: 'reg',
        data: { name: name, index: id, error: false, errorText: '' },
        id: 0
    }));
    // Send updated room list to all players
    var updateRoomData = Array.from(db_1.rooms.values())
        .filter(function (room) { return room.players.length === 1; })
        .map(function (room) { return ({
        roomId: room.id,
        roomUsers: room.players.map(function (p) { return ({ name: p.username, index: p.id }); })
    }); });
    ws.send(JSON.stringify({
        type: 'update_room',
        data: updateRoomData,
        id: 0
    }));
    // Send updated winners leaderboard to all players
    var updateWinnersData = Array.from(db_1.players.values())
        .map(function (player) { return ({ name: player.username, wins: player.wins }); })
        .sort(function (a, b) { return b.wins - a.wins; });
    ws.send(JSON.stringify({
        type: 'update_winners',
        data: updateWinnersData,
        id: 0
    }));
}
function handleCreateRoom(ws, request, server) {
    var _a;
    var playerId = db_1.wsToPlayer.get(ws);
    console.log("RETHRIEVEDID", playerId);
    if (!playerId) {
        console.error("Player ID not found.");
        ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'PlayerID not found.' },
            id: 0
        }));
        return;
    }
    var roomId = (0, uuid_1.v4)();
    var player = db_1.players.get(playerId);
    if (!player) {
        console.error("Player with ID ".concat(playerId, " not found."));
        ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Player not found.' },
            id: 0
        }));
        return;
    }
    db_1.rooms.set(roomId, { id: roomId, players: [player], gameId: null });
    var updateRoomData = Array.from(db_1.rooms.values())
        .filter(function (room) { return room.players.length === 1; })
        .map(function (room) { return ({
        roomId: room.id,
        roomUsers: room.players.map(function (p) { return ({ name: p.username, index: p.id }); })
    }); });
    (_a = server.clients) === null || _a === void 0 ? void 0 : _a.forEach(function (client) {
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
    var _a;
    var roomId = request.data.indexRoom;
    var room = db_1.rooms.get(roomId);
    if (!room) {
        ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Room not found.' },
            id: 0
        }));
        return;
    }
    var playerId = db_1.wsToPlayer.get(ws);
    if (!playerId) {
        console.error("Player ID not found.");
        ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'PlayerID not found.' },
            id: 0
        }));
        return;
    }
    var player = db_1.players.get(playerId);
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
    var gameId = (0, uuid_1.v4)();
    room.gameId = gameId;
    db_1.games.set(gameId, { id: gameId, players: (_a = {}, _a[room.players[0].id] = { ships: [], shots: [] }, _a.playerId = { ships: [], shots: [] }, _a), currentPlayer: playerId });
    room.players.forEach(function (roomPlayer) {
        var _a;
        var response = JSON.stringify({
            type: 'create_game',
            data: {
                idGame: gameId,
                idPlayer: roomPlayer.id
            },
            id: 0
        });
        var playerSocket = (_a = Array.from(db_1.wsToPlayer.entries()).find(function (_a) {
            var socket = _a[0], id = _a[1];
            return id === roomPlayer.id;
        })) === null || _a === void 0 ? void 0 : _a[0];
        if (playerSocket && playerSocket.readyState === WebSocket.OPEN) {
            playerSocket.send(response);
        }
    });
    db_1.rooms.delete(roomId);
    ws.send(JSON.stringify({
        type: 'update_room',
        data: [
            {
                roomId: roomId,
                roomUsers: room.players.map(function (player) { return ({
                    name: player.username,
                    index: player.id
                }); })
            }
        ],
        id: 0
    }));
}
function handleAddShips(ws, request) {
    var _a = request.data, gameId = _a.gameId, ships = _a.ships, indexPlayer = _a.indexPlayer;
    var game = db_1.games.get(gameId);
    if (!game) {
        ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Game not found' },
            id: 0
        }));
        return;
    }
    game.players[indexPlayer] = __assign(__assign({}, game.players[indexPlayer]), { ships: ships });
    var allPlayersHaveShips = Object.values(game.players).every(function (player) { return player.ships && player.ships.length > 0; });
    if (allPlayersHaveShips) {
        for (var _i = 0, _b = Array.from(db_1.wsToPlayer.entries()); _i < _b.length; _i++) {
            var _c = _b[_i], socket = _c[0], playerId = _c[1];
            if (game.players[playerId]) {
                var startGameResponse = JSON.stringify({
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
    var _a;
    var _b = request.data, gameId = _b.gameId, x = _b.x, y = _b.y, indexPlayer = _b.indexPlayer;
    var game = db_1.games.get(gameId);
    if (!game || game.currentPlayer !== indexPlayer) {
        ws.send(JSON.stringify({ error: "Invalid game or not your turn" }));
        return;
    }
    var playerData = game.players[indexPlayer];
    var opponentId = Object.keys(game.players).find(function (id) { return id !== indexPlayer; });
    var opponentData = game.players[opponentId];
    if (playerData.shots.some(function (shot) { return shot.x === x && shot.y === y; })) {
        var errorMessage = {
            type: "error",
            data: {
                message: "You have already shot at this position.",
            },
            id: request.id,
        };
        ws.send(JSON.stringify(errorMessage));
        return;
    }
    var targetX = x !== null && x !== void 0 ? x : Math.floor(Math.random() * 10);
    var targetY = y !== null && y !== void 0 ? y : Math.floor(Math.random() * 10);
    playerData.shots.push({ x: targetX, y: targetY });
    var hit = false;
    var sunk = false;
    var shipType = "";
    var _loop_1 = function (playerId, opponentData_1) {
        for (var _e = 0, _f = opponentData_1.ships; _e < _f.length; _e++) {
            var ship = _f[_e];
            var positions = getShipPositions(ship);
            for (var _g = 0, positions_1 = positions; _g < positions_1.length; _g++) {
                var cell = positions_1[_g];
                if (cell.x === x && cell.y === y) {
                    hit = true;
                    sunk = positions.every(function (position) {
                        /*The some() method is used to check if any of the shots
                        taken by the opponent match the ship's positions. If all
                         positions of the ship are found in the opponentData.shots,
                        then the ship is considered sunk*/
                        return opponentData_1.shots.some(function (shot) { return shot.x === position.x && shot.y === position.y; });
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
    };
    for (var _i = 0, _c = Object.entries(game.players); _i < _c.length; _i++) {
        var _d = _c[_i], playerId = _d[0], opponentData_1 = _d[1];
        _loop_1(playerId, opponentData_1);
    }
    var attackFeedback = {
        type: "attack",
        data: {
            position: { x: x, y: y },
            currentPlayer: indexPlayer,
            status: hit ? (sunk ? "killed" : "shot") : "miss",
        },
        id: 0,
    };
    ws.send(JSON.stringify(attackFeedback));
    if (hit) {
        var allSunk = areAllShipsSunk(opponentData.ships, playerData.shots);
        if (allSunk) {
            var finishGameMessage = {
                type: "finish",
                data: {
                    winPlayer: indexPlayer,
                },
                id: request.id,
            };
            ws.send(JSON.stringify(finishGameMessage));
            var player = db_1.players.get(indexPlayer);
            if (player) {
                player.wins = ((_a = player.wins) !== null && _a !== void 0 ? _a : 0) + 1;
                var updateWinnersMessage = {
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
    var turnNotification = {
        type: "turn",
        data: {
            currentPlayer: Object.keys(game.players).find(function (playerId) { return playerId !== indexPlayer; }),
        },
        id: 0,
    };
    ws.send(JSON.stringify(turnNotification));
}
function getShipPositions(ship) {
    var positions = [];
    for (var i = 0; i < ship.length; i++) {
        var cell = {
            x: ship.direction ? ship.position.x + i : ship.position.x,
            y: ship.direction ? ship.position.y : ship.position.y + i,
        };
        positions.push(cell);
    }
    return positions;
}
function areAllShipsSunk(ships, shots) {
    return ships.every(function (ship) {
        var positions = getShipPositions(ship);
        return positions.every(function (pos) { return shots.some(function (shot) { return shot.x === pos.x && shot.y === pos.y; }); });
    });
}

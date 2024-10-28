"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ws_1 = require("ws");
var dotenv = require("dotenv");
var handleGameLogic_1 = require("./game/handleGameLogic");
dotenv.config();
var PORT = process.env.PORT || 8081;
var server = new ws_1.WebSocketServer({ port: Number(PORT) });
server.on('connection', function (ws) {
    console.log("User connected");
    ws.on('message', function (message) {
        try {
            var request = JSON.parse(message);
            console.log('message received');
            (0, handleGameLogic_1.handleRequest)(ws, request, server);
        }
        catch (error) {
            console.error(error);
            ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Invalid message format.' },
                id: 0
            }));
        }
    });
    ws.on('close', function () {
        console.log("Bye players. (DISCONNECTED)");
    });
});
console.log("Server is running on port: ".concat(PORT));
function shutdown() {
    console.log('Closing server...');
    server.clients.forEach(function (client) {
        client.close(1000, 'Server shutdown');
    });
    server.close(function (err) {
        if (err) {
            console.error('Error closing server');
        }
        else {
            console.log('Server closed successfully');
        }
    });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
/*When the shutdown function iterates over server.clients and calls
client.close(1000, 'Server shutdown');, each client connection
receives a close message with the normal WebSocket closure code (1000).
This allows clients to handle the disconnection gracefully on their end,
rather than just being abruptly cut off, which can otherwise lead to zombie
connections if clients continue attempting to send messages to an unavailable
server.
WebSocket connection close code:
https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code
*/ 

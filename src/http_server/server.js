import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { handleRequest } from './game/handleGameLogic.js';
dotenv.config();
const PORT = process.env.PORT || 8081;
const server = new WebSocketServer({ port: Number(PORT) });
server.on('connection', (ws) => {
    console.log("User connected");
    ws.on('message', (message) => {
        try {const request = JSON.parse(message);
        handleRequest(ws, request, server);
    } catch(error) {
        console.error(error);
        ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Invalid message format.' },
            id: 0
        }));
    }
    });
    ws.on('close', () => {
        console.log("Bye player. (DISCONNECTED)");
    });
});
console.log(`Server is running on port: ${PORT}`);
function shutdown() {
    console.log('Closing server...');
    server.clients.forEach((client) => {
        client.close(1000, 'Server shutdown');
    });
    server.close((err) => {
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

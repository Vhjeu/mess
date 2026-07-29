import { io } from 'socket.io-client';
import { SOCKET_ORIGIN } from '../config/env';

let socket;

export const connectSocket = (token) => {
    socket = io(SOCKET_ORIGIN, {
        path: '/socket.io',
        auth: { token },
        autoConnect: false,
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
    });

    socket.on('connect', () => {
        console.info('[socket.io]', {
            stage: 'connected',
            origin: SOCKET_ORIGIN,
            transport: socket.io.engine.transport.name
        });
    });
    socket.on('connect_error', error => {
        console.error('[socket.io]', {
            stage: 'connect_error',
            origin: SOCKET_ORIGIN,
            message: error.message
        });
    });
    socket.on('disconnect', reason => {
        console.info('[socket.io]', {
            stage: 'disconnected',
            origin: SOCKET_ORIGIN,
            reason
        });
    });
    socket.io.on('reconnect_attempt', attempt => {
        console.info('[socket.io]', {
            stage: 'reconnect_attempt',
            origin: SOCKET_ORIGIN,
            attempt
        });
    });
    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

export const getSocket = () => socket;

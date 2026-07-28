import { io } from 'socket.io-client';
import { API_ORIGIN } from '../config/env';

let socket;

export const connectSocket = (token) => {
    socket = io(API_ORIGIN, {
        auth: { token }
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

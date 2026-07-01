import { io } from 'socket.io-client';

const URL = 'http://localhost:5000';

let socket;

export const connectSocket = (token) => {
    socket = io(URL, {
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
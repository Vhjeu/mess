import { createContext, useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../socket/socket';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [onlineUsers, setOnlineUsers] = useState(new Set()); // Set các userId đang online
    const [socket, setSocket] = useState(null);
    const socketRef = useRef(null);

    // Một socket cho mỗi tab; snapshot là nguồn khởi tạo và được tải lại sau reconnect.
    useEffect(() => {
        if (!user?.id) return undefined;

        const token = localStorage.getItem('token');
        if (!token) return undefined;

        const newSocket = connectSocket(token);
        socketRef.current = newSocket;
        setSocket(newSocket);

        const normalizeUserIds = userIds => new Set(
            (Array.isArray(userIds) ? userIds : [])
                .map(Number)
                .filter(userId => Number.isInteger(userId) && userId > 0)
        );
        const applyPresenceSnapshot = ({ userIds } = {}) => {
            setOnlineUsers(normalizeUserIds(userIds));
        };
        const requestPresenceSnapshot = () => {
            newSocket.timeout(5000).emit('presence:get', (error, response) => {
                if (!error) applyPresenceSnapshot(response);
            });
        };
        const handleOnline = ({ userId }) => {
            const normalizedUserId = Number(userId);
            if (!Number.isInteger(normalizedUserId)) return;
            setOnlineUsers(previous => new Set(previous).add(normalizedUserId));
        };
        const handleOffline = ({ userId }) => {
            const normalizedUserId = Number(userId);
            if (!Number.isInteger(normalizedUserId)) return;
            setOnlineUsers(previous => {
                const next = new Set(previous);
                next.delete(normalizedUserId);
                return next;
            });
        };
        const handleProfileUpdated = ({ user: updatedUser }) => {
            if (!updatedUser?.id) return;
            setUser(currentUser => (
                Number(currentUser?.id) === Number(updatedUser.id)
                    ? { ...currentUser, ...updatedUser }
                    : currentUser
            ));
        };
        const ensureConnectedAndSynced = () => {
            if (!newSocket.connected) {
                newSocket.connect();
            } else {
                requestPresenceSnapshot();
            }
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                ensureConnectedAndSynced();
            }
        };

        newSocket.on('connect', requestPresenceSnapshot);
        newSocket.on('presence:snapshot', applyPresenceSnapshot);
        newSocket.on('user:online', handleOnline);
        newSocket.on('user:offline', handleOffline);
        newSocket.on('user:profile-updated', handleProfileUpdated);
        window.addEventListener('online', ensureConnectedAndSynced);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        newSocket.connect();

        return () => {
            window.removeEventListener('online', ensureConnectedAndSynced);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            newSocket.off('connect', requestPresenceSnapshot);
            newSocket.off('presence:snapshot', applyPresenceSnapshot);
            newSocket.off('user:online', handleOnline);
            newSocket.off('user:offline', handleOffline);
            newSocket.off('user:profile-updated', handleProfileUpdated);
            newSocket.disconnect();
            if (socketRef.current === newSocket) socketRef.current = null;
            setSocket(current => (current === newSocket ? null : current));
        };
    }, [user?.id]);

    useEffect(() => {
        // Kiểm tra token và lấy user info
        const token = localStorage.getItem('token');
        if (token) {
            api.get('/users/me')
                .then(res => {
                    setUser(res.data);
                })
                .catch(() => {
                    localStorage.removeItem('token');
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const loginContext = (token, userData) => {
        localStorage.setItem('token', token);
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        if (socketRef.current) {
            disconnectSocket();
            socketRef.current = null;
        }
        setSocket(null);
        setOnlineUsers(new Set());
    };

    return (
        <AuthContext.Provider value={{ user, loading, loginContext, logout, onlineUsers, socket, setUser }}>
            {children}
        </AuthContext.Provider>
    );
};

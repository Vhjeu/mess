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

    // Kết nối socket khi có user
    useEffect(() => {
        if (user && !socketRef.current) {
            const token = localStorage.getItem('token');
            if (token) {
                const newSocket = connectSocket(token);
                socketRef.current = newSocket;
                setSocket(newSocket);

                newSocket.on('user:online', ({ userId }) => {
                    setOnlineUsers(prev => new Set(prev).add(userId));
                });

                newSocket.on('user:offline', ({ userId }) => {
                    setOnlineUsers(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(userId);
                        return newSet;
                    });
                });
            }
        }

        return () => {
            if (!user && socketRef.current) {
                disconnectSocket();
                socketRef.current = null;
                setSocket(null);
            }
        };
    }, [user]);

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
        <AuthContext.Provider value={{ user, loading, loginContext, logout, onlineUsers, socket }}>
            {children}
        </AuthContext.Provider>
    );
};
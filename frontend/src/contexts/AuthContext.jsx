import { createContext, useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { connectSocket, disconnectSocket, getSocket } from '../socket/socket';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [onlineUsers, setOnlineUsers] = useState(new Set()); // Set các userId đang online
    const socketRef = useRef(null);

    // Kết nối socket khi có user
    useEffect(() => {
        if (user && !socketRef.current) {
            const token = localStorage.getItem('token');
            if (token) {
                const socket = connectSocket(token);
                socketRef.current = socket;

                socket.on('user:online', ({ userId }) => {
                    setOnlineUsers(prev => new Set(prev).add(userId));
                });

                socket.on('user:offline', ({ userId }) => {
                    setOnlineUsers(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(userId);
                        return newSet;
                    });
                });

                // Lấy danh sách online ban đầu (có thể gọi API hoặc emit event)
                // Tạm thời không có, sẽ cập nhật dần qua các sự kiện.
            }
        }

        return () => {
            // Cleanup khi user logout hoặc component unmount
            if (!user && socketRef.current) {
                disconnectSocket();
                socketRef.current = null;
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
        setOnlineUsers(new Set());
    };

    return (
        <AuthContext.Provider value={{ user, loading, loginContext, logout, onlineUsers, socket: socketRef.current }}>
            {children}
        </AuthContext.Provider>
    );
};
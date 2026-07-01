import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsers } from '../services/userService';
import { createOrGetConversation } from '../services/conversationService';
import { useAuth } from '../hooks/useAuth';
import { getAvatarUrl } from '../utils/avatar';

const UsersPage = () => {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [startingChat, setStartingChat] = useState(null); // userId đang xử lý

    const navigate = useNavigate();
    const { user, onlineUsers, socket } = useAuth();
    const fetchUsers = useCallback(async (query) => {
        try {
            setLoading(true);
            const data = await getUsers(query);
            setUsers(data);
        } catch (error) {
            console.error('Lỗi tải danh sách người dùng:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers(search);
    }, [search, fetchUsers]);

    const handleStartChat = async (userId) => {
        setStartingChat(userId);
        try {
            const result = await createOrGetConversation(userId);
            if (socket) {
                socket.emit('conversation:created', {
                    conversationId: result.conversation_id,
                    members: [user.id, userId]
                });
            }
            navigate(`/chat/${result.conversation_id}`);
        } catch (error) {
            console.error('Lỗi tạo cuộc trò chuyện:', error);
            alert('Không thể tạo cuộc trò chuyện');
        } finally {
            setStartingChat(null);
        }
    };

    return (
        <div className="p-4 h-100 d-flex flex-column">
            <h4 className="fw-bold mb-3">Danh sách người dùng</h4>

            {/* Ô tìm kiếm */}
            <div className="mb-3">
                <div className="input-group">
                    <span className="input-group-text bg-white"><i className="bi bi-search"></i></span>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Tìm kiếm người dùng..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Danh sách */}
            <div className="flex-grow-1 overflow-auto">
                {loading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status"></div>
                    </div>
                ) : users.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                        <i className="bi bi-person-x display-4"></i>
                        <p>Không tìm thấy người dùng</p>
                    </div>
                ) : (
                    <div className="list-group">
                        {users.map(u => {
                            const isOnline = onlineUsers.has(u.id);
                            return (
                                <div key={u.id} className="list-group-item d-flex align-items-center justify-content-between py-3 border-0 border-bottom rounded-0">
                                    <div className="d-flex align-items-center">
                                        <div className="position-relative me-3">
                                            <div className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center"
                                                style={{ width: '44px', height: '44px', fontSize: '18px' }}>
                                                {u.avatar_url ? (
                                                    <img src={getAvatarUrl(u.avatar_url)} alt="avatar" className="rounded-circle" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    u.username.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            {isOnline && (
                                                <span className="position-absolute bottom-0 end-0 bg-success rounded-circle border border-white"
                                                    style={{ width: '12px', height: '12px' }}></span>
                                            )}
                                        </div>
                                        <div>
                                            <div className="fw-semibold text-dark dark:text-white">{u.username}</div>
                                            <small className="text-muted">{isOnline ? 'Đang online' : 'Offline'}</small>
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-primary btn-sm rounded-pill px-3"
                                        onClick={() => handleStartChat(u.id)}
                                        disabled={startingChat === u.id}
                                    >
                                        {startingChat === u.id ? (
                                            <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                                        ) : (
                                            <i className="bi bi-chat-dots me-1"></i>
                                        )}
                                        Nhắn tin
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UsersPage;
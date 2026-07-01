import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getConversations } from '../../services/conversationService';
import ConversationItem from './ConversationItem';

const getNicknameMap = () => {
    if (typeof window === 'undefined') return {};
    try {
        return JSON.parse(localStorage.getItem('chatNicknames') || '{}');
    } catch {
        return {};
    }
};

const Sidebar = () => {
    const { user, onlineUsers, socket, logout } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [nicknameMap, setNicknameMap] = useState(getNicknameMap);
    const navigate = useNavigate();

    const fetchConversations = useCallback(async () => {
        try {
            const data = await getConversations();
            setConversations(data);
        } catch (error) {
            console.error('Lỗi tải cuộc trò chuyện:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    // Lắng nghe sự kiện cập nhật danh sách conversation
    useEffect(() => {
        if (!socket) return;
        socket.on('conversations:update', () => {
            fetchConversations();
        });
        return () => {
            socket.off('conversations:update');
        };
    }, [socket, fetchConversations]);

    const filteredConversations = conversations.filter(conv => {
        if (!search.trim()) return true;
        const memberNames = conv.members.map(m => (nicknameMap[m.id] || m.username).toLowerCase());
        return memberNames.some(name => name.includes(search.toLowerCase()));
    });

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="d-flex flex-column h-100 bg-white border-end shadow-sm">
            {/* Header: user info */}
            <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                    <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-2" style={{ width: '40px', height: '40px', fontSize: '18px' }}>
                        {user?.avatar_url ? (
                            <img src={user.avatar_url} alt="avatar" className="rounded-circle" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            user?.username?.charAt(0).toUpperCase()
                        )}
                    </div>
                    <div>
                        <div className="fw-semibold">{user?.username}</div>
                    </div>
                </div>
                <div className="d-flex gap-2">
                    <NavLink to="/users" className="btn btn-light btn-sm rounded-circle" title="Danh sách người dùng">
                        <i className="bi bi-people"></i>
                    </NavLink>
                    <button className="btn btn-light btn-sm rounded-circle" onClick={handleLogout} title="Đăng xuất">
                        <i className="bi bi-box-arrow-right"></i>
                    </button>
                </div>
            </div>

            {/* Ô tìm kiếm */}
            <div className="p-2">
                <div className="input-group">
                    <span className="input-group-text bg-light border-0"><i className="bi bi-search"></i></span>
                    <input
                        type="text"
                        className="form-control bg-light border-0"
                        placeholder="Tìm kiếm cuộc trò chuyện..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Danh sách cuộc trò chuyện */}
            <div className="flex-grow-1 overflow-auto">
                {loading ? (
                    <div className="text-center py-4">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Đang tải...</span>
                        </div>
                    </div>
                ) : filteredConversations.length > 0 ? (
                    filteredConversations.map(conv => (
                        <ConversationItem
                            key={conv.id}
                            conversation={conv}
                            currentUserId={user.id}
                            onlineUsers={onlineUsers}
                            nicknameMap={nicknameMap}
                        />
                    ))
                ) : (
                    <div className="text-center py-5 text-muted">
                        <i className="bi bi-chat-dots display-6"></i>
                        <p>Không có cuộc trò chuyện nào</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Sidebar;
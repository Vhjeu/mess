import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getConversations } from '../../services/conversationService';
import ConversationItem from './ConversationItem';
import { ThemeContext } from '../../contexts/ThemeContext';
import { getAvatarUrl } from '../../utils/avatar';

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
    const { theme, toggleTheme } = useContext(ThemeContext);
    const [conversations, setConversations] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [nicknameMap, setNicknameMap] = useState(getNicknameMap);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const logoutRef = useRef(null);
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

    const handleLogoutClick = () => {
        setShowLogoutConfirm(true);
    };

    const handleLogoutConfirm = () => {
        logout();
        setShowLogoutConfirm(false);
        navigate('/login');
    };

    const handleLogoutCancel = () => {
        setShowLogoutConfirm(false);
    };

    useEffect(() => {
        if (!showLogoutConfirm) return;

        const handleClickOutside = (event) => {
            if (logoutRef.current && !logoutRef.current.contains(event.target)) {
                setShowLogoutConfirm(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showLogoutConfirm]);

    return (
        <div className="d-flex flex-column h-100">
            {/* Header: user info */}
            <div className="sidebar-header">
                <div className="user-summary" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
                    <div className="avatar-wrapper">
                        {user?.avatar_url ? (
                            <img src={getAvatarUrl(user.avatar_url)} alt="avatar" />
                        ) : (
                            <div className="avatar-fallback bg-primary d-flex align-items-center justify-content-center text-white">
                                {(user?.display_name || user?.username)?.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className="status-badge" />
                    </div>
                    <div>
                        <div className="fw-semibold text-dark dark:text-white">{user?.display_name || user?.username}</div>
                        <small className="text-secondary">Trực tuyến</small>
                    </div>
                </div>
                <div className="sidebar-actions">
                    <button className="sidebar-action-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Chuyển sang sáng' : 'Chuyển sang tối'}>
                        <i className={`bi ${theme === 'dark' ? 'bi-sun' : 'bi-moon'}`}></i>
                    </button>
                    <button className="sidebar-action-btn" onClick={() => navigate('/users')} title="Tạo cuộc trò chuyện mới">
                        <i className="bi bi-plus" />
                    </button>
                    <div className="sidebar-action-group" ref={logoutRef}>
                        <button className="sidebar-action-btn" onClick={handleLogoutClick} title="Đăng xuất">
                            <i className="bi bi-box-arrow-right" />
                        </button>
                        {showLogoutConfirm && (
                            <div className="logout-popover" role="dialog" aria-modal="true">
                                <div className="logout-popover-content">
                                    <div className="logout-popover-title">Xác nhận đăng xuất</div>
                                    <div className="logout-popover-text">Bạn có chắc chắn muốn đăng xuất không?</div>
                                    <div className="d-flex gap-2 mt-3">
                                        <button type="button" className="btn btn-outline-secondary btn-sm flex-fill" onClick={handleLogoutCancel}>Hủy</button>
                                        <button type="button" className="btn btn-danger btn-sm flex-fill" onClick={handleLogoutConfirm}>Đăng xuất</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Ô tìm kiếm */}
            <div className="sidebar-search">
                <div className="search-box">
                    <i className="bi bi-search text-secondary"></i>
                    <input
                        type="text"
                        placeholder="Tìm kiếm cuộc trò chuyện..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Danh sách cuộc trò chuyện */}
            <div className="conversation-list">
                {loading ? (
                    <>
                        <div className="skeleton-row"></div>
                        <div className="skeleton-row"></div>
                        <div className="skeleton-row"></div>
                    </>
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
                    <div className="empty-state">
                        <i className="bi bi-chat-dots"></i>
                        <div className="fw-semibold">Chưa có cuộc trò chuyện nào</div>
                        <p className="mb-0">Bắt đầu trò chuyện với bạn bè ngay thôi.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Sidebar;
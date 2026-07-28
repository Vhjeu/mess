import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { deleteConversation, getConversations } from '../../services/conversationService';
import ConversationItem from './ConversationItem';
import DeleteConversationModal from './DeleteConversationModal';
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
    const [nicknameMap] = useState(getNicknameMap);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [toast, setToast] = useState('');
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

    const handleDeleteRequest = (conversation) => {
        setDeleteTarget(conversation);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;

        try {
            setDeleting(true);
            await deleteConversation(deleteTarget.id);
            setConversations(prev => prev.filter(conv => conv.id !== deleteTarget.id));
            setDeleteTarget(null);
            setToast('Đã xóa cuộc trò chuyện.');
            if (window.location.pathname === `/chat/${deleteTarget.id}`) {
                navigate('/');
            }
        } catch (error) {
            console.error('Lỗi xóa cuộc trò chuyện:', error);
            setToast('Không thể xóa cuộc trò chuyện lúc này.');
        } finally {
            setDeleting(false);
        }
    };

    useEffect(() => {
        if (!toast) return;
        const timer = window.setTimeout(() => setToast(''), 2200);
        return () => window.clearTimeout(timer);
    }, [toast]);

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
        <div className="sidebar-content">
            <div className="sidebar-header">
                <button className="sidebar-brand" type="button" onClick={() => navigate('/')} aria-label="Về trang tin nhắn">
                    <span className="sidebar-brand-mark">
                        <i className="bi bi-chat-heart-fill"></i>
                    </span>
                    <span>
                        <strong>Nhắn Tin</strong>
                        <small>Không gian trò chuyện</small>
                    </span>
                </button>
                <div className="sidebar-actions">
                    <button className="sidebar-action-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Chuyển sang sáng' : 'Chuyển sang tối'} aria-label={theme === 'dark' ? 'Chuyển sang sáng' : 'Chuyển sang tối'}>
                        <i className={`bi ${theme === 'dark' ? 'bi-sun' : 'bi-moon'}`}></i>
                    </button>
                    <button className="sidebar-action-btn sidebar-action-btn--primary" onClick={() => navigate('/users')} title="Tạo cuộc trò chuyện mới" aria-label="Tạo cuộc trò chuyện mới">
                        <i className="bi bi-pencil-square" />
                    </button>
                </div>
            </div>

            <div className="sidebar-search">
                <div className="search-box">
                    <i className="bi bi-search"></i>
                    <input
                        type="text"
                        placeholder="Tìm cuộc trò chuyện"
                        aria-label="Tìm cuộc trò chuyện"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                        <button type="button" onClick={() => setSearch('')} aria-label="Xóa nội dung tìm kiếm">
                            <i className="bi bi-x-circle-fill"></i>
                        </button>
                    )}
                </div>
            </div>

            <div className="sidebar-section-title">
                <span>Trò chuyện gần đây</span>
                {!loading && <small>{filteredConversations.length}</small>}
            </div>

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
                            onDeleteConversation={handleDeleteRequest}
                        />
                    ))
                ) : (
                    <div className="empty-state">
                        <span className="empty-state-icon"><i className="bi bi-chat-dots"></i></span>
                        <strong>Chưa có cuộc trò chuyện</strong>
                        <p>Bắt đầu kết nối với một người bạn mới.</p>
                        <button type="button" className="app-button app-button--primary" onClick={() => navigate('/users')}>
                            <i className="bi bi-plus-lg"></i>
                            Tin nhắn mới
                        </button>
                    </div>
                )}
            </div>

            <div className="sidebar-profile-row">
                <button className="user-summary" onClick={() => navigate('/profile')} type="button">
                    <div className="avatar-wrapper">
                        {user?.avatar_url ? (
                            <img src={getAvatarUrl(user.avatar_url)} alt="" />
                        ) : (
                            <div className="avatar-fallback">
                                {(user?.display_name || user?.username)?.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className="status-badge" />
                    </div>
                    <div className="user-summary-meta">
                        <strong>{user?.display_name || user?.username}</strong>
                        <small><span></span>Đang hoạt động</small>
                    </div>
                    <i className="bi bi-chevron-right user-summary-arrow"></i>
                </button>
                <div className="sidebar-action-group" ref={logoutRef}>
                    <button className="sidebar-action-btn sidebar-logout-btn" onClick={handleLogoutClick} title="Đăng xuất" aria-label="Đăng xuất">
                        <i className="bi bi-box-arrow-right" />
                    </button>
                    {showLogoutConfirm && (
                        <div className="logout-popover" role="dialog" aria-modal="true">
                            <div className="logout-popover-content">
                                <div className="logout-popover-icon">
                                    <i className="bi bi-box-arrow-right"></i>
                                </div>
                                <div className="logout-popover-title">Đăng xuất tài khoản?</div>
                                <div className="logout-popover-text">Bạn sẽ cần đăng nhập lại để tiếp tục trò chuyện.</div>
                                <div className="logout-popover-actions">
                                    <button type="button" className="app-button app-button--secondary" onClick={handleLogoutCancel}>Ở lại</button>
                                    <button type="button" className="app-button app-button--danger" onClick={handleLogoutConfirm}>Đăng xuất</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {toast && (
                <div className="app-toast">{toast}</div>
            )}

            <DeleteConversationModal
                open={Boolean(deleteTarget)}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDeleteConfirm}
                loading={deleting}
            />
        </div>
    );
};

export default Sidebar;

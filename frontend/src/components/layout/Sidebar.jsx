import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { deleteConversation, getConversations } from '../../services/conversationService';
import ConversationItem from './ConversationItem';
import DeleteConversationModal from './DeleteConversationModal';
import { ThemeContext } from '../../contexts/ThemeContext';
import { getAvatarUrl } from '../../utils/avatar';
import { getNicknames } from '../../services/userService';

const sortConversations = (items) => [...items].sort((a, b) => {
    const aTime = new Date(a.lastMessage?.created_at || a.created_at).getTime();
    const bTime = new Date(b.lastMessage?.created_at || b.created_at).getTime();
    if (bTime !== aTime) return bTime - aTime;
    return Number(b.lastMessage?.id || 0) - Number(a.lastMessage?.id || 0);
});

const Sidebar = () => {
    const { user, onlineUsers, socket, logout } = useAuth();
    const { theme, toggleTheme } = useContext(ThemeContext);
    const [conversations, setConversations] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [nicknameMap, setNicknameMap] = useState({});
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [toast, setToast] = useState('');
    const [resolvedActiveConversationId, setResolvedActiveConversationId] = useState(null);
    const logoutRef = useRef(null);
    const fetchRequestRef = useRef(0);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        setResolvedActiveConversationId(null);
    }, [location.pathname]);

    useEffect(() => {
        const handleConversationResolved = ({ detail }) => {
            const resolvedConversation = detail?.conversation;
            if (!resolvedConversation?.id) return;
            setResolvedActiveConversationId(Number(resolvedConversation.id));
            setConversations(currentConversations => {
                const withoutResolved = currentConversations.filter(
                    item => Number(item.id) !== Number(resolvedConversation.id)
                );
                return sortConversations([resolvedConversation, ...withoutResolved]);
            });
        };

        window.addEventListener('conversation:resolved', handleConversationResolved);
        return () => {
            window.removeEventListener('conversation:resolved', handleConversationResolved);
        };
    }, []);

    const fetchConversations = useCallback(async () => {
        const requestId = ++fetchRequestRef.current;
        try {
            const data = await getConversations();
            if (requestId === fetchRequestRef.current) {
                setConversations(sortConversations(data));
            }
        } catch (error) {
            console.error('Lỗi tải cuộc trò chuyện:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    useEffect(() => {
        let active = true;
        getNicknames()
            .then(data => {
                if (active) setNicknameMap(data);
            })
            .catch(error => console.error('Lỗi tải biệt danh:', error));

        return () => {
            active = false;
        };
    }, [user?.id]);

    useEffect(() => {
        const handleNicknameUpdated = ({ detail }) => {
            const targetUserId = detail?.target_user_id;
            if (!targetUserId) return;

            setNicknameMap(current => {
                const next = { ...current };
                if (detail.nickname) {
                    next[targetUserId] = detail.nickname;
                } else {
                    delete next[targetUserId];
                }
                return next;
            });
        };

        window.addEventListener('nickname:updated', handleNicknameUpdated);
        return () => window.removeEventListener('nickname:updated', handleNicknameUpdated);
    }, []);

    // Lắng nghe sự kiện cập nhật danh sách conversation
    useEffect(() => {
        if (!socket) return;

        const handleConversationUpdate = (payload) => {
            if (payload?.conversationId && payload?.lastMessage) {
                setConversations(prev => {
                    const index = prev.findIndex(conv => Number(conv.id) === Number(payload.conversationId));
                    if (index < 0) return prev;

                    const existing = prev[index];
                    const isIncoming = Number(payload.lastMessage.sender_id) !== Number(user?.id);
                    const updated = {
                        ...existing,
                        lastMessage: payload.lastMessage,
                        unread_count: isIncoming ? Math.max(1, existing.unread_count || 0) : 0
                    };

                    return sortConversations([
                        updated,
                        ...prev.filter((_, itemIndex) => itemIndex !== index)
                    ]);
                });
            }

            fetchConversations();
        };

        const handleConversationDeleted = ({ conversationId }) => {
            setConversations(prev => prev.filter(conv => Number(conv.id) !== Number(conversationId)));
            if (window.location.pathname === `/chat/${conversationId}`) {
                navigate('/');
            }
        };

        const handleUserProfileUpdated = ({ user: updatedUser }) => {
            if (!updatedUser?.id) return;

            setConversations(prev => prev.map(conversation => ({
                ...conversation,
                members: conversation.members.map(member => (
                    Number(member.id) === Number(updatedUser.id)
                        ? { ...member, ...updatedUser }
                        : member
                ))
            })));
        };

        const handleNicknameUpdated = ({ target_user_id: targetUserId, nickname }) => {
            if (!targetUserId) return;

            setNicknameMap(current => {
                const next = { ...current };
                if (nickname) {
                    next[targetUserId] = nickname;
                } else {
                    delete next[targetUserId];
                }
                return next;
            });
        };

        socket.on('conversations:update', handleConversationUpdate);
        socket.on('conversation:deleted', handleConversationDeleted);
        socket.on('user:profile-updated', handleUserProfileUpdated);
        socket.on('nickname:updated', handleNicknameUpdated);

        return () => {
            socket.off('conversations:update', handleConversationUpdate);
            socket.off('conversation:deleted', handleConversationDeleted);
            socket.off('user:profile-updated', handleUserProfileUpdated);
            socket.off('nickname:updated', handleNicknameUpdated);
        };
    }, [socket, fetchConversations, navigate, user?.id]);

    const filteredConversations = conversations.filter(conv => {
        if (!search.trim()) return true;
        const memberNames = conv.members.map(m => (
            nicknameMap[m.id] || m.display_name || m.username
        ).toLowerCase());
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
                <button className="user-summary sidebar-header-account" onClick={() => navigate('/profile')} type="button" aria-label="Mở hồ sơ cá nhân">
                    <div className="avatar-wrapper">
                        <div className="avatar-wrapper-media">
                            {user?.avatar_url ? (
                                <img src={getAvatarUrl(user.avatar_url)} alt="" />
                            ) : (
                                <div className="avatar-fallback">
                                    {(user?.display_name || user?.username)?.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <span className="status-badge" />
                    </div>
                    <div className="user-summary-meta">
                        <strong>{user?.display_name || user?.username}</strong>
                        <small>Đang hoạt động</small>
                    </div>
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
                            forceActive={
                                Number(conv.id) === Number(resolvedActiveConversationId)
                            }
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

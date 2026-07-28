import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsers } from '../services/userService';
import { createOrGetConversation } from '../services/conversationService';
import { useAuth } from '../hooks/useAuth';
import { getAvatarUrl, getDefaultAvatarUrl } from '../utils/avatar';

const UsersPage = () => {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [startingChat, setStartingChat] = useState(null); // userId đang xử lý

    const navigate = useNavigate();
    const { onlineUsers, socket } = useAuth();
    const handleAvatarError = (event) => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = getDefaultAvatarUrl();
    };

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

    useEffect(() => {
        if (!socket) return undefined;

        const handleUserProfileUpdated = ({ user: updatedUser }) => {
            if (!updatedUser?.id) return;

            setUsers(currentUsers => currentUsers.map(currentUser => (
                Number(currentUser.id) === Number(updatedUser.id)
                    ? { ...currentUser, ...updatedUser }
                    : currentUser
            )));
        };

        socket.on('user:profile-updated', handleUserProfileUpdated);
        return () => socket.off('user:profile-updated', handleUserProfileUpdated);
    }, [socket]);

    const handleStartChat = async (userId) => {
        setStartingChat(userId);
        try {
            const result = await createOrGetConversation(userId);
            navigate(
                result.conversation_id
                    ? `/chat/${result.conversation_id}`
                    : `/chat/new/${userId}`
            );
        } catch (error) {
            console.error('Lỗi mở khung trò chuyện:', error);
            alert('Không thể mở khung trò chuyện');
        } finally {
            setStartingChat(null);
        }
    };

    return (
        <div className="section-page">
            <header className="section-page-header">
                <button className="section-back-button" type="button" onClick={() => navigate(-1)} aria-label="Quay lại">
                    <i className="bi bi-arrow-left"></i>
                </button>
                <div>
                    <span className="section-eyebrow">Kết nối</span>
                    <h1>Tin nhắn mới</h1>
                    <p>Tìm một người và bắt đầu cuộc trò chuyện.</p>
                </div>
            </header>

            <div className="section-search">
                <i className="bi bi-search"></i>
                <input
                    type="text"
                    placeholder="Tìm theo tên hiển thị hoặc tài khoản"
                    aria-label="Tìm kiếm người dùng"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                    <button type="button" onClick={() => setSearch('')} aria-label="Xóa nội dung tìm kiếm">
                        <i className="bi bi-x-circle-fill"></i>
                    </button>
                )}
            </div>

            <div className="section-content">
                <div className="section-content-heading">
                    <strong>Mọi người</strong>
                    {!loading && <span>{users.length} kết quả</span>}
                </div>

                <div className="people-list">
                    {loading ? (
                        <div className="content-loader">
                            <span className="app-loader-spinner"></span>
                            <span>Đang tìm người dùng...</span>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="empty-state empty-state--page">
                            <span className="empty-state-icon"><i className="bi bi-person-x"></i></span>
                            <strong>Không tìm thấy người dùng</strong>
                            <p>Thử tìm với một tên hoặc từ khóa khác.</p>
                        </div>
                    ) : (
                        users.map(u => {
                            const isOnline = onlineUsers.has(u.id);
                            return (
                                <div key={u.id} className="person-row">
                                    <div className="person-main">
                                        <div className="person-avatar">
                                            <span className="person-avatar-media">
                                                {u.avatar_url ? (
                                                    <img
                                                        src={getAvatarUrl(u.avatar_url)}
                                                        alt=""
                                                        onError={handleAvatarError}
                                                    />
                                                ) : (
                                                    <span>{(u.display_name || u.username).charAt(0).toUpperCase()}</span>
                                                )}
                                            </span>
                                            {isOnline && <span className="online-dot"></span>}
                                        </div>
                                        <div className="person-meta">
                                            <strong>{u.display_name || u.username}</strong>
                                            <span className={isOnline ? 'is-online' : ''}>
                                                <i></i>{isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        className="app-button app-button--primary person-action"
                                        onClick={() => handleStartChat(u.id)}
                                        disabled={startingChat === u.id}
                                    >
                                        {startingChat === u.id ? (
                                            <span className="button-spinner"></span>
                                        ) : (
                                            <i className="bi bi-chat-dots"></i>
                                        )}
                                        <span>Nhắn tin</span>
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default UsersPage;

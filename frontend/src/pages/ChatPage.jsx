import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getAvatarUrl } from '../utils/avatar';
import { getMessages, uploadImage, revokeMessage } from '../services/messageService';
import { getConversations } from '../services/conversationService'; // để lấy thông tin thành viên
import ChatMessage from '../components/chat/ChatMessage';
import ChatInput from '../components/chat/ChatInput';

const ChatPage = () => {
    const { conversationId } = useParams();
    const { user, socket, onlineUsers } = useAuth();
    const [messages, setMessages] = useState([]);
    const [conversation, setConversation] = useState(null); // thông tin conversation (members)
    const [loading, setLoading] = useState(true);
    const [showInfo, setShowInfo] = useState(false);
    const [notification, setNotification] = useState('');
    const [nicknameMap, setNicknameMap] = useState(() => {
        if (typeof window === 'undefined') return {};
        try {
            return JSON.parse(localStorage.getItem('chatNicknames') || '{}');
        } catch {
            return {};
        }
    });
    const [blockedUsers, setBlockedUsers] = useState(() => {
        if (typeof window === 'undefined') return [];
        try {
            return JSON.parse(localStorage.getItem('blockedUsers') || '[]').map(Number);
        } catch {
            return [];
        }
    });
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    const loadConversationData = useCallback(async () => {
        if (!conversationId) return;

        try {
            const msgs = await getMessages(conversationId);
            setMessages(msgs);

            const conversations = await getConversations();
            const conv = conversations.find(c => c.id === parseInt(conversationId));
            setConversation(conv);
        } catch (error) {
            console.error('Lỗi tải dữ liệu chat:', error);
            if (error.response?.status === 403) {
                alert('Bạn không có quyền truy cập cuộc trò chuyện này');
                navigate('/');
            }
        } finally {
            setLoading(false);
        }
    }, [conversationId, navigate]);

    // Lấy thông tin cuộc trò chuyện và tin nhắn ban đầu
    useEffect(() => {
        setLoading(true);
        loadConversationData();
    }, [loadConversationData]);

    // Tham gia room socket
    useEffect(() => {
        if (!socket || !conversationId) return;
        socket.emit('chat:join', parseInt(conversationId));

        return () => {
            socket.emit('chat:leave', parseInt(conversationId));
        };
    }, [socket, conversationId]);

    // Lắng nghe tin nhắn mới từ socket
    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (msg) => {
            if (msg.conversation_id === parseInt(conversationId) && !blockedUsers.includes(Number(msg.sender_id))) {
                setMessages(prev => [...prev, msg]);
            }
        };

        const handleRevokedMessage = ({ messageId, conversationId: convId }) => {
            if (convId !== parseInt(conversationId)) return;
            setMessages(prev => prev.map(msg => msg.id === messageId ? {
                ...msg,
                content: 'Tin nhắn đã được thu hồi',
                has_attachment: false,
                attachments: [],
                revoked: true
            } : msg));
        };

        socket.on('chat:message', handleNewMessage);
        socket.on('chat:message:revoked', handleRevokedMessage);

        return () => {
            socket.off('chat:message', handleNewMessage);
            socket.off('chat:message:revoked', handleRevokedMessage);
        };
    }, [socket, conversationId, blockedUsers]);

    useEffect(() => {
        localStorage.setItem('chatNicknames', JSON.stringify(nicknameMap));
    }, [nicknameMap]);

    useEffect(() => {
        localStorage.setItem('blockedUsers', JSON.stringify(blockedUsers));
        window.dispatchEvent(new Event('storage'));
    }, [blockedUsers]);

    // Cuộn xuống cuối khi có tin nhắn mới
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Gửi tin nhắn văn bản
    const handleSendMessage = (content) => {
        if (!socket || !content.trim()) return;
        socket.emit('chat:message', {
            conversationId: parseInt(conversationId),
            content: content.trim()
        }, (response) => {
            if (response?.error) {
                setNotification(response.error);
            } else {
                setNotification('');
            }
        });
    };

    // Gửi ảnh (upload file)
    const handleSendImage = async (file) => {
        if (!file || !conversationId) return;

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('conversationId', conversationId);

            const result = await uploadImage(formData);
            if (!result.fileUrl) {
                setNotification('Không thể gửi file');
                return;
            }

            setNotification('');
            // The uploaded attachment will be delivered through socket to the conversation room.
        } catch (error) {
            console.error('Upload file lỗi:', error);
            setNotification('Không thể gửi file');
        }
    };

    // Xác định tên và trạng thái người chat (trong chat 1-1)
    const currentUserId = user?.id ? Number(user.id) : null;
    const otherMembers = conversation?.members?.filter(m => Number(m.id) !== currentUserId) || [];
    const chatPartner = otherMembers.length > 0 ? otherMembers[0] : null;
    const chatPartnerId = chatPartner ? Number(chatPartner.id) : null;
    const isOnline = chatPartner ? onlineUsers.has(chatPartnerId) : false;
    const displayName = chatPartner ? (nicknameMap[chatPartnerId] || chatPartner.username) : 'Cuộc trò chuyện';
    const isBlocked = chatPartnerId !== null ? blockedUsers.includes(chatPartnerId) : false;
    const visibleMessages = messages;

    const handleNicknameChange = (e) => {
        if (!chatPartner) return;
        const value = e.target.value;
        setNicknameMap(prev => ({ ...prev, [chatPartner.id]: value }));
    };

    const handleRevokeMessage = async (messageId) => {
        if (!conversationId || !socket) return;

        try {
            await revokeMessage(parseInt(conversationId), messageId);
            setMessages(prev => prev.map(msg => msg.id === messageId ? {
                ...msg,
                content: 'Tin nhắn đã được thu hồi',
                has_attachment: false,
                attachments: [],
                revoked: true
            } : msg));
        } catch (error) {
            console.error('Thu hồi tin nhắn lỗi:', error);
            setNotification(error.response?.data?.message || 'Không thể thu hồi tin nhắn');
        }
    };

    const toggleBlockUser = () => {
        if (!chatPartnerId || !socket) return;
        const isNowBlocked = !blockedUsers.includes(chatPartnerId);

        const eventName = isNowBlocked ? 'chat:block-user' : 'chat:unblock-user';
        socket.emit(eventName, { targetUserId: chatPartnerId }, async (response) => {
            if (response?.error) {
                alert(response.error);
                return;
            }

            setBlockedUsers(prev => isNowBlocked
                ? [...new Set([...prev, chatPartnerId])]
                : prev.filter(id => id !== chatPartnerId));

            if (!isNowBlocked) {
                await loadConversationData();
            }
        });
    };

    if (!conversationId) {
        return (
            <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                <div className="text-center">
                    <i className="bi bi-chat-dots display-1"></i>
                    <h4>Chọn một cuộc trò chuyện</h4>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center h-100">
                <div className="spinner-border text-primary" role="status"></div>
            </div>
        );
    }

    return (
        <div className="d-flex h-100 chat-panel flex-column" style={{ minHeight: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div className="chat-topbar">
                {chatPartner ? (
                    <div className="partner-info">
                        <div className="avatar-lg">
                            {chatPartner.avatar_url ? (
                                <img src={getAvatarUrl(chatPartner.avatar_url)} alt="avatar" />
                            ) : (
                                <div className="avatar-fallback bg-primary d-flex align-items-center justify-content-center text-white">
                                    {chatPartner.username.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div className="partner-meta">
                            <div className="chat-title">{displayName}</div>
                            <div className="chat-status">{isOnline ? 'Đang online' : 'Offline'}</div>
                        </div>
                    </div>
                ) : (
                    <div className="partner-meta">
                        <div className="chat-title">Cuộc trò chuyện</div>
                    </div>
                )}

                <div className="chat-actions">
                    <button className="chat-action-btn" title="Gọi thoại">
                        <i className="bi bi-telephone-fill"></i>
                    </button>
                    <button className="chat-action-btn" title="Video call">
                        <i className="bi bi-camera-video-fill"></i>
                    </button>
                    <button className="chat-action-btn" onClick={() => setShowInfo(prev => !prev)} title="Thông tin người liên hệ">
                        <i className="bi bi-info-circle"></i>
                    </button>
                </div>
            </div>

            {notification && (
                <div className="alert alert-warning d-flex align-items-center justify-content-between mx-4 my-3 px-4 py-3 rounded-4 shadow-sm" role="alert">
                    <div>
                        <strong>Thông báo:</strong> {notification}
                    </div>
                    <button type="button" className="btn-close" aria-label="Close" onClick={() => setNotification('')} />
                </div>
            )}

            <div className="d-flex flex-grow-1" style={{ minHeight: 0, overflow: 'hidden' }}>
                <div className="d-flex flex-column flex-grow-1" style={{ minHeight: 0 }}>
                    {/* Danh sách tin nhắn */}
                    <div className="chat-messages">
                        {visibleMessages.length === 0 ? (
                            <div className="empty-state">
                                <i className="bi bi-chat-heart"></i>
                                <div className="fw-semibold">Chưa có tin nhắn</div>
                                <p className="mb-0">Hãy gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện.</p>
                            </div>
                        ) : (
                            visibleMessages.map(msg => (
                                <ChatMessage
                                    key={msg.id}
                                    message={msg}
                                    isOwn={msg.sender_id === user?.id}
                                    onRevoke={() => handleRevokeMessage(msg.id)}
                                />
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="chat-input-wrapper">
                        <ChatInput onSendMessage={handleSendMessage} onSendImage={handleSendImage} />
                    </div>
                </div>

                {showInfo && chatPartner && (
                    <div className="chat-info-panel">
                        <div className="chat-info-panel-header d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-uppercase text-muted small mb-1">Thông tin</div>
                                <div className="h5 mb-0">{displayName}</div>
                            </div>
                            <button className="chat-action-btn chat-info-close" onClick={() => setShowInfo(false)}>
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>
                        <div className="chat-info-panel-body">
                            <div className="chat-info-avatar mb-4">
                                {chatPartner.avatar_url ? (
                                    <img src={getAvatarUrl(chatPartner.avatar_url)} alt="avatar" />
                                ) : (
                                    <div className="avatar-fallback bg-primary d-flex align-items-center justify-content-center text-white">
                                        {chatPartner.username.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="text-center mb-4">
                                <div className="fw-semibold fs-5 mb-1">{displayName}</div>
                                <div className="badge rounded-pill bg-primary-soft text-primary px-3 py-2">
                                    {isOnline ? 'Đang online' : 'Offline'}
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="form-label small mb-2">Biệt danh</label>
                                <input
                                    type="text"
                                    className="form-control form-control-sm chat-info-input"
                                    value={nicknameMap[chatPartner.id] || ''}
                                    onChange={handleNicknameChange}
                                    placeholder="Nhập biệt danh..."
                                />
                            </div>

                            <button
                                className={`btn btn-sm w-100 chat-info-action ${isBlocked ? 'btn-outline-success' : 'btn-outline-danger'}`}
                                onClick={toggleBlockUser}
                            >
                                {isBlocked ? 'Bỏ chặn người này' : 'Chặn người này'}
                            </button>

                            {isBlocked && (
                                <div className="text-danger small mt-3 text-center">
                                    Bạn đã chặn người này. Tin nhắn từ họ sẽ bị ẩn khỏi màn hình.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatPage;
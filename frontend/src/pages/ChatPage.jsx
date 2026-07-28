import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
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
    const messagesContainerRef = useRef(null);
    const shouldAutoScrollRef = useRef(true);
    const previousConversationIdRef = useRef(conversationId);
    const previousMessageCountRef = useRef(0);
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

    const scrollToBottom = useCallback((behavior = 'auto') => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const targetScrollTop = container.scrollHeight - container.clientHeight;
        if (targetScrollTop > 0) {
            container.scrollTo({ top: targetScrollTop, behavior });
        } else {
            container.scrollTop = 0;
        }
    }, []);

    const handleMessagesScroll = () => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const distanceToBottom = container.scrollHeight - (container.scrollTop + container.clientHeight);
        shouldAutoScrollRef.current = distanceToBottom <= 40;
    };

    useEffect(() => {
        shouldAutoScrollRef.current = true;
        previousConversationIdRef.current = conversationId;
        previousMessageCountRef.current = 0;
    }, [conversationId]);

    useLayoutEffect(() => {
        if (loading || !messages.length) return;

        const shouldScroll = previousConversationIdRef.current !== conversationId
            || previousMessageCountRef.current === 0
            || shouldAutoScrollRef.current;

        if (shouldScroll) {
            requestAnimationFrame(() => scrollToBottom('auto'));
        }

        previousConversationIdRef.current = conversationId;
        previousMessageCountRef.current = messages.length;
    }, [conversationId, loading, messages.length, scrollToBottom]);

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
    const displayName = chatPartner ? (nicknameMap[chatPartnerId] || chatPartner.display_name || chatPartner.username) : 'Cuộc trò chuyện';
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
            <div className="chat-welcome">
                <div className="chat-welcome-visual">
                    <span className="chat-welcome-bubble chat-welcome-bubble--one"></span>
                    <span className="chat-welcome-bubble chat-welcome-bubble--two"></span>
                    <i className="bi bi-chat-heart-fill"></i>
                </div>
                <div>
                    <h1>Chọn một cuộc trò chuyện</h1>
                    <p>Tin nhắn, hình ảnh và tệp của bạn sẽ xuất hiện tại đây.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="content-loader" role="status">
                <span className="app-loader-spinner"></span>
                <span>Đang tải cuộc trò chuyện...</span>
            </div>
        );
    }

    return (
        <div className="chat-view">
            <div className="chat-workspace">
                <div className="chat-main">
                    <div className="chat-topbar">
                        <div className="chat-topbar-inner">
                            {chatPartner ? (
                                <div className="partner-info">
                                    <button
                                        type="button"
                                        className="mobile-back-button"
                                        onClick={() => navigate('/')}
                                        aria-label="Quay lại danh sách trò chuyện"
                                    >
                                        <i className="bi bi-chevron-left"></i>
                                    </button>
                                    <div className="avatar-lg">
                                        {chatPartner.avatar_url ? (
                                            <img src={getAvatarUrl(chatPartner.avatar_url)} alt="avatar" />
                                        ) : (
                                            <div className="avatar-fallback bg-primary d-flex align-items-center justify-content-center text-white">
                                                {(chatPartner.display_name || chatPartner.username).charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="partner-meta">
                                        <div className="chat-title">{displayName}</div>
                                        <div className={`chat-status ${isOnline ? 'is-online' : ''}`}>
                                            <span className="chat-status-dot"></span>
                                            {isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}
                                        </div>
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
                    </div>

                    {notification && (
                        <div className="chat-notification" role="alert">
                            <div>
                                <i className="bi bi-exclamation-circle-fill"></i>
                                <span>{notification}</span>
                            </div>
                            <button type="button" aria-label="Đóng" onClick={() => setNotification('')}>
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>
                    )}

                    {/* Danh sách tin nhắn */}
                    <div
                        className={`chat-messages ${visibleMessages.length === 0 ? 'is-empty' : ''}`}
                        ref={messagesContainerRef}
                        onScroll={handleMessagesScroll}
                    >
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
                                    onImageLoaded={() => {
                                        if (shouldAutoScrollRef.current) {
                                            requestAnimationFrame(() => scrollToBottom('auto'));
                                        }
                                    }}
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
                            <button className="chat-info-close" onClick={() => setShowInfo(false)} aria-label="Đóng bảng thông tin">
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>
                        <div className="chat-info-panel-body">
                            <div className="chat-info-avatar">
                                {chatPartner.avatar_url ? (
                                    <img src={getAvatarUrl(chatPartner.avatar_url)} alt="avatar" />
                                ) : (
                                    <div className="avatar-fallback bg-primary d-flex align-items-center justify-content-center text-white">
                                        {chatPartner.username.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="chat-info-identity">
                                <div className="chat-info-name">{displayName}</div>
                                <div className={`chat-info-status ${isOnline ? 'is-online' : ''}`}>
                                    <span></span>
                                    {isOnline ? 'Đang online' : 'Offline'}
                                </div>
                            </div>

                            <div className="chat-info-field">
                                <label className="form-label">Biệt danh</label>
                                <input
                                    type="text"
                                    className="form-control chat-info-input"
                                    value={nicknameMap[chatPartner.id] || ''}
                                    onChange={handleNicknameChange}
                                    placeholder="Nhập biệt danh..."
                                />
                            </div>

                            <button
                                className={`chat-info-action ${isBlocked ? 'is-success' : 'is-danger'}`}
                                onClick={toggleBlockUser}
                            >
                                <i className={`bi ${isBlocked ? 'bi-person-check' : 'bi-person-slash'}`}></i>
                                {isBlocked ? 'Bỏ chặn người này' : 'Chặn người này'}
                            </button>

                            {isBlocked && (
                                <div className="chat-info-warning">
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

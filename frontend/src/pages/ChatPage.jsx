import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
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
        <div className="d-flex h-100 bg-white" style={{ minHeight: 0 }}>
            <div className="d-flex flex-column flex-grow-1" style={{ minWidth: 0 }}>
                {/* Header */}
                <div className="p-3 border-bottom bg-white shadow-sm">
                    <div className="d-flex align-items-center justify-content-between">
                        {chatPartner ? (
                            <div className="d-flex align-items-center">
                                <div className="position-relative me-3">
                                    <div className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center"
                                        style={{ width: '40px', height: '40px', fontSize: '18px' }}>
                                        {chatPartner.avatar_url ? (
                                            <img src={chatPartner.avatar_url} alt="avatar" className="rounded-circle" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            chatPartner.username.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    {isOnline && (
                                        <span className="position-absolute bottom-0 end-0 bg-success rounded-circle border border-white"
                                            style={{ width: '10px', height: '10px' }}></span>
                                    )}
                                </div>
                                <div>
                                    <div className="fw-semibold">{displayName}</div>
                                    <small className={`text-${isOnline ? 'success' : 'secondary'}`}>
                                        {isOnline ? 'Đang online' : 'Offline'}
                                    </small>
                                </div>
                            </div>
                        ) : (
                            <div className="fw-semibold">Cuộc trò chuyện</div>
                        )}

                        {(chatPartner || conversationId) && (
                            <button
                                className="btn btn-light rounded-circle border"
                                onClick={() => setShowInfo(prev => !prev)}
                                title="Thông tin người liên hệ"
                                aria-label="Thông tin người liên hệ"
                            >
                                <i className="bi bi-info-circle"></i>
                            </button>
                        )}
                    </div>
                    {notification && (
                        <div className="mt-3 alert alert-warning d-flex align-items-center justify-content-between" role="alert">
                            <div>
                                <strong>Thông báo:</strong> {notification}
                            </div>
                            <button type="button" className="btn-close" aria-label="Close" onClick={() => setNotification('')} />
                        </div>
                    )}
                </div>

                {/* Danh sách tin nhắn */}
                <div className="flex-grow-1 p-3 overflow-auto bg-light">
                    {visibleMessages.length === 0 ? (
                        <div className="text-center text-muted py-5">
                            <i className="bi bi-chat display-4"></i>
                            <p>Chưa có tin nhắn. Hãy bắt đầu trò chuyện!</p>
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
                <ChatInput onSendMessage={handleSendMessage} onSendImage={handleSendImage} />
            </div>

            {showInfo && chatPartner && (
                <div className="border-start bg-white" style={{ width: '320px', minWidth: '320px', maxWidth: '320px' }}>
                    <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
                        <div className="fw-semibold">Thông tin</div>
                        <button className="btn btn-sm btn-light rounded-circle border" onClick={() => setShowInfo(false)}>
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>
                    <div className="p-3">
                        <div className="text-center mb-3">
                            <div className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center mx-auto mb-2"
                                style={{ width: '72px', height: '72px', fontSize: '28px' }}>
                                {chatPartner.avatar_url ? (
                                    <img src={chatPartner.avatar_url} alt="avatar" className="rounded-circle" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    chatPartner.username.charAt(0).toUpperCase()
                                )}
                            </div>
                            <div className="fw-semibold">{displayName}</div>
                            <small className={`text-${isOnline ? 'success' : 'secondary'}`}>
                                {isOnline ? 'Đang online' : 'Offline'}
                            </small>
                        </div>

                        <div className="mb-3">
                            <label className="form-label small mb-1">Biệt danh</label>
                            <input
                                type="text"
                                className="form-control form-control-sm"
                                value={nicknameMap[chatPartner.id] || ''}
                                onChange={handleNicknameChange}
                                placeholder="Nhập biệt danh..."
                            />
                        </div>

                        <button
                            className={`btn btn-sm w-100 ${isBlocked ? 'btn-outline-success' : 'btn-outline-danger'}`}
                            onClick={toggleBlockUser}
                        >
                            {isBlocked ? 'Bỏ chặn người này' : 'Chặn người này'}
                        </button>

                        {isBlocked && (
                            <div className="text-danger small mt-2">
                                Bạn đã chặn người này. Tin nhắn từ họ sẽ bị ẩn khỏi màn hình.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatPage;
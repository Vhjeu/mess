import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getAvatarUrl } from '../utils/avatar';
import { getMessages, uploadAttachments, revokeMessage } from '../services/messageService';
import { getConversations } from '../services/conversationService'; // để lấy thông tin thành viên
import { getNickname, getUser, updateNickname } from '../services/userService';
import ChatMessage from '../components/chat/ChatMessage';
import ChatInput from '../components/chat/ChatInput';

const ChatPage = () => {
    const { conversationId, targetUserId } = useParams();
    const { user, socket, onlineUsers } = useAuth();
    const [messages, setMessages] = useState([]);
    const [conversation, setConversation] = useState(null); // thông tin conversation (members)
    const [loading, setLoading] = useState(true);
    const [showInfo, setShowInfo] = useState(false);
    const [notification, setNotification] = useState('');
    const [nickname, setNickname] = useState('');
    const [nicknameInput, setNicknameInput] = useState('');
    const [nicknameForUserId, setNicknameForUserId] = useState(null);
    const [nicknameSaving, setNicknameSaving] = useState(false);
    const [nicknameStatus, setNicknameStatus] = useState('');
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
    const nicknameRequestRef = useRef(0);
    const chatKey = conversationId ? `conversation:${conversationId}` : `draft:${targetUserId || ''}`;
    const previousConversationIdRef = useRef(chatKey);
    const previousMessageCountRef = useRef(0);
    const navigate = useNavigate();
    const isDraft = Boolean(targetUserId && !conversationId);

    const currentUserId = user?.id ? Number(user.id) : null;
    const otherMembers = conversation?.members?.filter(m => Number(m.id) !== currentUserId) || [];
    const chatPartner = otherMembers.length > 0 ? otherMembers[0] : null;
    const chatPartnerId = chatPartner ? Number(chatPartner.id) : null;
    const isOnline = chatPartner ? onlineUsers.has(chatPartnerId) : false;
    const activeNickname = nicknameForUserId === chatPartnerId ? nickname : '';
    const activeNicknameInput = nicknameForUserId === chatPartnerId ? nicknameInput : '';
    const displayName = chatPartner
        ? (activeNickname || chatPartner.display_name || chatPartner.username)
        : 'Cuộc trò chuyện';
    const isBlocked = chatPartnerId !== null ? blockedUsers.includes(chatPartnerId) : false;
    const visibleMessages = messages;

    const loadConversationData = useCallback(async () => {
        try {
            if (conversationId) {
                const [msgs, conversations] = await Promise.all([
                    getMessages(conversationId),
                    getConversations()
                ]);
                const conv = conversations.find(c => Number(c.id) === Number(conversationId));
                if (!conv) {
                    setNotification('Không tìm thấy cuộc trò chuyện này.');
                    navigate('/');
                    return;
                }
                setMessages(msgs);
                setConversation(conv);
            } else if (targetUserId) {
                const targetUser = await getUser(targetUserId);
                setMessages([]);
                setConversation({
                    id: null,
                    draft: true,
                    members: [targetUser]
                });
            } else {
                setMessages([]);
                setConversation(null);
            }
        } catch (error) {
            console.error('Lỗi tải dữ liệu chat:', error);
            if ([400, 403, 404].includes(error.response?.status)) {
                alert(error.response?.data?.message || 'Không thể mở cuộc trò chuyện này');
                navigate('/');
            }
        } finally {
            setLoading(false);
        }
    }, [conversationId, targetUserId, navigate]);

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
        let listenerActive = true;

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

        const handleUserProfileUpdated = ({ user: updatedUser }) => {
            if (!updatedUser?.id) return;

            setConversation(currentConversation => {
                if (!currentConversation) return currentConversation;
                return {
                    ...currentConversation,
                    members: currentConversation.members.map(member => (
                        Number(member.id) === Number(updatedUser.id)
                            ? { ...member, ...updatedUser }
                            : member
                    ))
                };
            });
            setMessages(currentMessages => currentMessages.map(message => (
                Number(message.sender_id) === Number(updatedUser.id)
                    ? {
                        ...message,
                        sender_username: updatedUser.display_name || updatedUser.username,
                        sender_avatar: updatedUser.avatar_url
                    }
                    : message
            )));
        };

        const handleNicknameUpdated = ({
            target_user_id: updatedTargetUserId,
            nickname: updatedNickname
        }) => {
            if (Number(updatedTargetUserId) !== chatPartnerId) return;
            const nextNickname = updatedNickname || '';
            nicknameRequestRef.current += 1;
            setNicknameForUserId(chatPartnerId);
            setNickname(nextNickname);
            setNicknameInput(nextNickname);
            setNicknameStatus('Đã cập nhật biệt danh.');
        };

        const handleConversationUpdate = async (payload) => {
            if (!isDraft || !chatPartnerId || !payload?.conversationId) return;

            try {
                const conversations = await getConversations();
                if (!listenerActive) return;
                const matchingConversation = conversations.find(item => (
                    Number(item.id) === Number(payload.conversationId)
                    && item.members.some(member => Number(member.id) === chatPartnerId)
                ));
                if (matchingConversation) {
                    navigate(`/chat/${matchingConversation.id}`, { replace: true });
                }
            } catch (error) {
                console.error('Lỗi đồng bộ cuộc trò chuyện nháp:', error);
            }
        };

        socket.on('chat:message', handleNewMessage);
        socket.on('chat:message:revoked', handleRevokedMessage);
        socket.on('user:profile-updated', handleUserProfileUpdated);
        socket.on('nickname:updated', handleNicknameUpdated);
        socket.on('conversations:update', handleConversationUpdate);

        return () => {
            listenerActive = false;
            socket.off('chat:message', handleNewMessage);
            socket.off('chat:message:revoked', handleRevokedMessage);
            socket.off('user:profile-updated', handleUserProfileUpdated);
            socket.off('nickname:updated', handleNicknameUpdated);
            socket.off('conversations:update', handleConversationUpdate);
        };
    }, [
        socket,
        conversationId,
        blockedUsers,
        chatPartnerId,
        isDraft,
        navigate
    ]);

    useEffect(() => {
        setNickname('');
        setNicknameInput('');
        setNicknameForUserId(null);
        setNicknameStatus('');
        if (!chatPartnerId) return undefined;

        let active = true;
        const requestId = ++nicknameRequestRef.current;
        getNickname(chatPartnerId)
            .then(data => {
                if (!active || nicknameRequestRef.current !== requestId) return;
                const loadedNickname = data.nickname || '';
                setNicknameForUserId(chatPartnerId);
                setNickname(loadedNickname);
                setNicknameInput(loadedNickname);
            })
            .catch(error => {
                if (active && nicknameRequestRef.current === requestId) {
                    console.error('Lỗi tải biệt danh:', error);
                    setNicknameStatus('Không thể tải biệt danh.');
                }
            });

        return () => {
            active = false;
        };
    }, [chatPartnerId]);

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
        previousConversationIdRef.current = chatKey;
        previousMessageCountRef.current = 0;
    }, [chatKey]);

    useLayoutEffect(() => {
        if (loading || !messages.length) return;

        const shouldScroll = previousConversationIdRef.current !== chatKey
            || previousMessageCountRef.current === 0
            || shouldAutoScrollRef.current;

        if (shouldScroll) {
            requestAnimationFrame(() => scrollToBottom('auto'));
        }

        previousConversationIdRef.current = chatKey;
        previousMessageCountRef.current = messages.length;
    }, [chatKey, loading, messages.length, scrollToBottom]);

    // Gửi tin nhắn văn bản
    const handleSendMessage = (content) => {
        if (!socket || !content.trim() || (!conversationId && !chatPartnerId)) return;

        socket.emit('chat:message', {
            ...(conversationId
                ? { conversationId: Number(conversationId) }
                : { targetUserId: chatPartnerId }),
            content: content.trim()
        }, (response) => {
            if (response?.error) {
                setNotification(response.error);
            } else {
                setNotification('');
                if (isDraft && response?.conversationId) {
                    navigate(`/chat/${response.conversationId}`, { replace: true });
                }
            }
        });
    };

    // Gửi một hoặc nhiều file trong cùng một tin nhắn.
    const handleSendFiles = async (files, content, onProgress) => {
        if (!files?.length || (!conversationId && !chatPartnerId)) {
            throw new Error('Không thể gửi file trong cuộc trò chuyện này');
        }

        try {
            const formData = new FormData();
            files.forEach(file => formData.append('files', file));
            if (content) {
                formData.append('content', content);
            }
            if (conversationId) {
                formData.append('conversationId', conversationId);
            } else {
                formData.append('targetUserId', String(chatPartnerId));
            }

            const result = await uploadAttachments(formData, onProgress);
            if (!result.attachments?.length && !result.fileUrl) {
                throw new Error('Máy chủ không trả về file đã gửi');
            }

            setNotification('');
            if (isDraft && result.conversationId) {
                navigate(`/chat/${result.conversationId}`, { replace: true });
            }
        } catch (error) {
            console.error('Upload file lỗi:', error);
            const message = error.response?.data?.message || error.message || 'Không thể gửi file';
            setNotification(message);
            throw error;
        }
    };

    const handleNicknameSave = async () => {
        if (!chatPartnerId || nicknameSaving) return;

        const normalizedNickname = nicknameInput.trim().replace(/\s+/gu, ' ');
        if (Array.from(normalizedNickname).length > 30) {
            setNicknameStatus('Biệt danh không được vượt quá 30 ký tự.');
            return;
        }

        setNicknameSaving(true);
        setNicknameStatus('');
        try {
            const result = await updateNickname(chatPartnerId, normalizedNickname);
            const savedNickname = result.nickname || '';
            setNicknameForUserId(chatPartnerId);
            setNickname(savedNickname);
            setNicknameInput(savedNickname);
            setNicknameStatus(savedNickname ? 'Đã lưu biệt danh.' : 'Đã xóa biệt danh.');
            window.dispatchEvent(new CustomEvent('nickname:updated', { detail: result }));
        } catch (error) {
            setNicknameStatus(error.response?.data?.message || 'Không thể lưu biệt danh.');
        } finally {
            setNicknameSaving(false);
        }
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

    if (!conversationId && !targetUserId) {
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
                        <ChatInput
                            key={chatKey}
                            onSendMessage={handleSendMessage}
                            onSendFiles={handleSendFiles}
                        />
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
                                        {(chatPartner.display_name || chatPartner.username).charAt(0).toUpperCase()}
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

                            <form
                                className="chat-info-field"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    handleNicknameSave();
                                }}
                            >
                                <label className="form-label">Biệt danh</label>
                                <div className="chat-info-input-row">
                                    <input
                                        type="text"
                                        className="form-control chat-info-input"
                                        value={activeNicknameInput}
                                        onChange={(event) => {
                                            const value = Array.from(event.target.value)
                                                .slice(0, 30)
                                                .join('');
                                            nicknameRequestRef.current += 1;
                                            setNicknameForUserId(chatPartnerId);
                                            setNicknameInput(value);
                                            setNicknameStatus('');
                                        }}
                                        placeholder={chatPartner.display_name || chatPartner.username}
                                        maxLength={30}
                                        disabled={nicknameSaving}
                                    />
                                    <button
                                        type="submit"
                                        className="chat-info-nickname-save"
                                        disabled={nicknameSaving}
                                        aria-label="Lưu biệt danh"
                                    >
                                        {nicknameSaving
                                            ? <span className="button-spinner"></span>
                                            : <i className="bi bi-check-lg"></i>}
                                    </button>
                                </div>
                                <small>
                                    Để trống và lưu để dùng lại tên hiển thị gốc.
                                </small>
                                {nicknameStatus && (
                                    <div
                                        className={`chat-info-nickname-status ${
                                            nicknameStatus.startsWith('Không')
                                            || nicknameStatus.startsWith('Biệt danh')
                                                ? 'is-error'
                                                : ''
                                        }`}
                                        role="status"
                                    >
                                        {nicknameStatus}
                                    </div>
                                )}
                            </form>

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

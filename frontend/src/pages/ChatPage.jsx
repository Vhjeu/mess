import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getAvatarUrl } from '../utils/avatar';
import { getMessages, uploadAttachments, revokeMessage } from '../services/messageService';
import { getConversations } from '../services/conversationService'; // để lấy thông tin thành viên
import { getNickname, getUser, updateNickname } from '../services/userService';
import ChatMessage from '../components/chat/ChatMessage';
import ChatInput from '../components/chat/ChatInput';
import ChatWelcomeArtwork from '../components/chat/ChatWelcomeArtwork';
import { validateUploadFiles } from '../utils/uploadValidation';
import {
    getClientMessageId,
    mergeMessages,
    upsertMessage
} from '../utils/messageState';

const ChatPage = () => {
    const { conversationId, targetUserId } = useParams();
    const { user, socket, onlineUsers } = useAuth();
    const [messages, setMessages] = useState([]);
    const [conversation, setConversation] = useState(null); // thông tin conversation (members)
    const [initialMessagesLoading, setInitialMessagesLoading] = useState(true);
    const [resolvedConversationId, setResolvedConversationId] = useState(
        conversationId ? Number(conversationId) : null
    );
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
    const uploadPreviewsRef = useRef(new Map());
    const pendingTextMessagesRef = useRef(new Set());
    const loadRequestRef = useRef(0);
    const draftResolutionRequestRef = useRef(0);
    const chatKey = conversationId ? `conversation:${conversationId}` : `draft:${targetUserId || ''}`;
    const activeChatKeyRef = useRef(chatKey);
    const previousConversationIdRef = useRef(chatKey);
    const previousMessageCountRef = useRef(0);
    const navigate = useNavigate();
    const activeConversationId = conversationId
        ? Number(conversationId)
        : resolvedConversationId;
    const isDraft = Boolean(targetUserId && !activeConversationId);

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

    const releaseUploadPreviews = useCallback(clientUploadId => {
        const previewUrls = uploadPreviewsRef.current.get(clientUploadId) || [];
        previewUrls.forEach(url => URL.revokeObjectURL(url));
        uploadPreviewsRef.current.delete(clientUploadId);
    }, []);

    useEffect(() => () => {
        uploadPreviewsRef.current.forEach(previewUrls => {
            previewUrls.forEach(url => URL.revokeObjectURL(url));
        });
        uploadPreviewsRef.current.clear();
        pendingTextMessagesRef.current.clear();
    }, []);

    const loadConversationData = useCallback(async ({ showInitialLoader = false } = {}) => {
        const requestId = ++loadRequestRef.current;
        if (showInitialLoader) {
            setInitialMessagesLoading(true);
        }
        try {
            if (conversationId) {
                const [msgs, conversations] = await Promise.all([
                    getMessages(conversationId),
                    getConversations()
                ]);
                if (requestId !== loadRequestRef.current) return;
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
                if (requestId !== loadRequestRef.current) return;
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
            if (requestId !== loadRequestRef.current) return;
            console.error('Lỗi tải dữ liệu chat:', error);
            if ([400, 403, 404].includes(error.response?.status)) {
                alert(error.response?.data?.message || 'Không thể mở cuộc trò chuyện này');
                navigate('/');
            }
        } finally {
            if (requestId === loadRequestRef.current) {
                setInitialMessagesLoading(false);
            }
        }
    }, [conversationId, targetUserId, navigate]);

    // Lấy thông tin cuộc trò chuyện và tin nhắn ban đầu
    useEffect(() => {
        setResolvedConversationId(conversationId ? Number(conversationId) : null);
        setMessages([]);
        setConversation(null);
        void loadConversationData({ showInitialLoader: true });
        return () => {
            loadRequestRef.current += 1;
        };
    }, [conversationId, loadConversationData]);

    const adoptConversation = useCallback((nextConversationId, {
        conversationData = null,
        savedMessage = null
    } = {}) => {
        const normalizedConversationId = Number(nextConversationId);
        if (!Number.isInteger(normalizedConversationId) || normalizedConversationId <= 0) return;

        const nextConversation = conversationData || {
            ...(conversation || {}),
            id: normalizedConversationId,
            draft: false
        };
        setResolvedConversationId(normalizedConversationId);
        setConversation(nextConversation);

        if (window.location.pathname.startsWith('/chat/new/')) {
            window.history.replaceState(
                window.history.state,
                '',
                `/chat/${normalizedConversationId}`
            );
        }

        if (savedMessage && nextConversation.members?.length) {
            window.dispatchEvent(new CustomEvent('conversation:resolved', {
                detail: {
                    conversation: {
                        ...nextConversation,
                        id: normalizedConversationId,
                        unread_count: 0,
                        created_at: savedMessage.created_at,
                        lastMessage: {
                            id: savedMessage.id,
                            content: savedMessage.content,
                            has_attachment: Boolean(savedMessage.has_attachment),
                            created_at: savedMessage.created_at,
                            sender_id: Number(savedMessage.sender_id)
                        }
                    }
                }
            }));
        }
    }, [conversation]);

    // Tham gia room socket
    useEffect(() => {
        if (!socket || !activeConversationId) return;
        socket.emit('chat:join', activeConversationId);

        return () => {
            socket.emit('chat:leave', activeConversationId);
        };
    }, [socket, activeConversationId]);

    // Lắng nghe tin nhắn mới từ socket
    useEffect(() => {
        if (!socket) return;
        let listenerActive = true;

        const handleNewMessage = (msg) => {
            if (blockedUsers.includes(Number(msg.sender_id))) return;
            const clientMessageId = getClientMessageId(msg);
            const matchesPendingText = clientMessageId
                && pendingTextMessagesRef.current.has(clientMessageId);
            if (clientMessageId) {
                pendingTextMessagesRef.current.delete(clientMessageId);
            }
            if (msg.client_upload_id) {
                releaseUploadPreviews(msg.client_upload_id);
            }
            setMessages(currentMessages => {
                const matchesActiveConversation = (
                    Number(msg.conversation_id) === Number(activeConversationId)
                );
                const matchesOptimisticMessage = clientMessageId && currentMessages.some(
                    message => getClientMessageId(message) === clientMessageId
                );
                return matchesActiveConversation || matchesOptimisticMessage
                    ? upsertMessage(currentMessages, msg)
                    : currentMessages;
            });
            if (!activeConversationId && matchesPendingText) {
                adoptConversation(msg.conversation_id, { savedMessage: msg });
            }
        };

        const handleRevokedMessage = ({ messageId, conversationId: convId }) => {
            if (Number(convId) !== Number(activeConversationId)) return;
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
            if (Number(payload.lastMessage?.sender_id) === currentUserId) return;

            const requestId = ++draftResolutionRequestRef.current;
            try {
                const conversations = await getConversations();
                if (
                    !listenerActive
                    || requestId !== draftResolutionRequestRef.current
                ) return;
                const matchingConversation = conversations.find(item => (
                    Number(item.id) === Number(payload.conversationId)
                    && item.members.some(member => Number(member.id) === chatPartnerId)
                ));
                if (matchingConversation) {
                    adoptConversation(matchingConversation.id, {
                        conversationData: matchingConversation
                    });
                    const history = await getMessages(matchingConversation.id);
                    if (
                        listenerActive
                        && requestId === draftResolutionRequestRef.current
                    ) {
                        setMessages(currentMessages => mergeMessages(currentMessages, history));
                    }
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
            draftResolutionRequestRef.current += 1;
            socket.off('chat:message', handleNewMessage);
            socket.off('chat:message:revoked', handleRevokedMessage);
            socket.off('user:profile-updated', handleUserProfileUpdated);
            socket.off('nickname:updated', handleNicknameUpdated);
            socket.off('conversations:update', handleConversationUpdate);
        };
    }, [
        socket,
        activeConversationId,
        blockedUsers,
        chatPartnerId,
        currentUserId,
        isDraft,
        adoptConversation,
        releaseUploadPreviews
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
        activeChatKeyRef.current = chatKey;
        pendingTextMessagesRef.current.clear();
        shouldAutoScrollRef.current = true;
        previousConversationIdRef.current = chatKey;
        previousMessageCountRef.current = 0;
    }, [chatKey]);

    useLayoutEffect(() => {
        if (initialMessagesLoading || !messages.length) return;

        const shouldScroll = previousConversationIdRef.current !== chatKey
            || previousMessageCountRef.current === 0
            || shouldAutoScrollRef.current;

        if (shouldScroll) {
            requestAnimationFrame(() => scrollToBottom('auto'));
        }

        previousConversationIdRef.current = chatKey;
        previousMessageCountRef.current = messages.length;
    }, [chatKey, initialMessagesLoading, messages.length, scrollToBottom]);

    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return undefined;

        let frameId = 0;
        const keepLastMessageVisible = () => {
            if (!shouldAutoScrollRef.current) return;

            if (frameId) cancelAnimationFrame(frameId);
            frameId = requestAnimationFrame(() => {
                frameId = requestAnimationFrame(() => {
                    scrollToBottom('auto');
                    frameId = 0;
                });
            });
        };

        const resizeObserver = typeof ResizeObserver === 'function'
            ? new ResizeObserver(keepLastMessageVisible)
            : null;
        resizeObserver?.observe(container);

        const viewport = window.visualViewport;
        viewport?.addEventListener('resize', keepLastMessageVisible);
        viewport?.addEventListener('scroll', keepLastMessageVisible);
        window.addEventListener('orientationchange', keepLastMessageVisible);

        return () => {
            if (frameId) cancelAnimationFrame(frameId);
            resizeObserver?.disconnect();
            viewport?.removeEventListener('resize', keepLastMessageVisible);
            viewport?.removeEventListener('scroll', keepLastMessageVisible);
            window.removeEventListener('orientationchange', keepLastMessageVisible);
        };
    }, [chatKey, scrollToBottom]);

    const sendTextMessage = (content, existingClientMessageId = null) => {
        const normalizedContent = content.trim();
        if (
            !socket
            || !normalizedContent
            || (!activeConversationId && !chatPartnerId)
        ) return;

        const clientMessageId = existingClientMessageId
            || globalThis.crypto?.randomUUID?.()
            || `${Date.now()}-${Math.random()}`;
        const sendingChatKey = chatKey;
        const optimisticMessage = {
            id: `pending:${clientMessageId}`,
            client_message_id: clientMessageId,
            conversation_id: activeConversationId || null,
            content: normalizedContent,
            has_attachment: false,
            created_at: new Date().toISOString(),
            sender_id: Number(user?.id),
            sender_username: user?.display_name || user?.username,
            sender_avatar: user?.avatar_url,
            attachments: [],
            send_status: 'sending',
            send_error: '',
            _retryContent: normalizedContent
        };

        shouldAutoScrollRef.current = true;
        pendingTextMessagesRef.current.add(clientMessageId);
        setMessages(currentMessages => (
            existingClientMessageId
                ? currentMessages.map(message => (
                    getClientMessageId(message) === clientMessageId
                        ? {
                            ...message,
                            send_status: 'sending',
                            send_error: ''
                        }
                        : message
                ))
                : [...currentMessages, optimisticMessage]
        ));

        socket.timeout(15_000).emit('chat:message', {
            ...(activeConversationId
                ? { conversationId: activeConversationId }
                : { targetUserId: chatPartnerId }),
            content: normalizedContent,
            clientMessageId
        }, (acknowledgementError, response) => {
            if (activeChatKeyRef.current !== sendingChatKey) {
                pendingTextMessagesRef.current.delete(clientMessageId);
                return;
            }
            const responseError = response?.error
                || (acknowledgementError ? 'Không thể gửi tin nhắn. Hãy thử lại.' : '');
            if (responseError) {
                if (!pendingTextMessagesRef.current.has(clientMessageId)) return;
                pendingTextMessagesRef.current.delete(clientMessageId);
                setNotification(responseError);
                setMessages(currentMessages => currentMessages.map(message => (
                    getClientMessageId(message) === clientMessageId && message.send_status
                        ? {
                            ...message,
                            send_status: 'error',
                            send_error: responseError
                        }
                        : message
                )));
                return;
            }

            const savedMessage = response.message || {
                id: response.messageId,
                conversation_id: response.conversationId,
                content: normalizedContent,
                has_attachment: false,
                created_at: new Date().toISOString(),
                sender_id: Number(user?.id),
                sender_username: user?.display_name || user?.username,
                sender_avatar: user?.avatar_url,
                attachments: [],
                client_message_id: clientMessageId
            };
            pendingTextMessagesRef.current.delete(clientMessageId);
            setMessages(currentMessages => upsertMessage(currentMessages, savedMessage));
            setNotification('');
            if (!activeConversationId && response.conversationId) {
                adoptConversation(response.conversationId, { savedMessage });
            }
        });
    };

    // Tin nhắn chữ hiển thị ngay; ACK/socket chỉ thay bản tạm bằng bản đã lưu.
    const handleSendMessage = content => sendTextMessage(content);

    const handleRetryMessage = message => {
        const clientMessageId = getClientMessageId(message);
        if (!clientMessageId || !message?._retryContent) return;
        sendTextMessage(message._retryContent, clientMessageId);
    };

    // Gửi một hoặc nhiều file trong cùng một tin nhắn.
    const performBackgroundUpload = async (files, content, clientUploadId, onUploadProgress) => {
        if (!files?.length || (!activeConversationId && !chatPartnerId)) {
            throw new Error('Không thể gửi file trong cuộc trò chuyện này');
        }

        const uploadChatKey = chatKey;
        try {
            const formData = new FormData();
            files.forEach(file => formData.append('files', file));
            if (content) {
                formData.append('content', content);
            }
            formData.append('clientUploadId', clientUploadId);
            if (activeConversationId) {
                formData.append('conversationId', String(activeConversationId));
            } else {
                formData.append('targetUserId', String(chatPartnerId));
            }

            const result = await uploadAttachments(formData, progress => {
                if (activeChatKeyRef.current !== uploadChatKey) return;
                onUploadProgress?.(progress);
                setMessages(currentMessages => currentMessages.map(message => (
                    message.client_upload_id === clientUploadId && message.upload_status
                        ? { ...message, upload_status: 'uploading', upload_progress: progress }
                        : message
                )));
            });
            if (!result.attachments?.length && !result.fileUrl) {
                throw new Error('Máy chủ không trả về file đã gửi');
            }

            const savedMessage = result.savedMessage || {
                id: result.messageId,
                conversation_id: result.conversationId,
                content: content || null,
                has_attachment: true,
                created_at: new Date().toISOString(),
                sender_id: Number(user?.id),
                attachments: result.attachments,
                client_upload_id: clientUploadId
            };
            releaseUploadPreviews(clientUploadId);
            if (activeChatKeyRef.current !== uploadChatKey) return;
            setMessages(currentMessages => upsertMessage(currentMessages, savedMessage));
            setNotification('');
            if (!activeConversationId && result.conversationId) {
                adoptConversation(result.conversationId, { savedMessage });
            }
        } catch (error) {
            console.error('Upload file lỗi:', error);
            const message = error.response?.data?.message || error.message || 'Không thể gửi file';
            if (activeChatKeyRef.current !== uploadChatKey) throw error;
            setNotification(message);
            setMessages(currentMessages => currentMessages.map(currentMessage => (
                currentMessage.client_upload_id === clientUploadId
                    && currentMessage.upload_status
                    ? {
                        ...currentMessage,
                        upload_status: 'error',
                        upload_error: message
                    }
                    : currentMessage
            )));
            throw error;
        }
    };

    // Tạo tin nhắn local ngay lập tức; request tiếp tục chạy mà không khóa composer.
    const handleSendFiles = (files, content, onUploadProgress) => {
        if (!files?.length || (!activeConversationId && !chatPartnerId)) {
            throw new Error('Không thể gửi file trong cuộc trò chuyện này');
        }
        const validation = validateUploadFiles(files);
        if (!validation.valid) {
            const error = new Error(validation.message);
            error.code = validation.code;
            throw error;
        }

        const clientUploadId = globalThis.crypto?.randomUUID?.()
            || `${Date.now()}-${Math.random()}`;
        const previewUrls = files.map(file => URL.createObjectURL(file));
        uploadPreviewsRef.current.set(clientUploadId, previewUrls);
        const optimisticMessage = {
            id: `upload:${clientUploadId}`,
            client_upload_id: clientUploadId,
            conversation_id: activeConversationId || null,
            content: content || null,
            has_attachment: true,
            created_at: new Date().toISOString(),
            sender_id: Number(user?.id),
            sender_username: user?.display_name || user?.username,
            sender_avatar: user?.avatar_url,
            attachments: files.map((file, index) => ({
                file_url: previewUrls[index],
                file_type: file.type || 'application/octet-stream',
                file_name: file.name,
                file_size: file.size
            })),
            upload_status: 'uploading',
            upload_progress: 0,
            _uploadFiles: files
        };

        shouldAutoScrollRef.current = true;
        setMessages(currentMessages => [...currentMessages, optimisticMessage]);
        return performBackgroundUpload(files, content, clientUploadId, onUploadProgress);
    };

    const handleRetryUpload = message => {
        if (!message?._uploadFiles?.length || !message.client_upload_id) return;
        setMessages(currentMessages => currentMessages.map(currentMessage => (
            currentMessage.client_upload_id === message.client_upload_id
                ? {
                    ...currentMessage,
                    upload_status: 'uploading',
                    upload_progress: 0,
                    upload_error: ''
                }
                : currentMessage
        )));
        void performBackgroundUpload(
            message._uploadFiles,
            message.content,
            message.client_upload_id
        ).catch(() => {});
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
        if (!activeConversationId || !socket) return;

        try {
            await revokeMessage(activeConversationId, messageId);
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

            if (!isNowBlocked && activeConversationId) {
                try {
                    const refreshedMessages = await getMessages(activeConversationId);
                    setMessages(currentMessages => (
                        mergeMessages(currentMessages, refreshedMessages)
                    ));
                } catch (error) {
                    console.error('Không thể làm mới tin nhắn sau khi bỏ chặn:', error);
                }
            }
        });
    };

    if (!conversationId && !targetUserId) {
        return (
            <div className="chat-welcome">
                <ChatWelcomeArtwork />
                <div>
                    <h1>Chọn một cuộc trò chuyện</h1>
                    <p>Tin nhắn, hình ảnh và tệp của bạn sẽ xuất hiện tại đây.</p>
                </div>
            </div>
        );
    }

    if (initialMessagesLoading) {
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
                                    onRetrySend={() => handleRetryMessage(msg)}
                                    onRetryUpload={() => handleRetryUpload(msg)}
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

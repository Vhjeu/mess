import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getMessages, uploadImage } from '../services/messageService';
import { getConversations } from '../services/conversationService'; // để lấy thông tin thành viên
import ChatMessage from '../components/chat/ChatMessage';
import ChatInput from '../components/chat/ChatInput';

const ChatPage = () => {
    const { conversationId } = useParams();
    const { user, socket, onlineUsers } = useAuth();
    const [messages, setMessages] = useState([]);
    const [conversation, setConversation] = useState(null); // thông tin conversation (members)
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    // Lấy thông tin cuộc trò chuyện và tin nhắn ban đầu
    useEffect(() => {
        if (!conversationId) return;

        const fetchData = async () => {
            try {
                // Lấy danh sách tin nhắn
                const msgs = await getMessages(conversationId);
                setMessages(msgs);

                // Lấy thông tin conversation để hiển thị tên, trạng thái
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
        };

        fetchData();
    }, [conversationId, navigate]);

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
            // Chỉ thêm nếu thuộc conversation hiện tại
            if (msg.conversation_id === parseInt(conversationId)) {
                setMessages(prev => [...prev, msg]);
            }
        };

        socket.on('chat:message', handleNewMessage);

        return () => {
            socket.off('chat:message', handleNewMessage);
        };
    }, [socket, conversationId]);

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
                alert('Gửi tin nhắn thất bại: ' + response.error);
            }
        });
    };

    // Gửi ảnh (upload file)
    const handleSendImage = async (file) => {
        if (!socket || !conversationId) return;
        // Upload ảnh qua REST API
        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('conversationId', conversationId);

            const result = await uploadImage(formData);
            // Sau khi upload thành công, emit socket event chat:image với fileUrl
            if (result.fileUrl) {
                socket.emit('chat:image', {
                    conversationId: parseInt(conversationId),
                    fileUrl: result.fileUrl
                }, (response) => {
                    if (response?.error) alert('Gửi ảnh thất bại: ' + response.error);
                });
            }
        } catch (error) {
            console.error('Upload ảnh lỗi:', error);
            alert('Không thể gửi ảnh');
        }
    };

    // Xác định tên và trạng thái người chat (trong chat 1-1)
    const otherMembers = conversation?.members?.filter(m => m.id !== user.id) || [];
    const chatPartner = otherMembers.length > 0 ? otherMembers[0] : null;
    const isOnline = chatPartner ? onlineUsers.has(chatPartner.id) : false;

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
        <div className="d-flex flex-column h-100 bg-white">
            {/* Header */}
            <div className="p-3 border-bottom d-flex align-items-center bg-white shadow-sm">
                {chatPartner ? (
                    <>
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
                            <div className="fw-semibold">{chatPartner.username}</div>
                            <small className={`text-${isOnline ? 'success' : 'secondary'}`}>
                                {isOnline ? 'Đang online' : 'Offline'}
                            </small>
                        </div>
                    </>
                ) : (
                    <div className="fw-semibold">Cuộc trò chuyện</div>
                )}
            </div>

            {/* Danh sách tin nhắn */}
            <div className="flex-grow-1 p-3 overflow-auto bg-light">
                {messages.length === 0 ? (
                    <div className="text-center text-muted py-5">
                        <i className="bi bi-chat display-4"></i>
                        <p>Chưa có tin nhắn. Hãy bắt đầu trò chuyện!</p>
                    </div>
                ) : (
                    messages.map(msg => (
                        <ChatMessage key={msg.id} message={msg} isOwn={msg.sender_id === user.id} />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <ChatInput onSendMessage={handleSendMessage} onSendImage={handleSendImage} />
        </div>
    );
};

export default ChatPage;
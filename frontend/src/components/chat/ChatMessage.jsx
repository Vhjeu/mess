import { useState, useEffect, useRef } from 'react';
import { getAvatarUrl, getDefaultAvatarUrl } from '../../utils/avatar';

const ChatMessage = ({ message, isOwn, onRevoke, onImageLoaded }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const messageRef = useRef(null);
    const menuRef = useRef(null);

    const time = new Date(message.created_at).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
    });

    useEffect(() => {
        if (!menuOpen) return undefined;

        const handleClickOutside = (event) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target) &&
                messageRef.current &&
                !messageRef.current.contains(event.target)
            ) {
                setMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen]);

    const handleAvatarError = (event) => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = getDefaultAvatarUrl();
    };

    return (
        <div
            className={`message-row ${isOwn ? 'own' : ''}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                setMenuOpen(false);
            }}
        >
            {!isOwn && (
                <div className="message-avatar">
                    <img
                        src={getAvatarUrl(message.sender_avatar)}
                        alt=""
                        onError={handleAvatarError}
                    />
                </div>
            )}
            <div className="message-content">
                {!isOwn && (
                    <div className="message-sender">{message.sender_username}</div>
                )}
                <div
                    ref={messageRef}
                    className={`message-bubble ${message.revoked ? 'is-revoked' : ''}`}
                >
                    {message.has_attachment && message.attachments?.length > 0 ? (
                        message.attachments[0].file_type?.startsWith('image/') ? (
                            <img
                                src={message.attachments[0].file_url}
                                alt="attachment"
                                className="message-attachment-image"
                                onClick={() => window.open(message.attachments[0].file_url, '_blank')}
                                onLoad={onImageLoaded}
                            />
                        ) : (
                            <a
                                href={message.attachments[0].file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="message-file"
                            >
                                <span className="message-file-icon">
                                    <i className="bi bi-file-earmark-arrow-down"></i>
                                </span>
                                <span className="message-file-name">{message.attachments[0].file_name || 'Tệp đính kèm'}</span>
                            </a>
                        )
                    ) : (
                        <div className="message-text">{message.content}</div>
                    )}
                    <div className="message-footer">
                        <div className="message-time">
                            {time}
                        </div>
                        {isOwn && !message.revoked && (
                            <div className="message-options">
                                <button
                                    type="button"
                                    className={`message-menu-toggle ${isHovered || menuOpen ? 'is-visible' : ''}`}
                                    onClick={() => setMenuOpen((prev) => !prev)}
                                    aria-label="Tùy chọn tin nhắn"
                                    aria-expanded={menuOpen}
                                >
                                    <i className="bi bi-three-dots"></i>
                                </button>
                                {menuOpen && (
                                    <div
                                        ref={menuRef}
                                        className="message-menu"
                                    >
                                        <button
                                            type="button"
                                            className="message-menu-item"
                                            onClick={() => {
                                                setMenuOpen(false);
                                                onRevoke();
                                            }}
                                        >
                                            <i className="bi bi-trash text-danger"></i>
                                            <span>Thu hồi</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {isOwn && (
                <div className="message-avatar">
                    <img
                        src={getAvatarUrl(message.sender_avatar)}
                        alt=""
                        onError={handleAvatarError}
                    />
                </div>
            )}
        </div>
    );
};

export default ChatMessage;

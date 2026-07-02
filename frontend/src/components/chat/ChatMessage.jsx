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
            className={`d-flex mb-3 ${isOwn ? 'justify-content-end' : 'justify-content-start'}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                setMenuOpen(false);
            }}
        >
            {!isOwn && (
                <div className="me-2 flex-shrink-0">
                    <div className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center overflow-hidden"
                        style={{ width: '26px', height: '26px', fontSize: '12px' }}>
                        <img
                            src={getAvatarUrl(message.sender_avatar)}
                            alt="avatar"
                            className="rounded-circle"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            onError={handleAvatarError}
                        />
                    </div>
                </div>
            )}
            <div className={`max-w-70 ${isOwn ? 'order-1' : ''}`}>
                {!isOwn && (
                    <small className="text-muted ms-1 mb-1 d-block">{message.sender_username}</small>
                )}
                <div
                    ref={messageRef}
                    className={`position-relative p-2 rounded-3 shadow-sm ${isOwn ? 'bg-primary text-white' : 'bg-white text-dark dark:bg-gray-800 dark:text-white'}`}
                    style={{ maxWidth: '320px' }}
                >
                    {message.has_attachment && message.attachments?.length > 0 ? (
                        message.attachments[0].file_type?.startsWith('image/') ? (
                            <img
                                src={message.attachments[0].file_url}
                                alt="attachment"
                                className="rounded"
                                style={{ maxWidth: '100%', maxHeight: '260px', cursor: 'pointer' }}
                                onClick={() => window.open(message.attachments[0].file_url, '_blank')}
                                onLoad={onImageLoaded}
                            />
                        ) : (
                            <a
                                href={message.attachments[0].file_url}
                                target="_blank"
                                rel="noreferrer"
                                className={`d-flex align-items-center gap-2 text-decoration-none ${isOwn ? 'text-white' : 'text-primary'}`}
                            >
                                <i className="bi bi-file-earmark-arrow-down"></i>
                                <span>{message.attachments[0].file_name || 'Tệp đính kèm'}</span>
                            </a>
                        )
                    ) : (
                        <div>{message.content}</div>
                    )}
                    <div className="d-flex align-items-center justify-content-between mt-2">
                        <div className={`text-end small ${isOwn ? 'text-white-50' : 'text-muted'}`} style={{ fontSize: '0.68rem' }}>
                            {time}
                        </div>
                        {isOwn && !message.revoked && (
                            <div className="position-relative d-flex align-items-center">
                                <button
                                    type="button"
                                    className={`btn btn-sm btn-icon p-0 rounded-circle text-${isOwn ? 'white' : 'dark'} ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                                    onClick={() => setMenuOpen((prev) => !prev)}
                                    style={{ width: '26px', height: '26px', transition: 'opacity 0.15s ease-in-out' }}
                                >
                                    <span className="d-flex align-items-center justify-content-center" style={{ width: '100%', height: '100%' }}>
                                        <i className="bi bi-three-dots-vertical" style={{ fontSize: '0.78rem' }}></i>
                                    </span>
                                </button>
                                {menuOpen && (
                                    <div
                                        ref={menuRef}
                                        className="position-absolute end-0 mt-2 bg-white border rounded-3 shadow-sm"
                                        style={{ minWidth: '130px', zIndex: 10 }}
                                    >
                                        <button
                                            type="button"
                                            className="d-flex align-items-center gap-2 px-3 py-2 w-100 text-start text-dark border-0 bg-transparent"
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
                <div className="ms-2 flex-shrink-0">
                    <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center overflow-hidden"
                        style={{ width: '26px', height: '26px', fontSize: '12px' }}>
                        <img
                            src={getAvatarUrl(message.sender_avatar)}
                            alt="avatar"
                            className="rounded-circle"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            onError={handleAvatarError}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatMessage;
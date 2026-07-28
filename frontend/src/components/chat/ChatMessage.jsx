import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { getAvatarUrl, getDefaultAvatarUrl } from '../../utils/avatar';
import {
    downloadAttachment,
    formatFileSize,
    getAttachmentName,
    getFileIcon,
    isImageAttachment
} from '../../utils/attachments';
import ImageLightbox from './ImageLightbox';

const ChatMessage = ({ message, isOwn, onRevoke, onImageLoaded }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(null);
    const messageRef = useRef(null);
    const menuRef = useRef(null);

    const attachments = message.revoked ? [] : (message.attachments || []);
    const imageAttachments = attachments.filter(isImageAttachment);
    const fileAttachments = attachments.filter(item => !isImageAttachment(item));
    const hasText = Boolean(message.content?.trim());
    const isAttachmentOnly = attachments.length > 0 && !hasText;
    const gridClass = imageAttachments.length === 1
        ? 'is-single'
        : imageAttachments.length === 2
            ? 'is-pair'
            : 'is-multiple';

    const time = new Date(message.created_at).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
    });

    useEffect(() => {
        if (!menuOpen) return undefined;

        const handleClickOutside = event => {
            if (
                menuRef.current
                && !menuRef.current.contains(event.target)
                && messageRef.current
                && !messageRef.current.contains(event.target)
            ) {
                setMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen]);

    const handleAvatarError = event => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = getDefaultAvatarUrl();
    };

    const handleDownload = async attachment => {
        try {
            await downloadAttachment(attachment);
        } catch {
            toast.error('Không thể tải tệp xuống');
        }
    };

    const renderFooter = () => (
        <div className="message-footer">
            <div className="message-time">{time}</div>
            {isOwn && !message.revoked && (
                <div className="message-options">
                    <button
                        type="button"
                        className={`message-menu-toggle ${isHovered || menuOpen ? 'is-visible' : ''}`}
                        onClick={() => setMenuOpen(prev => !prev)}
                        aria-label="Tùy chọn tin nhắn"
                        aria-expanded={menuOpen}
                    >
                        <i className="bi bi-three-dots"></i>
                    </button>
                    {menuOpen && (
                        <div ref={menuRef} className="message-menu">
                            <button
                                type="button"
                                className="message-menu-item"
                                onClick={() => {
                                    setMenuOpen(false);
                                    onRevoke();
                                }}
                            >
                                <i className="bi bi-trash"></i>
                                <span>Thu hồi</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <>
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
                <div className={`message-content ${attachments.length ? 'has-attachments' : ''}`}>
                    {!isOwn && (
                        <div className="message-sender">{message.sender_username}</div>
                    )}
                    <div
                        ref={messageRef}
                        className={[
                            'message-bubble',
                            message.revoked ? 'is-revoked' : '',
                            isAttachmentOnly ? 'is-attachment-only' : ''
                        ].filter(Boolean).join(' ')}
                    >
                        {hasText && <div className="message-text">{message.content}</div>}

                        {imageAttachments.length > 0 && (
                            <div className={`message-attachment-grid ${gridClass}`}>
                                {imageAttachments.map((attachment, index) => (
                                    <div className="message-image-item" key={`${attachment.file_url}-${index}`}>
                                        <button
                                            type="button"
                                            className="message-image-open"
                                            onClick={() => setLightboxIndex(index)}
                                            aria-label={`Xem ${getAttachmentName(attachment)}`}
                                        >
                                            <img
                                                src={attachment.file_url}
                                                alt={getAttachmentName(attachment)}
                                                onLoad={onImageLoaded}
                                            />
                                        </button>
                                        <div className="message-image-actions">
                                            <button
                                                type="button"
                                                onClick={() => setLightboxIndex(index)}
                                                title="Xem ảnh"
                                                aria-label="Xem ảnh"
                                            >
                                                <i className="bi bi-arrows-fullscreen"></i>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDownload(attachment)}
                                                title="Tải ảnh"
                                                aria-label="Tải ảnh"
                                            >
                                                <i className="bi bi-download"></i>
                                            </button>
                                            {isOwn && !message.revoked && (
                                                <button
                                                    type="button"
                                                    onClick={onRevoke}
                                                    title="Thu hồi tin nhắn"
                                                    aria-label="Thu hồi tin nhắn"
                                                >
                                                    <i className="bi bi-trash"></i>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {fileAttachments.length > 0 && (
                            <div className="message-file-list">
                                {fileAttachments.map((attachment, index) => (
                                    <div className="message-file-card" key={`${attachment.file_url}-${index}`}>
                                        <span className="message-file-icon">
                                            <i className={`bi ${getFileIcon(attachment)}`}></i>
                                        </span>
                                        <span className="message-file-details">
                                            <strong title={getAttachmentName(attachment)}>
                                                {getAttachmentName(attachment)}
                                            </strong>
                                            <small>
                                                {formatFileSize(attachment.file_size) || 'Tệp đính kèm'}
                                            </small>
                                        </span>
                                        <button
                                            type="button"
                                            className="message-file-download"
                                            onClick={() => handleDownload(attachment)}
                                            title="Tải file"
                                            aria-label={`Tải ${getAttachmentName(attachment)}`}
                                        >
                                            <i className="bi bi-download"></i>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!hasText && attachments.length === 0 && (
                            <div className="message-text">{message.content}</div>
                        )}

                        {renderFooter()}
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

            {lightboxIndex !== null && (
                <ImageLightbox
                    images={imageAttachments}
                    activeIndex={lightboxIndex}
                    onChange={setLightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                />
            )}
        </>
    );
};

export default ChatMessage;

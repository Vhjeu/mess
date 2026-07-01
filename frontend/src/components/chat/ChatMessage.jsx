const ChatMessage = ({ message, isOwn }) => {
    const time = new Date(message.created_at).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <div className={`d-flex mb-3 ${isOwn ? 'justify-content-end' : 'justify-content-start'}`}>
            {!isOwn && (
                <div className="me-2 flex-shrink-0">
                    <div className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center"
                        style={{ width: '32px', height: '32px', fontSize: '14px' }}>
                        {message.sender_avatar ? (
                            <img src={message.sender_avatar} alt="avatar" className="rounded-circle" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            message.sender_username?.charAt(0).toUpperCase()
                        )}
                    </div>
                </div>
            )}
            <div className={`max-w-70 ${isOwn ? 'order-1' : ''}`}>
                {!isOwn && (
                    <small className="text-muted ms-1 mb-1 d-block">{message.sender_username}</small>
                )}
                <div className={`p-2 rounded-3 shadow-sm ${isOwn ? 'bg-primary text-white' : 'bg-white text-dark'}`}
                    style={{ maxWidth: '400px' }}>
                    {message.has_attachment && message.attachments?.length > 0 ? (
                        message.attachments[0].file_type?.startsWith('image/') ? (
                            <img
                                src={message.attachments[0].file_url}
                                alt="attachment"
                                className="rounded"
                                style={{ maxWidth: '100%', maxHeight: '300px', cursor: 'pointer' }}
                                onClick={() => window.open(message.attachments[0].file_url, '_blank')}
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
                    <div className={`text-end small ${isOwn ? 'text-white-50' : 'text-muted'}`} style={{ fontSize: '0.7rem' }}>
                        {time}
                    </div>
                </div>
            </div>
            {isOwn && (
                <div className="ms-2 flex-shrink-0">
                    <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center"
                        style={{ width: '32px', height: '32px', fontSize: '14px' }}>
                        {message.sender_avatar ? (
                            <img src={message.sender_avatar} alt="avatar" className="rounded-circle" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            message.sender_username?.charAt(0).toUpperCase()
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatMessage;
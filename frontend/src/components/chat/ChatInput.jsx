import { useEffect, useRef, useState } from 'react';
import { formatFileSize, getFileIcon } from '../../utils/attachments';

const emojiList = [
    '😀', '😁', '😂', '😅', '😊', '😍', '😎', '😢', '😡', '👍',
    '🙏', '🎉', '💬', '🔥', '❤️', '🥳', '🙌', '🤔', '🥰', '👀',
    '🤖', '🍕', '🌟', '🎈', '🏆', '💡', '📌', '🚀', '🧠', '📎'
];

const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const createSelection = (file) => ({
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    file,
    isImage: file.type.startsWith('image/'),
    previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
});

const ChatInput = ({ onSendMessage, onSendFiles }) => {
    const [text, setText] = useState('');
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [showEmoji, setShowEmoji] = useState(false);
    const [uploadState, setUploadState] = useState({
        status: 'idle',
        progress: 0,
        error: ''
    });
    const textareaRef = useRef(null);
    const pickerRef = useRef(null);
    const imageInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const selectedFilesRef = useRef([]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                setShowEmoji(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => () => {
        selectedFilesRef.current.forEach(item => {
            if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });
    }, []);

    const updateSelectedFiles = (updater) => {
        setSelectedFiles(current => {
            const next = typeof updater === 'function' ? updater(current) : updater;
            selectedFilesRef.current = next;
            return next;
        });
    };

    const clearSelectedFiles = () => {
        selectedFilesRef.current.forEach(item => {
            if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });
        selectedFilesRef.current = [];
        setSelectedFiles([]);
    };

    const handleFilesSelected = (event) => {
        const incomingFiles = Array.from(event.target.files || []);
        event.target.value = '';
        if (!incomingFiles.length) return;

        const oversized = incomingFiles.find(file => file.size > MAX_FILE_SIZE);
        if (oversized) {
            setUploadState({
                status: 'error',
                progress: 0,
                error: `"${oversized.name}" vượt quá giới hạn 20 MB.`
            });
            return;
        }

        const availableSlots = MAX_FILES - selectedFilesRef.current.length;
        if (availableSlots <= 0) {
            setUploadState({
                status: 'error',
                progress: 0,
                error: `Chỉ được chọn tối đa ${MAX_FILES} file mỗi lần.`
            });
            return;
        }

        const acceptedFiles = incomingFiles.slice(0, availableSlots);
        updateSelectedFiles(current => [...current, ...acceptedFiles.map(createSelection)]);
        setUploadState({
            status: incomingFiles.length > availableSlots ? 'error' : 'idle',
            progress: 0,
            error: incomingFiles.length > availableSlots
                ? `Đã giữ ${MAX_FILES} file đầu tiên.`
                : ''
        });
    };

    const removeFile = (id) => {
        updateSelectedFiles(current => current.filter(item => {
            if (item.id !== id) return true;
            if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
            return false;
        }));
        setUploadState({ status: 'idle', progress: 0, error: '' });
    };

    const submitMessage = () => {
        const normalizedText = text.trim();

        if (selectedFilesRef.current.length) {
            const files = selectedFilesRef.current.map(item => item.file);
            try {
                // onSendFiles tạo bản preview riêng ngay trong khung chat trước khi
                // promise upload bắt đầu chờ mạng.
                const backgroundUpload = onSendFiles(files, normalizedText);
                clearSelectedFiles();
                setText('');
                setUploadState({ status: 'idle', progress: 0, error: '' });
                void Promise.resolve(backgroundUpload).catch(() => {
                    // Lỗi và nút thử lại được hiển thị trên tin nhắn optimistic.
                });
            } catch (error) {
                setUploadState({
                    status: 'error',
                    progress: 0,
                    error: error.response?.data?.message || error.message || 'Không thể gửi file. Hãy thử lại.'
                });
            }
            return;
        }

        if (normalizedText) {
            onSendMessage(normalizedText);
            setText('');
        }
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        submitMessage();
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submitMessage();
        }
    };

    const insertEmoji = (emoji) => {
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const nextText = text.slice(0, start) + emoji + text.slice(end);
        setText(nextText);
        setShowEmoji(false);

        requestAnimationFrame(() => {
            textarea.focus();
            const caret = start + emoji.length;
            textarea.setSelectionRange(caret, caret);
        });
    };

    const isUploading = uploadState.status === 'uploading';
    const canSend = Boolean(text.trim() || selectedFiles.length);

    return (
        <form onSubmit={handleSubmit} className="chat-input-inner">
            <div className="chat-composer">
                {(selectedFiles.length > 0 || uploadState.error) && (
                    <div className="attachment-preview-panel">
                        {selectedFiles.length > 0 && (
                            <div className="attachment-preview-list">
                                {selectedFiles.map(item => (
                                <div className="attachment-preview-item" key={item.id}>
                                    <div className="attachment-preview-thumbnail">
                                        {item.isImage ? (
                                            <img src={item.previewUrl} alt="" />
                                        ) : (
                                            <i className={`bi ${getFileIcon({
                                                file_name: item.file.name,
                                                file_type: item.file.type
                                            })}`}></i>
                                        )}
                                        {isUploading && (
                                            <span className="attachment-preview-uploading">
                                                <span className="button-spinner"></span>
                                            </span>
                                        )}
                                    </div>
                                    <div className="attachment-preview-meta">
                                        <strong title={item.file.name}>{item.file.name}</strong>
                                        <span>{formatFileSize(item.file.size)}</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="attachment-preview-remove"
                                        onClick={() => removeFile(item.id)}
                                        disabled={isUploading}
                                        title="Bỏ file"
                                        aria-label={`Bỏ ${item.file.name}`}
                                    >
                                        <i className="bi bi-x-lg"></i>
                                    </button>
                                </div>
                                ))}
                            </div>
                        )}

                        {(isUploading || uploadState.error) && (
                            <div className={`attachment-upload-status ${uploadState.error ? 'is-error' : ''}`}>
                                {isUploading ? (
                                    <>
                                        <div>
                                            <span>Đang tải lên...</span>
                                            <strong>{uploadState.progress}%</strong>
                                        </div>
                                        <div className="attachment-upload-track">
                                            <span style={{ width: `${uploadState.progress}%` }}></span>
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <span><i className="bi bi-exclamation-circle"></i> {uploadState.error}</span>
                                        {selectedFiles.length > 0 && (
                                            <button type="button" onClick={submitMessage}>Thử lại</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="chat-input-field" ref={pickerRef}>
                    <button
                        type="button"
                        className="input-icon"
                        onClick={() => imageInputRef.current.click()}
                        aria-label="Chọn ảnh"
                        title="Chọn ảnh"
                        disabled={isUploading}
                    >
                        <i className="bi bi-image"></i>
                    </button>
                    <button
                        type="button"
                        className="input-icon emoji-toggle"
                        onClick={() => setShowEmoji(prev => !prev)}
                        aria-label="Chọn emoji"
                        aria-expanded={showEmoji}
                        title="Emoji"
                        disabled={isUploading}
                    >
                        <i className="bi bi-emoji-smile"></i>
                    </button>
                    <button
                        type="button"
                        className="input-icon"
                        onClick={() => fileInputRef.current.click()}
                        aria-label="Đính kèm file"
                        title="Gửi file"
                        disabled={isUploading}
                    >
                        <i className="bi bi-paperclip"></i>
                    </button>
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        placeholder="Nhập tin nhắn..."
                        aria-label="Nội dung tin nhắn"
                        value={text}
                        onChange={event => setText(event.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isUploading}
                    />
                    {showEmoji && (
                        <div className="emoji-picker-panel scale-up" role="dialog" aria-label="Chọn emoji">
                            <div className="emoji-picker-header d-flex align-items-center justify-content-between">
                                <span>Emoji</span>
                                <button
                                    type="button"
                                    className="emoji-picker-close"
                                    onClick={() => setShowEmoji(false)}
                                    aria-label="Đóng"
                                >
                                    ×
                                </button>
                            </div>
                            <div className="emoji-grid">
                                {emojiList.map(emoji => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        className="emoji-item"
                                        onClick={() => insertEmoji(emoji)}
                                        title={`Chèn ${emoji}`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <input
                        type="file"
                        ref={imageInputRef}
                        className="d-none"
                        accept="image/*"
                        multiple
                        onChange={handleFilesSelected}
                    />
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="d-none"
                        multiple
                        onChange={handleFilesSelected}
                    />
                </div>
            </div>
            <button
                type="submit"
                className="send-button"
                disabled={!canSend}
                aria-label={isUploading ? 'Đang gửi file' : 'Gửi tin nhắn'}
                title={isUploading ? 'Đang gửi...' : 'Gửi'}
            >
                {isUploading
                    ? <span className="button-spinner"></span>
                    : <i className="bi bi-send-fill"></i>}
            </button>
        </form>
    );
};

export default ChatInput;

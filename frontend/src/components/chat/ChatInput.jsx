import { useState, useRef, useEffect } from 'react';

const emojiList = [
    '😀', '😁', '😂', '😅', '😊', '😍', '😎', '😢', '😡', '👍',
    '🙏', '🎉', '💬', '🔥', '❤️', '🥳', '🙌', '🤔', '🥰', '👀',
    '🤖', '🍕', '🌟', '🎈', '🏆', '💡', '📌', '🚀', '🧠', '📎'
];

const ChatInput = ({ onSendMessage, onSendImage }) => {
    const [text, setText] = useState('');
    const [showEmoji, setShowEmoji] = useState(false);
    const textareaRef = useRef(null);
    const pickerRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                setShowEmoji(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (text.trim()) {
            onSendMessage(text);
            setText('');
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            onSendImage(file);
            e.target.value = null;
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (text.trim()) {
                onSendMessage(text);
                setText('');
            }
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

    return (
        <form onSubmit={handleSubmit} className="chat-input-inner">
            <div className="chat-input-field" ref={pickerRef}>
                <button
                    type="button"
                    className="input-icon"
                    onClick={() => fileInputRef.current.click()}
                    title="Gửi ảnh"
                >
                    <i className="bi bi-image"></i>
                </button>
                <button
                    type="button"
                    className="input-icon emoji-toggle"
                    onClick={() => setShowEmoji((prev) => !prev)}
                    aria-label="Chọn emoji"
                    aria-expanded={showEmoji}
                    title="Emoji"
                >
                    <i className="bi bi-emoji-smile"></i>
                </button>
                <button
                    type="button"
                    className="input-icon"
                    onClick={() => fileInputRef.current.click()}
                    title="Gửi file"
                >
                    <i className="bi bi-paperclip"></i>
                </button>
                <textarea
                    ref={textareaRef}
                    rows={1}
                    placeholder="Nhập tin nhắn..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                {showEmoji && (
                    <div className="emoji-picker-panel scale-up" role="dialog" aria-label="Emoji picker">
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
                            {emojiList.map((emoji) => (
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
                    ref={fileInputRef}
                    className="d-none"
                    accept="*/*"
                    onChange={handleImageChange}
                />
            </div>
            <button
                type="submit"
                className="send-button"
                disabled={!text.trim()}
                title="Gửi"
            >
                <i className="bi bi-send-fill"></i>
            </button>
        </form>
    );
};

export default ChatInput;
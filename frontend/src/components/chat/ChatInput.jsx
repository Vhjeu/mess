import { useState, useRef } from 'react';

const ChatInput = ({ onSendMessage, onSendImage }) => {
    const [text, setText] = useState('');
    const fileInputRef = useRef(null);

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
            // Reset input
            e.target.value = null;
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-3 border-top bg-white">
            <div className="input-group">
                <button
                    type="button"
                    className="btn btn-outline-secondary rounded-start-pill"
                    onClick={() => fileInputRef.current.click()}
                    title="Gửi ảnh"
                >
                    <i className="bi bi-image"></i>
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="d-none"
                    accept="image/*"
                    onChange={handleImageChange}
                />
                <input
                    type="text"
                    className="form-control border-0"
                    placeholder="Nhập tin nhắn..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                />
                <button
                    type="submit"
                    className="btn btn-primary rounded-end-pill"
                    disabled={!text.trim()}
                >
                    <i className="bi bi-send"></i>
                </button>
            </div>
        </form>
    );
};

export default ChatInput;
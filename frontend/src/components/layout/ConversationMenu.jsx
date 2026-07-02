import { useEffect, useRef } from 'react';

const ConversationMenu = ({ open, onClose, onDelete, positionClass = '' }) => {
    const menuRef = useRef(null);

    useEffect(() => {
        if (!open) return;

        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };

        const handleEsc = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEsc);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            ref={menuRef}
            className={`conversation-menu ${positionClass}`.trim()}
            role="menu"
            aria-label="Menu cuộc trò chuyện"
        >
            <button type="button" className="conversation-menu-item" onClick={() => { onClose(); }}>
                <i className="bi bi-pin-angle"></i>
                <span>Ghim cuộc trò chuyện</span>
            </button>
            <button type="button" className="conversation-menu-item" onClick={() => { onClose(); }}>
                <i className="bi bi-bell-slash"></i>
                <span>Tắt thông báo</span>
            </button>
            <button type="button" className="conversation-menu-item conversation-menu-item-danger" onClick={() => { onClose(); onDelete(); }}>
                <i className="bi bi-trash"></i>
                <span>Xóa cuộc trò chuyện</span>
            </button>
        </div>
    );
};

export default ConversationMenu;

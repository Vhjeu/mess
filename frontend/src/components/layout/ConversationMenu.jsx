import { useEffect, useState } from 'react';

const ConversationMenu = ({ open, onClose, onDelete, positionClass = '', anchorRef }) => {
    const [mobilePosition, setMobilePosition] = useState({
        left: 12,
        top: 12,
        placement: 'below'
    });

    useEffect(() => {
        if (!open) return;

        const handleEsc = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        const updateMobilePosition = () => {
            if (!anchorRef?.current || !window.matchMedia('(max-width: 860px)').matches) return;

            const anchor = anchorRef.current.getBoundingClientRect();
            const viewportWidth = window.visualViewport?.width || window.innerWidth;
            const viewportHeight = window.visualViewport?.height || window.innerHeight;
            const menuWidth = Math.min(218, viewportWidth - 24);
            const estimatedMenuHeight = 146;
            const placement = viewportHeight - anchor.bottom >= estimatedMenuHeight + 12
                ? 'below'
                : 'above';

            setMobilePosition({
                left: Math.min(
                    Math.max(12, anchor.right - menuWidth),
                    viewportWidth - menuWidth - 12
                ),
                top: placement === 'below' ? anchor.bottom + 6 : anchor.top - 6,
                placement
            });
        };

        updateMobilePosition();
        document.addEventListener('keydown', handleEsc);
        window.addEventListener('resize', updateMobilePosition);
        window.addEventListener('scroll', updateMobilePosition, true);
        return () => {
            document.removeEventListener('keydown', handleEsc);
            window.removeEventListener('resize', updateMobilePosition);
            window.removeEventListener('scroll', updateMobilePosition, true);
        };
    }, [anchorRef, open, onClose]);

    if (!open) return null;

    return (
        <div
            className={`conversation-menu ${positionClass} menu-${mobilePosition.placement}`.trim()}
            style={{
                '--conversation-menu-left': `${mobilePosition.left}px`,
                '--conversation-menu-top': `${mobilePosition.top}px`
            }}
            role="menu"
            onMouseDown={(event) => event.stopPropagation()}
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

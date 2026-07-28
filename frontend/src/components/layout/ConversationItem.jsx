import { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { formatRelativeTime } from '../../utils/timeFormat';
import { getAvatarUrl, getDefaultAvatarUrl } from '../../utils/avatar';
import ConversationMenu from './ConversationMenu';

const ConversationItem = ({ conversation, currentUserId, onlineUsers, nicknameMap = {}, onDeleteConversation }) => {
    // Lấy thông tin thành viên không phải là current user
    const otherMembers = conversation.members.filter(m => m.id !== currentUserId);
    // Trong chat 1-1, sẽ có 1 thành viên khác. Với chat nhóm sau này sẽ cần xử lý khác.
    const displayMember = otherMembers.length > 0 ? otherMembers[0] : { username: 'Unknown', display_name: 'Unknown', avatar_url: null };
    const displayName = nicknameMap[displayMember.id] || displayMember.display_name || displayMember.username;
    const isOnline = onlineUsers.has(displayMember.id);

    // Tin nhắn cuối
    const lastMsg = conversation.lastMessage;
    const lastMsgContent = lastMsg
        ? (
            lastMsg.has_attachment
                ? (lastMsg.content?.substring(0, 30) || '[Tệp đính kèm]')
                : (lastMsg.content?.substring(0, 30) || '')
        )
        : 'Chưa có tin nhắn';
    const lastMsgPrefix = lastMsg?.sender_id === currentUserId ? 'Bạn: ' : '';
    const lastMsgTime = lastMsg ? formatRelativeTime(lastMsg.created_at) : '';

    // Badge chưa đọc
    const unreadCount = conversation.unread_count || 0;
    const [menuOpen, setMenuOpen] = useState(false);
    const [hovered, setHovered] = useState(false);
    const menuRootRef = useRef(null);
    const menuButtonRef = useRef(null);
    useEffect(() => {
        if (!menuOpen) return;

        const handleClickOutside = (event) => {
            if (menuRootRef.current && !menuRootRef.current.contains(event.target)) {
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

    const handleMenuToggle = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setMenuOpen(prev => !prev);
    };

    const handleDeleteClick = () => {
        if (onDeleteConversation) {
            onDeleteConversation(conversation);
        }
    };

    return (
        <div
            ref={menuRootRef}
            className="conversation-item-wrapper"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <NavLink
                to={`/chat/${conversation.id}`}
                className={({ isActive }) =>
                    `conversation-item ${isActive ? 'conversation-item-active' : ''}`
                }
            >
                <div className="avatar-sm">
                    <div className="avatar-sm-media">
                        {displayMember.avatar_url ? (
                            <img
                                src={getAvatarUrl(displayMember.avatar_url)}
                                alt=""
                                onError={handleAvatarError}
                            />
                        ) : (
                            <div className="avatar-fallback">
                                {(displayMember.display_name || displayMember.username)?.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    {isOnline && <span className="online-dot" />}
                </div>

                <div className="conversation-body">
                    <div className="title-row">
                        <div className="name">{displayName}</div>
                        <small className="conversation-time">{lastMsgTime}</small>
                    </div>
                    <div className="snippet-row">
                        <span className="snippet">
                            {lastMsgPrefix}{lastMsgContent}
                        </span>
                        {unreadCount > 0 && (
                            <span className="conversation-badge">{unreadCount}</span>
                        )}
                    </div>
                </div>
            </NavLink>

            <button
                ref={menuButtonRef}
                type="button"
                className={`conversation-menu-toggle ${menuOpen || hovered ? 'visible' : ''}`}
                onClick={handleMenuToggle}
                aria-label="Tùy chọn cuộc trò chuyện"
                title="Tùy chọn"
            >
                <i className="bi bi-three-dots"></i>
            </button>

            <ConversationMenu
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                onDelete={handleDeleteClick}
                positionClass="menu-right"
                anchorRef={menuButtonRef}
            />
        </div>
    );
};

export default ConversationItem;

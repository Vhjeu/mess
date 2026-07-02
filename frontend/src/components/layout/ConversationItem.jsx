import { NavLink } from 'react-router-dom';
import { formatRelativeTime } from '../../utils/timeFormat';
import { getAvatarUrl, getDefaultAvatarUrl } from '../../utils/avatar';

const ConversationItem = ({ conversation, currentUserId, onlineUsers, nicknameMap = {} }) => {
    // Lấy thông tin thành viên không phải là current user
    const otherMembers = conversation.members.filter(m => m.id !== currentUserId);
    // Trong chat 1-1, sẽ có 1 thành viên khác. Với chat nhóm sau này sẽ cần xử lý khác.
    const displayMember = otherMembers.length > 0 ? otherMembers[0] : { username: 'Unknown', display_name: 'Unknown', avatar_url: null };
    const displayName = nicknameMap[displayMember.id] || displayMember.display_name || displayMember.username;
    const isOnline = onlineUsers.has(displayMember.id);

    // Tin nhắn cuối
    const lastMsg = conversation.lastMessage;
    const lastMsgContent = lastMsg
        ? (lastMsg.has_attachment ? '[Tệp đính kèm]' : (lastMsg.content?.substring(0, 30) || ''))
        : 'Chưa có tin nhắn';
    const lastMsgTime = lastMsg ? formatRelativeTime(lastMsg.created_at) : '';

    // Badge chưa đọc
    const unreadCount = conversation.unread_count || 0;

    const handleAvatarError = (event) => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = getDefaultAvatarUrl();
    };

    return (
        <NavLink
            to={`/chat/${conversation.id}`}
            className={({ isActive }) =>
                `conversation-item ${isActive ? 'conversation-item-active' : ''}`
            }
        >
            {/* Avatar */}
            <div className="avatar-sm">
                {displayMember.avatar_url ? (
                    <img
                        src={getAvatarUrl(displayMember.avatar_url)}
                        alt="avatar"
                        onError={handleAvatarError}
                    />
                ) : (
                    <div className="avatar-fallback bg-primary d-flex align-items-center justify-content-center text-white">
                        {(displayMember.display_name || displayMember.username)?.charAt(0).toUpperCase()}
                    </div>
                )}
                {isOnline && <span className="online-dot" />}
            </div>

            {/* Nội dung */}
            <div className="conversation-body">
                <div className="title-row">
                    <div className="name">{displayName}</div>
                    <small className="text-secondary">{lastMsgTime}</small>
                </div>
                <div className="d-flex justify-content-between align-items-center">
                    <small className="snippet">
                        {lastMsgContent}
                    </small>
                    {unreadCount > 0 && (
                        <span className="conversation-badge">{unreadCount}</span>
                    )}
                </div>
            </div>
        </NavLink>
    );
};

export default ConversationItem;
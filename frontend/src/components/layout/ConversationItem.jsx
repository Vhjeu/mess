import { NavLink } from 'react-router-dom';
import { formatRelativeTime } from '../../utils/timeFormat';

const ConversationItem = ({ conversation, currentUserId, onlineUsers, nicknameMap = {} }) => {
    // Lấy thông tin thành viên không phải là current user
    const otherMembers = conversation.members.filter(m => m.id !== currentUserId);
    // Trong chat 1-1, sẽ có 1 thành viên khác. Với chat nhóm sau này sẽ cần xử lý khác.
    const displayMember = otherMembers.length > 0 ? otherMembers[0] : { username: 'Unknown', avatar_url: null };
    const displayName = nicknameMap[displayMember.id] || displayMember.username;
    const isOnline = onlineUsers.has(displayMember.id);

    // Tin nhắn cuối
    const lastMsg = conversation.lastMessage;
    const lastMsgContent = lastMsg
        ? (lastMsg.has_attachment ? '[Tệp đính kèm]' : (lastMsg.content?.substring(0, 30) || ''))
        : 'Chưa có tin nhắn';
    const lastMsgTime = lastMsg ? formatRelativeTime(lastMsg.created_at) : '';

    // Badge chưa đọc
    const unreadCount = conversation.unread_count || 0;

    return (
        <NavLink
            to={`/chat/${conversation.id}`}
            className="d-flex align-items-center p-3 text-decoration-none text-dark border-bottom border-light hover-bg-light"
            style={({ isActive }) => ({
                backgroundColor: isActive ? '#e8f0fe' : 'transparent'
            })}
        >
            {/* Avatar */}
            <div className="position-relative me-3 flex-shrink-0">
                <div className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center"
                    style={{ width: '48px', height: '48px', fontSize: '20px' }}>
                    {displayMember.avatar_url ? (
                        <img src={displayMember.avatar_url} alt="avatar" className="rounded-circle" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        displayMember.username?.charAt(0).toUpperCase()
                    )}
                </div>
                {isOnline && (
                    <span className="position-absolute bottom-0 end-0 bg-success rounded-circle border border-white"
                        style={{ width: '12px', height: '12px' }}></span>
                )}
            </div>

            {/* Nội dung */}
            <div className="flex-grow-1 min-w-0">
                <div className="d-flex justify-content-between align-items-center">
                    <div className="fw-semibold text-truncate">{displayMember.username}</div>
                    <small className="text-muted ms-2 flex-shrink-0">{lastMsgTime}</small>
                </div>
                <div className="d-flex justify-content-between align-items-center">
                    <small className={`text-truncate ${!lastMsg ? 'text-muted fst-italic' : 'text-muted'}`}>
                        {lastMsgContent}
                    </small>
                    {unreadCount > 0 && (
                        <span className="badge bg-primary rounded-pill ms-2">{unreadCount}</span>
                    )}
                </div>
            </div>
        </NavLink>
    );
};

export default ConversationItem;
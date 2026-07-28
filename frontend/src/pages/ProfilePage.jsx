import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { changePassword, updateProfile, uploadAvatar } from '../services/userService';
import { getAvatarUrl } from '../utils/avatar';
import { getDisplayNameLength, normalizeDisplayName, validateDisplayName } from '../utils/displayName';

const formatAvailableAt = (timestamp) => new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short'
}).format(new Date(timestamp));

const formatRemainingTime = (remainingMs) => {
    const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];

    if (days) parts.push(`${days} ngày`);
    if (hours) parts.push(`${hours} giờ`);
    if (!days && minutes) parts.push(`${minutes} phút`);

    return parts.join(' ');
};

const ProfilePage = () => {
    const { user, setUser } = useAuth();
    const navigate = useNavigate();
    const [displayName, setDisplayName] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [now, setNow] = useState(Date.now());
    const [avatarPreview, setAvatarPreview] = useState('');
    const avatarPreviewRef = useRef('');

    const displayNameValidation = validateDisplayName(displayName);
    const normalizedCurrentDisplayName = normalizeDisplayName(user?.display_name || user?.username || '');
    const availableAt = Number(user?.display_name_change_available_at || 0);
    const remainingMs = Math.max(0, availableAt - now);
    const isDisplayNameCooldown = remainingMs > 0;
    const isDisplayNameUnchanged = displayNameValidation.valid
        && displayNameValidation.displayName === normalizedCurrentDisplayName;

    useEffect(() => {
        if (user) {
            setDisplayName(user.display_name || user.username || '');
        }
    }, [user]);

    useEffect(() => {
        if (!availableAt) return undefined;

        setNow(Date.now());
        const timer = window.setInterval(() => setNow(Date.now()), 30000);
        return () => window.clearInterval(timer);
    }, [availableAt]);

    useEffect(() => () => {
        if (avatarPreviewRef.current) {
            URL.revokeObjectURL(avatarPreviewRef.current);
        }
    }, []);

    const handleProfileSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        if (!displayNameValidation.valid) {
            setError(displayNameValidation.message);
            setLoading(false);
            return;
        }

        try {
            const updated = await updateProfile(displayNameValidation.displayName);
            if (setUser) {
                setUser(updated);
            }
            setDisplayName(updated.display_name);
            setMessage('Cập nhật tên hiển thị thành công');
        } catch (err) {
            const responseData = err.response?.data;
            const nextAvailableAt = Number(responseData?.display_name_change_available_at || 0);
            if (nextAvailableAt && setUser) {
                setUser(current => ({
                    ...current,
                    display_name_change_available_at: nextAvailableAt
                }));
            }

            const cooldownDetail = nextAvailableAt
                ? ` Bạn có thể đổi lại vào ${formatAvailableAt(nextAvailableAt)}.`
                : '';
            setError(`${responseData?.message || 'Lỗi cập nhật tên hiển thị'}${cooldownDetail}`);
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const input = e.target;
        const previewUrl = URL.createObjectURL(file);
        if (avatarPreviewRef.current) {
            URL.revokeObjectURL(avatarPreviewRef.current);
        }
        avatarPreviewRef.current = previewUrl;
        setAvatarPreview(previewUrl);

        setLoading(true);
        setError('');
        setMessage('');
        try {
            const formData = new FormData();
            formData.append('avatar', file);
            const updated = await uploadAvatar(formData);
            if (setUser) {
                setUser(updated);
            }
            setMessage('Cập nhật ảnh đại diện thành công');
        } catch (err) {
            setError(err.response?.data?.message || 'Lỗi cập nhật ảnh đại diện');
        } finally {
            if (avatarPreviewRef.current === previewUrl) {
                URL.revokeObjectURL(previewUrl);
                avatarPreviewRef.current = '';
                setAvatarPreview('');
            }
            setLoading(false);
            input.value = '';
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');
        try {
            await changePassword(currentPassword, newPassword);
            setMessage('Đổi mật khẩu thành công');
            setCurrentPassword('');
            setNewPassword('');
        } catch (err) {
            setError(err.response?.data?.message || 'Lỗi đổi mật khẩu');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="section-page profile-page">
            <header className="section-page-header">
                <button className="section-back-button" type="button" onClick={() => navigate(-1)} aria-label="Quay lại">
                    <i className="bi bi-arrow-left"></i>
                </button>
                <div>
                    <span className="section-eyebrow">Tài khoản</span>
                    <h1>Hồ sơ cá nhân</h1>
                    <p>Cập nhật cách bạn xuất hiện trong các cuộc trò chuyện.</p>
                </div>
            </header>

            {(message || error) && (
                <div className={`profile-feedback ${error ? 'is-error' : 'is-success'}`} role="status">
                    <i className={`bi ${error ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill'}`}></i>
                    <span>{error || message}</span>
                </div>
            )}

            <div className="profile-layout">
                <aside className="profile-summary-card">
                    <div className="profile-avatar-shell">
                        <div className="profile-avatar">
                            {avatarPreview || user?.avatar_url ? (
                                <img
                                    src={avatarPreview || getAvatarUrl(user.avatar_url)}
                                    alt=""
                                />
                            ) : (
                                <span>{(user?.display_name || user?.username || 'U').charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                        <label className="profile-avatar-button" title="Đổi ảnh đại diện">
                            <i className="bi bi-camera-fill"></i>
                            <input type="file" accept="image/*" onChange={handleAvatarChange} />
                        </label>
                    </div>
                    <h2>{user?.display_name || user?.username}</h2>
                    <p>@{user?.username}</p>
                    <div className="profile-status"><span></span>Đang hoạt động</div>
                </aside>

                <div className="profile-forms">
                    <section className="profile-form-card">
                        <div className="profile-card-heading">
                            <span className="profile-card-icon"><i className="bi bi-person"></i></span>
                            <div>
                                <h3>Thông tin cá nhân</h3>
                                <p>Thông tin cơ bản hiển thị với mọi người.</p>
                            </div>
                        </div>
                        <form onSubmit={handleProfileSave} className="profile-form">
                            <div className="app-field">
                                <label htmlFor="profileUsername">Tên tài khoản</label>
                                <input id="profileUsername" value={user?.username || ''} disabled />
                                <small>Dùng để đăng nhập và không thể thay đổi.</small>
                            </div>
                            <div className="app-field">
                                <label htmlFor="profileDisplayName">Tên hiển thị</label>
                                <input
                                    id="profileDisplayName"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    onBlur={() => setDisplayName(current => normalizeDisplayName(current))}
                                    minLength={2}
                                    maxLength={30}
                                    disabled={loading || isDisplayNameCooldown}
                                    aria-describedby="profileDisplayNameHelp"
                                />
                                <small id="profileDisplayNameHelp">
                                    Từ 2 đến 30 ký tự; khoảng trắng thừa sẽ tự động được loại bỏ.
                                    {' '}{getDisplayNameLength(normalizeDisplayName(displayName))}/30 ký tự.
                                </small>
                                {isDisplayNameCooldown && (
                                    <div className="profile-name-cooldown" role="status">
                                        <i className="bi bi-clock-history"></i>
                                        <span>
                                            Có thể đổi lại vào {formatAvailableAt(availableAt)}
                                            {' '}— còn {formatRemainingTime(remainingMs)}.
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="profile-form-actions">
                                <button
                                    className="app-button app-button--primary"
                                    type="submit"
                                    disabled={
                                        loading
                                        || isDisplayNameCooldown
                                        || !displayNameValidation.valid
                                        || isDisplayNameUnchanged
                                    }
                                >
                                    {loading ? <><span className="button-spinner"></span>Đang lưu...</> : 'Lưu thay đổi'}
                                </button>
                            </div>
                        </form>
                    </section>

                    <section className="profile-form-card">
                        <div className="profile-card-heading">
                            <span className="profile-card-icon"><i className="bi bi-shield-lock"></i></span>
                            <div>
                                <h3>Đổi mật khẩu</h3>
                                <p>Sử dụng mật khẩu mạnh và không dùng lại ở nơi khác.</p>
                            </div>
                        </div>
                        <form onSubmit={handlePasswordChange} className="profile-form">
                            <div className="profile-field-grid">
                                <div className="app-field">
                                    <label htmlFor="currentPassword">Mật khẩu hiện tại</label>
                                    <input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                                </div>
                                <div className="app-field">
                                    <label htmlFor="newPassword">Mật khẩu mới</label>
                                    <input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                                </div>
                            </div>
                            <div className="profile-form-actions">
                                <button className="app-button app-button--secondary" type="submit" disabled={loading}>
                                    {loading ? <><span className="button-spinner"></span>Đang xử lý...</> : 'Cập nhật mật khẩu'}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;

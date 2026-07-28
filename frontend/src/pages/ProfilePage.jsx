import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { changePassword, updateProfile, uploadAvatar } from '../services/userService';
import { getAvatarUrl } from '../utils/avatar';

const ProfilePage = () => {
    const { user, setUser } = useAuth();
    const navigate = useNavigate();
    const [displayName, setDisplayName] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setDisplayName(user.display_name || user.username || '');
        }
    }, [user]);

    const handleProfileSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');
        try {
            const updated = await updateProfile(displayName);
            if (setUser) {
                setUser(updated);
            }
            setMessage('Cập nhật tên hiển thị thành công');
        } catch (err) {
            setError(err.response?.data?.message || 'Lỗi cập nhật tên hiển thị');
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
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
            setLoading(false);
            e.target.value = '';
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
                    <div className="profile-avatar">
                        {user?.avatar_url ? (
                            <img src={getAvatarUrl(user.avatar_url)} alt="" />
                        ) : (
                            <span>{(user?.display_name || user?.username || 'U').charAt(0).toUpperCase()}</span>
                        )}
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
                                <small>Tên tài khoản hiện không thể thay đổi.</small>
                            </div>
                            <div className="app-field">
                                <label htmlFor="profileDisplayName">Tên hiển thị</label>
                                <input id="profileDisplayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                            </div>
                            <div className="profile-form-actions">
                                <button className="app-button app-button--primary" type="submit" disabled={loading}>
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

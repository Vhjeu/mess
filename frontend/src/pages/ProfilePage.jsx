import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { changePassword, updateProfile, uploadAvatar } from '../services/userService';
import { getAvatarUrl } from '../utils/avatar';

const ProfilePage = () => {
    const { user, setUser } = useAuth();
    const navigate = useNavigate();
    const [displayName, setDisplayName] = useState('');
    const [avatarFile, setAvatarFile] = useState(null);
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
        setAvatarFile(file);
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
        <div className="min-vh-100 bg-light dark:bg-gray-900 p-4">
            <div className="container py-4">
                <button className="btn btn-outline-secondary btn-sm mb-4" onClick={() => navigate(-1)}>
                    <i className="bi bi-arrow-left me-2"></i>Quay lại
                </button>
                <div className="row g-4">
                    <div className="col-lg-4">
                        <div className="card shadow-sm border-0 rounded-4">
                            <div className="card-body text-center p-4">
                                <div className="position-relative d-inline-block mb-3">
                                    <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style={{ width: '82px', height: '82px', fontSize: '26px' }}>
                                        {user?.avatar_url ? (
                                            <img src={getAvatarUrl(user.avatar_url)} alt="avatar" className="rounded-circle" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            (user?.display_name || user?.username || 'U').charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <label className="position-absolute bottom-0 end-0 btn btn-sm btn-primary rounded-circle" style={{ width: '28px', height: '28px', padding: 0 }} title="Đổi ảnh đại diện">
                                        <i className="bi bi-camera"></i>
                                        <input type="file" accept="image/*" className="d-none" onChange={handleAvatarChange} />
                                    </label>
                                </div>
                                <h4 className="fw-bold mb-1">{user?.display_name || user?.username}</h4>
                                <p className="text-muted mb-0">Quản lý thông tin cá nhân</p>
                            </div>
                        </div>
                    </div>
                    <div className="col-lg-8">
                        <div className="card shadow-sm border-0 rounded-4 mb-4">
                            <div className="card-body p-4">
                                <h5 className="fw-bold mb-3">Thông tin cá nhân</h5>
                                {message && <div className="alert alert-success py-2">{message}</div>}
                                {error && <div className="alert alert-danger py-2">{error}</div>}
                                <form onSubmit={handleProfileSave}>
                                    <div className="mb-3">
                                        <label className="form-label">Tên tài khoản (username)</label>
                                        <input className="form-control" value={user?.username || ''} disabled />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Tên hiển thị</label>
                                        <input className="form-control" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                                    </div>
                                    <button className="btn btn-primary" type="submit" disabled={loading}>
                                        {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                                    </button>
                                </form>
                            </div>
                        </div>

                        <div className="card shadow-sm border-0 rounded-4">
                            <div className="card-body p-4">
                                <h5 className="fw-bold mb-3">Đổi mật khẩu</h5>
                                <form onSubmit={handlePasswordChange}>
                                    <div className="mb-3">
                                        <label className="form-label">Mật khẩu hiện tại</label>
                                        <input className="form-control" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Mật khẩu mới</label>
                                        <input className="form-control" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                                    </div>
                                    <button className="btn btn-outline-primary" type="submit" disabled={loading}>
                                        {loading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
import { useContext, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../../services/authService';
import { ThemeContext } from '../../contexts/ThemeContext';
import {
    MAX_DISPLAY_NAME_LENGTH,
    normalizeDisplayName,
    validateDisplayName
} from '../../utils/displayName';

const RegisterForm = () => {
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const { theme, toggleTheme } = useContext(ThemeContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        const displayNameValidation = validateDisplayName(displayName);
        if (!displayNameValidation.valid) {
            setError(displayNameValidation.message);
            return;
        }

        if (password !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp');
            return;
        }
        setLoading(true);
        try {
            const normalizedUsername = username.trim();
            setUsername(normalizedUsername);
            setDisplayName(displayNameValidation.displayName);
            await register(normalizedUsername, displayNameValidation.displayName, password, confirmPassword);
            setSuccess('Đăng ký thành công! Đang chuyển hướng...');
            setTimeout(() => navigate('/login'), 1500);
        } catch (err) {
            setError(err.response?.data?.message || 'Đăng ký thất bại');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-shell">
            <button
                type="button"
                className="auth-theme-toggle"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Chuyển sang light mode' : 'Chuyển sang dark mode'}
                title={theme === 'dark' ? 'Chuyển sang light mode' : 'Chuyển sang dark mode'}
            >
                <i className={`bi ${theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-fill'}`}></i>
            </button>
            <div className="auth-card auth-card--reverse">
                <div className="auth-panel auth-panel--info">
                    <div className="auth-brand">
                        <span><i className="bi bi-chat-heart-fill"></i></span>
                        <strong>Nhắn Tin</strong>
                    </div>
                    <h1>Bắt đầu hành trình mới</h1>
                    <p>Đăng ký để sử dụng nền tảng nhắn tin thân thiện, tối giản và dễ dàng cho mọi nhu cầu liên lạc.</p>
                    <div className="auth-features">
                        <div>
                            <i className="bi bi-person-lines-fill"></i>
                            <span>Không gian liên lạc riêng tư</span>
                        </div>
                        <div>
                            <i className="bi bi-lightning-charge-fill"></i>
                            <span>Phản hồi nhanh, mượt mà</span>
                        </div>
                        <div>
                            <i className="bi bi-brush-fill"></i>
                            <span>Thiết kế gọn gàng, chuyên nghiệp</span>
                        </div>
                    </div>
                    <div className="auth-illustration" aria-hidden="true">
                        <span className="auth-chat-bubble auth-chat-bubble--one"></span>
                        <span className="auth-chat-bubble auth-chat-bubble--two"></span>
                        <div className="auth-illustration-ring"><i className="bi bi-person-plus-fill"></i></div>
                    </div>
                </div>
                <div className="auth-panel auth-panel--form">
                    <div className="auth-form-header">
                        <span>Đăng ký</span>
                        <h2>Tạo tài khoản Nhắn Tin</h2>
                    </div>
                    {error && <div className="alert alert-danger py-2">{error}</div>}
                    {success && <div className="alert alert-success py-2">{success}</div>}
                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="auth-field-block">
                            <div className="form-floating auth-input-group">
                                <input
                                    type="text"
                                    className="form-control"
                                    id="registerUsername"
                                    placeholder="Tên tài khoản"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    required
                                    maxLength={50}
                                    autoComplete="username"
                                    aria-describedby="registerUsernameHint"
                                />
                                <label htmlFor="registerUsername">Tên tài khoản</label>
                            </div>
                            <small className="auth-field-hint" id="registerUsernameHint">
                                Dùng để đăng nhập và không thể thay đổi sau khi đăng ký.
                            </small>
                        </div>
                        <div className="auth-field-block">
                            <div className="form-floating auth-input-group">
                                <input
                                    type="text"
                                    className="form-control"
                                    id="registerDisplayName"
                                    placeholder="Tên hiển thị"
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                    onBlur={() => setDisplayName(current => normalizeDisplayName(current))}
                                    required
                                    maxLength={MAX_DISPLAY_NAME_LENGTH}
                                    autoComplete="name"
                                    aria-describedby="registerDisplayNameHint"
                                />
                                <label htmlFor="registerDisplayName">Tên hiển thị</label>
                            </div>
                            <small className="auth-field-hint" id="registerDisplayNameHint">
                                Hiển thị với mọi người, từ 2 đến {MAX_DISPLAY_NAME_LENGTH} ký tự.
                            </small>
                        </div>
                        <div className="form-floating mb-3 auth-input-group">
                            <input
                                type="password"
                                className="form-control"
                                id="registerPassword"
                                placeholder="Mật khẩu"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={6}
                                autoComplete="new-password"
                            />
                            <label htmlFor="registerPassword">Mật khẩu</label>
                        </div>
                        <div className="form-floating mb-4 auth-input-group">
                            <input
                                type="password"
                                className="form-control"
                                id="registerConfirmPassword"
                                placeholder="Xác nhận mật khẩu"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                                minLength={6}
                                autoComplete="new-password"
                            />
                            <label htmlFor="registerConfirmPassword">Xác nhận mật khẩu</label>
                        </div>
                        <button type="submit" className="btn btn-secondary w-100 auth-action" disabled={loading}>
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2"></span>
                                    Đang đăng ký...
                                </>
                            ) : 'Tạo tài khoản'}
                        </button>
                    </form>
                    <p className="auth-help">
                        Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegisterForm;

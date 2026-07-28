import { useContext, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';
import { ThemeContext } from '../../contexts/ThemeContext';

const LoginForm = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { loginContext } = useAuth();
    const { theme, toggleTheme } = useContext(ThemeContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await login(username, password);
            loginContext(data.token, data.user);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || 'Đăng nhập thất bại');
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
            <div className="auth-card">
                <div className="auth-panel auth-panel--info">
                    <div className="auth-brand">
                        <span><i className="bi bi-chat-heart-fill"></i></span>
                        <strong>Nhắn Tin</strong>
                    </div>
                    <h1>Xin chào trở lại</h1>
                    <p>Đăng nhập để tiếp tục kết nối với bạn bè và đối tác trong không gian trò chuyện tinh gọn, an toàn.</p>
                    <div className="auth-features">
                        <div>
                            <i className="bi bi-chat-square-text-fill"></i>
                            <span>Giao diện rõ ràng</span>
                        </div>
                        <div>
                            <i className="bi bi-phone-fill"></i>
                            <span>Tối ưu cho mọi thiết bị</span>
                        </div>
                        <div>
                            <i className="bi bi-lock-fill"></i>
                            <span>Bảo mật đáng tin cậy</span>
                        </div>
                    </div>
                    <div className="auth-illustration" aria-hidden="true">
                        <span className="auth-chat-bubble auth-chat-bubble--one"></span>
                        <span className="auth-chat-bubble auth-chat-bubble--two"></span>
                        <div className="auth-illustration-ring"><i className="bi bi-chat-dots-fill"></i></div>
                    </div>
                </div>
                <div className="auth-panel auth-panel--form">
                    <div className="auth-form-header">
                        <span>Đăng nhập</span>
                        <h2>Tiếp tục cuộc trò chuyện</h2>
                    </div>
                    {error && <div className="alert alert-danger py-2">{error}</div>}
                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-floating mb-3 auth-input-group">
                            <input
                                type="text"
                                className="form-control"
                                id="loginUsername"
                                placeholder="Tên tài khoản"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                required
                            />
                            <label htmlFor="loginUsername">Tên tài khoản</label>
                        </div>
                        <div className="form-floating mb-4 auth-input-group">
                            <input
                                type="password"
                                className="form-control"
                                id="loginPassword"
                                placeholder="Mật khẩu"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                            <label htmlFor="loginPassword">Mật khẩu</label>
                        </div>
                        <div className="auth-forgot-row">
                            <Link to="/forgot-password">Quên mật khẩu?</Link>
                        </div>
                        <button type="submit" className="btn btn-primary w-100 auth-action" disabled={loading}>
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2"></span>
                                    Đang đăng nhập...
                                </>
                            ) : 'Đăng nhập'}
                        </button>
                    </form>
                    <p className="auth-help">
                        Chưa có tài khoản? <Link to="/register">Tạo mới ngay</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginForm;

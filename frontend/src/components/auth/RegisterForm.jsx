import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../../services/authService';

const RegisterForm = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (password !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp');
            return;
        }
        setLoading(true);
        try {
            await register(username, password, confirmPassword);
            setSuccess('Đăng ký thành công! Đang chuyển hướng...');
            setTimeout(() => navigate('/login'), 1500);
        } catch (err) {
            setError(err.response?.data?.message || 'Đăng ký thất bại');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center bg-gray-100 dark:bg-gray-900">
            <div className="bg-white dark:bg-gray-800 shadow-lg rounded-4 p-4 p-md-5 w-100" style={{ maxWidth: '400px' }}>
                <div className="text-center mb-4">
                    <i className="bi bi-person-plus text-primary display-4"></i>
                    <h3 className="fw-bold mt-2">Đăng ký tài khoản</h3>
                </div>
                {error && <div className="alert alert-danger py-2">{error}</div>}
                {success && <div className="alert alert-success py-2">{success}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label className="form-label fw-medium">Username</label>
                        <div className="input-group">
                            <span className="input-group-text"><i className="bi bi-person"></i></span>
                            <input type="text" className="form-control" value={username} onChange={e => setUsername(e.target.value)} required />
                        </div>
                    </div>
                    <div className="mb-3">
                        <label className="form-label fw-medium">Mật khẩu</label>
                        <div className="input-group">
                            <span className="input-group-text"><i className="bi bi-lock"></i></span>
                            <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="form-label fw-medium">Xác nhận mật khẩu</label>
                        <div className="input-group">
                            <span className="input-group-text"><i className="bi bi-lock-fill"></i></span>
                            <input type="password" className="form-control" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
                        </div>
                    </div>
                    <button type="submit" className="btn btn-success w-100 fw-semibold" disabled={loading}>
                        {loading ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2"></span>
                                Đang đăng ký...
                            </>
                        ) : 'Đăng ký'}
                    </button>
                </form>
                <p className="text-center mt-3 mb-0">
                    Đã có tài khoản? <Link to="/login" className="text-primary text-decoration-none fw-semibold">Đăng nhập</Link>
                </p>
            </div>
        </div>
    );
};

export default RegisterForm;
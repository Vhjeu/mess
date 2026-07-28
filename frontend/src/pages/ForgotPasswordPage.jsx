import { useState } from 'react';
import { Link } from 'react-router-dom';
import RecoveryShell from '../components/auth/RecoveryShell';
import { forgotPassword } from '../services/authService';

const ForgotPasswordPage = () => {
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleSubmit = async event => {
        event.preventDefault();
        setLoading(true);
        setMessage('');
        try {
            const data = await forgotPassword(identifier.trim());
            setMessage(data.message);
        } catch {
            setMessage('Nếu thông tin hợp lệ, hướng dẫn khôi phục đã được gửi.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <RecoveryShell
            eyebrow="Khôi phục tài khoản"
            title="Quên mật khẩu?"
            description="Nhập tên tài khoản hoặc email đã xác minh. Chúng tôi sẽ gửi hướng dẫn nếu thông tin hợp lệ."
        >
            {message && (
                <div className="recovery-feedback is-success" role="status">
                    <i className="bi bi-check-circle-fill"></i>
                    <span>{message}</span>
                </div>
            )}
            <form className="recovery-form" onSubmit={handleSubmit}>
                <div className="app-field">
                    <label htmlFor="recoveryIdentifier">Tên tài khoản hoặc email</label>
                    <input
                        id="recoveryIdentifier"
                        value={identifier}
                        onChange={event => setIdentifier(event.target.value)}
                        autoComplete="username"
                        maxLength={254}
                        required
                    />
                </div>
                <button
                    type="submit"
                    className="app-button app-button--primary recovery-submit"
                    disabled={loading || !identifier.trim()}
                >
                    {loading
                        ? <><span className="button-spinner"></span> Đang xử lý...</>
                        : 'Gửi hướng dẫn khôi phục'}
                </button>
            </form>
            <Link className="recovery-back" to="/login">
                <i className="bi bi-arrow-left"></i> Quay lại đăng nhập
            </Link>
        </RecoveryShell>
    );
};

export default ForgotPasswordPage;

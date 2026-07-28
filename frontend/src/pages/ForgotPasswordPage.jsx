import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import RecoveryShell from '../components/auth/RecoveryShell';
import { forgotPassword } from '../services/authService';
import { isRequestTimeout } from '../services/api';

const FORGOT_PASSWORD_COOLDOWN_SECONDS = 60;
const waitForLoadingPaint = () => new Promise(resolve => {
    requestAnimationFrame(() => resolve());
});

const ForgotPasswordPage = () => {
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('success');
    const [cooldownSeconds, setCooldownSeconds] = useState(0);
    const requestInFlightRef = useRef(false);

    useEffect(() => {
        if (cooldownSeconds <= 0) return undefined;

        const timer = window.setInterval(() => {
            setCooldownSeconds(current => Math.max(0, current - 1));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [cooldownSeconds]);

    const handleSubmit = async event => {
        event.preventDefault();
        if (requestInFlightRef.current || cooldownSeconds > 0) return;

        requestInFlightRef.current = true;
        setLoading(true);
        setMessage('');
        setMessageType('success');
        await waitForLoadingPaint();
        try {
            const data = await forgotPassword(identifier.trim());
            setMessage(data.message);
            setCooldownSeconds(FORGOT_PASSWORD_COOLDOWN_SECONDS);
        } catch (error) {
            setMessageType('error');
            setMessage(isRequestTimeout(error)
                ? 'Máy chủ gửi email phản hồi quá lâu. Vui lòng thử lại sau.'
                : 'Không thể gửi yêu cầu lúc này. Vui lòng kiểm tra kết nối và thử lại.');
        } finally {
            requestInFlightRef.current = false;
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
                <div className={`recovery-feedback is-${messageType}`} role="status" aria-live="polite">
                    <i className={`bi ${messageType === 'success'
                        ? 'bi-check-circle-fill'
                        : 'bi-exclamation-circle-fill'}`}></i>
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
                    disabled={loading || cooldownSeconds > 0 || !identifier.trim()}
                >
                    {loading
                        ? <><span className="button-spinner"></span> Đang gửi...</>
                        : cooldownSeconds > 0
                            ? `Gửi lại sau ${cooldownSeconds} giây`
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

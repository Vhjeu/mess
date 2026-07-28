import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import RecoveryShell from '../components/auth/RecoveryShell';
import { resetPassword } from '../services/authService';

const ResetPasswordPage = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [completed, setCompleted] = useState(false);

    const handleSubmit = async event => {
        event.preventDefault();
        if (newPassword !== confirmPassword) {
            setFeedback({ type: 'error', message: 'Mật khẩu xác nhận không khớp.' });
            return;
        }

        setLoading(true);
        setFeedback(null);
        try {
            const data = await resetPassword(token, newPassword, confirmPassword);
            setFeedback({ type: 'success', message: data.message });
            setCompleted(true);
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            setFeedback({
                type: 'error',
                message: error.response?.data?.message || 'Không thể đặt lại mật khẩu.'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <RecoveryShell
            eyebrow="Mật khẩu mới"
            title="Đặt lại mật khẩu"
            description="Liên kết khôi phục chỉ dùng được một lần và sẽ hết hạn sau 30 phút."
        >
            {feedback && (
                <div className={`recovery-feedback is-${feedback.type}`} role="status">
                    <i className={`bi ${feedback.type === 'success'
                        ? 'bi-check-circle-fill'
                        : 'bi-exclamation-circle-fill'}`}></i>
                    <span>{feedback.message}</span>
                </div>
            )}

            {!completed && (
                <form className="recovery-form" onSubmit={handleSubmit}>
                    <div className="app-field">
                        <label htmlFor="resetNewPassword">Mật khẩu mới</label>
                        <input
                            id="resetNewPassword"
                            type="password"
                            value={newPassword}
                            onChange={event => setNewPassword(event.target.value)}
                            autoComplete="new-password"
                            minLength={6}
                            required
                        />
                    </div>
                    <div className="app-field">
                        <label htmlFor="resetConfirmPassword">Xác nhận mật khẩu</label>
                        <input
                            id="resetConfirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={event => setConfirmPassword(event.target.value)}
                            autoComplete="new-password"
                            minLength={6}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="app-button app-button--primary recovery-submit"
                        disabled={loading || !token || newPassword.length < 6 || confirmPassword.length < 6}
                    >
                        {loading
                            ? <><span className="button-spinner"></span> Đang cập nhật...</>
                            : 'Đặt lại mật khẩu'}
                    </button>
                </form>
            )}

            <Link className="recovery-back" to="/login">
                <i className="bi bi-arrow-left"></i> Quay lại đăng nhập
            </Link>
        </RecoveryShell>
    );
};

export default ResetPasswordPage;

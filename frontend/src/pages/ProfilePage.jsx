import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
    cancelEmailVerification,
    changePassword,
    getMe,
    requestEmailVerification,
    resendEmailVerification,
    startEmailChange,
    updateProfile,
    uploadAvatar,
    verifyCurrentEmailForChange,
    verifyEmail
} from '../services/userService';
import { isRequestTimeout } from '../services/api';
import { getAvatarUrl } from '../utils/avatar';
import {
    MB,
    UPLOAD_LIMITS,
    validateUploadFile
} from '../utils/uploadValidation';
import {
    getDisplayNameLength,
    MAX_DISPLAY_NAME_LENGTH,
    normalizeDisplayName,
    validateDisplayName
} from '../utils/displayName';

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

const waitForLoadingPaint = () => new Promise(resolve => {
    requestAnimationFrame(() => resolve());
});

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
    const [emailInput, setEmailInput] = useState('');
    const [emailOtp, setEmailOtp] = useState('');
    const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
    const [emailLoading, setEmailLoading] = useState(false);
    const [emailLoadingAction, setEmailLoadingAction] = useState('');
    const [emailFeedback, setEmailFeedback] = useState(null);
    const emailRequestInFlightRef = useRef(false);

    const displayNameValidation = validateDisplayName(displayName);
    const normalizedCurrentDisplayName = normalizeDisplayName(user?.display_name || user?.username || '');
    const availableAt = Number(user?.display_name_change_available_at || 0);
    const remainingMs = Math.max(0, availableAt - now);
    const isDisplayNameCooldown = remainingMs > 0;
    const isDisplayNameUnchanged = displayNameValidation.valid
        && displayNameValidation.displayName === normalizedCurrentDisplayName;
    const emailResendAt = Number(user?.email_verification_resend_available_at || 0);
    const emailResendRemainingMs = Math.max(0, emailResendAt - now);
    const emailFlow = user?.email_change_state || 'idle';
    const isVerifiedEmail = user?.email_status === 'verified';
    const isVerifyingCurrentEmail = emailFlow === 'verify_current';
    const canEnterNewEmail = emailFlow === 'enter_new';
    const isVerifyingNewEmail = emailFlow === 'verify_new';
    const hasActiveEmailFlow = emailFlow !== 'idle';

    useEffect(() => {
        if (user) {
            setDisplayName(user.display_name || user.username || '');
        }
    }, [user]);

    useEffect(() => {
        if (!availableAt && !emailResendAt) return undefined;

        setNow(Date.now());
        const intervalMs = emailResendAt > Date.now() ? 1000 : 30000;
        const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
        return () => window.clearInterval(timer);
    }, [availableAt, emailResendAt]);

    useEffect(() => {
        if (!emailResendAt || emailResendRemainingMs > 0 || !setUser) return;
        setUser(current => ({
            ...current,
            email_verification_resend_available_at: null
        }));
    }, [emailResendAt, emailResendRemainingMs, setUser]);

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
        const validation = validateUploadFile(file, 'avatar');
        if (!validation.valid) {
            setError(validation.message);
            setMessage('');
            input.value = '';
            return;
        }

        const previewUrl = URL.createObjectURL(file);
        if (avatarPreviewRef.current) {
            URL.revokeObjectURL(avatarPreviewRef.current);
        }
        avatarPreviewRef.current = previewUrl;
        setAvatarPreview(previewUrl);

        setLoading(true);
        setError('');
        setMessage('Đang tải ảnh đại diện lên...');
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

    const applyEmailResponse = (data) => {
        if (data.user && setUser) {
            setUser(data.user);
        }
        setNow(Date.now());
        setEmailFeedback({ type: 'success', message: data.message });
    };

    const beginEmailOperation = async (action) => {
        if (emailRequestInFlightRef.current) return false;

        emailRequestInFlightRef.current = true;
        setEmailLoading(true);
        setEmailLoadingAction(action);
        setEmailFeedback(null);
        await waitForLoadingPaint();
        return true;
    };

    const finishEmailOperation = () => {
        emailRequestInFlightRef.current = false;
        setEmailLoading(false);
        setEmailLoadingAction('');
    };

    const applyEmailError = async (err, fallbackMessage) => {
        const responseData = err.response?.data;
        const retryAt = Number(responseData?.retry_at || 0);
        if (retryAt && setUser) {
            setUser(current => ({
                ...current,
                email_verification_resend_available_at: retryAt
            }));
        }

        if ([
            'OTP_EXPIRED',
            'OTP_ATTEMPTS_EXCEEDED',
            'EMAIL_CHANGE_AUTH_EXPIRED',
            'EMAIL_CHANGE_NOT_AUTHORIZED'
        ].includes(responseData?.code)) {
            try {
                const refreshedUser = await getMe();
                if (setUser) setUser(refreshedUser);
            } catch {
                // Giữ thông báo gốc nếu không thể làm mới trạng thái.
            }
        }

        setEmailFeedback({
            type: 'error',
            message: isRequestTimeout(err)
                ? 'Máy chủ gửi email phản hồi quá lâu. Vui lòng thử lại sau.'
                : (responseData?.message || fallbackMessage)
        });
    };

    const handleEmailChangeStart = async (event) => {
        event.preventDefault();
        if (!emailCurrentPassword) {
            setEmailFeedback({ type: 'error', message: 'Vui lòng nhập mật khẩu hiện tại.' });
            return;
        }

        if (!(await beginEmailOperation('send-current'))) return;
        try {
            const data = await startEmailChange(emailCurrentPassword);
            applyEmailResponse(data);
            setEmailCurrentPassword('');
            setEmailOtp('');
        } catch (err) {
            await applyEmailError(err, 'Không thể bắt đầu đổi email.');
        } finally {
            finishEmailOperation();
        }
    };

    const handleEmailRequest = async (event) => {
        event.preventDefault();
        const email = emailInput.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
            setEmailFeedback({ type: 'error', message: 'Email không đúng định dạng.' });
            return;
        }

        if (!(await beginEmailOperation('send-new'))) return;
        try {
            const data = await requestEmailVerification(email);
            applyEmailResponse(data);
            setEmailOtp('');
        } catch (err) {
            await applyEmailError(err, 'Không thể gửi mã xác minh.');
        } finally {
            finishEmailOperation();
        }
    };

    const handleEmailResend = async () => {
        if (emailResendRemainingMs > 0) return;
        if (!(await beginEmailOperation('resend'))) return;
        try {
            const data = await resendEmailVerification();
            applyEmailResponse(data);
        } catch (err) {
            await applyEmailError(err, 'Không thể gửi lại mã xác minh.');
        } finally {
            finishEmailOperation();
        }
    };

    const handleCurrentEmailVerify = async (event) => {
        event.preventDefault();
        if (!/^\d{6}$/u.test(emailOtp)) {
            setEmailFeedback({ type: 'error', message: 'Mã xác nhận phải gồm 6 chữ số.' });
            return;
        }

        if (!(await beginEmailOperation('verify-current'))) return;
        try {
            const data = await verifyCurrentEmailForChange(emailOtp);
            applyEmailResponse(data);
            setEmailOtp('');
        } catch (err) {
            await applyEmailError(err, 'Mã xác nhận email hiện tại không hợp lệ.');
        } finally {
            finishEmailOperation();
        }
    };

    const handleEmailVerify = async (event) => {
        event.preventDefault();
        if (!/^\d{6}$/u.test(emailOtp)) {
            setEmailFeedback({ type: 'error', message: 'Mã xác minh phải gồm 6 chữ số.' });
            return;
        }

        if (!(await beginEmailOperation('verify-new'))) return;
        try {
            const data = await verifyEmail(emailOtp);
            applyEmailResponse(data);
            setEmailInput('');
            setEmailOtp('');
        } catch (err) {
            await applyEmailError(err, 'Mã xác minh không hợp lệ.');
        } finally {
            finishEmailOperation();
        }
    };

    const handleEmailCancel = async () => {
        if (!(await beginEmailOperation('cancel'))) return;
        try {
            const data = await cancelEmailVerification();
            applyEmailResponse(data);
            setEmailInput('');
            setEmailOtp('');
            setEmailCurrentPassword('');
        } catch (err) {
            await applyEmailError(err, 'Không thể hủy yêu cầu đổi email.');
        } finally {
            finishEmailOperation();
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
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                onChange={handleAvatarChange}
                                disabled={loading}
                            />
                        </label>
                    </div>
                    <small className="profile-avatar-help">
                        Avatar tối đa {UPLOAD_LIMITS.avatar / MB} MB
                    </small>
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
                                    maxLength={MAX_DISPLAY_NAME_LENGTH}
                                    disabled={loading || isDisplayNameCooldown}
                                    aria-describedby="profileDisplayNameHelp"
                                />
                                <small id="profileDisplayNameHelp">
                                    Từ 2 đến {MAX_DISPLAY_NAME_LENGTH} ký tự; khoảng trắng thừa sẽ tự động được loại bỏ.
                                    {' '}{getDisplayNameLength(normalizeDisplayName(displayName))}/{MAX_DISPLAY_NAME_LENGTH} ký tự.
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
                            <span className="profile-card-icon"><i className="bi bi-envelope-check"></i></span>
                            <div>
                                <h3>Email khôi phục</h3>
                                <p>Email đã xác minh có thể dùng để lấy lại tài khoản khi quên mật khẩu.</p>
                            </div>
                            <span className={`profile-email-status is-${hasActiveEmailFlow
                                ? 'pending'
                                : (user?.email_status || 'missing')}`}>
                                {hasActiveEmailFlow
                                    ? <><i className="bi bi-clock-fill"></i> Đang xác minh</>
                                    : isVerifiedEmail
                                        ? <><i className="bi bi-patch-check-fill"></i> Đã xác minh</>
                                        : <><i className="bi bi-dash-circle"></i> Chưa thêm email</>}
                            </span>
                        </div>

                        <div className="profile-email-current">
                            <span>Email hiện tại</span>
                            <strong>{user?.email || user?.email_masked || 'Chưa thêm email'}</strong>
                            {user?.email_verified_at && (
                                <small>Xác minh lúc {formatAvailableAt(user.email_verified_at)}</small>
                            )}
                        </div>

                        {isVerifyingCurrentEmail && (
                            <div className="profile-email-pending">
                                <i className="bi bi-shield-check"></i>
                                <span>
                                    Mã xác nhận đã được gửi đến email hiện tại
                                    {' '}<strong>{user?.email_masked}</strong>.
                                    {user?.email_verification_expires_at && (
                                        <> Mã hiện tại hết hạn lúc {formatAvailableAt(user.email_verification_expires_at)}.</>
                                    )}
                                </span>
                            </div>
                        )}

                        {canEnterNewEmail && (
                            <div className="profile-email-pending">
                                <i className="bi bi-unlock-fill"></i>
                                <span>
                                    Email hiện tại đã được xác nhận. Bạn có thể nhập email mới.
                                    {user?.email_change_authorized_until && (
                                        <> Quyền đổi email hết hạn lúc {formatAvailableAt(user.email_change_authorized_until)}.</>
                                    )}
                                </span>
                            </div>
                        )}

                        {isVerifyingNewEmail && user?.pending_email_masked && (
                            <div className="profile-email-pending">
                                <i className="bi bi-envelope-exclamation"></i>
                                <span>
                                    Đang chờ xác minh <strong>{user.pending_email_masked}</strong>.
                                    {isVerifiedEmail && (
                                        <> Email cũ vẫn là email chính cho đến khi bước này hoàn tất.</>
                                    )}
                                    {user?.email_verification_expires_at && (
                                        <> Mã hết hạn lúc {formatAvailableAt(user.email_verification_expires_at)}.</>
                                    )}
                                </span>
                            </div>
                        )}

                        {emailFeedback && (
                            <div className={`profile-email-feedback is-${emailFeedback.type}`} role="status">
                                <i className={`bi ${emailFeedback.type === 'success'
                                    ? 'bi-check-circle-fill'
                                    : 'bi-exclamation-circle-fill'}`}></i>
                                <span>{emailFeedback.message}</span>
                            </div>
                        )}

                        {isVerifiedEmail && emailFlow === 'idle' && (
                            <form onSubmit={handleEmailChangeStart} className="profile-form">
                                <div className="app-field">
                                    <label htmlFor="profileEmailCurrentPassword">
                                        Mật khẩu hiện tại
                                    </label>
                                    <input
                                        id="profileEmailCurrentPassword"
                                        type="password"
                                        value={emailCurrentPassword}
                                        onChange={event => setEmailCurrentPassword(event.target.value)}
                                        autoComplete="current-password"
                                        disabled={emailLoading}
                                    />
                                    <small>
                                        Sau khi kiểm tra mật khẩu, mã xác nhận sẽ được gửi đến email hiện tại.
                                        Nếu không còn truy cập email cũ, bạn không thể đổi trực tiếp; hãy khôi phục
                                        quyền truy cập email đó với nhà cung cấp email trước.
                                    </small>
                                </div>
                                <div className="profile-form-actions">
                                    <button
                                        className="app-button app-button--secondary"
                                        type="submit"
                                        disabled={emailLoading || !emailCurrentPassword}
                                    >
                                        {emailLoading
                                            ? <><span className="button-spinner"></span> Đang gửi...</>
                                            : 'Gửi mã đến email hiện tại'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {((!isVerifiedEmail && emailFlow === 'idle') || canEnterNewEmail) && (
                            <form onSubmit={handleEmailRequest} className="profile-form">
                                <div className="app-field">
                                    <label htmlFor="profileEmail">
                                        {canEnterNewEmail ? 'Email mới' : 'Thêm email'}
                                    </label>
                                    <div className="profile-email-input-row">
                                        <input
                                            id="profileEmail"
                                            type="email"
                                            value={emailInput}
                                            onChange={event => setEmailInput(event.target.value)}
                                            placeholder="tenban@example.com"
                                            autoComplete="email"
                                            maxLength={254}
                                            disabled={emailLoading}
                                        />
                                        <button
                                            className="app-button app-button--secondary"
                                            type="submit"
                                            disabled={emailLoading || !emailInput.trim()}
                                        >
                                            {emailLoading
                                                ? <><span className="button-spinner"></span> Đang gửi...</>
                                                : 'Gửi mã xác minh'}
                                        </button>
                                    </div>
                                    <small>
                                        Email chỉ được cập nhật sau khi mã gửi đến email mới được xác minh.
                                    </small>
                                </div>
                            </form>
                        )}

                        {(isVerifyingCurrentEmail || isVerifyingNewEmail) && (
                            <form
                                onSubmit={isVerifyingCurrentEmail
                                    ? handleCurrentEmailVerify
                                    : handleEmailVerify}
                                className="profile-email-otp-form"
                            >
                                <div className="app-field">
                                    <label htmlFor="profileEmailOtp">
                                        {isVerifyingCurrentEmail
                                            ? 'Mã xác nhận email hiện tại'
                                            : 'Mã xác minh email mới'}
                                    </label>
                                    <input
                                        id="profileEmailOtp"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        value={emailOtp}
                                        onChange={event => setEmailOtp(
                                            event.target.value.replace(/\D/gu, '').slice(0, 6)
                                        )}
                                        placeholder="000000"
                                        disabled={emailLoading}
                                    />
                                </div>
                                <button
                                    className="app-button app-button--primary"
                                    type="submit"
                                    disabled={emailLoading || emailOtp.length !== 6}
                                >
                                    {emailLoadingAction === 'verify-current'
                                        || emailLoadingAction === 'verify-new'
                                        ? <><span className="button-spinner"></span> Đang xác minh...</>
                                        : isVerifyingCurrentEmail
                                            ? 'Xác nhận email hiện tại'
                                            : 'Xác minh email mới'}
                                </button>
                                <button
                                    className="profile-email-resend"
                                    type="button"
                                    onClick={handleEmailResend}
                                    disabled={emailLoading || emailResendRemainingMs > 0}
                                >
                                    {emailLoadingAction === 'resend'
                                        ? <><span className="button-spinner"></span> Đang gửi...</>
                                        : emailResendRemainingMs > 0
                                        ? `Gửi lại sau ${Math.ceil(emailResendRemainingMs / 1000)} giây`
                                        : 'Gửi lại mã'}
                                </button>
                            </form>
                        )}

                        {hasActiveEmailFlow && (
                            <div className="profile-form-actions">
                                <button
                                    className="app-button app-button--secondary"
                                    type="button"
                                    onClick={handleEmailCancel}
                                    disabled={emailLoading}
                                >
                                    {emailLoadingAction === 'cancel'
                                        ? <><span className="button-spinner"></span> Đang hủy...</>
                                        : 'Hủy yêu cầu'}
                                </button>
                            </div>
                        )}
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
                                    <input
                                        id="currentPassword"
                                        type="password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        autoComplete="current-password"
                                        required
                                    />
                                </div>
                                <div className="app-field">
                                    <label htmlFor="newPassword">Mật khẩu mới</label>
                                    <input
                                        id="newPassword"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        autoComplete="new-password"
                                        minLength={6}
                                        required
                                    />
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

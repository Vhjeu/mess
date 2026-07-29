const User = require('../models/User');
const { removeUploadedFiles } = require('../config/uploads');
const { validateUploadedImages } = require('../utils/imageFile');
const Nickname = require('../models/Nickname');
const bcrypt = require('bcryptjs');
const { validateDisplayName } = require('../utils/displayName');
const AccountSecurity = require('../models/AccountSecurity');
const {
    generateOtp,
    hashAccountSecret,
    isValidEmail,
    normalizeEmail
} = require('../utils/accountSecurity');
const {
    sendCurrentEmailChangeConfirmation,
    sendEmailChangedNoticeToNew,
    sendEmailChangedNoticeToOld,
    sendEmailVerification
} = require('../services/mailService');
const { createOperationTimer } = require('../utils/operationTimer');

const OTP_TTL_MS = 10 * 60 * 1000;
const EMAIL_CHANGE_AUTH_TTL_MS = 15 * 60 * 1000;

const normalizeNickname = (value) => (
    typeof value === 'string'
        ? value.trim().replace(/\s+/gu, ' ')
        : ''
);

const parseTargetUserId = (value) => {
    const targetUserId = Number(value);
    return Number.isInteger(targetUserId) && targetUserId > 0
        ? targetUserId
        : null;
};

exports.getAllUsers = async (req, res) => {
    try {
        const search = req.query.search || '';
        const users = await User.findAllExcept(req.userId, search);

        // Gắn trạng thái online cho từng user
        const usersWithStatus = await Promise.all(users.map(async (u) => {
            const online = await User.isOnline(u.id);
            return { ...u, online };
        }));

        res.json(usersWithStatus);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

exports.getMe = async (req, res) => {
    try {
        await AccountSecurity.cleanupExpiredEmailFlow(req.userId);
        const user = await User.findById(req.userId, { includeVerifiedEmail: true });
        if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { display_name } = req.body;
        const validation = validateDisplayName(display_name);
        if (!validation.valid) {
            return res.status(400).json({ message: validation.message });
        }

        const currentUser = await User.findById(req.userId, { includeVerifiedEmail: true });
        if (!currentUser) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }

        if (validation.displayName === currentUser.display_name) {
            return res.json(currentUser);
        }

        const updated = await User.updateDisplayNameIfAllowed(req.userId, validation.displayName);
        if (!updated) {
            const latestUser = await User.findById(req.userId, { includeVerifiedEmail: true });
            const availableAt = latestUser?.display_name_change_available_at || null;

            return res.status(429).json({
                code: 'DISPLAY_NAME_COOLDOWN',
                message: 'Bạn chỉ có thể đổi tên hiển thị sau mỗi 3 ngày',
                display_name_change_available_at: availableAt,
                remaining_ms: availableAt ? Math.max(0, availableAt - Date.now()) : null
            });
        }

        const updatedUser = await User.findById(req.userId, { includeVerifiedEmail: true });

        const io = req.app.get('io');
        if (io) {
            io.emit('user:profile-updated', {
                user: {
                    id: updatedUser.id,
                    username: updatedUser.username,
                    display_name: updatedUser.display_name,
                    avatar_url: updatedUser.avatar_url
                }
            });
        }

        res.json(updatedUser);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

exports.uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Vui lòng chọn ảnh đại diện' });
        }

        await validateUploadedImages([req.file]);
        const avatarUrl = `/uploads/${req.file.filename}`;
        await User.updateAvatar(req.userId, avatarUrl);
        const updatedUser = await User.findById(req.userId, { includeVerifiedEmail: true });
        res.json(updatedUser);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Vui lòng nhập đầy đủ mật khẩu hiện tại và mới' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
        }

        const user = await User.findByIdWithPassword(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Mật khẩu hiện tại không đúng' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await User.updatePassword(req.userId, passwordHash);
        res.json({ message: 'Đổi mật khẩu thành công' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

const handleEmailSecurityError = (error, res) => {
    if (error.code === 'EMAIL_TAKEN' || error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: error.message });
    }
    if (['SEND_COOLDOWN', 'SEND_RATE_LIMIT'].includes(error.code)) {
        return res.status(429).json({
            code: error.code,
            message: error.message,
            retry_at: error.retryAt
        });
    }
    if (
        error.code === 'EMAIL_SERVICE_NOT_CONFIGURED'
        || error.code === 'CONFIGURATION_ERROR'
    ) {
        return res.status(503).json({
            message: 'Dịch vụ gửi email chưa được cấu hình'
        });
    }
    if (['ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'EDNS'].includes(error.code)) {
        return res.status(503).json({
            code: 'EMAIL_DELIVERY_UNAVAILABLE',
            message: 'Dịch vụ email phản hồi quá lâu hoặc đang tạm gián đoạn. Vui lòng thử lại sau.'
        });
    }
    if ([
        'EMAIL_CHANGE_NOT_AUTHORIZED',
        'EMAIL_CHANGE_AUTH_EXPIRED'
    ].includes(error.code)) {
        return res.status(403).json({ code: error.code, message: error.message });
    }
    if ([
        'EMAIL_ALREADY_VERIFIED',
        'EMAIL_NOT_VERIFIED',
        'EMAIL_UNCHANGED',
        'NO_PENDING_EMAIL',
        'INVALID_OTP',
        'OTP_EXPIRED',
        'OTP_ATTEMPTS_EXCEEDED'
    ].includes(error.code)) {
        return res.status(400).json({ code: error.code, message: error.message });
    }
    if (error.code === 'USER_NOT_FOUND') {
        return res.status(404).json({ message: error.message });
    }
    return null;
};

const buildEmailOtpHashes = (otp, userId) => ({
    initialHash: hashAccountSecret(otp, 'email-verification', userId),
    oldHash: hashAccountSecret(otp, 'email-change-old', userId),
    changeHash: hashAccountSecret(otp, 'email-change-new', userId)
});

const sendPreparedVerificationEmail = async ({
    userId,
    email,
    otp,
    codeHash,
    purpose
}) => {
    try {
        if (purpose === 'change-old') {
            await sendCurrentEmailChangeConfirmation(email, otp);
        } else {
            await sendEmailVerification(email, otp, {
                isEmailChange: purpose === 'change-new'
            });
        }
    } catch (error) {
        await AccountSecurity.cancelEmailVerificationSend(userId, codeHash, purpose);
        throw error;
    }
};

exports.requestEmailVerification = async (req, res) => {
    const timer = createOperationTimer('email-verification-request', {
        user_id: Number(req.userId)
    });
    try {
        const email = normalizeEmail(req.body.email);
        if (!isValidEmail(email)) {
            timer.mark('validation_failed');
            return res.status(400).json({ message: 'Email không đúng định dạng' });
        }

        const otp = generateOtp();
        const codeHashes = buildEmailOtpHashes(otp, req.userId);
        const expiresAt = new Date(Date.now() + OTP_TTL_MS);
        const prepared = await AccountSecurity.requestInitialOrNewEmail(
            req.userId,
            email,
            codeHashes,
            expiresAt
        );
        timer.mark('database_otp_prepared');
        await sendPreparedVerificationEmail({
            userId: req.userId,
            email: prepared.email,
            otp,
            codeHash: prepared.codeHash,
            purpose: prepared.purpose
        });
        timer.mark('smtp_complete');
        const publicUser = await User.findById(req.userId, { includeVerifiedEmail: true });
        timer.mark('database_user_read');

        res.status(202).json({
            message: prepared.purpose === 'change-new'
                ? 'Mã xác minh đã được gửi đến email mới'
                : 'Mã xác minh đã được gửi đến email',
            user: publicUser
        });
        timer.mark('response_sent');
    } catch (error) {
        timer.fail('request_failed', error);
        const handled = handleEmailSecurityError(error, res);
        if (handled) return handled;
        console.error('Lỗi gửi mã xác minh email:', error);
        res.status(500).json({ message: 'Không thể gửi mã xác minh email' });
    }
};

exports.resendEmailVerification = async (req, res) => {
    const timer = createOperationTimer('email-verification-resend', {
        user_id: Number(req.userId)
    });
    try {
        const otp = generateOtp();
        const codeHashes = buildEmailOtpHashes(otp, req.userId);
        const expiresAt = new Date(Date.now() + OTP_TTL_MS);
        const prepared = await AccountSecurity.resendEmailVerification(
            req.userId,
            codeHashes,
            expiresAt
        );
        timer.mark('database_otp_prepared');
        await sendPreparedVerificationEmail({
            userId: req.userId,
            email: prepared.email,
            otp,
            codeHash: prepared.codeHash,
            purpose: prepared.purpose
        });
        timer.mark('smtp_complete');
        const publicUser = await User.findById(req.userId, { includeVerifiedEmail: true });
        timer.mark('database_user_read');

        res.status(202).json({
            message: prepared.purpose === 'change-old'
                ? 'Mã xác nhận mới đã được gửi đến email hiện tại'
                : 'Mã xác minh mới đã được gửi',
            user: publicUser
        });
        timer.mark('response_sent');
    } catch (error) {
        timer.fail('request_failed', error);
        const handled = handleEmailSecurityError(error, res);
        if (handled) return handled;
        console.error('Lỗi gửi lại mã xác minh email:', error);
        res.status(500).json({ message: 'Không thể gửi lại mã xác minh' });
    }
};

exports.verifyEmail = async (req, res) => {
    const timer = createOperationTimer('email-verification-verify', {
        user_id: Number(req.userId)
    });
    try {
        const otp = typeof req.body.otp === 'string' ? req.body.otp.trim() : '';
        if (!/^\d{6}$/u.test(otp)) {
            timer.mark('validation_failed');
            return res.status(400).json({ message: 'Mã xác minh phải gồm 6 chữ số' });
        }

        const result = await AccountSecurity.verifyPendingEmail(req.userId, {
            initialHash: hashAccountSecret(otp, 'email-verification', req.userId),
            changeHash: hashAccountSecret(otp, 'email-change-new', req.userId)
        });
        timer.mark('database_otp_verified');

        const publicUser = await User.findById(req.userId, { includeVerifiedEmail: true });
        timer.mark('database_user_read');
        res.json({
            message: result.changed
                ? 'Đổi email thành công'
                : 'Xác minh email thành công',
            user: publicUser
        });
        timer.mark('response_sent');

        if (result.changed) {
            void Promise.allSettled([
                sendEmailChangedNoticeToOld(result.oldEmail),
                sendEmailChangedNoticeToNew(result.newEmail)
            ]).then(notices => {
                notices.forEach(notice => {
                    if (notice.status === 'rejected') {
                        console.error(
                            'Không thể gửi thông báo đổi email:',
                            notice.reason?.code || notice.reason?.message
                        );
                    }
                });
                timer.mark('background_change_notices_complete');
            });
        }
    } catch (error) {
        timer.fail('request_failed', error);
        const handled = handleEmailSecurityError(error, res);
        if (handled) return handled;
        console.error('Lỗi xác minh email:', error);
        res.status(500).json({ message: 'Không thể xác minh email' });
    }
};

exports.startEmailChange = async (req, res) => {
    const timer = createOperationTimer('email-change-start', {
        user_id: Number(req.userId)
    });
    try {
        const currentPassword = typeof req.body.currentPassword === 'string'
            ? req.body.currentPassword
            : '';
        if (!currentPassword) {
            timer.mark('validation_failed');
            return res.status(400).json({ message: 'Vui lòng nhập mật khẩu hiện tại' });
        }

        const user = await User.findByIdWithPassword(req.userId);
        timer.mark('database_user_read');
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }
        const passwordMatches = await bcrypt.compare(currentPassword, user.password_hash);
        timer.mark('password_check');
        if (!passwordMatches) {
            return res.status(401).json({ message: 'Mật khẩu hiện tại không đúng' });
        }

        const otp = generateOtp();
        const codeHash = hashAccountSecret(otp, 'email-change-old', req.userId);
        const prepared = await AccountSecurity.startEmailChange(
            req.userId,
            codeHash,
            new Date(Date.now() + OTP_TTL_MS)
        );
        timer.mark('database_otp_prepared');
        await sendPreparedVerificationEmail({
            userId: req.userId,
            email: prepared.email,
            otp,
            codeHash,
            purpose: prepared.purpose
        });
        timer.mark('smtp_complete');
        const publicUser = await User.findById(req.userId, { includeVerifiedEmail: true });
        timer.mark('database_user_read_after_send');

        res.status(202).json({
            message: 'Mã xác nhận đã được gửi đến email hiện tại',
            user: publicUser
        });
        timer.mark('response_sent');
    } catch (error) {
        timer.fail('request_failed', error);
        const handled = handleEmailSecurityError(error, res);
        if (handled) return handled;
        console.error('Lỗi bắt đầu đổi email:', error);
        res.status(500).json({ message: 'Không thể bắt đầu đổi email' });
    }
};

exports.verifyCurrentEmailForChange = async (req, res) => {
    try {
        const otp = typeof req.body.otp === 'string' ? req.body.otp.trim() : '';
        if (!/^\d{6}$/u.test(otp)) {
            return res.status(400).json({ message: 'Mã xác nhận phải gồm 6 chữ số' });
        }

        const codeHash = hashAccountSecret(otp, 'email-change-old', req.userId);
        await AccountSecurity.verifyCurrentEmail(
            req.userId,
            codeHash,
            new Date(Date.now() + EMAIL_CHANGE_AUTH_TTL_MS)
        );

        res.json({
            message: 'Đã xác nhận email hiện tại. Bạn có thể nhập email mới.',
            user: await User.findById(req.userId, { includeVerifiedEmail: true })
        });
    } catch (error) {
        const handled = handleEmailSecurityError(error, res);
        if (handled) return handled;
        console.error('Lỗi xác nhận email hiện tại:', error);
        res.status(500).json({ message: 'Không thể xác nhận email hiện tại' });
    }
};

exports.cancelEmailVerification = async (req, res) => {
    try {
        await AccountSecurity.cancelEmailFlow(req.userId);
        res.json({
            message: 'Đã hủy yêu cầu xác minh email',
            user: await User.findById(req.userId, { includeVerifiedEmail: true })
        });
    } catch (error) {
        console.error('Lỗi hủy xác minh email:', error);
        res.status(500).json({ message: 'Không thể hủy yêu cầu xác minh email' });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const targetUserId = parseTargetUserId(req.params.userId);
        if (!targetUserId || targetUserId === Number(req.userId)) {
            return res.status(400).json({ message: 'ID người dùng không hợp lệ' });
        }

        const user = await User.findPublicById(targetUserId);
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }

        res.json({
            ...user,
            online: await User.isOnline(targetUserId)
        });
    } catch (error) {
        if (req.file) {
            await removeUploadedFiles([req.file]);
        }
        console.error(error);
        res.status(error.status || 500).json({
            message: error.status ? error.message : 'Lỗi máy chủ'
        });
    }
};

exports.getNicknames = async (req, res) => {
    try {
        const rows = await Nickname.findAllByOwner(req.userId);
        const nicknames = Object.fromEntries(
            rows.map(row => [String(row.target_user_id), row.nickname])
        );
        res.json(nicknames);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

exports.getNickname = async (req, res) => {
    try {
        const targetUserId = parseTargetUserId(req.params.targetUserId);
        if (!targetUserId || targetUserId === Number(req.userId)) {
            return res.status(400).json({ message: 'ID người dùng không hợp lệ' });
        }

        const targetUser = await User.findPublicById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }

        const nickname = await Nickname.findOne(req.userId, targetUserId);
        res.json({ target_user_id: targetUserId, nickname });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

exports.updateNickname = async (req, res) => {
    try {
        const ownerUserId = Number(req.userId);
        const targetUserId = parseTargetUserId(req.params.targetUserId);
        if (!targetUserId || targetUserId === ownerUserId) {
            return res.status(400).json({ message: 'ID người dùng không hợp lệ' });
        }

        const targetUser = await User.findPublicById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }

        const nickname = normalizeNickname(req.body.nickname);
        if (Array.from(nickname).length > 30) {
            return res.status(400).json({ message: 'Biệt danh không được vượt quá 30 ký tự' });
        }

        if (nickname) {
            await Nickname.save(ownerUserId, targetUserId, nickname);
        } else {
            await Nickname.remove(ownerUserId, targetUserId);
        }

        const payload = { target_user_id: targetUserId, nickname: nickname || null };
        const io = req.app.get('io');
        if (io) {
            io.to(`user:${ownerUserId}`).emit('nickname:updated', payload);
        }

        res.json(payload);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validateDisplayName } = require('../utils/displayName');
const AccountSecurity = require('../models/AccountSecurity');
const {
    generateResetToken,
    hashAccountSecret
} = require('../utils/accountSecurity');
const { sendPasswordReset } = require('../services/mailService');
const { getJwtSecret } = require('../config/env');
const { createOperationTimer } = require('../utils/operationTimer');

const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const FORGOT_PASSWORD_MESSAGE = 'Nếu thông tin hợp lệ, hướng dẫn khôi phục đã được gửi.';

exports.register = async (req, res) => {
    try {
        const { username, display_name, password, confirmPassword } = req.body;
        const normalizedUsername = typeof username === 'string' ? username.trim() : '';

        if (!normalizedUsername || !display_name || !password || !confirmPassword) {
            return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin' });
        }

        if (Array.from(normalizedUsername).length > 50) {
            return res.status(400).json({ message: 'Tên tài khoản không được vượt quá 50 ký tự' });
        }

        const displayNameValidation = validateDisplayName(display_name);
        if (!displayNameValidation.valid) {
            return res.status(400).json({ message: displayNameValidation.message });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }

        const existing = await User.findByUsername(normalizedUsername);
        if (existing) {
            return res.status(409).json({ message: 'Tên tài khoản đã tồn tại' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        await User.create(normalizedUsername, displayNameValidation.displayName, passwordHash);

        res.status(201).json({ message: 'Đăng ký thành công' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Tên tài khoản đã tồn tại' });
        }
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const rawUsername = typeof username === 'string' ? username : '';
        const normalizedUsername = rawUsername.trim();

        if (!rawUsername || !password) {
            return res.status(400).json({ message: 'Vui lòng nhập tên tài khoản và mật khẩu' });
        }

        let user = normalizedUsername
            ? await User.findByUsername(normalizedUsername)
            : null;

        // Tương thích tài khoản cũ từng được tạo với khoảng trắng ở đầu/cuối.
        if (!user && rawUsername !== normalizedUsername) {
            user = await User.findByUsername(rawUsername);
        }

        if (!user) {
            return res.status(401).json({ message: 'Sai thông tin đăng nhập' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Sai thông tin đăng nhập' });
        }

        const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '7d' });
        await AccountSecurity.cleanupExpiredEmailFlow(user.id);
        const publicUser = await User.findById(user.id);

        res.json({
            token,
            user: publicUser
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

exports.forgotPassword = async (req, res) => {
    const timer = createOperationTimer('forgot-password');
    const genericResponse = () => {
        timer.mark('response_sent');
        return res.json({ message: FORGOT_PASSWORD_MESSAGE });
    };

    try {
        const identifier = typeof req.body.identifier === 'string'
            ? req.body.identifier.trim()
            : '';
        if (!identifier || identifier.length > 254) {
            return genericResponse();
        }

        const user = await AccountSecurity.findVerifiedAccount(identifier);
        timer.mark('database_account_lookup');
        if (!user) {
            // Vẫn thực hiện một phép băm để giảm khác biệt thời gian phản hồi.
            hashAccountSecret(generateResetToken(), 'password-reset', 'unknown');
            return genericResponse();
        }

        const token = generateResetToken();
        const tokenHash = hashAccountSecret(token, 'password-reset');
        const prepared = await AccountSecurity.startPasswordReset(
            user.id,
            tokenHash,
            new Date(Date.now() + PASSWORD_RESET_TTL_MS)
        );
        timer.mark('database_token_prepared');
        if (!prepared) return genericResponse();

        const response = genericResponse();
        void (async () => {
            try {
                await sendPasswordReset(prepared.email, token);
                timer.mark('background_smtp_complete');
            } catch (error) {
                timer.fail('background_smtp_failed', error);
                try {
                    await AccountSecurity.cancelPasswordResetSend(user.id, tokenHash);
                    timer.mark('database_send_rollback');
                } catch (rollbackError) {
                    timer.fail('database_send_rollback_failed', rollbackError);
                }
            }
        })();
        return response;
    } catch (error) {
        timer.fail('request_failed', error);
        console.error('Lỗi yêu cầu khôi phục mật khẩu:', error);
        return genericResponse();
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
        const { newPassword, confirmPassword } = req.body;
        if (!/^[a-f0-9]{64}$/iu.test(token)) {
            return res.status(400).json({ message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn' });
        }
        if (!newPassword || !confirmPassword) {
            return res.status(400).json({ message: 'Vui lòng nhập đầy đủ mật khẩu mới' });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
        }

        const tokenHash = hashAccountSecret(token, 'password-reset');
        const passwordHash = await bcrypt.hash(newPassword, 10);
        const changed = await AccountSecurity.consumePasswordReset(tokenHash, passwordHash);
        if (!changed) {
            return res.status(400).json({ message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn' });
        }

        res.json({ message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.' });
    } catch (error) {
        console.error('Lỗi đặt lại mật khẩu:', error);
        res.status(500).json({ message: 'Không thể đặt lại mật khẩu' });
    }
};

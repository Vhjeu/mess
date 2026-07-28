const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validateDisplayName } = require('../utils/displayName');

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

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
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

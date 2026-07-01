const User = require('../models/User');
const bcrypt = require('bcryptjs');

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
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { username } = req.body;
        const trimmedUsername = username?.trim();

        if (!trimmedUsername) {
            return res.status(400).json({ message: 'Tên hiển thị không được để trống' });
        }

        await User.updateUsername(req.userId, trimmedUsername);
        const updatedUser = await User.findById(req.userId);
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

        const avatarUrl = `/uploads/${req.file.filename}`;
        await User.updateAvatar(req.userId, avatarUrl);
        const updatedUser = await User.findById(req.userId);
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
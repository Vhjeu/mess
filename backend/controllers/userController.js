const User = require('../models/User');

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
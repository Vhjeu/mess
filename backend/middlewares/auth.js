const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/env');

module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Không có token xác thực' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, getJwtSecret(), {
            algorithms: ['HS256']
        });
        const userId = Number(decoded.userId);
        if (!Number.isInteger(userId) || userId <= 0) {
            throw new Error('Invalid token payload');
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Token không hợp lệ hoặc hết hạn' });
    }
};

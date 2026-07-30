const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { rateLimit } = require('express-rate-limit');
const {
    loginLimiter,
    registerLimiter
} = require('../middlewares/rateLimiters');

const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({
        message: 'Nếu thông tin hợp lệ, hướng dẫn khôi phục đã được gửi.'
    })
});

const resetPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.' }
});

router.post('/register', registerLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
router.post('/reset-password', resetPasswordLimiter, authController.resetPassword);

module.exports = router;

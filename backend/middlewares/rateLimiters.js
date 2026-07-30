const { rateLimit } = require('express-rate-limit');

const createLimiter = ({
    windowMs,
    limit,
    message,
    skipSuccessfulRequests = false
}) => rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    message: { message }
});

const loginLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    message: 'Đăng nhập thất bại quá nhiều lần. Vui lòng thử lại sau.'
});

const registerLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    message: 'Bạn đã đăng ký quá nhiều lần. Vui lòng thử lại sau.'
});

const accountEmailLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: 'Bạn đã gửi quá nhiều yêu cầu xác minh. Vui lòng thử lại sau.'
});

const uploadLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    message: 'Bạn đã tải lên quá nhiều lần. Vui lòng thử lại sau.'
});

module.exports = {
    accountEmailLimiter,
    loginLimiter,
    registerLimiter,
    uploadLimiter
};

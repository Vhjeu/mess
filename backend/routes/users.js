const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const { uploadAvatar } = require('../middlewares/uploadMiddleware');
const {
    accountEmailLimiter,
    uploadLimiter
} = require('../middlewares/rateLimiters');

router.get('/', authMiddleware, userController.getAllUsers);
router.get('/me', authMiddleware, userController.getMe);
router.get('/nicknames', authMiddleware, userController.getNicknames);
router.get('/:targetUserId/nickname', authMiddleware, userController.getNickname);
router.put('/:targetUserId/nickname', authMiddleware, userController.updateNickname);
router.put('/me', authMiddleware, userController.updateProfile);
router.post('/me/avatar', authMiddleware, uploadLimiter, uploadAvatar, userController.uploadAvatar);
router.post('/me/email/change/start', authMiddleware, accountEmailLimiter, userController.startEmailChange);
router.post('/me/email/change/verify-current', authMiddleware, accountEmailLimiter, userController.verifyCurrentEmailForChange);
router.post('/me/email/request', authMiddleware, accountEmailLimiter, userController.requestEmailVerification);
router.post('/me/email/resend', authMiddleware, accountEmailLimiter, userController.resendEmailVerification);
router.post('/me/email/verify', authMiddleware, accountEmailLimiter, userController.verifyEmail);
router.delete('/me/email/pending', authMiddleware, userController.cancelEmailVerification);
router.put('/me/password', authMiddleware, userController.changePassword);
router.get('/:userId', authMiddleware, userController.getUserById);

module.exports = router;

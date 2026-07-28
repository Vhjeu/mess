const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', authMiddleware, userController.getAllUsers);
router.get('/me', authMiddleware, userController.getMe);
router.get('/nicknames', authMiddleware, userController.getNicknames);
router.get('/:targetUserId/nickname', authMiddleware, userController.getNickname);
router.put('/:targetUserId/nickname', authMiddleware, userController.updateNickname);
router.put('/me', authMiddleware, userController.updateProfile);
router.post('/me/avatar', authMiddleware, upload.single('avatar'), userController.uploadAvatar);
router.post('/me/email/change/start', authMiddleware, userController.startEmailChange);
router.post('/me/email/change/verify-current', authMiddleware, userController.verifyCurrentEmailForChange);
router.post('/me/email/request', authMiddleware, userController.requestEmailVerification);
router.post('/me/email/resend', authMiddleware, userController.resendEmailVerification);
router.post('/me/email/verify', authMiddleware, userController.verifyEmail);
router.delete('/me/email/pending', authMiddleware, userController.cancelEmailVerification);
router.put('/me/password', authMiddleware, userController.changePassword);
router.get('/:userId', authMiddleware, userController.getUserById);

module.exports = router;

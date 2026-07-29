const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads');
const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;

const IMAGE_EXTENSIONS = new Map([
    ['image/jpeg', '.jpg'],
    ['image/png', '.png'],
    ['image/gif', '.gif'],
    ['image/webp', '.webp'],
    ['image/avif', '.avif'],
    ['image/bmp', '.bmp']
]);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const safeOriginalExtension = file => {
    const imageExtension = IMAGE_EXTENSIONS.get(file.mimetype?.toLowerCase());
    if (imageExtension) return imageExtension;

    const extension = path.extname(file.originalname || '').toLowerCase();
    return /^\.[a-z0-9]{1,10}$/u.test(extension) ? extension : '';
};

const storage = multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
    filename: (_req, file, callback) => {
        callback(null, `${crypto.randomUUID()}${safeOriginalExtension(file)}`);
    }
});

const attachmentFileFilter = (_req, file, callback) => {
    const mimeType = file.mimetype?.toLowerCase() || '';
    if (mimeType.startsWith('image/') && !IMAGE_EXTENSIONS.has(mimeType)) {
        const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
        error.userMessage = 'Định dạng ảnh không được hỗ trợ. Hãy dùng JPG, PNG, GIF, WebP, AVIF hoặc BMP.';
        return callback(error);
    }
    callback(null, true);
};

const avatarFileFilter = (_req, file, callback) => {
    if (!IMAGE_EXTENSIONS.has(file.mimetype?.toLowerCase())) {
        const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
        error.userMessage = 'Ảnh đại diện phải là JPG, PNG, GIF, WebP, AVIF hoặc BMP.';
        return callback(error);
    }
    callback(null, true);
};

const attachmentUpload = multer({
    storage,
    limits: {
        fileSize: MAX_ATTACHMENT_SIZE,
        files: MAX_ATTACHMENTS,
        fields: 4
    },
    fileFilter: attachmentFileFilter
});

const avatarUpload = multer({
    storage,
    limits: { fileSize: MAX_AVATAR_SIZE, files: 1, fields: 0 },
    fileFilter: avatarFileFilter
});

const removeUploadedFiles = async files => {
    const normalizedFiles = Array.isArray(files)
        ? files
        : Object.values(files || {}).flat();
    await Promise.allSettled(normalizedFiles.map(file => fs.promises.unlink(file.path)));
};

module.exports = {
    IMAGE_EXTENSIONS,
    MAX_ATTACHMENTS,
    MAX_ATTACHMENT_SIZE,
    MAX_AVATAR_SIZE,
    UPLOAD_DIR,
    attachmentUpload,
    avatarUpload,
    removeUploadedFiles
};

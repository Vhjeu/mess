const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads');
const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;
const BLOCKED_ATTACHMENT_EXTENSIONS = new Set([
    '.bat', '.cmd', '.com', '.cpl', '.exe', '.hta', '.htm', '.html',
    '.js', '.mjs', '.cjs', '.msi', '.php', '.ps1', '.scr', '.sh', '.svg'
]);
const BLOCKED_ATTACHMENT_MIME_TYPES = new Set([
    'application/javascript',
    'application/x-httpd-php',
    'application/x-msdownload',
    'image/svg+xml',
    'text/html'
]);

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
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (
        BLOCKED_ATTACHMENT_EXTENSIONS.has(extension)
        || BLOCKED_ATTACHMENT_MIME_TYPES.has(mimeType)
    ) {
        const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
        error.userMessage = 'Định dạng file này không được phép tải lên.';
        return callback(error);
    }
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

const removeStoredUploadUrls = async urls => {
    const filePaths = (Array.isArray(urls) ? urls : [urls])
        .filter(value => typeof value === 'string' && value.startsWith('/uploads/'))
        .map(value => {
            const fileName = path.basename(value);
            return value === `/uploads/${fileName}`
                ? path.join(UPLOAD_DIR, fileName)
                : null;
        })
        .filter(Boolean);
    await Promise.allSettled(filePaths.map(filePath => fs.promises.unlink(filePath)));
};

module.exports = {
    IMAGE_EXTENSIONS,
    MAX_ATTACHMENTS,
    MAX_ATTACHMENT_SIZE,
    MAX_AVATAR_SIZE,
    UPLOAD_DIR,
    attachmentUpload,
    avatarUpload,
    removeStoredUploadUrls,
    removeUploadedFiles
};

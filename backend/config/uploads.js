const path = require('path');
const multer = require('multer');

const MB = 1024 * 1024;
const UPLOAD_LIMITS = Object.freeze({
    avatar: 10 * MB,
    image: 20 * MB,
    gif: 20 * MB,
    video: 100 * MB,
    file: 100 * MB
});
const MAX_ATTACHMENTS = 5;
const MAX_TOTAL_UPLOAD_SIZE = 150 * MB;

const BLOCKED_ATTACHMENT_EXTENSIONS = new Set([
    '.bat', '.cmd', '.com', '.cpl', '.exe', '.hta', '.htm', '.html',
    '.js', '.mjs', '.cjs', '.msi', '.php', '.ps1', '.scr', '.sh', '.svg'
]);
const BLOCKED_ATTACHMENT_MIME_TYPES = new Set([
    'application/javascript',
    'application/x-bat',
    'application/x-csh',
    'application/x-httpd-php',
    'application/x-msdos-program',
    'application/x-msdownload',
    'application/x-powershell',
    'application/x-sh',
    'application/x-shellscript',
    'image/svg+xml',
    'text/html',
    'text/javascript'
]);
const IMAGE_MIME_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
]);
const VIDEO_MIME_TYPES = new Set([
    'video/mp4',
    'video/quicktime',
    'video/webm'
]);
const DOCUMENT_MIME_TYPES = new Set([
    'application/msword',
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/x-zip-compressed',
    'application/zip',
    'text/plain'
]);
const IMAGE_EXTENSIONS = new Set(['.gif', '.jpeg', '.jpg', '.png', '.webp']);
const VIDEO_EXTENSIONS = new Set(['.mov', '.mp4', '.webm']);
const REQUEST_UPLOAD_BYTES = Symbol('requestUploadBytes');

const getMimeType = file => file?.mimetype?.toLowerCase().trim() || '';
const getExtension = file => path.extname(file?.originalname || '').toLowerCase();

const getUploadType = (file, forcedType = null) => {
    if (forcedType === 'avatar') return 'avatar';
    const mimeType = getMimeType(file);
    if (mimeType === 'image/gif') return 'gif';
    if (IMAGE_MIME_TYPES.has(mimeType)) return 'image';
    if (VIDEO_MIME_TYPES.has(mimeType)) return 'video';
    return 'file';
};

const createUploadError = (code, message, file, details = {}) => {
    const error = new Error(message);
    error.code = code;
    error.status = code === 'LIMIT_FILE_SIZE' || code === 'LIMIT_TOTAL_FILE_SIZE'
        ? 413
        : 415;
    error.expose = true;
    error.userMessage = message;
    error.field = file?.fieldname;
    Object.assign(error, details);
    return error;
};

const validateUploadMetadata = (file, { imagesOnly = false, forcedType = null } = {}) => {
    const mimeType = getMimeType(file);
    const extension = getExtension(file);

    if (
        BLOCKED_ATTACHMENT_EXTENSIONS.has(extension)
        || BLOCKED_ATTACHMENT_MIME_TYPES.has(mimeType)
    ) {
        return createUploadError(
            'INVALID_FILE_TYPE',
            'Định dạng tệp này không được phép tải lên.',
            file
        );
    }

    if (!mimeType) {
        return createUploadError(
            'INVALID_FILE_TYPE',
            'Không xác định được định dạng MIME của tệp.',
            file
        );
    }

    if (
        (mimeType.startsWith('image/') && !IMAGE_MIME_TYPES.has(mimeType))
        || (IMAGE_EXTENSIONS.has(extension) && !IMAGE_MIME_TYPES.has(mimeType))
    ) {
        return createUploadError(
            'INVALID_IMAGE_TYPE',
            'Định dạng ảnh không được hỗ trợ. Hãy dùng JPG, PNG, GIF hoặc WebP.',
            file
        );
    }

    if (
        (mimeType.startsWith('video/') && !VIDEO_MIME_TYPES.has(mimeType))
        || (VIDEO_EXTENSIONS.has(extension) && !VIDEO_MIME_TYPES.has(mimeType))
    ) {
        return createUploadError(
            'INVALID_VIDEO_TYPE',
            'Định dạng video không được hỗ trợ. Hãy dùng MP4, WebM hoặc MOV.',
            file
        );
    }

    if ((imagesOnly || forcedType === 'avatar') && !IMAGE_MIME_TYPES.has(mimeType)) {
        return createUploadError(
            forcedType === 'avatar' ? 'INVALID_AVATAR_TYPE' : 'INVALID_IMAGE_TYPE',
            forcedType === 'avatar'
                ? 'Ảnh đại diện phải là JPG, PNG, GIF hoặc WebP.'
                : 'Chỉ được tải JPG, PNG, GIF hoặc WebP lên endpoint ảnh.',
            file
        );
    }

    return null;
};

const getTooLargeDetails = (file, forcedType = null) => {
    const uploadType = getUploadType(file, forcedType);
    const maxSize = UPLOAD_LIMITS[uploadType];
    return {
        uploadType,
        maxSize,
        maxSizeMb: maxSize / MB
    };
};

const createLimitedMemoryStorage = ({
    forcedType = null,
    maxTotalSize = MAX_TOTAL_UPLOAD_SIZE
} = {}) => ({
    _handleFile(req, file, callback) {
        const chunks = [];
        let size = 0;
        let settled = false;
        const limit = getTooLargeDetails(file, forcedType);

        const finish = (error, result) => {
            if (settled) return;
            settled = true;
            chunks.length = 0;
            callback(error, result);
        };

        file.stream.on('error', error => finish(error));
        file.stream.on('limit', () => {
            finish(createUploadError(
                'LIMIT_FILE_SIZE',
                'Tệp vượt quá dung lượng cho phép.',
                file,
                limit
            ));
        });
        file.stream.on('data', chunk => {
            if (settled) return;
            const nextFileSize = size + chunk.length;
            const nextRequestSize = (req[REQUEST_UPLOAD_BYTES] || 0) + chunk.length;

            if (nextFileSize > limit.maxSize) {
                finish(createUploadError(
                    'LIMIT_FILE_SIZE',
                    'Tệp vượt quá dung lượng cho phép.',
                    file,
                    limit
                ));
                return;
            }
            if (nextRequestSize > maxTotalSize) {
                finish(createUploadError(
                    'LIMIT_TOTAL_FILE_SIZE',
                    `Tổng dung lượng tệp trong một lần gửi không được vượt quá ${maxTotalSize / MB} MB.`,
                    file,
                    { maxTotalSizeMb: maxTotalSize / MB }
                ));
                return;
            }

            chunks.push(chunk);
            size = nextFileSize;
            req[REQUEST_UPLOAD_BYTES] = nextRequestSize;
        });
        file.stream.on('end', () => {
            if (settled) return;
            settled = true;
            const buffer = Buffer.concat(chunks, size);
            chunks.length = 0;
            callback(null, {
                buffer,
                size
            });
        });
    },
    _removeFile(_req, file, callback) {
        delete file.buffer;
        callback(null);
    }
});

const createFileFilter = options => (_req, file, callback) => {
    const validationError = validateUploadMetadata(file, options);
    callback(validationError, !validationError);
};

const createChatUpload = ({ imagesOnly = false } = {}) => multer({
    storage: createLimitedMemoryStorage(),
    limits: {
        fileSize: imagesOnly ? UPLOAD_LIMITS.image : UPLOAD_LIMITS.file,
        files: MAX_ATTACHMENTS,
        fields: 4,
        parts: MAX_ATTACHMENTS + 4
    },
    fileFilter: createFileFilter({ imagesOnly })
});

const attachmentUpload = createChatUpload();
const chatImageUpload = createChatUpload({ imagesOnly: true });
const avatarUpload = multer({
    storage: createLimitedMemoryStorage({
        forcedType: 'avatar',
        maxTotalSize: UPLOAD_LIMITS.avatar
    }),
    limits: {
        fileSize: UPLOAD_LIMITS.avatar,
        files: 1,
        fields: 0,
        parts: 1
    },
    fileFilter: createFileFilter({ imagesOnly: true, forcedType: 'avatar' })
});

module.exports = {
    BLOCKED_ATTACHMENT_EXTENSIONS,
    DOCUMENT_MIME_TYPES,
    IMAGE_EXTENSIONS,
    IMAGE_MIME_TYPES,
    MAX_ATTACHMENTS,
    MAX_TOTAL_UPLOAD_SIZE,
    MB,
    UPLOAD_LIMITS,
    VIDEO_MIME_TYPES,
    attachmentUpload,
    avatarUpload,
    chatImageUpload,
    createLimitedMemoryStorage,
    getUploadType,
    validateUploadMetadata
};

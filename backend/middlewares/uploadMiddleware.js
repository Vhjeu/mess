const {
    MAX_ATTACHMENTS,
    MAX_TOTAL_UPLOAD_SIZE,
    MB,
    UPLOAD_LIMITS,
    attachmentUpload,
    avatarUpload,
    chatImageUpload
} = require('../config/uploads');

const SIZE_ERRORS = {
    avatar: {
        code: 'AVATAR_TOO_LARGE',
        label: 'Ảnh đại diện'
    },
    gif: {
        code: 'IMAGE_TOO_LARGE',
        label: 'Ảnh'
    },
    image: {
        code: 'IMAGE_TOO_LARGE',
        label: 'Ảnh'
    },
    video: {
        code: 'VIDEO_TOO_LARGE',
        label: 'Video'
    },
    file: {
        code: 'FILE_TOO_LARGE',
        label: 'Tệp'
    }
};

const sendUploadError = (res, error, fallbackType) => {
    if (error.code === 'LIMIT_FILE_SIZE') {
        const uploadType = error.uploadType || fallbackType;
        const details = SIZE_ERRORS[uploadType] || SIZE_ERRORS.file;
        const maxSizeMb = error.maxSizeMb
            || (UPLOAD_LIMITS[uploadType] || UPLOAD_LIMITS.file) / MB;
        return res.status(413).json({
            success: false,
            code: details.code,
            message: `${details.label} không được vượt quá ${maxSizeMb} MB.`,
            maxSizeMb
        });
    }
    if (error.code === 'LIMIT_TOTAL_FILE_SIZE') {
        return res.status(413).json({
            success: false,
            code: 'REQUEST_TOO_LARGE',
            message: error.userMessage,
            maxTotalSizeMb: error.maxTotalSizeMb || MAX_TOTAL_UPLOAD_SIZE / MB
        });
    }
    if (['LIMIT_FILE_COUNT', 'LIMIT_UNEXPECTED_FILE', 'LIMIT_PART_COUNT'].includes(error.code)) {
        return res.status(400).json({
            success: false,
            code: 'TOO_MANY_FILES',
            message: `Chỉ được gửi tối đa ${MAX_ATTACHMENTS} tệp mỗi lần.`,
            maxFiles: MAX_ATTACHMENTS
        });
    }

    return res.status(error.status || 400).json({
        success: false,
        code: error.code || 'INVALID_UPLOAD',
        message: error.userMessage || 'Không thể tải tệp lên.'
    });
};

const runUpload = (uploadHandler, fallbackType) => (req, res, next) => {
    uploadHandler(req, res, error => (
        error ? sendUploadError(res, error, fallbackType) : next()
    ));
};

const uploadChatAttachments = runUpload(
    attachmentUpload.fields([
        { name: 'files', maxCount: MAX_ATTACHMENTS },
        { name: 'file', maxCount: 1 }
    ]),
    'file'
);
const uploadChatImages = runUpload(
    chatImageUpload.fields([
        { name: 'files', maxCount: MAX_ATTACHMENTS },
        { name: 'file', maxCount: 1 }
    ]),
    'image'
);
const uploadAvatar = runUpload(avatarUpload.single('avatar'), 'avatar');

module.exports = {
    sendUploadError,
    uploadAvatar,
    uploadChatAttachments,
    uploadChatImages
};

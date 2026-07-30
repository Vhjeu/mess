export const MB = 1024 * 1024;
export const UPLOAD_LIMITS = Object.freeze({
    avatar: 10 * MB,
    image: 20 * MB,
    gif: 20 * MB,
    video: 100 * MB,
    file: 100 * MB
});
export const MAX_UPLOAD_FILES = 5;
export const MAX_TOTAL_UPLOAD_SIZE = 150 * MB;

export const IMAGE_MIME_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
]);
export const VIDEO_MIME_TYPES = new Set([
    'video/mp4',
    'video/quicktime',
    'video/webm'
]);
export const BLOCKED_UPLOAD_EXTENSIONS = new Set([
    '.bat', '.cmd', '.com', '.cpl', '.exe', '.hta', '.htm', '.html',
    '.js', '.mjs', '.cjs', '.msi', '.php', '.ps1', '.scr', '.sh', '.svg'
]);
const BLOCKED_UPLOAD_MIME_TYPES = new Set([
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
const IMAGE_EXTENSIONS = new Set(['.gif', '.jpeg', '.jpg', '.png', '.webp']);
const VIDEO_EXTENSIONS = new Set(['.mov', '.mp4', '.webm']);

const getExtension = fileName => {
    const match = typeof fileName === 'string' && fileName.match(/(\.[^.\\/]+)$/u);
    return match ? match[1].toLowerCase() : '';
};

export const formatFileSize = size => {
    const bytes = Number(size);
    if (!Number.isFinite(bytes) || bytes < 0) return '';
    if (bytes < 1024) return `${bytes} B`;

    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${new Intl.NumberFormat('vi-VN', {
        maximumFractionDigits: 1
    }).format(value)} ${units[unitIndex]}`;
};

export const getUploadType = (file, requestedType = 'auto') => {
    if (requestedType === 'avatar') return 'avatar';
    const mimeType = file?.type?.toLowerCase().trim() || '';
    if (mimeType === 'image/gif') return 'gif';
    if (IMAGE_MIME_TYPES.has(mimeType)) return 'image';
    if (VIDEO_MIME_TYPES.has(mimeType)) return 'video';
    return requestedType === 'image' ? 'image' : 'file';
};

const invalidResult = (code, message) => ({
    valid: false,
    code,
    message
});

export const validateUploadFile = (file, requestedType = 'auto') => {
    if (!file || !Number.isFinite(Number(file.size)) || Number(file.size) < 0) {
        return invalidResult('INVALID_UPLOAD', 'Tệp đã chọn không hợp lệ.');
    }

    const mimeType = file.type?.toLowerCase().trim() || '';
    const extension = getExtension(file.name);
    if (
        BLOCKED_UPLOAD_EXTENSIONS.has(extension)
        || BLOCKED_UPLOAD_MIME_TYPES.has(mimeType)
    ) {
        return invalidResult('INVALID_FILE_TYPE', 'Định dạng tệp này không được phép tải lên.');
    }

    if (!mimeType) {
        return invalidResult(
            'INVALID_FILE_TYPE',
            'Không xác định được định dạng MIME của tệp.'
        );
    }

    if (
        (mimeType.startsWith('image/') && !IMAGE_MIME_TYPES.has(mimeType))
        || (IMAGE_EXTENSIONS.has(extension) && !IMAGE_MIME_TYPES.has(mimeType))
    ) {
        return invalidResult(
            'INVALID_IMAGE_TYPE',
            'Định dạng ảnh không được hỗ trợ. Hãy dùng JPG, PNG, GIF hoặc WebP.'
        );
    }

    if (
        (mimeType.startsWith('video/') && !VIDEO_MIME_TYPES.has(mimeType))
        || (VIDEO_EXTENSIONS.has(extension) && !VIDEO_MIME_TYPES.has(mimeType))
    ) {
        return invalidResult(
            'INVALID_VIDEO_TYPE',
            'Định dạng video không được hỗ trợ. Hãy dùng MP4, WebM hoặc MOV.'
        );
    }

    if (
        ['avatar', 'image'].includes(requestedType)
        && !IMAGE_MIME_TYPES.has(mimeType)
    ) {
        return invalidResult(
            requestedType === 'avatar' ? 'INVALID_AVATAR_TYPE' : 'INVALID_IMAGE_TYPE',
            requestedType === 'avatar'
                ? 'Ảnh đại diện phải là JPG, PNG, GIF hoặc WebP.'
                : 'Chỉ được chọn ảnh JPG, PNG, GIF hoặc WebP.'
        );
    }

    const uploadType = getUploadType(file, requestedType);
    const maxSize = UPLOAD_LIMITS[uploadType];
    const maxSizeMb = maxSize / MB;
    if (file.size > maxSize) {
        const label = uploadType === 'avatar'
            ? 'Ảnh đại diện'
            : ['image', 'gif'].includes(uploadType)
                ? 'Ảnh'
                : uploadType === 'video'
                    ? 'Video'
                    : 'Tệp';
        const code = uploadType === 'avatar'
            ? 'AVATAR_TOO_LARGE'
            : ['image', 'gif'].includes(uploadType)
                ? 'IMAGE_TOO_LARGE'
                : uploadType === 'video'
                    ? 'VIDEO_TOO_LARGE'
                    : 'FILE_TOO_LARGE';
        return {
            valid: false,
            code,
            uploadType,
            maxSize,
            maxSizeMb,
            message: `${label} này có dung lượng ${formatFileSize(file.size)}, vượt giới hạn ${maxSizeMb} MB.`
        };
    }

    return {
        valid: true,
        code: null,
        message: '',
        uploadType,
        maxSize,
        maxSizeMb
    };
};

export const validateUploadFiles = (files, requestedType = 'auto') => {
    const normalizedFiles = Array.from(files || []);
    if (normalizedFiles.length > MAX_UPLOAD_FILES) {
        return invalidResult(
            'TOO_MANY_FILES',
            `Chỉ được chọn tối đa ${MAX_UPLOAD_FILES} tệp mỗi lần.`
        );
    }

    for (const file of normalizedFiles) {
        const result = validateUploadFile(file, requestedType);
        if (!result.valid) return result;
    }

    const totalSize = normalizedFiles.reduce((total, file) => total + file.size, 0);
    if (totalSize > MAX_TOTAL_UPLOAD_SIZE) {
        return invalidResult(
            'REQUEST_TOO_LARGE',
            `Tổng dung lượng tệp là ${formatFileSize(totalSize)}, vượt giới hạn ${MAX_TOTAL_UPLOAD_SIZE / MB} MB.`
        );
    }

    return {
        valid: true,
        code: null,
        message: '',
        totalSize
    };
};

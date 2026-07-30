const path = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const {
    assertCloudinaryConfigured,
    cloudinary
} = require('../config/cloudinary');
const { IMAGE_MIME_TYPES } = require('../config/uploads');

const WEBP_QUALITY = 90;
const CHAT_MAX_WIDTH = 2560;
const AVATAR_MAX_SIZE = 800;
const MAX_INPUT_PIXELS = 100_000_000;
const DELETE_ATTEMPTS = 3;
const RESOURCE_TYPES = new Set(['image', 'raw', 'video']);

const wait = milliseconds => new Promise(resolve => {
    setTimeout(resolve, milliseconds);
});

const createMediaError = ({
    code,
    message,
    status = 502,
    cause
}) => {
    const error = new Error(message, { cause });
    error.code = code;
    error.status = status;
    error.expose = true;
    return error;
};

const normalizePrefix = prefix => {
    if (!['avatars', 'chat', 'files'].includes(prefix)) {
        throw createMediaError({
            code: 'INVALID_MEDIA_PREFIX',
            message: 'Nhóm lưu trữ media không hợp lệ.',
            status: 500
        });
    }
    return prefix;
};

const sanitizeOriginalName = value => (
    Array.from(typeof value === 'string' ? value : '')
        .filter(character => character >= ' ' && character !== '\u007f')
        .slice(0, 255)
        .join('')
        .replace(/[\\/]/gu, '_')
        .trim() || 'download'
);

const getSafeExtension = file => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    return /^\.[a-z0-9]{1,10}$/u.test(extension) ? extension : '';
};

const getResourceType = file => {
    const mimeType = file.mimetype?.toLowerCase() || '';
    if (IMAGE_MIME_TYPES.has(mimeType)) return 'image';
    if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) return 'video';
    return 'raw';
};

const optimizeImage = async (file, prefix) => {
    const mimeType = file.mimetype?.toLowerCase();
    if (mimeType === 'image/gif') {
        return {
            buffer: file.buffer,
            contentType: 'image/gif',
            format: undefined
        };
    }

    try {
        let pipeline = sharp(file.buffer, {
            failOn: 'warning',
            limitInputPixels: MAX_INPUT_PIXELS
        }).rotate();

        pipeline = prefix === 'avatars'
            ? pipeline.resize({
                width: AVATAR_MAX_SIZE,
                height: AVATAR_MAX_SIZE,
                fit: 'inside',
                withoutEnlargement: true
            })
            : pipeline.resize({
                width: CHAT_MAX_WIDTH,
                fit: 'inside',
                withoutEnlargement: true
            });

        return {
            buffer: await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer(),
            contentType: 'image/webp',
            format: 'webp'
        };
    } catch (error) {
        throw createMediaError({
            code: 'INVALID_IMAGE_TYPE',
            message: 'Định dạng ảnh không được hỗ trợ.',
            status: 415,
            cause: error
        });
    }
};

const uploadBuffer = (buffer, options) => new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error) {
            reject(error);
            return;
        }
        resolve(result);
    });
    stream.on('error', reject);
    stream.end(buffer);
});

const uploadFile = async (file, {
    imagePrefix = 'chat',
    filePrefix = 'files'
} = {}) => {
    const configuration = assertCloudinaryConfigured();
    const resourceType = getResourceType(file);
    const prefix = normalizePrefix(resourceType === 'image' ? imagePrefix : filePrefix);
    const folder = `${configuration.folder}/${prefix}`;
    const rawExtension = resourceType === 'raw' ? getSafeExtension(file) : '';
    const publicId = `${folder}/${uuidv4()}-${Date.now()}${rawExtension}`;

    const processed = resourceType === 'image'
        ? await optimizeImage(file, prefix)
        : {
            buffer: file.buffer,
            contentType: (file.mimetype || 'application/octet-stream').slice(0, 255),
            format: undefined
        };

    let result;
    try {
        result = await uploadBuffer(processed.buffer, {
            resource_type: resourceType,
            public_id: publicId,
            asset_folder: folder,
            overwrite: false,
            unique_filename: false,
            use_filename: false,
            ...(processed.format ? { format: processed.format } : {})
        });
    } catch (error) {
        throw createMediaError({
            code: 'CLOUDINARY_UPLOAD_FAILED',
            message: 'Không thể tải ảnh lên. Vui lòng thử lại.',
            cause: error
        });
    }

    if (!result?.secure_url || !result?.public_id) {
        throw createMediaError({
            code: 'CLOUDINARY_UPLOAD_FAILED',
            message: 'Không thể tải ảnh lên. Vui lòng thử lại.'
        });
    }

    return {
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type || resourceType,
        format: result.format || processed.format || null,
        contentType: processed.contentType,
        size: Number(result.bytes || processed.buffer.length),
        width: Number.isFinite(Number(result.width)) ? Number(result.width) : null,
        height: Number.isFinite(Number(result.height)) ? Number(result.height) : null,
        originalName: sanitizeOriginalName(file.originalname)
    };
};

const retry = async operation => {
    let lastError;
    for (let attempt = 1; attempt <= DELETE_ATTEMPTS; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (attempt < DELETE_ATTEMPTS) {
                await wait(150 * (2 ** (attempt - 1)));
            }
        }
    }
    throw lastError;
};

const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
    if (!publicId) return;
    assertCloudinaryConfigured();

    const normalizedResourceType = RESOURCE_TYPES.has(resourceType)
        ? resourceType
        : 'image';
    try {
        const result = await retry(() => cloudinary.uploader.destroy(publicId, {
            resource_type: normalizedResourceType,
            invalidate: true
        }));
        if (!['ok', 'not found'].includes(result?.result)) {
            throw new Error(`Cloudinary destroy trả về: ${result?.result || 'unknown'}`);
        }
    } catch (error) {
        throw createMediaError({
            code: 'CLOUDINARY_DELETE_FAILED',
            message: 'Không thể xóa file khỏi dịch vụ lưu trữ.',
            cause: error
        });
    }
};

const isOwnedCloudinaryUrl = value => {
    if (typeof value !== 'string' || !value.trim()) return false;
    try {
        const configuration = assertCloudinaryConfigured();
        const url = new URL(value);
        return url.protocol === 'https:'
            && url.hostname === 'res.cloudinary.com'
            && url.pathname.startsWith(`/${configuration.cloudName}/`);
    } catch {
        return false;
    }
};

const isOwnedPublicId = value => {
    if (typeof value !== 'string' || !value.trim()) return false;
    try {
        const configuration = assertCloudinaryConfigured();
        return value.startsWith(`${configuration.folder}/`);
    } catch {
        return false;
    }
};

const deleteStoredMedia = async records => {
    const normalizedRecords = Array.isArray(records) ? records : [records];
    const uniqueRecords = new Map();

    normalizedRecords.forEach(record => {
        const publicId = record?.publicId || record?.file_public_id || record?.avatar_public_id;
        const url = record?.url || record?.file_url || record?.avatar_url;
        const resourceType = record?.resourceType || record?.resource_type || 'image';
        if (
            publicId
            && isOwnedPublicId(publicId)
            && isOwnedCloudinaryUrl(url)
        ) {
            uniqueRecords.set(`${resourceType}:${publicId}`, { publicId, resourceType });
        }
    });

    const results = await Promise.allSettled(
        [...uniqueRecords.values()].map(record => (
            deleteFromCloudinary(record.publicId, record.resourceType)
        ))
    );
    const failure = results.find(result => result.status === 'rejected');
    if (failure) {
        throw failure.reason;
    }
};

const deleteUploadedObjects = async uploadedObjects => {
    const results = await Promise.allSettled(
        uploadedObjects
            .filter(item => item?.publicId)
            .map(item => deleteFromCloudinary(item.publicId, item.resourceType))
    );
    const failure = results.find(result => result.status === 'rejected');
    if (failure) {
        throw failure.reason;
    }
};

const rollbackUploadedObjects = async uploadedObjects => {
    if (!uploadedObjects.length) return;
    const startedAt = Date.now();
    try {
        await deleteUploadedObjects(uploadedObjects);
    } catch (error) {
        console.error('[media]', {
            operation: 'upload_rollback',
            stage: 'cloudinary_delete',
            duration_ms: Date.now() - startedAt,
            object_count: uploadedObjects.length,
            error_code: error.code || error.name
        });
    }
};

const uploadFiles = async (files, options) => {
    const uploadedObjects = [];
    try {
        // Xử lý tuần tự để giới hạn RAM/CPU khi một request chứa nhiều file lớn.
        for (const file of files) {
            uploadedObjects.push(await uploadFile(file, options));
        }
        return uploadedObjects;
    } catch (error) {
        await rollbackUploadedObjects(uploadedObjects);
        throw error;
    }
};

module.exports = {
    AVATAR_MAX_SIZE,
    CHAT_MAX_WIDTH,
    WEBP_QUALITY,
    deleteFromCloudinary,
    deleteStoredMedia,
    deleteUploadedObjects,
    isOwnedCloudinaryUrl,
    rollbackUploadedObjects,
    uploadFile,
    uploadFiles
};

const hasPrefix = (buffer, bytes) => (
    bytes.every((byte, index) => buffer[index] === byte)
);

const matchesImageSignature = (buffer, mimeType) => {
    switch (mimeType?.toLowerCase()) {
        case 'image/jpeg':
        case 'image/jpg':
            return hasPrefix(buffer, [0xff, 0xd8, 0xff]);
        case 'image/png':
            return hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        case 'image/gif':
            return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
        case 'image/webp':
            return buffer.subarray(0, 4).toString('ascii') === 'RIFF'
                && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
        default:
            return true;
    }
};

const validateUploadedImages = async files => {
    const imageFiles = files.filter(file => file.mimetype?.toLowerCase().startsWith('image/'));
    imageFiles.forEach(file => {
        if (
            !Buffer.isBuffer(file.buffer)
            || !matchesImageSignature(file.buffer.subarray(0, 16), file.mimetype)
        ) {
            const error = new Error('Định dạng ảnh không được hỗ trợ.');
            error.code = 'INVALID_IMAGE_TYPE';
            error.status = 415;
            error.expose = true;
            throw error;
        }
    });
};

module.exports = { matchesImageSignature, validateUploadedImages };

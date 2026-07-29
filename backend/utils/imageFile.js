const fs = require('fs');

const hasPrefix = (buffer, bytes) => (
    bytes.every((byte, index) => buffer[index] === byte)
);

const matchesImageSignature = (buffer, mimeType) => {
    switch (mimeType?.toLowerCase()) {
        case 'image/jpeg':
            return hasPrefix(buffer, [0xff, 0xd8, 0xff]);
        case 'image/png':
            return hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        case 'image/gif':
            return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
        case 'image/webp':
            return buffer.subarray(0, 4).toString('ascii') === 'RIFF'
                && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
        case 'image/avif':
            return buffer.subarray(4, 8).toString('ascii') === 'ftyp'
                && ['avif', 'avis'].includes(buffer.subarray(8, 12).toString('ascii'));
        case 'image/bmp':
            return buffer.subarray(0, 2).toString('ascii') === 'BM';
        default:
            return true;
    }
};

const validateUploadedImages = async files => {
    const imageFiles = files.filter(file => file.mimetype?.toLowerCase().startsWith('image/'));
    await Promise.all(imageFiles.map(async file => {
        const handle = await fs.promises.open(file.path, 'r');
        try {
            const buffer = Buffer.alloc(16);
            const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
            if (!matchesImageSignature(buffer.subarray(0, bytesRead), file.mimetype)) {
                const error = new Error(`"${file.originalname}" không phải là file ảnh hợp lệ.`);
                error.status = 415;
                throw error;
            }
        } finally {
            await handle.close();
        }
    }));
};

module.exports = { matchesImageSignature, validateUploadedImages };

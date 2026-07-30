const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const test = require('node:test');
const express = require('express');
const {
    BLOCKED_ATTACHMENT_EXTENSIONS,
    MAX_ATTACHMENTS,
    MAX_TOTAL_UPLOAD_SIZE,
    MB,
    UPLOAD_LIMITS,
    createLimitedMemoryStorage,
    validateUploadMetadata
} = require('../config/uploads');
const {
    sendUploadError,
    uploadChatAttachments
} = require('../middlewares/uploadMiddleware');

const file = (name, mimetype, size = 0) => ({
    fieldname: 'files',
    originalname: name,
    mimetype,
    size
});

const captureResponse = () => {
    const captured = { status: null, body: null };
    return {
        captured,
        response: {
            status(status) {
                captured.status = status;
                return this;
            },
            json(body) {
                captured.body = body;
                return this;
            }
        }
    };
};

const storeFile = (metadata, chunks, options = {}) => new Promise(resolve => {
    const storage = createLimitedMemoryStorage(options);
    const streamedFile = {
        ...metadata,
        stream: Readable.from(chunks)
    };
    storage._handleFile({}, streamedFile, (error, result) => resolve({ error, result }));
});

const withUploadEndpoint = async operation => {
    const calls = {
        cloudinary: 0,
        database: 0,
        socket: 0
    };
    const app = express();
    app.post('/upload', uploadChatAttachments, (_req, res) => {
        calls.cloudinary += 1;
        calls.database += 1;
        calls.socket += 1;
        res.json({ success: true });
    });
    const server = await new Promise(resolve => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    try {
        const address = server.address();
        return await operation(`http://127.0.0.1:${address.port}/upload`, calls);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
};

test('chính sách dung lượng khớp từng loại upload', () => {
    assert.equal(UPLOAD_LIMITS.avatar, 10 * MB);
    assert.equal(UPLOAD_LIMITS.image, 20 * MB);
    assert.equal(UPLOAD_LIMITS.gif, 20 * MB);
    assert.equal(UPLOAD_LIMITS.video, 100 * MB);
    assert.equal(UPLOAD_LIMITS.file, 100 * MB);
    assert.equal(MAX_ATTACHMENTS, 5);
    assert.equal(MAX_TOTAL_UPLOAD_SIZE, 150 * MB);
});

test('các mốc kích thước yêu cầu được chấp nhận hoặc từ chối đúng', () => {
    const cases = [
        ['ảnh 5 MB', 5 * MB, 'image', true],
        ['ảnh 19,9 MB', 19.9 * MB, 'image', true],
        ['ảnh 20,1 MB', 20.1 * MB, 'image', false],
        ['avatar 9 MB', 9 * MB, 'avatar', true],
        ['avatar 11 MB', 11 * MB, 'avatar', false],
        ['video 80 MB', 80 * MB, 'video', true],
        ['video 101 MB', 101 * MB, 'video', false],
        ['PDF 50 MB', 50 * MB, 'file', true],
        ['ZIP 101 MB', 101 * MB, 'file', false]
    ];

    cases.forEach(([label, size, type, expected]) => {
        assert.equal(size <= UPLOAD_LIMITS[type], expected, label);
    });
});

test('đuôi thực thi và ảnh đổi đuôi sai MIME bị chặn', () => {
    assert.ok(BLOCKED_ATTACHMENT_EXTENSIONS.has('.exe'));
    assert.equal(
        validateUploadMetadata(file('virus.exe', 'application/octet-stream'))?.code,
        'INVALID_FILE_TYPE'
    );
    assert.equal(
        validateUploadMetadata(file('not-an-image.jpg', 'application/octet-stream'))?.code,
        'INVALID_IMAGE_TYPE'
    );
    assert.equal(validateUploadMetadata(file('photo.jpg', 'image/jpeg')), null);
    assert.equal(validateUploadMetadata(file('movie.mp4', 'video/mp4')), null);
    assert.equal(
        validateUploadMetadata(file('movie.avi', 'video/x-msvideo'))?.code,
        'INVALID_VIDEO_TYPE'
    );
});

test('storage dừng ảnh quá 20 MB trước khi tạo buffer kết quả', async () => {
    const result = await storeFile(
        file('large.jpg', 'image/jpeg'),
        [Buffer.alloc(20 * MB), Buffer.alloc(1)]
    );
    assert.equal(result.error?.code, 'LIMIT_FILE_SIZE');
    assert.equal(result.error?.uploadType, 'image');
    assert.equal(result.error?.maxSizeMb, 20);
    assert.equal(result.result, undefined);
});

test('storage dừng avatar quá 10 MB trước khi tạo buffer kết quả', async () => {
    const result = await storeFile(
        file('avatar.png', 'image/png'),
        [Buffer.alloc(10 * MB), Buffer.alloc(1)],
        { forcedType: 'avatar', maxTotalSize: UPLOAD_LIMITS.avatar }
    );
    assert.equal(result.error?.code, 'LIMIT_FILE_SIZE');
    assert.equal(result.error?.uploadType, 'avatar');
    assert.equal(result.result, undefined);
});

test('lỗi dung lượng trả schema thống nhất cho frontend', () => {
    const cases = [
        ['avatar', 'AVATAR_TOO_LARGE', 10],
        ['image', 'IMAGE_TOO_LARGE', 20],
        ['video', 'VIDEO_TOO_LARGE', 100],
        ['file', 'FILE_TOO_LARGE', 100]
    ];

    cases.forEach(([uploadType, code, maxSizeMb]) => {
        const { captured, response } = captureResponse();
        sendUploadError(response, {
            code: 'LIMIT_FILE_SIZE',
            uploadType,
            maxSizeMb
        }, uploadType);
        assert.equal(captured.status, 413);
        assert.deepEqual(captured.body.success, false);
        assert.equal(captured.body.code, code);
        assert.equal(captured.body.maxSizeMb, maxSizeMb);
        assert.equal(typeof captured.body.message, 'string');
    });
});

test('file bị middleware từ chối không được chuyển tới Cloudinary/DB/socket', async () => {
    await withUploadEndpoint(async (url, calls) => {
        const formData = new FormData();
        formData.append(
            'files',
            new Blob(['not executable'], { type: 'application/x-msdownload' }),
            'payload.exe'
        );
        const response = await fetch(url, { method: 'POST', body: formData });
        const body = await response.json();

        assert.equal(response.status, 415);
        assert.equal(body.code, 'INVALID_FILE_TYPE');
        assert.deepEqual(calls, { cloudinary: 0, database: 0, socket: 0 });
    });
});

test('request quá 5 file bị chặn trước xử lý downstream', async () => {
    await withUploadEndpoint(async (url, calls) => {
        const formData = new FormData();
        for (let index = 0; index < MAX_ATTACHMENTS + 1; index += 1) {
            formData.append(
                'files',
                new Blob(['document'], { type: 'application/pdf' }),
                `${index}.pdf`
            );
        }
        const response = await fetch(url, { method: 'POST', body: formData });
        const body = await response.json();

        assert.equal(response.status, 400);
        assert.equal(body.code, 'TOO_MANY_FILES');
        assert.deepEqual(calls, { cloudinary: 0, database: 0, socket: 0 });
    });
});

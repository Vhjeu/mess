import assert from 'node:assert/strict';
import test from 'node:test';
import {
    MAX_UPLOAD_FILES,
    MB,
    formatFileSize,
    validateUploadFile,
    validateUploadFiles
} from './uploadValidation.js';

const file = (name, type, size) => ({ name, type, size });

test('frontend kiểm tra đúng các biên dung lượng bắt buộc', () => {
    const cases = [
        [file('small.jpg', 'image/jpeg', 5 * MB), 'auto', true],
        [file('near.jpg', 'image/jpeg', 19.9 * MB), 'auto', true],
        [file('large.jpg', 'image/jpeg', 20.1 * MB), 'auto', false],
        [file('avatar.jpg', 'image/jpeg', 9 * MB), 'avatar', true],
        [file('avatar.jpg', 'image/jpeg', 11 * MB), 'avatar', false],
        [file('movie.mp4', 'video/mp4', 80 * MB), 'auto', true],
        [file('movie.mp4', 'video/mp4', 101 * MB), 'auto', false],
        [file('document.pdf', 'application/pdf', 50 * MB), 'auto', true],
        [file('archive.zip', 'application/zip', 101 * MB), 'auto', false]
    ];

    cases.forEach(([selectedFile, uploadType, expected]) => {
        assert.equal(
            validateUploadFile(selectedFile, uploadType).valid,
            expected,
            selectedFile.name
        );
    });
});

test('frontend chặn file nguy hiểm và ảnh đổi đuôi sai MIME', () => {
    assert.equal(
        validateUploadFile(file('payload.exe', 'application/octet-stream', 10)).code,
        'INVALID_FILE_TYPE'
    );
    assert.equal(
        validateUploadFile(file('fake.jpg', 'application/octet-stream', 10)).code,
        'INVALID_IMAGE_TYPE'
    );
});

test('frontend chặn quá số file và tổng dung lượng 150 MB', () => {
    const tooMany = Array.from(
        { length: MAX_UPLOAD_FILES + 1 },
        (_, index) => file(`${index}.pdf`, 'application/pdf', MB)
    );
    assert.equal(validateUploadFiles(tooMany).code, 'TOO_MANY_FILES');

    const overTotal = [
        file('one.pdf', 'application/pdf', 80 * MB),
        file('two.pdf', 'application/pdf', 71 * MB)
    ];
    assert.equal(validateUploadFiles(overTotal).code, 'REQUEST_TOO_LARGE');
});

test('thông báo dung lượng dùng định dạng tiếng Việt rõ ràng', () => {
    const result = validateUploadFile(
        file('large.pdf', 'application/pdf', 134.7 * MB)
    );
    assert.equal(result.valid, false);
    assert.match(result.message, /134,7 MB/u);
    assert.match(result.message, /100 MB/u);
    assert.equal(formatFileSize(19.9 * MB), '19,9 MB');
});

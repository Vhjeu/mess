const MIN_DISPLAY_NAME_LENGTH = 2;
const MAX_DISPLAY_NAME_LENGTH = 22;

const normalizeDisplayName = (value) => (
    typeof value === 'string'
        ? value.trim().replace(/\s+/gu, ' ')
        : ''
);

const getDisplayNameLength = (value) => Array.from(value).length;

const validateDisplayName = (value) => {
    const displayName = normalizeDisplayName(value);
    const length = getDisplayNameLength(displayName);

    if (!displayName) {
        return {
            valid: false,
            message: 'Tên hiển thị không được để trống'
        };
    }

    if (length < MIN_DISPLAY_NAME_LENGTH || length > MAX_DISPLAY_NAME_LENGTH) {
        return {
            valid: false,
            message: `Tên hiển thị phải có từ ${MIN_DISPLAY_NAME_LENGTH} đến ${MAX_DISPLAY_NAME_LENGTH} ký tự`
        };
    }

    return { valid: true, displayName };
};

module.exports = {
    MIN_DISPLAY_NAME_LENGTH,
    MAX_DISPLAY_NAME_LENGTH,
    normalizeDisplayName,
    validateDisplayName
};

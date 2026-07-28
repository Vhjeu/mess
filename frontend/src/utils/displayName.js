export const MIN_DISPLAY_NAME_LENGTH = 2;
export const MAX_DISPLAY_NAME_LENGTH = 30;

export const normalizeDisplayName = (value = '') => (
    value.trim().replace(/\s+/gu, ' ')
);

export const getDisplayNameLength = (value = '') => Array.from(value).length;

export const validateDisplayName = (value) => {
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

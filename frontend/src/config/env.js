const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const defaultApiUrl = import.meta.env.DEV
    ? 'http://localhost:5000'
    : 'https://api.shoptvh.online';

const normalizeOrigin = (value, variableName) => {
    const normalized = value
        .replace(/\/(?:api|socket\.io)\/?$/u, '')
        .replace(/\/+$/u, '');
    let url;
    try {
        url = new URL(normalized);
    } catch {
        throw new Error(`${variableName} phải là URL HTTP/HTTPS hợp lệ.`);
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error(`${variableName} phải dùng giao thức HTTP hoặc HTTPS.`);
    }
    if (import.meta.env.PROD && url.protocol !== 'https:') {
        throw new Error(`${variableName} phải dùng HTTPS trong bản production.`);
    }
    return normalized;
};

export const API_ORIGIN = normalizeOrigin(
    configuredApiUrl || defaultApiUrl,
    'VITE_API_URL'
);

export const API_BASE_URL = `${API_ORIGIN}/api`;

export const SOCKET_ORIGIN = normalizeOrigin(
    import.meta.env.VITE_SOCKET_URL?.trim() || API_ORIGIN,
    'VITE_SOCKET_URL'
);

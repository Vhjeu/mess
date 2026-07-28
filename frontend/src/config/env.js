const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const defaultApiUrl = import.meta.env.DEV
    ? 'http://localhost:5000'
    : 'https://api.shoptvh.online';

export const API_ORIGIN = (configuredApiUrl || defaultApiUrl)
    .replace(/\/api\/?$/u, '')
    .replace(/\/+$/u, '');

export const API_BASE_URL = `${API_ORIGIN}/api`;

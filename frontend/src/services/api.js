import axios from 'axios';
import { API_BASE_URL } from '../config/env';

const api = axios.create({
    baseURL: API_BASE_URL
});

export const OTP_REQUEST_TIMEOUT_MS = 25000;

export const postOtpRequest = async (path, data = {}) => {
    const startedAt = globalThis.performance?.now?.() ?? Date.now();
    try {
        const response = await api.post(path, data, {
            timeout: OTP_REQUEST_TIMEOUT_MS
        });
        const durationMs = (globalThis.performance?.now?.() ?? Date.now()) - startedAt;
        console.info('[timing]', {
            operation: `frontend:${path}`,
            status: 'success',
            duration_ms: Number(durationMs.toFixed(1))
        });
        return response;
    } catch (error) {
        const durationMs = (globalThis.performance?.now?.() ?? Date.now()) - startedAt;
        console.warn('[timing]', {
            operation: `frontend:${path}`,
            status: error.code === 'ECONNABORTED' ? 'timeout' : 'error',
            duration_ms: Number(durationMs.toFixed(1))
        });
        throw error;
    }
};

export const isRequestTimeout = error => (
    error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT'
);

// Interceptor để gắn token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;

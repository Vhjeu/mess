import axios from 'axios';

const api = axios.create({
    baseURL: "https://api.shoptvh.online/api"
});

// Interceptor để gắn token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
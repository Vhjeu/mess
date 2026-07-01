import api from './api';

export const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    return res.data; // { token, user }
};

export const register = async (username, password, confirmPassword) => {
    const res = await api.post('/auth/register', { username, password, confirmPassword });
    return res.data; // { message }
};
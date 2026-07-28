import api from './api';

export const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    return res.data; // { token, user }
};

export const register = async (username, displayName, password, confirmPassword) => {
    const res = await api.post('/auth/register', {
        username,
        display_name: displayName,
        password,
        confirmPassword
    });
    return res.data; // { message }
};

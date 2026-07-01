import api from './api';

export const getUsers = async (search = '') => {
    const res = await api.get('/users', { params: { search } });
    return res.data;
};

export const getMe = async () => {
    const res = await api.get('/users/me');
    return res.data;
};

export const updateProfile = async (username) => {
    const res = await api.put('/users/me', { username });
    return res.data;
};

export const uploadAvatar = async (formData) => {
    const res = await api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
};

export const changePassword = async (currentPassword, newPassword) => {
    const res = await api.put('/users/me/password', { currentPassword, newPassword });
    return res.data;
};
import api from './api';

export const getUsers = async (search = '') => {
    const res = await api.get('/users', { params: { search } });
    return res.data;
};

export const getMe = async () => {
    const res = await api.get('/users/me');
    return res.data;
};
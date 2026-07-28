import api, { postOtpRequest } from './api';

export const getUsers = async (search = '') => {
    const res = await api.get('/users', { params: { search } });
    return res.data;
};

export const getMe = async () => {
    const res = await api.get('/users/me');
    return res.data;
};

export const updateProfile = async (displayName) => {
    const res = await api.put('/users/me', { display_name: displayName });
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

export const requestEmailVerification = async (email) => {
    const res = await postOtpRequest('/users/me/email/request', { email });
    return res.data;
};

export const startEmailChange = async (currentPassword) => {
    const res = await postOtpRequest('/users/me/email/change/start', { currentPassword });
    return res.data;
};

export const verifyCurrentEmailForChange = async (otp) => {
    const res = await api.post('/users/me/email/change/verify-current', { otp });
    return res.data;
};

export const resendEmailVerification = async () => {
    const res = await postOtpRequest('/users/me/email/resend');
    return res.data;
};

export const verifyEmail = async (otp) => {
    const res = await api.post('/users/me/email/verify', { otp });
    return res.data;
};

export const cancelEmailVerification = async () => {
    const res = await api.delete('/users/me/email/pending');
    return res.data;
};

export const getUser = async (userId) => {
    const res = await api.get(`/users/${userId}`);
    return res.data;
};

export const getNicknames = async () => {
    const res = await api.get('/users/nicknames');
    return res.data;
};

export const getNickname = async (targetUserId) => {
    const res = await api.get(`/users/${targetUserId}/nickname`);
    return res.data;
};

export const updateNickname = async (targetUserId, nickname) => {
    const res = await api.put(`/users/${targetUserId}/nickname`, { nickname });
    return res.data;
};

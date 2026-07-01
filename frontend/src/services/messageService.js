import api from './api';

export const getMessages = async (conversationId) => {
    const res = await api.get(`/messages/${conversationId}`);
    return res.data;
};

export const sendMessage = async (conversationId, content) => {
    const res = await api.post('/messages', { conversationId, content });
    return res.data;
};

export const uploadImage = async (formData) => {
    const res = await api.post('/messages/file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
};
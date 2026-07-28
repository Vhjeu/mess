import api from './api';

export const getMessages = async (conversationId) => {
    const res = await api.get(`/messages/${conversationId}`);
    return res.data;
};

export const sendMessage = async (conversationId, content, targetUserId = null) => {
    const res = await api.post('/messages', { conversationId, targetUserId, content });
    return res.data;
};

export const uploadAttachments = async (formData, onUploadProgress) => {
    const res = await api.post('/messages/file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: progressEvent => {
            if (!onUploadProgress) return;
            const total = progressEvent.total || progressEvent.loaded;
            onUploadProgress(Math.min(100, Math.round((progressEvent.loaded * 100) / total)));
        }
    });
    return res.data;
};

export const uploadImage = uploadAttachments;

export const revokeMessage = async (conversationId, messageId) => {
    const res = await api.post('/messages/revoke', { conversationId, messageId });
    return res.data;
};

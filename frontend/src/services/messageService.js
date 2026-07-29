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
    const selectedFileBytes = Array.from(formData.values())
        .filter(value => value instanceof File)
        .reduce((total, file) => total + file.size, 0);
    const res = await api.post('/messages/file', formData, {
        onUploadProgress: progressEvent => {
            if (!onUploadProgress) return;
            const total = progressEvent.total || selectedFileBytes || progressEvent.loaded;
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

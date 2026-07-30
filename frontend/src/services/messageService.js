import api from './api';
import {
    IMAGE_MIME_TYPES,
    validateUploadFiles
} from '../utils/uploadValidation';

export const getMessages = async (conversationId) => {
    const res = await api.get(`/messages/${conversationId}`);
    return res.data;
};

export const sendMessage = async (conversationId, content, targetUserId = null) => {
    const res = await api.post('/messages', { conversationId, targetUserId, content });
    return res.data;
};

export const uploadAttachments = async (formData, onUploadProgress) => {
    const selectedFiles = Array.from(formData.values())
        .filter(value => value instanceof File);
    const validation = validateUploadFiles(selectedFiles);
    if (!validation.valid) {
        const error = new Error(validation.message);
        error.code = validation.code;
        throw error;
    }

    const selectedFileBytes = selectedFiles.reduce((total, file) => total + file.size, 0);
    const endpoint = selectedFiles.length > 0
        && selectedFiles.every(file => IMAGE_MIME_TYPES.has(file.type?.toLowerCase()))
        ? '/messages/image'
        : '/messages/file';
    const res = await api.post(endpoint, formData, {
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

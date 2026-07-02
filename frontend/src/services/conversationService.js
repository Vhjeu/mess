import api from './api';

export const getConversations = async () => {
    const res = await api.get('/conversations');
    return res.data;
};

export const createOrGetConversation = async (userId) => {
    const res = await api.post('/conversations', { userId });
    return res.data;
};

export const deleteConversation = async (conversationId) => {
    const res = await api.delete(`/conversations/${conversationId}`);
    return res.data;
};
export const getAvatarUrl = (avatarUrl) => {
    if (!avatarUrl) return null;

    if (/^https?:\/\//i.test(avatarUrl)) {
        return avatarUrl;
    }

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    try {
        return new URL(avatarUrl, baseUrl).toString();
    } catch {
        return avatarUrl;
    }
};

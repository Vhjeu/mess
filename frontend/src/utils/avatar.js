const DEFAULT_AVATAR = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
  <rect width="160" height="160" rx="80" fill="#e5e7eb" />
  <circle cx="80" cy="64" r="32" fill="#9ca3af" />
  <path d="M40 136c8-24 32-36 40-36s32 12 40 36" fill="#9ca3af" />
</svg>
`)}`;

export const getDefaultAvatarUrl = () => DEFAULT_AVATAR;

export const getAvatarUrl = (avatarUrl) => {
    const normalizedAvatar = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';

    if (!normalizedAvatar) return DEFAULT_AVATAR;

    if (/^https?:\/\//i.test(normalizedAvatar)) {
        return normalizedAvatar;
    }

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    try {
        return new URL(normalizedAvatar, baseUrl).toString();
    } catch {
        return DEFAULT_AVATAR;
    }
};

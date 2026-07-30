import { API_ORIGIN } from '../config/env';

export { formatFileSize } from './uploadValidation';

const EXTENSION_ICON_MAP = {
    pdf: 'bi-file-earmark-pdf-fill',
    doc: 'bi-file-earmark-word-fill',
    docx: 'bi-file-earmark-word-fill',
    xls: 'bi-file-earmark-excel-fill',
    xlsx: 'bi-file-earmark-excel-fill',
    csv: 'bi-file-earmark-spreadsheet-fill',
    zip: 'bi-file-earmark-zip-fill',
    rar: 'bi-file-earmark-zip-fill',
    '7z': 'bi-file-earmark-zip-fill'
};

export const isImageAttachment = (attachment) => (
    attachment?.file_type?.toLowerCase().startsWith('image/')
    || attachment?.file_type?.toLowerCase() === 'image'
);

export const getAttachmentName = (attachment) => {
    if (attachment?.file_name) return attachment.file_name;

    try {
        const pathname = new URL(attachment?.file_url, API_ORIGIN).pathname;
        return decodeURIComponent(pathname.split('/').pop()) || 'Tệp đính kèm';
    } catch {
        return 'Tệp đính kèm';
    }
};

export const getAttachmentUrl = (attachment) => {
    const rawUrl = typeof attachment?.file_url === 'string'
        ? attachment.file_url.trim()
        : '';
    if (!rawUrl) return '';
    if (/^(?:blob:|data:)/iu.test(rawUrl)) return rawUrl;

    try {
        const parsedUrl = new URL(rawUrl, API_ORIGIN);
        // URL upload cũ có thể chứa host nội bộ hoặc host của proxy tại thời điểm gửi.
        // File luôn được phục vụ từ API origin hiện tại.
        if (parsedUrl.pathname.startsWith('/uploads/')) {
            return new URL(`${parsedUrl.pathname}${parsedUrl.search}`, API_ORIGIN).toString();
        }
        return parsedUrl.toString();
    } catch {
        return '';
    }
};

export const getFileIcon = (attachment) => {
    const name = getAttachmentName(attachment);
    const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    return EXTENSION_ICON_MAP[extension] || 'bi-file-earmark-fill';
};

export const downloadAttachment = async (attachment) => {
    const attachmentUrl = getAttachmentUrl(attachment);
    if (!attachmentUrl) throw new Error('Không thể tải tệp');

    let objectUrl = '';
    let downloadUrl = attachmentUrl;
    if (!/^(?:blob:|data:)/iu.test(attachmentUrl)) {
        try {
            const response = await fetch(attachmentUrl);
            if (!response.ok) {
                throw new Error('Không thể tải tệp');
            }
            objectUrl = URL.createObjectURL(await response.blob());
            downloadUrl = objectUrl;
        } catch {
            // URL cũ hoặc CDN bên thứ ba có thể không cho phép CORS.
            // Trình duyệt vẫn có thể mở URL trực tiếp mà không làm hỏng luồng tải.
            downloadUrl = attachmentUrl;
        }
    }

    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = getAttachmentName(attachment);
    anchor.rel = 'noopener';
    if (!objectUrl && /^https?:/iu.test(downloadUrl)) {
        anchor.target = '_blank';
    }
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    if (objectUrl) {
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    }
};

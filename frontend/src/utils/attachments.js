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
        const pathname = new URL(attachment?.file_url).pathname;
        return decodeURIComponent(pathname.split('/').pop()) || 'Tệp đính kèm';
    } catch {
        return 'Tệp đính kèm';
    }
};

export const formatFileSize = (size) => {
    const bytes = Number(size);
    if (!Number.isFinite(bytes) || bytes < 0) return '';
    if (bytes < 1024) return `${bytes} B`;

    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
};

export const getFileIcon = (attachment) => {
    const name = getAttachmentName(attachment);
    const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    return EXTENSION_ICON_MAP[extension] || 'bi-file-earmark-fill';
};

export const downloadAttachment = async (attachment) => {
    const response = await fetch(attachment.file_url);
    if (!response.ok) {
        throw new Error('Không thể tải tệp');
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = getAttachmentName(attachment);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

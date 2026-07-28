import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { downloadAttachment, getAttachmentName } from '../../utils/attachments';

const ImageLightbox = ({ images, activeIndex, onChange, onClose }) => {
    const image = images[activeIndex];

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'ArrowLeft' && images.length > 1) {
                onChange((activeIndex - 1 + images.length) % images.length);
            }
            if (event.key === 'ArrowRight' && images.length > 1) {
                onChange((activeIndex + 1) % images.length);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [activeIndex, images.length, onChange, onClose]);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    if (!image) return null;

    const handleDownload = async () => {
        try {
            await downloadAttachment(image);
        } catch {
            toast.error('Không thể tải ảnh xuống');
        }
    };

    return createPortal(
        <div
            className="image-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={`Xem ảnh ${getAttachmentName(image)}`}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className="image-lightbox-toolbar">
                <span className="image-lightbox-counter">
                    {images.length > 1 ? `${activeIndex + 1} / ${images.length}` : getAttachmentName(image)}
                </span>
                <button type="button" onClick={handleDownload} title="Tải ảnh xuống" aria-label="Tải ảnh xuống">
                    <i className="bi bi-download"></i>
                </button>
                <button type="button" onClick={onClose} title="Đóng" aria-label="Đóng ảnh">
                    <i className="bi bi-x-lg"></i>
                </button>
            </div>

            {images.length > 1 && (
                <button
                    type="button"
                    className="image-lightbox-nav is-previous"
                    onClick={() => onChange((activeIndex - 1 + images.length) % images.length)}
                    aria-label="Ảnh trước"
                >
                    <i className="bi bi-chevron-left"></i>
                </button>
            )}

            <img
                className="image-lightbox-image"
                src={image.file_url}
                alt={getAttachmentName(image)}
            />

            {images.length > 1 && (
                <button
                    type="button"
                    className="image-lightbox-nav is-next"
                    onClick={() => onChange((activeIndex + 1) % images.length)}
                    aria-label="Ảnh tiếp theo"
                >
                    <i className="bi bi-chevron-right"></i>
                </button>
            )}
        </div>,
        document.body
    );
};

export default ImageLightbox;

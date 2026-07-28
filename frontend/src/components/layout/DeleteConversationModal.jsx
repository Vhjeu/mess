const DeleteConversationModal = ({ open, onClose, onConfirm, loading = false }) => {
    if (!open) return null;

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-conversation-title">
            <div className="modal-card">
                <div className="modal-icon">
                    <i className="bi bi-trash3"></i>
                </div>
                <h3 id="delete-conversation-title">Xóa cuộc trò chuyện</h3>
                <p>
                    Bạn có chắc chắn muốn xóa cuộc trò chuyện này không?
                    <br />
                    Lịch sử hiện tại chỉ bị xóa ở phía bạn và không ảnh hưởng đến người còn lại.
                </p>
                <div className="modal-actions">
                    <button type="button" className="app-button app-button--secondary" onClick={onClose} disabled={loading}>
                        Hủy
                    </button>
                    <button type="button" className="app-button app-button--danger" onClick={onConfirm} disabled={loading}>
                        {loading ? <><span className="button-spinner"></span>Đang xóa...</> : 'Xóa cuộc trò chuyện'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteConversationModal;

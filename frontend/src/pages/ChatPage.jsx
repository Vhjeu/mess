import { useParams } from 'react-router-dom';

const ChatPage = () => {
    const { conversationId } = useParams();

    if (!conversationId) {
        return (
            <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                <div className="text-center">
                    <i className="bi bi-chat-dots display-1"></i>
                    <h4>Chọn một cuộc trò chuyện</h4>
                </div>
            </div>
        );
    }

    return (
        <div className="d-flex flex-column h-100">
            <div className="p-3 border-bottom bg-white d-flex align-items-center">
                <h5 className="mb-0">Cuộc trò chuyện #{conversationId}</h5>
                <span className="ms-2 text-muted">(Đang phát triển)</span>
            </div>
            <div className="flex-grow-1 p-3 overflow-auto">
                <p className="text-muted">Tin nhắn sẽ hiển thị ở đây</p>
            </div>
            <div className="p-3 border-top bg-white">
                <div className="input-group">
                    <input type="text" className="form-control" placeholder="Nhập tin nhắn..." disabled />
                    <button className="btn btn-primary" disabled><i className="bi bi-send"></i></button>
                </div>
            </div>
        </div>
    );
};

export default ChatPage;
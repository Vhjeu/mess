import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const MainLayout = () => {
    return (
        <div className="d-flex app-shell">
            <div className="sidebar-panel">
                <Sidebar />
            </div>
            <div className="chat-panel flex-grow-1">
                <Outlet />
            </div>
        </div>
    );
};

export default MainLayout;
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const MainLayout = () => {
    return (
        <div className="d-flex vh-100">
            <div style={{ width: '360px' }} className="flex-shrink-0">
                <Sidebar />
            </div>
            <div className="flex-grow-1 bg-light dark:bg-gray-900">
                <Outlet />
            </div>
        </div>
    );
};

export default MainLayout;
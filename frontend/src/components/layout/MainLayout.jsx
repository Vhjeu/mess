import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

const MainLayout = () => {
    const { pathname } = useLocation();
    const isConversationOpen = /^\/chat\/[^/]+/.test(pathname);
    const isSectionPage = pathname === '/users' || pathname === '/profile';

    return (
        <div className={`app-shell ${isConversationOpen ? 'has-active-chat' : ''} ${isSectionPage ? 'has-section-page' : ''}`}>
            <div className="sidebar-panel">
                <Sidebar />
            </div>
            <main className="chat-panel">
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;

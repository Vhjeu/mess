import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MainLayout from './components/layout/MainLayout';
import ChatPage from './pages/ChatPage';
import UsersPage from './pages/UsersPage';
import ProfilePage from './pages/ProfilePage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-loader" role="status" aria-label="Đang tải">
        <div className="app-loader-mark">
          <i className="bi bi-chat-heart-fill"></i>
        </div>
        <span className="app-loader-spinner"></span>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-loader" role="status" aria-label="Đang tải">
        <div className="app-loader-mark">
          <i className="bi bi-chat-heart-fill"></i>
        </div>
        <span className="app-loader-spinner"></span>
      </div>
    );
  }
  return user ? <Navigate to="/" /> : children;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
    <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
    <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
      <Route index element={<ChatPage />} />
      <Route path="chat/:conversationId" element={<ChatPage />} />
      <Route path="chat/new/:targetUserId" element={<ChatPage />} />
      <Route path="users" element={<UsersPage />} />
      <Route path="profile" element={<ProfilePage />} />
    </Route>
  </Routes>
);

function App() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const updateViewportHeight = () => {
      const viewportHeight = viewport?.height || window.innerHeight;
      document.documentElement.style.setProperty(
        '--app-viewport-height',
        `${Math.round(viewportHeight)}px`
      );
    };

    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    window.addEventListener('orientationchange', updateViewportHeight);
    viewport?.addEventListener('resize', updateViewportHeight);

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);
      viewport?.removeEventListener('resize', updateViewportHeight);
      document.documentElement.style.removeProperty('--app-viewport-height');
    };
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Toaster position="top-right" reverseOrder={false} />
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

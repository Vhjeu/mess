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
    const root = document.documentElement;
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    let frameId = 0;
    let orientationTimer = 0;
    let baselineHeight = viewport?.height || window.innerHeight;
    let baselineWidth = viewport?.width || window.innerWidth;

    const updateViewportMetrics = () => {
      frameId = 0;
      const viewportHeight = viewport?.height || window.innerHeight;
      const viewportWidth = viewport?.width || window.innerWidth;
      const standalone = standaloneQuery.matches || window.navigator.standalone === true;
      const viewportOffsetTop = standalone ? 0 : (viewport?.offsetTop || 0);

      if (Math.abs(viewportWidth - baselineWidth) > 80) {
        baselineWidth = viewportWidth;
        baselineHeight = viewportHeight;
      } else if (viewportHeight > baselineHeight) {
        baselineHeight = viewportHeight;
      }

      const keyboardOpen = baselineHeight - viewportHeight > 120;

      root.style.setProperty('--app-viewport-height', `${Math.round(viewportHeight)}px`);
      root.style.setProperty('--app-viewport-offset-top', `${Math.round(viewportOffsetTop)}px`);
      root.dataset.keyboardOpen = keyboardOpen ? 'true' : 'false';
    };

    const scheduleViewportUpdate = () => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updateViewportMetrics);
    };

    const handleOrientationChange = () => {
      window.clearTimeout(orientationTimer);
      orientationTimer = window.setTimeout(() => {
        baselineWidth = viewport?.width || window.innerWidth;
        baselineHeight = viewport?.height || window.innerHeight;
        scheduleViewportUpdate();
      }, 160);
    };

    updateViewportMetrics();
    window.addEventListener('resize', scheduleViewportUpdate);
    window.addEventListener('orientationchange', handleOrientationChange);
    viewport?.addEventListener('resize', scheduleViewportUpdate);
    viewport?.addEventListener('scroll', scheduleViewportUpdate);
    standaloneQuery.addEventListener?.('change', scheduleViewportUpdate);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      window.clearTimeout(orientationTimer);
      window.removeEventListener('resize', scheduleViewportUpdate);
      window.removeEventListener('orientationchange', handleOrientationChange);
      viewport?.removeEventListener('resize', scheduleViewportUpdate);
      viewport?.removeEventListener('scroll', scheduleViewportUpdate);
      standaloneQuery.removeEventListener?.('change', scheduleViewportUpdate);
      root.style.removeProperty('--app-viewport-height');
      root.style.removeProperty('--app-viewport-offset-top');
      delete root.dataset.keyboardOpen;
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

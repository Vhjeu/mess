import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { ThemeContext } from '../../contexts/ThemeContext';

const RecoveryShell = ({ eyebrow, title, description, children }) => {
    const { theme, toggleTheme } = useContext(ThemeContext);

    return (
        <div className="auth-shell recovery-shell">
            <button
                type="button"
                className="auth-theme-toggle"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            >
                <i className={`bi ${theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-fill'}`}></i>
            </button>
            <main className="recovery-card">
                <Link className="recovery-brand" to="/login">
                    <span><i className="bi bi-chat-heart-fill"></i></span>
                    <strong>Nhắn Tin</strong>
                </Link>
                <div className="recovery-icon"><i className="bi bi-shield-lock-fill"></i></div>
                <span className="recovery-eyebrow">{eyebrow}</span>
                <h1>{title}</h1>
                <p>{description}</p>
                {children}
            </main>
        </div>
    );
};

export default RecoveryShell;

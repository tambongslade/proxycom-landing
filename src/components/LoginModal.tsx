import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import './LoginModal.css';
import logoImg from '../assets/logo.png';

const LoginModal: React.FC = () => {
  const { isLoginModalOpen, closeLoginModal, login, isLoading } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await login({ email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginErrorGeneric'));
    }
  };

  if (!isLoginModalOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={closeLoginModal}>
      <div className="modal-content modern-login-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn modern-close-btn" onClick={closeLoginModal} aria-label="Close">&times;</button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 18 }}>
          <img src={logoImg} alt="Logo" style={{ width: 70, height: 70, marginBottom: 10, borderRadius: 16, boxShadow: '0 2px 8px rgba(80,80,180,0.10)' }} />
          <h2 style={{ margin: 0, fontWeight: 700, color: '#232946', fontSize: 26 }}>{t('clientLoginTitle')}</h2>
        </div>
        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <p className="error-message" style={{ marginBottom: 10 }}>{error}</p>}
          <div className="form-group">
            <label htmlFor="email">{t('email')}</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">{t('password')}</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <a href="/forgot-password" className="forgot-password-link" style={{ color: '#4a90e2', textDecoration: 'none' }}>
              {t('forgotPassword')}
            </a>
          </div>
          <button type="submit" disabled={isLoading} className="login-button">
            {isLoading ? t('loggingIn') : t('login')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginModal; 
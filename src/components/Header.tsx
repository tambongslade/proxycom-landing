import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import logoImg from '../assets/logo.png';
import './Header.css';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';

const Header: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isLoggedIn, openLoginModal, logout } = useAuth();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleLoginClick = () => {
    setMobileMenuOpen(false);
    openLoginModal();
  };

  const handleCampaignClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo-container">
          <div className="logo-wrapper">
            <Link to="/">
              <img src={logoImg} alt="ProxyCom Logo" className="logo" />
            </Link>
          </div>
        </div>
        <nav className={`nav-menu ${mobileMenuOpen ? 'mobile-active' : ''}`}>
          <ul>
            {location.pathname === '/' ? (
              <>
                <li><a href="#home" onClick={() => {setMobileMenuOpen(false);}}>{t('home')}</a></li>
                <li><a href="#about" onClick={() => {setMobileMenuOpen(false);}}>{t('about')}</a></li>
                <li><a href="#services" onClick={() => {setMobileMenuOpen(false);}}>{t('services')}</a></li>
                <li><a href="#why-trust" onClick={() => {setMobileMenuOpen(false);}}>{t('whyTrustUsTitle')}</a></li>
                <li><a href="#audio-logs" onClick={() => {setMobileMenuOpen(false);}}>{t('navAudioLogs')}</a></li>
                <li><a href="#contact" onClick={() => {setMobileMenuOpen(false);}}>{t('contact')}</a></li>
              </>
            ) : (
              <>
                <li><Link to="/" onClick={() => {setMobileMenuOpen(false);}}>{t('home')}</Link></li>
                <li><Link to="/campagne" onClick={() => {setMobileMenuOpen(false);}}>{t('campaignTitle')}</Link></li>
              </>
            )}
          </ul>
          <div className="auth-buttons-mobile">
            {isLoggedIn ? (
              <>
                <Link to="/campagne" className="sign-up-btn" style={{ marginRight: '10px' }} onClick={handleCampaignClick}>{t('campaignTitle')}</Link>
                <button className="login-btn" onClick={() => { logout(); setMobileMenuOpen(false); }}>{t('logout')}</button>
              </>
            ) : (
              <button className="sign-up-btn" onClick={handleLoginClick}>{t('login')}</button>
            )}
          </div>
        </nav>
      </div>

      {/* Mobile menu toggle button - moved here for better structure for mobile view */}
      <div className={`mobile-menu-toggle ${mobileMenuOpen ? 'open' : ''}`} onClick={toggleMobileMenu}>
        <span></span>
        <span></span>
        <span></span>
      </div>

      <div className="header-right">
        <LanguageSwitcher />
        <div className="auth-buttons-desktop">
          {isLoggedIn ? (
            <>
              <Link to="/campagne" className="sign-up-btn" style={{ marginRight: '10px' }} onClick={handleCampaignClick}>{t('campaignTitle')}</Link>
              <button className="login-btn" onClick={logout}>{t('logout')}</button>
            </>
          ) : (
            <button className="sign-up-btn" onClick={handleLoginClick}>{t('login')}</button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header; 
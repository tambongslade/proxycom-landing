import React from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="language-switcher">
      <button 
        className={i18n.language === 'en' ? 'active' : ''} 
        onClick={() => changeLanguage('en')}
      >
        EN
      </button>
      <button 
        className={i18n.language === 'fr' ? 'active' : ''} 
        onClick={() => changeLanguage('fr')}
      >
        FR
      </button>
      <button 
        className={i18n.language === 'es' ? 'active' : ''} 
        onClick={() => changeLanguage('es')}
      >
        ES
      </button>
    </div>
  );
};

export default LanguageSwitcher; 
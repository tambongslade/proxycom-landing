import React from 'react';
import { useTranslation } from 'react-i18next';
import logoImg from '../assets/logo.png';
import { highlightProxyCom } from '../utils/brandText';
import './PrivacyPolicy.css';

const PrivacyPolicy: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="privacy-policy-page">
      <div className="privacy-header">
        <div className="privacy-logo">
          <img src={logoImg} alt="ProxyCom Logo" />
        </div>
        <h1>{t('privacyPolicyTitle')}</h1>
      </div>
      
      <div className="privacy-content">
        <div className="privacy-intro">
          <p className="company-highlight">
            <strong className="proxycom-brand">ProxyCom</strong> {t('privacyPolicyIntro')}
          </p>
        </div>
        
        <div className="privacy-sections">
          <div className="privacy-section">
            <p>{highlightProxyCom(t('privacyPolicyText1'))}</p>
          </div>

          <div className="privacy-section">
            <p>
              {highlightProxyCom(t('privacyPolicyText2'))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
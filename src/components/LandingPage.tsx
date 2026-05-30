import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import './LandingPage.css';
// import { useAuth } from '../context/AuthContext';
import Header from './Header';
import { highlightProxyCom } from '../utils/brandText';

// Import images
import logoImg from '../assets/logo.png';
import hero from '../assets/hero.png';
import hero1 from '../assets/hero1.png';
import hero2 from '../assets/hero2.png';
import hero3 from '../assets/hero3.png';

// Import company logos
import { CampostLogo, OrangeLogo, CMSLogo, PevCameroonLogo, SocieteGeneraleLogo, DangoteLogo, AffirmativeLogo, CareProgramLogo, SocieteGenerale2Logo } from './CompanyLogos';
import purpleSpots from '../assets/purple spots.svg';
// Team Member Images (removed unused imports)
// import userPic1 from '../assets/user-1.png';
// import userPic2 from '../assets/user-2.png';
// import userPic3 from '../assets/user-3.png';
// import userPic4 from '../assets/user-4.png';
// import companyLogo from '../assets/logo.png';
// import oceanCityThumb from '../assets/ocean-city-thumb.png';

// Simple SVG Icons (can be moved to separate files or a component later)
const CommunicationIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="48px" height="48px">
    <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
  </svg>
);

const TourismIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="48px" height="48px">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
);

const MarketingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="48px" height="48px">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
    <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>
  </svg>
);

const PublicityIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="48px" height="48px">
    <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM8 15c0-1.66 1.34-3 3-3 .35 0 .69.07 1 .18V6h5v2h-3v7.03c-.02 1.64-1.35 2.97-3 2.97-1.66 0-3-1.34-3-3z"/>
  </svg>
);


const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="32px" height="32px">
    <path d="M8 5v14l11-7z"/>
  </svg>
);

// Social Media icon components were removed because they were unused

// Icons for 'Why Trust Us' Section
const PriceIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="48px" height="48px"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-.77-1.33-2.69-1.33-3.46 0L6.09 15.5c-.77 1.33.19 3 1.73 3h8.36c1.54 0 2.5-1.67 1.73-3l-2.76-4.36zM12 10c.83 0 1.5-.67 1.5-1.5S12.83 7 12 7s-1.5.67-1.5 1.5S11.17 10 12 10z"/></svg>);
const LoyaltyIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="48px" height="48px"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>);
const PotentialIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="48px" height="48px"><path d="M16.5 12c1.38 0 2.5-1.12 2.5-2.5S17.88 7 16.5 7C15.12 7 14 8.12 14 9.5s1.12 2.5 2.5 2.5zM9 11c1.66 0 2.99-1.34 2.99-3S10.66 5 9 5C7.34 5 6 6.34 6 8s1.34 3 3 3zm7.5 3c-1.83 0-5.5.92-5.5 2.75V19h11v-2.25c0-1.83-3.67-2.75-5.5-2.75zM9 13c-2.33 0-7 1.17-7 3.5V19h7v-2.5c0-.85.33-2.35 2.37-3.42-.33-.05-.66-.08-1-.08H9z"/></svg>);
const ExperienceIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="48px" height="48px"><path d="M19.36 6.71C18.88 6.23 18.25 6 17.58 6H12V4c0-.55-.45-1-1-1s-1 .45-1 1v2H6.42c-.67 0-1.3.23-1.78.71L2 12.07V19c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-6.93l-2.64-5.36zm-1.36 1.29l1.75 3.5H4.25l1.75-3.5h11zM4 19v-5.07l1.42-2.87H18.58L20 13.93V19H4z"/><circle cx="7.5" cy="15.5" r="1.5"/><circle cx="16.5" cy="15.5" r="1.5"/></svg>);

const LandingPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [showLangModal, setShowLangModal] = useState(false);
  const [langSelectedInSession, setLangSelectedInSession] = useState(false);
  const [hoveredActivity, setHoveredActivity] = useState<number | null>(null);
  const [showCommProximiteModal, setShowCommProximiteModal] = useState(false);
  const [currentHeroImage, setCurrentHeroImage] = useState(0);

  const heroImages = [hero, hero1, hero2, hero3];

  useEffect(() => {
    const storedLang = localStorage.getItem('appLanguage');
    if (storedLang) {
      i18n.changeLanguage(storedLang);
      setLangSelectedInSession(true);
    } else {
      setShowLangModal(true);
    }
  }, [i18n]);

  // Hero image carousel auto-rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHeroImage((prev) => (prev + 1) % heroImages.length);
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(interval);
  }, [heroImages.length]);

  const handleLanguageSelect = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('appLanguage', lng);
    setShowLangModal(false);
    setLangSelectedInSession(true);
  };

  // Removed teamMembers array as it was not used

  const trustItems = [
    { icon: <PriceIcon />, titleKey: 'trustPriceTitle', textKey: 'trustPriceText' },
    { icon: <LoyaltyIcon />, titleKey: 'trustLoyaltyTitle', textKey: 'trustLoyaltyText' },
    { icon: <PotentialIcon />, titleKey: 'trustPotentialTitle', textKey: 'trustPotentialText' },
    { icon: <ExperienceIcon />, titleKey: 'trustExperienceTitle', textKey: 'trustExperienceText' },
  ];

  return (
    <div className="landing-page">
      <Header />

      {showLangModal && !langSelectedInSession && (
        <div className="language-modal-overlay">
          <div className="language-modal-content">
            <h3>{t('selectLanguageTitle')}</h3>
            <div className="language-modal-buttons">
              <button onClick={() => handleLanguageSelect('en')}>{t('english')}</button>
              <button onClick={() => handleLanguageSelect('fr')}>{t('french')}</button>
              <button onClick={() => handleLanguageSelect('es')}>{t('spanish')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="global-background-animations">
        <div className="gb-shape gb-shape-1"></div>
        <div className="gb-shape gb-shape-2"></div>
        <div className="gb-shape gb-shape-3"></div>
      </div>
      <div className="purple-spots">
        <img src={purpleSpots} alt="" className="spots-image" />
      </div>

      <section className="hero-section" id="home">
        <div className="hero-title-container">
          <h1 className="hero-title">
            <span className="dark-text">{t('listen')}</span> 
            <span className="highlight">{t('verify')}</span> 
            <span className="dark-text">{t('trust')}</span>
          </h1>
        </div>

        <div className="audio-wave">
          {[...Array(120)].map((_, index) => (
            <div key={index} className="wave-bar" style={{ animationDelay: `${index * 0.03}s` }}></div>
          ))}
        </div>

        <div className="hero-content-wrapper">
          <div className="left-stats">
            <div className="info-circle clickable-card" onClick={() => setShowCommProximiteModal(true)}>
              <div className="info-circle-icon"><CommunicationIcon /></div>
              <h3>{t('localCommTitle')}</h3>
              <p>{t('localCommText')}</p>
              <div className="click-indicator">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16px" height="16px">
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                </svg>
              </div>
            </div>
            <div className="info-circle">
              <div className="info-circle-icon"><MarketingIcon /></div>
              <h3>{t('marketingTitle')}</h3>
              <p>{t('marketingText')}</p>
            </div>
          </div>

          <div className="hero-image">
            <div className="hero-carousel">
              {heroImages.map((image, index) => (
                <img
                  key={index}
                  src={image}
                  alt={`Hero ${index + 1}`}
                  className={`hero-carousel-image ${index === currentHeroImage ? 'active' : ''}`}
                />
              ))}
            </div>
            <div className="hero-carousel-indicators">
              {heroImages.map((_, index) => (
                <button
                  key={index}
                  className={`carousel-indicator ${index === currentHeroImage ? 'active' : ''}`}
                  onClick={() => setCurrentHeroImage(index)}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
          
          <div className="right-stats">
            <div className="info-circle">
              <div className="info-circle-icon"><TourismIcon /></div>
              <h3>{t('tourismTitle')}</h3>
              <p>{t('tourismText')}</p>
            </div>
            <div className="info-circle">
              <div className="info-circle-icon"><PublicityIcon /></div>
              <h3>{t('digitalTitle')}</h3>
              <p>{t('digitalText')}</p>
            </div>
          </div>
        </div>

        {/* <button className="get-started-btn">{t('getStarted')} →</button> */}
        
        <div className="trusted-by-section">
          <h3>{t('trustedBy')}</h3>
          <div className="carousel-container">
            <div className="companies-logos-carousel">
              <div className="logos-track">
                <CampostLogo />
                <OrangeLogo />
                <CMSLogo />
                <PevCameroonLogo />
                <SocieteGeneraleLogo />
                <DangoteLogo />
                <AffirmativeLogo />
                <CareProgramLogo />
                <SocieteGenerale2Logo />
                {/* Duplicate logos for seamless loop */}
                <CampostLogo />
                <OrangeLogo />
                <CMSLogo />
                <PevCameroonLogo />
                <SocieteGeneraleLogo />
                <DangoteLogo />
                <AffirmativeLogo />
                <CareProgramLogo />
                <SocieteGenerale2Logo />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="about-section section-animate" id="about">
        <div className="lottie-animation-container-about">
        </div>
        <div className="section-container">
          <div className="section-header">
            <h2>{highlightProxyCom(t('aboutTitle'))}</h2>
            <div className="section-divider"></div>
          </div>
          <div className="section-header">
            <h2>{t('valueTitle')}</h2>
            <div className="section-divider"></div>
          </div>
          <div className="values-grid">
            <div className="value-card">
              <div className="value-icon-container">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#8b5cf6" width="60px" height="60px">
                  <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2Z"/>
                  <path d="M21 9V7L15 1H5C3.89 1 3 1.89 3 3V7H1V9H3V15H1V17H3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V17H23V15H21V9H23ZM19 21H5V3H14.17L19 7.83V21Z"/>
                  <circle cx="7" cy="12" r="1.5" fill="#8b5cf6"/>
                  <circle cx="12" cy="12" r="1.5" fill="#8b5cf6"/>
                  <circle cx="17" cy="12" r="1.5" fill="#8b5cf6"/>
                </svg>
              </div>
              <h3>{t('proximityTitle')}</h3>
              <p>{t('proximityText')}</p>
            </div>
            <div className="value-card">
              <div className="value-icon-container">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#8b5cf6" width="60px" height="60px">
                  <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z"/>
                </svg>
              </div>
              <h3>{t('simplicityTitle')}</h3>
              <p>{t('simplicityText')}</p>
            </div>
            <div className="value-card">
              <div className="value-icon-container">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#8b5cf6" width="60px" height="60px">
                  <path d="M12,2L13.09,8.26L22,9.27L17,14.14L18.18,21.02L12,17.77L5.82,21.02L7,14.14L2,9.27L10.91,8.26L12,2Z" fill="#8b5cf6"/>
                  <path d="M12,6L8,10L12,14L16,10L12,6Z" fill="#3b82f6" opacity="0.7"/>
                  <circle cx="12" cy="10" r="1.5" fill="#ffffff"/>
                </svg>
              </div>
              <h3>{t('dynamismTitle')}</h3>
              <p>{t('dynamismText')}</p>
            </div>
            <div className="value-card">
              <div className="value-icon-container">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#8b5cf6" width="60px" height="60px">
                  <path d="M12,2C17.52,2 22,6.48 22,12C22,17.52 17.52,22 12,22C6.48,22 2,17.52 2,12C2,6.48 6.48,2 12,2Z" fill="none" stroke="#8b5cf6" strokeWidth="2"/>
                  <path d="M8,12L11,15L16,9" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="3" fill="#3b82f6" opacity="0.3"/>
                </svg>
              </div>
              <h3>{t('transparencyTitle')}</h3>
              <p>{t('transparencyText')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="services-section section-animate" id="services">
        <div className="lottie-animation-container-services">
        </div>
        <div className="section-container">
          <div className="section-header">
            <h2>{t('servicesTitle')}</h2>
            <div className="section-divider"></div>
          </div>
          <div className="services-grid-enhanced">
            <div
              className={`service-card-enhanced ${hoveredActivity === 1 ? 'expanded' : ''}`}
            >
              <div className="service-icon-enhanced"><CommunicationIcon /></div>
              <h3>{t('corporateCommunicationTitle')}</h3>
              <p>{t('corporateCommunicationDesc')}</p>
              {hoveredActivity === 1 && (
                <div className="activity-details">
                  <div className="activity-details-columns">
                    <div className="activity-column">
                      <ul>
                        <li>{t('globalComm1')}</li>
                        <li>{t('globalComm2')}</li>
                        <li>{t('globalComm3')}</li>
                        <li>{t('globalComm4')}</li>
                        <li>{t('globalComm5')}</li>
                        <li>{t('globalComm6')}</li>
                      </ul>
                    </div>
                    <div className="activity-column">
                      <ul>
                        <li>{t('globalComm7')}</li>
                        <li>{t('globalComm8')}</li>
                        <li>{t('globalComm9')}</li>
                        <li>{t('globalComm10')}</li>
                        <li>{t('globalComm11')}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              <button
                className="learn-more-btn"
                onClick={() => setHoveredActivity(hoveredActivity === 1 ? null : 1)}
              >
                {hoveredActivity === 1 ? t('showLess') : t('learnMore')}
              </button>
              <div className="card-background-wave"></div>
            </div>
            <div
              className={`service-card-enhanced ${hoveredActivity === 2 ? 'expanded' : ''}`}
            >
              <div className="service-icon-enhanced"><TourismIcon /></div>
              <h3>{t('tourismPromotionTitle')}</h3>
              <p>{t('tourismPromotionDesc')}</p>
              {hoveredActivity === 2 && (
                <div className="activity-details">
                  <div className="activity-details-columns">
                    <div className="activity-column">
                      <ul>
                        <li>{t('marketing1')}</li>
                        <li>{t('marketing2')}</li>
                        <li>{t('marketing3')}</li>
                        <li>{t('marketing4')}</li>
                        <li>{t('marketing5')}</li>
                      </ul>
                    </div>
                    <div className="activity-column">
                      <ul>
                        <li>{t('marketing6')}</li>
                        <li>{t('marketing7')}</li>
                        <li>{t('marketing8')}</li>
                        <li>{t('marketing9')}</li>
                        <li>{t('marketing10')}</li>
                        <li>{t('marketing11')}</li>
                        <li>{t('marketing12')}</li>
                        <li>{t('marketing13')}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              <button
                className="learn-more-btn"
                onClick={() => setHoveredActivity(hoveredActivity === 2 ? null : 2)}
              >
                {hoveredActivity === 2 ? t('showLess') : t('learnMore')}
              </button>
              <div className="card-background-wave"></div>
            </div>
            <div
              className={`service-card-enhanced ${hoveredActivity === 3 ? 'expanded' : ''}`}
            >
              <div className="service-icon-enhanced"><PublicityIcon /></div>
              <h3>{t('publicityProductionTitle')}</h3>
              <p>{t('publicityProductionDesc')}</p>
              {hoveredActivity === 3 && (
                <div className="activity-details">
                  <div className="activity-details-columns">
                    <div className="activity-column">
                      <ul>
                        <li>{t('distribution1')}</li>
                        <li>{t('distribution2')}</li>
                        <li>{t('distribution3')}</li>
                        <li>{t('distribution4')}</li>
                        <li>{t('distribution5')}</li>
                        <li>{t('distribution6')}</li>
                        <li>{t('distribution7')}</li>
                      </ul>
                    </div>
                    <div className="activity-column">
                      <ul>
                        <li>{t('distribution8')}</li>
                        <li>{t('distribution9')}</li>
                        <li>{t('distribution10')}</li>
                        <li>{t('distribution11')}</li>
                        <li>{t('distribution12')}</li>
                        <li>{t('distribution13')}</li>
                        <li>{t('distribution14')}</li>
                        <li>{t('distribution15')}</li>
                        <li>{t('distribution16')}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              <button
                className="learn-more-btn"
                onClick={() => setHoveredActivity(hoveredActivity === 3 ? null : 3)}
              >
                {hoveredActivity === 3 ? t('showLess') : t('learnMore')}
              </button>
              <div className="card-background-wave"></div>
            </div>
          </div>
        </div>
      </section>

      <section className="why-trust-us-section section-animate" id="why-trust">
        <div className="section-container">
          <div className="section-header">
            <h2>{t('whyTrustUsTitle')}</h2>
            <div className="section-divider"></div>
          </div>
          <div className="why-trust-us-grid">
            {trustItems.map((item, index) => (
              <div key={index} className="trust-card">
                <div className="trust-card-icon">{item.icon}</div>
                <h3>{t(item.titleKey)}</h3>
                <p>{t(item.textKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="audio-logs-section section-animate" id="audio-logs">
        <div className="section-container">
          <div className="section-header">
            <h2>{t('audioLogsTitle')}</h2>
            <div className="section-divider"></div>
          </div>
          <div className="audio-logs-grid">
            {[1, 2, 3].map(item => (
              <div key={item} className="audio-log-card">
                <div className="audio-log-icon-placeholder"><PlayIcon /></div>
                <h3>{t('audioLogItemTitlePlaceholder')} {item}</h3>
                <p>{t('audioLogItemDescPlaceholder')}</p>
                <button className="listen-now-btn">{t('listenNowButton')}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="contact-section section-animate" id="contact">
        <div className="section-container">
          <div className="section-header">
            <h2>{t('contactTitle')}</h2>
            <div className="section-divider"></div>
          </div>
          <div className="contact-content">
            <div className="contact-info">
              <div className="contact-item">
                <h3>{t('locationTitle')}</h3>
                <p>Garoua, Cameroon</p>
              </div>
              <div className="contact-item">
                <h3>{t('emailTitle')}</h3>
                <p>contact@proxycom.net</p>
              </div>
              <div className="contact-item">
                <h3>{t('phoneTitle')}</h3>
                <p>+237 6 99 60 99 43</p>
              </div>
            </div>
            <div className="contact-form">
              <h3>{t('messageTitle')}</h3>
              <form>
                <div className="form-group">
                  <input type="text" placeholder={t('namePlaceholder')} />
                </div>
                <div className="form-group">
                  <input type="email" placeholder={t('emailPlaceholder')} />
                </div>
                <div className="form-group">
                  <textarea placeholder={t('messagePlaceholder')}></textarea>
                </div>
                <button type="submit" className="submit-btn">{t('sendMessage')}</button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-logo">
            <img src={logoImg} alt="ProxyCom Logo" className="logo" />
            <p>{t('footerText')}</p>
          </div>
          <div className="footer-links">
            <div className="link-group">
              <h4>{t('companyTitle')}</h4>
              <ul>
                <li><a href="#about">{t('about')}</a></li>
                <li><a href="#services">{t('services')}</a></li>
                <li><a href="#contact">{t('contact')}</a></li>
              </ul>
            </div>
            <div className="link-group">
              <h4>{t('legalTitle')}</h4>
              <ul>
                <li><Link to="/privacy-policy">{t('privacyPolicy')}</Link></li>
                <li><a href="#">{t('termsOfService')}</a></li>
              </ul>
            </div>
            <div className="link-group">
              <h4>{t('connectTitle')}</h4>
              <div className="social-links">
                <a href="#" className="social-icon" title="Facebook">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
                <a href="#" className="social-icon" title="X (Twitter)">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
                <a href="#" className="social-icon" title="Instagram">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
                <a href="#" className="social-icon" title="LinkedIn">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
                <div className="footer-logo-container">
                  <img src={logoImg} alt="ProxyCom Logo" className="footer-main-logo" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>{highlightProxyCom(t('copyright'))}</p>
        </div>
      </footer>

      {showCommProximiteModal && (
        <>
          <div className="communication-overlay" onClick={() => setShowCommProximiteModal(false)}></div>
          <div className="communication-expanded-card">
            <div className="expanded-card-header">
              <div className="info-circle-icon expanded"><CommunicationIcon /></div>
              <div className="expanded-title-section">
                <h2>{t('localCommTitle')}</h2>
                <p>{t('localCommText')}</p>
              </div>
              <button className="close-expanded-btn" onClick={() => setShowCommProximiteModal(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24px" height="24px">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            <div className="expanded-card-body">
              <div className="communication-details">
                <p className="detailed-description">{t('commProximiteDetails')}</p>
                <div className="features-grid">
                  <div className="feature-item">
                    <div className="feature-icon">📻</div>
                    <h4>{t('commFeature1Title')}</h4>
                    <p>{t('commFeature1Desc')}</p>
                  </div>
                  <div className="feature-item">
                    <div className="feature-icon">🎯</div>
                    <h4>{t('commFeature2Title')}</h4>
                    <p>{t('commFeature2Desc')}</p>
                  </div>
                  <div className="feature-item">
                    <div className="feature-icon">🌍</div>
                    <h4>{t('commFeature3Title')}</h4>
                    <p>{t('commFeature3Desc')}</p>
                  </div>
                  <div className="feature-item">
                    <div className="feature-icon">📊</div>
                    <h4>{t('commFeature4Title')}</h4>
                    <p>{t('commFeature4Desc')}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="expanded-card-footer">
              <button className="back-to-website-btn" onClick={() => setShowCommProximiteModal(false)}>
                {t('backToWebsite')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LandingPage; 
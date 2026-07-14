import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // i18n.language can be a regional code like "fr-FR" — match on the prefix.
  const current =
    LANGUAGES.find((lang) => i18n.language?.toLowerCase().startsWith(lang.code)) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng); // the language detector caches the choice in localStorage
    setOpen(false);
  };

  return (
    <div className="language-switcher" ref={rootRef}>
      <button
        type="button"
        className="ls-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change language"
      >
        <span className="ls-flag" aria-hidden="true">{current.flag}</span>
        <span className="ls-code">{current.code.toUpperCase()}</span>
        <svg
          className={`ls-caret ${open ? 'open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <ul className="ls-menu" role="listbox" aria-label="Languages">
          {LANGUAGES.map((lang) => {
            const active = lang.code === current.code;
            return (
              <li key={lang.code} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`ls-option ${active ? 'active' : ''}`}
                  onClick={() => changeLanguage(lang.code)}
                >
                  <span className="ls-flag" aria-hidden="true">{lang.flag}</span>
                  <span className="ls-label">{lang.label}</span>
                  {active && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default LanguageSwitcher;

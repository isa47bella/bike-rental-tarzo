import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'arfanta_cookie_consent';

export default function CookieBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  }

  function refuse() {
    localStorage.setItem(STORAGE_KEY, 'refused');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label={t('cookie.ariaLabel')}>
      <div className="cookie-banner-content">
        <div className="cookie-banner-text">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--primary)' }}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>
            {t('cookie.text')}{' '}
            <Link to="/privacy" className="cookie-link">{t('cookie.privacyLink')}</Link>.
          </span>
        </div>
        <div className="cookie-banner-actions">
          <button className="cookie-btn cookie-btn-secondary" onClick={refuse}>
            {t('cookie.refuse')}
          </button>
          <button className="cookie-btn cookie-btn-primary" onClick={accept}>
            {t('cookie.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useTranslation } from 'react-i18next';

const IconHelmet = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="52" height="52">
    <path d="M32 8C18 8 10 18 10 28v6h44v-6C54 18 46 8 32 8z" strokeWidth="2.5"/>
    <path d="M10 34v4a4 4 0 0 0 4 4h36a4 4 0 0 0 4-4v-4" strokeWidth="2.5"/>
    <line x1="10" y1="34" x2="54" y2="34" strokeWidth="2"/>
    <path d="M24 34V20" strokeWidth="1.5" opacity="0.4"/>
    <path d="M32 34V16" strokeWidth="1.5" opacity="0.4"/>
    <path d="M40 34V20" strokeWidth="1.5" opacity="0.4"/>
    <path d="M14 46h36" strokeWidth="2" strokeDasharray="3 3" opacity="0.35"/>
  </svg>
);

const IconLock = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="52" height="52">
    <rect x="14" y="28" width="36" height="28" rx="4" strokeWidth="2.5"/>
    <path d="M20 28V20a12 12 0 0 1 24 0v8" strokeWidth="2.5"/>
    <circle cx="32" cy="42" r="4" strokeWidth="2.5"/>
    <line x1="32" y1="46" x2="32" y2="50" strokeWidth="2.5"/>
  </svg>
);

const IconKit = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="52" height="52">
    <circle cx="32" cy="32" r="20" strokeWidth="2.5"/>
    <circle cx="32" cy="32" r="10" strokeWidth="2"/>
    <circle cx="32" cy="32" r="3" fill="currentColor" stroke="none"/>
    <line x1="32" y1="12" x2="32" y2="22" strokeWidth="2.5"/>
    <line x1="32" y1="42" x2="32" y2="52" strokeWidth="2.5"/>
    <line x1="12" y1="32" x2="22" y2="32" strokeWidth="2.5"/>
    <line x1="42" y1="32" x2="52" y2="32" strokeWidth="2.5"/>
    <path d="M8 8l6 6" strokeWidth="2" opacity="0.4"/>
    <path d="M50 8l-6 6" strokeWidth="2" opacity="0.4"/>
    <path d="M8 56l6-6" strokeWidth="2" opacity="0.4"/>
    <path d="M56 56l-6-6" strokeWidth="2" opacity="0.4"/>
  </svg>
);

const ACCESSORI = [
  { key: 'casco',    Icon: IconHelmet },
  { key: 'lucchetto', Icon: IconLock  },
  { key: 'kit_foro', Icon: IconKit    },
];

export default function StepAccessori({ booking, onChange, onNext, onBack }) {
  const { t } = useTranslation();
  const selected = booking.accessori || [];

  function toggle(key) {
    const next = selected.includes(key)
      ? selected.filter(k => k !== key)
      : [...selected, key];
    onChange({ accessori: next });
  }

  return (
    <div>
      <h2 className="step-title">{t('stepAccessori.title')}</h2>
      <p className="step-subtitle">{t('stepAccessori.subtitle')}</p>

      <div className="acc-grid">
        {ACCESSORI.map(({ key, Icon }) => {
          const isSel = selected.includes(key);
          return (
            <button
              key={key}
              className={`acc-card${isSel ? ' selected' : ''}`}
              onClick={() => toggle(key)}
              aria-pressed={isSel}
            >
              <div className="acc-icon"><Icon /></div>
              <div className="acc-label">{t(`stepAccessori.items.${key}.label`)}</div>
              <div className="acc-desc">{t(`stepAccessori.items.${key}.desc`)}</div>
              <div className="acc-badge">{t('stepAccessori.included')}</div>
            </button>
          );
        })}
      </div>

      <div className="acc-cauzione-note">
        {t('stepAccessori.cauzioneNote')}
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', textAlign: 'center', marginBottom: 16 }}>
        {t('stepAccessori.skipNote')}
      </p>

      <div className="btn-nav-row">
        <button className="btn btn-secondary" onClick={onBack}>{t('common.back')}</button>
        <button className="btn btn-primary" onClick={onNext}>{t('common.continue')}</button>
      </div>
    </div>
  );
}

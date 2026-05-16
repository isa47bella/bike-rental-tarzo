import { useEffect } from 'react';
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

const ACC_PREZZI = { casco: 2, lucchetto: 1 };

const ACCESSORI = [
  { key: 'casco',     Icon: IconHelmet, price: 2 },
  { key: 'lucchetto', Icon: IconLock,   price: 1 },
];

export default function StepAccessori({ booking, onChange, onNext, onBack }) {
  const { t } = useTranslation();
  const selected  = booking.accessori || [];
  const totalBici = (booking.bici || []).reduce((s, b) => s + b.quantita, 0) || 1;

  // Sync prezzo_totale on mount (handles back-navigation case)
  useEffect(() => {
    const base    = booking.prezzo_base_totale ?? booking.prezzo_base ?? booking.prezzo_totale;
    const accCost = selected.reduce((s, k) => s + (ACC_PREZZI[k] || 0), 0) * totalBici;
    if (booking.prezzo_totale !== base + accCost) {
      onChange({ prezzo_totale: base + accCost });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(key) {
    const next    = selected.includes(key)
      ? selected.filter(k => k !== key)
      : [...selected, key];
    const base    = booking.prezzo_base_totale ?? booking.prezzo_base ?? booking.prezzo_totale;
    const accCost = next.reduce((s, k) => s + (ACC_PREZZI[k] || 0), 0) * totalBici;
    onChange({ accessori: next, prezzo_totale: base + accCost });
  }

  return (
    <div>
      <h2 className="step-title">{t('stepAccessori.title')}</h2>
      <p className="step-subtitle">{t('stepAccessori.subtitle')}</p>

      <div className="acc-grid">
        {ACCESSORI.map(({ key, Icon, price }) => {
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
              <div className="acc-badge">+€{price * totalBici}</div>
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

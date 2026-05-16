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
  const totalBici = (booking.bici || []).reduce((s, b) => s + b.quantita, 0) || 1;

  // Migra legacy `accessori: ['casco']` → `accessori_qty: { casco: totalBici }` se necessario
  const qty = booking.accessori_qty && typeof booking.accessori_qty === 'object'
    ? { casco: Number(booking.accessori_qty.casco) || 0, lucchetto: Number(booking.accessori_qty.lucchetto) || 0 }
    : (booking.accessori || []).reduce((acc, k) => { if (ACC_PREZZI[k]) acc[k] = totalBici; return acc; }, { casco: 0, lucchetto: 0 });

  function computeTotal(nextQty) {
    const base    = booking.prezzo_base_totale ?? booking.prezzo_base ?? booking.prezzo_totale;
    const accCost = Object.entries(nextQty).reduce((s, [k, n]) => s + (ACC_PREZZI[k] || 0) * n, 0);
    return base + accCost;
  }

  // Sync prezzo_totale on mount (handles back-navigation and migration)
  useEffect(() => {
    const newTotal = computeTotal(qty);
    if (booking.prezzo_totale !== newTotal || !booking.accessori_qty) {
      onChange({ accessori_qty: qty, prezzo_totale: newTotal });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function adjust(key, delta) {
    const cur    = qty[key] || 0;
    const newQty = Math.max(0, Math.min(totalBici, cur + delta));
    if (newQty === cur) return;
    const next   = { ...qty, [key]: newQty };
    // Aggiorna anche il campo legacy `accessori` per compat con summary/altri lettori vecchi
    const legacyArr = Object.entries(next).filter(([, n]) => n > 0).map(([k]) => k);
    onChange({ accessori_qty: next, accessori: legacyArr, prezzo_totale: computeTotal(next) });
  }

  return (
    <div>
      <h2 className="step-title">{t('stepAccessori.title')}</h2>
      <p className="step-subtitle">{t('stepAccessori.subtitle')}</p>

      <div className="acc-grid">
        {ACCESSORI.map(({ key, Icon, price }) => {
          const n = qty[key] || 0;
          return (
            <div key={key} className={`acc-card${n > 0 ? ' selected' : ''}`}>
              <div className="acc-icon"><Icon /></div>
              <div className="acc-label">{t(`stepAccessori.items.${key}.label`)}</div>
              <div className="acc-desc">{t(`stepAccessori.items.${key}.desc`)}</div>
              <div className="acc-badge">+€{price} {t('stepAccessori.each', 'cad.')}</div>
              <div className="acc-qty">
                <button
                  type="button"
                  className="acc-qty-btn"
                  onClick={() => adjust(key, -1)}
                  disabled={n === 0}
                  aria-label={`Rimuovi ${key}`}
                >−</button>
                <span className="acc-qty-val">{n}</span>
                <button
                  type="button"
                  className="acc-qty-btn"
                  onClick={() => adjust(key, +1)}
                  disabled={n >= totalBici}
                  aria-label={`Aggiungi ${key}`}
                >+</button>
              </div>
              {n > 0 && (
                <div className="acc-line-total">+€{price * n}</div>
              )}
            </div>
          );
        })}
      </div>

      {totalBici > 1 && (
        <p className="acc-hint">
          {t('stepAccessori.maxHint', { count: totalBici, defaultValue: `Max ${totalBici} per tipo (1 per bici)` })}
        </p>
      )}

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

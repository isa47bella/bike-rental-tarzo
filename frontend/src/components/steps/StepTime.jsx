import { useTranslation } from 'react-i18next';

const ORARI = ['08:00','08:15','08:30','08:45','09:00','09:15','09:30','09:45','10:00'];

function formatDate(dateStr, locale) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

const LOCALE_MAP = { it: 'it-IT', en: 'en-GB', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' };

export default function StepTime({ booking, onChange, onNext, onBack }) {
  const { t, i18n } = useTranslation();
  const locale = LOCALE_MAP[i18n.language] || 'it-IT';

  return (
    <div>
      <h2 className="step-title">{t('stepTime.title')}</h2>
      <p className="step-subtitle">{formatDate(booking.data_ritiro, locale)}</p>

      <div style={{
        background: 'var(--verde-pale2)',
        border: '1px solid #b7e4c7',
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 20,
        fontSize: '0.85rem',
        color: 'var(--text-light)',
      }}
        dangerouslySetInnerHTML={{ __html: '🕗 ' + t('stepTime.info') }}
      />

      <div className="time-grid">
        {ORARI.map(orario => (
          <button
            key={orario}
            className={`time-slot${booking.orario_ritiro === orario ? ' selected' : ''}`}
            onClick={() => onChange({ orario_ritiro: orario })}
          >
            {orario}
          </button>
        ))}
      </div>

      <div className="btn-nav-row">
        <button className="btn btn-secondary" onClick={onBack}>{t('common.back')}</button>
        <button className="btn btn-primary" onClick={onNext} disabled={!booking.orario_ritiro}>
          {t('common.continue')}
        </button>
      </div>
    </div>
  );
}

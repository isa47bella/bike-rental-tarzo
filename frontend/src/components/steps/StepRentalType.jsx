import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api.js';

const TIPO_IDS = ['4_ore', 'intera_giornata', '3_piu_giorni'];
const TIPO_ICONS = { '4_ore': '🌅', 'intera_giornata': '☀️', '3_piu_giorni': '🗓️' };
const TIPO_PREZZI = { '4_ore': 30, 'intera_giornata': 50, '3_piu_giorni': null };

const LOCALE_MAP = { it: 'it-IT', en: 'en-GB', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' };

function formatDate(dateStr, locale) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function StepRentalType({ booking, onChange, onNext, onBack }) {
  const { t, i18n } = useTranslation();
  const locale = LOCALE_MAP[i18n.language] || 'it-IT';

  const [giorni, setGiorni] = useState(booking.giorni || 3);
  const [restituzione, setRestituzione] = useState(null);
  const [loadingRest, setLoadingRest]   = useState(false);

  const tipoSelezionato = booking.tipo_noleggio;

  useEffect(() => {
    if (!booking.data_ritiro || !booking.orario_ritiro || !tipoSelezionato) return;
    const g = tipoSelezionato === '3_piu_giorni' ? giorni : 1;
    calcola(booking.data_ritiro, booking.orario_ritiro, tipoSelezionato, g);
  }, [booking.data_ritiro, booking.orario_ritiro, tipoSelezionato, giorni]);

  async function calcola(data, orario, tipo, g) {
    setLoadingRest(true);
    try {
      const res = await api.calcolaRestituzione(data, orario, tipo, g);
      setRestituzione(res);
    } catch {
      setRestituzione(null);
    } finally {
      setLoadingRest(false);
    }
  }

  function selectTipo(tipoId) {
    const g = tipoId === '3_piu_giorni' ? giorni : 1;
    const prezzo = tipoId === '3_piu_giorni' ? 45 * g : TIPO_PREZZI[tipoId];
    onChange({ tipo_noleggio: tipoId, giorni: g, prezzo_totale: prezzo });
  }

  function handleGiorni(val) {
    const g = Math.max(3, Math.min(7, Number(val)));
    setGiorni(g);
    onChange({ giorni: g, prezzo_totale: 45 * g });
  }

  return (
    <div>
      <h2 className="step-title">{t('stepRentalType.title')}</h2>
      <p className="step-subtitle"
        dangerouslySetInnerHTML={{ __html: t('stepRentalType.subtitle', {
          time: booking.orario_ritiro,
          date: formatDate(booking.data_ritiro, locale),
        })}}
      />

      <div className="option-grid" style={{ marginBottom: 20 }}>
        {TIPO_IDS.map(tipoId => {
          const tipo = t(`stepRentalType.types.${tipoId}`, { returnObjects: true });
          return (
            <button
              key={tipoId}
              className={`option-card${tipoSelezionato === tipoId ? ' selected' : ''}`}
              onClick={() => selectTipo(tipoId)}
            >
              <div className="opt-icon">{TIPO_ICONS[tipoId]}</div>
              <div className="opt-title">{tipo.title}</div>
              <div className="opt-detail">{tipo.detail}</div>
              <div className="opt-price">{tipo.price}</div>
            </button>
          );
        })}
      </div>

      {tipoSelezionato === '3_piu_giorni' && (
        <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
          <label style={{ fontWeight: 700, marginBottom: 10, display: 'block' }}>
            {t('stepRentalType.returnLabel')}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button className="cal-nav-btn" onClick={() => handleGiorni(giorni - 1)} disabled={giorni <= 3}>−</button>
            <span style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--verde)', minWidth: 40, textAlign: 'center' }}>
              {giorni}
            </span>
            <button className="cal-nav-btn" onClick={() => handleGiorni(giorni + 1)} disabled={giorni >= 7}>+</button>
            <span style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}
              dangerouslySetInnerHTML={{ __html: t('stepRentalType.totalDays', { price: 45 * giorni }) }}
            />
          </div>
        </div>
      )}

      {tipoSelezionato && (
        <div style={{ background: 'var(--verde-pale)', border: '1px solid #b7e4c7', borderRadius: 8, padding: '14px 16px', fontSize: '0.88rem', marginBottom: 8 }}>
          {loadingRest ? (
            <span style={{ color: 'var(--text-light)' }}>{t('stepRentalType.calculating')}</span>
          ) : restituzione ? (
            <span dangerouslySetInnerHTML={{ __html: t('stepRentalType.returnInfo', {
              date: formatDate(restituzione.data_restituzione, locale),
              time: restituzione.orario_restituzione,
            })}} />
          ) : null}
        </div>
      )}

      <div className="btn-nav-row">
        <button className="btn btn-secondary" onClick={onBack}>{t('common.back')}</button>
        <button className="btn btn-primary" onClick={onNext} disabled={!tipoSelezionato}>
          {t('common.continue')}
        </button>
      </div>
    </div>
  );
}

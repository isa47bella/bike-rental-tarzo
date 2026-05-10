import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const LOCALE_MAP = { it: 'it-IT', en: 'en-GB', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' };

const PREZZI = {
  ecity: { mezza: 35, intera: 45, multi: { 2:84,3:120,4:152,5:180,6:205,7:225 }, extra: 20 },
  emtb:  { mezza: 35, intera: 45, multi: { 2:84,3:120,4:152,5:180,6:205,7:225 }, extra: 20 },
  bimbo: { mezza: 28, intera: 40, multi: { 2:75,3:107,4:136,5:163,6:187,7:208 }, extra: 20 },
};

function calcolaPrezzo(bike_type, tipo_noleggio, giorni) {
  const p = PREZZI[bike_type];
  if (!p) return 0;
  if (tipo_noleggio === 'mezza_mattina' || tipo_noleggio === 'mezza_pomeriggio') return p.mezza;
  if (tipo_noleggio === 'intera_giornata') return p.intera;
  if (tipo_noleggio === 'multi_giorno') {
    const n = Number(giorni);
    if (n >= 2 && n <= 7) return p.multi[n] || 0;
    if (n > 7) return (p.multi[7] || 0) + (n - 7) * p.extra;
  }
  return 0;
}

function calcolaRestituzione(data_ritiro, tipo_noleggio, giorni) {
  if (tipo_noleggio === 'mezza_mattina')    return { data: data_ritiro, orario: '13:00', ritiro: '09:00' };
  if (tipo_noleggio === 'mezza_pomeriggio') return { data: data_ritiro, orario: '18:00', ritiro: '14:00' };
  if (tipo_noleggio === 'intera_giornata')  return { data: data_ritiro, orario: '18:00', ritiro: '09:00' };
  if (tipo_noleggio === 'multi_giorno') {
    const base = new Date(data_ritiro + 'T00:00:00');
    base.setDate(base.getDate() + Number(giorni) - 1);
    return { data: base.toISOString().substring(0,10), orario: '18:00', ritiro: '09:00' };
  }
  return null;
}

function formatDate(dateStr, locale) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function StepRentalType({ booking, onChange, onNext, onBack }) {
  const { t, i18n } = useTranslation();
  const locale       = LOCALE_MAP[i18n.language] || 'it-IT';
  const [giorni, setGiorni] = useState(booking.giorni >= 2 ? booking.giorni : 2);

  const tipoSel = booking.tipo_noleggio;

  const TIPI = [
    { id: 'mezza_mattina',    icon: '🌅', label: t('stepRentalType.types.mezza_mattina.title'),    detail: '09:00 – 13:00',             price: calcolaPrezzo(booking.bike_type, 'mezza_mattina', 1)    },
    { id: 'mezza_pomeriggio', icon: '🌤️', label: t('stepRentalType.types.mezza_pomeriggio.title'), detail: '14:00 – 18:00',             price: calcolaPrezzo(booking.bike_type, 'mezza_pomeriggio', 1) },
    { id: 'intera_giornata',  icon: '☀️', label: t('stepRentalType.types.intera_giornata.title'),  detail: '09:00 – 18:00',             price: calcolaPrezzo(booking.bike_type, 'intera_giornata', 1)  },
    { id: 'multi_giorno',     icon: '🗓️', label: t('stepRentalType.types.multi_giorno.title'),     detail: t('stepRentalType.types.multi_giorno.detail'), price: null },
  ];

  function selectTipo(id) {
    const g      = id === 'multi_giorno' ? giorni : 1;
    const prezzo = calcolaPrezzo(booking.bike_type, id, g);
    const rest   = calcolaRestituzione(booking.data_ritiro, id, g);
    onChange({
      tipo_noleggio:       id,
      giorni:              g,
      prezzo_totale:       prezzo,
      orario_ritiro:       rest ? rest.ritiro : null,
      data_restituzione:   rest ? rest.data   : null,
      orario_restituzione: rest ? rest.orario : null,
    });
  }

  function handleGiorni(val) {
    const g      = Math.max(2, Math.min(30, Number(val)));
    setGiorni(g);
    if (tipoSel === 'multi_giorno') {
      const prezzo = calcolaPrezzo(booking.bike_type, 'multi_giorno', g);
      const rest   = calcolaRestituzione(booking.data_ritiro, 'multi_giorno', g);
      onChange({
        giorni:              g,
        prezzo_totale:       prezzo,
        data_restituzione:   rest ? rest.data   : null,
        orario_restituzione: rest ? rest.orario : null,
      });
    }
  }

  const rest = tipoSel ? calcolaRestituzione(booking.data_ritiro, tipoSel, tipoSel === 'multi_giorno' ? giorni : 1) : null;
  const prezzoCorrente = tipoSel ? calcolaPrezzo(booking.bike_type, tipoSel, tipoSel === 'multi_giorno' ? giorni : 1) : 0;

  return (
    <div>
      <h2 className="step-title">{t('stepRentalType.title')}</h2>
      <p className="step-subtitle"
        dangerouslySetInnerHTML={{ __html: t('stepRentalType.subtitle', { bike: booking.bike_nome, date: formatDate(booking.data_ritiro, locale) }) }}
      />

      <div className="option-grid" style={{ marginBottom: 16 }}>
        {TIPI.map(tipo => (
          <button
            key={tipo.id}
            className={`option-card${tipoSel === tipo.id ? ' selected' : ''}`}
            onClick={() => selectTipo(tipo.id)}
          >
            <div className="opt-icon">{tipo.icon}</div>
            <div className="opt-title">{tipo.label}</div>
            <div className="opt-detail">{tipo.detail}</div>
            <div className="opt-price">
              {tipo.price !== null ? `€${tipo.price}` : t('stepRentalType.types.multi_giorno.price', { price: calcolaPrezzo(booking.bike_type, 'multi_giorno', giorni) })}
            </div>
          </button>
        ))}
      </div>

      {tipoSel === 'multi_giorno' && (
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          <label style={{ fontWeight: 700, marginBottom: 10, display: 'block' }}>
            {t('stepRentalType.daysLabel')}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button className="cal-nav-btn" onClick={() => handleGiorni(giorni - 1)} disabled={giorni <= 2}>−</button>
            <span style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary)', minWidth: 40, textAlign: 'center' }}>
              {giorni}
            </span>
            <button className="cal-nav-btn" onClick={() => handleGiorni(giorni + 1)} disabled={giorni >= 30}>+</button>
            <span style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>
              {t('stepRentalType.daysCount', { n: giorni })} — <strong>€{calcolaPrezzo(booking.bike_type, 'multi_giorno', giorni)}</strong>
            </span>
          </div>
        </div>
      )}

      {tipoSel && rest && (
        <div style={{ background: 'var(--verde-pale)', border: '1px solid #b7e4c7', borderRadius: 8, padding: '12px 16px', fontSize: '0.88rem', marginBottom: 8 }}>
          <span dangerouslySetInnerHTML={{ __html: t('stepRentalType.returnInfo', {
            date:   formatDate(rest.data, locale),
            time:   rest.orario,
            price:  prezzoCorrente,
          })}} />
        </div>
      )}

      <div className="btn-nav-row">
        <button className="btn btn-secondary" onClick={onBack}>{t('common.back')}</button>
        <button className="btn btn-primary" onClick={onNext} disabled={!tipoSel}>
          {t('common.continue')}
        </button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api.js';

const LOCALE_MAP = { it: 'it-IT', en: 'en-GB', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' };

function formatDate(dateStr, locale) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function StepSummary({ booking, onBack }) {
  const { t, i18n } = useTranslation();
  const locale = LOCALE_MAP[i18n.language] || 'it-IT';
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const { url } = await api.checkout({ ...booking, lingua: i18n.language });
      window.location.href = url;
    } catch (e) {
      setError(e.message || 'Errore durante il pagamento. Riprova.');
      setLoading(false);
    }
  }

  const tipoLabel = t(`stepSummary.types.${booking.tipo_noleggio}`) || booking.tipo_noleggio;

  return (
    <div>
      <h2 className="step-title">{t('stepSummary.title')}</h2>
      <p className="step-subtitle">{t('stepSummary.subtitle')}</p>

      <div className="summary-box">
        <div className="summary-row">
          <span className="label">{t('stepSummary.fields.type')}</span>
          <span className="value">{tipoLabel}</span>
        </div>
        {booking.tipo_noleggio === 'multi_giorno' && (
          <div className="summary-row">
            <span className="label">{t('stepSummary.fields.days')}</span>
            <span className="value">{t('stepSummary.fields.daysValue', { n: booking.giorni })}</span>
          </div>
        )}
        <div className="summary-row">
          <span className="label">{t('stepSummary.fields.pickupDay')}</span>
          <span className="value">{formatDate(booking.data_ritiro, locale)}</span>
        </div>
        <div className="summary-row">
          <span className="label">{t('stepSummary.fields.pickupTime')}</span>
          <span className="value">{booking.orario_ritiro}</span>
        </div>
        <div className="summary-row">
          <span className="label">{t('stepSummary.fields.returnDay')}</span>
          <span className="value">{formatDate(booking.data_restituzione, locale)}</span>
        </div>
        <div className="summary-row">
          <span className="label">{t('stepSummary.fields.returnTime')}</span>
          <span className="value">{booking.orario_restituzione}</span>
        </div>
        <div className="summary-row">
          <span className="label">{t('stepSummary.fields.bike')}</span>
          <span className="value">{booking.bike_nome || booking.modello_nome || `Bici #${booking.bicicletta_id}`}</span>
        </div>
        <div className="summary-row">
          <span className="label">{t('stepSummary.fields.accessories')}</span>
          <span className="value">
            {booking.accessori && booking.accessori.length > 0
              ? booking.accessori.map(k => t(`stepAccessori.items.${k}.label`)).join(', ')
              : t('stepSummary.fields.noAccessories')}
          </span>
        </div>
        <div className="summary-row">
          <span className="label">{t('stepSummary.fields.customer')}</span>
          <span className="value">{booking.cliente_nome}</span>
        </div>
        <div className="summary-row">
          <span className="label">{t('stepSummary.fields.email')}</span>
          <span className="value" style={{ fontSize: '0.85rem' }}>{booking.cliente_email}</span>
        </div>
        <div className="summary-row">
          <span className="label">{t('stepSummary.fields.phone')}</span>
          <span className="value">{booking.cliente_telefono}</span>
        </div>
        <div className="summary-row total">
          <span className="label" style={{ fontWeight: 700 }}>{t('stepSummary.fields.total')}</span>
          <span className="value">€{Number(booking.prezzo_totale).toFixed(2)}</span>
        </div>
      </div>

      <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: '12px 16px', marginBottom: 12, fontSize: '0.85rem', color: '#7d5a00' }}
        dangerouslySetInnerHTML={{ __html: t('stepSummary.paymentInfo') }}
      />

      <div style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: '0.85rem', color: '#3730a3' }}
        dangerouslySetInnerHTML={{ __html: t('stepSummary.depositInfo') }}
      />

      {error && (
        <div style={{ background: '#fce4e4', border: '1px solid #e57373', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#c0392b', fontSize: '0.9rem' }}>
          ⚠️ {error}
        </div>
      )}

      <div className="btn-nav-row">
        <button className="btn btn-secondary" onClick={onBack} disabled={loading}>
          {t('stepSummary.modify')}
        </button>
        <button className="btn btn-primary" onClick={handlePay} disabled={loading} style={{ fontSize: '1.05rem' }}>
          {loading ? t('stepSummary.processing') : t('stepSummary.pay', { amount: Number(booking.prezzo_totale).toFixed(2) })}
        </button>
      </div>

      <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#999', marginTop: 16 }}>
        {t('stepSummary.secureNote')}
      </p>
    </div>
  );
}

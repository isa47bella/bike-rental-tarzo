import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api.js';

const LOCALE_MAP = { it: 'it-IT', en: 'en-GB', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' };

function formatDate(dateStr, locale) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

const IconCheck = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/>
  </svg>
);

const IconClock2 = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
  </svg>
);

export default function SuccessPage() {
  const { t, i18n } = useTranslation();
  const locale = LOCALE_MAP[i18n.language] || 'it-IT';
  const [searchParams] = useSearchParams();
  const sessionId      = searchParams.get('session_id');
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const data = await api.getBySession(sessionId);
        setBooking(data);
        setLoading(false);
        clearInterval(interval);
      } catch {
        if (attempts >= 6) {
          setError(t('success.paymentNote'));
          setLoading(false);
          clearInterval(interval);
        }
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [sessionId]);

  if (loading) return (
    <div className="result-page">
      <div className="result-card">
        <div className="result-icon"><IconClock2 /></div>
        <h1>{t('success.confirming')}</h1>
        <p>{t('success.wait')}</p>
        <div className="spinner" />
      </div>
    </div>
  );

  const tipoLabel = booking ? (t(`stepSummary.types.${booking.tipo_noleggio}`) || booking.tipo_noleggio) : '';

  return (
    <div className="result-page">
      <div className="result-card">
        <div className="result-icon"><IconCheck /></div>
        <h1 style={{ color: 'var(--success)' }}>{t('success.title')}</h1>

        {error ? (
          <p>{error}</p>
        ) : booking ? (
          <>
            <p dangerouslySetInnerHTML={{ __html: t('success.thanks', { name: booking.cliente_nome, email: booking.cliente_email }) }} />

            <div style={{ background: 'var(--primary-pale)', border: '1px solid var(--primary-light)', borderRadius: 8, padding: '16px 20px', textAlign: 'left', marginBottom: 16, fontSize: '0.9rem' }}>
              {[
                [t('success.fields.code'),   booking.id.toUpperCase().substring(0, 8)],
                [t('success.fields.type'),   tipoLabel],
                [t('success.fields.pickup'), `${formatDate(booking.data_ritiro, locale)} ${booking.orario_ritiro?.substring(0,5)}`],
                [t('success.fields.return'), `${formatDate(booking.data_restituzione, locale)} ${booking.orario_restituzione?.substring(0,5)}`],
                [t('success.fields.where'),  t('success.whereValue')],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--text-light)', fontWeight: 500, minWidth: 100, fontSize: '0.85rem' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--warning-bg)', borderRadius: 8, padding: '12px 16px', fontSize: '0.82rem', color: 'var(--warning)', marginBottom: 24, textAlign: 'left' }}
              dangerouslySetInnerHTML={{ __html: t('success.bringDocs', { code: booking.id.toUpperCase().substring(0, 8) }) }}
            />
          </>
        ) : (
          <p style={{ marginBottom: 24 }}>{t('success.checkEmail')}</p>
        )}

        <Link to="/" className="btn btn-primary btn-full">{t('success.newBooking')}</Link>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';

function formatDateIT(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function tipoLabel(tipo) {
  const labels = {
    '4_ore':           'Noleggio 4 Ore',
    'intera_giornata': 'Noleggio Intera Giornata',
    '3_piu_giorni':    'Noleggio Multi-Giorno',
  };
  return labels[tipo] || tipo;
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
          setError('Pagamento ricevuto. Controlla la tua email per la conferma.');
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
        <h1>Confermando il pagamento…</h1>
        <p>Attendere qualche secondo</p>
        <div className="spinner" />
      </div>
    </div>
  );

  return (
    <div className="result-page">
      <div className="result-card">
        <div className="result-icon"><IconCheck /></div>
        <h1 style={{ color: 'var(--success)' }}>Prenotazione Confermata!</h1>

        {error ? (
          <p>{error}</p>
        ) : booking ? (
          <>
            <p>
              Grazie <strong>{booking.cliente_nome}</strong>!<br />
              Hai ricevuto la conferma su <strong>{booking.cliente_email}</strong>
            </p>

            <div style={{
              background: 'var(--primary-pale)',
              border: '1px solid var(--primary-light)',
              borderRadius: 8,
              padding: '16px 20px',
              textAlign: 'left',
              marginBottom: 16,
              fontSize: '0.9rem',
            }}>
              {[
                ['Codice',        booking.id.toUpperCase().substring(0, 8)],
                ['Tipo',          tipoLabel(booking.tipo_noleggio)],
                ['Ritiro',        `${formatDateIT(booking.data_ritiro)} ore ${booking.orario_ritiro?.substring(0,5)}`],
                ['Restituzione',  `${formatDateIT(booking.data_restituzione)} ore ${booking.orario_restituzione?.substring(0,5)}`],
                ['Dove',          'Via Pecol 22, Arfanta di Tarzo (TV)'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--text-light)', fontWeight: 500, minWidth: 100, fontSize: '0.85rem' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{
              background: 'var(--warning-bg)',
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: '0.82rem',
              color: 'var(--warning)',
              marginBottom: 24,
              textAlign: 'left',
            }}>
              <strong>Al ritiro porta:</strong> documento identità + codice <strong>{booking.id.toUpperCase().substring(0, 8)}</strong>
            </div>
          </>
        ) : (
          <p style={{ marginBottom: 24 }}>
            Pagamento ricevuto con successo!<br />
            Controlla la tua email per i dettagli.
          </p>
        )}

        <Link to="/" className="btn btn-primary btn-full">
          Nuova Prenotazione
        </Link>
      </div>
    </div>
  );
}

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

export default function SuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId      = searchParams.get('session_id');
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }

    // Poll fino a quando la prenotazione è confermata
    // (il webhook potrebbe impiegare 1-2 secondi)
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
        <div className="result-icon">⏳</div>
        <h1>Confermando il pagamento...</h1>
        <p>Attendere qualche secondo</p>
        <div className="spinner" />
      </div>
    </div>
  );

  return (
    <div className="result-page">
      <div className="result-card">
        <div className="result-icon">✅</div>
        <h1 style={{ color: 'var(--verde)' }}>Prenotazione Confermata!</h1>

        {error ? (
          <p>{error}</p>
        ) : booking ? (
          <>
            <p>
              Grazie <strong>{booking.cliente_nome}</strong>!<br />
              Hai ricevuto la conferma su <strong>{booking.cliente_email}</strong>
            </p>

            <div style={{
              background: 'var(--verde-pale)',
              borderRadius: 8,
              padding: '16px 20px',
              textAlign: 'left',
              marginBottom: 24,
              fontSize: '0.9rem',
            }}>
              <div style={{ marginBottom: 6 }}>
                <strong>📋 Codice:</strong>{' '}
                <span style={{ fontWeight: 700, letterSpacing: 2, color: 'var(--verde)' }}>
                  {booking.id.toUpperCase().substring(0, 8)}
                </span>
              </div>
              <div style={{ marginBottom: 6 }}>
                <strong>🚲 Tipo:</strong> {tipoLabel(booking.tipo_noleggio)}
              </div>
              <div style={{ marginBottom: 6 }}>
                <strong>📅 Ritiro:</strong> {formatDateIT(booking.data_ritiro)} ore {booking.orario_ritiro?.substring(0,5)}
              </div>
              <div style={{ marginBottom: 6 }}>
                <strong>📅 Restituzione:</strong> {formatDateIT(booking.data_restituzione)} ore {booking.orario_restituzione?.substring(0,5)}
              </div>
              <div>
                <strong>📍 Dove:</strong> Via Pecol 22, Arfanta di Tarzo (TV)
              </div>
            </div>

            <div style={{
              background: '#fff8e1',
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: '0.82rem',
              color: '#7d5a00',
              marginBottom: 24,
              textAlign: 'left',
            }}>
              <strong>✅ Al ritiro porta:</strong><br />
              Documento identità + codice prenotazione <strong>{booking.id.toUpperCase().substring(0, 8)}</strong>
            </div>
          </>
        ) : (
          <p>
            Pagamento ricevuto con successo!<br />
            Controlla la tua email per i dettagli della prenotazione.
          </p>
        )}

        <Link to="/" className="btn btn-primary btn-full">
          🚲 Nuova Prenotazione
        </Link>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { api } from '../../lib/api.js';

function formatDateIT(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}

function tipoLabel(tipo) {
  const labels = {
    '4_ore':           'Noleggio 4 Ore',
    'intera_giornata': 'Noleggio Intera Giornata',
    '3_piu_giorni':    'Noleggio Multi-Giorno',
  };
  return labels[tipo] || tipo;
}

export default function StepSummary({ booking, onBack }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const { url } = await api.checkout(booking);
      // Redirect a Stripe Checkout
      window.location.href = url;
    } catch (e) {
      setError(e.message || 'Errore durante il pagamento. Riprova.');
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="step-title">Riepilogo prenotazione</h2>
      <p className="step-subtitle">Controlla i dettagli e procedi al pagamento</p>

      <div className="summary-box">
        <div className="summary-row">
          <span className="label">🚲 Tipo noleggio</span>
          <span className="value">{tipoLabel(booking.tipo_noleggio)}</span>
        </div>
        {booking.tipo_noleggio === '3_piu_giorni' && (
          <div className="summary-row">
            <span className="label">📆 Numero giorni</span>
            <span className="value">{booking.giorni} giorni</span>
          </div>
        )}
        <div className="summary-row">
          <span className="label">📅 Giorno ritiro</span>
          <span className="value">{formatDateIT(booking.data_ritiro)}</span>
        </div>
        <div className="summary-row">
          <span className="label">🕗 Orario ritiro</span>
          <span className="value">{booking.orario_ritiro}</span>
        </div>
        <div className="summary-row">
          <span className="label">📅 Giorno restituzione</span>
          <span className="value">{formatDateIT(booking.data_restituzione)}</span>
        </div>
        <div className="summary-row">
          <span className="label">🕔 Orario restituzione</span>
          <span className="value">{booking.orario_restituzione}</span>
        </div>
        <div className="summary-row">
          <span className="label">🚲 Bicicletta</span>
          <span className="value">Bicicletta #{booking.bicicletta_id} (Papin Sport)</span>
        </div>
        <div className="summary-row">
          <span className="label">👤 Cliente</span>
          <span className="value">{booking.cliente_nome}</span>
        </div>
        <div className="summary-row">
          <span className="label">📧 Email</span>
          <span className="value" style={{ fontSize: '0.85rem' }}>{booking.cliente_email}</span>
        </div>
        <div className="summary-row">
          <span className="label">📱 Telefono</span>
          <span className="value">{booking.cliente_telefono}</span>
        </div>
        <div className="summary-row total">
          <span className="label" style={{ fontWeight: 700 }}>💶 Totale</span>
          <span className="value">€{Number(booking.prezzo_totale).toFixed(2)}</span>
        </div>
      </div>

      <div style={{
        background: '#fff8e1',
        border: '1px solid #ffe082',
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 20,
        fontSize: '0.85rem',
        color: '#7d5a00',
      }}>
        💳 Il pagamento è <strong>100% anticipato</strong> tramite Stripe (carta di credito/debito).
        Riceverai conferma via email subito dopo il pagamento.
      </div>

      {error && (
        <div style={{
          background: '#fce4e4',
          border: '1px solid #e57373',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          color: '#c0392b',
          fontSize: '0.9rem',
        }}>
          ⚠️ {error}
        </div>
      )}

      <div className="btn-nav-row">
        <button className="btn btn-secondary" onClick={onBack} disabled={loading}>
          ← Modifica
        </button>
        <button
          className="btn btn-primary"
          onClick={handlePay}
          disabled={loading}
          style={{ fontSize: '1.05rem' }}
        >
          {loading ? '⏳ Elaborazione...' : `💳 Paga €${Number(booking.prezzo_totale).toFixed(2)}`}
        </button>
      </div>

      <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#999', marginTop: 16 }}>
        🔒 Pagamento sicuro gestito da Stripe — Non salviamo i dati della carta
      </p>
    </div>
  );
}

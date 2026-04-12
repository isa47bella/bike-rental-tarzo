import { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';

const TIPI = [
  {
    id:          '4_ore',
    icon:        '🌅',
    titolo:      'Noleggio 4 Ore',
    dettaglio:   'Mattina — Restituzione 12:00–13:00',
    prezzo:      '€30',
    prezzoNum:   30,
    giorni:      1,
  },
  {
    id:          'intera_giornata',
    icon:        '☀️',
    titolo:      'Intera Giornata',
    dettaglio:   'Restituzione 16:00–18:00',
    prezzo:      '€50',
    prezzoNum:   50,
    giorni:      1,
  },
  {
    id:          '3_piu_giorni',
    icon:        '🗓️',
    titolo:      '3+ Giorni',
    dettaglio:   'Restituzione stesso orario',
    prezzo:      '€45/giorno',
    prezzoNum:   null,
    giorni:      null, // scelti dall'utente
  },
];

export default function StepRentalType({ booking, onChange, onNext, onBack }) {
  const [giorni, setGiorni] = useState(booking.giorni || 3);
  const [restituzione, setRestituzione] = useState(null);
  const [loadingRest, setLoadingRest]   = useState(false);

  const tipoSelezionato = booking.tipo_noleggio;

  // Quando cambiano data+orario+tipo+giorni, ricalcola la restituzione
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

  function selectTipo(tipo) {
    const g = tipo.id === '3_piu_giorni' ? giorni : tipo.giorni;
    const prezzo = tipo.id === '3_piu_giorni' ? 45 * g : tipo.prezzoNum;
    onChange({
      tipo_noleggio:  tipo.id,
      giorni:         g,
      prezzo_totale:  prezzo,
    });
  }

  function handleGiorni(val) {
    const g      = Math.max(3, Math.min(7, Number(val)));
    const prezzo = 45 * g;
    setGiorni(g);
    onChange({ giorni: g, prezzo_totale: prezzo });
  }

  function formatDateIT(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  return (
    <div>
      <h2 className="step-title">Tipo di noleggio</h2>
      <p className="step-subtitle">
        Ritiro: <strong>{booking.orario_ritiro}</strong> del{' '}
        <strong>{formatDateIT(booking.data_ritiro)}</strong>
      </p>

      <div className="option-grid" style={{ marginBottom: 20 }}>
        {TIPI.map(tipo => (
          <button
            key={tipo.id}
            className={`option-card${tipoSelezionato === tipo.id ? ' selected' : ''}`}
            onClick={() => selectTipo(tipo)}
          >
            <div className="opt-icon">{tipo.icon}</div>
            <div className="opt-title">{tipo.titolo}</div>
            <div className="opt-detail">{tipo.dettaglio}</div>
            <div className="opt-price">{tipo.prezzo}</div>
          </button>
        ))}
      </div>

      {/* Selezione numero giorni (solo per 3+ giorni) */}
      {tipoSelezionato === '3_piu_giorni' && (
        <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
          <label style={{ fontWeight: 700, marginBottom: 10, display: 'block' }}>
            Numero di giorni
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              className="cal-nav-btn"
              onClick={() => handleGiorni(giorni - 1)}
              disabled={giorni <= 3}
            >−</button>
            <span style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--verde)', minWidth: 40, textAlign: 'center' }}>
              {giorni}
            </span>
            <button
              className="cal-nav-btn"
              onClick={() => handleGiorni(giorni + 1)}
              disabled={giorni >= 7}
            >+</button>
            <span style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>
              giorni — <strong style={{ color: 'var(--accent)' }}>€{45 * giorni}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Riepilogo restituzione */}
      {tipoSelezionato && (
        <div style={{
          background: 'var(--verde-pale)',
          border: '1px solid #b7e4c7',
          borderRadius: 8,
          padding: '14px 16px',
          fontSize: '0.88rem',
          marginBottom: 8,
        }}>
          {loadingRest ? (
            <span style={{ color: 'var(--text-light)' }}>Calcolo restituzione...</span>
          ) : restituzione ? (
            <>
              🔄 <strong>Restituzione:</strong>{' '}
              {formatDateIT(restituzione.data_restituzione)}{' '}
              alle <strong>{restituzione.orario_restituzione}</strong>
            </>
          ) : null}
        </div>
      )}

      <div className="btn-nav-row">
        <button className="btn btn-secondary" onClick={onBack}>← Indietro</button>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!tipoSelezionato}
        >
          Continua →
        </button>
      </div>
    </div>
  );
}

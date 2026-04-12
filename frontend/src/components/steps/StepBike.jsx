import { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';

const TOTAL = 5;

export default function StepBike({ booking, onChange, onNext, onBack }) {
  const [disponibili, setDisponibili] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error,   setError]           = useState(null);

  useEffect(() => {
    if (booking.data_ritiro && booking.orario_ritiro && booking.tipo_noleggio) {
      checkAvailability();
    }
  }, [booking.data_ritiro, booking.orario_ritiro, booking.tipo_noleggio, booking.giorni]);

  async function checkAvailability() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAvailability(
        booking.data_ritiro,
        booking.orario_ritiro,
        booking.tipo_noleggio,
        booking.giorni || 1
      );
      setDisponibili(res.bici_ids || []);
      // Se la bici precedentemente scelta è ora occupata, deseleziona
      if (booking.bicicletta_id && !res.bici_ids.includes(booking.bicicletta_id)) {
        onChange({ bicicletta_id: null });
      }
    } catch (e) {
      setError('Impossibile verificare disponibilità. Riprova.');
      // In caso di errore mostra tutte disponibili
      setDisponibili([1,2,3,4,5]);
    } finally {
      setLoading(false);
    }
  }

  const biciIds = Array.from({ length: TOTAL }, (_, i) => i + 1);

  function availBadgeClass(n) {
    if (n >= 4) return 'avail-badge high';
    if (n >= 2) return 'avail-badge medium';
    return 'avail-badge low';
  }

  return (
    <div>
      <h2 className="step-title">Scegli la bicicletta</h2>
      <p className="step-subtitle">Tutte Papin Sport — stessa qualità, scegli il numero!</p>

      {loading && (
        <div className="loading-overlay">
          <div className="spinner" />
          Verifica disponibilità...
        </div>
      )}

      {!loading && disponibili !== null && (
        <>
          <div className={availBadgeClass(disponibili.length)} style={{ marginBottom: 20 }}>
            🚲 {disponibili.length} {disponibili.length === 1 ? 'bicicletta disponibile' : 'biciclette disponibili'}
          </div>

          {error && (
            <div style={{ color: 'var(--accent)', fontSize: '0.85rem', marginBottom: 12 }}>
              ⚠️ {error}
            </div>
          )}

          <div className="bike-grid">
            {biciIds.map(id => {
              const isAvail    = disponibili.includes(id);
              const isSelected = booking.bicicletta_id === id;
              return (
                <button
                  key={id}
                  className={`bike-card${isSelected ? ' selected' : ''}${!isAvail ? ' unavailable' : ''}`}
                  onClick={() => isAvail && onChange({ bicicletta_id: id })}
                  disabled={!isAvail}
                  title={isAvail ? `Bicicletta ${id}` : 'Non disponibile'}
                >
                  <span className="bike-icon">🚲</span>
                  <div className="bike-label">#{id}</div>
                  {!isAvail && (
                    <div style={{ fontSize: '0.6rem', color: '#c0392b', marginTop: 2 }}>
                      Occupata
                    </div>
                  )}
                  {isSelected && (
                    <div style={{ fontSize: '0.65rem', color: 'var(--verde)', fontWeight: 700 }}>
                      ✓ Scelta
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{
            marginTop: 16,
            padding: '12px 16px',
            background: '#f9f9f9',
            borderRadius: 8,
            fontSize: '0.82rem',
            color: 'var(--text-light)',
          }}>
            Tutte le biciclette sono <strong>Papin Sport</strong> — marca premium nord-italiana
            con 30+ anni di esperienza. Stessa qualità, stesso comfort.
          </div>
        </>
      )}

      <div className="btn-nav-row">
        <button className="btn btn-secondary" onClick={onBack}>← Indietro</button>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!booking.bicicletta_id}
        >
          Continua →
        </button>
      </div>
    </div>
  );
}

// Orari disponibili: 08:00 - 10:00 ogni 15 minuti

const ORARI = [
  '08:00','08:15','08:30','08:45',
  '09:00','09:15','09:30','09:45',
  '10:00',
];

function formatDateIT(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

export default function StepTime({ booking, onChange, onNext, onBack }) {
  return (
    <div>
      <h2 className="step-title">Orario di ritiro</h2>
      <p className="step-subtitle">
        {formatDateIT(booking.data_ritiro)} — scegli l'orario tra 08:00 e 10:00
      </p>

      <div style={{
        background: 'var(--verde-pale2)',
        border: '1px solid #b7e4c7',
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 20,
        fontSize: '0.85rem',
        color: 'var(--text-light)',
      }}>
        🕗 Ritiro: <strong>08:00 – 10:00</strong> &nbsp;|&nbsp;
        📍 Via Pecol 22, Arfanta di Tarzo (TV)
      </div>

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
        <button className="btn btn-secondary" onClick={onBack}>← Indietro</button>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!booking.orario_ritiro}
        >
          Continua →
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';

const BIKE_MODELS = [
  {
    key:       'city',
    nome:      'E-City Bike KTM',
    specs:     'Wh 500 · Batteria esterna · Ruote 27.5"',
    tag:       'City & Trekking',
    descrizione: 'Perfetta per percorsi su strada e strade sterrate leggere. Comoda e versatile.',
    ids:       [1, 2],
  },
  {
    key:       'mtb',
    nome:      'E-MTB KTM',
    specs:     'Wh 625 · Motore BOSCH CX · Full Power',
    tag:       'Mountain Bike',
    descrizione: 'Massima potenza per affrontare i sentieri delle Colline del Prosecco. Motore BOSCH CX di fascia alta.',
    ids:       [3, 4, 5, 6, 7, 8, 9],
  },
  {
    key:       'bimbo',
    nome:      'E-MTB Bimbo HAIBIKE',
    specs:     '400Wh · HARDFOUR · Ruota 24"',
    tag:       'Bambini',
    descrizione: 'Taglia 24" pensata per i più piccoli. Assistenza elettrica calibrata per bambini.',
    ids:       [10],
  },
];

const ICONS = {
  city: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="34" r="7"/><circle cx="38" cy="34" r="7"/>
      <path d="M10 34 L20 14 L28 14 L38 34"/><path d="M20 14 L24 24 L38 34"/><path d="M20 14 L10 34"/>
      <rect x="22" y="10" width="8" height="4" rx="1"/>
    </svg>
  ),
  mtb: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="34" r="7"/><circle cx="38" cy="34" r="7"/>
      <path d="M10 34 L22 12 L30 12 L38 34"/><path d="M22 12 L26 26 L38 34"/><path d="M22 12 L10 34"/>
      <path d="M18 12 L30 12"/><path d="M24 12 L24 8"/>
      <path d="M20 8 L28 8" strokeWidth="2.5"/>
    </svg>
  ),
  bimbo: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="34" r="6"/><circle cx="37" cy="34" r="6"/>
      <path d="M11 34 L21 16 L29 16 L37 34"/><path d="M21 16 L24 26 L37 34"/><path d="M21 16 L11 34"/>
      <rect x="22" y="12" width="7" height="4" rx="1"/>
      <circle cx="24" cy="7" r="3"/>
    </svg>
  ),
};

export default function StepBike({ booking, onChange, onNext, onBack }) {
  const [disponibili, setDisponibili] = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);

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
      const ids = res.bici_ids || [];
      setDisponibili(ids);
      // Se il modello scelto non ha più bici disponibili, deseleziona
      if (booking.bicicletta_id && !ids.includes(booking.bicicletta_id)) {
        onChange({ bicicletta_id: null, modello_nome: '' });
      }
    } catch {
      setError('Impossibile verificare disponibilità. Riprova.');
      setDisponibili([1,2,3,4,5,6,7,8,9,10]);
    } finally {
      setLoading(false);
    }
  }

  function selectModel(model) {
    const availForModel = model.ids.filter(id => disponibili.includes(id));
    if (availForModel.length === 0) return;
    onChange({ bicicletta_id: availForModel[0], modello_nome: model.nome });
  }

  function availCount(model) {
    if (!disponibili) return 0;
    return model.ids.filter(id => disponibili.includes(id)).length;
  }

  const selectedModel = BIKE_MODELS.find(m => m.ids.includes(booking.bicicletta_id));

  return (
    <div>
      <h2 className="step-title">Scegli il modello</h2>
      <p className="step-subtitle">3 modelli di e-bike — seleziona quello che preferisci</p>

      {loading && (
        <div className="loading-overlay">
          <div className="spinner" />
          Verifica disponibilità...
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--accent)', fontSize: '0.85rem', marginBottom: 12 }}>
          ⚠ {error}
        </div>
      )}

      {!loading && disponibili !== null && (
        <div className="model-grid">
          {BIKE_MODELS.map(model => {
            const avail      = availCount(model);
            const isAvail    = avail > 0;
            const isSelected = selectedModel?.key === model.key;

            return (
              <button
                key={model.key}
                className={`model-card${isSelected ? ' selected' : ''}${!isAvail ? ' unavailable' : ''}`}
                onClick={() => selectModel(model)}
                disabled={!isAvail}
              >
                <div className="model-tag">{model.tag}</div>
                <div className="model-icon">{ICONS[model.key]}</div>
                <div className="model-nome">{model.nome}</div>
                <div className="model-specs">{model.specs}</div>
                <div className="model-desc">{model.descrizione}</div>
                <div className={`model-avail ${isAvail ? (avail === 1 ? 'low' : 'ok') : 'zero'}`}>
                  {isAvail
                    ? `${avail} ${avail === 1 ? 'disponibile' : 'disponibili'}`
                    : 'Non disponibile'}
                </div>
                {isSelected && (
                  <div className="model-check">✓ Selezionata</div>
                )}
              </button>
            );
          })}
        </div>
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

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
    <svg viewBox="0 0 160 100" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      {/* Spokes */}
      <g strokeWidth="1" opacity="0.45">
        <line x1="35" y1="44" x2="35" y2="92"/><line x1="11" y1="68" x2="59" y2="68"/>
        <line x1="18" y1="51" x2="52" y2="85"/><line x1="52" y1="51" x2="18" y2="85"/>
        <line x1="122" y1="44" x2="122" y2="92"/><line x1="98" y1="68" x2="146" y2="68"/>
        <line x1="105" y1="51" x2="139" y2="85"/><line x1="139" y1="51" x2="105" y2="85"/>
      </g>
      {/* Wheels */}
      <circle cx="35" cy="68" r="24" strokeWidth="3"/>
      <circle cx="122" cy="68" r="24" strokeWidth="3"/>
      {/* Fenders */}
      <path d="M 10,59 A 27 27 0 0 1 60,59" strokeWidth="2.5"/>
      <path d="M 97,59 A 27 27 0 0 1 147,59" strokeWidth="2.5"/>
      {/* Frame */}
      <line x1="76" y1="68" x2="35" y2="68" strokeWidth="2.5"/>
      <line x1="64" y1="28" x2="35" y2="68" strokeWidth="2.5"/>
      <line x1="64" y1="28" x2="76" y2="68" strokeWidth="2.5"/>
      <line x1="64" y1="28" x2="96" y2="24" strokeWidth="2.5"/>
      <line x1="76" y1="68" x2="99" y2="36" strokeWidth="2.5"/>
      <line x1="96" y1="24" x2="99" y2="36" strokeWidth="2.5"/>
      <line x1="99" y1="36" x2="122" y2="68" strokeWidth="2.5"/>
      {/* Rear rack */}
      <line x1="10" y1="43" x2="64" y2="43" strokeWidth="2"/>
      <line x1="10" y1="43" x2="35" y2="68" strokeWidth="1.8"/>
      {/* Seat post + wide saddle */}
      <line x1="64" y1="28" x2="62" y2="17" strokeWidth="2"/>
      <path d="M 53,15 Q 62,12 71,15" strokeWidth="2.5"/>
      {/* Stem + flat city handlebar */}
      <line x1="96" y1="24" x2="94" y2="12" strokeWidth="2"/>
      <line x1="84" y1="12" x2="104" y2="12" strokeWidth="2.5"/>
      <line x1="84" y1="10" x2="84" y2="14" strokeWidth="2"/>
      <line x1="104" y1="10" x2="104" y2="14" strokeWidth="2"/>
      {/* Chainring */}
      <circle cx="76" cy="68" r="8" strokeWidth="2"/>
      {/* Battery on down tube */}
      <rect x="83" y="50" width="11" height="6" rx="1.5" strokeWidth="2"/>
      {/* Hubs */}
      <circle cx="35" cy="68" r="3.5" fill="currentColor" stroke="none"/>
      <circle cx="122" cy="68" r="3.5" fill="currentColor" stroke="none"/>
    </svg>
  ),
  mtb: (
    <svg viewBox="0 0 160 100" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      {/* Spokes */}
      <g strokeWidth="1" opacity="0.45">
        <line x1="33" y1="42" x2="33" y2="94"/><line x1="7" y1="68" x2="59" y2="68"/>
        <line x1="15" y1="50" x2="51" y2="86"/><line x1="51" y1="50" x2="15" y2="86"/>
        <line x1="127" y1="42" x2="127" y2="94"/><line x1="101" y1="68" x2="153" y2="68"/>
        <line x1="109" y1="50" x2="145" y2="86"/><line x1="145" y1="50" x2="109" y2="86"/>
      </g>
      {/* Fat tires (r=26) */}
      <circle cx="33" cy="68" r="26" strokeWidth="4"/>
      <circle cx="127" cy="68" r="26" strokeWidth="4"/>
      {/* Frame aggressive */}
      <line x1="76" y1="68" x2="33" y2="68" strokeWidth="2.5"/>
      <line x1="63" y1="26" x2="33" y2="68" strokeWidth="2.5"/>
      <line x1="63" y1="26" x2="76" y2="68" strokeWidth="2.5"/>
      <line x1="63" y1="26" x2="97" y2="22" strokeWidth="2.5"/>
      <line x1="76" y1="68" x2="100" y2="34" strokeWidth="2.5"/>
      <line x1="97" y1="22" x2="100" y2="34" strokeWidth="2.5"/>
      {/* Suspension fork (dual leg + crown) */}
      <line x1="100" y1="34" x2="121" y2="68" strokeWidth="2.5"/>
      <line x1="104" y1="34" x2="131" y2="68" strokeWidth="2.5"/>
      <line x1="100" y1="51" x2="104" y2="51" strokeWidth="2"/>
      {/* Seat post + narrow MTB saddle */}
      <line x1="63" y1="26" x2="61" y2="14" strokeWidth="2"/>
      <path d="M 56,12 Q 61,10 66,12" strokeWidth="2.5"/>
      {/* Wide riser handlebar */}
      <line x1="97" y1="22" x2="98" y2="11" strokeWidth="2"/>
      <line x1="82" y1="11" x2="114" y2="11" strokeWidth="2.5"/>
      <line x1="82" y1="9" x2="82" y2="13" strokeWidth="2"/>
      <line x1="114" y1="9" x2="114" y2="13" strokeWidth="2"/>
      {/* Large chainring */}
      <circle cx="76" cy="68" r="10" strokeWidth="2"/>
      {/* Larger battery */}
      <rect x="80" y="47" width="13" height="8" rx="2" strokeWidth="2"/>
      {/* Hubs */}
      <circle cx="33" cy="68" r="3.5" fill="currentColor" stroke="none"/>
      <circle cx="127" cy="68" r="3.5" fill="currentColor" stroke="none"/>
    </svg>
  ),
  bimbo: (
    <svg viewBox="0 0 160 100" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      {/* Spokes (smaller wheels r=19) */}
      <g strokeWidth="1" opacity="0.45">
        <line x1="38" y1="49" x2="38" y2="87"/><line x1="19" y1="68" x2="57" y2="68"/>
        <line x1="25" y1="55" x2="51" y2="81"/><line x1="51" y1="55" x2="25" y2="81"/>
        <line x1="122" y1="49" x2="122" y2="87"/><line x1="103" y1="68" x2="141" y2="68"/>
        <line x1="109" y1="55" x2="135" y2="81"/><line x1="135" y1="55" x2="109" y2="81"/>
      </g>
      {/* Smaller wheels 24" */}
      <circle cx="38" cy="68" r="19" strokeWidth="3"/>
      <circle cx="122" cy="68" r="19" strokeWidth="3"/>
      {/* Frame compact */}
      <line x1="76" y1="68" x2="38" y2="68" strokeWidth="2.5"/>
      <line x1="66" y1="33" x2="38" y2="68" strokeWidth="2.5"/>
      <line x1="66" y1="33" x2="76" y2="68" strokeWidth="2.5"/>
      <line x1="66" y1="33" x2="95" y2="30" strokeWidth="2.5"/>
      <line x1="76" y1="68" x2="98" y2="42" strokeWidth="2.5"/>
      <line x1="95" y1="30" x2="98" y2="42" strokeWidth="2.5"/>
      <line x1="98" y1="42" x2="122" y2="68" strokeWidth="2.5"/>
      {/* Seat post + wide kids saddle */}
      <line x1="66" y1="33" x2="64" y2="21" strokeWidth="2"/>
      <path d="M 56,19 Q 64,16 72,19" strokeWidth="2.5"/>
      {/* Stem + moderate handlebar */}
      <line x1="95" y1="30" x2="93" y2="18" strokeWidth="2"/>
      <line x1="83" y1="18" x2="103" y2="18" strokeWidth="2.5"/>
      <line x1="83" y1="16" x2="83" y2="20" strokeWidth="2"/>
      <line x1="103" y1="16" x2="103" y2="20" strokeWidth="2"/>
      {/* Chainring */}
      <circle cx="76" cy="68" r="7" strokeWidth="2"/>
      {/* Small battery */}
      <rect x="80" y="53" width="10" height="5.5" rx="1.5" strokeWidth="2"/>
      {/* Hubs */}
      <circle cx="38" cy="68" r="3" fill="currentColor" stroke="none"/>
      <circle cx="122" cy="68" r="3" fill="currentColor" stroke="none"/>
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

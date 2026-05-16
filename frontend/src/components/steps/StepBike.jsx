import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api.js';

const SEASONAL_PRICES = {
  bassa: {
    ecity: { mezza: 35, intera: 45, due_giorni: 84  },
    emtb:  { mezza: 40, intera: 55, due_giorni: 100 },
    bimbo: { mezza: 8,  intera: 11, due_giorni: 20  },
  },
  alta: {
    ecity: { mezza: 40, intera: 50, due_giorni: 95  },
    emtb:  { mezza: 45, intera: 55, due_giorni: 100 },
    bimbo: { mezza: 10, intera: 14, due_giorni: 26  },
  },
};

function getStagione(dateStr) {
  if (!dateStr) return 'bassa';
  const [, mm, dd] = dateStr.split('-').map(Number);
  const mmdd = mm * 100 + dd;
  if (mmdd >= 401 && mmdd <= 630) return 'bassa';
  if (mmdd >= 701 && mmdd <= 831) return 'alta';
  if (mmdd >= 901 && mmdd <= 1031) return 'bassa';
  return 'bassa';
}

const BIKE_MODELS = [
  { key: 'ecity', nome: 'E-City Bike KTM',    ids: [1, 2] },
  { key: 'emtb',  nome: 'E-MTB KTM Bosch CX', ids: [3, 4, 5, 6, 7, 8, 9] },
  { key: 'bimbo', nome: 'E-MTB Bimbo Haibike', ids: [10] },
];

const ICONS = {
  ecity: (
    <svg viewBox="0 0 160 100" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <g strokeWidth="1" opacity="0.45">
        <line x1="35" y1="44" x2="35" y2="92"/><line x1="11" y1="68" x2="59" y2="68"/>
        <line x1="18" y1="51" x2="52" y2="85"/><line x1="52" y1="51" x2="18" y2="85"/>
        <line x1="122" y1="44" x2="122" y2="92"/><line x1="98" y1="68" x2="146" y2="68"/>
        <line x1="105" y1="51" x2="139" y2="85"/><line x1="139" y1="51" x2="105" y2="85"/>
      </g>
      <circle cx="35" cy="68" r="24" strokeWidth="3"/><circle cx="122" cy="68" r="24" strokeWidth="3"/>
      <path d="M 10,59 A 27 27 0 0 1 60,59" strokeWidth="2.5"/><path d="M 97,59 A 27 27 0 0 1 147,59" strokeWidth="2.5"/>
      <line x1="76" y1="68" x2="35" y2="68" strokeWidth="2.5"/><line x1="64" y1="28" x2="35" y2="68" strokeWidth="2.5"/>
      <line x1="64" y1="28" x2="76" y2="68" strokeWidth="2.5"/><line x1="64" y1="28" x2="96" y2="24" strokeWidth="2.5"/>
      <line x1="76" y1="68" x2="99" y2="36" strokeWidth="2.5"/><line x1="96" y1="24" x2="99" y2="36" strokeWidth="2.5"/>
      <line x1="99" y1="36" x2="122" y2="68" strokeWidth="2.5"/>
      <line x1="10" y1="43" x2="64" y2="43" strokeWidth="2"/><line x1="10" y1="43" x2="35" y2="68" strokeWidth="1.8"/>
      <line x1="64" y1="28" x2="62" y2="17" strokeWidth="2"/><path d="M 53,15 Q 62,12 71,15" strokeWidth="2.5"/>
      <line x1="96" y1="24" x2="94" y2="12" strokeWidth="2"/><line x1="84" y1="12" x2="104" y2="12" strokeWidth="2.5"/>
      <line x1="84" y1="10" x2="84" y2="14" strokeWidth="2"/><line x1="104" y1="10" x2="104" y2="14" strokeWidth="2"/>
      <circle cx="76" cy="68" r="8" strokeWidth="2"/>
      <rect x="83" y="50" width="11" height="6" rx="1.5" strokeWidth="2"/>
      <circle cx="35" cy="68" r="3.5" fill="currentColor" stroke="none"/><circle cx="122" cy="68" r="3.5" fill="currentColor" stroke="none"/>
    </svg>
  ),
  emtb: (
    <svg viewBox="0 0 160 100" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <g strokeWidth="1" opacity="0.45">
        <line x1="33" y1="42" x2="33" y2="94"/><line x1="7" y1="68" x2="59" y2="68"/>
        <line x1="15" y1="50" x2="51" y2="86"/><line x1="51" y1="50" x2="15" y2="86"/>
        <line x1="127" y1="42" x2="127" y2="94"/><line x1="101" y1="68" x2="153" y2="68"/>
        <line x1="109" y1="50" x2="145" y2="86"/><line x1="145" y1="50" x2="109" y2="86"/>
      </g>
      <circle cx="33" cy="68" r="26" strokeWidth="4"/><circle cx="127" cy="68" r="26" strokeWidth="4"/>
      <line x1="76" y1="68" x2="33" y2="68" strokeWidth="2.5"/><line x1="63" y1="26" x2="33" y2="68" strokeWidth="2.5"/>
      <line x1="63" y1="26" x2="76" y2="68" strokeWidth="2.5"/><line x1="63" y1="26" x2="97" y2="22" strokeWidth="2.5"/>
      <line x1="76" y1="68" x2="100" y2="34" strokeWidth="2.5"/><line x1="97" y1="22" x2="100" y2="34" strokeWidth="2.5"/>
      <line x1="100" y1="34" x2="121" y2="68" strokeWidth="2.5"/><line x1="104" y1="34" x2="131" y2="68" strokeWidth="2.5"/>
      <line x1="100" y1="51" x2="104" y2="51" strokeWidth="2"/>
      <line x1="63" y1="26" x2="61" y2="14" strokeWidth="2"/><path d="M 56,12 Q 61,10 66,12" strokeWidth="2.5"/>
      <line x1="97" y1="22" x2="98" y2="11" strokeWidth="2"/><line x1="82" y1="11" x2="114" y2="11" strokeWidth="2.5"/>
      <line x1="82" y1="9" x2="82" y2="13" strokeWidth="2"/><line x1="114" y1="9" x2="114" y2="13" strokeWidth="2"/>
      <circle cx="76" cy="68" r="10" strokeWidth="2"/>
      <rect x="80" y="47" width="13" height="8" rx="2" strokeWidth="2"/>
      <circle cx="33" cy="68" r="3.5" fill="currentColor" stroke="none"/><circle cx="127" cy="68" r="3.5" fill="currentColor" stroke="none"/>
    </svg>
  ),
  bimbo: (
    <svg viewBox="0 0 160 100" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <g strokeWidth="1" opacity="0.45">
        <line x1="38" y1="49" x2="38" y2="87"/><line x1="19" y1="68" x2="57" y2="68"/>
        <line x1="25" y1="55" x2="51" y2="81"/><line x1="51" y1="55" x2="25" y2="81"/>
        <line x1="122" y1="49" x2="122" y2="87"/><line x1="103" y1="68" x2="141" y2="68"/>
        <line x1="109" y1="55" x2="135" y2="81"/><line x1="135" y1="55" x2="109" y2="81"/>
      </g>
      <circle cx="38" cy="68" r="19" strokeWidth="3"/><circle cx="122" cy="68" r="19" strokeWidth="3"/>
      <line x1="76" y1="68" x2="38" y2="68" strokeWidth="2.5"/><line x1="66" y1="33" x2="38" y2="68" strokeWidth="2.5"/>
      <line x1="66" y1="33" x2="76" y2="68" strokeWidth="2.5"/><line x1="66" y1="33" x2="95" y2="30" strokeWidth="2.5"/>
      <line x1="76" y1="68" x2="98" y2="42" strokeWidth="2.5"/><line x1="95" y1="30" x2="98" y2="42" strokeWidth="2.5"/>
      <line x1="98" y1="42" x2="122" y2="68" strokeWidth="2.5"/>
      <line x1="66" y1="33" x2="64" y2="21" strokeWidth="2"/><path d="M 56,19 Q 64,16 72,19" strokeWidth="2.5"/>
      <line x1="95" y1="30" x2="93" y2="18" strokeWidth="2"/><line x1="83" y1="18" x2="103" y2="18" strokeWidth="2.5"/>
      <line x1="83" y1="16" x2="83" y2="20" strokeWidth="2"/><line x1="103" y1="16" x2="103" y2="20" strokeWidth="2"/>
      <circle cx="76" cy="68" r="7" strokeWidth="2"/>
      <rect x="80" y="53" width="10" height="5.5" rx="1.5" strokeWidth="2"/>
      <circle cx="38" cy="68" r="3" fill="currentColor" stroke="none"/><circle cx="122" cy="68" r="3" fill="currentColor" stroke="none"/>
    </svg>
  ),
};

const WHATSAPP_URL = 'https://wa.me/393928614635';
const PHONE_URL    = 'tel:+393928614635';

const IconWhatsApp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.524 5.847L.057 23.882l6.19-1.624A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 01-5.004-1.369l-.36-.214-3.724.977.995-3.63-.235-.373A9.77 9.77 0 012.182 12C2.182 6.578 6.578 2.182 12 2.182S21.818 6.578 21.818 12 17.422 21.818 12 21.818z"/>
  </svg>
);

const IconPhone = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92v2z"/>
  </svg>
);

export default function StepBike({ booking, onChange, onNext, onBack }) {
  const { t } = useTranslation();
  const [perTipo,  setPerTipo]  = useState(null);
  const [loading,  setLoading]  = useState(false);

  // Initialize quantities from booking.bici
  const [quantities, setQuantities] = useState(() => {
    const q = { ecity: 0, emtb: 0, bimbo: 0 };
    (booking.bici || []).forEach(b => { if (b.bike_type in q) q[b.bike_type] = b.quantita; });
    return q;
  });

  useEffect(() => {
    if (booking.data_ritiro) checkAvailability();
  }, [booking.data_ritiro]); // eslint-disable-line react-hooks/exhaustive-deps

  async function checkAvailability() {
    setLoading(true);
    try {
      const res = await api.getAvailability(booking.data_ritiro, 'intera_giornata', 1);
      setPerTipo(res.per_tipo || { ecity: 2, emtb: 7, bimbo: 1 });
    } catch {
      setPerTipo({ ecity: 2, emtb: 7, bimbo: 1 });
    } finally {
      setLoading(false);
    }
  }

  function adjustQty(key, delta) {
    const maxForType = perTipo?.[key] ?? 10;
    setQuantities(prev => ({
      ...prev,
      [key]: Math.max(0, Math.min(maxForType, (prev[key] || 0) + delta)),
    }));
  }

  const totalBici = Object.values(quantities).reduce((s, q) => s + q, 0);

  function handleContinue() {
    const bici = BIKE_MODELS
      .filter(m => quantities[m.key] > 0)
      .map(m => ({ bike_type: m.key, bike_nome: m.nome, quantita: quantities[m.key] }));
    onChange({ bici, tipo_noleggio: null, prezzo_base_totale: 0, prezzo_totale: 0, accessori: [], accessori_qty: { casco: 0, lucchetto: 0 } });
    onNext();
  }

  return (
    <div>
      <h2 className="step-title">{t('stepBike.title')}</h2>
      <p className="step-subtitle">{t('stepBike.subtitle')}</p>

      {loading && (
        <div className="loading-overlay">
          <div className="spinner" />{t('stepBike.checking')}
        </div>
      )}

      {!loading && (
        <div className="model-grid">
          {BIKE_MODELS.map(model => {
            const count   = perTipo ? (perTipo[model.key] ?? 0) : null;
            const isAvail = count === null || count > 0;
            const qty     = quantities[model.key] || 0;
            const maxQty  = count ?? 10;

            if (!isAvail) {
              return (
                <div key={model.key} className="model-card unavailable" aria-label={`${model.nome} — non disponibile`}>
                  <div className="model-tag">{t(`stepBike.models.${model.key}.tag`)}</div>
                  <div className="model-icon">{ICONS[model.key]}</div>
                  <div className="model-nome">{model.nome}</div>
                  <div className="model-specs">{t(`stepBike.models.${model.key}.specs`)}</div>
                  <div className="model-contact-panel">
                    <div className="model-contact-msg">{t('stepBike.unavailable')}</div>
                    <div className="model-contact-sub">{t('stepBike.unavailableSub')}</div>
                    <div className="model-contact-btns">
                      <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="contact-btn whatsapp">
                        <IconWhatsApp /> {t('stepBike.whatsapp')}
                      </a>
                      <a href={PHONE_URL} className="contact-btn phone">
                        <IconPhone /> {t('stepBike.call')}
                      </a>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={model.key}
                className={`model-card${qty > 0 ? ' selected' : ''}`}
                style={{ cursor: qty === 0 ? 'pointer' : 'default' }}
                onClick={() => qty === 0 && adjustQty(model.key, 1)}
              >
                {qty > 0 && <div className="model-qty-badge">{qty}</div>}
                <div className="model-tag">{t(`stepBike.models.${model.key}.tag`)}</div>
                <div className="model-icon">{ICONS[model.key]}</div>
                <div className="model-nome">{model.nome}</div>
                <div className="model-specs">{t(`stepBike.models.${model.key}.specs`)}</div>
                <div className="model-desc">{t(`stepBike.models.${model.key}.descrizione`)}</div>
                <div className="model-prices">
                  {(() => {
                    const p = SEASONAL_PRICES[getStagione(booking.data_ritiro)][model.key];
                    return (<>
                      <span>½ {t('stepBike.halfDay')} <strong>€{p.mezza}</strong></span>
                      <span>{t('stepBike.fullDay')} <strong>€{p.intera}</strong></span>
                      <span>{t('stepBike.multiFrom')} <strong>€{p.due_giorni}</strong></span>
                    </>);
                  })()}
                </div>

                <div className="model-qty-row" onClick={e => e.stopPropagation()}>
                  <button
                    className="qty-btn"
                    onClick={() => adjustQty(model.key, -1)}
                    disabled={qty <= 0}
                    aria-label="Rimuovi bici"
                  >−</button>
                  <span className="qty-num">{qty}</span>
                  <button
                    className="qty-btn"
                    onClick={() => adjustQty(model.key, 1)}
                    disabled={qty >= maxQty}
                    aria-label="Aggiungi bici"
                  >+</button>
                  {count !== null && count <= 3 && qty < maxQty && (
                    <span className="qty-avail">max {count}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalBici > 0 && (
        <p className="bikes-selected-note">
          {totalBici} {totalBici === 1 ? t('stepBike.bikeSelected') : t('stepBike.bikesSelected', { n: totalBici })}
        </p>
      )}

      <div className="btn-nav-row">
        <button className="btn btn-secondary" onClick={onBack}>{t('common.back')}</button>
        <button className="btn btn-primary" onClick={handleContinue} disabled={totalBici === 0 || loading}>
          {t('common.continue')}
        </button>
      </div>
    </div>
  );
}

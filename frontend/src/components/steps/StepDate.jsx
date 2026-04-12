import { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';

const MESI_IT = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre',
];
const GIORNI_IT = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

export default function StepDate({ booking, onChange, onNext }) {
  const today = new Date();
  today.setHours(0,0,0,0);

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1); // 1-12
  const [calendario, setCalendario] = useState({});
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    loadCalendario(viewYear, viewMonth);
  }, [viewYear, viewMonth]);

  async function loadCalendario(anno, mese) {
    setLoading(true);
    try {
      const data = await api.getCalendario(anno, mese);
      setCalendario(data);
    } catch {
      setCalendario({});
    } finally {
      setLoading(false);
    }
  }

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  }

  // Impedisci navigare a mesi passati
  const isPrevDisabled = viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth <= today.getMonth() + 1);

  // Costruisci griglia giorni del mese
  function buildDays() {
    const firstDay = new Date(viewYear, viewMonth - 1, 1);
    // Offset: lunedì=0 ... domenica=6
    let offset = firstDay.getDay() - 1;
    if (offset < 0) offset = 6;

    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const cells = [];

    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return cells;
  }

  function dateStr(day) {
    return `${viewYear}-${String(viewMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  function classForDay(day) {
    if (!day) return 'cal-day empty';
    const ds   = dateStr(day);
    const date = new Date(ds + 'T00:00:00');
    if (date < today) return 'cal-day past';

    // Domenica e lunedì: considera la logica aziendale
    // (l'utente può comunque selezionare domenica, lunedì è disponibile su accordo)
    const avail = calendario[ds];
    if (!avail) return 'cal-day avail-full'; // Sconosciuto = assumiamo disponibile

    if (avail.disponibili === 0) return 'cal-day avail-none';
    if (avail.disponibili <= 2)  return 'cal-day avail-partial';
    return 'cal-day avail-full';
  }

  function handleDayClick(day) {
    if (!day) return;
    const ds   = dateStr(day);
    const date = new Date(ds + 'T00:00:00');
    if (date < today) return;

    const avail = calendario[ds];
    if (avail && avail.disponibili === 0) return;

    onChange({ data_ritiro: ds });
  }

  const cells = buildDays();

  return (
    <div>
      <h2 className="step-title">Scegli la data</h2>
      <p className="step-subtitle">Seleziona il giorno in cui vuoi ritirare la bici</p>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { cls: 'cal-day avail-full',    label: 'Disponibile (5 bici)' },
          { cls: 'cal-day avail-partial', label: 'Pochi posti' },
          { cls: 'cal-day avail-none',    label: 'Completo' },
        ].map(({ cls, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-light)' }}>
            <div className={cls} style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>

      <div className="calendar-wrapper">
        {/* Navigazione mese */}
        <div className="calendar-nav">
          <button className="cal-nav-btn" onClick={prevMonth} disabled={isPrevDisabled}>‹</button>
          <h3>{MESI_IT[viewMonth - 1]} {viewYear}</h3>
          <button className="cal-nav-btn" onClick={nextMonth}>›</button>
        </div>

        {loading && <div className="spinner" />}

        {/* Griglia */}
        <div className="calendar-grid">
          {GIORNI_IT.map(g => (
            <div key={g} className="cal-day-header">{g}</div>
          ))}
          {cells.map((day, idx) => {
            const ds    = day ? dateStr(day) : null;
            const avail = ds ? (calendario[ds] || { disponibili: 5 }) : null;
            const cls   = classForDay(day) + (ds && ds === booking.data_ritiro ? ' selected' : '');

            return (
              <div key={idx} className={cls} onClick={() => handleDayClick(day)}>
                {day && (
                  <>
                    <span className="day-num">{day}</span>
                    {avail && avail.disponibili > 0 && avail.disponibili < 5 && (
                      <span className="day-avail">{avail.disponibili}/5</span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="btn-nav-row">
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!booking.data_ritiro}
        >
          Continua →
        </button>
      </div>
    </div>
  );
}

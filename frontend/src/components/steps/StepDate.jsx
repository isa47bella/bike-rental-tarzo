import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api.js';

export default function StepDate({ booking, onChange, onNext }) {
  const { t } = useTranslation();
  const MESI   = t('stepDate.months', { returnObjects: true });
  const GIORNI = t('stepDate.days',   { returnObjects: true });

  const today = new Date();
  today.setHours(0,0,0,0);
  // Anticipo minimo: il giorno dopo (no stesso giorno). Primo giorno prenotabile = domani.
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + 1);

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
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

  const isPrevDisabled = viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth <= today.getMonth() + 1);

  function buildDays() {
    const firstDay = new Date(viewYear, viewMonth - 1, 1);
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
    if (date < minDate) return 'cal-day past';
    const avail = calendario[ds];
    if (!avail) return 'cal-day avail-full';
    if (avail.fuori_stagione) return 'cal-day fuori-stagione';
    if (avail.chiuso || avail.disponibili === 0) return 'cal-day avail-none';
    if (avail.disponibili <= 2) return 'cal-day avail-partial';
    return 'cal-day avail-full';
  }

  function handleDayClick(day) {
    if (!day) return;
    const ds   = dateStr(day);
    const date = new Date(ds + 'T00:00:00');
    if (date < minDate) return;
    const avail = calendario[ds];
    if (avail?.fuori_stagione) return;
    if (avail?.chiuso) return;
    if (avail && avail.disponibili === 0) return;
    onChange({ data_ritiro: ds });
  }

  const cells = buildDays();

  return (
    <div>
      <h2 className="step-title">{t('stepDate.title')}</h2>
      <p className="step-subtitle">{t('stepDate.subtitle')}</p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { cls: 'cal-day avail-full',      label: t('stepDate.legend.available') },
          { cls: 'cal-day avail-partial',   label: t('stepDate.legend.partial') },
          { cls: 'cal-day avail-none',      label: t('stepDate.legend.full') },
          { cls: 'cal-day fuori-stagione',  label: t('stepDate.legend.fuoriStagione') },
        ].map(({ cls, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-light)' }}>
            <div className={cls} style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>

      <div className="calendar-wrapper">
        <div className="calendar-nav">
          <button className="cal-nav-btn" onClick={prevMonth} disabled={isPrevDisabled}>‹</button>
          <h3>{MESI[viewMonth - 1]} {viewYear}</h3>
          <button className="cal-nav-btn" onClick={nextMonth}>›</button>
        </div>

        {loading && <div className="spinner" />}

        <div className="calendar-grid">
          {GIORNI.map(g => (
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
        <button className="btn btn-primary" onClick={onNext} disabled={!booking.data_ritiro}>
          {t('common.continue')}
        </button>
      </div>
    </div>
  );
}

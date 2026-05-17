import React from 'react';

/**
 * Riga superiore della home admin con 3 KPI compatti.
 * Props: { revenue_oggi, bici_occupate, bici_totali, azioni_count }
 */
export default function KpiStrip({ revenue_oggi = 0, bici_occupate = 0, bici_totali = 10, azioni_count = 0 }) {
  const hasAzioni = azioni_count > 0;
  return (
    <div className="ac-kpi-strip">
      <div className="ac-kpi">
        <div className="ac-kpi-label">Incasso oggi</div>
        <div className="ac-kpi-value">€{Number(revenue_oggi).toFixed(0)}</div>
      </div>
      <div className="ac-kpi-divider" />
      <div className="ac-kpi">
        <div className="ac-kpi-label">Flotta</div>
        <div className="ac-kpi-value">{bici_occupate}<span className="ac-kpi-of">/{bici_totali}</span></div>
      </div>
      <div className="ac-kpi-divider" />
      <div className="ac-kpi">
        <div className="ac-kpi-label" style={hasAzioni ? { color: 'var(--ac-red)' } : undefined}>Azioni</div>
        <div className="ac-kpi-value" style={hasAzioni ? { color: 'var(--ac-red)' } : undefined}>{azioni_count}</div>
      </div>
    </div>
  );
}

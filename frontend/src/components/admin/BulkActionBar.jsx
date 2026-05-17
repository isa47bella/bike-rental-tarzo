import React from 'react';

/**
 * Action bar fissa in basso, visibile quando ci sono righe selezionate.
 * Props: { count, onEmail, onWhatsApp, onCancel, onClear }
 */
export default function BulkActionBar({ count, onEmail, onWhatsApp, onCancel, onClear }) {
  if (count === 0) return null;
  return (
    <div className="ac-bulk-bar">
      <span className="ac-bulk-count">{count} selezionate</span>
      <div className="ac-bulk-actions">
        <button className="ac-btn ghost sm" onClick={onEmail}>📧 Email</button>
        <button className="ac-btn ghost sm" onClick={onWhatsApp}>💬 WhatsApp</button>
        <button className="ac-btn ghost sm" onClick={onCancel} style={{ color: 'var(--ac-red)' }}>🚫 Cancella</button>
        <button className="ac-btn ghost sm" onClick={onClear}>✕ Deseleziona</button>
      </div>
    </div>
  );
}

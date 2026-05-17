import React from 'react';

const PRIORITY_BORDER = { 1: 'var(--ac-red)', 2: 'var(--ac-amber)', 3: 'var(--ac-border)' };
const PRIORITY_ICON   = { 1: '⚠', 2: '⏰', 3: '🚲' };

const ACTION_LABEL = {
  retry_cauzione:   'Riprova',
  whatsapp_cliente: 'WhatsApp',
  marca_noshow:     'No-show',
  chiama_cliente:   'Chiama',
  invia_firma:      'Invia firma',
  vedi_dettaglio:   'Apri',
};

/**
 * Singola card del feed delle azioni.
 * Props: { card, onAction }
 *   - onAction: (actionKey, card) => void
 */
export default function ActionCard({ card, onAction }) {
  const borderColor = PRIORITY_BORDER[card.priority] || PRIORITY_BORDER[3];

  return (
    <div className="ac-action-card" style={{ borderLeftColor: borderColor }}>
      <div className="ac-action-card-head">
        <span className="ac-action-icon">{PRIORITY_ICON[card.priority] || '•'}</span>
        <div className="ac-action-titles">
          <div className="ac-action-title">{card.titolo}</div>
          {card.sub && <div className="ac-action-sub">{card.sub}</div>}
        </div>
      </div>
      {(card.actions || []).length > 0 && (
        <div className="ac-action-buttons">
          {card.actions.map((a, idx) => (
            <button
              key={a}
              type="button"
              className={`ac-btn sm ${idx === 0 ? 'primary' : 'ghost'}`}
              onClick={() => onAction(a, card)}
            >
              {ACTION_LABEL[a] || a}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

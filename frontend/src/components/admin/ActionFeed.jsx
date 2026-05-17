import React, { useEffect, useState } from 'react';
import { adminApi } from '../../lib/api.js';
import ActionCard from './ActionCard.jsx';

/**
 * Carica le azioni pendenti e le rende.
 * Props: { onAction, refreshTick, onCount }
 */
export default function ActionFeed({ onAction, refreshTick = 0, onCount }) {
  const [cards,   setCards]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminApi.getAzioniPendenti()
      .then(res => {
        if (cancelled) return;
        const list = res.cards || [];
        setCards(list);
        setError(null);
        if (typeof onCount === 'function') onCount(list.length);
      })
      .catch(e => { if (!cancelled) setError(e.message || 'Errore'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshTick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="ac-action-feed-empty">Caricamento azioni…</div>;
  if (error)   return <div className="ac-action-feed-empty">⚠ {error}</div>;
  if (cards.length === 0) {
    return (
      <div className="ac-action-feed-empty">
        <span style={{ fontSize: '1.6rem' }}>✅</span>
        <div>Nessuna azione richiesta — tutto sotto controllo.</div>
      </div>
    );
  }

  return (
    <div className="ac-action-feed">
      {cards.map(c => <ActionCard key={c.id} card={c} onAction={onAction} />)}
    </div>
  );
}

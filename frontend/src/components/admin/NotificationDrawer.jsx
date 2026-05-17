import React, { useEffect, useState } from 'react';
import { adminApi } from '../../lib/api.js';

const TIPO_ICON = {
  cauzione_failed: '⚠', cauzione_failed_permanent: '🚨',
  no_show: '👻', ritardo_ritiro: '⏰', ritardo_riconsegna: '⏰',
  danno_aperto: '🔧', firma_received: '✍', firma_reminder_sent: '✍',
  nuova_prenotazione_paid: '🚲', pending_auto_cancelled: '🗑',
};

function relativeTime(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'ora';
  if (diff < 3600)  return `${Math.floor(diff/60)}m fa`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h fa`;
  return `${Math.floor(diff/86400)}g fa`;
}

/**
 * Drawer da destra (desktop) / sheet full-screen (mobile).
 * Props: { open, onClose, onClickBooking }
 */
export default function NotificationDrawer({ open, onClose, onClickBooking }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!open) return;
    adminApi.getNotifiche()
      .then(res => setItems(res.items || []))
      .catch(() => setItems([]));
  }, [open]);

  function handleClick(n) {
    adminApi.markNotificaRead(n.id).catch(()=>{});
    if (n.booking_id && typeof onClickBooking === 'function') onClickBooking(n.booking_id);
    onClose();
  }

  function handleMarkAll() {
    adminApi.markAllRead().then(() => {
      setItems(prev => prev.map(n => ({ ...n, letta_at: n.letta_at || new Date().toISOString() })));
    });
  }

  if (!open) return null;

  return (
    <div className="ac-notif-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ac-notif-drawer">
        <div className="ac-notif-header">
          <span>🔔 Notifiche</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ac-btn ghost sm" onClick={handleMarkAll}>Segna lette</button>
            <button className="ac-icon-btn" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="ac-notif-list">
          {items.length === 0 && (
            <div className="ac-notif-empty">Nessuna notifica</div>
          )}
          {items.map(n => (
            <button
              key={n.id}
              className={`ac-notif-item${n.letta_at ? '' : ' unread'}`}
              onClick={() => handleClick(n)}
            >
              <span className="ac-notif-icon">{TIPO_ICON[n.tipo] || '•'}</span>
              <div className="ac-notif-body">
                <div className="ac-notif-titolo">{n.titolo}</div>
                {n.descrizione && <div className="ac-notif-desc">{n.descrizione}</div>}
                <div className="ac-notif-time">{relativeTime(n.created_at)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

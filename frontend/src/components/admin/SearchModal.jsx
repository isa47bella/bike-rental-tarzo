import React, { useState, useEffect, useRef } from 'react';
import { adminApi } from '../../lib/api.js';

/**
 * Modal di ricerca globale.
 * Props: { open, onClose, onSelectBooking, onSelectCliente }
 */
export default function SearchModal({ open, onClose, onSelectBooking, onSelectCliente }) {
  const [q,       setQ]       = useState('');
  const [results, setResults] = useState({ prenotazioni: [], clienti: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQ(''); setResults({ prenotazioni: [], clienti: [] });
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open || q.trim().length < 2) { setResults({ prenotazioni: [], clienti: [] }); return; }
    const t = setTimeout(() => {
      setLoading(true);
      adminApi.search(q.trim())
        .then(setResults)
        .catch(() => setResults({ prenotazioni: [], clienti: [] }))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ac-search-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ac-search-modal">
        <div className="ac-search-header">
          <span className="ac-search-icon">🔍</span>
          <input
            ref={inputRef}
            className="ac-search-input"
            placeholder="Cerca per nome, email, telefono o ID prenotazione…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <kbd className="ac-search-kbd">Esc</kbd>
        </div>

        <div className="ac-search-body">
          {q.trim().length < 2 && (
            <div className="ac-search-hint">Inizia a digitare almeno 2 caratteri</div>
          )}
          {loading && <div className="ac-search-hint">Cercando…</div>}

          {!loading && results.prenotazioni.length > 0 && (
            <div className="ac-search-group">
              <div className="ac-search-group-title">Prenotazioni</div>
              {results.prenotazioni.map(p => (
                <button
                  key={p.id}
                  className="ac-search-item"
                  onClick={() => { onSelectBooking(p.id); onClose(); }}
                >
                  <div>
                    <div className="ac-search-item-title">{p.cliente_nome}</div>
                    <div className="ac-search-item-sub">
                      {p.data_ritiro} · {p.tipo_noleggio} · Bici #{p.bicicletta_id} · {p.id.substring(0,8)}
                    </div>
                  </div>
                  <span className={`ac-badge sm ${p.pagamento_status === 'paid' ? 'green' : 'yellow'}`}>
                    {p.pagamento_status}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!loading && results.clienti.length > 0 && (
            <div className="ac-search-group">
              <div className="ac-search-group-title">Clienti</div>
              {results.clienti.map(c => (
                <button
                  key={c.email || c.telefono || c.nome}
                  className="ac-search-item"
                  onClick={() => { onSelectCliente(c); onClose(); }}
                >
                  <div>
                    <div className="ac-search-item-title">{c.nome}</div>
                    <div className="ac-search-item-sub">
                      {c.email} · {c.telefono} · {c.count} prenotazion{c.count === 1 ? 'e' : 'i'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && q.trim().length >= 2 && results.prenotazioni.length === 0 && results.clienti.length === 0 && (
            <div className="ac-search-hint">Nessun risultato per "{q}"</div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { adminApi } from '../lib/api.js';

function formatDateIT(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function tipoShort(tipo) {
  const m = { '4_ore': '4h', 'intera_giornata': 'Giorn.', '3_piu_giorni': 'Multi' };
  return m[tipo] || tipo;
}

export default function AdminDashboard() {
  const [token,       setToken]       = useState(sessionStorage.getItem('admin_token') || '');
  const [authed,      setAuthed]      = useState(false);
  const [stats,       setStats]       = useState(null);
  const [bookings,    setBookings]    = useState([]);
  const [filter,      setFilter]      = useState('paid');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [damageModal, setDamageModal] = useState(null); // { id, nome } oppure null
  const [damageAmount, setDamageAmount] = useState('');
  const [damageMotivo, setDamageMotivo] = useState('');

  async function login() {
    sessionStorage.setItem('admin_token', token);
    setLoading(true);
    try {
      const [s, b] = await Promise.all([
        adminApi.getStats(),
        adminApi.getBookings({ status: filter }),
      ]);
      setStats(s);
      setBookings(b.bookings || []);
      setAuthed(true);
      setError(null);
    } catch (e) {
      setError(e.message || 'Token non valido');
      sessionStorage.removeItem('admin_token');
    } finally {
      setLoading(false);
    }
  }

  async function loadBookings(status) {
    setFilter(status);
    setLoading(true);
    try {
      const b = await adminApi.getBookings({ status });
      setBookings(b.bookings || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function cancelBooking(id) {
    if (!confirm('Cancellare questa prenotazione?')) return;
    try {
      await adminApi.cancelBooking(id);
      loadBookings(filter);
    } catch (e) {
      alert('Errore: ' + e.message);
    }
  }

  async function chargeDamage() {
    const amount = parseFloat(damageAmount);
    if (!amount || amount <= 0) return alert('Inserisci un importo valido');
    if (!confirm(`Addebitare €${amount} a ${damageModal.nome}?`)) return;
    try {
      await adminApi.chargeDamage(damageModal.id, amount, damageMotivo);
      alert('Addebito effettuato con successo');
      setDamageModal(null);
      setDamageAmount('');
      setDamageMotivo('');
      loadBookings(filter);
    } catch (e) {
      alert('Errore: ' + e.message);
    }
  }

  // ─── Login form ─────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="result-page">
        <div className="result-card">
          <div className="result-icon">🔐</div>
          <h1>Admin Dashboard</h1>
          <p>Inserisci il token amministratore</p>
          <div className="form-group">
            <input
              type="password"
              placeholder="Admin token..."
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
            />
          </div>
          {error && (
            <div style={{ color: 'var(--accent)', fontSize: '0.85rem', marginBottom: 12 }}>
              {error}
            </div>
          )}
          <button className="btn btn-primary btn-full" onClick={login} disabled={loading}>
            {loading ? 'Accesso...' : 'Accedi'}
          </button>
        </div>
      </div>
    );
  }

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Header admin */}
      <div className="admin-header">
        <h1>🚲 Admin — Bike Rental Tarzo</h1>
        <button
          onClick={() => { setAuthed(false); sessionStorage.removeItem('admin_token'); }}
          style={{ background: 'none', border: '1px solid #444', color: '#ccc',
                   padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}
        >
          Logout
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>

        {/* Stats */}
        {stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.prenotazioni_totali}</div>
              <div className="stat-label">Prenotazioni Totali</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#FF6B6B' }}>
                €{stats.incasso_totale}
              </div>
              <div className="stat-label">Incasso Totale</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.prenotazioni_oggi}</div>
              <div className="stat-label">Ritiri Oggi</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.prenotazioni_future}</div>
              <div className="stat-label">Prenotazioni Future</div>
            </div>
          </div>
        )}

        {/* Filtri */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {['paid', 'pending', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => loadBookings(s)}
              style={{
                padding: '8px 16px',
                borderRadius: 20,
                border: '2px solid',
                borderColor: filter === s ? 'var(--verde)' : 'var(--border)',
                background:  filter === s ? 'var(--verde)' : 'white',
                color:       filter === s ? 'white' : 'var(--text)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              {{paid: '✅ Confermate', pending: '⏳ In Attesa', cancelled: '❌ Cancellate'}[s]}
            </button>
          ))}
          <button
            onClick={() => { adminApi.getStats().then(setStats); loadBookings(filter); }}
            style={{ padding: '8px 14px', borderRadius: 20, border: '2px solid var(--border)',
                     background: 'white', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            🔄 Aggiorna
          </button>
        </div>

        {error && (
          <div style={{ background: '#fce4e4', padding: 12, borderRadius: 8,
                        color: '#c0392b', marginBottom: 16, fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {loading && <div className="spinner" />}

        {/* Tabella prenotazioni */}
        {!loading && (
          <div style={{ overflowX: 'auto' }}>
            {bookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>
                Nessuna prenotazione trovata
              </div>
            ) : (
              <table className="booking-table">
                <thead>
                  <tr>
                    <th>Codice</th>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th>Ritiro</th>
                    <th>Restituzione</th>
                    <th>Bici</th>
                    <th>€</th>
                    <th>Status</th>
                    {filter === 'paid' && <th>Azioni</th>}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id}>
                      <td>
                        <code style={{ fontSize: '0.8rem', letterSpacing: 1 }}>
                          {b.id.toUpperCase().substring(0, 8)}
                        </code>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{b.cliente_nome}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                          {b.cliente_email}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                          {b.cliente_telefono}
                        </div>
                      </td>
                      <td>{tipoShort(b.tipo_noleggio)}{b.giorni > 1 ? ` (${b.giorni}gg)` : ''}</td>
                      <td>
                        <div>{formatDateIT(b.data_ritiro)}</div>
                        <div style={{ fontWeight: 700 }}>{b.orario_ritiro?.substring(0,5)}</div>
                      </td>
                      <td>
                        <div>{formatDateIT(b.data_restituzione)}</div>
                        <div style={{ fontWeight: 700 }}>{b.orario_restituzione?.substring(0,5)}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>#{b.bicicletta_id}</td>
                      <td style={{ fontWeight: 700, color: 'var(--verde)' }}>
                        €{Number(b.prezzo_totale).toFixed(0)}
                      </td>
                      <td>
                        <span className={`status-badge ${b.pagamento_status}`}>
                          {b.pagamento_status}
                        </span>
                      </td>
                      {filter === 'paid' && (
                        <td>
                          <button
                            onClick={() => cancelBooking(b.id)}
                            style={{ background: 'none', border: '1px solid #e57373',
                                     color: '#c0392b', borderRadius: 4, padding: '4px 8px',
                                     cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Cancella
                          </button>
                          <button
                            onClick={() => setDamageModal({ id: b.id, nome: b.cliente_nome })}
                            style={{ background: 'none', border: '1px solid #e57373',
                                     color: '#c0392b', borderRadius: 4, padding: '4px 8px',
                                     cursor: 'pointer', fontSize: '0.75rem', marginLeft: 6 }}
                          >
                            Addebita Danno
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {damageModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 28, maxWidth: 380, width: '90%' }}>
            <h2 style={{ margin: '0 0 8px' }}>Addebita Danno</h2>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: 16 }}>
              Cliente: <strong>{damageModal.nome}</strong>
            </p>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Importo danni (€)</label>
              <input type="number" min="1" step="0.01" placeholder="es. 80"
                     value={damageAmount} onChange={e => setDamageAmount(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Motivo (opzionale)</label>
              <input type="text" placeholder="es. Ruota anteriore rotta"
                     value={damageMotivo} onChange={e => setDamageMotivo(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={chargeDamage}>
                Addebita
              </button>
              <button onClick={() => setDamageModal(null)}
                      style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #ddd',
                               background: 'white', cursor: 'pointer' }}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

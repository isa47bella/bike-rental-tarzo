import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../lib/api.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateIT(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function tipoShort(tipo) {
  const m = { '4_ore': '4h', 'intera_giornata': 'Giorn.', '3_piu_giorni': 'Multi' };
  return m[tipo] || tipo;
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconBike = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/>
    <path d="M15 6a1 1 0 000-2h-3l-3 9 2 1"/><path d="M9 6l1 4h7l-2-4H9z"/>
  </svg>
);

const IconEuro = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 10h12M4 14h12M19 6a7 7 0 100 12"/>
  </svg>
);

const IconCalendar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
  </svg>
);

const IconClock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
  </svg>
);

const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/>
  </svg>
);

const IconLogout = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
  </svg>
);

const IconCard = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>
  </svg>
);

const IconAlert = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [token,        setToken]        = useState(sessionStorage.getItem('admin_token') || '');
  const [authed,       setAuthed]       = useState(false);
  const [stats,        setStats]        = useState(null);
  const [bookings,     setBookings]     = useState([]);
  const [filter,       setFilter]       = useState('paid');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [damageModal,    setDamageModal]    = useState(null); // { id, nome }
  const [damageAmount,   setDamageAmount]   = useState('');
  const [damageMotivo,   setDamageMotivo]   = useState('');
  const [damageLoading,  setDamageLoading]  = useState(false);
  const [depositModal,   setDepositModal]   = useState(null); // { id, nome, action: 'release'|'capture' }
  const [depositAmount,  setDepositAmount]  = useState('');
  const [depositLoading, setDepositLoading] = useState(false);

  const loadBookings = useCallback(async (status) => {
    setFilter(status);
    setLoading(true);
    setError(null);
    try {
      const b = await adminApi.getBookings({ status });
      setBookings(b.bookings || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, b] = await Promise.all([
        adminApi.getStats(),
        adminApi.getBookings({ status: filter }),
      ]);
      setStats(s);
      setBookings(b.bookings || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  async function login() {
    sessionStorage.setItem('admin_token', token);
    setLoading(true);
    setError(null);
    try {
      const [s, b] = await Promise.all([
        adminApi.getStats(),
        adminApi.getBookings({ status: filter }),
      ]);
      setStats(s);
      setBookings(b.bookings || []);
      setAuthed(true);
    } catch (e) {
      setError(e.message || 'Token non valido');
      sessionStorage.removeItem('admin_token');
    } finally {
      setLoading(false);
    }
  }

  async function cancelBooking(id) {
    if (!confirm('Cancellare questa prenotazione?')) return;
    try {
      await adminApi.cancelBooking(id);
      await loadBookings(filter);
    } catch (e) {
      alert('Errore: ' + e.message);
    }
  }

  async function chargeDamage() {
    const amount = parseFloat(damageAmount);
    if (!amount || amount <= 0) return alert('Inserisci un importo valido');
    if (!confirm(`Addebitare €${amount.toFixed(2)} a ${damageModal.nome}?`)) return;
    setDamageLoading(true);
    try {
      await adminApi.chargeDamage(damageModal.id, amount, damageMotivo);
      alert('Addebito effettuato con successo');
      setDamageModal(null);
      setDamageAmount('');
      setDamageMotivo('');
      await loadBookings(filter);
    } catch (e) {
      alert('Errore: ' + e.message);
    } finally {
      setDamageLoading(false);
    }
  }

  async function handleDeposit() {
    setDepositLoading(true);
    try {
      if (depositModal.action === 'release') {
        if (!confirm(`Rilasciare la cauzione di €1.000 a ${depositModal.nome}?`)) return;
        await adminApi.releaseDeposit(depositModal.id);
        alert('Cauzione rilasciata — €1.000 sbloccati sulla carta del cliente');
      } else {
        const amount = parseFloat(depositAmount);
        if (!amount || amount <= 0 || amount > 1000) return alert('Inserisci un importo valido (max €1.000)');
        if (!confirm(`Incassare €${amount.toFixed(2)} dalla cauzione di ${depositModal.nome}?`)) return;
        await adminApi.captureDeposit(depositModal.id, amount);
        alert(`€${amount.toFixed(2)} addebitati dalla cauzione`);
      }
      setDepositModal(null);
      setDepositAmount('');
      await loadBookings(filter);
    } catch (e) {
      alert('Errore: ' + e.message);
    } finally {
      setDepositLoading(false);
    }
  }

  // ─── Login ─────────────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <div className="admin-login-logo">
            <IconBike />
          </div>
          <h1>Admin Panel</h1>
          <p>Accedi con il token amministratore</p>

          {error && <div className="admin-error">{error}</div>}

          <div className="admin-form-group">
            <label>Token</label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && login()}
              autoFocus
            />
          </div>
          <button className="admin-btn" onClick={login} disabled={loading || !token}>
            {loading ? 'Accesso in corso…' : 'Accedi'}
          </button>
        </div>
      </div>
    );
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  const FILTERS = [
    { key: 'paid',      label: 'Confermate' },
    { key: 'pending',   label: 'In Attesa'  },
    { key: 'cancelled', label: 'Cancellate' },
  ];

  return (
    <div className="admin-layout">
      {/* Topbar */}
      <div className="admin-topbar">
        <div className="admin-topbar-brand">
          <div className="admin-topbar-logo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/>
              <path d="M15 6a1 1 0 000-2h-3l-3 9 2 1"/><path d="M9 6l1 4h7l-2-4H9z"/>
            </svg>
          </div>
          <h1>Bike Rental Tarzo</h1>
        </div>
        <div className="admin-topbar-actions">
          <button className="admin-logout-btn" onClick={() => {
            setAuthed(false);
            sessionStorage.removeItem('admin_token');
          }}>
            <IconLogout /> Esci
          </button>
        </div>
      </div>

      <div className="admin-body">
        {/* Stats */}
        {stats && (
          <div className="admin-stats">
            <div className="admin-stat">
              <div className="admin-stat-icon" style={{ background: 'rgba(234,88,12,0.15)', color: '#FB923C' }}>
                <IconBike />
              </div>
              <div className="admin-stat-body">
                <div className="admin-stat-value">{stats.prenotazioni_totali}</div>
                <div className="admin-stat-label">Totali</div>
              </div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-icon" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ADE80' }}>
                <IconEuro />
              </div>
              <div className="admin-stat-body">
                <div className="admin-stat-value">€{stats.incasso_totale}</div>
                <div className="admin-stat-label">Incasso</div>
              </div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-icon" style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8' }}>
                <IconCalendar />
              </div>
              <div className="admin-stat-body">
                <div className="admin-stat-value">{stats.prenotazioni_oggi}</div>
                <div className="admin-stat-label">Oggi</div>
              </div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-icon" style={{ background: 'rgba(251,191,36,0.12)', color: '#FBB024' }}>
                <IconClock />
              </div>
              <div className="admin-stat-body">
                <div className="admin-stat-value">{stats.prenotazioni_future}</div>
                <div className="admin-stat-label">Future</div>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="admin-controls">
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`admin-filter-btn${filter === f.key ? ' active' : ''}`}
              onClick={() => loadBookings(f.key)}
            >
              {f.label}
            </button>
          ))}
          <button className="admin-filter-btn refresh" onClick={refresh}>
            <IconRefresh /> Aggiorna
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.25)',
                        color: '#F87171', borderRadius: 8, padding: '10px 14px',
                        fontSize: '0.88rem', marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Table */}
        <div className="admin-table-wrapper">
          {loading ? (
            <div className="admin-spinner" />
          ) : bookings.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon">
                <IconBike />
              </div>
              <p>Nessuna prenotazione trovata</p>
            </div>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Codice</th>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th>Ritiro</th>
                    <th>Restituzione</th>
                    <th>Bici</th>
                    <th>Prezzo</th>
                    <th>Status</th>
                    {filter === 'paid' && <th>Cauzione</th>}
                    {filter === 'paid' && <th>Danno extra</th>}
                    {filter === 'paid' && <th>Azioni</th>}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id}>
                      <td>
                        <span className="cell-code">
                          {b.id.toUpperCase().substring(0, 8)}
                        </span>
                      </td>
                      <td>
                        <div className="cell-name">{b.cliente_nome}</div>
                        <div className="cell-sub">{b.cliente_email}</div>
                        <div className="cell-sub">{b.cliente_telefono}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{tipoShort(b.tipo_noleggio)}</div>
                        {b.giorni > 1 && <div className="cell-sub">{b.giorni} giorni</div>}
                      </td>
                      <td>
                        <div>{formatDateIT(b.data_ritiro)}</div>
                        <div style={{ fontWeight: 700, color: '#CBD5E1' }}>{b.orario_ritiro?.substring(0, 5)}</div>
                      </td>
                      <td>
                        <div>{formatDateIT(b.data_restituzione)}</div>
                        <div style={{ fontWeight: 700, color: '#CBD5E1' }}>{b.orario_restituzione?.substring(0, 5)}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>#{b.bicicletta_id}</td>
                      <td>
                        <span className="cell-price">€{Number(b.prezzo_totale).toFixed(0)}</span>
                      </td>
                      <td>
                        <span className={`status-badge ${b.pagamento_status}`}>
                          {b.pagamento_status === 'paid'      && 'Pagata'}
                          {b.pagamento_status === 'pending'   && 'Attesa'}
                          {b.pagamento_status === 'cancelled' && 'Cancellata'}
                        </span>
                      </td>

                      {filter === 'paid' && (
                        <td>
                          {b.cauzione_status === 'authorized' && (
                            <span className="status-badge cauzione-ok">€1.000 bloccati</span>
                          )}
                          {b.cauzione_status === 'captured' && (
                            <span className="status-badge cauzione-captured">
                              €{Number(b.cauzione_captured_amount || 0).toFixed(0)} incassati
                            </span>
                          )}
                          {b.cauzione_status === 'cancelled' && (
                            <span className="status-badge cauzione-released">Rilasciata</span>
                          )}
                          {b.cauzione_status === 'failed' && (
                            <span className="status-badge cauzione-failed">Non riuscita</span>
                          )}
                          {(!b.cauzione_status || b.cauzione_status === 'pending') && (
                            <span style={{ color: '#475569', fontSize: '0.78rem' }}>—</span>
                          )}
                        </td>
                      )}

                      {filter === 'paid' && (
                        <td>
                          {b.danno_status === 'charged' ? (
                            <span className="status-badge charged">
                              €{Number(b.danno_amount).toFixed(0)} addebitato
                            </span>
                          ) : (
                            <span style={{ color: '#475569', fontSize: '0.78rem' }}>—</span>
                          )}
                        </td>
                      )}

                      {filter === 'paid' && (
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {/* Gestione cauzione */}
                          {b.cauzione_status === 'authorized' && (
                            <>
                              <button
                                className="admin-action-btn deposit-release"
                                onClick={() => setDepositModal({ id: b.id, nome: b.cliente_nome, action: 'release' })}
                                title="Bici restituita OK — sblocca €1.000"
                              >
                                ✓ Rilascia
                              </button>
                              <button
                                className="admin-action-btn deposit-capture"
                                onClick={() => setDepositModal({ id: b.id, nome: b.cliente_nome, action: 'capture' })}
                                title="Addebita danni dalla cauzione (max €1.000)"
                              >
                                ⚠ Danni
                              </button>
                            </>
                          )}
                          {/* Addebito extra se cauzione fallita/già gestita */}
                          {b.cauzione_status !== 'authorized' && (
                            <button
                              className="admin-action-btn damage"
                              onClick={() => setDamageModal({ id: b.id, nome: b.cliente_nome })}
                              disabled={!b.stripe_payment_method_id || b.danno_status === 'charged'}
                              title="Addebita danno extra sulla carta"
                            >
                              Addebita extra
                            </button>
                          )}
                          <button
                            className="admin-action-btn cancel"
                            onClick={() => cancelBooking(b.id)}
                          >
                            Cancella
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Deposit Modal */}
      {depositModal && (
        <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && setDepositModal(null)}>
          <div className="admin-modal">
            <h2>{depositModal.action === 'release' ? '✓ Rilascia Cauzione' : '⚠ Incassa Danni da Cauzione'}</h2>
            <div className="admin-modal-sub">
              Cliente: <strong>{depositModal.nome}</strong>
            </div>

            {depositModal.action === 'release' ? (
              <p style={{ fontSize: '0.88rem', color: '#94A3B8', margin: '12px 0' }}>
                I <strong style={{ color: '#4ADE80' }}>€1.000 bloccati</strong> sulla carta del cliente verranno sbloccati immediatamente. Operazione irreversibile.
              </p>
            ) : (
              <>
                <p style={{ fontSize: '0.88rem', color: '#94A3B8', margin: '12px 0 4px' }}>
                  Inserisci l&apos;importo dei danni da trattenere (max €1.000). Il resto verrà sbloccato automaticamente.
                </p>
                <div className="admin-form-group">
                  <label>Importo danni (€)</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    step="0.01"
                    placeholder="es. 150"
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                    autoFocus
                  />
                </div>
              </>
            )}

            <div className="admin-modal-actions">
              <button
                className={`admin-modal-btn ${depositModal.action === 'release' ? 'confirm' : 'confirm'}`}
                onClick={handleDeposit}
                disabled={depositLoading || (depositModal.action === 'capture' && !depositAmount)}
                style={depositModal.action === 'release' ? { background: '#166534', borderColor: '#166534' } : {}}
              >
                {depositLoading
                  ? 'In corso…'
                  : depositModal.action === 'release'
                    ? '✓ Sblocca €1.000'
                    : `⚠ Incassa €${parseFloat(depositAmount || 0).toFixed(2)}`}
              </button>
              <button
                className="admin-modal-btn cancel-btn"
                onClick={() => { setDepositModal(null); setDepositAmount(''); }}
                disabled={depositLoading}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Damage Modal */}
      {damageModal && (
        <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && setDamageModal(null)}>
          <div className="admin-modal">
            <h2>Addebita Danno</h2>
            <div className="admin-modal-sub">
              Cliente: <strong>{damageModal.nome}</strong>
            </div>

            <div className="admin-form-group">
              <label>Importo danni (€)</label>
              <input
                type="number"
                min="1"
                max="5000"
                step="0.01"
                placeholder="es. 80"
                value={damageAmount}
                onChange={e => setDamageAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="admin-form-group">
              <label>Motivo (opzionale)</label>
              <input
                type="text"
                placeholder="es. Ruota anteriore rotta"
                value={damageMotivo}
                onChange={e => setDamageMotivo(e.target.value)}
              />
            </div>

            <div className="admin-modal-actions">
              <button
                className="admin-modal-btn confirm"
                onClick={chargeDamage}
                disabled={damageLoading || !damageAmount}
              >
                {damageLoading ? 'Addebito…' : 'Addebita'}
              </button>
              <button
                className="admin-modal-btn cancel-btn"
                onClick={() => { setDamageModal(null); setDamageAmount(''); setDamageMotivo(''); }}
                disabled={damageLoading}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

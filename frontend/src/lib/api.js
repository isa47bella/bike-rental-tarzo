const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),

  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
  return data;
}

async function get(path, params = {}) {
  const qs  = new URLSearchParams(params).toString();
  const url = qs ? `${BASE}${path}?${qs}` : `${BASE}${path}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
  return data;
}

async function adminGet(path, params = {}) {
  const token = sessionStorage.getItem('admin_token') || '';
  const qs    = new URLSearchParams(params).toString();
  const url   = qs ? `${BASE}${path}?${qs}` : `${BASE}${path}`;
  const res   = await fetch(url, { headers: { 'x-admin-token': token } });
  const data  = await res.json();
  if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
  return data;
}

async function adminPatch(path, body) {
  const token = sessionStorage.getItem('admin_token') || '';
  const res = await fetch(`${BASE}${path}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
  return data;
}

async function adminPost(path, body) {
  const token = sessionStorage.getItem('admin_token') || '';
  const res = await fetch(`${BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
  return data;
}

async function adminDelete(path, body) {
  const token = sessionStorage.getItem('admin_token') || '';
  const opts = { method: 'DELETE', headers: { 'x-admin-token': token } };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res  = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
  return data;
}

async function adminPut(path, body) {
  const token = sessionStorage.getItem('admin_token') || '';
  const res = await fetch(`${BASE}${path}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
  return data;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const api = {
  // Disponibilità bici per data+tipo_noleggio
  getAvailability: (data_ritiro, tipo_noleggio, giorni = 1) =>
    post('/availability', { data_ritiro, tipo_noleggio, giorni }),

  // Calcola data/orario restituzione
  calcolaRestituzione: (data_ritiro, tipo_noleggio, giorni = 1) =>
    post('/availability/calcola-restituzione', { data_ritiro, tipo_noleggio, giorni }),

  // Calendario mensile disponibilità
  getCalendario: (anno, mese) =>
    post('/availability/calendario', { anno, mese }),

  // Crea sessione pagamento Stripe
  checkout: (bookingData) =>
    post('/payments/checkout', bookingData),

  // Recupera prenotazione da session_id Stripe
  getBySession: (sessionId) =>
    get(`/payments/session/${sessionId}`),
};

// ─── Admin API ────────────────────────────────────────────────────────────────

export const adminApi = {
  getStats: () =>
    adminGet('/admin/stats'),

  getBookings: (params = {}) =>
    adminGet('/admin/bookings', params),

  getBooking: (id) =>
    adminGet(`/admin/bookings/${id}`),

  cancelBooking: (id) =>
    adminPost(`/admin/bookings/${id}/cancel`, {}),

  chargeDamage: (id, amount, motivo = '') =>
    adminPost(`/admin/bookings/${id}/charge-damage`, { amount, motivo }),

  releaseDeposit: (id) =>
    adminPost(`/admin/bookings/${id}/release-deposit`, {}),

  captureDeposit: (id, amount, motivo = '') =>
    adminPost(`/admin/bookings/${id}/capture-deposit`, { amount, motivo }),

  sendEmail: (id, subject, message) =>
    adminPost(`/admin/bookings/${id}/send-email`, { subject, message }),

  getOggi: () =>
    adminGet('/admin/oggi'),

  getFlotta: () =>
    adminGet('/admin/flotta'),

  updateFlotta: (id, data) =>
    adminPatch(`/admin/flotta/${id}`, data),

  checkin: (id, data) =>
    adminPost(`/admin/bookings/${id}/checkin`, data),

  checkout: (id, data) =>
    adminPost(`/admin/bookings/${id}/checkout`, data),

  getReport: () =>
    adminGet('/admin/report'),

  manualBooking: (data) =>
    adminPost('/admin/bookings/manual', data),

  sendFirmaLink: (id) =>
    adminPost(`/admin/bookings/${id}/send-firma`, {}),

  getChiusure:    ()                   => adminGet('/admin/chiusure'),
  addChiusura:    (data, motivo = '')  => adminPost('/admin/chiusure', { data, motivo }),
  deleteChiusura: (id)                 => adminDelete(`/admin/chiusure/${id}`),

  getCauzioni:    ()                   => adminGet('/admin/cauzioni'),
  getConfig:      ()                   => adminGet('/admin/config'),
  saveConfig:     (cfg)                => adminPut('/admin/config', cfg),
  getOccupazione: ()                   => adminGet('/admin/occupazione'),
  searchCliente:  (q)                  => adminGet('/admin/cliente', { q }),
  saveNote:       (id, note_admin)     => adminPatch(`/admin/bookings/${id}/note`, { note_admin }),
  pushSubscribe:  (subscription)       => adminPost('/admin/push/subscribe', { subscription }),
  pushUnsubscribe:(endpoint)           => adminDelete('/admin/push/subscribe', { endpoint }),
  pushTest:       ()                   => adminPost('/admin/push/test', {}),

  refundBooking:  (id, amount, motivo) => adminPost(`/admin/bookings/${id}/refund`, { amount, motivo }),
  rescheduleBooking: (id, data_ritiro, tipo_noleggio, giorni) =>
    adminPatch(`/admin/bookings/${id}/reschedule`, { data_ritiro, tipo_noleggio, giorni }),
  assegnaBici:       (id, bicicletta_id)  => adminPatch(`/admin/bookings/${id}/assegna-bici`, { bicicletta_id }),
  autorizzaCauzione: (id)                 => adminPost(`/admin/bookings/${id}/autorizza-cauzione`, {}),
  getAuditLog:       (params = {})        => adminGet('/admin/audit-log', params),
  getAzioniPendenti: ()                   => adminGet('/admin/azioni-pendenti'),
  search:            (q)                  => adminGet(`/admin/search?q=${encodeURIComponent(q)}`),
};

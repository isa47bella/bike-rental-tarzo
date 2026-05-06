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

// ─── Public API ───────────────────────────────────────────────────────────────

export const api = {
  // Disponibilità bici per data+orario+tipo
  getAvailability: (data_ritiro, orario_ritiro, tipo_noleggio, giorni = 1) =>
    post('/availability', { data_ritiro, orario_ritiro, tipo_noleggio, giorni }),

  // Calcola data/orario restituzione
  calcolaRestituzione: (data_ritiro, orario_ritiro, tipo_noleggio, giorni = 1) =>
    post('/availability/calcola-restituzione', { data_ritiro, orario_ritiro, tipo_noleggio, giorni }),

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

  cancelBooking: (id) =>
    adminPost(`/admin/bookings/${id}/cancel`, {}),

  chargeDamage: (id, amount, motivo = '') =>
    adminPost(`/admin/bookings/${id}/charge-damage`, { amount, motivo }),
};

import { useState, useEffect, useCallback, useRef } from 'react';
import { adminApi, api } from '../lib/api.js';

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDateIT(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatDateLong(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' });
}

function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const months = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

function todayIT() {
  return new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function tipoLabel(tipo) {
  const m = {
    mezza_mattina:    '½ Mattina',
    mezza_pomeriggio: '½ Pomeriggio',
    intera_giornata:  'Giornata intera',
    multi_giorno:     'Multi-giorno',
    '4_ore':          '4 Ore',
    '3_piu_giorni':   '3+ Giorni',
  };
  return m[tipo] || tipo;
}

function tipoShort(tipo) {
  const m = {
    mezza_mattina: '½M', mezza_pomeriggio: '½P',
    intera_giornata: 'Giorn.', multi_giorno: 'Multi',
    '4_ore': '4h', '3_piu_giorni': 'Multi',
  };
  return m[tipo] || tipo;
}

function parseAccessori(raw) {
  if (!raw) return [];
  const labels = { casco: 'Casco', lucchetto: 'Lucchetto', kit_foro: 'Kit Foratura' };
  return raw.split(',').filter(Boolean).map(k => labels[k] || k);
}

async function compressImage(file, maxDim = 900, quality = 0.72) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IC = (d, vb = '0 0 24 24') => () => (
  <svg width="18" height="18" viewBox={vb} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

const IconDashboard    = IC(<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>);
const IconOggi         = IC(<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="8" cy="16" r="1" fill="currentColor"/><circle cx="12" cy="16" r="1" fill="currentColor"/></>);
const IconBookings     = IC(<><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></>);
const IconFlotta       = IC(<><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 000-2h-3l-3 9 2 1"/><path d="M9 6l1 4h7l-2-4H9z"/></>);
const IconReport       = IC(<><path d="M3 3v18h18"/><path d="M7 16l4-7 4 4 4-8"/></>);
const IconLogout       = IC(<><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></>);
const IconRefresh      = IC(<><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></>);
const IconEuro         = IC(<><path d="M4 10h12M4 14h12M19 6a7 7 0 100 12"/></>);
const IconCalendar     = IC(<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>);
const IconClock        = IC(<><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>);
const IconAlert        = IC(<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></>);
const IconCheck        = IC(<><polyline points="20 6 9 17 4 12"/></>);
const IconCamera       = IC(<><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></>);
const IconBike         = IC(<><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 000-2h-3l-3 9 2 1"/><path d="M9 6l1 4h7l-2-4H9z"/></>);
const IconTool         = IC(<><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></>);
const IconMail         = IC(<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>);
const IconCard         = IC(<><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></>);
const IconX            = IC(<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>);
const IconEdit         = IC(<><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>);
const IconBattery      = IC(<><rect x="1" y="6" width="18" height="12" rx="2"/><path d="M23 13v-2"/></>);
const IconPen          = IC(<><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></>);
const IconLink         = IC(<><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></>);
const IconSearch       = IC(<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>);
const IconBlock        = IC(<><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></>);
const IconFileText     = IC(<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>);
const IconSettings     = IC(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>);
const IconUsers        = IC(<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></>);
const IconDeposit      = IC(<><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/><circle cx="12" cy="15" r="2"/></>);
const IconBell         = IC(<><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>);
const IconDownload     = IC(<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>);
const IconNote         = IC(<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="10" y1="17" x2="8" y2="17"/></>);

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV = [
  { id: 'dashboard',    label: 'Dashboard',    Icon: IconDashboard  },
  { id: 'oggi',         label: 'Oggi',          Icon: IconOggi       },
  { id: 'prenotazioni', label: 'Prenotazioni',  Icon: IconBookings   },
  { id: 'flotta',       label: 'Flotta',        Icon: IconFlotta     },
  { id: 'calendario',   label: 'Calendario',    Icon: IconCalendar   },
  { id: 'cauzioni',     label: 'Cauzioni',      Icon: IconDeposit    },
  { id: 'clienti',      label: 'Clienti',       Icon: IconUsers      },
  { id: 'report',       label: 'Report',        Icon: IconReport     },
  { id: 'impostazioni', label: 'Impostazioni',  Icon: IconSettings   },
];

const VIEW_TITLES = {
  dashboard:    'Dashboard',
  oggi:         'Operazioni di Oggi',
  prenotazioni: 'Prenotazioni',
  flotta:       'Gestione Flotta',
  calendario:   'Calendario & Disponibilità',
  cauzioni:     'Dashboard Cauzioni',
  clienti:      'Storico Clienti',
  report:       'Report & Statistiche',
  impostazioni: 'Impostazioni',
};

// ─── Email templates ──────────────────────────────────────────────────────────

const EMAIL_TEMPLATES = [
  {
    label: 'Cauzione non autorizzata',
    subject: 'Importante: cauzione non autorizzata — Bike Rental Tarzo',
    message: `Abbiamo tentato di bloccare la cauzione di €1.000 sulla tua carta come garanzia per il noleggio, ma l'operazione non è andata a buon fine.\n\nSe non risolviamo questo problema entro domani, saremo costretti ad annullare la tua prenotazione.\n\nContattaci via WhatsApp al +39 392 8614635 o rispondi a questa email.\n\nGrazie per la comprensione.`,
  },
  {
    label: 'Promemoria ritiro',
    subject: 'Promemoria: il tuo noleggio è domani — Bike Rental Tarzo',
    message: `Ti ricordiamo che domani è il giorno del tuo noleggio bici!\n\nRicorda di portare con te:\n• Documento di identità valido\n• Il codice della tua prenotazione\n\nTi aspettiamo in Via Pecol 22, Arfanta di Tarzo (TV).\n\nPer qualsiasi necessità contattaci via WhatsApp al +39 392 8614635.`,
  },
  {
    label: 'Richiesta modifica',
    subject: 'Modifica prenotazione — Bike Rental Tarzo',
    message: `In merito alla tua prenotazione, vorremmo chiederti di contattarci per definire alcuni dettagli.\n\nPuoi raggiungerci via WhatsApp al +39 392 8614635 oppure rispondendo a questa email.\n\nGrazie.`,
  },
  { label: 'Messaggio libero', subject: '', message: '' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [token,    setToken]    = useState(sessionStorage.getItem('admin_token') || '');
  const [authed,   setAuthed]   = useState(false);
  const [activeView, setActiveView] = useState('dashboard');

  // Stats + oggi (loaded at login)
  const [stats,      setStats]      = useState(null);
  const [oggiData,   setOggiData]   = useState(null);
  const [oggiLoading, setOggiLoading] = useState(false);

  // Prenotazioni
  const [bookings,  setBookings]  = useState([]);
  const [filter,    setFilter]    = useState('paid');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  // Flotta
  const [flotta,        setFlotta]        = useState([]);
  const [flottaLoading, setFlottaLoading] = useState(false);

  // Report
  const [report,        setReport]        = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Check-in modal
  const [checkinModal,   setCheckinModal]   = useState(null);
  const [checkinNote,    setCheckinNote]    = useState('');
  const [docFoto,        setDocFoto]        = useState(null);
  const [biciFotoOut,    setBiciFotoOut]    = useState(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const docFotoRef  = useRef();
  const bikeOutRef  = useRef();

  // Checkout modal
  const [checkoutModal,   setCheckoutModal]   = useState(null);
  const [checkoutNote,    setCheckoutNote]    = useState('');
  const [biciFotoIn,      setBiciFotoIn]      = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const bikeInRef = useRef();

  // Fleet edit modal
  const [fleetModal,   setFleetModal]   = useState(null);
  const [fleetEdit,    setFleetEdit]    = useState({});
  const [fleetLoading, setFleetLoading] = useState(false);

  // Deposit modal
  const [depositModal,   setDepositModal]   = useState(null);
  const [depositAmount,  setDepositAmount]  = useState('');
  const [depositLoading, setDepositLoading] = useState(false);

  // Email modal
  const [emailModal,   setEmailModal]   = useState(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  // Damage modal
  const [damageModal,   setDamageModal]   = useState(null);
  const [damageAmount,  setDamageAmount]  = useState('');
  const [damageMotivo,  setDamageMotivo]  = useState('');
  const [damageLoading, setDamageLoading] = useState(false);

  // Send firma link
  const [firmaLoading, setFirmaLoading] = useState({});

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Calendario
  const [calYear,   setCalYear]   = useState(new Date().getFullYear());
  const [calMonth,  setCalMonth]  = useState(new Date().getMonth() + 1);
  const [calData,   setCalData]   = useState(null);
  const [calLoading, setCalLoading] = useState(false);
  const [calSelDay, setCalSelDay] = useState(null);

  // Chiusure
  const [chiusure,            setChiusure]            = useState([]);
  const [nuovaChiusura,       setNuovaChiusura]       = useState('');
  const [nuovaChiusuraMotivo, setNuovaChiusuraMotivo] = useState('');
  const [chiusuraLoading,     setChiusuraLoading]     = useState(false);

  // Cauzioni
  const [cauzioni,        setCauzioni]        = useState([]);
  const [cauzioniLoading, setCauzioniLoading] = useState(false);

  // Clienti / Storico
  const [clientiQuery,   setClientiQuery]   = useState('');
  const [clientiResults, setClientiResults] = useState(null);
  const [clientiLoading, setClientiLoading] = useState(false);

  // Config prezzi
  const [config,       setConfig]       = useState(null);
  const [configEdit,   setConfigEdit]   = useState({});
  const [configLoading,setConfigLoading]= useState(false);
  const [configSaved,  setConfigSaved]  = useState(false);
  const [configMigration, setConfigMigration] = useState(false);

  // Occupazione (in Report)
  const [occupazione,        setOccupazione]        = useState(null);
  const [occupazioneLoading, setOccupazioneLoading] = useState(false);

  // Note interne
  const [noteModal,   setNoteModal]   = useState(null); // { id, nome, note_admin }
  const [noteText,    setNoteText]    = useState('');
  const [noteSaving,  setNoteSaving]  = useState(false);

  // Push notifications
  const [pushSub,     setPushSub]     = useState(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushStatus,  setPushStatus]  = useState('idle'); // idle | enabled | error | unsupported

  async function handleSendFirma(bookingId) {
    setFirmaLoading(prev => ({ ...prev, [bookingId]: true }));
    try {
      await adminApi.sendFirmaLink(bookingId);
      alert('Email con link contratto inviata al cliente!');
    } catch (e) {
      alert('Errore: ' + e.message);
    } finally {
      setFirmaLoading(prev => ({ ...prev, [bookingId]: false }));
    }
  }

  function exportCSV(data) {
    const cols = ['ID','Nome','Email','Telefono','Tipo','Giorni','Data Ritiro','Orario Ritiro','Data Restituzione','Orario Restituzione','Prezzo €','Stato','Firma','Bici','Note Admin'];
    const rows = (data || bookings).map(b => [
      b.id.toUpperCase().slice(0,8),
      b.cliente_nome, b.cliente_email, b.cliente_telefono,
      tipoLabel(b.tipo_noleggio), b.giorni,
      b.data_ritiro, b.orario_ritiro?.slice(0,5),
      b.data_restituzione, b.orario_restituzione?.slice(0,5),
      Number(b.prezzo_totale).toFixed(2), b.pagamento_status,
      b.firma_at ? 'SI' : 'NO', `#${b.bicicletta_id}`,
      b.note_admin || '',
    ]);
    const csv = [cols, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `prenotazioni_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function handleSaveNote() {
    if (!noteModal) return;
    setNoteSaving(true);
    try {
      await adminApi.saveNote(noteModal.id, noteText.trim() || null);
      setNoteModal(null);
      if (activeView === 'prenotazioni') await loadBookings(filter);
    } catch (e) { alert('Errore: ' + e.message); }
    finally { setNoteSaving(false); }
  }

  async function handleSaveConfig() {
    setConfigLoading(true);
    setConfigSaved(false);
    try {
      await adminApi.saveConfig(configEdit);
      setConfig(configEdit);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } catch (e) {
      if (e.message.includes('migration') || e.message.includes('does not exist')) setConfigMigration(true);
      else alert('Errore: ' + e.message);
    }
    finally { setConfigLoading(false); }
  }

  async function handleClientiSearch(e) {
    e?.preventDefault();
    if (clientiQuery.trim().length < 2) return;
    setClientiLoading(true);
    try { const d = await adminApi.searchCliente(clientiQuery); setClientiResults(d.results || []); }
    catch (e) { alert(e.message); }
    finally { setClientiLoading(false); }
  }

  async function handlePushToggle() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported'); return;
    }
    setPushLoading(true);
    try {
      if (pushSub) {
        await pushSub.unsubscribe();
        await adminApi.pushUnsubscribe(pushSub.endpoint);
        setPushSub(null); setPushStatus('idle');
      } else {
        const reg = await navigator.serviceWorker.ready;
        const pub = 'BLGd4Jd629f3Cux4BFEx5gkFr8PHr6rIjtTQIGqA8LF_wg3xJYosQ_1Hnnu8KW5NsdIXXyIY2_DjaQ-1U5ZSVAM';
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: pub,
        });
        await adminApi.pushSubscribe(sub.toJSON());
        setPushSub(sub); setPushStatus('enabled');
      }
    } catch (e) { setPushStatus('error'); console.error('Push:', e); }
    finally { setPushLoading(false); }
  }

  async function handleViewContratto(bookingId) {
    try {
      const adminToken = sessionStorage.getItem('admin_token') || '';
      const res = await fetch(`/api/admin/bookings/${bookingId}/contratto`, {
        headers: { 'x-admin-token': adminToken },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Contratto non disponibile');
        return;
      }
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html' });
      const url  = URL.createObjectURL(blob);
      const win  = window.open(url, '_blank');
      if (win) setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (e) {
      alert('Errore: ' + e.message);
    }
  }

  // Manual booking modal
  const MANUAL_EMPTY = {
    cliente_nome: '', cliente_email: '', cliente_telefono: '', cliente_note: '',
    data_ritiro: '', tipo_noleggio: 'intera_giornata', giorni: 2,
    bicicletta_id: '', accessori: [], prezzo_totale: '', note_pagamento: 'Contanti',
  };
  const [manualModal,   setManualModal]   = useState(false);
  const [manualForm,    setManualForm]    = useState(MANUAL_EMPTY);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError,   setManualError]   = useState(null);

  // ─── Data loaders ───────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try { setStats(await adminApi.getStats()); } catch (_) {}
  }, []);

  const loadOggi = useCallback(async () => {
    setOggiLoading(true);
    try { setOggiData(await adminApi.getOggi()); } catch (_) {}
    finally { setOggiLoading(false); }
  }, []);

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

  const loadFlotta = useCallback(async () => {
    setFlottaLoading(true);
    try { const d = await adminApi.getFlotta(); setFlotta(d.bici || []); } catch (_) {}
    finally { setFlottaLoading(false); }
  }, []);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    try { setReport(await adminApi.getReport()); } catch (_) {}
    finally { setReportLoading(false); }
  }, []);

  const loadCalendario = useCallback(async (year, month) => {
    setCalLoading(true);
    try {
      const data = await api.getCalendario(year, month);
      setCalData(data);
    } catch (_) {}
    finally { setCalLoading(false); }
  }, []);

  const loadChiusure = useCallback(async () => {
    try {
      const d = await adminApi.getChiusure();
      setChiusure(d.chiusure || []);
    } catch (_) {}
  }, []);

  const loadCauzioni = useCallback(async () => {
    setCauzioniLoading(true);
    try { const d = await adminApi.getCauzioni(); setCauzioni(d.cauzioni || []); } catch (_) {}
    finally { setCauzioniLoading(false); }
  }, []);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const d = await adminApi.getConfig();
      setConfig(d.config);
      setConfigEdit(d.config);
      setConfigMigration(d.needs_migration || false);
    } catch (_) {}
    finally { setConfigLoading(false); }
  }, []);

  const loadOccupazione = useCallback(async () => {
    setOccupazioneLoading(true);
    try { const d = await adminApi.getOccupazione(); setOccupazione(d.months || []); } catch (_) {}
    finally { setOccupazioneLoading(false); }
  }, []);

  // Load data when switching views
  useEffect(() => {
    if (!authed) return;
    if (activeView === 'oggi') loadOggi();
    if (activeView === 'prenotazioni' && bookings.length === 0) loadBookings('paid');
    if (activeView === 'flotta' && flotta.length === 0) loadFlotta();
    if (activeView === 'report') { if (!report) loadReport(); if (!occupazione) loadOccupazione(); }
    if (activeView === 'calendario') { loadCalendario(calYear, calMonth); loadChiusure(); }
    if (activeView === 'cauzioni') loadCauzioni();
    if (activeView === 'impostazioni' && !config) loadConfig();
  }, [activeView, authed]); // eslint-disable-line

  // ─── Login ──────────────────────────────────────────────────────────────────

  async function login() {
    sessionStorage.setItem('admin_token', token);
    setLoading(true);
    setError(null);
    try {
      const [s, b, o] = await Promise.all([
        adminApi.getStats(),
        adminApi.getBookings({ status: 'paid' }),
        adminApi.getOggi(),
      ]);
      setStats(s);
      setBookings(b.bookings || []);
      setOggiData(o);
      setAuthed(true);
    } catch (e) {
      setError(e.message || 'Token non valido');
      sessionStorage.removeItem('admin_token');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setAuthed(false);
    sessionStorage.removeItem('admin_token');
  }

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, b, o] = await Promise.all([
        adminApi.getStats(),
        adminApi.getBookings({ status: filter }),
        adminApi.getOggi(),
      ]);
      setStats(s);
      setBookings(b.bookings || []);
      setOggiData(o);
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [filter]);

  // ─── Check-in ───────────────────────────────────────────────────────────────

  async function handleCheckin() {
    setCheckinLoading(true);
    try {
      await adminApi.checkin(checkinModal.id, {
        checkin_note:      checkinNote  || undefined,
        documento_foto:    docFoto      || undefined,
        bici_foto_consegna: biciFotoOut || undefined,
      });
      setCheckinModal(null); setCheckinNote(''); setDocFoto(null); setBiciFotoOut(null);
      await loadOggi();
    } catch (e) { alert('Errore check-in: ' + e.message); }
    finally { setCheckinLoading(false); }
  }

  // ─── Checkout ───────────────────────────────────────────────────────────────

  async function handleCheckout() {
    setCheckoutLoading(true);
    try {
      await adminApi.checkout(checkoutModal.id, {
        checkout_note:   checkoutNote || undefined,
        bici_foto_rientro: biciFotoIn || undefined,
      });
      setCheckoutModal(null); setCheckoutNote(''); setBiciFotoIn(null);
      await loadOggi();
    } catch (e) { alert('Errore checkout: ' + e.message); }
    finally { setCheckoutLoading(false); }
  }

  // ─── Fleet save ─────────────────────────────────────────────────────────────

  async function handleFleetSave() {
    setFleetLoading(true);
    try {
      await adminApi.updateFlotta(fleetModal.id, fleetEdit);
      setFleetModal(null);
      await loadFlotta();
    } catch (e) { alert('Errore: ' + e.message); }
    finally { setFleetLoading(false); }
  }

  // ─── Existing booking actions ────────────────────────────────────────────────

  async function cancelBooking(id) {
    if (!confirm('Cancellare questa prenotazione?')) return;
    try { await adminApi.cancelBooking(id); await loadBookings(filter); }
    catch (e) { alert('Errore: ' + e.message); }
  }

  async function chargeDamage() {
    const amount = parseFloat(damageAmount);
    if (!amount || amount <= 0) return alert('Inserisci un importo valido');
    if (!confirm(`Addebitare €${amount.toFixed(2)} a ${damageModal.nome}?`)) return;
    setDamageLoading(true);
    try {
      await adminApi.chargeDamage(damageModal.id, amount, damageMotivo);
      alert('Addebito effettuato con successo');
      setDamageModal(null); setDamageAmount(''); setDamageMotivo('');
      await loadBookings(filter);
    } catch (e) { alert('Errore: ' + e.message); }
    finally { setDamageLoading(false); }
  }

  async function handleDeposit() {
    setDepositLoading(true);
    try {
      if (depositModal.action === 'release') {
        if (!confirm(`Rilasciare la cauzione di €1.000 a ${depositModal.nome}?`)) return;
        await adminApi.releaseDeposit(depositModal.id);
        alert('Cauzione rilasciata — €1.000 sbloccati');
      } else {
        const amount = parseFloat(depositAmount);
        if (!amount || amount <= 0 || amount > 1000) return alert('Importo non valido (max €1.000)');
        if (!confirm(`Incassare €${amount.toFixed(2)} dalla cauzione di ${depositModal.nome}?`)) return;
        await adminApi.captureDeposit(depositModal.id, amount);
        alert(`€${amount.toFixed(2)} addebitati dalla cauzione`);
      }
      setDepositModal(null); setDepositAmount('');
      await loadBookings(filter);
    } catch (e) { alert('Errore: ' + e.message); }
    finally { setDepositLoading(false); }
  }

  async function handleSendEmail() {
    if (!emailSubject.trim() || !emailMessage.trim()) return;
    setEmailLoading(true);
    try {
      await adminApi.sendEmail(emailModal.id, emailSubject, emailMessage);
      alert(`Email inviata a ${emailModal.email}`);
      setEmailModal(null); setEmailSubject(''); setEmailMessage('');
    } catch (e) { alert('Errore invio email: ' + e.message); }
    finally { setEmailLoading(false); }
  }

  // ─── Manual booking ─────────────────────────────────────────────────────────

  const PREZZI_MANUAL = { mezza_mattina: 35, mezza_pomeriggio: 35, intera_giornata: 45 };
  const PREZZI_MULTI  = { 2:84, 3:120, 4:152, 5:180, 6:205, 7:225 };

  function calcPrezzoManual(tipo, giorni) {
    if (tipo === 'multi_giorno') {
      const n = Number(giorni);
      if (n >= 2 && n <= 7) return PREZZI_MULTI[n];
      if (n > 7) return PREZZI_MULTI[7] + (n - 7) * 20;
    }
    return PREZZI_MANUAL[tipo] ?? 45;
  }

  function setManualField(key, value) {
    setManualForm(prev => {
      const next = { ...prev, [key]: value };
      // auto-update price when tipo or giorni changes
      if ((key === 'tipo_noleggio' || key === 'giorni') && !prev._prezzoCambiato) {
        next.prezzo_totale = String(calcPrezzoManual(next.tipo_noleggio, next.giorni));
      }
      return next;
    });
  }

  async function handleManualBooking() {
    if (!manualForm.cliente_nome || !manualForm.data_ritiro || !manualForm.tipo_noleggio) {
      setManualError('Compila i campi obbligatori: nome, data, tipo noleggio');
      return;
    }
    setManualLoading(true);
    setManualError(null);
    try {
      await adminApi.manualBooking({
        ...manualForm,
        giorni:        Number(manualForm.giorni),
        bicicletta_id: manualForm.bicicletta_id || undefined,
        prezzo_totale: manualForm.prezzo_totale || undefined,
      });
      setManualModal(false);
      setManualForm(MANUAL_EMPTY);
      await loadBookings('paid');
      await loadStats();
    } catch (e) {
      setManualError(e.message);
    } finally {
      setManualLoading(false);
    }
  }

  // ─── Firma link helper ───────────────────────────────────────────────────────

  function copyFirmaLink(bookingId) {
    const url = `${window.location.origin}/firma/${bookingId}`;
    navigator.clipboard.writeText(url).then(() => alert('Link copiato!\n' + url)).catch(() => alert(url));
  }

  // ─── Chiusure ────────────────────────────────────────────────────────────────

  async function handleAddChiusura() {
    if (!nuovaChiusura) return;
    setChiusuraLoading(true);
    try {
      await adminApi.addChiusura(nuovaChiusura, nuovaChiusuraMotivo);
      setNuovaChiusura('');
      setNuovaChiusuraMotivo('');
      await loadChiusure();
      await loadCalendario(calYear, calMonth);
    } catch (e) { alert(e.message); }
    finally { setChiusuraLoading(false); }
  }

  async function handleDeleteChiusura(id) {
    try {
      await adminApi.deleteChiusura(id);
      await loadChiusure();
      await loadCalendario(calYear, calMonth);
    } catch (e) { alert(e.message); }
  }

  // ─── Photo upload helper ─────────────────────────────────────────────────────

  async function handlePhotoFile(file, setter) {
    if (!file) return;
    try { setter(await compressImage(file)); } catch (_) {}
  }

  function PhotoUpload({ label, value, onChange, inputRef }) {
    return (
      <div className="ac-photo-field">
        <span className="ac-label">{label}</span>
        <div
          className={`ac-photo-upload${value ? ' has-photo' : ''}`}
          onClick={() => inputRef.current?.click()}
        >
          {value ? (
            <img src={value} alt={label} className="ac-photo-img" />
          ) : (
            <div className="ac-photo-empty">
              <IconCamera />
              <span>Tocca per scattare / caricare</span>
            </div>
          )}
          <input
            type="file"
            ref={inputRef}
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => handlePhotoFile(e.target.files[0], onChange)}
          />
        </div>
        {value && (
          <button className="ac-photo-remove" onClick={() => onChange(null)}>
            Rimuovi foto
          </button>
        )}
      </div>
    );
  }

  // ─── LOGIN SCREEN ────────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div className="ac-login">
        <div className="ac-login-card">
          <div className="ac-login-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/>
              <path d="M15 6a1 1 0 000-2h-3l-3 9 2 1"/><path d="M9 6l1 4h7l-2-4H9z"/>
            </svg>
          </div>
          <h1 className="ac-login-title">Admin Panel</h1>
          <p className="ac-login-sub">Bike Rental Tarzo</p>
          {error && <div className="ac-error-banner">{error}</div>}
          <div className="ac-field">
            <label className="ac-label">Token amministratore</label>
            <input
              className="ac-input"
              type="password"
              placeholder="••••••••••••"
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && login()}
              autoFocus
            />
          </div>
          <button className="ac-btn primary full" onClick={login} disabled={loading || !token}>
            {loading ? 'Accesso…' : 'Accedi →'}
          </button>
        </div>
      </div>
    );
  }

  // ─── MAIN LAYOUT ─────────────────────────────────────────────────────────────

  // Late returns count for badge
  const lateCount = oggiData?.inRitardo?.length || 0;

  return (
    <div className="ac-layout">

      {/* ── Sidebar ── */}
      <aside className="ac-sidebar">
        <div className="ac-sidebar-brand">
          <div className="ac-sidebar-logomark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/>
              <path d="M15 6a1 1 0 000-2h-3l-3 9 2 1"/><path d="M9 6l1 4h7l-2-4H9z"/>
            </svg>
          </div>
          <div>
            <div className="ac-sidebar-title">BIKE RENTAL</div>
            <div className="ac-sidebar-subtitle">TARZO</div>
          </div>
        </div>

        <nav className="ac-nav">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`ac-nav-item${activeView === id ? ' active' : ''}`}
              onClick={() => setActiveView(id)}
            >
              <Icon />
              <span>{label}</span>
              {id === 'oggi' && lateCount > 0 && (
                <span className="ac-nav-badge">{lateCount}</span>
              )}
            </button>
          ))}
        </nav>

        <button className="ac-logout-btn" onClick={logout}>
          <IconLogout />
          <span>Esci</span>
        </button>
      </aside>

      {/* ── Main ── */}
      <div className="ac-main">
        <header className="ac-topbar">
          <h2 className="ac-topbar-title">{VIEW_TITLES[activeView]}</h2>
          <div className="ac-topbar-right">
            <span className="ac-topbar-date">{todayIT()}</span>
            <button className="ac-icon-btn" onClick={refresh} title="Aggiorna">
              <IconRefresh />
            </button>
          </div>
        </header>

        <div className="ac-content">
          {activeView === 'dashboard'    && renderDashboard()}
          {activeView === 'oggi'         && renderOggi()}
          {activeView === 'prenotazioni' && renderPrenotazioni()}
          {activeView === 'flotta'       && renderFlotta()}
          {activeView === 'calendario'   && renderCalendario()}
          {activeView === 'cauzioni'     && renderCauzioni()}
          {activeView === 'clienti'      && renderClienti()}
          {activeView === 'report'       && renderReport()}
          {activeView === 'impostazioni' && renderImpostazioni()}
        </div>
      </div>

      {/* ── Modals ── */}
      {checkinModal  && renderCheckinModal()}
      {checkoutModal && renderCheckoutModal()}
      {fleetModal    && renderFleetModal()}
      {depositModal  && renderDepositModal()}
      {emailModal    && renderEmailModal()}
      {damageModal   && renderDamageModal()}
      {manualModal   && renderManualModal()}
      {noteModal     && renderNoteModal()}

      {/* ── Mobile bottom nav ── */}
      <nav className="ac-bottom-nav">
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`ac-bottom-nav-item${activeView === id ? ' active' : ''}`}
            onClick={() => setActiveView(id)}
          >
            <span className="ac-bottom-nav-icon">
              <Icon />
              {id === 'oggi' && lateCount > 0 && (
                <span className="ac-bottom-nav-badge">{lateCount}</span>
              )}
            </span>
            <span>{label}</span>
          </button>
        ))}
        <button className="ac-bottom-nav-item ac-bottom-nav-logout" onClick={logout}>
          <span className="ac-bottom-nav-icon"><IconLogout /></span>
          <span>Esci</span>
        </button>
      </nav>
    </div>
  );

  // ─── DASHBOARD VIEW ───────────────────────────────────────────────────────────

  function renderDashboard() {
    const late = oggiData?.inRitardo || [];
    const todayPickups  = (oggiData?.ritiri       || []).length;
    const todayReturns  = (oggiData?.restituzioni  || []).length;

    return (
      <div className="ac-dashboard">
        {/* Stats */}
        {stats && (
          <div className="ac-stats-grid">
            <div className="ac-stat-card">
              <div className="ac-stat-icon orange"><IconBike /></div>
              <div>
                <div className="ac-stat-value">{stats.prenotazioni_totali}</div>
                <div className="ac-stat-label">Prenotazioni totali</div>
              </div>
            </div>
            <div className="ac-stat-card">
              <div className="ac-stat-icon green"><IconEuro /></div>
              <div>
                <div className="ac-stat-value">€{Number(stats.incasso_totale).toFixed(0)}</div>
                <div className="ac-stat-label">Incasso totale</div>
              </div>
            </div>
            <div className="ac-stat-card">
              <div className="ac-stat-icon indigo"><IconCalendar /></div>
              <div>
                <div className="ac-stat-value">{stats.prenotazioni_oggi}</div>
                <div className="ac-stat-label">Ritiri oggi</div>
              </div>
            </div>
            <div className="ac-stat-card">
              <div className="ac-stat-icon yellow"><IconClock /></div>
              <div>
                <div className="ac-stat-value">{stats.prenotazioni_future}</div>
                <div className="ac-stat-label">Prenotazioni future</div>
              </div>
            </div>
          </div>
        )}

        {/* Late returns alert */}
        {late.length > 0 && (
          <div className="ac-alert-banner">
            <IconAlert />
            <div>
              <strong>{late.length} {late.length === 1 ? 'bici in ritardo' : 'bici in ritardo'}!</strong>
              <span> — Restituzione scaduta senza checkout registrato.</span>
            </div>
            <button className="ac-btn sm ghost" onClick={() => setActiveView('oggi')}>
              Gestisci →
            </button>
          </div>
        )}

        {/* Today overview */}
        <div className="ac-today-grid">
          <div className="ac-today-card">
            <div className="ac-today-card-header">
              <span className="ac-today-card-title">Ritiri di oggi</span>
              <span className="ac-badge indigo">{todayPickups}</span>
            </div>
            {(oggiData?.ritiri || []).length === 0 ? (
              <p className="ac-empty-sm">Nessun ritiro previsto oggi</p>
            ) : (
              <div className="ac-today-list">
                {(oggiData.ritiri).slice(0, 4).map(b => (
                  <div key={b.id} className="ac-today-row">
                    <span className="ac-today-time">{b.orario_ritiro?.substring(0,5)}</span>
                    <span className="ac-today-name">{b.cliente_nome}</span>
                    <span className="ac-today-bike">#{b.bicicletta_id}</span>
                    {b.checkin_at
                      ? <span className="ac-badge sm green">✓</span>
                      : <span className="ac-badge sm yellow">Attesa</span>}
                  </div>
                ))}
                {oggiData.ritiri.length > 4 && (
                  <div className="ac-today-more" onClick={() => setActiveView('oggi')}>
                    +{oggiData.ritiri.length - 4} altri →
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="ac-today-card">
            <div className="ac-today-card-header">
              <span className="ac-today-card-title">Restituzioni di oggi</span>
              <span className="ac-badge green">{todayReturns}</span>
            </div>
            {(oggiData?.restituzioni || []).length === 0 ? (
              <p className="ac-empty-sm">Nessuna restituzione prevista oggi</p>
            ) : (
              <div className="ac-today-list">
                {(oggiData.restituzioni).slice(0, 4).map(b => (
                  <div key={b.id} className="ac-today-row">
                    <span className="ac-today-time">{b.orario_restituzione?.substring(0,5)}</span>
                    <span className="ac-today-name">{b.cliente_nome}</span>
                    <span className="ac-today-bike">#{b.bicicletta_id}</span>
                    {b.checkout_at
                      ? <span className="ac-badge sm green">✓</span>
                      : <span className="ac-badge sm orange">Attesa</span>}
                  </div>
                ))}
                {oggiData.restituzioni.length > 4 && (
                  <div className="ac-today-more" onClick={() => setActiveView('oggi')}>
                    +{oggiData.restituzioni.length - 4} altri →
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="ac-quick-actions">
          <button className="ac-quick-btn" onClick={() => setActiveView('oggi')}>
            <IconOggi /> Gestisci Oggi
          </button>
          <button className="ac-quick-btn" onClick={() => { setActiveView('prenotazioni'); loadBookings('paid'); }}>
            <IconBookings /> Tutte le Prenotazioni
          </button>
          <button className="ac-quick-btn" onClick={() => { setActiveView('flotta'); loadFlotta(); }}>
            <IconFlotta /> Stato Flotta
          </button>
          <button className="ac-quick-btn" onClick={() => { setActiveView('report'); loadReport(); }}>
            <IconReport /> Report Finanziario
          </button>
        </div>
      </div>
    );
  }

  // ─── OGGI VIEW ────────────────────────────────────────────────────────────────

  function renderOggi() {
    if (oggiLoading) return <div className="ac-spinner-center"><div className="ac-spinner" /></div>;

    const ritiri      = oggiData?.ritiri      || [];
    const restituzioni = oggiData?.restituzioni || [];
    const inRitardo   = oggiData?.inRitardo   || [];

    return (
      <div className="ac-oggi">
        {inRitardo.length > 0 && (
          <div className="ac-alert-banner" style={{ marginBottom: 24 }}>
            <IconAlert />
            <strong>{inRitardo.length} {inRitardo.length === 1 ? 'bici' : 'bici'} in ritardo — restituzione scaduta!</strong>
          </div>
        )}

        <div className="ac-oggi-cols">
          {/* Ritiri */}
          <div className="ac-oggi-col">
            <div className="ac-col-header">
              <div className="ac-col-dot indigo" />
              <h3>Ritiri di oggi <span className="ac-col-count">{ritiri.length}</span></h3>
            </div>
            {ritiri.length === 0
              ? <div className="ac-empty-card">Nessun ritiro previsto oggi</div>
              : ritiri.map(b => (
                <div key={b.id} className={`ac-op-card${b.checkin_at ? ' done' : ''}`}>
                  <div className="ac-op-card-top">
                    <div className="ac-op-time">{b.orario_ritiro?.substring(0,5)}</div>
                    <div className="ac-op-bike">Bici #{b.bicicletta_id}</div>
                    {b.checkin_at
                      ? <span className="ac-badge green sm">✓ Check-in {formatDateTime(b.checkin_at)}</span>
                      : <span className="ac-badge yellow sm">In attesa</span>}
                  </div>
                  <div className="ac-op-name">{b.cliente_nome}</div>
                  <div className="ac-op-meta">
                    {b.cliente_telefono} · {tipoLabel(b.tipo_noleggio)}
                    {b.giorni > 1 && ` · ${b.giorni} giorni`}
                  </div>
                  {parseAccessori(b.accessori).length > 0 && (
                    <div className="ac-op-acc">🎒 {parseAccessori(b.accessori).join(', ')}</div>
                  )}
                  <div className="ac-op-card-actions">
                    {b.firma_at
                      ? (
                        <>
                          <span className="ac-badge green sm"><IconPen /> Contratto firmato</span>
                          <button className="ac-btn ghost sm" onClick={() => handleViewContratto(b.id)} title="Vedi contratto firmato">
                            <IconFileText /> Vedi PDF
                          </button>
                        </>
                      )
                      : (
                        <>
                          <button
                            className="ac-btn primary sm"
                            onClick={() => handleSendFirma(b.id)}
                            disabled={firmaLoading[b.id]}
                            title="Invia link contratto via email"
                          >
                            <IconMail /> {firmaLoading[b.id] ? 'Invio…' : 'Invia contratto'}
                          </button>
                          <button className="ac-btn ghost sm" onClick={() => copyFirmaLink(b.id)} title="Copia link"><IconLink /></button>
                        </>
                      )}
                    {!b.checkin_at && (
                      <button
                        className="ac-btn green sm"
                        onClick={() => { setCheckinModal(b); setCheckinNote(''); setDocFoto(null); setBiciFotoOut(null); }}
                      >
                        Check-in →
                      </button>
                    )}
                  </div>
                </div>
              ))
            }
          </div>

          {/* Restituzioni */}
          <div className="ac-oggi-col">
            <div className="ac-col-header">
              <div className="ac-col-dot green" />
              <h3>Restituzioni di oggi <span className="ac-col-count">{restituzioni.length}</span></h3>
            </div>
            {restituzioni.length === 0
              ? <div className="ac-empty-card">Nessuna restituzione prevista oggi</div>
              : restituzioni.map(b => (
                <div key={b.id} className={`ac-op-card${b.checkout_at ? ' done' : ''}`}>
                  <div className="ac-op-card-top">
                    <div className="ac-op-time">{b.orario_restituzione?.substring(0,5)}</div>
                    <div className="ac-op-bike">Bici #{b.bicicletta_id}</div>
                    {b.checkout_at
                      ? <span className="ac-badge green sm">✓ Checkout {formatDateTime(b.checkout_at)}</span>
                      : <span className="ac-badge orange sm">Da restituire</span>}
                  </div>
                  <div className="ac-op-name">{b.cliente_nome}</div>
                  <div className="ac-op-meta">
                    {b.cliente_telefono} · Partito: {formatDateIT(b.data_ritiro)}
                  </div>
                  {parseAccessori(b.accessori).length > 0 && (
                    <div className="ac-op-acc">🎒 {parseAccessori(b.accessori).join(', ')}</div>
                  )}
                  {!b.checkout_at && (
                    <button
                      className="ac-btn green sm"
                      onClick={() => { setCheckoutModal(b); setCheckoutNote(''); setBiciFotoIn(null); }}
                    >
                      Registra Checkout →
                    </button>
                  )}
                </div>
              ))
            }
          </div>

          {/* In ritardo */}
          {inRitardo.length > 0 && (
            <div className="ac-oggi-col">
              <div className="ac-col-header">
                <div className="ac-col-dot red" />
                <h3>In ritardo <span className="ac-col-count red">{inRitardo.length}</span></h3>
              </div>
              {inRitardo.map(b => (
                <div key={b.id} className="ac-op-card late">
                  <div className="ac-op-card-top">
                    <div className="ac-op-time red">Scad. {formatDateIT(b.data_restituzione)}</div>
                    <div className="ac-op-bike">Bici #{b.bicicletta_id}</div>
                    <span className="ac-badge red sm">In ritardo</span>
                  </div>
                  <div className="ac-op-name">{b.cliente_nome}</div>
                  <div className="ac-op-meta">{b.cliente_telefono} · Previsto {b.orario_restituzione?.substring(0,5)}</div>
                  <button
                    className="ac-btn danger sm"
                    onClick={() => { setCheckoutModal(b); setCheckoutNote(''); setBiciFotoIn(null); }}
                  >
                    Registra Rientro →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── PRENOTAZIONI VIEW ────────────────────────────────────────────────────────

  function renderPrenotazioni() {
    const FILTERS = [
      { key: 'paid',      label: 'Confermate' },
      { key: 'pending',   label: 'In Attesa'  },
      { key: 'cancelled', label: 'Cancellate' },
    ];

    const filteredBookings = searchQuery.trim()
      ? bookings.filter(b => {
          const q = searchQuery.toLowerCase();
          return (
            (b.cliente_nome     || '').toLowerCase().includes(q) ||
            (b.cliente_email    || '').toLowerCase().includes(q) ||
            (b.cliente_telefono || '').toLowerCase().includes(q) ||
            b.id.toLowerCase().includes(q)
          );
        })
      : bookings;

    return (
      <div>
        <div className="ac-controls">
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`ac-filter-btn${filter === f.key ? ' active' : ''}`}
              onClick={() => loadBookings(f.key)}
            >{f.label}</button>
          ))}
          <button className="ac-filter-btn refresh" onClick={refresh}>
            <IconRefresh /> Aggiorna
          </button>
          <button
            className="ac-btn ghost sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => exportCSV(filteredBookings)}
            title="Esporta CSV"
          >
            <IconDownload /> CSV
          </button>
          <button
            className="ac-btn primary sm"
            onClick={() => {
              const prezzoDefault = String(calcPrezzoManual('intera_giornata', 2));
              setManualForm({ ...MANUAL_EMPTY, prezzo_totale: prezzoDefault });
              setManualError(null);
              setManualModal(true);
            }}
          >
            + Nuova Prenotazione
          </button>
        </div>

        <div className="ac-search-row">
          <div className="ac-search-box">
            <IconSearch />
            <input
              className="ac-search-input"
              type="text"
              placeholder="Cerca per nome, email, telefono, codice…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="ac-search-clear" onClick={() => setSearchQuery('')}><IconX /></button>
            )}
          </div>
          {searchQuery && (
            <span className="ac-search-count">{filteredBookings.length} / {bookings.length}</span>
          )}
        </div>

        {error && <div className="ac-error-banner">{error}</div>}

        <div className="ac-table-wrap">
          {loading ? (
            <div className="ac-spinner-center"><div className="ac-spinner" /></div>
          ) : filteredBookings.length === 0 ? (
            <div className="ac-empty-state"><IconBike /><p>Nessuna prenotazione trovata</p></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="ac-table">
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
                    {filter === 'paid' && <th>Firma</th>}
                    {filter === 'paid' && <th>Cauzione</th>}
                    {filter === 'paid' && <th>Note</th>}
                    {filter === 'paid' && <th>Azioni</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map(b => (
                    <tr key={b.id}>
                      <td><span className="ac-code">{b.id.toUpperCase().substring(0, 8)}</span></td>
                      <td>
                        <div className="ac-cell-name">{b.cliente_nome}</div>
                        <div className="ac-cell-sub">{b.cliente_email}</div>
                        <div className="ac-cell-sub">{b.cliente_telefono}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{tipoShort(b.tipo_noleggio)}</div>
                        {b.giorni > 1 && <div className="ac-cell-sub">{b.giorni}g</div>}
                      </td>
                      <td>
                        <div>{formatDateIT(b.data_ritiro)}</div>
                        <div style={{ fontWeight: 700 }}>{b.orario_ritiro?.substring(0, 5)}</div>
                      </td>
                      <td>
                        <div>{formatDateIT(b.data_restituzione)}</div>
                        <div style={{ fontWeight: 700 }}>{b.orario_restituzione?.substring(0, 5)}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>#{b.bicicletta_id}</td>
                      <td><span className="ac-price">€{Number(b.prezzo_totale).toFixed(0)}</span></td>
                      <td>
                        <span className={`ac-badge ${b.pagamento_status}`}>
                          {b.pagamento_status === 'paid' && 'Pagata'}
                          {b.pagamento_status === 'pending' && 'Attesa'}
                          {b.pagamento_status === 'cancelled' && 'Cancellata'}
                        </span>
                      </td>
                      {filter === 'paid' && (
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {b.firma_at
                            ? (
                              <>
                                <span className="ac-badge green sm">✍️ Firmato</span>
                                <button
                                  className="ac-action-btn"
                                  title="Vedi contratto firmato"
                                  onClick={() => handleViewContratto(b.id)}
                                ><IconFileText /></button>
                              </>
                            )
                            : (
                              <>
                                <button
                                  className="ac-action-btn email"
                                  title="Invia link contratto via email"
                                  onClick={() => handleSendFirma(b.id)}
                                  disabled={firmaLoading[b.id]}
                                >{firmaLoading[b.id] ? '…' : <IconMail />}</button>
                                <button className="ac-action-btn" title="Copia link" onClick={() => copyFirmaLink(b.id)}><IconLink /></button>
                              </>
                            )}
                        </td>
                      )}
                      {filter === 'paid' && (
                        <td>
                          {b.cauzione_status === 'authorized' && <span className="ac-badge cauzione-ok">€1.000 bloccati</span>}
                          {b.cauzione_status === 'captured'   && <span className="ac-badge cauzione-cap">€{Number(b.cauzione_captured_amount||0).toFixed(0)} incassati</span>}
                          {b.cauzione_status === 'cancelled'  && <span className="ac-badge muted">Rilasciata</span>}
                          {b.cauzione_status === 'failed'     && <span className="ac-badge red">Non riuscita</span>}
                          {(!b.cauzione_status || b.cauzione_status === 'pending') && <span className="ac-muted-dash">—</span>}
                        </td>
                      )}
                      {filter === 'paid' && (
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className={`ac-action-btn note${b.note_admin ? ' note-active' : ''}`}
                            title={b.note_admin || 'Aggiungi nota interna'}
                            onClick={() => { setNoteModal({ id: b.id, nome: b.cliente_nome }); setNoteText(b.note_admin || ''); }}
                          ><IconNote /></button>
                        </td>
                      )}
                      {filter === 'paid' && (
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {b.cauzione_status === 'authorized' && (
                            <>
                              <button className="ac-action-btn release" onClick={() => setDepositModal({ id: b.id, nome: b.cliente_nome, action: 'release' })}>✓ Rilascia</button>
                              <button className="ac-action-btn capture" onClick={() => setDepositModal({ id: b.id, nome: b.cliente_nome, action: 'capture' })}>⚠ Danni</button>
                            </>
                          )}
                          {b.cauzione_status !== 'authorized' && (
                            <button
                              className="ac-action-btn damage"
                              onClick={() => setDamageModal({ id: b.id, nome: b.cliente_nome })}
                              disabled={!b.stripe_payment_method_id || b.danno_status === 'charged'}
                            >Extra</button>
                          )}
                          <button
                            className="ac-action-btn email"
                            onClick={() => { setEmailModal({ id: b.id, nome: b.cliente_nome, email: b.cliente_email }); setEmailSubject(''); setEmailMessage(''); }}
                          ><IconMail /></button>
                          <button className="ac-action-btn cancel" onClick={() => cancelBooking(b.id)}>Cancella</button>
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
    );
  }

  // ─── FLOTTA VIEW ──────────────────────────────────────────────────────────────

  function renderFlotta() {
    const STATI = ['disponibile', 'noleggiata', 'manutenzione', 'guasto'];
    const statoColor = { disponibile: 'green', noleggiata: 'indigo', manutenzione: 'yellow', guasto: 'red' };

    if (flottaLoading) return <div className="ac-spinner-center"><div className="ac-spinner" /></div>;

    const today = new Date().toISOString().substring(0, 10);
    const soon  = new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10);

    return (
      <div>
        <div className="ac-fleet-grid">
          {flotta.map(bici => {
            const batt = bici.batteria_pct ?? 100;
            const battColor = batt >= 70 ? 'green' : batt >= 30 ? 'yellow' : 'red';
            const maintenanceSoon = bici.prossima_manutenzione && bici.prossima_manutenzione <= soon;
            const maintenanceLate = bici.prossima_manutenzione && bici.prossima_manutenzione < today;
            return (
              <div key={bici.id} className="ac-fleet-card">
                <div className="ac-fleet-card-top">
                  <div className="ac-fleet-num">
                    <div className="ac-fleet-icon"><IconBike /></div>
                    <div>
                      <div className="ac-fleet-name">{bici.nome}</div>
                      <div className="ac-cell-sub">{bici.tipo}</div>
                    </div>
                  </div>
                  <span className={`ac-badge ${statoColor[bici.stato] || 'muted'}`}>
                    {bici.stato || 'disponibile'}
                  </span>
                </div>

                <div className="ac-fleet-battery">
                  <div className="ac-fleet-battery-row">
                    <span className="ac-label"><IconBattery /> Batteria</span>
                    <span className={`ac-batt-pct ${battColor}`}>{batt}%</span>
                  </div>
                  <div className="ac-batt-track">
                    <div className={`ac-batt-fill ${battColor}`} style={{ width: `${batt}%` }} />
                  </div>
                </div>

                {(bici.ultima_manutenzione || bici.prossima_manutenzione) && (
                  <div className="ac-fleet-maint">
                    {bici.ultima_manutenzione && (
                      <div className="ac-maint-row">
                        <IconTool />
                        <span>Ultima: {formatDateLong(bici.ultima_manutenzione)}</span>
                      </div>
                    )}
                    {bici.prossima_manutenzione && (
                      <div className={`ac-maint-row${maintenanceLate ? ' red' : maintenanceSoon ? ' yellow' : ''}`}>
                        <IconCalendar />
                        <span>Prossima: {formatDateLong(bici.prossima_manutenzione)}</span>
                        {maintenanceLate && <span className="ac-badge red sm">Scaduta</span>}
                        {!maintenanceLate && maintenanceSoon && <span className="ac-badge yellow sm">Imminente</span>}
                      </div>
                    )}
                  </div>
                )}

                {bici.note_admin && (
                  <div className="ac-fleet-note">{bici.note_admin}</div>
                )}

                <button
                  className="ac-btn ghost sm full"
                  onClick={() => {
                    setFleetModal(bici);
                    setFleetEdit({
                      stato:                bici.stato || 'disponibile',
                      batteria_pct:         bici.batteria_pct ?? 100,
                      note_admin:           bici.note_admin || '',
                      ultima_manutenzione:  bici.ultima_manutenzione || '',
                      prossima_manutenzione: bici.prossima_manutenzione || '',
                    });
                  }}
                >
                  <IconEdit /> Modifica
                </button>
              </div>
            );
          })}
        </div>
        {flotta.length === 0 && !flottaLoading && (
          <div className="ac-empty-state"><IconFlotta /><p>Nessuna bici trovata — esegui le migrazioni SQL</p></div>
        )}
      </div>
    );
  }

  // ─── REPORT VIEW ─────────────────────────────────────────────────────────────

  function renderReport() {
    if (reportLoading) return <div className="ac-spinner-center"><div className="ac-spinner" /></div>;
    if (!report) return (
      <div className="ac-empty-state">
        <IconReport />
        <p>Nessun dato disponibile</p>
        <button className="ac-btn primary sm" onClick={loadReport}>Carica Report</button>
      </div>
    );

    const maxRev = Math.max(...(report.by_month || []).map(m => m.revenue), 1);
    const tipoLabels = { mezza_mattina: '½ Mattina', mezza_pomeriggio: '½ Pomeriggio', intera_giornata: 'Giornata', multi_giorno: 'Multi-giorno', '4_ore': '4 Ore', '3_piu_giorni': '3+ Giorni' };

    return (
      <div className="ac-report">
        <div className="ac-report-stats">
          <div className="ac-report-stat">
            <div className="ac-stat-label">Incasso Totale</div>
            <div className="ac-stat-value">€{Number(report.total_revenue).toFixed(0)}</div>
          </div>
          <div className="ac-report-stat">
            <div className="ac-stat-label">Prenotazioni Pagate</div>
            <div className="ac-stat-value">{report.total_bookings}</div>
          </div>
          <div className="ac-report-stat">
            <div className="ac-stat-label">Valore Medio</div>
            <div className="ac-stat-value">€{Number(report.avg_booking).toFixed(0)}</div>
          </div>
        </div>

        <div className="ac-report-section">
          <h3 className="ac-section-title">Andamento Mensile</h3>
          <div className="ac-bar-chart">
            {(report.by_month || []).map(({ month, revenue }) => (
              <div key={month} className="ac-bar-row">
                <span className="ac-bar-month">{formatMonth(month)}</span>
                <div className="ac-bar-track">
                  <div
                    className="ac-bar-fill"
                    style={{ width: `${(revenue / maxRev) * 100}%` }}
                  />
                </div>
                <span className="ac-bar-value">€{revenue.toFixed(0)}</span>
              </div>
            ))}
            {(report.by_month || []).length === 0 && (
              <p className="ac-empty-sm">Nessun dato per il periodo selezionato</p>
            )}
          </div>
        </div>

        <div className="ac-report-section">
          <h3 className="ac-section-title">Per Tipo di Noleggio</h3>
          <div className="ac-type-table">
            {Object.entries(report.by_type || {}).sort(([,a],[,b]) => b-a).map(([tipo, rev]) => (
              <div key={tipo} className="ac-type-row">
                <span className="ac-type-label">{tipoLabels[tipo] || tipo}</span>
                <span className="ac-type-value">€{Number(rev).toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>

        {occupazione && occupazione.length > 0 && (
          <div className="ac-report-section">
            <h3 className="ac-section-title">Tasso di Occupazione — Ultimi 6 Mesi</h3>
            <div className="ac-occ-chart">
              {occupazione.map(m => (
                <div key={m.month} className="ac-occ-col">
                  <div className="ac-occ-val">{m.pct}%</div>
                  <div className="ac-occ-bar-wrap">
                    <div
                      className={`ac-occ-bar${m.pct >= 70 ? ' high' : m.pct >= 40 ? ' mid' : ' low'}`}
                      style={{ height: `${Math.max(m.pct, 2)}%` }}
                    />
                  </div>
                  <div className="ac-occ-label">{formatMonth(m.month)}</div>
                  <div className="ac-occ-days">{m.booked_days}/{m.total_days}g</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {occupazioneLoading && (
          <div className="ac-report-section">
            <div className="ac-spinner-center"><div className="ac-spinner" /></div>
          </div>
        )}
      </div>
    );
  }

  // ─── CALENDARIO VIEW ─────────────────────────────────────────────────────────

  function renderCalendario() {
    const MESI   = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
    const GIORNI = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
    const TOTALE = 10;
    const chiusureSet = new Set(chiusure.map(c => c.data));
    const today       = new Date().toISOString().substring(0, 10);

    function prevMonth() {
      let nm = calMonth - 1, ny = calYear;
      if (nm < 1) { nm = 12; ny--; }
      setCalYear(ny); setCalMonth(nm); setCalData(null); setCalSelDay(null);
      loadCalendario(ny, nm);
    }
    function nextMonth() {
      let nm = calMonth + 1, ny = calYear;
      if (nm > 12) { nm = 1; ny++; }
      setCalYear(ny); setCalMonth(nm); setCalData(null); setCalSelDay(null);
      loadCalendario(ny, nm);
    }

    // Build cells array
    const firstDow   = new Date(calYear, calMonth - 1, 1).getDay();
    const startOff   = firstDow === 0 ? 6 : firstDow - 1;
    const daysInMon  = new Date(calYear, calMonth, 0).getDate();
    const cells      = [...Array(startOff).fill(null), ...Array.from({ length: daysInMon }, (_, i) => i + 1)];
    while (cells.length % 7 !== 0) cells.push(null);

    function getStatus(dateStr) {
      if (chiusureSet.has(dateStr)) return 'closed';
      if (!calData?.[dateStr]) return 'unknown';
      const { disponibili } = calData[dateStr];
      if (disponibili >= 7) return 'available';
      if (disponibili >= 4) return 'partial';
      if (disponibili >= 1) return 'tight';
      return 'full';
    }

    function getDayLabel(dateStr) {
      if (chiusureSet.has(dateStr)) return 'Chiuso';
      if (!calData?.[dateStr]) return null;
      return `${calData[dateStr].disponibili}/${TOTALE}`;
    }

    const selectedChiusura = calSelDay ? chiusure.find(c => c.data === calSelDay) : null;

    return (
      <div className="ac-calendario">
        {/* Calendar grid */}
        <div className="ac-cal-main">
          <div className="ac-cal-nav">
            <button className="ac-btn ghost sm" onClick={prevMonth}>‹ Prec.</button>
            <h3 className="ac-cal-title">{MESI[calMonth - 1]} {calYear}</h3>
            <button className="ac-btn ghost sm" onClick={nextMonth}>Succ. ›</button>
          </div>

          {calLoading ? (
            <div className="ac-spinner-center"><div className="ac-spinner" /></div>
          ) : (
            <div className="ac-cal-grid">
              {GIORNI.map(g => (
                <div key={g} className="ac-cal-header-cell">{g}</div>
              ))}
              {cells.map((day, i) => {
                if (day === null) return <div key={`e${i}`} className="ac-cal-cell empty" />;
                const dateStr   = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const status    = getStatus(dateStr);
                const label     = getDayLabel(dateStr);
                const isToday   = dateStr === today;
                const isSel     = dateStr === calSelDay;
                const cMotivo   = chiusure.find(ch => ch.data === dateStr)?.motivo;
                return (
                  <div
                    key={day}
                    className={`ac-cal-cell ${status}${isToday ? ' today' : ''}${isSel ? ' selected' : ''}`}
                    onClick={() => setCalSelDay(isSel ? null : dateStr)}
                    title={cMotivo || undefined}
                  >
                    <span className="ac-cal-day-num">{day}</span>
                    {label && <span className="ac-cal-day-label">{label}</span>}
                    {cMotivo && <span className="ac-cal-day-motivo">{cMotivo}</span>}
                  </div>
                );
              })}
            </div>
          )}

          <div className="ac-cal-legend">
            <div className="ac-legend-item"><div className="ac-legend-dot available" />7–10 libere</div>
            <div className="ac-legend-item"><div className="ac-legend-dot partial"   />4–6 libere</div>
            <div className="ac-legend-item"><div className="ac-legend-dot tight"     />1–3 libere</div>
            <div className="ac-legend-item"><div className="ac-legend-dot full"      />Esaurito</div>
            <div className="ac-legend-item"><div className="ac-legend-dot closed"    />Chiuso</div>
          </div>

          {calSelDay && (
            <div className="ac-cal-detail">
              <div className="ac-cal-detail-header">
                <h4>{formatDateLong(calSelDay)}</h4>
                <button className="ac-icon-btn" onClick={() => setCalSelDay(null)}><IconX /></button>
              </div>
              {selectedChiusura ? (
                <div className="ac-cal-detail-closed">
                  <IconBlock />
                  <span>Negozio chiuso{selectedChiusura.motivo ? ` — ${selectedChiusura.motivo}` : ''}</span>
                  <button
                    className="ac-btn danger sm"
                    onClick={() => handleDeleteChiusura(selectedChiusura.id)}
                  >Rimuovi blocco</button>
                </div>
              ) : (
                <div className="ac-cal-detail-avail">
                  {calData?.[calSelDay] && (
                    <span className={`ac-badge ${getStatus(calSelDay)}`}>
                      {calData[calSelDay].disponibili}/{TOTALE} bici disponibili
                    </span>
                  )}
                  <button
                    className="ac-btn ghost sm"
                    onClick={() => setNuovaChiusura(calSelDay)}
                    title="Blocca questa data"
                  >
                    <IconBlock /> Blocca data
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chiusure management panel */}
        <div className="ac-chiusure-panel">
          <h3 className="ac-section-title">Blocco Date</h3>
          <p className="ac-chiusure-desc">Le date bloccate non saranno prenotabili online.</p>

          <div className="ac-chiusura-form">
            <div>
              <label className="ac-label">Data da bloccare</label>
              <input
                className="ac-input"
                type="date"
                value={nuovaChiusura}
                onChange={e => setNuovaChiusura(e.target.value)}
              />
            </div>
            <div>
              <label className="ac-label">Motivazione (opz.)</label>
              <input
                className="ac-input"
                type="text"
                placeholder="Es. Chiusura estiva, Fiera..."
                value={nuovaChiusuraMotivo}
                onChange={e => setNuovaChiusuraMotivo(e.target.value)}
              />
            </div>
            <button
              className="ac-btn primary sm"
              onClick={handleAddChiusura}
              disabled={!nuovaChiusura || chiusuraLoading}
            >
              <IconBlock /> {chiusuraLoading ? 'Salvataggio…' : '+ Blocca data'}
            </button>
          </div>

          <div>
            <div className="ac-section-title" style={{ marginBottom: 8 }}>Programmate</div>
            <div className="ac-chiusure-list">
              {chiusure.length === 0 ? (
                <div className="ac-empty-sm">Nessuna chiusura programmata</div>
              ) : (
                chiusure.map(c => (
                  <div key={c.id} className="ac-chiusura-row">
                    <div>
                      <div className="ac-chiusura-date">{formatDateLong(c.data)}</div>
                      {c.motivo && <div className="ac-cell-sub">{c.motivo}</div>}
                    </div>
                    <button
                      className="ac-btn danger sm"
                      onClick={() => handleDeleteChiusura(c.id)}
                    >Rimuovi</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── MODALS ───────────────────────────────────────────────────────────────────

  function renderCheckinModal() {
    const b = checkinModal;
    return (
      <div className="ac-overlay" onClick={e => e.target === e.currentTarget && setCheckinModal(null)}>
        <div className="ac-modal">
          <div className="ac-modal-header">
            <h2>Check-in — {b.cliente_nome}</h2>
            <button className="ac-icon-btn" onClick={() => setCheckinModal(null)}><IconX /></button>
          </div>
          <div className="ac-modal-info">
            Bici <strong>#{b.bicicletta_id}</strong> · {tipoLabel(b.tipo_noleggio)} · {formatDateIT(b.data_ritiro)} {b.orario_ritiro?.substring(0,5)}
          </div>

          <div className="ac-modal-firma-row">
            {b.firma_at ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="ac-badge green">✍️ Contratto firmato da {b.firma_nome} — {formatDateTime(b.firma_at)}</span>
                <button className="ac-btn primary sm" onClick={() => handleViewContratto(b.id)} title="Apri contratto firmato">
                  <IconFileText /> Vedi contratto
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="ac-badge yellow">Contratto non firmato</span>
                <button
                  className="ac-btn primary sm"
                  onClick={() => handleSendFirma(b.id)}
                  disabled={firmaLoading[b.id]}
                >
                  <IconMail /> {firmaLoading[b.id] ? 'Invio…' : 'Invia via email'}
                </button>
                <button className="ac-btn ghost sm" onClick={() => copyFirmaLink(b.id)} title="Copia link">
                  <IconLink /> Copia link
                </button>
              </div>
            )}
          </div>

          <div style={{ padding: '14px 22px 4px', borderTop: '1px solid #1A2840' }}>
            <span className="ac-label" style={{ fontSize: '0.7rem', color: '#4ADE80' }}>📷 Foto da scattare al ritiro</span>
          </div>

          <div className="ac-photo-grid">
            <PhotoUpload label="Documento identità" value={docFoto} onChange={setDocFoto} inputRef={docFotoRef} />
            <PhotoUpload label="Bici alla consegna" value={biciFotoOut} onChange={setBiciFotoOut} inputRef={bikeOutRef} />
          </div>

          <div className="ac-field">
            <label className="ac-label">Note (opzionale)</label>
            <textarea className="ac-textarea" rows={3} placeholder="Es. Casco taglia L, ruote gonfie..." value={checkinNote} onChange={e => setCheckinNote(e.target.value)} />
          </div>

          <div className="ac-modal-footer">
            <button className="ac-btn primary full" onClick={handleCheckin} disabled={checkinLoading}>
              {checkinLoading ? 'Salvataggio…' : '✓ Conferma Check-in'}
            </button>
            <button className="ac-btn ghost" onClick={() => setCheckinModal(null)} disabled={checkinLoading}>Annulla</button>
          </div>
        </div>
      </div>
    );
  }

  function renderCheckoutModal() {
    const b = checkoutModal;
    return (
      <div className="ac-overlay" onClick={e => e.target === e.currentTarget && setCheckoutModal(null)}>
        <div className="ac-modal">
          <div className="ac-modal-header">
            <h2>Checkout — {b.cliente_nome}</h2>
            <button className="ac-icon-btn" onClick={() => setCheckoutModal(null)}><IconX /></button>
          </div>
          <div className="ac-modal-info">
            Bici <strong>#{b.bicicletta_id}</strong> · Restituzione prevista {formatDateIT(b.data_restituzione)} {b.orario_restituzione?.substring(0,5)}
          </div>

          <div style={{ padding: '14px 22px 4px', borderTop: '1px solid #1A2840' }}>
            <span className="ac-label" style={{ fontSize: '0.7rem', color: '#4ADE80' }}>📷 Foto da scattare al rientro</span>
          </div>
          <div style={{ padding: '0 22px 14px' }}>
            <PhotoUpload label="Bici al rientro" value={biciFotoIn} onChange={setBiciFotoIn} inputRef={bikeInRef} />
          </div>

          <div className="ac-field">
            <label className="ac-label">Note rientro (danni, osservazioni…)</label>
            <textarea className="ac-textarea" rows={3} placeholder="Es. Graffio sul parafango anteriore..." value={checkoutNote} onChange={e => setCheckoutNote(e.target.value)} />
          </div>

          <div className="ac-modal-footer">
            <button className="ac-btn green full" onClick={handleCheckout} disabled={checkoutLoading}>
              {checkoutLoading ? 'Salvataggio…' : '✓ Registra Rientro'}
            </button>
            <button className="ac-btn ghost" onClick={() => setCheckoutModal(null)} disabled={checkoutLoading}>Annulla</button>
          </div>
        </div>
      </div>
    );
  }

  function renderFleetModal() {
    const STATI = ['disponibile', 'noleggiata', 'manutenzione', 'guasto'];
    return (
      <div className="ac-overlay" onClick={e => e.target === e.currentTarget && setFleetModal(null)}>
        <div className="ac-modal">
          <div className="ac-modal-header">
            <h2>Modifica — {fleetModal.nome}</h2>
            <button className="ac-icon-btn" onClick={() => setFleetModal(null)}><IconX /></button>
          </div>

          <div className="ac-field">
            <label className="ac-label">Stato</label>
            <select className="ac-select" value={fleetEdit.stato} onChange={e => setFleetEdit(p => ({ ...p, stato: e.target.value }))}>
              {STATI.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="ac-field">
            <label className="ac-label">Carica batteria ({fleetEdit.batteria_pct}%)</label>
            <input className="ac-input" type="range" min="0" max="100" value={fleetEdit.batteria_pct}
              onChange={e => setFleetEdit(p => ({ ...p, batteria_pct: Number(e.target.value) }))} />
          </div>
          <div className="ac-field">
            <label className="ac-label">Ultima manutenzione</label>
            <input className="ac-input" type="date" value={fleetEdit.ultima_manutenzione}
              onChange={e => setFleetEdit(p => ({ ...p, ultima_manutenzione: e.target.value }))} />
          </div>
          <div className="ac-field">
            <label className="ac-label">Prossima manutenzione</label>
            <input className="ac-input" type="date" value={fleetEdit.prossima_manutenzione}
              onChange={e => setFleetEdit(p => ({ ...p, prossima_manutenzione: e.target.value }))} />
          </div>
          <div className="ac-field">
            <label className="ac-label">Note admin</label>
            <textarea className="ac-textarea" rows={2} value={fleetEdit.note_admin}
              onChange={e => setFleetEdit(p => ({ ...p, note_admin: e.target.value }))} />
          </div>

          <div className="ac-modal-footer">
            <button className="ac-btn primary full" onClick={handleFleetSave} disabled={fleetLoading}>
              {fleetLoading ? 'Salvataggio…' : 'Salva Modifiche'}
            </button>
            <button className="ac-btn ghost" onClick={() => setFleetModal(null)} disabled={fleetLoading}>Annulla</button>
          </div>
        </div>
      </div>
    );
  }

  function renderDepositModal() {
    return (
      <div className="ac-overlay" onClick={e => e.target === e.currentTarget && setDepositModal(null)}>
        <div className="ac-modal">
          <div className="ac-modal-header">
            <h2>{depositModal.action === 'release' ? '✓ Rilascia Cauzione' : '⚠ Incassa Danni'}</h2>
            <button className="ac-icon-btn" onClick={() => setDepositModal(null)}><IconX /></button>
          </div>
          <div className="ac-modal-info">Cliente: <strong>{depositModal.nome}</strong></div>

          {depositModal.action === 'release' ? (
            <p className="ac-modal-desc">
              I <strong style={{ color: '#4ADE80' }}>€1.000 bloccati</strong> sulla carta del cliente verranno sbloccati immediatamente. Operazione irreversibile.
            </p>
          ) : (
            <div className="ac-field">
              <label className="ac-label">Importo danni da trattenere (max €1.000)</label>
              <input className="ac-input" type="number" min="1" max="1000" step="0.01" placeholder="es. 150"
                value={depositAmount} onChange={e => setDepositAmount(e.target.value)} autoFocus />
            </div>
          )}

          <div className="ac-modal-footer">
            <button
              className={`ac-btn full${depositModal.action === 'release' ? ' green' : ' primary'}`}
              onClick={handleDeposit}
              disabled={depositLoading || (depositModal.action === 'capture' && !depositAmount)}
            >
              {depositLoading ? 'In corso…' : depositModal.action === 'release' ? '✓ Sblocca €1.000' : `⚠ Incassa €${parseFloat(depositAmount || 0).toFixed(2)}`}
            </button>
            <button className="ac-btn ghost" onClick={() => { setDepositModal(null); setDepositAmount(''); }} disabled={depositLoading}>Annulla</button>
          </div>
        </div>
      </div>
    );
  }

  function renderEmailModal() {
    return (
      <div className="ac-overlay" onClick={e => e.target === e.currentTarget && setEmailModal(null)}>
        <div className="ac-modal" style={{ maxWidth: 520 }}>
          <div className="ac-modal-header">
            <h2>✉ Invia Email</h2>
            <button className="ac-icon-btn" onClick={() => setEmailModal(null)}><IconX /></button>
          </div>
          <div className="ac-modal-info">A: <strong>{emailModal.nome}</strong> &lt;{emailModal.email}&gt;</div>

          <div className="ac-field">
            <label className="ac-label">Template rapido</label>
            <select className="ac-select" onChange={e => { const t = EMAIL_TEMPLATES[e.target.value]; if (t) { setEmailSubject(t.subject); setEmailMessage(t.message); } }} defaultValue="">
              <option value="" disabled>Scegli template…</option>
              {EMAIL_TEMPLATES.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
            </select>
          </div>
          <div className="ac-field">
            <label className="ac-label">Oggetto</label>
            <input className="ac-input" type="text" placeholder="Oggetto email" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
          </div>
          <div className="ac-field">
            <label className="ac-label">Messaggio</label>
            <textarea className="ac-textarea" rows={7} value={emailMessage} onChange={e => setEmailMessage(e.target.value)} />
          </div>

          <div className="ac-modal-footer">
            <button className="ac-btn primary full" onClick={handleSendEmail} disabled={emailLoading || !emailSubject.trim() || !emailMessage.trim()}>
              {emailLoading ? 'Invio…' : '✉ Invia'}
            </button>
            <button className="ac-btn ghost" onClick={() => setEmailModal(null)} disabled={emailLoading}>Annulla</button>
          </div>
        </div>
      </div>
    );
  }

  function renderDamageModal() {
    return (
      <div className="ac-overlay" onClick={e => e.target === e.currentTarget && setDamageModal(null)}>
        <div className="ac-modal">
          <div className="ac-modal-header">
            <h2>Addebita Danno Extra</h2>
            <button className="ac-icon-btn" onClick={() => setDamageModal(null)}><IconX /></button>
          </div>
          <div className="ac-modal-info">Cliente: <strong>{damageModal.nome}</strong></div>

          <div className="ac-field">
            <label className="ac-label">Importo (€) — max €5.000</label>
            <input className="ac-input" type="number" min="1" max="5000" step="0.01" placeholder="es. 80"
              value={damageAmount} onChange={e => setDamageAmount(e.target.value)} autoFocus />
          </div>
          <div className="ac-field">
            <label className="ac-label">Motivo (opzionale)</label>
            <input className="ac-input" type="text" placeholder="Es. Ruota anteriore rotta"
              value={damageMotivo} onChange={e => setDamageMotivo(e.target.value)} />
          </div>

          <div className="ac-modal-footer">
            <button className="ac-btn danger full" onClick={chargeDamage} disabled={damageLoading || !damageAmount}>
              {damageLoading ? 'Addebito…' : 'Addebita'}
            </button>
            <button className="ac-btn ghost" onClick={() => { setDamageModal(null); setDamageAmount(''); setDamageMotivo(''); }} disabled={damageLoading}>Annulla</button>
          </div>
        </div>
      </div>
    );
  }

  function renderManualModal() {
    const f = manualForm;
    const isMulti = f.tipo_noleggio === 'multi_giorno';
    const accList = [
      { key: 'casco',    label: 'Casco' },
      { key: 'lucchetto', label: 'Lucchetto' },
      { key: 'kit_foro', label: 'Kit Foratura' },
    ];
    function toggleAcc(key) {
      setManualForm(prev => ({
        ...prev,
        accessori: prev.accessori.includes(key)
          ? prev.accessori.filter(k => k !== key)
          : [...prev.accessori, key],
      }));
    }

    return (
      <div className="ac-overlay" onClick={e => e.target === e.currentTarget && setManualModal(false)}>
        <div className="ac-modal" style={{ maxWidth: 540 }}>
          <div className="ac-modal-header">
            <h2>+ Nuova Prenotazione Manuale</h2>
            <button className="ac-icon-btn" onClick={() => setManualModal(false)}><IconX /></button>
          </div>
          <div className="ac-modal-info">
            Prenotazione diretta (walk-in / telefono) — segnata come <strong style={{ color: '#4ADE80' }}>pagata</strong>
          </div>

          {manualError && <div style={{ padding: '10px 22px 0' }}><div className="ac-error-banner">{manualError}</div></div>}

          {/* Dati prenotazione */}
          <div style={{ padding: '16px 22px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
            <div className="ac-field" style={{ padding: 0, marginBottom: 12 }}>
              <label className="ac-label">Data ritiro *</label>
              <input className="ac-input" type="date" value={f.data_ritiro}
                onChange={e => setManualField('data_ritiro', e.target.value)} />
            </div>
            <div className="ac-field" style={{ padding: 0, marginBottom: 12 }}>
              <label className="ac-label">Tipo noleggio *</label>
              <select className="ac-select" value={f.tipo_noleggio}
                onChange={e => setManualField('tipo_noleggio', e.target.value)}>
                <option value="mezza_mattina">½ Mattina (09–13)</option>
                <option value="mezza_pomeriggio">½ Pomeriggio (14–18)</option>
                <option value="intera_giornata">Giornata intera (09–18)</option>
                <option value="multi_giorno">Multi-giorno</option>
              </select>
            </div>
            {isMulti && (
              <div className="ac-field" style={{ padding: 0, marginBottom: 12 }}>
                <label className="ac-label">Numero giorni</label>
                <input className="ac-input" type="number" min="2" max="30"
                  value={f.giorni} onChange={e => setManualField('giorni', e.target.value)} />
              </div>
            )}
            <div className="ac-field" style={{ padding: 0, marginBottom: 12 }}>
              <label className="ac-label">Bici # (vuoto = auto)</label>
              <select className="ac-select" value={f.bicicletta_id}
                onChange={e => setManualField('bicicletta_id', e.target.value)}>
                <option value="">Auto-assegna</option>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>Bici #{n}</option>)}
              </select>
            </div>
          </div>

          {/* Prezzo e pagamento */}
          <div style={{ padding: '0 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
            <div className="ac-field" style={{ padding: 0, marginBottom: 12 }}>
              <label className="ac-label">Prezzo (€) — auto-calcolato</label>
              <input className="ac-input" type="number" min="0" step="0.01"
                value={f.prezzo_totale}
                onChange={e => setManualForm(p => ({ ...p, prezzo_totale: e.target.value, _prezzoCambiato: true }))}
                placeholder={String(calcPrezzoManual(f.tipo_noleggio, f.giorni))} />
            </div>
            <div className="ac-field" style={{ padding: 0, marginBottom: 12 }}>
              <label className="ac-label">Metodo pagamento</label>
              <select className="ac-select" value={f.note_pagamento}
                onChange={e => setManualField('note_pagamento', e.target.value)}>
                <option>Contanti</option>
                <option>POS / Carta</option>
                <option>Bonifico</option>
                <option>Non ancora pagato</option>
              </select>
            </div>
          </div>

          {/* Dati cliente */}
          <div style={{ padding: '0 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
            <div className="ac-field" style={{ padding: 0, marginBottom: 12 }}>
              <label className="ac-label">Nome cliente *</label>
              <input className="ac-input" type="text" placeholder="Mario Rossi"
                value={f.cliente_nome} onChange={e => setManualField('cliente_nome', e.target.value)} autoFocus />
            </div>
            <div className="ac-field" style={{ padding: 0, marginBottom: 12 }}>
              <label className="ac-label">Telefono *</label>
              <input className="ac-input" type="tel" placeholder="+39 345 1234567"
                value={f.cliente_telefono} onChange={e => setManualField('cliente_telefono', e.target.value)} />
            </div>
            <div className="ac-field" style={{ padding: 0, marginBottom: 12 }}>
              <label className="ac-label">Email (opzionale)</label>
              <input className="ac-input" type="email" placeholder="mario@email.com"
                value={f.cliente_email} onChange={e => setManualField('cliente_email', e.target.value)} />
            </div>
            <div className="ac-field" style={{ padding: 0, marginBottom: 12 }}>
              <label className="ac-label">Note</label>
              <input className="ac-input" type="text" placeholder="Richieste, taglia casco..."
                value={f.cliente_note} onChange={e => setManualField('cliente_note', e.target.value)} />
            </div>
          </div>

          {/* Accessori */}
          <div style={{ padding: '0 22px 4px' }}>
            <label className="ac-label" style={{ marginBottom: 8 }}>Accessori inclusi</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {accList.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`ac-btn sm${f.accessori.includes(key) ? ' primary' : ' ghost'}`}
                  onClick={() => toggleAcc(key)}
                >{label}</button>
              ))}
            </div>
          </div>

          <div className="ac-modal-footer" style={{ marginTop: 8 }}>
            <button className="ac-btn primary full" onClick={handleManualBooking} disabled={manualLoading}>
              {manualLoading ? 'Salvataggio…' : `✓ Crea Prenotazione — €${f.prezzo_totale || calcPrezzoManual(f.tipo_noleggio, f.giorni)}`}
            </button>
            <button className="ac-btn ghost" onClick={() => setManualModal(false)} disabled={manualLoading}>Annulla</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── NOTE MODAL ───────────────────────────────────────────────────────────────

  function renderNoteModal() {
    return (
      <div className="ac-overlay" onClick={e => e.target === e.currentTarget && setNoteModal(null)}>
        <div className="ac-modal" style={{ maxWidth: 460 }}>
          <div className="ac-modal-header">
            <h2><IconNote /> Nota interna</h2>
            <button className="ac-icon-btn" onClick={() => setNoteModal(null)}><IconX /></button>
          </div>
          <div className="ac-modal-info">Prenotazione di <strong>{noteModal.nome}</strong> — non visibile al cliente</div>
          <div className="ac-field">
            <label className="ac-label">Nota</label>
            <textarea
              className="ac-textarea"
              rows={5}
              placeholder="Es. Cliente preferisce casco L, ha chiesto di posticipare..."
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              autoFocus
            />
          </div>
          <div className="ac-modal-footer">
            <button className="ac-btn primary full" onClick={handleSaveNote} disabled={noteSaving}>
              {noteSaving ? 'Salvataggio…' : '✓ Salva Nota'}
            </button>
            {noteText && (
              <button className="ac-btn danger" onClick={() => setNoteText('')}>Cancella testo</button>
            )}
            <button className="ac-btn ghost" onClick={() => setNoteModal(null)} disabled={noteSaving}>Chiudi</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── CAUZIONI VIEW ────────────────────────────────────────────────────────────

  function renderCauzioni() {
    if (cauzioniLoading) return <div className="ac-spinner-center"><div className="ac-spinner" /></div>;

    const authorized = cauzioni.filter(c => c.cauzione_status === 'authorized');
    const captured   = cauzioni.filter(c => c.cauzione_status === 'captured');
    const released   = cauzioni.filter(c => c.cauzione_status === 'cancelled');
    const pending    = cauzioni.filter(c => !c.cauzione_status || c.cauzione_status === 'pending');
    const failed     = cauzioni.filter(c => c.cauzione_status === 'failed');

    const statusLabel = { authorized: '€1.000 bloccati', captured: 'Incassata', cancelled: 'Rilasciata', pending: 'In attesa', failed: 'Non riuscita' };
    const statusClass = { authorized: 'cauzione-ok', captured: 'cauzione-cap', cancelled: 'muted', pending: 'yellow', failed: 'red' };

    return (
      <div className="ac-cauzioni">
        {/* Summary cards */}
        <div className="ac-cau-summary">
          <div className="ac-cau-card green">
            <div className="ac-cau-num">{authorized.length}</div>
            <div className="ac-cau-lbl">Bloccate attive</div>
            <div className="ac-cau-amt">€{(authorized.length * 1000).toLocaleString('it-IT')}</div>
          </div>
          <div className="ac-cau-card orange">
            <div className="ac-cau-num">{captured.length}</div>
            <div className="ac-cau-lbl">Incassate</div>
            <div className="ac-cau-amt">€{captured.reduce((s, c) => s + Number(c.cauzione_captured_amount || 0), 0).toFixed(0)}</div>
          </div>
          <div className="ac-cau-card muted">
            <div className="ac-cau-num">{released.length}</div>
            <div className="ac-cau-lbl">Rilasciate</div>
          </div>
          <div className="ac-cau-card yellow">
            <div className="ac-cau-num">{pending.length + failed.length}</div>
            <div className="ac-cau-lbl">Pending / Errori</div>
          </div>
        </div>

        {/* Table */}
        <div className="ac-table-wrap">
          {cauzioni.length === 0 ? (
            <div className="ac-empty-state"><IconDeposit /><p>Nessuna prenotazione con cauzione</p></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="ac-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Data Ritiro</th>
                    <th>Bici</th>
                    <th>Prezzo</th>
                    <th>Cauzione</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {cauzioni.map(b => (
                    <tr key={b.id}>
                      <td>
                        <div className="ac-cell-name">{b.cliente_nome}</div>
                        <div className="ac-cell-sub">{b.cliente_email}</div>
                      </td>
                      <td>
                        <div>{formatDateIT(b.data_ritiro)}</div>
                        <div className="ac-cell-sub">{tipoShort(b.tipo_noleggio)}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>#{b.bicicletta_id}</td>
                      <td><span className="ac-price">€{Number(b.prezzo_totale).toFixed(0)}</span></td>
                      <td>
                        <span className={`ac-badge ${statusClass[b.cauzione_status] || 'muted'}`}>
                          {b.cauzione_status === 'captured'
                            ? `€${Number(b.cauzione_captured_amount||0).toFixed(0)} incassati`
                            : statusLabel[b.cauzione_status] || '—'}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {b.cauzione_status === 'authorized' && (
                          <>
                            <button className="ac-action-btn release" onClick={() => setDepositModal({ id: b.id, nome: b.cliente_nome, action: 'release' })}>✓ Rilascia</button>
                            <button className="ac-action-btn capture" onClick={() => setDepositModal({ id: b.id, nome: b.cliente_nome, action: 'capture' })}>⚠ Danni</button>
                          </>
                        )}
                        {b.cauzione_status !== 'authorized' && (
                          <span className="ac-muted-dash">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── CLIENTI VIEW ─────────────────────────────────────────────────────────────

  function renderClienti() {
    return (
      <div className="ac-clienti">
        <form className="ac-clienti-search" onSubmit={handleClientiSearch}>
          <div className="ac-search-box" style={{ flex: 1 }}>
            <IconSearch />
            <input
              className="ac-search-input"
              type="text"
              placeholder="Cerca per nome, email o telefono…"
              value={clientiQuery}
              onChange={e => setClientiQuery(e.target.value)}
              autoFocus
            />
            {clientiQuery && (
              <button type="button" className="ac-search-clear" onClick={() => { setClientiQuery(''); setClientiResults(null); }}><IconX /></button>
            )}
          </div>
          <button type="submit" className="ac-btn primary sm" disabled={clientiLoading || clientiQuery.trim().length < 2}>
            {clientiLoading ? 'Ricerca…' : <><IconSearch /> Cerca</>}
          </button>
        </form>

        {clientiResults === null && !clientiLoading && (
          <div className="ac-empty-state" style={{ marginTop: 48 }}>
            <IconUsers />
            <p>Inserisci almeno 2 caratteri per cercare</p>
          </div>
        )}

        {clientiResults !== null && clientiResults.length === 0 && (
          <div className="ac-empty-state" style={{ marginTop: 48 }}>
            <IconSearch />
            <p>Nessun cliente trovato per "<strong>{clientiQuery}</strong>"</p>
          </div>
        )}

        {clientiResults && clientiResults.length > 0 && (() => {
          // Group by email (or nome+telefono as fallback)
          const grouped = {};
          for (const b of clientiResults) {
            const key = b.cliente_email || `${b.cliente_nome}__${b.cliente_telefono}`;
            if (!grouped[key]) grouped[key] = { nome: b.cliente_nome, email: b.cliente_email, telefono: b.cliente_telefono, bookings: [] };
            grouped[key].bookings.push(b);
          }
          return Object.values(grouped).map(cliente => (
            <div key={cliente.email || cliente.nome} className="ac-cliente-card">
              <div className="ac-cliente-header">
                <div>
                  <div className="ac-cliente-nome">{cliente.nome}</div>
                  <div className="ac-cliente-meta">
                    {cliente.email && <span>{cliente.email}</span>}
                    {cliente.email && cliente.telefono && <span> · </span>}
                    {cliente.telefono && <span>{cliente.telefono}</span>}
                  </div>
                </div>
                <span className="ac-badge indigo">{cliente.bookings.length} prenotazion{cliente.bookings.length === 1 ? 'e' : 'i'}</span>
              </div>
              <div className="ac-cliente-timeline">
                {cliente.bookings.sort((a, b) => new Date(b.data_ritiro) - new Date(a.data_ritiro)).map(b => (
                  <div key={b.id} className="ac-timeline-row">
                    <div className={`ac-timeline-dot ${b.pagamento_status}`} />
                    <div className="ac-timeline-body">
                      <div className="ac-timeline-top">
                        <span className="ac-timeline-date">{formatDateIT(b.data_ritiro)}</span>
                        <span className="ac-timeline-tipo">{tipoLabel(b.tipo_noleggio)}{b.giorni > 1 ? ` · ${b.giorni}g` : ''}</span>
                        <span className="ac-price" style={{ fontSize: '0.8rem' }}>€{Number(b.prezzo_totale).toFixed(0)}</span>
                        <span className={`ac-badge sm ${b.pagamento_status}`}>
                          {b.pagamento_status === 'paid' && 'Pagata'}
                          {b.pagamento_status === 'cancelled' && 'Cancellata'}
                          {b.pagamento_status === 'pending' && 'Attesa'}
                        </span>
                      </div>
                      {b.firma_at && (
                        <button className="ac-btn ghost sm" style={{ marginTop: 4 }} onClick={() => handleViewContratto(b.id)}>
                          <IconFileText /> Vedi contratto
                        </button>
                      )}
                      {b.note_admin && <div className="ac-timeline-note"><IconNote /> {b.note_admin}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ));
        })()}
      </div>
    );
  }

  // ─── IMPOSTAZIONI VIEW ────────────────────────────────────────────────────────

  function renderImpostazioni() {
    const BIKE_TYPES = [
      { key: 'ecity',  label: 'E-City Bike' },
      { key: 'emtb',   label: 'E-MTB' },
      { key: 'bimbo',  label: 'E-MTB Bimbo' },
    ];
    const TIPO_KEYS = [
      { key: 'mezza',   label: 'Mezza Giornata' },
      { key: 'intera',  label: 'Giornata Intera' },
      { key: 'multi_2', label: 'Multi 2 giorni' },
      { key: 'multi_3', label: 'Multi 3 giorni' },
      { key: 'multi_4', label: 'Multi 4 giorni' },
      { key: 'multi_5', label: 'Multi 5 giorni' },
      { key: 'multi_6', label: 'Multi 6 giorni' },
      { key: 'multi_7', label: 'Multi 7 giorni' },
    ];

    return (
      <div className="ac-impostazioni">

        {/* Push notifications */}
        <div className="ac-settings-section">
          <h3 className="ac-section-title"><IconBell /> Notifiche Push</h3>
          <p className="ac-settings-desc">Ricevi una notifica push su questo browser ad ogni nuova prenotazione online.</p>
          <div className="ac-push-row">
            <div>
              {pushStatus === 'enabled' && <span className="ac-badge green">Notifiche attive</span>}
              {pushStatus === 'idle'    && <span className="ac-badge muted">Non attive</span>}
              {pushStatus === 'error'   && <span className="ac-badge red">Errore — riprova</span>}
              {pushStatus === 'unsupported' && <span className="ac-badge yellow">Browser non supportato</span>}
            </div>
            {pushStatus !== 'unsupported' && (
              <button
                className={`ac-btn sm ${pushSub ? 'danger' : 'primary'}`}
                onClick={handlePushToggle}
                disabled={pushLoading}
              >
                {pushLoading ? 'In corso…' : pushSub ? 'Disattiva notifiche' : 'Attiva notifiche'}
              </button>
            )}
            {pushSub && (
              <button
                className="ac-btn ghost sm"
                onClick={() => adminApi.pushTest().then(() => alert('Notifica di test inviata!')).catch(e => alert(e.message))}
              >
                Test
              </button>
            )}
          </div>
        </div>

        {/* Config prezzi */}
        <div className="ac-settings-section">
          <h3 className="ac-section-title"><IconEuro /> Prezzi Noleggio</h3>
          {configMigration && (
            <div className="ac-settings-migration">
              <strong>Migrazione DB richiesta.</strong> Esegui questo SQL in Supabase SQL Editor:
              <pre className="ac-sql-pre">{`CREATE TABLE IF NOT EXISTS config (
  chiave TEXT PRIMARY KEY,
  valore TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`}</pre>
              <p>Poi ricarica questa pagina.</p>
            </div>
          )}
          {configLoading && <div className="ac-spinner-center"><div className="ac-spinner" /></div>}
          {!configLoading && !configMigration && configEdit && (
            <>
              <div className="ac-config-grid">
                {BIKE_TYPES.map(bt => (
                  <div key={bt.key} className="ac-config-bike-col">
                    <div className="ac-config-bike-title">{bt.label}</div>
                    {TIPO_KEYS.map(tk => {
                      const cfgKey = `price_${bt.key}_${tk.key}`;
                      return (
                        <div key={cfgKey} className="ac-config-row">
                          <label className="ac-label">{tk.label}</label>
                          <div className="ac-config-input-wrap">
                            <span className="ac-config-euro">€</span>
                            <input
                              className="ac-input ac-config-input"
                              type="number"
                              min="0"
                              step="1"
                              value={configEdit[cfgKey] ?? ''}
                              onChange={e => setConfigEdit(p => ({ ...p, [cfgKey]: e.target.value }))}
                              placeholder="—"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="ac-config-footer">
                <button className="ac-btn primary" onClick={handleSaveConfig} disabled={configLoading}>
                  {configLoading ? 'Salvataggio…' : '✓ Salva Prezzi'}
                </button>
                {configSaved && <span className="ac-badge green">Salvato!</span>}
                <span className="ac-settings-note">I prezzi salvati qui sono conservati nel DB per riferimento — la logica di calcolo vive nel backend.</span>
              </div>
            </>
          )}
        </div>

        {/* SQL migrations */}
        <div className="ac-settings-section">
          <h3 className="ac-section-title">Migrazioni Database</h3>
          <p className="ac-settings-desc">Esegui questi comandi SQL in Supabase → SQL Editor se non ancora eseguiti:</p>
          <pre className="ac-sql-pre">{`-- Note admin sulle prenotazioni
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS note_admin TEXT;

-- Tabella configurazione prezzi
CREATE TABLE IF NOT EXISTS config (
  chiave TEXT PRIMARY KEY,
  valore TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabella iscrizioni push notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  subscription TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`}</pre>
        </div>

      </div>
    );
  }

}

import { useState, useEffect, useCallback, useRef } from 'react';
import { adminApi, api } from '../lib/api.js';
import KpiStrip    from './admin/KpiStrip.jsx';
import ActionFeed  from './admin/ActionFeed.jsx';
import SearchModal from './admin/SearchModal.jsx';
import NotificationDrawer from './admin/NotificationDrawer.jsx';
import BulkActionBar from './admin/BulkActionBar.jsx';
import useHeartbeat from './admin/useHeartbeat.js';

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

function tipoShort(tipo, giorni) {
  const n = Number(giorni) || 1;
  if (tipo === 'mezza_mattina')    return '½ Mattina';
  if (tipo === 'mezza_pomeriggio') return '½ Pomeriggio';
  if (tipo === '4_ore')            return '4 ore';
  if (tipo === 'intera_giornata')  return n > 1 ? `${n} giorni` : '1 giornata';
  if (tipo === 'multi_giorno' || tipo === '3_piu_giorni') return `${Math.max(n, 2)} giorni`;
  return tipo;
}

// Lingua scelta dal cliente in prenotazione → etichetta italiana per l'admin.
// Fallback 'Italiano' per prenotazioni manuali o vecchie senza lingua salvata.
const LANG_LABELS = { it: 'Italiano', en: 'Inglese', de: 'Tedesco', es: 'Spagnolo', fr: 'Francese' };
function langLabel(code) { return LANG_LABELS[code] || 'Italiano'; }
const LANG_TAG_STYLE = {
  display: 'inline-block', padding: '2px 8px', borderRadius: 6,
  fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
  background: '#FFEDD5', color: '#9A3412',
};

function parseAccessori(raw) {
  if (!raw) return [];
  const labels = { casco: 'Casco (+€2)', lucchetto: 'Lucchetto (+€1)' };
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
const IconLog          = IC(<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/><circle cx="16" cy="17" r="2"/></>);
const IconMore         = IC(<><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></>);

// ─── Bike catalog ────────────────────────────────────────────────────────────

const BICI = [
  { id: 1,  nome: 'E-City KTM #1', tipo: 'E-City Bike KTM 500Wh'     },
  { id: 2,  nome: 'E-City KTM #2', tipo: 'E-City Bike KTM 500Wh'     },
  { id: 3,  nome: 'E-MTB KTM #1',  tipo: 'E-MTB KTM 625Wh BOSCH CX' },
  { id: 4,  nome: 'E-MTB KTM #2',  tipo: 'E-MTB KTM 625Wh BOSCH CX' },
  { id: 5,  nome: 'E-MTB KTM #3',  tipo: 'E-MTB KTM 625Wh BOSCH CX' },
  { id: 6,  nome: 'E-MTB KTM #4',  tipo: 'E-MTB KTM 625Wh BOSCH CX' },
  { id: 7,  nome: 'E-MTB KTM #5',  tipo: 'E-MTB KTM 625Wh BOSCH CX' },
  { id: 8,  nome: 'E-MTB KTM #6',  tipo: 'E-MTB KTM 625Wh BOSCH CX' },
  { id: 9,  nome: 'E-MTB KTM #7',  tipo: 'E-MTB KTM 625Wh BOSCH CX' },
  { id: 10, nome: 'E-MTB Bimbo',   tipo: 'Haibike Hardfour 400Wh'    },
];
function biciNome(id) { return BICI.find(b => b.id === Number(id))?.nome || `Bici #${id}`; }
function biciTipo(id) { return BICI.find(b => b.id === Number(id))?.tipo || '—'; }

// Raggruppa una lista di id bici in stringa compatta tipo
//   "E-City #1·#2 · E-MTB #1·#3·#5" (oppure includendo "Bimbo")
function formatBiciList(ids) {
  const arr = (ids || []).map(Number).filter(Boolean);
  if (!arr.length) return '—';
  const groups = { 'E-City': [], 'E-MTB': [], 'Bimbo': [] };
  for (const id of arr) {
    const nome = biciNome(id);
    // nome es "E-City KTM #1" → estrai "#1"
    const m = nome.match(/#(\d+)/);
    const label = m ? `#${m[1]}` : `#${id}`;
    if (nome.startsWith('E-City'))     groups['E-City'].push(label);
    else if (nome.startsWith('E-MTB Bimbo')) groups['Bimbo'].push(label);
    else if (nome.startsWith('E-MTB')) groups['E-MTB'].push(label);
    else                                groups['E-MTB'].push(label);
  }
  return Object.entries(groups)
    .filter(([, list]) => list.length > 0)
    .map(([cat, list]) => `${cat} ${list.join('·')}`)
    .join(' · ');
}

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
  { id: 'log',          label: 'Log Azioni',    Icon: IconLog        },
];

// Voci sempre visibili nella bottom nav mobile; le restanti vanno nel menu "Altro"
const PRIMARY_NAV_IDS = ['dashboard', 'oggi', 'prenotazioni', 'calendario', 'cauzioni'];

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
  log:          'Log Azioni Admin',
};

// ─── Email templates ──────────────────────────────────────────────────────────

const EMAIL_TEMPLATES = [
  {
    label: 'Promemoria ritiro domani',
    subject: 'Promemoria: il tuo noleggio è domani — Arfanta Bike Rental',
    message: `Ti ricordiamo che domani è il giorno del tuo noleggio bici!\n\nRicorda di portare con te:\n• Documento di identità valido\n• Il codice della tua prenotazione\n\nTi aspettiamo in Via Pecol 22, Arfanta di Tarzo (TV).\n\nPer qualsiasi necessità contattaci via WhatsApp al +39 392 8614635.`,
  },
  {
    label: 'Conferma rimborso',
    subject: 'Rimborso confermato — Arfanta Bike Rental',
    message: `Abbiamo elaborato il rimborso per la tua prenotazione.\n\nI fondi torneranno sul tuo conto entro 5-10 giorni lavorativi, a seconda della tua banca.\n\nCi dispiace non aver potuto ospitarti questa volta. Speriamo di vederti presto sulle Colline del Prosecco!\n\nPer qualsiasi dubbio contattaci via WhatsApp al +39 392 8614635.`,
  },
  {
    label: 'Cauzione non autorizzata',
    subject: 'Importante: cauzione non autorizzata — Arfanta Bike Rental',
    message: `Abbiamo tentato di bloccare la cauzione di €500 sulla tua carta come garanzia per il noleggio, ma l'operazione non è andata a buon fine.\n\nSe non risolviamo questo problema entro domani, saremo costretti ad annullare la tua prenotazione.\n\nContattaci via WhatsApp al +39 392 8614635 o rispondi a questa email.\n\nGrazie per la comprensione.`,
  },
  {
    label: 'Cambio bicicletta',
    subject: 'Aggiornamento prenotazione: cambio bicicletta — Arfanta Bike Rental',
    message: `Ti informiamo che per la tua prenotazione è stato necessario assegnarti una bicicletta diversa rispetto a quella originale.\n\nLa bicicletta che riceverai è della stessa tipologia e qualità. Il tuo noleggio non subisce altre modifiche.\n\nPer qualsiasi domanda siamo disponibili via WhatsApp al +39 392 8614635.`,
  },
  {
    label: 'Ritardo restituzione',
    subject: 'Promemoria restituzione bicicletta — Arfanta Bike Rental',
    message: `Ci risulta che la bicicletta noleggiata non sia stata ancora restituita all'orario previsto.\n\nTi chiediamo di riconsegnare la bici il prima possibile in Via Pecol 22, Arfanta di Tarzo (TV).\n\nIn caso di difficoltà contattaci subito via WhatsApp al +39 392 8614635.\n\nGrazie per la collaborazione.`,
  },
  {
    label: 'Danni rilevati',
    subject: 'Comunicazione danni — Arfanta Bike Rental',
    message: `A seguito dell'ispezione della bicicletta restituita, abbiamo rilevato dei danni che non erano presenti al momento della consegna.\n\nAbbiamo proceduto con l'addebito del costo di riparazione sulla tua carta, come previsto dal contratto di noleggio firmato.\n\nPer qualsiasi chiarimento siamo disponibili via WhatsApp al +39 392 8614635 o via email.\n\nGrazie per la comprensione.`,
  },
  {
    label: 'Ringraziamento post-noleggio',
    subject: 'Grazie per aver scelto Arfanta Bike Rental!',
    message: `Grazie per aver noleggiato con noi! Speriamo che tu abbia trascorso una splendida giornata sulle Colline del Prosecco.\n\nSe ti è piaciuta l'esperienza, ti saremmo grati se lasciassi una recensione su Google — ci aiuta molto a far conoscere questo posto magico!\n\nSperiamo di rivederti presto!\n\nLo staff di Arfanta Bike Rental 🚲`,
  },
  {
    label: 'Avviso meteo avverso',
    subject: 'Avviso meteo per il tuo noleggio — Arfanta Bike Rental',
    message: `Ti informiamo che per la data del tuo noleggio sono previste condizioni meteo avverse (pioggia/temporale).\n\nSe desideri spostare la data, contattaci il prima possibile via WhatsApp al +39 392 8614635 e troveremo insieme una soluzione.\n\nIn alternativa, puoi comunque effettuare il noleggio: le nostre bici sono adatte anche a condizioni umide, ma ti consigliamo abbigliamento impermeabile.\n\nGrazie per la comprensione.`,
  },
  {
    label: 'Richiesta recensione',
    subject: 'Come è andata la tua esperienza? — Arfanta Bike Rental',
    message: `Speriamo che il tuo noleggio sia stato di tuo gradimento!\n\nLa tua opinione è molto importante per noi. Se hai 2 minuti, lascia una recensione su Google — ci aiuta enormemente:\n\nhttps://g.page/r/[LINK_GOOGLE]\n\nE se qualcosa non ha funzionato al meglio, scrivici direttamente via WhatsApp al +39 392 8614635: vogliamo sempre migliorare.\n\nGrazie e a presto!`,
  },
  {
    label: 'Richiesta modifica',
    subject: 'Modifica prenotazione — Arfanta Bike Rental',
    message: `In merito alla tua prenotazione, vorremmo chiederti di contattarci per definire alcuni dettagli.\n\nPuoi raggiungerci via WhatsApp al +39 392 8614635 oppure rispondendo a questa email.\n\nGrazie.`,
  },
  { label: 'Messaggio libero', subject: '', message: '' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [token,    setToken]    = useState(sessionStorage.getItem('admin_token') || '');
  const [showToken, setShowToken] = useState(false);
  const [authed,   setAuthed]   = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [moreOpen,   setMoreOpen]   = useState(false);

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
  const [docFotoRetro,   setDocFotoRetro]   = useState(null);
  const [biciFotoOut,    setBiciFotoOut]    = useState(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const docFotoRef      = useRef();
  const docFotoRetroRef = useRef();
  const bikeOutRef      = useRef();

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

  // Global search
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);

  // Clienti / Storico
  const [clientiQuery,   setClientiQuery]   = useState('');
  const [clientiResults, setClientiResults] = useState(null);
  const [clientiLoading, setClientiLoading] = useState(false);

  // Config prezzi

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

  // Audit log
  const [auditLog,        setAuditLog]        = useState([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);

  // Action sheet (⋮) in prenotazioni table — modal, no clipping issues
  const [actionSheet, setActionSheet] = useState(null); // booking object or null

  // Phase 5: bulk selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Foto modal
  const [fotoModal, setFotoModal] = useState(null); // null | { loading, nome, foto: {documento, consegna, rientro} }

  // Refund modal
  const [refundModal,   setRefundModal]   = useState(null); // {id, nome, email, prezzo}
  const [refundAmount,  setRefundAmount]  = useState('');
  const [refundType,    setRefundType]    = useState('full'); // 'full' | 'partial'
  const [refundMotivo,  setRefundMotivo]  = useState('');
  const [refundLoading, setRefundLoading] = useState(false);

  // Reschedule modal
  const [rescheduleModal,   setRescheduleModal]   = useState(null); // booking object
  const [rescheduleForm,    setRescheduleForm]    = useState({});
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  // Cambia bici modal
  const [cambiaBiciModal,   setCambiaBiciModal]   = useState(null); // {id, nome, bicicletta_id}
  const [cambiaBiciId,      setCambiaBiciId]      = useState('');
  const [cambiaBiciLoading, setCambiaBiciLoading] = useState(false);

  // Action Feed (home)
  const [feedRefresh, setFeedRefresh] = useState(0);
  const [feedCount,   setFeedCount]   = useState(0);

  // Phase 7: heartbeat polling (30s)
  const { data: hb, lastUpdate, setOnNewBooking } = useHeartbeat(30000);

  useEffect(() => {
    if (!hb) return;
    setNotifUnread(hb.notifiche_non_lette || 0);
    setFeedCount(hb.azioni_pendenti || 0);
  }, [hb]);

  useEffect(() => {
    setOnNewBooking((res) => {
      console.log('Nuova prenotazione paid:', res.last_booking_nome);
      if (activeView === 'oggi' && typeof loadOggi === 'function') {
        loadOggi();
        if (typeof setFeedRefresh === 'function') setFeedRefresh(t => t + 1);
      }
    });
  }, [activeView]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFeedAction(actionKey, card) {
    const bookingId = card.booking_id;
    const phone = (card.cliente_telefono || '').replace(/\D/g, '');
    switch (actionKey) {
      case 'retry_cauzione':
        adminApi.autorizzaCauzione(bookingId)
          .then(() => { setFeedRefresh(t => t + 1); loadOggi?.(); })
          .catch(e => alert('Errore: ' + e.message));
        break;
      case 'whatsapp_cliente':
        if (phone) window.open(`https://wa.me/${phone}`, '_blank');
        else alert('Nessun telefono disponibile');
        break;
      case 'chiama_cliente':
        if (phone) window.open(`tel:${phone}`, '_self');
        else alert('Nessun telefono disponibile');
        break;
      case 'marca_noshow':
        if (confirm(`Marcare ${card.titolo} come no-show? La prenotazione verrà cancellata.`)) {
          adminApi.cancelBooking(bookingId)
            .then(() => { setFeedRefresh(t => t + 1); loadOggi?.(); })
            .catch(e => alert('Errore: ' + e.message));
        }
        break;
      case 'invia_firma':
        adminApi.sendFirmaLink(bookingId)
          .then(() => { alert('Link firma inviato.'); setFeedRefresh(t => t + 1); })
          .catch(e => alert('Errore: ' + e.message));
        break;
      case 'vedi_dettaglio':
        setActiveView('prenotazioni');
        break;
      default:
        console.warn('action non gestita:', actionKey);
    }
  }

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
    // Must open window synchronously (before any await) or browsers block it as a popup
    const win = window.open('', '_blank');
    if (!win) { alert('Popup bloccato dal browser. Abilita i popup per questo sito.'); return; }
    win.document.write('<html><body style="font-family:sans-serif;padding:40px;color:#555">Caricamento contratto…</body></html>');
    try {
      const adminToken = sessionStorage.getItem('admin_token') || '';
      const res = await fetch(`/api/admin/bookings/${bookingId}/contratto`, {
        headers: { 'x-admin-token': adminToken },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        win.close();
        alert(d.error || 'Contratto non disponibile');
        return;
      }
      const html = await res.text();
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (e) {
      win.close();
      alert('Errore: ' + e.message);
    }
  }

  // Manual booking modal
  const MANUAL_EMPTY = {
    cliente_nome: '', cliente_email: '', cliente_telefono: '', cliente_note: '',
    data_ritiro: '', tipo_noleggio: 'intera_giornata', giorni: 2,
    qty_ecity: 1, qty_emtb: 0, qty_bimbo: 0,
    acc_casco: 0, acc_lucchetto: 0,
    prezzo_totale: '', note_pagamento: 'Contanti',
  };
  const [manualModal,   setManualModal]   = useState(false);
  const [manualForm,    setManualForm]    = useState(MANUAL_EMPTY);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError,   setManualError]   = useState(null);
  // Disponibilità real-time per la prenotazione manuale
  // { per_tipo: { ecity, emtb, bimbo }, blocked?, blockReason?, loading? }
  const [manualAvail,   setManualAvail]   = useState(null);

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

  // Phase 5: bulk selection handlers
  function toggleSelect(id) {
    setSelectedIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }
  function toggleSelectAll(visibleIds) {
    setSelectedIds(prev => {
      const allSelected = visibleIds.length > 0 && visibleIds.every(id => prev.has(id));
      if (allSelected) return new Set();
      return new Set(visibleIds);
    });
  }
  function clearSelection() { setSelectedIds(new Set()); }

  async function bulkCancel() {
    if (!confirm(`Cancellare ${selectedIds.size} prenotazioni? Questa azione è irreversibile.`)) return;
    const ids = Array.from(selectedIds);
    let ok = 0;
    for (const id of ids) {
      try { await adminApi.cancelBooking(id); ok++; }
      catch (e) { console.error('bulk cancel', id, e?.message); }
    }
    alert(`Cancellate ${ok}/${ids.length}`);
    clearSelection();
    if (typeof loadBookings === 'function') loadBookings('paid');
  }

  function bulkWhatsApp() {
    const sourceList = Array.isArray(bookings) ? bookings : [];
    const rows = sourceList.filter(b => selectedIds.has(b.id));
    const phones = rows.map(b => (b.cliente_telefono || '').replace(/\D/g, '')).filter(Boolean);
    if (phones.length === 0) { alert('Nessun telefono disponibile'); return; }
    const msg = encodeURIComponent('Ciao! Ti scriviamo riguardo alla tua prenotazione di Arfanta Bike Rental.');
    phones.slice(0, 5).forEach(p => window.open(`https://wa.me/${p}?text=${msg}`, '_blank'));
    if (phones.length > 5) alert(`${phones.length} numeri totali, aperti solo i primi 5 (popup blocker). Deseleziona alcune righe e riprova.`);
  }

  function bulkEmail() {
    const sourceList = Array.isArray(bookings) ? bookings : [];
    const rows = sourceList.filter(b => selectedIds.has(b.id));
    const emails = rows.map(b => b.cliente_email).filter(e => e && e !== 'noemail@bikerentaltarzo.it');
    if (emails.length === 0) { alert('Nessuna email disponibile'); return; }
    window.location.href = `mailto:?bcc=${emails.join(',')}&subject=${encodeURIComponent('Arfanta Bike Rental')}`;
  }

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

const loadOccupazione = useCallback(async () => {
    setOccupazioneLoading(true);
    try { const d = await adminApi.getOccupazione(); setOccupazione(d.months || []); } catch (_) {}
    finally { setOccupazioneLoading(false); }
  }, []);

  const loadAuditLog = useCallback(async () => {
    setAuditLogLoading(true);
    try { const d = await adminApi.getAuditLog(); setAuditLog(d.log || []); } catch (_) {}
    finally { setAuditLogLoading(false); }
  }, []);

  // Global search keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Load data when switching views
  // Restore push subscription state on mount (survives page refresh)
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported'); return;
    }
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => { if (sub) { setPushSub(sub); setPushStatus('enabled'); } })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!authed) return;
    if (activeView === 'oggi') loadOggi();
    if (activeView === 'prenotazioni' && bookings.length === 0) loadBookings('paid');
    if (activeView === 'flotta' && flotta.length === 0) loadFlotta();
    if (activeView === 'report') { if (!report) loadReport(); if (!occupazione) loadOccupazione(); }
    if (activeView === 'calendario') { loadCalendario(calYear, calMonth); loadChiusure(); }
    if (activeView === 'cauzioni') loadCauzioni();
    if (activeView === 'log') loadAuditLog();
  }, [activeView, authed]); // eslint-disable-line

  useEffect(() => {
    if (!authed) return;
    adminApi.getNotifiche(1).then(res => setNotifUnread(res.unread || 0)).catch(() => {});
  }, [authed]);

  // Fetch availability live nella prenotazione manuale quando cambiano data/tipo/giorni
  useEffect(() => {
    if (!manualModal) { setManualAvail(null); return; }
    const { data_ritiro, tipo_noleggio, giorni } = manualForm;
    if (!data_ritiro || !tipo_noleggio) { setManualAvail(null); return; }
    const g = tipo_noleggio === 'multi_giorno' ? Math.max(2, Number(giorni) || 2) : 1;

    let cancelled = false;
    setManualAvail(prev => ({ ...(prev || {}), loading: true }));
    api.getAvailability(data_ritiro, tipo_noleggio, g)
      .then(res => {
        if (cancelled) return;
        const perTipo = res.per_tipo || { ecity: 0, emtb: 0, bimbo: 0 };
        setManualAvail({ per_tipo: perTipo, blocked: false, loading: false });
        // Clampa eventuali quantità sopra il nuovo cap
        setManualForm(prev => {
          const next = {
            ...prev,
            qty_ecity: Math.min(prev.qty_ecity || 0, perTipo.ecity || 0),
            qty_emtb:  Math.min(prev.qty_emtb  || 0, perTipo.emtb  || 0),
            qty_bimbo: Math.min(prev.qty_bimbo || 0, perTipo.bimbo || 0),
          };
          const clamped = clampAccessoriToBici(next);
          return prev._prezzoCambiato ? clamped : { ...clamped, prezzo_totale: (() => {
            const c = calcPrezzoManualTotal(clamped);
            return c > 0 ? String(c) : '';
          })() };
        });
      })
      .catch(err => {
        if (cancelled) return;
        // L'endpoint ritorna 400 con fuori_stagione/chiuso → blocchiamo il submit
        const msg = err?.message || 'Errore disponibilità';
        const blockReason = /stagione/i.test(msg) ? 'Data fuori stagione (apertura 1 apr – 31 ott)'
                          : /chius/i.test(msg)    ? 'Negozio chiuso in questa data'
                          : msg;
        setManualAvail({ per_tipo: { ecity: 0, emtb: 0, bimbo: 0 }, blocked: true, blockReason, loading: false });
      });

    return () => { cancelled = true; };
  }, [manualModal, manualForm.data_ritiro, manualForm.tipo_noleggio, manualForm.giorni]); // eslint-disable-line

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
    const missing = [];
    if (!docFoto)      missing.push('documento fronte');
    if (!docFotoRetro) missing.push('documento retro');
    if (!biciFotoOut)  missing.push('bici alla consegna');
    if (missing.length && !confirm(`Foto mancanti: ${missing.join(', ')}. Continuare comunque?`)) return;
    setCheckinLoading(true);
    try {
      await adminApi.checkin(checkinModal.id, {
        checkin_note:          checkinNote   || undefined,
        documento_foto:        docFoto       || undefined,
        documento_foto_retro:  docFotoRetro  || undefined,
        bici_foto_consegna:    biciFotoOut   || undefined,
      });
      setCheckinModal(null); setCheckinNote(''); setDocFoto(null); setDocFotoRetro(null); setBiciFotoOut(null);
      await loadOggi();
    } catch (e) { alert('Errore check-in: ' + e.message); }
    finally { setCheckinLoading(false); }
  }

  // ─── Checkout ───────────────────────────────────────────────────────────────

  async function handleCheckout() {
    if (!biciFotoIn && !confirm('Nessuna foto della bici al rientro. Continuare comunque?')) return;
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
        if (!confirm(`Rilasciare la cauzione di €500 a ${depositModal.nome}?`)) return;
        await adminApi.releaseDeposit(depositModal.id);
        alert('Cauzione rilasciata — €500 sbloccati');
      } else {
        const amount = parseFloat(depositAmount);
        if (!amount || amount <= 0 || amount > 500) return alert('Importo non valido (max €500)');
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

  // ─── WhatsApp rapido ─────────────────────────────────────────────────────────

  function handleWhatsApp(b) {
    const tel = (b.cliente_telefono || '').replace(/[\s\-()]/g, '').replace(/^\+/, '');
    if (!tel) return alert('Numero di telefono non disponibile');
    const msg = encodeURIComponent(
      `Ciao ${b.cliente_nome}, ti scrivo riguardo alla tua prenotazione bici del ${b.data_ritiro} — Arfanta Bike Rental.`
    );
    window.open(`https://wa.me/${tel}?text=${msg}`, '_blank');
  }

  // ─── Stampa riepilogo ────────────────────────────────────────────────────────

  function handlePrintRiepilogo(b) {
    const fmtD = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) : '—';
    const shortId = b.id.toUpperCase().slice(0, 8);
    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
<title>Riepilogo ${shortId} — Arfanta Bike Rental</title>
<style>*{box-sizing:border-box;margin:0;padding:0}@page{margin:20mm 16mm;size:A4}body{font-family:Arial,sans-serif;font-size:11pt;color:#1a1a1a;background:#f0f4f0}.page{max-width:700px;margin:0 auto;background:#fff}.hdr{background:#2D8659;color:#fff;padding:24px 32px}.hdr h1{font-size:1.2rem;margin-bottom:4px}.hdr p{font-size:.76rem;opacity:.82}.body{padding:24px 32px}.row{display:flex;border-bottom:1px solid #eee;padding:9px 0}.row:last-child{border:none}.lbl{color:#777;width:42%;font-size:.87rem}.val{font-weight:600;font-size:.87rem}.code{background:#1a5c3a;color:#fff;padding:2px 10px;border-radius:4px;font-family:monospace;letter-spacing:.1em}.ftr{text-align:center;margin-top:20px;font-size:.69rem;color:#aaa;border-top:1px solid #ddd;padding:12px 32px}.btn{display:block;margin:16px auto 0;padding:10px 28px;background:#2D8659;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:.9rem;font-weight:600}@media print{.btn{display:none!important}body{background:#fff}}</style>
</head><body><div class="page">
<div class="hdr"><h1>🚲 Riepilogo Prenotazione</h1><p>Arfanta Bike Rental · Via Pecol 22, Arfanta di Tarzo (TV)</p></div>
<div class="body">
<div class="row"><div class="lbl">Codice</div><div class="val"><span class="code">${shortId}</span></div></div>
<div class="row"><div class="lbl">Cliente</div><div class="val">${b.cliente_nome}</div></div>
<div class="row"><div class="lbl">Email</div><div class="val">${b.cliente_email || '—'}</div></div>
<div class="row"><div class="lbl">Telefono</div><div class="val">${b.cliente_telefono || '—'}</div></div>
<div class="row"><div class="lbl">Tipo noleggio</div><div class="val">${tipoLabel(b.tipo_noleggio)}</div></div>
<div class="row"><div class="lbl">Ritiro</div><div class="val">${fmtD(b.data_ritiro)} alle ${(b.orario_ritiro||'').slice(0,5)}</div></div>
<div class="row"><div class="lbl">Restituzione</div><div class="val">${fmtD(b.data_restituzione)} alle ${(b.orario_restituzione||'').slice(0,5)}</div></div>
${Number(b.giorni) > 1 ? `<div class="row"><div class="lbl">Giorni</div><div class="val">${b.giorni} giorni</div></div>` : ''}
<div class="row"><div class="lbl">Bicicletta</div><div class="val">${biciNome(b.bicicletta_id)} — ${biciTipo(b.bicicletta_id)}</div></div>
<div class="row"><div class="lbl">Totale pagato</div><div class="val">€${Number(b.prezzo_totale).toFixed(2)}</div></div>
<div class="row"><div class="lbl">Stato</div><div class="val">${b.pagamento_status === 'paid' ? '✓ Pagata' : b.pagamento_status}</div></div>
${b.firma_at ? `<div class="row"><div class="lbl">Contratto</div><div class="val">✍️ Firmato il ${new Date(b.firma_at).toLocaleDateString('it-IT')}</div></div>` : ''}
${b.note_admin ? `<div class="row"><div class="lbl">Note interne</div><div class="val">${b.note_admin}</div></div>` : ''}
</div>
<button class="btn" onclick="window.print()">Stampa / Salva PDF</button>
<div class="ftr">Arfanta Bike Rental · Via Pecol 22, Arfanta di Tarzo (TV) · Colline del Prosecco di Conegliano e Valdobbiadene — UNESCO</div>
</div></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (win) setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ─── Refund ──────────────────────────────────────────────────────────────────

  async function handleRefund() {
    const amount = refundType === 'full' ? null : parseFloat(refundAmount);
    if (refundType === 'partial' && (!amount || amount <= 0)) return alert('Inserisci un importo valido');
    if (!confirm(`Rimborsare ${refundType === 'full' ? 'l\'intero importo' : `€${amount?.toFixed(2)}`} a ${refundModal.nome}?`)) return;
    setRefundLoading(true);
    try {
      const result = await adminApi.refundBooking(refundModal.id, amount || undefined, refundMotivo);
      alert(`Rimborso di €${result.amount?.toFixed(2)} elaborato con successo.\nI fondi torneranno entro 5-10 giorni lavorativi.`);
      setRefundModal(null); setRefundAmount(''); setRefundMotivo('');
      await loadBookings(filter);
    } catch (e) { alert('Errore: ' + e.message); }
    finally { setRefundLoading(false); }
  }

  // ─── Reschedule ──────────────────────────────────────────────────────────────

  async function handleReschedule() {
    const { data_ritiro, tipo_noleggio, giorni = 1 } = rescheduleForm;
    if (!data_ritiro || !tipo_noleggio) return alert('Compila data e tipo noleggio');
    setRescheduleLoading(true);
    try {
      await adminApi.rescheduleBooking(rescheduleModal.id, data_ritiro, tipo_noleggio, Number(giorni));
      alert('Prenotazione spostata con successo!');
      setRescheduleModal(null);
      await loadBookings(filter);
    } catch (e) { alert('Errore: ' + e.message); }
    finally { setRescheduleLoading(false); }
  }

  // ─── Cambia bici ─────────────────────────────────────────────────────────────

  async function handleCambiaBici() {
    const newId = parseInt(cambiaBiciId, 10);
    if (!newId) return;
    if (!confirm(`Assegnare la bici #${newId} a ${cambiaBiciModal.nome}?`)) return;
    setCambiaBiciLoading(true);
    try {
      await adminApi.assegnaBici(cambiaBiciModal.id, newId);
      alert(`Bici #${newId} assegnata con successo!`);
      setCambiaBiciModal(null); setCambiaBiciId('');
      await loadBookings(filter);
    } catch (e) { alert('Errore: ' + e.message); }
    finally { setCambiaBiciLoading(false); }
  }

  // ─── Manual booking ─────────────────────────────────────────────────────────

  // Pricing mirror del backend (availability.js) — alta/bassa stagione + tipo bici.
  const SEASONAL_PRICES = {
    bassa: {
      ecity: { mezza: 35, intera: 45, due_giorni: 84,  extra: 40 },
      emtb:  { mezza: 40, intera: 55, due_giorni: 100, extra: 50 },
      bimbo: { mezza: 8,  intera: 11, due_giorni: 20,  extra: 9  },
    },
    alta: {
      ecity: { mezza: 40, intera: 50, due_giorni: 95,  extra: 45 },
      emtb:  { mezza: 45, intera: 55, due_giorni: 100, extra: 50 },
      bimbo: { mezza: 10, intera: 14, due_giorni: 26,  extra: 12 },
    },
  };
  const TIPO_IDS_BICI = { ecity: [1,2], emtb: [3,4,5,6,7,8,9], bimbo: [10] };

  function getStagioneFE(dateStr) {
    if (!dateStr) return null;
    const [, mm, dd] = dateStr.split('-').map(Number);
    const mmdd = mm * 100 + dd;
    if (mmdd >= 401 && mmdd <= 630)  return 'bassa';
    if (mmdd >= 701 && mmdd <= 831)  return 'alta';
    if (mmdd >= 901 && mmdd <= 1031) return 'bassa';
    return null;
  }

  function getBikeTypeFromId(id) {
    const n = Number(id);
    for (const [tipo, ids] of Object.entries(TIPO_IDS_BICI)) {
      if (ids.includes(n)) return tipo;
    }
    return null;
  }

  function calcPrezzoPerBike(tipo, giorni, dateStr, bikeType) {
    const stagione = getStagioneFE(dateStr);
    if (!stagione || !bikeType) return 0;
    const p = SEASONAL_PRICES[stagione][bikeType];
    if (!p) return 0;
    if (tipo === 'mezza_mattina' || tipo === 'mezza_pomeriggio') return p.mezza;
    if (tipo === 'intera_giornata') return p.intera;
    if (tipo === 'multi_giorno') {
      const n = Number(giorni);
      if (n < 2) return 0;
      return p.due_giorni + (n - 2) * p.extra;
    }
    return 0;
  }

  const ACC_PREZZI_FE = { casco: 2, lucchetto: 1 };

  function totalBici(form) {
    return (form.qty_ecity || 0) + (form.qty_emtb || 0) + (form.qty_bimbo || 0);
  }

  function calcPrezzoManualTotal(form) {
    const qty = { ecity: form.qty_ecity || 0, emtb: form.qty_emtb || 0, bimbo: form.qty_bimbo || 0 };
    let total = 0;
    for (const [bt, n] of Object.entries(qty)) {
      if (n <= 0) continue;
      const base = calcPrezzoPerBike(form.tipo_noleggio, form.giorni, form.data_ritiro, bt);
      if (base <= 0) return 0;
      total += base * n;
    }
    total += (form.acc_casco     || 0) * ACC_PREZZI_FE.casco;
    total += (form.acc_lucchetto || 0) * ACC_PREZZI_FE.lucchetto;
    return total;
  }

  function recalcPrezzo(next, prev) {
    if (prev._prezzoCambiato) return next;
    const calc = calcPrezzoManualTotal(next);
    return { ...next, prezzo_totale: calc > 0 ? String(calc) : '' };
  }

  function clampAccessoriToBici(form) {
    const max = totalBici(form);
    return {
      ...form,
      acc_casco:     Math.min(form.acc_casco     || 0, max),
      acc_lucchetto: Math.min(form.acc_lucchetto || 0, max),
    };
  }

  function setManualField(key, value) {
    setManualForm(prev => {
      let next = { ...prev, [key]: value };
      // Se cambia il count bici, riallinea gli accessori al nuovo cap
      if (['qty_ecity', 'qty_emtb', 'qty_bimbo'].includes(key)) {
        next = clampAccessoriToBici(next);
      }
      return recalcPrezzo(next, prev);
    });
  }

  function adjustQty(key, delta) {
    setManualForm(prev => {
      const cur    = Number(prev[key] || 0);
      // Rispetta il cap di disponibilità reale se conosciuto
      const btMap  = { qty_ecity: 'ecity', qty_emtb: 'emtb', qty_bimbo: 'bimbo' };
      const av     = manualAvail?.per_tipo;
      const hardMax = av && btMap[key] ? (av[btMap[key]] || 0) : 10;
      const newQty = Math.max(0, Math.min(hardMax, cur + delta));
      if (newQty === cur) return prev;
      let next = { ...prev, [key]: newQty };
      next = clampAccessoriToBici(next);
      return recalcPrezzo(next, prev);
    });
  }

  function adjustAcc(key, delta) {
    setManualForm(prev => {
      const cur = Number(prev[key] || 0);
      const max = totalBici(prev);
      const newQty = Math.max(0, Math.min(max, cur + delta));
      if (newQty === cur) return prev;
      const next = { ...prev, [key]: newQty };
      return recalcPrezzo(next, prev);
    });
  }

  async function handleManualBooking() {
    if (!manualForm.cliente_nome || !manualForm.data_ritiro || !manualForm.tipo_noleggio) {
      setManualError('Compila i campi obbligatori: nome, data, tipo noleggio');
      return;
    }
    const bici = [
      { bike_type: 'ecity', quantita: manualForm.qty_ecity || 0 },
      { bike_type: 'emtb',  quantita: manualForm.qty_emtb  || 0 },
      { bike_type: 'bimbo', quantita: manualForm.qty_bimbo || 0 },
    ].filter(b => b.quantita > 0);
    if (bici.length === 0) {
      setManualError('Seleziona almeno una bici');
      return;
    }
    setManualLoading(true);
    setManualError(null);
    try {
      await adminApi.manualBooking({
        ...manualForm,
        giorni:        Number(manualForm.giorni),
        bici,
        accessori_qty: {
          casco:     manualForm.acc_casco     || 0,
          lucchetto: manualForm.acc_lucchetto || 0,
        },
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

  // ─── Foto viewer ─────────────────────────────────────────────────────────────

  async function handleViewFoto(id, nome) {
    setActionSheet(null);
    setFotoModal({ loading: true, nome, foto: {} });
    try {
      const data = await adminApi.getBookingFoto(id);
      setFotoModal({
        loading: false,
        nome,
        foto: {
          documento:      data.documento      || null,
          documentoRetro: data.documentoRetro || null,
          consegna:       data.consegna       || null,
          rientro:        data.rientro        || null,
        },
      });
    } catch {
      setFotoModal(null);
      alert('Impossibile caricare le foto.');
    }
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
      <div className="ac-root ac-login2">
        {/* Brand panel (hidden on mobile) */}
        <aside className="ac-login2-brand">
          <div className="ac-login2-blob ac-login2-blob-1" />
          <div className="ac-login2-blob ac-login2-blob-2" />
          <div className="ac-login2-blob ac-login2-blob-3" />
          <div className="ac-login2-brand-inner">
            <div className="ac-login2-brand-top">
              <div className="ac-login2-logo-card">
                <img src="/logo.png" alt="Arfanta Bike Rental" />
              </div>
            </div>
            <div className="ac-login2-brand-mid">
              <h2 className="ac-login2-hero">
                Gestisci la tua flotta<br/>tra le <span className="ac-login2-accent">Colline del Prosecco</span>.
              </h2>
              <p className="ac-login2-tagline">
                Prenotazioni, cauzioni, check-in: tutto in un'unica dashboard pensata per essere veloce.
              </p>
            </div>
            <div className="ac-login2-brand-bottom">
              <div className="ac-login2-chip">
                <span className="ac-login2-dot ac-login2-dot-ok" />
                Sistema operativo
              </div>
              <div className="ac-login2-meta">
                v2.0 · Tarzo (TV)
              </div>
            </div>
          </div>
        </aside>

        {/* Form panel */}
        <main className="ac-login2-form-wrap">
          <div className="ac-login2-card">
            <div className="ac-login2-mobile-logo">
              <div className="ac-login2-logo-card ac-login2-logo-card-sm">
                <img src="/logo.png" alt="Arfanta Bike Rental" />
              </div>
            </div>
            <div className="ac-login2-eyebrow">PANNELLO AMMINISTRATORE</div>
            <h1 className="ac-login2-title">Bentornato</h1>
            <p className="ac-login2-sub">Inserisci il token per accedere alla dashboard.</p>

            {error && (
              <div className="ac-error-banner ac-login2-error" role="alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            <label className="ac-login2-label">Token amministratore</label>
            <div className={`ac-login2-input-wrap${token ? ' has-value' : ''}`}>
              <svg className="ac-login2-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                className="ac-login2-input"
                type={showToken ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={token}
                onChange={e => setToken(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && login()}
                autoFocus
                autoComplete="current-password"
              />
              <button
                type="button"
                className="ac-login2-eye"
                onClick={() => setShowToken(s => !s)}
                aria-label={showToken ? 'Nascondi token' : 'Mostra token'}
                tabIndex={-1}
              >
                {showToken ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>

            <button
              className="ac-login2-submit"
              onClick={login}
              disabled={loading || !token}
            >
              {loading ? (
                <>
                  <span className="ac-login2-spinner" />
                  <span>Accesso in corso…</span>
                </>
              ) : (
                <>
                  <span>Accedi alla dashboard</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>

            <div className="ac-login2-foot">
              <span className="ac-login2-dot ac-login2-dot-ok" />
              <span>Connessione sicura · sessione cifrata</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─── MAIN LAYOUT ─────────────────────────────────────────────────────────────

  // Late returns count for badge
  const lateCount = oggiData?.inRitardo?.length || 0;

  return (
    <div className="ac-root ac-layout">

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
            <div className="ac-sidebar-title">ARFANTA</div>
            <div className="ac-sidebar-subtitle">BIKE RENTAL</div>
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
            <button
              type="button"
              className="ac-topbar-search-trigger"
              onClick={() => setSearchOpen(true)}
              title="Cerca (⌘K)"
            >
              <span>🔍</span>
              <span className="ac-topbar-search-label">Cerca…</span>
              <kbd className="ac-topbar-search-kbd">⌘K</kbd>
            </button>
            <button
              type="button"
              className="ac-topbar-bell"
              onClick={() => { setNotifOpen(true); setNotifUnread(0); }}
              title="Notifiche"
            >
              <span>🔔</span>
              {notifUnread > 0 && (
                <span className="ac-topbar-bell-badge">{notifUnread > 9 ? '9+' : notifUnread}</span>
              )}
            </button>
            <span className="ac-topbar-date">{todayIT()}</span>
            {lastUpdate && (
              <span className="ac-topbar-update" title={`Heartbeat: ${lastUpdate.toLocaleTimeString()}`}>
                Aggiornato ora
              </span>
            )}
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
          {activeView === 'log'          && renderAuditLog()}
        </div>
      </div>

      {/* ── Modals ── */}
      {checkinModal      && renderCheckinModal()}
      {checkoutModal     && renderCheckoutModal()}
      {fleetModal        && renderFleetModal()}
      {depositModal      && renderDepositModal()}
      {emailModal        && renderEmailModal()}
      {damageModal       && renderDamageModal()}
      {manualModal       && renderManualModal()}
      {noteModal         && renderNoteModal()}
      {refundModal       && renderRefundModal()}
      {rescheduleModal   && renderRescheduleModal()}
      {cambiaBiciModal   && renderCambiaBiciModal()}
      {actionSheet       && renderActionSheet()}
      {fotoModal         && renderFotoModal()}

      <BulkActionBar
        count={selectedIds.size}
        onEmail={bulkEmail}
        onWhatsApp={bulkWhatsApp}
        onCancel={bulkCancel}
        onClear={clearSelection}
      />

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectBooking={(id) => {
          setActiveView('prenotazioni');
        }}
        onSelectCliente={(c) => {
          if (typeof setClientiQuery === 'function') {
            setClientiQuery(c.email || c.telefono || c.nome);
          }
          setActiveView('clienti');
        }}
      />

      <NotificationDrawer
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onClickBooking={(bid) => {
          setActiveView('prenotazioni');
        }}
      />

      {/* ── Menu "Altro" (sezioni secondarie) ── */}
      {moreOpen && (
        <div className="ac-overlay ac-overlay-sheet" onClick={() => setMoreOpen(false)}>
          <div className="ac-actionsheet" onClick={e => e.stopPropagation()}>
            <div className="ac-actionsheet-header">
              <div>
                <div className="ac-actionsheet-name">Altre sezioni</div>
                <div className="ac-actionsheet-meta">Tocca una sezione per aprirla</div>
              </div>
              <button className="ac-actionsheet-close" onClick={() => setMoreOpen(false)}>
                <IconX />
              </button>
            </div>
            <div className="ac-actionsheet-body">
              {NAV.filter(n => !PRIMARY_NAV_IDS.includes(n.id)).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  className="ac-actionsheet-btn"
                  onClick={() => { setActiveView(id); setMoreOpen(false); }}
                >
                  <Icon />
                  <span>{label}</span>
                  {activeView === id && <span className="ac-actionsheet-dot" />}
                </button>
              ))}
              <div className="ac-actionsheet-sep" />
              <button className="ac-actionsheet-btn danger" onClick={logout}>
                <IconLogout />
                <span>Esci</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile bottom nav (5 voci fisse + Altro) ── */}
      <nav className="ac-bottom-nav">
        {NAV.filter(n => PRIMARY_NAV_IDS.includes(n.id)).map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`ac-bottom-nav-item${activeView === id ? ' active' : ''}`}
            onClick={() => { setActiveView(id); setMoreOpen(false); }}
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
        <button
          className={`ac-bottom-nav-item${(moreOpen || !PRIMARY_NAV_IDS.includes(activeView)) ? ' active' : ''}`}
          onClick={() => setMoreOpen(o => !o)}
        >
          <span className="ac-bottom-nav-icon"><IconMore /></span>
          <span>Altro</span>
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
        <KpiStrip
          revenue_oggi={stats?.incasso_oggi || stats?.incasso_totale || 0}
          bici_occupate={(oggiData?.ritiri?.length || 0) + (oggiData?.inRitardo?.length || 0)}
          bici_totali={10}
          azioni_count={feedCount}
        />
        <ActionFeed
          onAction={handleFeedAction}
          refreshTick={feedRefresh}
          onCount={setFeedCount}
        />
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

    // Le nuove prenotazioni hanno bici_ids[]; quelle legacy hanno righe multiple stesso
    // stripe_session_id. Gestiamo entrambi i casi.
    const grouped = (() => {
      const map = new Map();
      const out = [];
      for (const b of filteredBookings) {
        const newStyle = Array.isArray(b.bici_ids) && b.bici_ids.length > 0;
        const k = newStyle ? `n:${b.id}` : (b.stripe_session_id ? `s:${b.stripe_session_id}` : `i:${b.id}`);
        if (newStyle) {
          out.push({ ...b, _ids: [b.id], _bici: [...b.bici_ids], _prezzo: Number(b.prezzo_totale) || 0, _count: b.bici_ids.length });
          continue;
        }
        if (!map.has(k)) {
          const lead = { ...b, _ids: [b.id], _bici: [b.bicicletta_id], _prezzo: Number(b.prezzo_totale) || 0, _count: 1 };
          map.set(k, lead);
          out.push(lead);
        } else {
          const g = map.get(k);
          g._ids.push(b.id);
          if (!g._bici.includes(b.bicicletta_id)) g._bici.push(b.bicicletta_id);
          g._prezzo += Number(b.prezzo_totale) || 0;
          g._count  += 1;
        }
      }
      return out;
    })();

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
              setManualForm({ ...MANUAL_EMPTY });
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
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        className="ac-bulk-checkbox"
                        checked={grouped.length > 0 && grouped.every(g => g._ids.every(id => selectedIds.has(id)))}
                        onChange={() => toggleSelectAll(grouped.flatMap(g => g._ids))}
                      />
                    </th>
                    <th>Codice</th>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th>Ritiro</th>
                    <th>Rest.</th>
                    <th>Bici</th>
                    <th>€</th>
                    <th>Stato</th>
                    {filter === 'paid' && <th>Firma</th>}
                    {filter === 'paid' && <th>Cauzione</th>}
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map(b => (
                    <tr key={b.id}>
                      <td onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="ac-bulk-checkbox"
                          checked={b._ids.every(id => selectedIds.has(id))}
                          onChange={() => toggleSelectAll(b._ids)}
                        />
                      </td>
                      <td><span className="ac-code">{b.id.toUpperCase().substring(0, 8)}</span></td>
                      <td>
                        <div className="ac-cell-name">
                          {b.cliente_nome}
                          {b.note_admin && <span className="ac-note-indicator" title={b.note_admin} />}
                        </div>
                        <div className="ac-cell-sub">{b.cliente_email}</div>
                        <div className="ac-cell-sub">{b.cliente_telefono}</div>
                        <span style={{ ...LANG_TAG_STYLE, marginTop: 4 }} title="Lingua scelta dal cliente">{langLabel(b.lingua)}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{tipoShort(b.tipo_noleggio, b.giorni)}</div>
                        {b._count > 1 && <div className="ac-cell-sub">{b._count} bici</div>}
                      </td>
                      <td>
                        <div>{formatDateIT(b.data_ritiro)}</div>
                        <div style={{ fontWeight: 700 }}>{b.orario_ritiro?.substring(0, 5)}</div>
                      </td>
                      <td>
                        <div>{formatDateIT(b.data_restituzione)}</div>
                        <div style={{ fontWeight: 700 }}>{b.orario_restituzione?.substring(0, 5)}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {b._bici.length === 1 ? (
                          <span style={{ fontWeight: 700 }}>{biciNome(b._bici[0])}</span>
                        ) : (
                          <>
                            <div style={{ fontWeight: 700 }}>{b._bici.length} bici</div>
                            <div className="ac-cell-sub" style={{ fontSize: '0.74rem' }}>
                              {formatBiciList(b._bici)}
                            </div>
                          </>
                        )}
                      </td>
                      <td><span className="ac-price">€{Number(b._prezzo).toFixed(0)}</span></td>
                      <td>
                        <span className={`ac-badge ${b.pagamento_status}`}>
                          {b.pagamento_status === 'paid' && 'Pagata'}
                          {b.pagamento_status === 'pending' && 'Attesa'}
                          {b.pagamento_status === 'cancelled' && 'Cancellata'}
                        </span>
                      </td>
                      {filter === 'paid' && (
                        <td>
                          {b.firma_at
                            ? <span className="ac-badge green sm">✍️ Firmato</span>
                            : <span className="ac-badge yellow sm">Da firmare</span>
                          }
                        </td>
                      )}
                      {filter === 'paid' && (
                        <td>
                          {b.cauzione_status === 'authorized' && <span className="ac-badge cauzione-ok">€500 bloccati</span>}
                          {b.cauzione_status === 'captured'   && <span className="ac-badge cauzione-cap">€{Number(b.cauzione_captured_amount||0).toFixed(0)} incassati</span>}
                          {b.cauzione_status === 'cancelled'  && <span className="ac-badge muted">Rilasciata</span>}
                          {b.cauzione_status === 'failed'     && <span className="ac-badge red">Non riuscita</span>}
                          {(!b.cauzione_status || b.cauzione_status === 'pending') && <span className="ac-muted-dash">—</span>}
                        </td>
                      )}
                      <td style={{ textAlign: 'right', paddingRight: 8 }}>
                        <button
                          className="ac-kebab-btn"
                          title="Azioni"
                          onClick={() => setActionSheet(b)}
                        >⋮</button>
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

          <div className="ac-photo-section-label">
            <span className="ac-label" style={{ fontSize: '0.7rem', color: '#4ADE80' }}>📷 Foto da scattare al ritiro</span>
          </div>

          <div className="ac-photo-grid">
            <PhotoUpload label="Documento — fronte" value={docFoto}      onChange={setDocFoto}      inputRef={docFotoRef}      />
            <PhotoUpload label="Documento — retro"  value={docFotoRetro} onChange={setDocFotoRetro} inputRef={docFotoRetroRef} />
            <PhotoUpload label="Bici alla consegna" value={biciFotoOut}  onChange={setBiciFotoOut}  inputRef={bikeOutRef}      />
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

          <div className="ac-photo-section-label">
            <span className="ac-label" style={{ fontSize: '0.7rem', color: '#4ADE80' }}>📷 Foto da scattare al rientro</span>
          </div>
          <div className="ac-photo-grid" style={{ gridTemplateColumns: '1fr' }}>
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
              I <strong style={{ color: '#4ADE80' }}>€500 bloccati</strong> sulla carta del cliente verranno sbloccati immediatamente. Operazione irreversibile.
            </p>
          ) : (
            <div className="ac-field">
              <label className="ac-label">Importo danni da trattenere (max €500)</label>
              <input className="ac-input" type="number" min="1" max="500" step="0.01" placeholder="es. 150"
                value={depositAmount} onChange={e => setDepositAmount(e.target.value)} autoFocus />
            </div>
          )}

          <div className="ac-modal-footer">
            <button
              className={`ac-btn full${depositModal.action === 'release' ? ' green' : ' primary'}`}
              onClick={handleDeposit}
              disabled={depositLoading || (depositModal.action === 'capture' && !depositAmount)}
            >
              {depositLoading ? 'In corso…' : depositModal.action === 'release' ? '✓ Sblocca €500' : `⚠ Incassa €${parseFloat(depositAmount || 0).toFixed(2)}`}
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
    const maxAcc  = totalBici(f);
    const av      = manualAvail || {};
    const perTipo = av.per_tipo || { ecity: 0, emtb: 0, bimbo: 0 };
    const blocked = !!av.blocked;
    const avLoading = !!av.loading;
    const hasNoFleet = av.per_tipo && perTipo.ecity === 0 && perTipo.emtb === 0 && perTipo.bimbo === 0 && !blocked;

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

          {manualError && <div className="ac-manual-error"><div className="ac-error-banner">{manualError}</div></div>}
          {blocked && (
            <div className="ac-manual-error">
              <div className="ac-error-banner">⚠️ {av.blockReason}</div>
            </div>
          )}
          {!blocked && hasNoFleet && f.data_ritiro && (
            <div className="ac-manual-error">
              <div className="ac-error-banner ac-warn-banner">
                Tutte le bici sono già prenotate in questa data/orario
              </div>
            </div>
          )}

          {/* Dati prenotazione */}
          <div className="ac-manual-grid">
            <div className="ac-field">
              <label className="ac-label">Data ritiro *</label>
              <input className="ac-input" type="date" value={f.data_ritiro}
                onChange={e => setManualField('data_ritiro', e.target.value)} />
            </div>
            <div className="ac-field">
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
              <div className="ac-field">
                <label className="ac-label">Numero giorni</label>
                <input className="ac-input" type="number" min="2" max="30"
                  value={f.giorni} onChange={e => setManualField('giorni', e.target.value)} />
              </div>
            )}
          </div>

          {/* Selettore bici (multi-bici) */}
          <div className="ac-manual-bici">
            <div className="ac-manual-bici-title">
              <span className="ac-label">Bici *</span>
              <span className="ac-manual-bici-hint">
                {avLoading
                  ? 'Verifica disponibilità…'
                  : (!f.data_ritiro ? 'Seleziona prima la data' : 'Disponibilità calcolata dal calendario')}
              </span>
            </div>
            {[
              { key: 'qty_ecity', label: 'E-City',      sub: 'KTM 500Wh',        bt: 'ecity' },
              { key: 'qty_emtb',  label: 'E-MTB',       sub: 'KTM 625Wh BOSCH',  bt: 'emtb'  },
              { key: 'qty_bimbo', label: 'E-MTB Bimbo', sub: 'Haibike Hardfour', bt: 'bimbo' },
            ].map(row => {
              const qty       = f[row.key] || 0;
              const price     = calcPrezzoPerBike(f.tipo_noleggio, f.giorni, f.data_ritiro, row.bt);
              const available = av.per_tipo ? (perTipo[row.bt] || 0) : null;
              const maxQty    = available !== null ? available : 10;
              const subText   = [
                row.sub,
                price > 0 ? `€${price}/bici` : null,
                available !== null ? (available > 0 ? `${available} disponibili` : 'esaurita') : null,
              ].filter(Boolean).join(' · ');
              const dimmed = available === 0;
              return (
                <div key={row.key} className="ac-bici-row" style={dimmed ? { opacity: 0.5 } : undefined}>
                  <div className="ac-bici-info">
                    <div className="ac-bici-name">{row.label}</div>
                    <div className="ac-bici-sub">{subText}</div>
                  </div>
                  <div className="ac-bici-qty">
                    <button type="button" className="ac-qty-btn" onClick={() => adjustQty(row.key, -1)} disabled={qty === 0}>−</button>
                    <span className="ac-qty-val">{qty}</span>
                    <button type="button" className="ac-qty-btn"
                      onClick={() => adjustQty(row.key, +1)}
                      disabled={blocked || qty >= maxQty}
                    >+</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Prezzo e pagamento */}
          <div className="ac-manual-grid">
            <div className="ac-field">
              <label className="ac-label">Prezzo totale (€)</label>
              <input className="ac-input" type="number" min="0" step="0.01"
                value={f.prezzo_totale}
                onChange={e => setManualForm(p => ({ ...p, prezzo_totale: e.target.value, _prezzoCambiato: true }))}
                placeholder={String(calcPrezzoManualTotal(f) || '—')} />
            </div>
            <div className="ac-field">
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
          <div className="ac-manual-grid">
            <div className="ac-field">
              <label className="ac-label">Nome cliente *</label>
              <input className="ac-input" type="text" placeholder="Mario Rossi"
                value={f.cliente_nome} onChange={e => setManualField('cliente_nome', e.target.value)} />
            </div>
            <div className="ac-field">
              <label className="ac-label">Telefono *</label>
              <input className="ac-input" type="tel" placeholder="+39 345 1234567"
                value={f.cliente_telefono} onChange={e => setManualField('cliente_telefono', e.target.value)} />
            </div>
            <div className="ac-field">
              <label className="ac-label">Email (opzionale)</label>
              <input className="ac-input" type="email" placeholder="mario@email.com"
                value={f.cliente_email} onChange={e => setManualField('cliente_email', e.target.value)} />
            </div>
            <div className="ac-field">
              <label className="ac-label">Note</label>
              <input className="ac-input" type="text" placeholder="Richieste, taglia casco..."
                value={f.cliente_note} onChange={e => setManualField('cliente_note', e.target.value)} />
            </div>
          </div>

          {/* Accessori */}
          <div className="ac-manual-bici">
            <div className="ac-manual-bici-title">
              <span className="ac-label">Accessori</span>
              <span className="ac-manual-bici-hint">{maxAcc > 0 ? `max ${maxAcc} per tipo` : 'aggiungi prima una bici'}</span>
            </div>
            {[
              { key: 'acc_casco',     label: 'Casco',     sub: '+€2 cad.' },
              { key: 'acc_lucchetto', label: 'Lucchetto', sub: '+€1 cad.' },
            ].map(row => {
              const qty = f[row.key] || 0;
              return (
                <div key={row.key} className="ac-bici-row">
                  <div className="ac-bici-info">
                    <div className="ac-bici-name">{row.label}</div>
                    <div className="ac-bici-sub">{row.sub}</div>
                  </div>
                  <div className="ac-bici-qty">
                    <button type="button" className="ac-qty-btn" onClick={() => adjustAcc(row.key, -1)} disabled={qty === 0}>−</button>
                    <span className="ac-qty-val">{qty}</span>
                    <button type="button" className="ac-qty-btn" onClick={() => adjustAcc(row.key, +1)} disabled={qty >= maxAcc}>+</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ac-modal-footer">
            <button
              className="ac-btn primary full"
              onClick={handleManualBooking}
              disabled={manualLoading || blocked || avLoading || maxAcc === 0}
            >
              {(() => {
                if (manualLoading)   return 'Salvataggio…';
                if (avLoading)       return 'Verifica disponibilità…';
                if (blocked)         return 'Data non disponibile';
                if (maxAcc === 0)    return 'Seleziona almeno una bici';
                const label = maxAcc > 1 ? `${maxAcc} bici` : '1 bici';
                return `✓ Crea Prenotazione (${label})${f.prezzo_totale ? ` — €${f.prezzo_totale}` : ''}`;
              })()}
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

  // ─── ACTION SHEET MODAL (⋮) ──────────────────────────────────────────────────

  function renderActionSheet() {
    const b = actionSheet;
    const isPaid = b.pagamento_status === 'paid';

    function act(fn) { return () => { setActionSheet(null); fn(); }; }

    return (
      <div className="ac-overlay ac-overlay-sheet" onClick={() => setActionSheet(null)}>
        <div className="ac-actionsheet" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="ac-actionsheet-header">
            <div>
              <div className="ac-actionsheet-name">
                {b.cliente_nome}
                {b.note_admin && <span className="ac-note-indicator" title={b.note_admin} />}
              </div>
              <div className="ac-actionsheet-meta">
                <span style={LANG_TAG_STYLE} title="Lingua scelta dal cliente">{langLabel(b.lingua)}</span>
                <span className="ac-code" style={{ fontSize: 11 }}>{b.id.toUpperCase().slice(0,8)}</span>
                <span>· {formatDateIT(b.data_ritiro)} · {tipoShort(b.tipo_noleggio, b.giorni)} · {
                  Array.isArray(b.bici_ids) && b.bici_ids.length > 1
                    ? `${b.bici_ids.length} bici — ${formatBiciList(b.bici_ids)}`
                    : biciNome(b.bicicletta_id)
                }</span>
              </div>
            </div>
            <button className="ac-actionsheet-close" onClick={() => setActionSheet(null)}>
              <IconX />
            </button>
          </div>

          {/* Actions */}
          <div className="ac-actionsheet-body">

            {/* Contratto */}
            {b.firma_at ? (
              <button className="ac-actionsheet-btn" onClick={act(() => handleViewContratto(b.id))}>
                <IconFileText /><span>Vedi contratto firmato</span>
              </button>
            ) : (
              <button className="ac-actionsheet-btn" onClick={act(() => handleSendFirma(b.id))}>
                <IconMail /><span>Invia link firma contratto</span>
              </button>
            )}
            <button className="ac-actionsheet-btn" onClick={act(() => { setNoteModal({ id: b.id, nome: b.cliente_nome }); setNoteText(b.note_admin || ''); })}>
              <IconNote /><span>Note interne</span>
              {b.note_admin && <span className="ac-actionsheet-dot" />}
            </button>
            {b.checkin_at && (
              <button className="ac-actionsheet-btn" onClick={() => handleViewFoto(b.id, b.cliente_nome)}>
                <IconCamera /><span>Vedi foto check-in / checkout</span>
              </button>
            )}

            <div className="ac-actionsheet-sep" />

            {/* Comunicazione */}
            {isPaid && (
              <button className="ac-actionsheet-btn" onClick={act(() => { setRefundModal({ id: b.id, nome: b.cliente_nome, email: b.cliente_email, prezzo: b.prezzo_totale }); setRefundType('full'); setRefundAmount(Number(b.prezzo_totale).toFixed(2)); setRefundMotivo(''); })}>
                <IconEuro /><span>Rimborso Stripe</span>
              </button>
            )}
            <button className="ac-actionsheet-btn" onClick={act(() => handleWhatsApp(b))}>
              <IconBell /><span>WhatsApp rapido</span>
            </button>
            <button className="ac-actionsheet-btn" onClick={act(() => { setEmailModal({ id: b.id, nome: b.cliente_nome, email: b.cliente_email }); setEmailSubject(''); setEmailMessage(''); })}>
              <IconMail /><span>Invia email</span>
            </button>

            <div className="ac-actionsheet-sep" />

            {/* Modifica */}
            {isPaid && (
              <button className="ac-actionsheet-btn" onClick={act(() => { setRescheduleModal(b); setRescheduleForm({ data_ritiro: b.data_ritiro, tipo_noleggio: b.tipo_noleggio, giorni: b.giorni || 1 }); })}>
                <IconCalendar /><span>Sposta data</span>
              </button>
            )}
            {isPaid && (
              <button className="ac-actionsheet-btn" onClick={act(() => { setCambiaBiciModal({ id: b.id, nome: b.cliente_nome, bicicletta_id: b.bicicletta_id }); setCambiaBiciId(String(b.bicicletta_id)); })}>
                <IconBike /><span>Cambia bicicletta</span>
              </button>
            )}
            <button className="ac-actionsheet-btn" onClick={act(() => handlePrintRiepilogo(b))}>
              <IconDownload /><span>Stampa riepilogo PDF</span>
            </button>

            {/* Cauzione */}
            {isPaid && b.cauzione_status === 'authorized' && (
              <>
                <div className="ac-actionsheet-sep" />
                <button className="ac-actionsheet-btn" onClick={act(() => setDepositModal({ id: b.id, nome: b.cliente_nome, action: 'release' }))}>
                  <IconCheck /><span>Rilascia cauzione (€500)</span>
                </button>
                <button className="ac-actionsheet-btn" onClick={act(() => setDepositModal({ id: b.id, nome: b.cliente_nome, action: 'capture' }))}>
                  <IconAlert /><span>Incassa cauzione per danni</span>
                </button>
              </>
            )}
            {isPaid && b.cauzione_status !== 'authorized' && (
              <>
                <div className="ac-actionsheet-sep" />
                <button className="ac-actionsheet-btn"
                  disabled={!b.stripe_payment_method_id || b.danno_status === 'charged'}
                  onClick={act(() => setDamageModal({ id: b.id, nome: b.cliente_nome }))}>
                  <IconCard /><span>Addebita danno extra</span>
                </button>
              </>
            )}

            <div className="ac-actionsheet-sep" />

            {/* Cancella */}
            <button className="ac-actionsheet-btn danger" onClick={act(() => cancelBooking(b.id))}>
              <IconX /><span>Cancella prenotazione</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── FOTO MODAL ──────────────────────────────────────────────────────────────

  function renderFotoModal() {
    const { loading, nome, foto } = fotoModal;
    const photos = [
      { key: 'documento', label: 'Documento — fronte', src: foto.documento     },
      { key: 'docretro',  label: 'Documento — retro',  src: foto.documentoRetro},
      { key: 'consegna',  label: 'Bici alla consegna', src: foto.consegna      },
      { key: 'rientro',   label: 'Bici al rientro',    src: foto.rientro       },
    ];
    const hasFoto = photos.some(p => p.src);
    return (
      <div className="ac-overlay" onClick={e => e.target === e.currentTarget && setFotoModal(null)}>
        <div className="ac-modal">
          <div className="ac-modal-header">
            <h2>Foto — {nome}</h2>
            <button className="ac-icon-btn" onClick={() => setFotoModal(null)}><IconX /></button>
          </div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <div className="spinner" />
            </div>
          ) : !hasFoto ? (
            <div style={{ padding: '32px 22px', textAlign: 'center', color: '#6B8BAF', fontSize: '0.9rem' }}>
              Nessuna foto salvata per questa prenotazione.
            </div>
          ) : (
            <div style={{ padding: '16px 18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {photos.filter(p => p.src).map(p => (
                <div key={p.key}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#4ADE80', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
                    {p.label}
                  </div>
                  <a href={p.src} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                    <img
                      src={p.src}
                      alt={p.label}
                      style={{ width: '100%', borderRadius: 8, border: '1px solid #1A2840', display: 'block', cursor: 'zoom-in' }}
                    />
                  </a>
                  <div style={{ fontSize: '0.7rem', color: '#4B6278', marginTop: 4, textAlign: 'right' }}>
                    Tocca per aprire a schermo intero
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="ac-modal-footer">
            <button className="ac-btn ghost full" onClick={() => setFotoModal(null)}>Chiudi</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── REFUND MODAL ────────────────────────────────────────────────────────────

  function renderRefundModal() {
    const prezzo = Number(refundModal.prezzo);
    return (
      <div className="ac-overlay" onClick={e => e.target === e.currentTarget && setRefundModal(null)}>
        <div className="ac-modal" style={{ maxWidth: 440 }}>
          <div className="ac-modal-header">
            <h2><IconEuro /> Rimborso Stripe</h2>
            <button className="ac-icon-btn" onClick={() => setRefundModal(null)}><IconX /></button>
          </div>
          <div className="ac-modal-info">
            Cliente: <strong>{refundModal.nome}</strong> — Pagato: <strong>€{prezzo.toFixed(2)}</strong>
          </div>

          <div className="ac-field">
            <label className="ac-label">Tipo rimborso</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={`ac-btn sm${refundType === 'full' ? ' primary' : ' ghost'}`}
                onClick={() => { setRefundType('full'); setRefundAmount(prezzo.toFixed(2)); }}>
                Totale (€{prezzo.toFixed(2)})
              </button>
              <button className={`ac-btn sm${refundType === 'partial' ? ' primary' : ' ghost'}`}
                onClick={() => { setRefundType('partial'); setRefundAmount(''); }}>
                Parziale
              </button>
            </div>
          </div>

          {refundType === 'partial' && (
            <div className="ac-field">
              <label className="ac-label">Importo rimborso (€) — max €{prezzo.toFixed(2)}</label>
              <input className="ac-input" type="number" min="0.01" max={prezzo} step="0.01"
                placeholder={`es. ${(prezzo / 2).toFixed(2)}`}
                value={refundAmount} onChange={e => setRefundAmount(e.target.value)} autoFocus />
            </div>
          )}

          <div className="ac-field">
            <label className="ac-label">Motivo (opzionale)</label>
            <input className="ac-input" type="text" placeholder="Es. Prenotazione annullata, maltempo…"
              value={refundMotivo} onChange={e => setRefundMotivo(e.target.value)} />
          </div>

          <div style={{ padding: '0 22px 12px' }}>
            <div style={{ background: '#1A2840', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#8FA8C8', lineHeight: 1.5 }}>
              I fondi tornano al cliente entro 5–10 giorni lavorativi a seconda della banca.
            </div>
          </div>

          <div className="ac-modal-footer">
            <button className="ac-btn danger full" onClick={handleRefund}
              disabled={refundLoading || !refundAmount || parseFloat(refundAmount) <= 0}>
              {refundLoading ? 'Elaborazione…' : `Rimborsa €${Number(refundAmount || 0).toFixed(2)}`}
            </button>
            <button className="ac-btn ghost" onClick={() => setRefundModal(null)} disabled={refundLoading}>Annulla</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── RESCHEDULE MODAL ────────────────────────────────────────────────────────

  function renderRescheduleModal() {
    const b = rescheduleModal;
    const f = rescheduleForm;
    return (
      <div className="ac-overlay" onClick={e => e.target === e.currentTarget && setRescheduleModal(null)}>
        <div className="ac-modal" style={{ maxWidth: 460 }}>
          <div className="ac-modal-header">
            <h2><IconCalendar /> Sposta Data</h2>
            <button className="ac-icon-btn" onClick={() => setRescheduleModal(null)}><IconX /></button>
          </div>
          <div className="ac-modal-info">
            Cliente: <strong>{b.cliente_nome}</strong> — Bici: <strong>#{b.bicicletta_id}</strong>
          </div>

          <div style={{ padding: '16px 22px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
            <div className="ac-field" style={{ padding: 0, marginBottom: 12 }}>
              <label className="ac-label">Nuova data ritiro</label>
              <input className="ac-input" type="date" value={f.data_ritiro || ''}
                onChange={e => setRescheduleForm(p => ({ ...p, data_ritiro: e.target.value }))} />
            </div>
            <div className="ac-field" style={{ padding: 0, marginBottom: 12 }}>
              <label className="ac-label">Tipo noleggio</label>
              <select className="ac-select" value={f.tipo_noleggio || 'intera_giornata'}
                onChange={e => setRescheduleForm(p => ({ ...p, tipo_noleggio: e.target.value }))}>
                <option value="mezza_mattina">½ Mattina (09–13)</option>
                <option value="mezza_pomeriggio">½ Pomeriggio (14–18)</option>
                <option value="intera_giornata">Giornata intera (09–18)</option>
                <option value="multi_giorno">Multi-giorno</option>
              </select>
            </div>
            {f.tipo_noleggio === 'multi_giorno' && (
              <div className="ac-field" style={{ padding: 0, marginBottom: 12 }}>
                <label className="ac-label">Giorni</label>
                <input className="ac-input" type="number" min="2" max="30"
                  value={f.giorni || 2}
                  onChange={e => setRescheduleForm(p => ({ ...p, giorni: e.target.value }))} />
              </div>
            )}
          </div>

          <div style={{ padding: '0 22px 12px' }}>
            <div style={{ background: '#1A2840', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#8FA8C8' }}>
              La bici #{b.bicicletta_id} rimane assegnata se disponibile nella nuova data.
            </div>
          </div>

          <div className="ac-modal-footer">
            <button className="ac-btn primary full" onClick={handleReschedule}
              disabled={rescheduleLoading || !f.data_ritiro}>
              {rescheduleLoading ? 'Salvataggio…' : 'Conferma Spostamento'}
            </button>
            <button className="ac-btn ghost" onClick={() => setRescheduleModal(null)} disabled={rescheduleLoading}>Annulla</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── CAMBIA BICI MODAL ───────────────────────────────────────────────────────

  function renderCambiaBiciModal() {
    const b = cambiaBiciModal;
    return (
      <div className="ac-overlay" onClick={e => e.target === e.currentTarget && setCambiaBiciModal(null)}>
        <div className="ac-modal" style={{ maxWidth: 380 }}>
          <div className="ac-modal-header">
            <h2><IconBike /> Cambia Bicicletta</h2>
            <button className="ac-icon-btn" onClick={() => setCambiaBiciModal(null)}><IconX /></button>
          </div>
          <div className="ac-modal-info">
            Cliente: <strong>{b.nome}</strong> — Bici attuale: <strong>{biciNome(b.bicicletta_id)}</strong>
          </div>

          <div className="ac-field">
            <label className="ac-label">Nuova bicicletta</label>
            <select className="ac-select" value={cambiaBiciId}
              onChange={e => setCambiaBiciId(e.target.value)}>
              {BICI.map(bk => (
                <option key={bk.id} value={bk.id} disabled={bk.id === b.bicicletta_id}>
                  {bk.nome} — {bk.tipo}{bk.id === b.bicicletta_id ? ' (attuale)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="ac-modal-footer">
            <button className="ac-btn primary full" onClick={handleCambiaBici}
              disabled={cambiaBiciLoading || !cambiaBiciId || parseInt(cambiaBiciId) === b.bicicletta_id}>
              {cambiaBiciLoading ? 'Aggiornamento…' : `Assegna ${biciNome(cambiaBiciId)}`}
            </button>
            <button className="ac-btn ghost" onClick={() => setCambiaBiciModal(null)} disabled={cambiaBiciLoading}>Annulla</button>
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

    const statusLabel = { authorized: '€500 bloccati', captured: 'Incassata', cancelled: 'Rilasciata', pending: 'In attesa', failed: 'Non riuscita', no_card: 'No carta Stripe', authorizing: 'In corso…' };
    const statusClass = { authorized: 'cauzione-ok', captured: 'cauzione-cap', cancelled: 'muted', pending: 'yellow', failed: 'red', no_card: 'muted', authorizing: 'yellow' };

    // Calcola se il PI rischia di scadere (Stripe: 7 giorni da autorizzazione)
    // Approssimazione: se data_ritiro + giorni_noleggio > oggi+7, avvisa
    function piScadenza(b) {
      if (b.cauzione_status !== 'authorized') return null;
      const ritiro = new Date(b.data_ritiro + 'T00:00:00');
      const restituzione = b.data_restituzione ? new Date(b.data_restituzione + 'T00:00:00') : ritiro;
      const scadenzaPi = new Date(ritiro);
      scadenzaPi.setDate(scadenzaPi.getDate() - 2 + 7); // autorizzato 2gg prima, scade dopo 7gg
      return restituzione > scadenzaPi;
    }

    return (
      <div className="ac-cauzioni">
        {/* Summary cards */}
        <div className="ac-cau-summary">
          <div className="ac-cau-card green">
            <div className="ac-cau-num">{authorized.length}</div>
            <div className="ac-cau-lbl">Bloccate attive</div>
            <div className="ac-cau-amt">€{(authorized.length * 500).toLocaleString('it-IT')}</div>
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
                        <div className="ac-cell-sub">{tipoShort(b.tipo_noleggio, b.giorni)}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>#{b.bicicletta_id}</td>
                      <td><span className="ac-price">€{Number(b.prezzo_totale).toFixed(0)}</span></td>
                      <td>
                        <span className={`ac-badge ${statusClass[b.cauzione_status] || 'muted'}`}>
                          {b.cauzione_status === 'captured'
                            ? `€${Number(b.cauzione_captured_amount||0).toFixed(0)} incassati`
                            : statusLabel[b.cauzione_status] || '—'}
                        </span>
                        {piScadenza(b) && (
                          <div style={{ marginTop: 4 }}>
                            <span className="ac-badge red" title="Il blocco Stripe scade dopo 7 giorni dall'autorizzazione. Per questo noleggio multi-giorno lungo, potrebbe scadere prima della restituzione. Se ci sono danni, usa 'Addebita danno' invece di 'Incassa cauzione'.">
                              ⚠ PI in scadenza
                            </span>
                          </div>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {b.cauzione_status === 'authorized' && (
                          <>
                            <button className="ac-action-btn release" onClick={() => setDepositModal({ id: b.id, nome: b.cliente_nome, action: 'release' })}>✓ Rilascia</button>
                            <button className="ac-action-btn capture" onClick={() => setDepositModal({ id: b.id, nome: b.cliente_nome, action: 'capture' })}>⚠ Danni</button>
                          </>
                        )}
                        {(b.cauzione_status === 'pending' || b.cauzione_status === 'failed' || !b.cauzione_status) && (
                          <button
                            className="ac-action-btn warn"
                            onClick={async () => {
                              if (!confirm(`Autorizzare manualmente la cauzione di €500 per ${b.cliente_nome}?`)) return;
                              try {
                                await adminApi.autorizzaCauzione(b.id);
                                alert('Cauzione autorizzata con successo!');
                                loadCauzioni();
                              } catch (e) {
                                alert('Errore: ' + e.message);
                              }
                            }}
                          >
                            ⚡ Autorizza ora
                          </button>
                        )}
                        {(b.cauzione_status === 'captured' || b.cauzione_status === 'cancelled') && (
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

  function renderAuditLog() {
    const ACTION_LABELS = {
      cancel:            'Cancellazione',
      manual_booking:    'Prenotazione manuale',
      reschedule:        'Modifica data',
      assegna_bici:      'Cambio bici',
      checkin:           'Check-in',
      checkout_bici:     'Check-out',
      charge_damage:     'Addebito danno',
      autorizza_cauzione:'Autorizza cauzione',
      release_deposit:   'Rilascio cauzione',
      capture_deposit:   'Incasso cauzione',
      refund:            'Rimborso',
      send_email:        'Email cliente',
      send_firma:        'Link firma',
      note_update:       'Nota admin',
      chiusura_add:      'Chiusura aggiunta',
      chiusura_delete:   'Chiusura rimossa',
      flotta_update:     'Aggiornamento flotta',
    };
    const ACTION_COLORS = {
      cancel: '#ef4444', charge_damage: '#ef4444', capture_deposit: '#ef4444',
      refund: '#f59e0b', release_deposit: '#10b981',
      checkin: '#3b82f6', checkout_bici: '#8b5cf6',
      autorizza_cauzione: '#f59e0b', manual_booking: '#10b981',
    };

    function exportAuditLog(format) {
      if (!auditLog.length) return;
      const stamp = new Date().toISOString().substring(0, 10);
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(auditLog, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `audit-log-${stamp}.json`; a.click();
        URL.revokeObjectURL(url);
        return;
      }
      // CSV
      const esc = v => {
        if (v === null || v === undefined) return '';
        const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = ['data_ora', 'azione', 'azione_label', 'booking_id', 'ip', 'dettagli'];
      const rows = auditLog.map(e => [
        e.created_at,
        e.azione,
        ACTION_LABELS[e.azione] || e.azione,
        e.booking_id || '',
        e.ip || '',
        e.dettagli ? JSON.stringify(e.dettagli) : '',
      ].map(esc).join(';'));
      const csv  = '﻿' + [header.join(';'), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `audit-log-${stamp}.csv`; a.click();
      URL.revokeObjectURL(url);
    }

    return (
      <div className="ac-section">
        <div className="ac-audit-toolbar">
          <p className="ac-audit-count">
            Ultime {auditLog.length} azioni registrate
          </p>
          <div className="ac-audit-actions">
            <button className="ac-btn secondary sm" onClick={() => exportAuditLog('csv')}
              disabled={auditLogLoading || !auditLog.length}>
              ⬇ CSV
            </button>
            <button className="ac-btn secondary sm" onClick={() => exportAuditLog('json')}
              disabled={auditLogLoading || !auditLog.length}>
              ⬇ JSON
            </button>
            <button className="ac-btn secondary sm" onClick={loadAuditLog} disabled={auditLogLoading}>
              <IconRefresh /> Aggiorna
            </button>
          </div>
        </div>

        {auditLogLoading && <div className="ac-spinner-center"><div className="ac-spinner" /></div>}

        {!auditLogLoading && auditLog.length === 0 && (
          <div className="ac-empty">
            <p>Nessuna azione registrata.</p>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '8px' }}>
              Le azioni verranno registrate qui dopo la prossima operazione admin.
            </p>
          </div>
        )}

        {!auditLogLoading && auditLog.length > 0 && (
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Data/Ora</th>
                  <th>Azione</th>
                  <th>Prenotazione</th>
                  <th>Dettagli</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map(entry => (
                  <tr key={entry.id}>
                    <td style={{ whiteSpace: 'nowrap', color: '#94a3b8', fontSize: '0.8rem' }}>
                      {formatDateTime(entry.created_at)}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: (ACTION_COLORS[entry.azione] || '#3b82f6') + '22',
                        color: ACTION_COLORS[entry.azione] || '#3b82f6',
                        border: `1px solid ${(ACTION_COLORS[entry.azione] || '#3b82f6')}44`,
                      }}>
                        {ACTION_LABELS[entry.azione] || entry.azione}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#cbd5e1' }}>
                      {entry.booking_id ? entry.booking_id.toUpperCase().slice(0, 8) : '—'}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: '#94a3b8', maxWidth: '260px' }}>
                      {entry.dettagli && Object.keys(entry.dettagli).length > 0
                        ? Object.entries(entry.dettagli)
                            .filter(([, v]) => v !== '' && v !== null && v !== undefined)
                            .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                            .join(' · ')
                        : '—'}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                      {entry.ip || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  function renderImpostazioni() {
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
            <button
              className="ac-btn ghost sm"
              onClick={() =>
                adminApi.whatsappTest()
                  .then(() => alert('Messaggio WhatsApp di test inviato!'))
                  .catch(e => alert(e.message || 'Errore invio WhatsApp'))
              }
            >
              Test WhatsApp
            </button>
          </div>
        </div>


      </div>
    );
  }

}

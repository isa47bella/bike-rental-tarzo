# Admin Panel Redesign — Smart Inbox + Automazioni Passive

**Data:** 2026-05-17
**Stato:** Design approvato — in attesa di plan di implementazione
**Scope:** Solo admin panel. Sito pubblico non toccato. Logica esistente intoccabile.

## Obiettivo

Trasformare l'admin panel da lista passiva a **feed di azioni prioritarie**, con look più curato e accogliente, e aggiungere automazioni backend che riducono il lavoro manuale del gestore. Il tutto **senza rompere** la logica esistente (pagamenti, cauzioni, availability, mobile bottom-nav).

## Non-goals (cosa NON facciamo)

- Modifiche al sito pubblico (booking wizard, pagamenti, firma)
- Modifiche alla logica Stripe (checkout, refund, cauzione lifecycle)
- Modifiche al calcolo di availability/pricing
- Modifiche alle email transazionali esistenti
- Workflow builder o agent LLM (esplicitamente fuori scope)
- Sostituzione bottom-nav mobile (resta quello)

## Vincoli operativi

- Tutte le tabelle DB esistenti restano invariate. Solo additions consentite (nuove colonne con default, nuove tabelle).
- Deployment incrementale: ogni fase ≈ 1 PR, deployabile in modo indipendente, retrocompatibile.
- Mobile responsive obbligatorio per ogni nuova UI.

---

## 1. Visual System — design tokens

Il nuovo admin usa la palette **Clean Modern Light** con accento brand arancione.

### Color tokens (da definire come CSS custom properties)

| Token | Valore | Uso |
|---|---|---|
| `--ac-bg` | `#F9FAFB` | Page background |
| `--ac-surface` | `#FFFFFF` | Card / panel |
| `--ac-surface-alt` | `#F3F4F6` | Alternate row / muted |
| `--ac-border` | `#E5E7EB` | Divider / card border |
| `--ac-border-strong` | `#D1D5DB` | Hover / focus border |
| `--ac-text` | `#0F172A` | Heading |
| `--ac-text-body` | `#1F2937` | Body |
| `--ac-text-muted` | `#6B7280` | Sub / label |
| `--ac-brand` | `#EA580C` | CTA, link, nav active |
| `--ac-brand-soft` | `#FFEDD5` | Brand pill bg |
| `--ac-red` | `#DC2626` | Urgente |
| `--ac-red-soft` | `#FEF2F2` | Urgente bg |
| `--ac-amber` | `#F59E0B` | Warning |
| `--ac-amber-soft` | `#FFFBEB` | Warning bg |
| `--ac-green` | `#16A34A` | Success / paid |
| `--ac-green-soft` | `#ECFDF5` | Success bg |

Font invariati: Barlow Condensed (headings) + Barlow (body), già caricati.

Radius/shadow:
- `--ac-r-btn: 6px`
- `--ac-r-card: 10px`
- `--ac-r-modal: 14px`
- `--ac-sh-card: 0 1px 2px rgba(0,0,0,0.04)`
- `--ac-sh-modal: 0 4px 16px rgba(0,0,0,0.06)`

I token esistenti dark restano nel codice (per eventuale toggle futuro) ma non vengono applicati di default.

## 2. Layout & Navigation

### Desktop (≥1024px)

```
┌──────────────────────────────────────────────────────────────┐
│ [Logo+Brand]   [Search ⌘K]                       🔔  [Acc] ▾ │ ← topbar 56px
├──────────┬───────────────────────────────────────────────────┤
│ Sidebar  │                                                   │
│  🏠 Home │           Main content                            │
│  📅 Pren │           (KPI strip + Action Feed o lista)      │
│  🚲 Flot │                                                   │
│  💶 Cauz │                                                   │
│  📊 Rep  │                                                   │
│  📆 Cal  │                                                   │
│  📜 Log  │                                                   │
└──────────┴───────────────────────────────────────────────────┘
```

- Sidebar fissa **220px** (oggi 64px collapsato — troppo stretto per labels). Mostra icona + label.
- Topbar h **56px** con titolo pagina + search trigger (`⌘K`) + bell notifiche + menu account.
- Search trigger: chip "Cerca prenotazioni, clienti…" che apre modal Cmd+K.

### Mobile (<640px)

- Bottom-nav esistente **invariato** (5 voci principali).
- Topbar h **50px** con titolo pagina + icona lente (apre search overlay) + icona campana (apre notification sheet).
- Sidebar nascosta (come oggi).

### Home view default — Hybrid layout

```
┌─────────────────────────────────────────┐
│ KPI strip (3 tile)                      │
│ €oggi  |  Bici X/10  |  Azioni 3        │
├─────────────────────────────────────────┤
│ Action Feed (cards)                     │
│ ─────────────────────────────────────── │
│ Ritiri / Restituzioni di oggi (compatti)│
└─────────────────────────────────────────┘
```

- KPI strip: 3 tile bianche, divider verticale tra ognuna. Su mobile collassano a riga compatta unica con divisori sottili.
- Action Feed: cards bianche con bordo sx colorato (rosso = priority 1, ambra = priority 2, nessuno = info).
- Sezione "Oggi" sotto al feed: replica dell'attuale "Oggi" in versione compatta — ritiri, restituzioni.

## 3. Smart Inbox features

### 3.1 Action Feed — tipologie e priorità

Il feed mostra cards generate da query in tempo reale. Ordine di priorità top-down:

| Priorità | Trigger | Tipo card | Azione one-tap |
|---|---|---|---|
| 🔴 P1 | `cauzione_status = 'failed'` | "Cauzione fallita — €500 non autorizzati" | Riprova / Chiama cliente |
| 🔴 P1 | Booking `paid` + `checkin_at IS NULL` + `orario_ritiro < now - 30min` (ritardo ritiro) | "Cliente in ritardo ritiro" | WhatsApp / Marca no-show |
| 🔴 P1 | Booking `checkin_at IS NOT NULL` + `checkout_at IS NULL` + `orario_restituzione < now - 30min` (ritardo riconsegna) | "Bici non restituita" | WhatsApp / Chiama |
| 🟡 P2 | Booking `paid` + `firma_at IS NULL` + `data_ritiro = today + 1` | "Firma manca — ritiro domani" | Invia link firma |
| 🟡 P2 | `danno_status IS NOT NULL` + `danno_status != 'resolved'` | "Danno aperto" | Vedi dettaglio / Capture |
| 🔵 P3 | Booking di oggi (`data_ritiro = today` o `data_restituzione = today`) | "Ritiri/Restituzioni oggi" (lista compatta, non card singole) | Click → modal check-in/out |

Quando l'azione viene completata (es. cauzione riprovata con successo, firma inviata, check-in fatto) la card sparisce dal feed al prossimo refresh.

### 3.2 Search globale

- **Shortcut:** `⌘K` (desktop) — modal centrato. **Mobile:** icona lente in topbar → overlay full-screen.
- **Input:** ricerca live (debounce 200ms), min 2 caratteri.
- **Campi cercati:** `cliente_nome`, `cliente_email`, `cliente_telefono`, `id` (anche short id 8 chars).
- **Risultati raggruppati:**
  - **Prenotazioni** — fino a 10 risultati, ognuno con nome, data, bici, status badge.
  - **Clienti** — deduplicato per email, mostra "N prenotazioni totali" + link "vedi tutte".
- **Navigation:** frecce ↑↓ + Enter per aprire dettaglio.
- **Endpoint:** nuovo `GET /api/admin/search?q=...` che fa fan-out su `prenotazioni` con OR su nome/email/telefono/id.

### 3.3 Bulk actions

Solo nella view **Prenotazioni** (la tabella esistente).

- Checkbox a sinistra di ogni riga + header "Seleziona tutti i visibili".
- Quando ≥1 selezionata, appare **action bar fissa in basso** (fixed, sopra la bottom-nav su mobile):
  - `N selezionate`
  - `📧 Email` → modal con template + variabili (`{nome}`, `{data}`, `{bici}`)
  - `💬 WhatsApp` → genera link `wa.me` per ognuno (apre N tab) o template copia
  - `🚫 Cancella` → conferma esplicita "Vuoi cancellare N prenotazioni?"
- Backend: nessuna nuova route per email/WA bulk — usa quelle esistenti in loop sequenziale, con summary di success/error a fine.

### 3.4 Notification center

- **Trigger:** icona campana nel topbar (desktop) o icona campana in topbar mobile.
- **Badge:** numero notifiche non lette (max "9+").
- **Panel:** drawer da destra (desktop, larghezza 360px) / bottom sheet 80vh (mobile).
- **Contenuto:** ultimi 30 eventi sortati per `created_at DESC`. Ogni item: icona tipo, titolo, descrizione breve, timestamp relativo.
- **Tipi notifica:**
  - `cauzione_failed`, `cauzione_authorized`
  - `no_show`, `ritardo_ritiro`, `ritardo_riconsegna`
  - `danno_aperto`
  - `firma_received`, `firma_reminder_sent`
  - `nuova_prenotazione_paid`
- **Azioni:** click su notifica → naviga a booking/azione rilevante. Bottone "Segna tutto come letto".

**DB:** nuova tabella `notifiche`:
```sql
CREATE TABLE notifiche (
  id          BIGSERIAL    PRIMARY KEY,
  tipo        TEXT         NOT NULL,
  booking_id  UUID,
  titolo      TEXT         NOT NULL,
  descrizione TEXT,
  letta_at    TIMESTAMPTZ  DEFAULT NULL,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX idx_notifiche_unread ON notifiche(created_at DESC) WHERE letta_at IS NULL;
```

Le notifiche sono **scritte dai cron e dai webhook esistenti** (zero refactor del payment webhook — aggiungiamo solo `INSERT INTO notifiche` accanto al `console.log` esistente).

### 3.5 Auto-refresh real-time

- **Strategia:** polling silenzioso ogni **30s** quando la tab è attiva.
- **Endpoint:** `GET /api/admin/heartbeat` (nuovo) ritorna:
  ```json
  { "azioni_pendenti": 3, "notifiche_non_lette": 5, "last_booking_id": "...", "ts": "..." }
  ```
- **Frontend:** hook `useHeartbeat()` aggiorna i contatori delle card priority + badge bell. Se cambia `last_booking_id` → toast "Nuova prenotazione".
- **Pausa polling:** Page Visibility API → quando tab in background, pausa. Riprende a focus.
- **Indicatore:** piccolo "Aggiornato Xs fa" nel topbar (font 11px, mute).
- Quando un cron job aggiorna lo stato, l'admin lo vede entro 30s senza F5.

## 4. Backend Automations (4 cron job)

Tutti aggiunti come nuovi cron in `vercel.json` + nuove route `/api/cron/*`. Autenticati col `CRON_SECRET` esistente.

### 4.1 Auto-cancel pending dopo 30min

- **Cron:** `*/10 * * * *` (ogni 10 min)
- **Logica:** `UPDATE prenotazioni SET pagamento_status='cancelled' WHERE pagamento_status='pending' AND created_at < now() - interval '30 minutes' RETURNING id`.
- Per ogni booking cancellato, se ha `stripe_session_id`, prova `stripe.checkout.sessions.expire()` (no-op se già scaduta).
- Log: `INSERT INTO notifiche` di tipo `pending_auto_cancelled` solo se > 0.
- **Rationale:** libera slot calendario occupati da carrelli abbandonati.

### 4.2 Auto-retry cauzioni `failed`

- **Cron:** `0 */6 * * *` (ogni 6 ore)
- **Logica:** seleziona `cauzione_status='failed' AND data_ritiro >= today AND cauzione_retry_count < 3`.
- Per ogni booking: tenta `paymentIntents.create` come fa già il cron deposit. Se OK → `authorized`. Se fail → incrementa `cauzione_retry_count`. Se `retry_count >= 3` → marca `cauzione_status='failed_permanent'` + `INSERT INTO notifiche`.
- **DB:** nuova colonna `cauzione_retry_count INT DEFAULT 0` su `prenotazioni`.
- **Rationale:** carte temporaneamente declined (limite giornaliero, fondi insufficienti momentanei) hanno spesso successo al re-try ore dopo.

### 4.3 Auto-reminder firma H-24

- **Verifica esistente:** `firma-reminder` cron già esiste in `backend/routes/cron.js`. Verificare durante implementazione se invia notifica admin in caso di firma non ottenuta entro H-24. Se manca, aggiungere `INSERT INTO notifiche` di tipo `firma_reminder_sent` o `firma_ancora_mancante`.
- Nessuna route nuova se quella esistente è sufficiente.

### 4.4 Auto-cleanup audit log >6 mesi

- **Cron:** `0 3 * * 0` (domenica notte 03:00 UTC)
- **Logica:** `DELETE FROM audit_log WHERE created_at < now() - interval '180 days'`.
- Solo le azioni elencate nell'allowlist conservative restano (es. `capture_deposit`, `refund`, `cancel`) — anche queste eliminate dopo 180gg per GDPR (la fonte di verità per i pagamenti è Stripe).
- Log: `console.log` del count eliminato. Nessuna notifica.
- **Rationale:** privacy-friendly + DB più snello.

## 5. Architettura — file e moduli

### Backend (nuovi file)

```
backend/routes/
├── admin.js              ← AGGIUNTE: /search, /heartbeat, /notifiche, /notifiche/:id/read, /notifiche/read-all
├── cron.js               ← AGGIUNTE: /cron/auto-cancel-pending, /cron/retry-cauzioni, /cron/cleanup-audit
└── notifications.js      ← NUOVO: helper per scrivere notifiche (writeNotification(supabase, tipo, bookingId, titolo, desc))

backend/lib/
└── (nessuna modifica)
```

### Frontend (nuovi file + modifiche)

```
frontend/src/components/AdminDashboard.jsx       ← refactor incrementale (split in sotto-componenti)
frontend/src/components/admin/
├── KpiStrip.jsx           ← NUOVO
├── ActionFeed.jsx         ← NUOVO
├── ActionCard.jsx         ← NUOVO
├── SearchModal.jsx        ← NUOVO
├── NotificationDrawer.jsx ← NUOVO
├── BulkActionBar.jsx      ← NUOVO
└── useHeartbeat.js        ← NUOVO (hook polling)
frontend/src/styles/admin-tokens.css  ← NUOVO (CSS custom properties)
```

L'attuale `AdminDashboard.jsx` (~2900 righe) verrà gradualmente alleggerito estraendo le viste in componenti separate man mano che le tocchiamo. **Non è obiettivo di questo redesign** fare un refactor totale del file: spostiamo solo ciò che modifichiamo.

### Database (additions only, mai destructive)

```sql
-- Notifiche
CREATE TABLE IF NOT EXISTS notifiche (
  id BIGSERIAL PRIMARY KEY, tipo TEXT NOT NULL, booking_id UUID,
  titolo TEXT NOT NULL, descrizione TEXT,
  letta_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifiche_unread ON notifiche(created_at DESC) WHERE letta_at IS NULL;

-- Cauzione retry counter
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS cauzione_retry_count INT DEFAULT 0;
```

## 6. Cosa NON cambia (sigillo di sicurezza)

| Area | Status |
|---|---|
| Stripe checkout, webhook, refund | INTOCCATO |
| Cauzione lifecycle (cron deposit, autorizza, release, capture) | INTOCCATO (aggiungo solo retry_count) |
| Availability/pricing logic (`backend/routes/availability.js`) | INTOCCATO |
| Email transazionali e sendWhatsAppAlert | INTOCCATO |
| Sito pubblico (BookingWizard e Steps) | INTOCCATO |
| Mobile bottom-nav (struttura) | INTOCCATO (solo nuovi badge counter) |
| Tabelle DB esistenti (struttura) | INTOCCATO (solo additions) |
| Endpoint admin esistenti | INTOCCATO (solo nuovi endpoint aggiunti) |
| Token admin (`26arfanta`) e auth flow | INTOCCATO |
| i18n esistente | INTOCCATO (nuove stringhe solo in `it.json` — admin non multilingua) |

## 7. Strategia di rollout (incrementale)

Ogni fase è una PR atomica, deployabile e retrocompatibile. Ordine:

1. **Phase 1 — Design tokens + topbar light** (rischio: 🟢 basso)
   - CSS custom properties nuove + applicazione su topbar e sidebar
   - Nessuna nuova feature: solo refresh estetico
   - Validation: confronto screenshot before/after, mobile responsive

2. **Phase 2 — Backend automations (cron job nuovi)** (rischio: 🟡 medio)
   - Endpoint `/api/cron/auto-cancel-pending`, `/api/cron/retry-cauzioni`, `/api/cron/cleanup-audit`
   - Migration DB: `notifiche` table + `cauzione_retry_count` column
   - Aggiunta cron in `vercel.json`
   - Validation: trigger manuale di ogni cron via `curl` e verifica side-effects in DB

3. **Phase 3 — Action Feed nella home** (rischio: 🟡 medio)
   - Componente `ActionFeed` + `ActionCard` + `KpiStrip`
   - Sostituisce la vista "Oggi" attuale (vista vecchia preservata come `OggiLegacy` per rollback)
   - Validation: ogni tipo di card testato con booking di test

4. **Phase 4 — Search globale** (rischio: 🟢 basso)
   - Endpoint `/api/admin/search`
   - `SearchModal` con shortcut ⌘K + FAB mobile
   - Validation: query con accenti italiani, telefono con spazi, short id

5. **Phase 5 — Bulk actions** (rischio: 🟡 medio)
   - Checkbox + `BulkActionBar` nella view Prenotazioni
   - Validation: bulk cancel con 5+ booking, verifica nessuna race condition

6. **Phase 6 — Notification center** (rischio: 🟢 basso)
   - `NotificationDrawer` + endpoint CRUD notifiche
   - Cron e webhook esistenti aggiornati per scrivere su `notifiche`
   - Validation: una notifica per tipo viene scritta correttamente

7. **Phase 7 — Auto-refresh polling** (rischio: 🟢 basso)
   - `useHeartbeat` hook + endpoint `/api/admin/heartbeat`
   - Toast notification per nuova booking paid
   - Validation: nessuna richiesta extra quando tab nascosta

## 8. Criteri di accettazione

Il redesign è "done" quando:
- ✅ Il gestore apre la home admin e vede in 2 secondi: numeri chiave + cose che richiedono azione
- ✅ Cliccando una card priority compie l'azione in ≤2 tap
- ✅ Search trova qualunque cliente/prenotazione in <300ms
- ✅ Le 4 automazioni passive girano in produzione senza generare false notifiche
- ✅ Mobile: tutto leggibile e usabile su iPhone SE (320px width)
- ✅ Nessuna regressione su check-in/checkout, prenotazione manuale, cauzioni, refund
- ✅ Audit log + cron logs Vercel non mostrano errori dopo 1 settimana di esercizio

## 9. Open questions

Nessuna al momento. Tutte le decisioni di scope chiuse durante il brainstorming. Eventuali sotto-dettagli (es. icone esatte, copy delle card) si risolvono in fase di implementation plan.

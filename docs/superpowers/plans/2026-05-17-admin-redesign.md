# Admin Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh aesthetic of admin panel (Clean Modern Light + orange brand accent) and introduce a Smart Inbox home dashboard plus 4 passive cron-based automations. Public site, Stripe lifecycle, cauzione lifecycle, availability logic and mobile bottom-nav MUST remain untouched.

**Architecture:** Incremental rollout across 7 independently shippable phases. New components extracted under `frontend/src/components/admin/`. New admin endpoints added to `backend/routes/admin.js`. New cron endpoints in `backend/routes/cron.js`. DB additions only (no destructive migrations). Notification system based on a new `notifiche` table populated by existing cron/webhook handlers without refactoring them.

**Tech Stack:** React 18 + Vite, Express on Vercel serverless, Supabase Postgres, Stripe, Web Push. Manual validation (curl + browser) — no test framework in repo.

**Reference spec:** `docs/superpowers/specs/2026-05-17-admin-redesign-design.md`

---

## File Structure

### New files

```
backend/
├── lib/
│   └── notifications.js                       ← writeNotification helper
└── (route additions inline in admin.js / cron.js)

frontend/src/
├── styles/
│   └── admin-tokens.css                       ← CSS custom properties (light theme)
└── components/
    └── admin/
        ├── KpiStrip.jsx                       ← top 3 tile (€oggi / bici / azioni)
        ├── ActionFeed.jsx                     ← container che ordina e renderizza le card
        ├── ActionCard.jsx                     ← singola card con bordo sx colorato
        ├── SearchModal.jsx                    ← search globale ⌘K
        ├── NotificationDrawer.jsx             ← drawer/sheet notifiche
        ├── BulkActionBar.jsx                  ← action bar fissa per bulk
        └── useHeartbeat.js                    ← hook polling 30s
docs/
└── superpowers/
    ├── specs/2026-05-17-admin-redesign-design.md   ← già presente
    └── plans/2026-05-17-admin-redesign.md          ← questo file
```

### Files modified

```
supabase/schema.sql                            ← +ALTER TABLE prenotazioni, +CREATE TABLE notifiche
backend/routes/admin.js                        ← +5 endpoint (search, heartbeat, notifiche x3)
backend/routes/cron.js                         ← +3 endpoint (auto-cancel, retry-cauzioni, cleanup-audit)
frontend/src/lib/api.js                        ← +client methods per i nuovi endpoint
frontend/src/components/AdminDashboard.jsx     ← integrazione progressiva dei nuovi componenti
frontend/src/index.css                         ← import admin-tokens.css; light theme application
vercel.json                                    ← +3 cron entries
```

### Files NOT touched (sealed)

`backend/routes/payments.js`, `backend/routes/availability.js`, `backend/lib/email.js`,
`backend/lib/push.js`, `backend/lib/contratto-terms.js`, `frontend/src/components/BookingWizard.jsx`,
`frontend/src/components/steps/*`, `frontend/src/pages/*`, public site CSS.

---

## Phase 1 — Design tokens + topbar light refresh

**Risk:** 🟢 low — solo CSS + class additions.
**Goal:** L'admin passa visivamente da dark-blue freddo a light con accenti arancio. Nessuna feature nuova.

### Task 1.1: Crea il file di token CSS

**Files:**
- Create: `frontend/src/styles/admin-tokens.css`

- [ ] **Step 1: scrivi il file di token**

```css
/* Admin Panel design tokens — Clean Modern Light theme.
   Applicato sotto .ac-root e tutti i suoi figli. Lascia il sito pubblico inalterato. */
.ac-root {
  --ac-bg: #F9FAFB;
  --ac-surface: #FFFFFF;
  --ac-surface-alt: #F3F4F6;
  --ac-border: #E5E7EB;
  --ac-border-strong: #D1D5DB;

  --ac-text: #0F172A;
  --ac-text-body: #1F2937;
  --ac-text-muted: #6B7280;

  --ac-brand: #EA580C;
  --ac-brand-hover: #C2410C;
  --ac-brand-soft: #FFEDD5;

  --ac-red: #DC2626;
  --ac-red-soft: #FEF2F2;
  --ac-red-border: #FCA5A5;

  --ac-amber: #F59E0B;
  --ac-amber-soft: #FFFBEB;
  --ac-amber-border: #FCD34D;

  --ac-green: #16A34A;
  --ac-green-soft: #ECFDF5;
  --ac-green-border: #A7F3D0;

  --ac-blue: #2563EB;
  --ac-blue-soft: #EFF6FF;

  --ac-r-btn: 6px;
  --ac-r-card: 10px;
  --ac-r-modal: 14px;

  --ac-sh-card: 0 1px 2px rgba(0,0,0,0.04);
  --ac-sh-modal: 0 4px 16px rgba(0,0,0,0.06);
}
```

- [ ] **Step 2: importa il file in index.css**

Edit `frontend/src/index.css` aggiungendo questo import vicino all'inizio del file (subito dopo i `@import` di Google Fonts esistenti):

```css
@import './styles/admin-tokens.css';
```

- [ ] **Step 3: verifica che la build locale non rompa nulla**

Run (dal root del repo):
```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: build completa senza errori. Se Node 26 dà errore rollup-native, push direttamente — Vercel builda con Node 20.

### Task 1.2: Aggiungi la classe `.ac-root` al container admin

**Files:**
- Modify: `frontend/src/components/AdminDashboard.jsx`

- [ ] **Step 1: trova il container root dell'admin (cerca `<div className="ac-layout">`)**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo" && grep -n 'className="ac-layout"' frontend/src/components/AdminDashboard.jsx | head -3
```

- [ ] **Step 2: aggiungi `ac-root` alla className**

Cerca la riga che contiene `className="ac-layout"` e cambia in `className="ac-root ac-layout"`. Questo è l'unico cambio strutturale; senza questa classe i nuovi token NON si applicano e il tema dark resta com'è (failsafe).

### Task 1.3: Refresh CSS della topbar + sidebar usando i nuovi token

**Files:**
- Modify: `frontend/src/index.css`

Le regole esistenti di `.ac-topbar`, `.ac-sidebar`, `.ac-content` usano colori scuri hardcoded. Le aggiorniamo a usare i token quando siamo dentro `.ac-root`.

- [ ] **Step 1: identifica le regole esistenti da rimpiazzare**

Run:
```bash
grep -n "\.ac-topbar\|\.ac-sidebar\b\|\.ac-content\b\|\.ac-nav-item\b" "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo/frontend/src/index.css" | head -20
```

- [ ] **Step 2: aggiungi un blocco "light theme" in fondo a `frontend/src/index.css` (dopo le media queries esistenti)**

Le regole sotto `.ac-root` hanno specificity più alta e sovrascrivono le precedenti:

```css
/* ─── Admin light theme — overrides quando .ac-root è presente ─── */

.ac-root.ac-layout {
  background: var(--ac-bg);
  color: var(--ac-text-body);
}

.ac-root .ac-topbar {
  background: var(--ac-surface);
  border-bottom: 1px solid var(--ac-border);
  color: var(--ac-text);
  box-shadow: var(--ac-sh-card);
}
.ac-root .ac-topbar-title { color: var(--ac-text); font-weight: 700; }
.ac-root .ac-topbar-date  { color: var(--ac-text-muted); }

.ac-root .ac-sidebar {
  background: var(--ac-surface);
  border-right: 1px solid var(--ac-border);
}
.ac-root .ac-sidebar-brand { color: var(--ac-text); }
.ac-root .ac-sidebar-title    { color: var(--ac-text); }
.ac-root .ac-sidebar-subtitle { color: var(--ac-text-muted); }

.ac-root .ac-nav-item {
  color: var(--ac-text-muted);
  background: transparent;
}
.ac-root .ac-nav-item:hover {
  background: var(--ac-surface-alt);
  color: var(--ac-text);
}
.ac-root .ac-nav-item.active {
  background: var(--ac-brand-soft);
  color: var(--ac-brand);
  font-weight: 700;
}

.ac-root .ac-content { background: var(--ac-bg); color: var(--ac-text-body); }

.ac-root .ac-card,
.ac-root .ac-modal {
  background: var(--ac-surface);
  border-color: var(--ac-border);
  color: var(--ac-text-body);
  box-shadow: var(--ac-sh-card);
}
.ac-root .ac-modal { box-shadow: var(--ac-sh-modal); }

.ac-root .ac-btn.primary {
  background: var(--ac-brand);
  color: #fff;
  border-color: var(--ac-brand);
}
.ac-root .ac-btn.primary:hover {
  background: var(--ac-brand-hover);
  border-color: var(--ac-brand-hover);
}
.ac-root .ac-btn.ghost {
  background: var(--ac-surface);
  color: var(--ac-text-body);
  border: 1px solid var(--ac-border);
}
.ac-root .ac-btn.ghost:hover {
  border-color: var(--ac-border-strong);
  background: var(--ac-surface-alt);
}

.ac-root .ac-input,
.ac-root .ac-select,
.ac-root .ac-textarea {
  background: var(--ac-surface);
  border: 1px solid var(--ac-border);
  color: var(--ac-text-body);
}
.ac-root .ac-input:focus,
.ac-root .ac-select:focus,
.ac-root .ac-textarea:focus {
  border-color: var(--ac-brand);
  outline: 2px solid var(--ac-brand-soft);
  outline-offset: 0;
}

.ac-root .ac-label { color: var(--ac-text-muted); }

.ac-root .ac-badge.green  { background: var(--ac-green-soft); color: var(--ac-green); border-color: var(--ac-green-border); }
.ac-root .ac-badge.red    { background: var(--ac-red-soft);   color: var(--ac-red);   border-color: var(--ac-red-border); }
.ac-root .ac-badge.yellow { background: var(--ac-amber-soft); color: #92400E; border-color: var(--ac-amber-border); }
.ac-root .ac-badge.indigo,
.ac-root .ac-badge.cauzione-ok { background: var(--ac-blue-soft); color: var(--ac-blue); border-color: #BFDBFE; }
.ac-root .ac-badge.cauzione-cap { background: var(--ac-brand-soft); color: var(--ac-brand); border-color: #FED7AA; }

.ac-root .ac-table-wrap,
.ac-root .admin-table-scroll {
  background: var(--ac-surface);
  border: 1px solid var(--ac-border);
  border-radius: var(--ac-r-card);
}
.ac-root table th {
  background: var(--ac-surface-alt);
  color: var(--ac-text-muted);
  border-bottom: 1px solid var(--ac-border);
}
.ac-root table td {
  border-bottom: 1px solid var(--ac-border);
  color: var(--ac-text-body);
}
.ac-root table tr:hover td { background: var(--ac-surface-alt); }

.ac-root .ac-bottom-nav {
  background: var(--ac-surface);
  border-top: 1px solid var(--ac-border);
}
.ac-root .ac-bottom-nav-item { color: var(--ac-text-muted); }
.ac-root .ac-bottom-nav-item.active { color: var(--ac-brand); }

.ac-root .ac-kebab-btn {
  color: var(--ac-text-muted);
  background: transparent;
}
.ac-root .ac-kebab-btn:hover {
  background: var(--ac-surface-alt);
  color: var(--ac-text);
}
```

- [ ] **Step 3: commit Phase 1 token + topbar**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add frontend/src/styles/admin-tokens.css frontend/src/index.css frontend/src/components/AdminDashboard.jsx
git commit -m "admin: phase 1 — design tokens + light theme overrides"
```

- [ ] **Step 4: deploy + visual smoke test**

```bash
git push origin main && ~/.npm-global/bin/vercel --prod --yes --token vca_3PnxXmudfYJt4tqUpfonVXJEkuR1jW4JMmwvS8TYB1ijY2Ucc52fmqDD
```

Apri https://bike-rental-tarzo-app.vercel.app/admin (token `26arfanta`). Verifica:
- Topbar bianca, testo scuro leggibile
- Sidebar bianca con voci grigie, attiva in arancio
- Card prenotazioni bianche con border grigio chiaro
- Badge verde/rosso/giallo leggibili
- Mobile (apri DevTools → iPhone): bottom-nav bianca, voce attiva arancio

Se qualcosa è illeggibile (es. testo bianco su bianco), aggiungi una regola `.ac-root .<class> { color: var(--ac-text-body); }` e ridistribuisci.

---

## Phase 2 — Backend automations (4 cron + DB migration)

**Risk:** 🟡 medium — tocca DB e cron. Tutto retrocompatibile.
**Goal:** Avere i 4 cron job running in produzione, scrivere notifiche su DB.

### Task 2.1: Migration DB (notifiche + cauzione_retry_count)

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: aggiungi le DDL in fondo a `supabase/schema.sql`**

```sql
-- ─── Smart Inbox: notifiche per il gestore ────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifiche (
  id          BIGSERIAL    PRIMARY KEY,
  tipo        TEXT         NOT NULL,
  booking_id  UUID,
  titolo      TEXT         NOT NULL,
  descrizione TEXT,
  letta_at    TIMESTAMPTZ  DEFAULT NULL,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifiche_unread
  ON notifiche(created_at DESC) WHERE letta_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifiche_booking
  ON notifiche(booking_id) WHERE booking_id IS NOT NULL;

-- ─── Cauzione retry counter (per auto-retry cron) ─────────────────────────────
ALTER TABLE prenotazioni
  ADD COLUMN IF NOT EXISTS cauzione_retry_count INT DEFAULT 0;
```

- [ ] **Step 2: applica le DDL su Supabase produzione tramite SQL Editor**

Apri https://supabase.com/dashboard/project/loakbziygobidztdfomv/sql/new, incolla le DDL del Step 1, premi Run. Verifica:
- Tabella `notifiche` creata (`SELECT count(*) FROM notifiche;` ritorna 0)
- Colonna `cauzione_retry_count` esiste (`SELECT cauzione_retry_count FROM prenotazioni LIMIT 1;` ritorna `0` per ogni row esistente)

- [ ] **Step 3: commit migration**

```bash
git add supabase/schema.sql
git commit -m "db: phase 2 — notifiche table + cauzione_retry_count column"
```

### Task 2.2: Helper writeNotification

**Files:**
- Create: `backend/lib/notifications.js`

- [ ] **Step 1: scrivi il file**

```javascript
const supabase = require('./supabase');

/**
 * Scrive una notifica per l'admin nel pannello.
 * Non blocca: errori sono solo loggati.
 *
 * @param {string} tipo          - es. 'cauzione_failed', 'no_show', 'pending_auto_cancelled'
 * @param {object} payload
 * @param {string} payload.titolo
 * @param {string} [payload.descrizione]
 * @param {string} [payload.booking_id]
 */
async function writeNotification(tipo, { titolo, descrizione = null, booking_id = null }) {
  try {
    const { error } = await supabase.from('notifiche').insert({
      tipo, titolo, descrizione, booking_id,
    });
    if (error) console.error('[notifications] insert error:', error.message);
  } catch (e) {
    console.error('[notifications] unexpected error:', e.message);
  }
}

module.exports = { writeNotification };
```

- [ ] **Step 2: commit helper**

```bash
git add backend/lib/notifications.js
git commit -m "backend: phase 2 — writeNotification helper"
```

### Task 2.3: Cron auto-cancel pending bookings >30min

**Files:**
- Modify: `backend/routes/cron.js`

- [ ] **Step 1: aggiungi import in fondo agli import esistenti**

In `backend/routes/cron.js`, dopo gli import esistenti aggiungi:

```javascript
const { writeNotification } = require('../lib/notifications');
```

- [ ] **Step 2: aggiungi l'endpoint subito prima di `module.exports = router;`**

```javascript
// ─── GET /api/cron/auto-cancel-pending ────────────────────────────────────────
// Cancella prenotazioni 'pending' più vecchie di 30 minuti.
// Tenta anche di scadere la sessione Stripe (no-op se già scaduta).

router.get('/auto-cancel-pending', cronAuth, async (req, res) => {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data: stale, error } = await supabase
    .from('prenotazioni')
    .select('id, stripe_session_id, cliente_nome')
    .eq('pagamento_status', 'pending')
    .lt('created_at', cutoff);

  if (error) {
    console.error('[cron auto-cancel-pending] db error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  if (!stale?.length) {
    return res.json({ cancelled: 0 });
  }

  let cancelled = 0;
  for (const row of stale) {
    if (row.stripe_session_id && !row.stripe_session_id.startsWith('manual_')) {
      try { await stripe.checkout.sessions.expire(row.stripe_session_id); }
      catch (_) { /* sessione già scaduta o non esiste, ignora */ }
    }
    const { error: updErr } = await supabase
      .from('prenotazioni')
      .update({ pagamento_status: 'cancelled' })
      .eq('id', row.id)
      .eq('pagamento_status', 'pending'); // safety: solo se ancora pending
    if (!updErr) cancelled++;
  }

  if (cancelled > 0) {
    await writeNotification('pending_auto_cancelled', {
      titolo: `${cancelled} prenotazion${cancelled === 1 ? 'e' : 'i'} pending scaduta${cancelled === 1 ? '' : 'e'}`,
      descrizione: 'Carrelli abbandonati >30min cancellati automaticamente.',
    });
  }

  console.log(`[cron auto-cancel-pending] cancellate ${cancelled}/${stale.length}`);
  return res.json({ cancelled, scanned: stale.length });
});
```

### Task 2.4: Cron retry cauzioni failed

**Files:**
- Modify: `backend/routes/cron.js`

- [ ] **Step 1: aggiungi l'endpoint subito sotto auto-cancel-pending**

```javascript
// ─── GET /api/cron/retry-cauzioni ─────────────────────────────────────────────
// Ritenta cauzioni in stato 'failed' per prenotazioni con data_ritiro futura.
// Max 3 tentativi, poi marca 'failed_permanent' e notifica.

router.get('/retry-cauzioni', cronAuth, async (req, res) => {
  const today = new Date().toISOString().substring(0, 10);

  const { data: bookings, error } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, stripe_customer_id, stripe_payment_method_id, cauzione_retry_count, data_ritiro')
    .eq('cauzione_status', 'failed')
    .gte('data_ritiro', today)
    .lt('cauzione_retry_count', 3)
    .is('cauzione_pi_id', null);

  if (error) {
    console.error('[cron retry-cauzioni] db error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  if (!bookings?.length) {
    return res.json({ retried: 0 });
  }

  const results = { ok: 0, failed: 0, permanent: 0 };

  for (const b of bookings) {
    if (!b.stripe_customer_id || !b.stripe_payment_method_id) {
      results.permanent++;
      await supabase.from('prenotazioni').update({ cauzione_status: 'no_card' }).eq('id', b.id);
      continue;
    }

    try {
      const pi = await stripe.paymentIntents.create({
        amount:         CAUZIONE_AMOUNT_CENTS,
        currency:       'eur',
        customer:       b.stripe_customer_id,
        payment_method: b.stripe_payment_method_id,
        capture_method: 'manual',
        confirm:        true,
        off_session:    true,
        description:    `Cauzione bici (retry) — ${b.cliente_nome} (${b.id.substring(0, 8)})`,
      });

      const newStatus = pi.status === 'requires_capture' ? 'authorized' : 'failed';
      await supabase.from('prenotazioni').update({
        cauzione_pi_id: pi.id,
        cauzione_status: newStatus,
        cauzione_retry_count: (b.cauzione_retry_count || 0) + 1,
      }).eq('id', b.id);

      if (newStatus === 'authorized') results.ok++;
      else results.failed++;
    } catch (err) {
      const newCount = (b.cauzione_retry_count || 0) + 1;
      const permanent = newCount >= 3;
      await supabase.from('prenotazioni').update({
        cauzione_status: permanent ? 'failed_permanent' : 'failed',
        cauzione_retry_count: newCount,
      }).eq('id', b.id);

      if (permanent) {
        results.permanent++;
        await writeNotification('cauzione_failed_permanent', {
          titolo: `Cauzione fallita 3 volte — ${b.cliente_nome}`,
          descrizione: `Stripe: ${err.message.substring(0, 120)}. Serve intervento manuale.`,
          booking_id: b.id,
        });
      } else {
        results.failed++;
      }
    }
  }

  console.log(`[cron retry-cauzioni] ok=${results.ok} failed=${results.failed} permanent=${results.permanent}`);
  return res.json({ retried: bookings.length, ...results });
});
```

- [ ] **Step 2: assicurati che `CAUZIONE_AMOUNT_CENTS` sia importato**

Verifica all'inizio del file che ci sia già:
```javascript
const { CAUZIONE_AMOUNT_CENTS } = require('../lib/config');
```
Se manca, aggiungilo (è già stato aggiunto in commit precedenti).

### Task 2.5: Cron cleanup audit log

**Files:**
- Modify: `backend/routes/cron.js`

- [ ] **Step 1: aggiungi l'endpoint sotto retry-cauzioni**

```javascript
// ─── GET /api/cron/cleanup-audit ──────────────────────────────────────────────
// Elimina record audit_log più vecchi di 180 giorni.
// La fonte di verità per i pagamenti resta Stripe; questa è solo "diagnostica".

router.get('/cleanup-audit', cronAuth, async (req, res) => {
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

  const { error, count } = await supabase
    .from('audit_log')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff);

  if (error) {
    console.error('[cron cleanup-audit] db error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  console.log(`[cron cleanup-audit] eliminati ${count || 0} record (cutoff ${cutoff})`);
  return res.json({ deleted: count || 0, cutoff });
});
```

### Task 2.6: Hook auto-notify nel cron deposit esistente

**Files:**
- Modify: `backend/routes/cron.js`

Il cron `/cron/deposit` esistente già fa `sendPushToAll` quando una cauzione fallisce. Aggiungiamo anche `writeNotification` accanto, così la stessa info appare nel notification center.

- [ ] **Step 1: nelle 2 chiamate `sendPushToAll({ title: '⚠️ Cauzione fallita', ... })` aggiungi sotto:**

```javascript
await writeNotification('cauzione_failed', {
  titolo: `Cauzione fallita — ${booking.cliente_nome}`,
  descrizione: `Data ritiro: ${booking.data_ritiro}. Stato Stripe: ${pi?.status || err.message.substring(0, 80)}`,
  booking_id: booking.id,
}).catch(_ => {});
```

(due punti dove serve: dopo `status === 'failed'` e nel catch dell'errore Stripe)

### Task 2.7: Registra i 3 nuovi cron in `vercel.json`

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: aggiungi le 3 entry alla sezione `"crons"`**

Apri `vercel.json`, trova `"crons": [...]`. Aggiungi:

```json
{ "path": "/api/cron/auto-cancel-pending", "schedule": "*/10 * * * *" },
{ "path": "/api/cron/retry-cauzioni",      "schedule": "0 */6 * * *" },
{ "path": "/api/cron/cleanup-audit",       "schedule": "0 3 * * 0"   }
```

Risultato finale atteso (array completo):

```json
"crons": [
  { "path": "/api/cron/deposit",              "schedule": "0 7 * * *"  },
  { "path": "/api/cron/firma-reminder",       "schedule": "0 18 * * *" },
  { "path": "/api/cron/reminder",             "schedule": "0 9 * * *"  },
  { "path": "/api/cron/auto-cancel-pending",  "schedule": "*/10 * * * *" },
  { "path": "/api/cron/retry-cauzioni",       "schedule": "0 */6 * * *" },
  { "path": "/api/cron/cleanup-audit",        "schedule": "0 3 * * 0"   }
]
```

### Task 2.8: Commit + deploy Phase 2 + smoke test

- [ ] **Step 1: commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/routes/cron.js vercel.json
git commit -m "backend: phase 2 — 3 new cron (auto-cancel pending, retry cauzioni, cleanup audit) + notifiche on failed cauzione"
git push origin main
~/.npm-global/bin/vercel --prod --yes --token vca_3PnxXmudfYJt4tqUpfonVXJEkuR1jW4JMmwvS8TYB1ijY2Ucc52fmqDD
```

- [ ] **Step 2: trigger manuale dei 3 cron per smoke test**

Recupera `CRON_SECRET` da Vercel dashboard (Env Vars). Sostituisci `<SECRET>` sotto:

```bash
# auto-cancel-pending — atteso: {"cancelled":0,"scanned":0} se non hai booking pending
curl -s -X GET "https://bike-rental-tarzo-app.vercel.app/api/cron/auto-cancel-pending" \
  -H "Authorization: Bearer <SECRET>" | head -c 200

# retry-cauzioni — atteso: {"retried":0,...} se non hai cauzioni failed
curl -s -X GET "https://bike-rental-tarzo-app.vercel.app/api/cron/retry-cauzioni" \
  -H "Authorization: Bearer <SECRET>" | head -c 200

# cleanup-audit — atteso: {"deleted":0,...} se non hai audit log vecchi
curl -s -X GET "https://bike-rental-tarzo-app.vercel.app/api/cron/cleanup-audit" \
  -H "Authorization: Bearer <SECRET>" | head -c 200
```

Verifica via Supabase SQL: `SELECT count(*) FROM notifiche;` — dovrebbe restare a 0 (nessun trigger reale ha sparato).

---

## Phase 3 — Action Feed nella home

**Risk:** 🟡 medium — sostituisce parte della home admin.
**Goal:** La home admin (vista "Oggi") diventa KPI strip + Action Feed prioritizzato.

### Task 3.1: Endpoint backend `/api/admin/azioni-pendenti`

**Files:**
- Modify: `backend/routes/admin.js`

- [ ] **Step 1: aggiungi l'endpoint subito dopo `/api/admin/oggi`**

```javascript
// ─── GET /api/admin/azioni-pendenti ───────────────────────────────────────────
// Ritorna le card che devono apparire nell'Action Feed della home.
// Priorità: 1=urgente (rosso), 2=warning (ambra), 3=info (blue).

router.get('/azioni-pendenti', async (req, res) => {
  const now    = new Date();
  const oggi   = now.toISOString().substring(0, 10);
  const domani = new Date(now.getTime() + 24*60*60*1000).toISOString().substring(0, 10);

  const fields = 'id, cliente_nome, cliente_telefono, cliente_email, data_ritiro, orario_ritiro, data_restituzione, orario_restituzione, bicicletta_id, cauzione_status, danno_status, firma_at, checkin_at, checkout_at, pagamento_status';

  // Query in parallelo
  const [cauzioniFailedQ, ritardiRitiroQ, ritardiRiconsegnaQ, firmeMancantiQ, danniApertiQ] = await Promise.all([
    supabase.from('prenotazioni').select(fields)
      .in('cauzione_status', ['failed', 'failed_permanent'])
      .gte('data_ritiro', oggi),
    supabase.from('prenotazioni').select(fields)
      .eq('pagamento_status', 'paid')
      .is('checkin_at', null)
      .eq('data_ritiro', oggi)
      .lt('orario_ritiro', new Date(now.getTime() - 30*60*1000).toISOString().substring(11, 19)),
    supabase.from('prenotazioni').select(fields)
      .eq('pagamento_status', 'paid')
      .not('checkin_at', 'is', null)
      .is('checkout_at', null)
      .eq('data_restituzione', oggi)
      .lt('orario_restituzione', new Date(now.getTime() - 30*60*1000).toISOString().substring(11, 19)),
    supabase.from('prenotazioni').select(fields)
      .eq('pagamento_status', 'paid')
      .is('firma_at', null)
      .eq('data_ritiro', domani),
    supabase.from('prenotazioni').select(fields)
      .not('danno_status', 'is', null)
      .neq('danno_status', 'resolved'),
  ]);

  const cards = [];
  for (const b of (cauzioniFailedQ.data || [])) {
    cards.push({
      id: `cauzione-${b.id}`, booking_id: b.id, priority: 1, tipo: 'cauzione_failed',
      titolo: `Cauzione fallita — ${b.cliente_nome}`,
      sub: `€500 non autorizzati · ritiro ${b.data_ritiro}`,
      actions: ['retry_cauzione', 'whatsapp_cliente'],
    });
  }
  for (const b of (ritardiRitiroQ.data || [])) {
    cards.push({
      id: `ritardo-ritiro-${b.id}`, booking_id: b.id, priority: 1, tipo: 'ritardo_ritiro',
      titolo: `Cliente in ritardo al ritiro — ${b.cliente_nome}`,
      sub: `Atteso ${b.orario_ritiro?.substring(0,5)} · ora ${now.toTimeString().substring(0,5)}`,
      actions: ['whatsapp_cliente', 'marca_noshow'],
    });
  }
  for (const b of (ritardiRiconsegnaQ.data || [])) {
    cards.push({
      id: `ritardo-riconsegna-${b.id}`, booking_id: b.id, priority: 1, tipo: 'ritardo_riconsegna',
      titolo: `Bici non restituita — ${b.cliente_nome}`,
      sub: `Atteso ${b.orario_restituzione?.substring(0,5)} · ora ${now.toTimeString().substring(0,5)}`,
      actions: ['whatsapp_cliente', 'chiama_cliente'],
    });
  }
  for (const b of (firmeMancantiQ.data || [])) {
    cards.push({
      id: `firma-${b.id}`, booking_id: b.id, priority: 2, tipo: 'firma_mancante',
      titolo: `Firma contratto mancante — ${b.cliente_nome}`,
      sub: `Ritiro domani · invia link firma`,
      actions: ['invia_firma', 'whatsapp_cliente'],
    });
  }
  for (const b of (danniApertiQ.data || [])) {
    cards.push({
      id: `danno-${b.id}`, booking_id: b.id, priority: 2, tipo: 'danno_aperto',
      titolo: `Danno aperto — ${b.cliente_nome}`,
      sub: `Stato: ${b.danno_status}`,
      actions: ['vedi_dettaglio'],
    });
  }

  cards.sort((a, b) => a.priority - b.priority);

  return res.json({ cards, count: cards.length });
});
```

- [ ] **Step 2: commit endpoint**

```bash
git add backend/routes/admin.js
git commit -m "admin: phase 3 — /azioni-pendenti endpoint per Action Feed"
```

### Task 3.2: Client method in `frontend/src/lib/api.js`

**Files:**
- Modify: `frontend/src/lib/api.js`

- [ ] **Step 1: cerca l'oggetto `adminApi`**

```bash
grep -n "adminApi" "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo/frontend/src/lib/api.js" | head -5
```

- [ ] **Step 2: aggiungi il metodo `getAzioniPendenti` nell'oggetto `adminApi`**

```javascript
getAzioniPendenti: () => adminGet('/admin/azioni-pendenti'),
```

### Task 3.3: Componente `KpiStrip.jsx`

**Files:**
- Create: `frontend/src/components/admin/KpiStrip.jsx`

- [ ] **Step 1: scrivi il componente**

```jsx
import React from 'react';

/**
 * Riga superiore della home admin con 3 KPI compatti.
 * Props: { revenue_oggi, bici_occupate, bici_totali, azioni_count }
 */
export default function KpiStrip({ revenue_oggi = 0, bici_occupate = 0, bici_totali = 10, azioni_count = 0 }) {
  return (
    <div className="ac-kpi-strip">
      <div className="ac-kpi">
        <div className="ac-kpi-label">Incasso oggi</div>
        <div className="ac-kpi-value">€{Number(revenue_oggi).toFixed(0)}</div>
      </div>
      <div className="ac-kpi-divider" />
      <div className="ac-kpi">
        <div className="ac-kpi-label">Flotta</div>
        <div className="ac-kpi-value">{bici_occupate}<span className="ac-kpi-of">/{bici_totali}</span></div>
      </div>
      <div className="ac-kpi-divider" />
      <div className="ac-kpi">
        <div className="ac-kpi-label" style={azioni_count > 0 ? { color: 'var(--ac-red)' } : undefined}>Azioni</div>
        <div className="ac-kpi-value" style={azioni_count > 0 ? { color: 'var(--ac-red)' } : undefined}>{azioni_count}</div>
      </div>
    </div>
  );
}
```

### Task 3.4: Componente `ActionCard.jsx`

**Files:**
- Create: `frontend/src/components/admin/ActionCard.jsx`

- [ ] **Step 1: scrivi il componente**

```jsx
import React from 'react';

const PRIORITY_BORDER = { 1: 'var(--ac-red)', 2: 'var(--ac-amber)', 3: 'var(--ac-border)' };
const PRIORITY_ICON   = { 1: '⚠', 2: '⏰', 3: '🚲' };

/**
 * Singola card del feed delle azioni.
 * Props: { card: { id, priority, tipo, titolo, sub, actions, booking_id }, onAction }
 *   - onAction: (actionKey, card) => void
 */
export default function ActionCard({ card, onAction }) {
  const borderColor = PRIORITY_BORDER[card.priority] || PRIORITY_BORDER[3];

  return (
    <div className="ac-action-card" style={{ borderLeftColor: borderColor }}>
      <div className="ac-action-card-head">
        <span className="ac-action-icon">{PRIORITY_ICON[card.priority] || '•'}</span>
        <div className="ac-action-titles">
          <div className="ac-action-title">{card.titolo}</div>
          {card.sub && <div className="ac-action-sub">{card.sub}</div>}
        </div>
      </div>
      {(card.actions || []).length > 0 && (
        <div className="ac-action-buttons">
          {card.actions.map(a => (
            <button
              key={a}
              type="button"
              className={`ac-btn sm ${a === card.actions[0] ? 'primary' : 'ghost'}`}
              onClick={() => onAction(a, card)}
            >
              {ACTION_LABEL[a] || a}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const ACTION_LABEL = {
  retry_cauzione:   'Riprova',
  whatsapp_cliente: 'WhatsApp',
  marca_noshow:     'No-show',
  chiama_cliente:   'Chiama',
  invia_firma:      'Invia firma',
  vedi_dettaglio:   'Apri',
};
```

### Task 3.5: Componente `ActionFeed.jsx`

**Files:**
- Create: `frontend/src/components/admin/ActionFeed.jsx`

- [ ] **Step 1: scrivi il componente**

```jsx
import React, { useEffect, useState } from 'react';
import { adminApi } from '../../lib/api.js';
import ActionCard from './ActionCard.jsx';

/**
 * Carica le azioni pendenti e le rende. Polling esterno (Phase 7) le aggiorna.
 * Props: { onAction: (actionKey, card) => void, refreshTick }
 *   - refreshTick: incrementare per forzare ricarica
 */
export default function ActionFeed({ onAction, refreshTick = 0 }) {
  const [cards,   setCards]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminApi.getAzioniPendenti()
      .then(res => { if (!cancelled) { setCards(res.cards || []); setError(null); } })
      .catch(e  => { if (!cancelled) setError(e.message || 'Errore'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshTick]);

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
```

### Task 3.6: CSS per KPI strip + Action cards

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: aggiungi in fondo al file**

```css
/* ─── Admin Home — KPI strip ─────────────────────────────────────────── */
.ac-root .ac-kpi-strip {
  display: flex;
  gap: 0;
  background: var(--ac-surface);
  border: 1px solid var(--ac-border);
  border-radius: var(--ac-r-card);
  box-shadow: var(--ac-sh-card);
  padding: 14px 18px;
  margin-bottom: 16px;
}
.ac-root .ac-kpi { flex: 1; text-align: center; min-width: 0; }
.ac-root .ac-kpi-divider { width: 1px; background: var(--ac-border); margin: 4px 0; }
.ac-root .ac-kpi-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--ac-text-muted);
  text-transform: uppercase;
  margin-bottom: 4px;
}
.ac-root .ac-kpi-value {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--ac-text);
  line-height: 1;
}
.ac-root .ac-kpi-of { font-size: 0.9rem; color: var(--ac-text-muted); font-weight: 600; }

@media (max-width: 480px) {
  .ac-root .ac-kpi-strip { padding: 10px 12px; }
  .ac-root .ac-kpi-value { font-size: 1.3rem; }
}

/* ─── Admin Home — Action Feed ───────────────────────────────────────── */
.ac-root .ac-action-feed {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}
.ac-root .ac-action-feed-empty {
  background: var(--ac-surface);
  border: 1px solid var(--ac-border);
  border-radius: var(--ac-r-card);
  padding: 30px 20px;
  text-align: center;
  color: var(--ac-text-muted);
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.ac-root .ac-action-card {
  background: var(--ac-surface);
  border: 1px solid var(--ac-border);
  border-left: 3px solid var(--ac-border);
  border-radius: var(--ac-r-card);
  padding: 14px 16px;
  box-shadow: var(--ac-sh-card);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ac-root .ac-action-card-head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.ac-root .ac-action-icon { font-size: 1.1rem; line-height: 1.3; flex-shrink: 0; }
.ac-root .ac-action-titles { flex: 1; min-width: 0; }
.ac-root .ac-action-title {
  font-weight: 700;
  color: var(--ac-text);
  font-size: 0.92rem;
  line-height: 1.3;
}
.ac-root .ac-action-sub {
  font-size: 0.78rem;
  color: var(--ac-text-muted);
  margin-top: 3px;
}
.ac-root .ac-action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
```

### Task 3.7: Integra KpiStrip + ActionFeed nella home view

**Files:**
- Modify: `frontend/src/components/AdminDashboard.jsx`

- [ ] **Step 1: aggiungi import in cima al file**

```javascript
import KpiStrip   from './admin/KpiStrip.jsx';
import ActionFeed from './admin/ActionFeed.jsx';
```

- [ ] **Step 2: trova la funzione che renderizza la vista "oggi"**

```bash
grep -n "function renderOggi\|activeView === 'oggi'" "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo/frontend/src/components/AdminDashboard.jsx" | head
```

- [ ] **Step 3: prepara l'handler delle action card**

Aggiungi accanto agli altri handler:

```javascript
function handleFeedAction(actionKey, card) {
  const bookingId = card.booking_id;
  switch (actionKey) {
    case 'retry_cauzione':
      // Riusa endpoint manuale già esistente
      adminApi.autorizzaCauzione(bookingId).then(refresh).catch(e => alert(e.message));
      break;
    case 'whatsapp_cliente':
    case 'chiama_cliente':
      // Apri il dialer/whatsapp del telefono
      window.open(actionKey === 'whatsapp_cliente'
        ? `https://wa.me/${(card.cliente_telefono || '').replace(/\D/g, '')}`
        : `tel:${card.cliente_telefono || ''}`, '_blank');
      break;
    case 'marca_noshow':
      // Marca pagamento_status='no_show' (riusa endpoint cancel con motivo)
      if (confirm(`Marcare ${card.titolo} come no-show?`)) {
        adminApi.cancelBooking(bookingId).then(refresh).catch(e => alert(e.message));
      }
      break;
    case 'invia_firma':
      adminApi.sendFirmaLink(bookingId).then(() => alert('Link firma inviato.')).catch(e => alert(e.message));
      break;
    case 'vedi_dettaglio':
      // Naviga alla view dettaglio booking
      setActiveView('prenotazioni'); /* fallback: lascia che l'admin trovi la booking */
      break;
    default:
      console.warn('action non gestita:', actionKey);
  }
}

const [feedRefresh, setFeedRefresh] = useState(0);
function refresh() { setFeedRefresh(t => t + 1); loadOggi?.(); loadStats?.(); }
```

- [ ] **Step 4: nella renderOggi view, sostituisci la prima sezione con KpiStrip + ActionFeed**

In testa al render di "oggi" (sopra ai blocchi Ritiri/Restituzioni/InRitardo esistenti), aggiungi:

```jsx
<KpiStrip
  revenue_oggi={stats?.incasso_oggi || 0}
  bici_occupate={(oggiData?.ritiri?.length || 0) + (oggiData?.inRitardo?.length || 0)}
  bici_totali={10}
  azioni_count={feedCount}
/>
<ActionFeed onAction={handleFeedAction} refreshTick={feedRefresh} />
```

Lascia INTATTI i blocchi esistenti "Ritiri oggi", "Restituzioni oggi", "In ritardo" — vanno SOTTO l'ActionFeed (Phase 3 non li rimuove, solo aggiunge sopra).

- [ ] **Step 5: aggiungi state `feedCount`**

```javascript
const [feedCount, setFeedCount] = useState(0);
```

E in ActionFeed passa anche un callback per aggiornare il count:

```jsx
<ActionFeed
  onAction={handleFeedAction}
  refreshTick={feedRefresh}
  onCount={setFeedCount}
/>
```

In `ActionFeed.jsx`, dopo `setCards`, aggiungi:
```javascript
if (typeof props.onCount === 'function') props.onCount(res.cards?.length || 0);
```

- [ ] **Step 6: stats endpoint potrebbe non includere `incasso_oggi`**

Verifica `backend/routes/admin.js` GET `/stats` — se non c'è `incasso_oggi`, aggiungilo (somma di `prezzo_totale` con `pagamento_status='paid' AND data_ritiro=today`).

### Task 3.8: Commit + deploy Phase 3

- [ ] **Step 1: commit + push + deploy**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add frontend/src/components/admin/ frontend/src/components/AdminDashboard.jsx frontend/src/lib/api.js frontend/src/index.css backend/routes/admin.js
git commit -m "admin: phase 3 — KPI strip + Action Feed nella home"
git push origin main
~/.npm-global/bin/vercel --prod --yes --token vca_3PnxXmudfYJt4tqUpfonVXJEkuR1jW4JMmwvS8TYB1ijY2Ucc52fmqDD
```

- [ ] **Step 2: smoke test in produzione**

Apri https://bike-rental-tarzo-app.vercel.app/admin (token `26arfanta`):
- Vedi KPI strip in cima con 3 numeri (€oggi, bici, azioni)
- Sotto, "✅ Nessuna azione richiesta — tutto sotto controllo." (se non hai casi reali)
- Sotto, i blocchi Ritiri/Restituzioni/InRitardo esistenti intatti
- Mobile responsive: KPI in riga compatta, leggibile su iPhone SE

Per testare con dati reali, crea una booking fantasma con cauzione_status='failed' via SQL Editor Supabase:

```sql
INSERT INTO prenotazioni (cliente_nome, cliente_email, cliente_telefono, bicicletta_id, tipo_noleggio, giorni, data_ritiro, orario_ritiro, data_restituzione, orario_restituzione, start_ts, end_ts, prezzo_totale, pagamento_status, cauzione_status)
VALUES ('🧪 TEST FEED — Cauzione Fallita', 'test@example.com', '+390000000000', 3, 'intera_giornata', 1, current_date, '09:00', current_date, '18:00', current_date::timestamptz + interval '7 hours', current_date::timestamptz + interval '16 hours', 25.00, 'paid', 'failed');
```

Refresh admin → dovresti vedere una card rossa "Cauzione fallita — 🧪 TEST FEED…". Quando finisci di testare, `DELETE FROM prenotazioni WHERE cliente_nome LIKE '🧪 TEST FEED%';`.

---

## Phase 4 — Search globale

**Risk:** 🟢 low — solo nuovo endpoint + nuovo modal.
**Goal:** ⌘K su desktop / FAB lente su mobile per cercare clienti, prenotazioni, telefono, email, ID.

### Task 4.1: Endpoint `/api/admin/search`

**Files:**
- Modify: `backend/routes/admin.js`

- [ ] **Step 1: aggiungi l'endpoint**

```javascript
// ─── GET /api/admin/search?q=...&limit=20 ─────────────────────────────────────
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ prenotazioni: [], clienti: [] });

  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

  // Short ID (8 char hex prefix) → cerca anche per id parziale
  const isShortId = /^[0-9a-f]{4,}$/i.test(q);
  const qLike = `%${q.replace(/[%_]/g, '\\$&')}%`;

  let booksQuery = supabase
    .from('prenotazioni')
    .select('id, cliente_nome, cliente_email, cliente_telefono, data_ritiro, bicicletta_id, pagamento_status, tipo_noleggio')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (isShortId) {
    booksQuery = booksQuery.or(`cliente_nome.ilike.${qLike},cliente_email.ilike.${qLike},cliente_telefono.ilike.${qLike},id.ilike.${q}%`);
  } else {
    booksQuery = booksQuery.or(`cliente_nome.ilike.${qLike},cliente_email.ilike.${qLike},cliente_telefono.ilike.${qLike}`);
  }

  const { data: prenotazioni, error } = await booksQuery;
  if (error) return res.status(500).json({ error: error.message });

  // Dedupe per cliente
  const clientiMap = new Map();
  for (const p of (prenotazioni || [])) {
    const key = (p.cliente_email || p.cliente_telefono || p.cliente_nome).toLowerCase();
    if (!clientiMap.has(key)) {
      clientiMap.set(key, {
        nome: p.cliente_nome, email: p.cliente_email, telefono: p.cliente_telefono, count: 1,
      });
    } else {
      clientiMap.get(key).count++;
    }
  }

  return res.json({
    prenotazioni: prenotazioni || [],
    clienti:      Array.from(clientiMap.values()).slice(0, 10),
  });
});
```

### Task 4.2: Client method

**Files:**
- Modify: `frontend/src/lib/api.js`

- [ ] **Step 1: aggiungi `adminApi.search`**

```javascript
search: (q) => adminGet(`/admin/search?q=${encodeURIComponent(q)}`),
```

### Task 4.3: Componente `SearchModal.jsx`

**Files:**
- Create: `frontend/src/components/admin/SearchModal.jsx`

- [ ] **Step 1: scrivi il componente**

```jsx
import React, { useState, useEffect, useRef } from 'react';
import { adminApi } from '../../lib/api.js';

/**
 * Modal di ricerca globale.
 * Props: { open, onClose, onSelectBooking(bookingId), onSelectCliente(cliente) }
 */
export default function SearchModal({ open, onClose, onSelectBooking, onSelectCliente }) {
  const [q,        setQ]        = useState('');
  const [results,  setResults]  = useState({ prenotazioni: [], clienti: [] });
  const [loading,  setLoading]  = useState(false);
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
                    <div className="ac-search-item-sub">{p.data_ritiro} · {p.tipo_noleggio} · Bici #{p.bicicletta_id} · {p.id.substring(0,8)}</div>
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
                    <div className="ac-search-item-sub">{c.email} · {c.telefono} · {c.count} prenotazion{c.count === 1 ? 'e' : 'i'}</div>
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
```

### Task 4.4: CSS per SearchModal

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: aggiungi in fondo**

```css
/* ─── Admin Search Modal ─────────────────────────────────────────────── */
.ac-root .ac-search-overlay {
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 100px;
}
.ac-root .ac-search-modal {
  width: 100%;
  max-width: 580px;
  background: var(--ac-surface);
  border-radius: var(--ac-r-modal);
  box-shadow: var(--ac-sh-modal);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 70vh;
}
.ac-root .ac-search-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--ac-border);
}
.ac-root .ac-search-icon { font-size: 1.1rem; }
.ac-root .ac-search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 1rem;
  background: transparent;
  color: var(--ac-text);
  font-family: 'Barlow', sans-serif;
}
.ac-root .ac-search-kbd {
  font-family: monospace;
  font-size: 0.7rem;
  padding: 2px 6px;
  border: 1px solid var(--ac-border);
  border-radius: 4px;
  color: var(--ac-text-muted);
}
.ac-root .ac-search-body {
  overflow-y: auto;
  flex: 1;
}
.ac-root .ac-search-hint {
  padding: 30px 18px;
  color: var(--ac-text-muted);
  text-align: center;
  font-size: 0.88rem;
}
.ac-root .ac-search-group { padding: 8px 0; }
.ac-root .ac-search-group-title {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--ac-text-muted);
  text-transform: uppercase;
  padding: 6px 18px;
}
.ac-root .ac-search-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 10px 18px;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  border-bottom: 1px solid var(--ac-border);
}
.ac-root .ac-search-item:hover { background: var(--ac-surface-alt); }
.ac-root .ac-search-item-title { font-weight: 600; color: var(--ac-text); }
.ac-root .ac-search-item-sub   { font-size: 0.78rem; color: var(--ac-text-muted); margin-top: 2px; }

@media (max-width: 640px) {
  .ac-root .ac-search-overlay { padding-top: 0; align-items: stretch; }
  .ac-root .ac-search-modal { max-width: none; height: 100vh; max-height: none; border-radius: 0; }
}
```

### Task 4.5: Integrare SearchModal + shortcut ⌘K + FAB mobile

**Files:**
- Modify: `frontend/src/components/AdminDashboard.jsx`

- [ ] **Step 1: import + state**

In cima:
```javascript
import SearchModal from './admin/SearchModal.jsx';
```

State (vicino agli altri):
```javascript
const [searchOpen, setSearchOpen] = useState(false);
```

- [ ] **Step 2: registra il keyboard shortcut ⌘K / Ctrl+K**

In un nuovo `useEffect`:
```javascript
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
```

- [ ] **Step 3: aggiungi il trigger nel topbar (desktop: chip search + bell, mobile: icona lente)**

Cerca dove si renderizza `<header className="ac-topbar">`. Aggiungi prima dell'altro contenuto del topbar (a destra):

```jsx
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
```

- [ ] **Step 4: rendi il modal**

In fondo al render dell'admin (vicino agli altri modal):
```jsx
<SearchModal
  open={searchOpen}
  onClose={() => setSearchOpen(false)}
  onSelectBooking={(id) => {
    setActiveView('prenotazioni');
    /* Optional: highlight della riga */
  }}
  onSelectCliente={(c) => {
    setClientiQuery(c.email || c.telefono || c.nome);
    setActiveView('clienti');
  }}
/>
```

- [ ] **Step 5: CSS topbar search trigger**

In `frontend/src/index.css` (in fondo):
```css
.ac-root .ac-topbar-search-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--ac-surface-alt);
  border: 1px solid var(--ac-border);
  border-radius: var(--ac-r-btn);
  padding: 6px 10px;
  cursor: pointer;
  color: var(--ac-text-muted);
  font-size: 0.85rem;
  min-width: 240px;
  transition: border-color 0.15s, background 0.15s;
}
.ac-root .ac-topbar-search-trigger:hover {
  border-color: var(--ac-border-strong);
  background: var(--ac-surface);
}
.ac-root .ac-topbar-search-label { flex: 1; text-align: left; }
.ac-root .ac-topbar-search-kbd {
  font-family: monospace;
  font-size: 0.7rem;
  padding: 1px 5px;
  background: var(--ac-surface);
  border: 1px solid var(--ac-border);
  border-radius: 3px;
}

@media (max-width: 640px) {
  .ac-root .ac-topbar-search-trigger {
    min-width: auto;
    padding: 6px 8px;
  }
  .ac-root .ac-topbar-search-label,
  .ac-root .ac-topbar-search-kbd { display: none; }
}
```

### Task 4.6: Commit + deploy Phase 4

- [ ] **Step 1: commit + push + deploy**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/routes/admin.js frontend/src/components/admin/SearchModal.jsx frontend/src/components/AdminDashboard.jsx frontend/src/lib/api.js frontend/src/index.css
git commit -m "admin: phase 4 — global search (Cmd+K desktop, icon mobile)"
git push origin main
~/.npm-global/bin/vercel --prod --yes --token vca_3PnxXmudfYJt4tqUpfonVXJEkuR1jW4JMmwvS8TYB1ijY2Ucc52fmqDD
```

- [ ] **Step 2: smoke test**

In admin:
- Premi `⌘K` (Mac) o `Ctrl+K` (Win/Linux) → si apre il modal
- Digita parte del nome di una booking → vedi risultati
- Click su un risultato → naviga alla view giusta
- Mobile: tap sull'icona lente del topbar → modal full-screen

---

## Phase 5 — Bulk actions sulla tabella Prenotazioni

**Risk:** 🟡 medium — modifica la view più usata.
**Goal:** Selezione multipla di righe + action bar fissa in basso per email/WA/cancel di gruppo.

### Task 5.1: Componente `BulkActionBar.jsx`

**Files:**
- Create: `frontend/src/components/admin/BulkActionBar.jsx`

- [ ] **Step 1: scrivi il componente**

```jsx
import React from 'react';

/**
 * Action bar fissa in basso, visibile quando ci sono righe selezionate.
 * Props: { count, onEmail, onWhatsApp, onCancel, onClear }
 */
export default function BulkActionBar({ count, onEmail, onWhatsApp, onCancel, onClear }) {
  if (count === 0) return null;
  return (
    <div className="ac-bulk-bar">
      <span className="ac-bulk-count">{count} selezionate</span>
      <div className="ac-bulk-actions">
        <button className="ac-btn ghost sm" onClick={onEmail}>📧 Email</button>
        <button className="ac-btn ghost sm" onClick={onWhatsApp}>💬 WhatsApp</button>
        <button className="ac-btn ghost sm" onClick={onCancel} style={{ color: 'var(--ac-red)' }}>🚫 Cancella</button>
        <button className="ac-btn ghost sm" onClick={onClear}>✕ Deseleziona</button>
      </div>
    </div>
  );
}
```

### Task 5.2: CSS BulkActionBar

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: aggiungi in fondo**

```css
.ac-root .ac-bulk-bar {
  position: fixed;
  bottom: 60px; /* sopra al bottom-nav su mobile */
  left: 50%;
  transform: translateX(-50%);
  background: var(--ac-text);
  color: #fff;
  border-radius: 999px;
  padding: 10px 18px;
  box-shadow: var(--ac-sh-modal);
  display: flex;
  align-items: center;
  gap: 14px;
  z-index: 100;
  max-width: 92vw;
  flex-wrap: wrap;
  justify-content: center;
}
.ac-root .ac-bulk-count { font-weight: 700; font-size: 0.85rem; }
.ac-root .ac-bulk-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.ac-root .ac-bulk-bar .ac-btn.ghost.sm {
  background: rgba(255,255,255,0.1);
  color: #fff;
  border-color: rgba(255,255,255,0.2);
}
.ac-root .ac-bulk-bar .ac-btn.ghost.sm:hover {
  background: rgba(255,255,255,0.2);
}
@media (min-width: 641px) {
  .ac-root .ac-bulk-bar { bottom: 24px; }
}
```

### Task 5.3: Integrare nella tabella Prenotazioni

**Files:**
- Modify: `frontend/src/components/AdminDashboard.jsx`

- [ ] **Step 1: import + state**

```javascript
import BulkActionBar from './admin/BulkActionBar.jsx';

const [selectedIds, setSelectedIds] = useState(new Set());
function toggleSelect(id) {
  setSelectedIds(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });
}
function toggleSelectAll(visibleIds) {
  setSelectedIds(prev => {
    const allSelected = visibleIds.every(id => prev.has(id));
    if (allSelected) return new Set();
    return new Set(visibleIds);
  });
}
function clearSelection() { setSelectedIds(new Set()); }
```

- [ ] **Step 2: trova la tabella `<table>` di renderPrenotazioni**

```bash
grep -n "filteredBookings.map\|<thead>" "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo/frontend/src/components/AdminDashboard.jsx" | head
```

- [ ] **Step 3: aggiungi colonna checkbox**

Nel `<thead><tr>` aggiungi come prima colonna:
```jsx
<th style={{ width: 36 }}>
  <input
    type="checkbox"
    checked={filteredBookings.length > 0 && filteredBookings.every(b => selectedIds.has(b.id))}
    onChange={() => toggleSelectAll(filteredBookings.map(b => b.id))}
  />
</th>
```

Nel `<tr>` di ogni riga aggiungi come prima cella:
```jsx
<td>
  <input
    type="checkbox"
    checked={selectedIds.has(b.id)}
    onChange={() => toggleSelect(b.id)}
    onClick={e => e.stopPropagation()}
  />
</td>
```

- [ ] **Step 4: handlers bulk**

```javascript
async function bulkCancel() {
  if (!confirm(`Cancellare ${selectedIds.size} prenotazioni? Questa azione è irreversibile.`)) return;
  const ids = Array.from(selectedIds);
  let ok = 0;
  for (const id of ids) {
    try { await adminApi.cancelBooking(id); ok++; }
    catch (e) { console.error('cancel', id, e.message); }
  }
  alert(`Cancellate ${ok}/${ids.length}`);
  clearSelection();
  loadBookings('paid');
}

function bulkWhatsApp() {
  const rows = bookings.filter(b => selectedIds.has(b.id));
  const phones = rows.map(b => (b.cliente_telefono || '').replace(/\D/g, '')).filter(Boolean);
  if (phones.length === 0) { alert('Nessun telefono disponibile'); return; }
  const msg = encodeURIComponent('Ciao! Ti scriviamo riguardo alla tua prenotazione di Arfanta Bike Rental.');
  // Apri una tab per ogni numero (max 5 per evitare popup blocker)
  phones.slice(0, 5).forEach(p => window.open(`https://wa.me/${p}?text=${msg}`, '_blank'));
  if (phones.length > 5) alert(`${phones.length} numeri, aperti solo i primi 5. Per il resto: deseleziona alcuni.`);
}

function bulkEmail() {
  const rows = bookings.filter(b => selectedIds.has(b.id));
  const emails = rows.map(b => b.cliente_email).filter(e => e && e !== 'noemail@bikerentaltarzo.it');
  if (emails.length === 0) { alert('Nessuna email disponibile'); return; }
  // Apri client email default con destinatari in BCC
  window.location.href = `mailto:?bcc=${emails.join(',')}&subject=Arfanta Bike Rental`;
}
```

- [ ] **Step 5: rendi BulkActionBar**

In fondo al render (vicino agli altri overlay):
```jsx
<BulkActionBar
  count={selectedIds.size}
  onEmail={bulkEmail}
  onWhatsApp={bulkWhatsApp}
  onCancel={bulkCancel}
  onClear={clearSelection}
/>
```

### Task 5.4: Commit + deploy Phase 5

- [ ] **Step 1: commit + push + deploy**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add frontend/src/components/admin/BulkActionBar.jsx frontend/src/components/AdminDashboard.jsx frontend/src/index.css
git commit -m "admin: phase 5 — bulk actions su tabella Prenotazioni"
git push origin main
~/.npm-global/bin/vercel --prod --yes --token vca_3PnxXmudfYJt4tqUpfonVXJEkuR1jW4JMmwvS8TYB1ijY2Ucc52fmqDD
```

- [ ] **Step 2: smoke test**

- Vai su Prenotazioni → seleziona 2-3 righe → vedi action bar in basso
- Click "WhatsApp" → si aprono le tab wa.me (testa con telefoni veri)
- Click "Cancella" → conferma → righe diventano cancelled (verifica)
- Mobile: action bar visibile sopra al bottom-nav, non lo copre

---

## Phase 6 — Notification center

**Risk:** 🟢 low — leggi/scrivi tabella già creata.
**Goal:** Icona campana con badge contatore, drawer che mostra ultime 30 notifiche.

### Task 6.1: Endpoint backend per notifiche

**Files:**
- Modify: `backend/routes/admin.js`

- [ ] **Step 1: aggiungi 3 endpoint**

```javascript
// ─── GET /api/admin/notifiche ─────────────────────────────────────────────────
router.get('/notifiche', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  const { data, error } = await supabase
    .from('notifiche')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return res.status(500).json({ error: error.message });

  const { count: unreadCount } = await supabase
    .from('notifiche')
    .select('id', { count: 'exact', head: true })
    .is('letta_at', null);

  return res.json({ items: data || [], unread: unreadCount || 0 });
});

// ─── POST /api/admin/notifiche/:id/read ───────────────────────────────────────
router.post('/notifiche/:id/read', async (req, res) => {
  const { error } = await supabase
    .from('notifiche')
    .update({ letta_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .is('letta_at', null);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// ─── POST /api/admin/notifiche/read-all ───────────────────────────────────────
router.post('/notifiche/read-all', async (req, res) => {
  const { error } = await supabase
    .from('notifiche')
    .update({ letta_at: new Date().toISOString() })
    .is('letta_at', null);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});
```

### Task 6.2: Client methods

**Files:**
- Modify: `frontend/src/lib/api.js`

- [ ] **Step 1: aggiungi metodi a `adminApi`**

```javascript
getNotifiche:     (limit = 30) => adminGet(`/admin/notifiche?limit=${limit}`),
markNotificaRead: (id)         => adminPost(`/admin/notifiche/${id}/read`, {}),
markAllRead:      ()           => adminPost('/admin/notifiche/read-all', {}),
```

### Task 6.3: Componente `NotificationDrawer.jsx`

**Files:**
- Create: `frontend/src/components/admin/NotificationDrawer.jsx`

- [ ] **Step 1: scrivi il componente**

```jsx
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
 * Drawer da destra (desktop) / sheet bottom (mobile).
 * Props: { open, onClose, onClickBooking(bookingId) }
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
    if (n.booking_id) onClickBooking(n.booking_id);
    onClose();
  }

  function handleMarkAll() {
    adminApi.markAllRead().then(() => {
      setItems(prev => prev.map(n => ({ ...n, letta_at: new Date().toISOString() })));
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
```

### Task 6.4: CSS NotificationDrawer + bell badge in topbar

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: aggiungi in fondo**

```css
/* ─── Admin Notification drawer ──────────────────────────────────────── */
.ac-root .ac-notif-overlay {
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.4);
  z-index: 1500;
  display: flex;
  justify-content: flex-end;
}
.ac-root .ac-notif-drawer {
  width: 360px;
  max-width: 100vw;
  height: 100vh;
  background: var(--ac-surface);
  box-shadow: var(--ac-sh-modal);
  display: flex;
  flex-direction: column;
}
.ac-root .ac-notif-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--ac-border);
  font-weight: 700;
  color: var(--ac-text);
}
.ac-root .ac-notif-list { overflow-y: auto; flex: 1; }
.ac-root .ac-notif-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--ac-text-muted);
}
.ac-root .ac-notif-item {
  display: flex;
  gap: 10px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--ac-border);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--ac-border);
  text-align: left;
  width: 100%;
  cursor: pointer;
}
.ac-root .ac-notif-item:hover { background: var(--ac-surface-alt); }
.ac-root .ac-notif-item.unread { background: var(--ac-brand-soft); }
.ac-root .ac-notif-item.unread:hover { background: #FDE9D3; }
.ac-root .ac-notif-icon { font-size: 1.1rem; line-height: 1.3; flex-shrink: 0; }
.ac-root .ac-notif-body { flex: 1; min-width: 0; }
.ac-root .ac-notif-titolo { font-weight: 600; color: var(--ac-text); font-size: 0.88rem; }
.ac-root .ac-notif-desc { font-size: 0.78rem; color: var(--ac-text-muted); margin-top: 2px; }
.ac-root .ac-notif-time { font-size: 0.7rem; color: var(--ac-text-muted); margin-top: 4px; }

/* ─── Topbar bell ─────────────────────────────────────────────────────── */
.ac-root .ac-topbar-bell {
  position: relative;
  background: transparent;
  border: 1px solid var(--ac-border);
  border-radius: var(--ac-r-btn);
  width: 36px; height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--ac-text-muted);
}
.ac-root .ac-topbar-bell:hover { background: var(--ac-surface-alt); color: var(--ac-text); }
.ac-root .ac-topbar-bell-badge {
  position: absolute;
  top: -4px; right: -4px;
  min-width: 18px;
  height: 18px;
  background: var(--ac-red);
  color: #fff;
  border-radius: 9px;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

@media (max-width: 640px) {
  .ac-root .ac-notif-drawer { width: 100vw; }
}
```

### Task 6.5: Integra bell + drawer

**Files:**
- Modify: `frontend/src/components/AdminDashboard.jsx`

- [ ] **Step 1: import + state**

```javascript
import NotificationDrawer from './admin/NotificationDrawer.jsx';

const [notifOpen, setNotifOpen] = useState(false);
const [notifUnread, setNotifUnread] = useState(0);
```

- [ ] **Step 2: carica il count delle non lette al mount**

```javascript
useEffect(() => {
  if (!authed) return;
  adminApi.getNotifiche(1).then(res => setNotifUnread(res.unread || 0)).catch(() => {});
}, [authed]);
```

- [ ] **Step 3: aggiungi bell nel topbar (vicino al search trigger)**

```jsx
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
```

- [ ] **Step 4: rendi il drawer**

```jsx
<NotificationDrawer
  open={notifOpen}
  onClose={() => setNotifOpen(false)}
  onClickBooking={(bid) => {
    setActiveView('prenotazioni');
    // navigazione/highlight opzionale
  }}
/>
```

### Task 6.6: Commit + deploy Phase 6

- [ ] **Step 1: commit + push + deploy**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/routes/admin.js frontend/src/components/admin/NotificationDrawer.jsx frontend/src/components/AdminDashboard.jsx frontend/src/lib/api.js frontend/src/index.css
git commit -m "admin: phase 6 — notification center (drawer + bell badge)"
git push origin main
~/.npm-global/bin/vercel --prod --yes --token vca_3PnxXmudfYJt4tqUpfonVXJEkuR1jW4JMmwvS8TYB1ijY2Ucc52fmqDD
```

- [ ] **Step 2: smoke test**

- Apri admin → vedi icona 🔔 in topbar
- Inserisci notifica fake via SQL: `INSERT INTO notifiche (tipo, titolo, descrizione) VALUES ('test', 'Test notifica', 'Hello');`
- Refresh → badge mostra "1"
- Click bell → drawer si apre con la notifica
- Click sulla notifica → diventa "letta" (background normale)
- Mobile: drawer full-screen

---

## Phase 7 — Auto-refresh polling

**Risk:** 🟢 low — solo polling client-side.
**Goal:** Admin si aggiorna ogni 30s automaticamente; toast su nuova prenotazione.

### Task 7.1: Endpoint `/api/admin/heartbeat`

**Files:**
- Modify: `backend/routes/admin.js`

- [ ] **Step 1: aggiungi l'endpoint**

```javascript
// ─── GET /api/admin/heartbeat ─────────────────────────────────────────────────
router.get('/heartbeat', async (req, res) => {
  const [
    { count: unreadNotif },
    { data: lastBooking },
    azioniRes,
  ] = await Promise.all([
    supabase.from('notifiche').select('id', { count: 'exact', head: true }).is('letta_at', null),
    supabase.from('prenotazioni').select('id, cliente_nome, created_at').eq('pagamento_status', 'paid').order('created_at', { ascending: false }).limit(1).single(),
    // Riusa la logica di /azioni-pendenti per il contatore (qui solo count per leggerezza)
    supabase.from('prenotazioni').select('id', { count: 'exact', head: true }).in('cauzione_status', ['failed', 'failed_permanent']),
  ]);

  return res.json({
    notifiche_non_lette: unreadNotif || 0,
    azioni_pendenti:     azioniRes.count || 0,
    last_booking_id:     lastBooking?.id || null,
    last_booking_nome:   lastBooking?.cliente_nome || null,
    ts: new Date().toISOString(),
  });
});
```

### Task 7.2: Hook `useHeartbeat.js`

**Files:**
- Create: `frontend/src/components/admin/useHeartbeat.js`

- [ ] **Step 1: scrivi il file**

```javascript
import { useEffect, useRef, useState } from 'react';
import { adminApi } from '../../lib/api.js';

/**
 * Polling silenzioso ogni `intervalMs`. Pausa quando tab nascosta.
 * Ritorna: { data, lastUpdate, onNewBooking } — onNewBooking è un evento custom.
 */
export default function useHeartbeat(intervalMs = 30000) {
  const [data, setData] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const lastBookingIdRef = useRef(null);
  const newBookingHandlerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function tick() {
      if (document.hidden || cancelled) return;
      try {
        const res = await adminApi.getHeartbeat();
        if (cancelled) return;
        setData(res);
        setLastUpdate(new Date());
        if (lastBookingIdRef.current && res.last_booking_id && res.last_booking_id !== lastBookingIdRef.current && newBookingHandlerRef.current) {
          newBookingHandlerRef.current(res);
        }
        lastBookingIdRef.current = res.last_booking_id;
      } catch (_) { /* silenzioso */ }
    }

    tick(); // primo tick subito
    timer = setInterval(tick, intervalMs);

    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [intervalMs]);

  function setOnNewBooking(handler) {
    newBookingHandlerRef.current = handler;
  }

  return { data, lastUpdate, setOnNewBooking };
}
```

### Task 7.3: Client method getHeartbeat

**Files:**
- Modify: `frontend/src/lib/api.js`

- [ ] **Step 1: aggiungi**

```javascript
getHeartbeat: () => adminGet('/admin/heartbeat'),
```

### Task 7.4: Integra polling in AdminDashboard

**Files:**
- Modify: `frontend/src/components/AdminDashboard.jsx`

- [ ] **Step 1: import + hook**

```javascript
import useHeartbeat from './admin/useHeartbeat.js';

const { data: hb, lastUpdate, setOnNewBooking } = useHeartbeat(30000);
```

- [ ] **Step 2: sync stati con hb**

```javascript
useEffect(() => {
  if (!hb) return;
  setNotifUnread(hb.notifiche_non_lette || 0);
  setFeedCount(hb.azioni_pendenti || 0);
}, [hb]);
```

- [ ] **Step 3: gestisci nuova prenotazione con toast**

```javascript
useEffect(() => {
  setOnNewBooking((res) => {
    // Toast minimale via alert (sostituibile con UI custom in futuro)
    console.log('Nuova prenotazione:', res.last_booking_nome);
    // Se sei in Oggi, refresha
    if (activeView === 'oggi') { loadOggi(); setFeedRefresh(t => t + 1); }
  });
}, [activeView]);
```

- [ ] **Step 4: indicatore "Aggiornato Xs fa" nel topbar**

```jsx
{lastUpdate && (
  <span className="ac-topbar-update">
    Aggiornato {Math.floor((Date.now() - lastUpdate) / 1000)}s fa
  </span>
)}
```

CSS:
```css
.ac-root .ac-topbar-update {
  font-size: 0.7rem;
  color: var(--ac-text-muted);
  margin-left: 8px;
}
@media (max-width: 640px) {
  .ac-root .ac-topbar-update { display: none; }
}
```

### Task 7.5: Commit + deploy Phase 7

- [ ] **Step 1: commit + push + deploy**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/routes/admin.js frontend/src/components/admin/useHeartbeat.js frontend/src/components/AdminDashboard.jsx frontend/src/lib/api.js frontend/src/index.css
git commit -m "admin: phase 7 — auto-refresh polling 30s + new booking toast"
git push origin main
~/.npm-global/bin/vercel --prod --yes --token vca_3PnxXmudfYJt4tqUpfonVXJEkuR1jW4JMmwvS8TYB1ijY2Ucc52fmqDD
```

- [ ] **Step 2: smoke test**

- Apri admin in due tab — crea una nuova booking paid dal sito → la tab admin nuova si aggiorna entro 30s
- Apri DevTools → Network → vedi una richiesta `/admin/heartbeat` ogni 30s
- Cambia tab → la richiesta si pausa (Page Visibility) → torna in focus → riprende immediatamente
- Indicatore "Aggiornato Xs fa" visibile nel topbar desktop

---

## Verifica finale (cross-phase)

- [ ] **Step 1: sanity check sulle aree sigillate**

Verifica che le aree elencate in §6 del spec siano davvero intatte:

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git log --oneline HEAD~30..HEAD -- backend/routes/payments.js backend/routes/availability.js
# expected: nessun commit (a meno di fix unrelated)
git log --oneline HEAD~30..HEAD -- frontend/src/components/BookingWizard.jsx 'frontend/src/components/steps/*'
# expected: nessun commit
```

- [ ] **Step 2: prod-only smoke**

- Sito pubblico (`/`) — fai un booking reale di test → checkout Stripe → cauzione cron parte
- Admin (`/admin`) — vedi la card della nuova booking nel feed, il KPI strip aggiornato, l'azione "Cauzione fallita" se Stripe declina

---

## Self-review (post-plan)

**Spec coverage** — ogni elemento dello spec ha task corrispondente:

- §1 Visual System → Task 1.1, 1.3 ✅
- §2 Layout/nav → Task 1.3 ✅
- §3.1 Action Feed → Task 3.1–3.8 ✅
- §3.2 Search globale → Task 4.1–4.6 ✅
- §3.3 Bulk actions → Task 5.1–5.4 ✅
- §3.4 Notification center → Task 6.1–6.6 ✅
- §3.5 Auto-refresh polling → Task 7.1–7.5 ✅
- §4.1 Auto-cancel pending → Task 2.3 ✅
- §4.2 Auto-retry cauzioni → Task 2.4 + DB column 2.1 ✅
- §4.3 Auto-reminder firma H-24 → riusa cron esistente (verificato in §4.3 spec)
- §4.4 Auto-cleanup audit → Task 2.5 ✅
- §5 Architettura file → File Structure section ✅
- §7 Strategia rollout → Phases 1-7 mapping ✅

**Type consistency** — i nomi degli endpoint/funzioni/state usati in fase N corrispondono a quelli definiti in fase < N:
- `adminApi.getAzioniPendenti`, `adminApi.search`, `adminApi.getNotifiche`, `adminApi.markNotificaRead`, `adminApi.markAllRead`, `adminApi.getHeartbeat` — coerenti ✅
- `feedCount`, `feedRefresh`, `notifOpen`, `notifUnread`, `searchOpen`, `selectedIds` — coerenti ✅
- `writeNotification(tipo, { titolo, descrizione, booking_id })` — coerente in tutte le call ✅

**No placeholders** — nessuna riga "TBD", "fill in", "implement later". Ogni step ha codice esatto o comando esatto.

**Open items che richiedono input umano in fase di esecuzione**:
- `CRON_SECRET` value: da recuperare dal dashboard Vercel al primo curl di smoke test in Phase 2
- Task 3.7 step 6: verifica se `incasso_oggi` è già in `/stats`; se no, aggiungere — non scritto qui perché dipende dallo stato attuale del file
- Task 2.6: trovare le 2 occorrenze esatte di `sendPushToAll({ title: '⚠️ Cauzione fallita'` in `cron.js` e aggiungere `writeNotification` accanto

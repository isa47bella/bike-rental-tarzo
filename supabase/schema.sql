-- ============================================================
-- BIKE RENTAL TARZO — Schema Supabase (PostgreSQL)
-- Esegui questo in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Tabella Biciclette
CREATE TABLE IF NOT EXISTS biciclette (
  id   INT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  tipo VARCHAR(50)  NOT NULL DEFAULT 'Papin Sport'
);

INSERT INTO biciclette (id, nome, tipo) VALUES
  (1, 'Bicicletta 1', 'Papin Sport'),
  (2, 'Bicicletta 2', 'Papin Sport'),
  (3, 'Bicicletta 3', 'Papin Sport'),
  (4, 'Bicicletta 4', 'Papin Sport'),
  (5, 'Bicicletta 5', 'Papin Sport')
ON CONFLICT (id) DO NOTHING;

-- Tabella Prenotazioni
CREATE TABLE IF NOT EXISTS prenotazioni (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nome       VARCHAR(100) NOT NULL,
  cliente_email      VARCHAR(100) NOT NULL,
  cliente_telefono   VARCHAR(20)  NOT NULL,
  cliente_note       TEXT,
  bicicletta_id      INT          NOT NULL REFERENCES biciclette(id),
  tipo_noleggio      VARCHAR(50)  NOT NULL,  -- '4_ore' | 'intera_giornata' | '3_piu_giorni'
  giorni             INT          NOT NULL DEFAULT 1,
  data_ritiro        DATE         NOT NULL,
  orario_ritiro      TIME         NOT NULL,
  data_restituzione  DATE         NOT NULL,
  orario_restituzione TIME        NOT NULL,
  -- Timestamp full per query di overlap (timezone Europe/Rome)
  start_ts           TIMESTAMPTZ  NOT NULL,
  end_ts             TIMESTAMPTZ  NOT NULL,
  prezzo_totale      DECIMAL(10,2) NOT NULL,
  pagamento_status   VARCHAR(50)  NOT NULL DEFAULT 'pending',  -- pending | paid | cancelled
  stripe_session_id  VARCHAR(200),
  stripe_payment_id  VARCHAR(200),
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_prenotazioni_dates      ON prenotazioni (data_ritiro, data_restituzione);
CREATE INDEX IF NOT EXISTS idx_prenotazioni_bici       ON prenotazioni (bicicletta_id);
CREATE INDEX IF NOT EXISTS idx_prenotazioni_status     ON prenotazioni (pagamento_status);
CREATE INDEX IF NOT EXISTS idx_prenotazioni_ts_range   ON prenotazioni (start_ts, end_ts);
CREATE INDEX IF NOT EXISTS idx_prenotazioni_stripe     ON prenotazioni (stripe_session_id);

-- Row Level Security (RLS) — disabilitato per semplicità in dev
-- In produzione abilita e configura le policy
ALTER TABLE prenotazioni DISABLE ROW LEVEL SECURITY;
ALTER TABLE biciclette   DISABLE ROW LEVEL SECURITY;

-- ─── Sistema Cauzione / Salvataggio Carta ─────────────────────────────────────
-- Eseguire anche nel SQL Editor di Supabase (progetto live)
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS stripe_customer_id        VARCHAR(200);
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS stripe_payment_method_id  VARCHAR(200);
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS danno_status              VARCHAR(50)   DEFAULT NULL;
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS danno_amount              DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS cauzione_pi_id            VARCHAR(200);
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS cauzione_status           VARCHAR(50)   DEFAULT 'pending';
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS cauzione_captured_amount  DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS accessori                 TEXT          DEFAULT '';
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS checkin_at                TIMESTAMPTZ   DEFAULT NULL;
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS checkout_at               TIMESTAMPTZ   DEFAULT NULL;
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS checkin_note              TEXT;
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS checkout_note             TEXT;
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS documento_foto            TEXT;
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS bici_foto_consegna        TEXT;
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS bici_foto_rientro         TEXT;

-- ─── Colonne flotta biciclette ────────────────────────────────────────────────
ALTER TABLE biciclette ADD COLUMN IF NOT EXISTS stato                  VARCHAR(30)  DEFAULT 'disponibile';
ALTER TABLE biciclette ADD COLUMN IF NOT EXISTS batteria_pct           INT          DEFAULT 100;
ALTER TABLE biciclette ADD COLUMN IF NOT EXISTS note_admin             TEXT;
ALTER TABLE biciclette ADD COLUMN IF NOT EXISTS ultima_manutenzione    DATE;
ALTER TABLE biciclette ADD COLUMN IF NOT EXISTS prossima_manutenzione  DATE;

-- ─── Audit log azioni admin ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL    PRIMARY KEY,
  azione     TEXT         NOT NULL,
  booking_id UUID,
  dettagli   JSONB        DEFAULT '{}',
  ip         TEXT,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_booking_id ON audit_log(booking_id);

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

-- ─── Idempotenza webhook Stripe ───────────────────────────────────────────────
-- Registra ogni event.id processato. Stripe può ritentare lo stesso evento:
-- la PK impedisce di rieseguirlo (email/push/update duplicati).
CREATE TABLE IF NOT EXISTS stripe_events (
  id         TEXT         PRIMARY KEY,
  type       TEXT,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);
ALTER TABLE stripe_events DISABLE ROW LEVEL SECURITY;

-- ─── Token segreto firma contratto ────────────────────────────────────────────
-- Senza questo token la pagina /firma/:id e le sue API rifiutano lettura e firma.
-- Le prenotazioni create dal codice ricevono un token random; le righe
-- pre-migrazione restano NULL → modalità legacy (nessun token richiesto).
-- NB: NON fare il backfill delle righe esistenti, altrimenti i link firma
-- già inviati via email (senza token) smetterebbero di funzionare.
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS firma_token TEXT;

-- ─── Salute cron: heartbeat dei cron job ──────────────────────────────────────
-- Ogni cron, completata con successo l'esecuzione, aggiorna la propria riga
-- (last_run_at). Il cron guardiano /api/cron/cron-health controlla che nessun
-- battito sia troppo vecchio. Il seed mette NOW() così al deploy nessun cron
-- risulta già "in ritardo": il conteggio parte da zero.
CREATE TABLE IF NOT EXISTS cron_health (
  job          TEXT         PRIMARY KEY,
  last_run_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
INSERT INTO cron_health (job) VALUES
  ('deposit'), ('firma-reminder'), ('reminder'), ('auto-cancel-pending'),
  ('retry-cauzioni'), ('daily-summary'), ('cleanup-documenti'),
  ('cleanup-audit'), ('gdpr-cleanup')
ON CONFLICT (job) DO NOTHING;
ALTER TABLE cron_health DISABLE ROW LEVEL SECURITY;

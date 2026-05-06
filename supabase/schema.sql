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
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS stripe_customer_id       VARCHAR(200);
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS stripe_payment_method_id VARCHAR(200);
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS danno_status             VARCHAR(50)   DEFAULT NULL;
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS danno_amount             DECIMAL(10,2) DEFAULT NULL;

# Bike Rental Tarzo — Admin Panel Roadmap

## 🔴 Alta Priorità (implementato ✓)

1. **Calendario visivo** — Vista mensile con occupazione bici per giorno (verde/giallo/rosso/chiuso), navigazione mese, click per dettaglio.
2. **Blocco date / Chiusure** — Tabella `chiusure` su Supabase, CRUD completo da admin, integrazione in prenotazioni online (blocca date chiuse).
3. **Automazione promemoria firma** — Cron giornaliero `GET /api/cron/firma-reminder`: invia link contratto ai clienti con ritiro domani e firma mancante.
4. **Ricerca prenotazioni** — Filtro full-text client-side per nome, email, telefono, codice prenotazione.

## 🟡 Media Priorità

5. **Export CSV** — Esporta lista prenotazioni filtrate (browser-side, no librerie aggiuntive)
6. **Dashboard cauzioni dedicata** — Vista separata per tutte le cauzioni attive/da liberare
7. **Configurazione prezzi da admin** — UI per modificare prezzi senza toccare il codice
8. **Statistiche occupazione** — Grafico % utilizzo flotta per settimana/mese

## 🟢 Bassa Priorità

9.  **Storico cliente** — Ricerca tutte le prenotazioni per email → timeline cliente
10. **Note interne admin** — Campo `note_admin` su prenotazione (non visibile al cliente)
11. **Stampa contratto firmato** — PDF del contratto con firma dal pannello admin
12. **Notifiche push PWA** — Service worker + push notifications per nuove prenotazioni

---

## SQL migration richiesta (Supabase)

```sql
-- Feature 2: Blocco date / Chiusure
CREATE TABLE IF NOT EXISTS chiusure (
  id        SERIAL PRIMARY KEY,
  data      DATE   NOT NULL UNIQUE,
  motivo    TEXT   DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

# Arfanta Bike Rental — Roadmap

Stato aggiornato al 2026-05-21.

## ✅ Completato

### Admin panel (roadmap originale)
- Calendario visivo con occupazione bici per giorno
- Blocco date / chiusure (tabella `chiusure`, CRUD da admin)
- Ricerca prenotazioni full-text (nome, email, telefono, codice)
- Dashboard cauzioni dedicata (`/admin/cauzioni`)
- Configurazione prezzi da admin (`/admin/config`)
- Statistiche occupazione (`/admin/occupazione`) e report incassi (`/admin/report`)
- Storico cliente (`/admin/cliente`)
- Note interne admin (`note_admin`)
- Contratto firmato stampabile (`/admin/bookings/:id/contratto`)
- Prenotazione manuale walk-in, check-in / check-out, gestione flotta

### Lavori 2026-05-20 / 2026-05-21
- **Notifiche WhatsApp** al proprietario ad ogni prenotazione (CallMeBot)
- **Notifiche push** estese: 9 trigger (nuova prenotazione, cauzione fallita, promemoria
  inviati, restituzione, cancellazione, rimborso, cauzione rilasciata, riepilogo giornata)
- **Cron riepilogo giornaliero** (`daily-summary`, push serale se ci sono stati eventi)
- **4 nuove email automatiche** al cliente (cancellazione, rimborso, cauzione rilasciata,
  ringraziamento post check-out)
- **Code review completa**: risolti 6 bug critici (auth timing-safe, idempotency Stripe,
  cauzione PI su crash, webhook idempotente, token segreto firma, overbooking) + hardening
  (timezone cron, validazioni input, rate limiting, cron delete a batch)
- **Redesign email** premium, multilingua completo (it/en/de/es/fr), shell condiviso
- **Pop-up selezione lingua** liquid glass all'apertura del sito
- **Badge lingua del cliente** sulle prenotazioni nell'admin
- **Icona PWA** col logo Arfanta
- **Foto su Supabase Storage** — documenti d'identità e foto bici spostati da base64 nel
  database a un bucket privato `prenotazioni-foto`; visualizzazione admin via signed URL
  temporanei; retention automatica (documenti 30 giorni, foto bici 5 anni col `gdpr-cleanup`).
  Cartelle del bucket nominate `nome-cliente-codice` per ritrovarle facilmente
- **Email manuali multilingua** — i template rapidi dell'email manuale (menu 3 puntini →
  "Invia email") sono tradotti in 5 lingue; un selettore "Lingua email" sceglie la lingua,
  preimpostato su quella con cui il cliente ha prenotato

## 💡 Possibili sviluppi futuri

Idee emerse durante i lavori, da valutare quando se ne avrà voglia. Nessuna è urgente.

### Notifiche
- **Migrazione WhatsApp a Meta Business Cloud API** — più affidabile di CallMeBot.
  Spec già pronta: `docs/superpowers/specs/2026-05-19-whatsapp-notifications-design.md` (Fase 2).
- **Push aggiuntive** valutate ma non implementate: bici in ritardo per il rientro,
  batteria bici sotto soglia, manutenzione imminente, sold-out per una data.
- Reminder email anche la mattina stessa del ritiro (oggi parte solo la sera prima).

### Sicurezza (dalla code review)
- Ruotare `ADMIN_TOKEN`: l'attuale `26arfanta` è corto e indovinabile → sostituirlo con
  una stringa lunga casuale.
- Valutare l'abilitazione di RLS su Supabase (oggi disabilitato; non sfruttabile perché
  il frontend non usa la chiave anon, ma è buona difesa in profondità).
- `npm audit fix` su `backend/` e `frontend/` (vulnerabilità moderate solo in dev/build).

### Altro
- Export CSV delle prenotazioni filtrate dall'admin (mai implementato dalla roadmap originale).
- Rilevamento automatico della lingua dal browser per pre-evidenziarla nel pop-up.

---

*La roadmap originale (admin panel) è stata completata. Questo file ora traccia lo stato
generale del progetto e le idee future.*

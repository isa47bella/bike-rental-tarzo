# Redesign email transazionali — Design

**Data:** 2026-05-20
**Autore:** Giulio Ballarin (brainstorming con Claude, skill impeccable)
**Stato:** Design — in attesa di approvazione

## Obiettivo

Ridisegnare tutte le email transazionali di Arfanta Bike Rental con un'estetica premium e coerente col brand, e portare **tutte** le email al supporto multilingua a 5 lingue (it/en/de/es/fr).

## Problemi del design attuale

1. **Incoerenza di brand** — le email usano il verde `#2D8659`, il sito e l'admin usano l'arancione `#EA580C`. Sembrano due aziende diverse.
2. **Emoji come icone** — 🚲📋📅🕗💶🎒✍️📍✅ ovunque: segno tipico di email dilettantesca.
3. **Side-stripe border** — il box "Dove veniamo" usa `border-left: 4px solid #FF6B6B`, un anti-pattern.
4. **Font Arial** — generico di sistema, il brand usa Barlow.
5. **Palette scoordinata** — verde + corallo + rosso + giallo pastello, senza gerarchia.
6. **Template frammentati** — `buildClienteHtml`, `sendAdminEmail` e `buildGestoreHtml` hanno header/footer diversi: impossibile mantenere coerenza.
7. **Multilingua incompleto** — `sendConfirmationToCliente` (conferma prenotazione) e `sendReminderEmail` (promemoria ritiro) hanno i testi italiani hardcoded e ignorano il campo `lingua`. Un cliente che prenota in spagnolo riceve queste due email in italiano.

## Requisiti (raccolti in brainstorming)

| Requisito | Decisione |
|---|---|
| Direzione estetica | Sartoriale caldo — charme di campagna (boutique-hotel) |
| Header | Foto delle Colline del Prosecco + logotipo Arfanta |
| Foto | Stock Unsplash verificata del territorio UNESCO |
| Scope | Tutte le 8 email transazionali |
| Multilingua | Tutte le email in 5 lingue: it/en/de/es/fr |

## Architettura

### Shell condiviso

Si introduce `buildEmailShell({ heroAlt, bodyHtml, lang })` — funzione unica che genera header (foto + logo + tagline), cornice e footer identici per tutte le email. Ogni email fornisce solo il `bodyHtml` centrale.

Vantaggi: coerenza garantita, codice DRY, un solo punto per cambiare lo stile globale.

### Funzioni email dopo il redesign

| Funzione | Ruolo | Genera contenuto via |
|---|---|---|
| `buildEmailShell()` | Layout condiviso (header/footer) | — |
| `buildConfermaBody(p, lang)` | Contenuto conferma prenotazione | shell |
| `buildGestoreBody(p)` | Contenuto notifica gestore (solo IT) | shell |
| `buildMessaggioBody(p, lang, {titolo, testo, cta})` | Contenuto generico per le email "messaggio" | shell |

Le 6 email che oggi usano `sendAdminEmail` (firma, promemoria, cancellazione, rimborso, cauzione, checkout) passano per `buildMessaggioBody`. `sendAdminEmail` resta come trasporto (invio SMTP) ma il suo HTML wrapper viene sostituito dallo shell.

Tutto resta nel file `backend/lib/email.js`, riorganizzato internamente.

## Sistema di design

### Palette (scelta in OKLCH per armonia, output HEX per compatibilità email)

| Ruolo | HEX |
|---|---|
| Sfondo pagina | `#F6F1E8` (avorio caldo) |
| Superficie email | `#FFFDFA` (bianco caldo) |
| Superficie alternativa | `#FAF5EC` / `#FDF6EF` (blocchi info, codice) |
| Testo primario | `#2B2520` (bruno scurissimo, mai nero puro) |
| Testo secondario | `#7C7268` (talpa) |
| Etichette maiuscoletto | `#9A8F80` / `#A88B6E` |
| Accento brand | `#EA580C` (arancione) |
| Bordi/linee | `#EFE8DA` / `#EBE3D4` (linee calde 1px) |

Eliminati: verde, corallo `#FF6B6B`, rosso, giallo pastello. Palette calda e ridotta. L'arancione è l'unico colore acceso, usato solo su CTA, codice prenotazione e totale.

### Tipografia

- **Titoli**: Barlow Semi Condensed (peso 700) — carattere e personalità
- **Corpo**: Barlow (400/500/600)
- Caricati via Google Fonts `<link>` nell'`<head>`
- **Fallback obbligatorio**: `'Barlow','Helvetica Neue',Arial,sans-serif` — i client che non caricano i web font (Gmail desktop) mostrano il fallback; layout e colori restano identici
- Gerarchia: titolo email ~34px, sezioni ~20px, corpo 14-15px, etichette 10-11px maiuscoletto lettera-spaziato

### Layout

- **Header**: foto Colline del Prosecco a banda piena (600px largh., 240px alt., `object-fit:cover`); sotto, su fondo bianco caldo, logotipo "Arfanta Bike Rental" + tagline "Noleggio e-bike · Colline del Prosecco UNESCO". Nessun testo sovrapposto alla foto (Outlook non lo gestisce).
- **Corpo**: titolo Barlow Semi Condensed; saluto + frase; contenuto specifico per email.
- **Riepilogo** (conferma): coppie etichetta-valore — etichetta maiuscoletto talpa a sinistra, valore Barlow a destra, separate da linee 1px. Codice prenotazione come elemento forte (30px, lettera-spaziato, arancione, in cornice calda).
- **CTA**: bottone arancione pieno `#EA580C`, testo bianco, padding generoso. Niente box bordati.
- **Info pratiche**: blocchi su `#FAF5EC` con bordo pieno 1px, separati da divisori verticali 1px. Zero side-stripe border.
- **Footer**: logotipo, indirizzo, menzione UNESCO, contatto WhatsApp — tipografia piccola su fondo avorio.

### Vincoli tecnici email (rispettati nel design)

- Layout `<table>` (obbligatorio per compatibilità, non flexbox/grid)
- Stili inline (no `<style>` esterni se non per i web font)
- Colori in HEX (no OKLCH nell'output: non supportato dai client email)
- No `clamp()`, no proprietà CSS moderne: larghezze fisse
- Immagini con `width`/`height` espliciti
- Web font con fallback robusto

## Le 8 email

Tutte usano `buildEmailShell`. Contenuto specifico:

1. **Conferma prenotazione** — la più ricca: titolo, saluto, codice prenotazione, riepilogo completo (tipo, ritiro, restituzione, bici, accessori, totale), CTA firma contratto, blocco "dove venire / cosa portare".
2. **Notifica gestore** — interna, solo italiano: dati cliente + prenotazione, asciutta.
3. **Link firma contratto** — titolo, messaggio, CTA "Firma il contratto".
4. **Promemoria ritiro** — titolo, messaggio (noleggio domani), info ritiro, cosa portare.
5. **Cancellazione prenotazione** — titolo, messaggio, eventuale nota su rilascio cauzione.
6. **Rimborso** — titolo, messaggio con importo e tempistiche.
7. **Cauzione rilasciata** — titolo, messaggio di conferma.
8. **Ringraziamento post-checkout** — titolo, messaggio di ringraziamento.

## Multilingua

- Tutte le email rivolte al **cliente** (1, 3-8) sono in 5 lingue: it/en/de/es/fr. La lingua è `prenotazione.lingua`, con fallback `it`.
- L'email **gestore** (2) resta solo in italiano (destinatario interno).
- Le 5 email già multilingua oggi (firma, checkout, cancellazione, rimborso, cauzione) **riusano i testi esistenti**, già validati — vengono solo rivestite col nuovo design.
- Le 2 email da tradurre ex-novo: **conferma prenotazione** e **promemoria ritiro**. Le traduzioni nelle 5 lingue saranno esplicitate nel piano di implementazione per essere revisionate una per una.
- **Fix necessario**: il cron `/reminder` in `backend/routes/cron.js` deve aggiungere `lingua` alla `.select()` della query, altrimenti `sendReminderEmail` non riceve la lingua.

## Foto header

Sorgente Unsplash verificata (status 200, image/jpeg) — foto aerea reale delle Colline del Prosecco di Conegliano e Valdobbiadene (patrimonio UNESCO):
`https://images.unsplash.com/photo-1624715636409-6c1b6bc4fe9a?auto=format&fit=crop&w=1200&q=80`

**Decisione:** la foto viene scaricata e committata in `frontend/public/email-hero.jpg`, e referenziata nelle email come `https://bike-rental-tarzo-app.vercel.app/email-hero.jpg`. Questo evita l'hotlinking da Unsplash (la foto potrebbe essere rimossa) e serve l'immagine dal dominio del brand.

## Testing

- Mockup HTML statico già prodotto e approvato: `docs/email-mockup.html` (email di conferma).
- Verifica post-implementazione: inviare ogni tipo di email a una casella di test, controllare resa su almeno Gmail (web), Apple Mail (iOS) e un client desktop.
- Verifica multilingua: una prenotazione di test con `lingua` diversa da `it` deve produrre email nella lingua giusta.

## Non in scope

- Email marketing / newsletter (solo transazionali).
- Cambio del provider email (resta Nodemailer + Gmail SMTP).
- Modifica della logica di invio o dei trigger (restano invariati).
- Dark mode delle email.

## Decisioni di design (impeccable)

- **Register**: brand — l'email è un punto di contatto, il design comunica identità.
- **Color strategy**: Restrained-warm — neutrali caldi + un accento arancione sotto il 10% della superficie.
- **AI slop test**: evitato il "category reflex" (verde + natura per un noleggio bici). Niente emoji-icone, niente side-stripe border, niente gradient text, niente card grid identiche.
- **Identity preservation**: Barlow è già il font del brand, mantenuto.

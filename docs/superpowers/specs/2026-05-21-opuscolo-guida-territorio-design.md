# Opuscolo "Guida del territorio" — Design

**Data:** 2026-05-21
**Autore:** Giulio Ballarin (brainstorming con Claude)
**Stato:** Design — in attesa di approvazione

## Obiettivo

Un opuscolo cartaceo che il negozio consegna a mano al cliente al ritiro della bici, con
percorsi ciclabili, cantine e ristoranti della zona di Arfanta di Tarzo (Colline del
Prosecco). Una versione per ciascuna delle 5 lingue del sito.

## Contesto

Il progetto è un sito di noleggio e-bike ad Arfanta di Tarzo (TV). Questo opuscolo è un
**deliverable a sé**: non è una funzionalità dell'app, non è servito dal sito, non viene
generato dinamicamente. È un documento statico, stampato, dato a mano.

## Requisiti (raccolti in brainstorming)

| Aspetto | Decisione |
|---|---|
| Distribuzione | Cartaceo, consegnato a mano al negozio (no sito, no email, no app) |
| Versioni | 5 opuscoli separati, uno per lingua (it/en/de/es/fr) |
| Formato | Libretto A5 di poche pagine |
| Ampiezza contenuti | Essenziale e curata: 3 percorsi (tutti e-MTB), ~4-5 cantine, ~5-6 ristoranti |
| Bici adatta | I 3 percorsi sono per e-bike MTB; nota dedicata per chi noleggia una e-bike city |
| Navigazione percorsi | Mappa stampata per ogni percorso (QR code = piano B se la mappa risulta scomoda) |
| Fonte percorsi | File GPX forniti dall'utente |
| Fonte cantine/ristoranti | Ricerca web → bozza documentata → **verifica obbligatoria** del proprietario |

## Vincoli di accuratezza (la regola che governa tutto)

I contenuti dati ai clienti devono essere reali e corretti. Quindi:

- **Niente contenuti inventati a memoria.** Le cantine e i ristoranti provengono da
  ricerca web reale; ogni voce viene **verificata** da chi conosce la zona prima di
  entrare nell'opuscolo. La verifica del proprietario è il gate di qualità, non è opzionale.
- **I percorsi provengono dai file GPX** (tracce GPS reali), non da descrizioni a memoria.
- **Le mappe non vengono "disegnate" a memoria**: vedi sezione Mappe.

## Architettura / produzione

L'opuscolo si produce in **HTML + CSS ottimizzato per la stampa** (formato A5) — lo stesso
approccio già usato nel progetto per riepiloghi e contratti. Si apre nel browser e si
stampa / salva in PDF.

- **5 file HTML**, uno per lingua, con un **CSS condiviso**. Ogni file è un opuscolo
  completo e autonomo nella sua lingua.
- Vivono in una cartella dedicata del repo: `docs/opuscolo/` (HTML, CSS, immagini mappe).
- Nessuna modifica all'app (`backend/`, `frontend/`): è materiale a parte.

## Struttura di ogni opuscolo

1. **Copertina** — brand Arfanta Bike Rental, titolo "Guida del territorio", foto delle
   Colline del Prosecco.
2. **Intro** — dove siamo (Via Pecol 22, Arfanta di Tarzo), benvenuto, consigli pratici
   (casco, acqua, autonomia della e-bike, numero del negozio).
3. **Percorsi** — i 3 itinerari (tutti per e-MTB). Una nota in apertura della sezione
   avvisa chi ha noleggiato una e-bike city. Per ogni percorso: nome, distanza, dislivello
   positivo, durata stimata, difficoltà, breve descrizione, e una mappa.
4. **Cantine** — ~4-5 cantine: nome, posizione (e vicino a quale percorso), cosa offrono
   (degustazioni), contatti, nota su orari/prenotazione.
5. **Ristoranti** — ~5-6 ristoranti: nome, tipo di cucina, **fascia di prezzo** (€/€€/€€€),
   posizione, contatti.
6. **Retro** — contatti Arfanta Bike Rental + mappa d'insieme della zona con i punti.

## I percorsi

L'opuscolo presenta **3 percorsi**, selezionati tra 7 tracce GPX fornite dall'utente
(cartella `Desktop/percorsi/`). Tutti e tre sono classificati **MTB** su Wikiloc → adatti
alle e-bike mountain bike. **I dislivelli si prendono dai dati ufficiali Wikiloc** (note
RTF), non dai calcoli grezzi sul GPS: la quota nei tracciati GPS è rumorosa e gonfia i totali.

| Percorso | Distanza | Dislivello + | Difficoltà | File GPX |
|---|---|---|---|---|
| Follina – Laghi di Revine | 27,7 km | +263 m | Facile | `follina-laghi-di-revine-anello.gpx` |
| Refrontolo – Val Trippera | 33,5 km | +753 m | Medio | `refrontolo-val-trippera.gpx` |
| Pian de le Femene – Bivacco Col dei Gai | 30,4 km | +1.133 m | Impegnativo | `pian-de-le-femene-bivacco-col-dei-gai.gpx` |

I 3 anelli partono a ~6,4 / ~3,5 / ~2,9 km dal noleggio (Follina / Refrontolo / Pian de le
Femene): l'opuscolo indica come raggiungere il punto di partenza. Scartate le altre 4
tracce fornite: rivelatesi a piedi, di sola andata, doppioni o troppo dure.

**e-bike city:** i 3 percorsi sono per e-MTB. Chi noleggia una e-bike city trova in
apertura della sezione Percorsi una nota che invita a **chiedere consiglio in negozio**
per un giro tranquillo adatto — la zona è collinare e non offre un anello asfaltato facile
da fissare come percorso. Un percorso e-city dedicato potrà essere aggiunto in futuro se
si individua un GPX adatto.

## Le mappe

Una mappa accurata di un percorso reale non può essere disegnata "a memoria". Per ogni
percorso l'immagine della mappa proviene da una fonte cartografica vera: il GPX viene
importato in uno strumento di mappe (es. **Komoot**) e se ne esporta l'immagine della
mappa. Quelle immagini vengono impaginate nell'opuscolo. Dal GPX si può inoltre generare
il **profilo altimetrico** e la sagoma del percorso.

Se le mappe stampate dovessero risultare scomode da seguire in bici, il piano B concordato
è il **QR code** per percorso (link alla traccia su Komoot/Google Maps).

## Lingue

I **fatti** (dati dei percorsi, nomi e info di cantine/ristoranti) si raccolgono e
verificano **una volta sola**. Le 5 versioni dell'opuscolo sono poi la stessa informazione
tradotta in it/en/de/es/fr. Le traduzioni le cura Claude; numeri, nomi propri, indirizzi e
contatti restano invariati in ogni lingua.

## Fasi del lavoro

1. Raccolta percorsi: 3 GPX MTB selezionati, analizzati e confermati.
2. Ricerca web di cantine e ristoranti → bozza documentata con le fonti.
3. **Verifica del proprietario** su ogni voce (percorsi, cantine, ristoranti).
4. Mappe: export delle immagini dai GPX (via Komoot o simile).
5. Impaginazione dell'opuscolo in HTML/CSS A5.
6. Traduzione nelle 5 lingue.

## Non in scope

- Integrazione col sito o con l'app; download online; invio via email.
- Generazione dinamica per cliente.
- Prenotazione di cantine o ristoranti.
- Mappe disegnate a mano / cartografia originale.

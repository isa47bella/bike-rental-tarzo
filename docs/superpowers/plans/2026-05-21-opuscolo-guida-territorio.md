# Opuscolo "Guida del territorio" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produrre un opuscolo cartaceo (5 lingue) con 3 percorsi e-MTB, cantine e ristoranti della zona di Arfanta di Tarzo, da consegnare a mano ai clienti del noleggio.

**Architecture:** Progetto a 2 fasi. **Fase 1 — Contenuti:** ricerca web di cantine/ristoranti e schede percorsi → un'unica bozza documentata (`docs/opuscolo/bozza-contenuti.md`). **Gate umano:** il proprietario verifica ogni voce. **Fase 2 — Opuscolo:** si costruisce l'opuscolo in HTML+CSS A5 (italiano), si inseriscono le mappe, si traduce nelle 5 lingue.

**Tech Stack:** HTML + CSS (ottimizzato per la stampa A5). Nessun codice dell'app: materiale a parte in `docs/opuscolo/`.

**Spec di riferimento:** [`docs/superpowers/specs/2026-05-21-opuscolo-guida-territorio-design.md`](../specs/2026-05-21-opuscolo-guida-territorio-design.md)

## Natura del progetto — leggere prima di iniziare

Questo **non è un progetto di codice** come gli altri: è la produzione di un documento.
Conseguenze sull'esecuzione:

- **Niente test automatici, niente TDD.** La verifica è: aprire l'HTML nel browser e
  controllare l'anteprima di stampa A5.
- **Le Task 1-3 sono ricerca**, non scrittura di codice: il loro output è un documento di
  bozza, non del software. Vanno eseguite con ricerca web reale.
- **Tra Fase 1 e Fase 2 c'è un gate umano obbligatorio**: il proprietario verifica la
  bozza. L'esecuzione automatica si ferma lì e riprende quando la bozza è verificata.
- **La Task 5 (mappe) è un compito umano**: le mappe le esporta il proprietario da Komoot.

## File Structure

| File | Responsabilità |
|---|---|
| `docs/opuscolo/bozza-contenuti.md` | Bozza di tutti i contenuti (percorsi, cantine, ristoranti) con le fonti, da far verificare al proprietario |
| `docs/opuscolo/opuscolo.css` | CSS condiviso, layout di stampa A5 |
| `docs/opuscolo/opuscolo-it.html` | Opuscolo in italiano (versione di riferimento) |
| `docs/opuscolo/opuscolo-en.html` … `-de/-es/-fr.html` | Le altre 4 lingue |
| `docs/opuscolo/img/` | Immagini: foto copertina, 3 mappe dei percorsi |

---

# FASE 1 — Contenuti

## Task 1: Ricerca cantine → bozza

**Files:**
- Create: `docs/opuscolo/bozza-contenuti.md` (sezione "Cantine")

- [ ] **Step 1: Ricerca web**

Cercare sul web **4-5 cantine** visitabili nella zona di Arfanta di Tarzo / Tarzo /
Revine Lago / Follina / Refrontolo (le zone dei 3 percorsi e dell'area UNESCO Colline
del Prosecco). Usare ricerca web reale (non conoscenza pregressa). Per ogni cantina
raccogliere, **con la fonte (URL)**: nome, comune/località, cosa offre (degustazioni,
visite), sito web, telefono, nota su orari o necessità di prenotazione.

- [ ] **Step 2: Scrivere la sezione "Cantine" nella bozza**

Creare `docs/opuscolo/bozza-contenuti.md` con questa intestazione e la sezione cantine:

```markdown
# Bozza contenuti opuscolo — DA VERIFICARE DAL PROPRIETARIO

> Ogni voce qui sotto è una proposta da ricerca web. Il proprietario deve
> verificare/correggere ogni riga prima che entri nell'opuscolo. Spuntare `[x]`
> quando la voce è verificata.

## Cantine

### [ ] 1. <nome cantina>
- Località: <comune>
- Offre: <degustazioni / visite / ...>
- Contatti: <sito> · <telefono>
- Orari / prenotazione: <nota>
- Fonte: <URL>

### [ ] 2. <nome cantina>
...
```

Compilare con le 4-5 cantine trovate (ripetere il blocco per ognuna).

- [ ] **Step 3: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add docs/opuscolo/bozza-contenuti.md
git commit -m "docs(opuscolo): bozza cantine da ricerca web"
```

---

## Task 2: Ricerca ristoranti → bozza

**Files:**
- Modify: `docs/opuscolo/bozza-contenuti.md` (aggiunta sezione "Ristoranti")

- [ ] **Step 1: Ricerca web**

Cercare sul web **5-6 ristoranti** ben recensiti nella zona (Tarzo, Revine Lago, Cison
di Valmarino, Follina, Refrontolo), coprendo **varie fasce di prezzo**. Usare ricerca web
reale. Per ogni ristorante raccogliere, con la fonte (URL): nome, comune/località, tipo
di cucina, **fascia di prezzo** (€ economico / €€ medio / €€€ alto), sito web o telefono.
Puntare ad avere almeno un'opzione per ciascuna delle 3 fasce.

- [ ] **Step 2: Aggiungere la sezione "Ristoranti" alla bozza**

In fondo a `docs/opuscolo/bozza-contenuti.md` aggiungere:

```markdown
## Ristoranti

### [ ] 1. <nome ristorante>
- Località: <comune>
- Cucina: <tipo>
- Fascia di prezzo: <€ / €€ / €€€>
- Contatti: <sito> · <telefono>
- Fonte: <URL>

### [ ] 2. <nome ristorante>
...
```

Compilare con i 5-6 ristoranti trovati.

- [ ] **Step 3: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add docs/opuscolo/bozza-contenuti.md
git commit -m "docs(opuscolo): bozza ristoranti da ricerca web"
```

---

## Task 3: Schede dei 3 percorsi → bozza

**Files:**
- Modify: `docs/opuscolo/bozza-contenuti.md` (aggiunta sezione "Percorsi")

**Contesto:** i dati numerici dei 3 percorsi sono già confermati (analisi GPX + dati
Wikiloc). Restano da scrivere le **descrizioni** (cosa si vede / cosa si incontra) e
l'indicazione di come raggiungere la partenza da Arfanta — anch'esse da far verificare.

- [ ] **Step 1: Aggiungere la sezione "Percorsi" alla bozza**

In fondo a `docs/opuscolo/bozza-contenuti.md` aggiungere le 3 schede con i dati confermati
e una bozza di descrizione (max 3-4 frasi ciascuna, da ricerca web sulla zona attraversata):

```markdown
## Percorsi (bici: e-MTB)

### [ ] 1. Follina – Laghi di Revine — Facile
- Dati: 27,7 km · +263 m · anello
- Partenza: ~6,4 km dal noleggio (zona Follina)
- Descrizione: <3-4 frasi: cosa si vede — abbazia di Follina, laghi di Revine, ...>

### [ ] 2. Refrontolo – Val Trippera — Medio
- Dati: 33,5 km · +753 m · anello
- Partenza: ~3,5 km dal noleggio (zona Refrontolo)
- Descrizione: <3-4 frasi — Molinetto della Croda, Val Trippera, ...>

### [ ] 3. Pian de le Femene – Bivacco Col dei Gai — Impegnativo
- Dati: 30,4 km · +1.133 m · anello (quota max 1.250 m)
- Partenza: ~2,9 km dal noleggio (zona Tarzo)
- Descrizione: <3-4 frasi — salita panoramica, vista su laghi e pianura, ...>
- Nota: avvisare dell'autonomia batteria per via del forte dislivello
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add docs/opuscolo/bozza-contenuti.md
git commit -m "docs(opuscolo): bozza schede percorsi"
```

---

## ⛔ GATE — Verifica del proprietario

**Passo umano obbligatorio, non automatizzabile.** Il file `docs/opuscolo/bozza-contenuti.md`
va consegnato al proprietario, che verifica e corregge **ogni voce** (cantine, ristoranti,
descrizioni dei percorsi) e spunta le caselle `[x]`. La Fase 2 usa **solo** contenuti
verificati. L'esecuzione automatica si ferma qui finché la bozza non è verificata.

---

# FASE 2 — Opuscolo (dopo la verifica)

## Task 4: Opuscolo in italiano (HTML + CSS A5)

**Files:**
- Create: `docs/opuscolo/opuscolo.css`
- Create: `docs/opuscolo/opuscolo-it.html`

- [ ] **Step 1: Creare il CSS di stampa A5**

Creare `docs/opuscolo/opuscolo.css` con: `@page { size: A5; margin: 12mm }`, stili per
copertina, intestazioni di sezione, schede percorso, elenchi cantine/ristoranti, footer.
Estetica coerente col brand Arfanta (arancione `#EA580C`, font Barlow / di sistema).
Regola `@media print` per nascondere elementi non stampabili.

- [ ] **Step 2: Creare l'opuscolo italiano**

Creare `docs/opuscolo/opuscolo-it.html` con la struttura della spec, riempito con i
contenuti **verificati** della bozza:
1. Copertina (titolo "Guida del territorio", foto Colline del Prosecco da `img/`).
2. Intro: indirizzo Via Pecol 22 Arfanta di Tarzo, benvenuto, consigli pratici.
3. Percorsi: nota iniziale per chi ha una e-bike city; poi le 3 schede (nome, dati,
   difficoltà, descrizione, come raggiungere la partenza, immagine mappa da `img/`).
4. Cantine: le 4-5 cantine verificate.
5. Ristoranti: i 5-6 ristoranti verificati, con fascia di prezzo.
6. Retro: contatti Arfanta Bike Rental.

- [ ] **Step 3: Verificare nel browser**

Aprire `docs/opuscolo/opuscolo-it.html` nel browser, controllare l'anteprima di stampa
(formato A5). Expected: layout pulito, nessuna sezione tagliata male.

- [ ] **Step 4: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add docs/opuscolo/opuscolo.css docs/opuscolo/opuscolo-it.html
git commit -m "feat(opuscolo): opuscolo guida del territorio in italiano"
```

---

## Task 5: Mappe dei percorsi (passo del proprietario)

**Passo umano.** Per ognuno dei 3 percorsi: importare il file GPX (cartella
`Desktop/percorsi/`) in Komoot, esportare l'immagine della mappa e salvarla in
`docs/opuscolo/img/` con nome coerente (`mappa-follina.jpg`, `mappa-refrontolo.jpg`,
`mappa-pian-femene.jpg`). Serve anche una foto per la copertina (`img/copertina.jpg`).
L'HTML di Task 4 referenzia questi nomi file.

- [ ] **Step 1:** Confermare che le 4 immagini sono in `docs/opuscolo/img/` e committarle.

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add docs/opuscolo/img/
git commit -m "docs(opuscolo): immagini mappe e copertina"
```

---

## Task 6: Traduzione nelle altre 4 lingue

**Files:**
- Create: `docs/opuscolo/opuscolo-en.html`, `-de.html`, `-es.html`, `-fr.html`

- [ ] **Step 1: Creare le 4 versioni tradotte**

Partendo da `opuscolo-it.html`, creare i 4 file tradotti in inglese, tedesco, spagnolo e
francese. Tradurre i testi; lasciare invariati nomi propri, indirizzi, numeri, contatti e
i nomi dei file immagine. Tutti i file usano lo stesso `opuscolo.css` e le stesse immagini.

- [ ] **Step 2: Verificare nel browser**

Aprire i 4 file e controllare l'anteprima di stampa A5. Expected: layout identico
all'italiano, testi tradotti.

- [ ] **Step 3: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add docs/opuscolo/opuscolo-en.html docs/opuscolo/opuscolo-de.html docs/opuscolo/opuscolo-es.html docs/opuscolo/opuscolo-fr.html
git commit -m "feat(opuscolo): opuscolo nelle 5 lingue (en/de/es/fr)"
```

---

## Task 7: Verifica finale

- [ ] **Step 1:** Aprire tutti e 5 i file HTML nel browser, anteprima di stampa A5.
  Verificare: copertina, le 3 sezioni, le mappe visibili, le fasce di prezzo dei
  ristoranti, la nota e-city, i contatti. Confermare che ogni lingua sia coerente.

---

## Self-Review

- **Spec coverage:**
  - Opuscolo A5, 5 lingue, file separati → Task 4 + Task 6
  - Struttura copertina/intro/percorsi/cantine/ristoranti/retro → Task 4
  - 3 percorsi e-MTB con dati confermati + nota e-city → Task 3 + Task 4
  - Cantine (~4-5) e ristoranti (~5-6, fasce di prezzo) da ricerca web → Task 1 + Task 2
  - Verifica obbligatoria del proprietario → GATE tra Fase 1 e Fase 2
  - Mappe da fonte cartografica vera (Komoot) → Task 5
  - Produzione in HTML+CSS print, cartella `docs/opuscolo/` → Task 4
- **Placeholder scan:** i `<...>` nelle bozze (Task 1-3) NON sono placeholder del piano:
  sono i campi che la ricerca web riempie — è il deliverable della task. Nessun TBD/TODO
  irrisolto.
- **Type consistency:** `docs/opuscolo/bozza-contenuti.md` creato in Task 1 e ampliato in
  Task 2-3; consumato (verificato) in Task 4. `opuscolo.css` creato in Task 4, usato da
  tutti i file HTML (Task 4 e 6). I nomi file immagine (`img/mappa-*.jpg`,
  `img/copertina.jpg`) coincidono tra Task 4 (referenze HTML) e Task 5 (creazione).

## Definition of Done

- Bozza contenuti verificata dal proprietario
- 5 file HTML dell'opuscolo (it/en/de/es/fr) + CSS + immagini in `docs/opuscolo/`
- Ogni file si stampa pulito in A5

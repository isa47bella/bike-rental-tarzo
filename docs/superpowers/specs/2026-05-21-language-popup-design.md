# Pop-up selezione lingua all'apertura — Design

**Data:** 2026-05-21
**Autore:** Giulio Ballarin (brainstorming con Claude, skill impeccable)
**Stato:** Implementato

> **Aggiornamento 2026-05-21 (post-implementazione):** su richiesta dell'utente il
> comportamento è cambiato — il pop-up appare **a ogni apertura della home**, non
> più solo al primo accesso. La scelta non viene memorizzata e il flag `langChosen`
> non è più usato. I riferimenti a "primo accesso" e `langChosen` qui sotto sono
> superati da questa nota.

## Obiettivo

Mostrare al primo accesso al sito un pop-up che invita il visitatore a scegliere la lingua, con un design liquid glass che lascia intravedere la home (il calendario) sottostante.

## Problema

Il selettore di lingua attuale (`LanguageSwitcher`) sono 5 piccoli bottoni testuali (IT/EN/DE/ES/FR) in alto a destra: poco visibili. Un turista straniero spesso non si accorge di poterli usare e naviga il sito in italiano. Un pop-up all'apertura garantisce che la scelta della lingua sia la prima interazione.

## Requisiti (raccolti in brainstorming)

| Requisito | Decisione |
|---|---|
| Quando appare | Solo al primo accesso; dopo la scelta non riappare mai più |
| Chiusura | Chiudibile (X, click fuori, tasto Esc); chi chiude resta in italiano |
| Presentazione lingue | Tile con bandiera (SVG disegnato, non emoji) + endonimo (Italiano, English, Deutsch, Español, Français) |
| Stile | Liquid glass marcato; background = home sfocata |

## Architettura

### Componente `LanguageGate`

Nuovo componente React `frontend/src/components/LanguageGate.jsx`. Montato in `App.jsx`, renderizzato sopra la home pubblica.

- Al mount legge `localStorage`: se il flag `langChosen` è assente **e** la route corrente è la home pubblica → mostra il pop-up.
- La home (calendario / `BookingWizard`) resta renderizzata sotto: è ciò che si intravede attraverso il vetro.
- Alla scelta di una lingua: `i18n.changeLanguage(code)` + `localStorage.setItem('lang', code)` + `localStorage.setItem('langChosen', '1')` → il pop-up sfuma via.
- Alla chiusura senza scelta (X / click fuori / Esc): `localStorage.setItem('langChosen', '1')` soltanto → resta la lingua corrente (italiano di default), il pop-up non riapparirà.

### Dove appare / dove NON appare

Appare solo sulla home pubblica. NON appare su `/admin`, `/firma/:id`, `/success`, `/cancel`. Il controllo è sulla route corrente al mount.

### File coinvolti

| File | Modifica |
|---|---|
| `frontend/src/components/LanguageGate.jsx` | Create — il componente pop-up (markup + bandiere SVG inline) |
| `frontend/src/index.css` | Modify — stili liquid glass del pop-up (in coda al file, dove vivono gli altri stili globali come `.lang-switcher`) |
| `frontend/src/App.jsx` | Modify — montare `<LanguageGate />` |

Il progetto usa CSS globale in `index.css` (non CSS modules): gli stili del pop-up seguono lo stesso pattern, con classi prefissate `lg-` per evitare collisioni.

Le 5 bandiere SVG sono inline nel componente (file unico, nessuna dipendenza esterna). Il `LanguageSwitcher` esistente resta invariato (continua a funzionare per chi cambia lingua in seguito).

## Design visivo (liquid glass)

Riferimento approvato: `docs/language-popup-mockup.html`.

- **Velo di sfondo**: overlay full-screen `rgba(43,37,32,0.34)` con `backdrop-filter: blur(7px) saturate(115%)` — sfoca e scurisce leggermente la home, crea profondità e mette a fuoco il pannello.
- **Pannello vetro**: larghezza 400px, `border-radius` 32px. `backdrop-filter: blur(60px) saturate(210%) brightness(1.08)`. Fondo a gradiente molto trasparente. Bordo chiaro luminoso (1px `rgba(255,255,255,0.72)`). Ombra esterna profonda + ombre `inset` che simulano la luce sul vetro. Due pseudo-elementi (`::before`, `::after`) per i riflessi di luce su labbro superiore e bordo inferiore.
- **Header**: piccolo globo SVG arancione, titolo "Scegli la tua lingua" (Barlow Semi Condensed), sottotitolo multilingua "Choose · Sprache · Idioma · Langue" (scuro, leggibile, con leggera ombra di rilievo).
- **Tile lingua**: 5 tile in colonna, ognuna con vetro proprio (`backdrop-filter` leggero), bandiera tonda 34px (SVG) + endonimo in Barlow 16px. Hover: la tile si solleva, bordo arancione brand `#EA580C`, glow.
- **X di chiusura**: tonda, discreta, in alto a destra.
- **Animazione**: ingresso con fade + scala (`cubic-bezier(.22,1,.36,1)`, ease-out, niente rimbalzo).
- **Tipografia**: Barlow / Barlow Semi Condensed, coerente col brand.

Nota di design (impeccable): il glassmorphism è qui un uso intenzionale e funzionale, non decorativo — il vetro comunica "il sito è sotto, scegli la lingua per entrare". È un overlay singolo, mostrato una sola volta per visitatore.

## Comportamento ed edge case

- **Mobile**: il pannello si restringe (`max-width:100%` con padding); le 5 tile restano in colonna leggibili.
- **Accessibilità**: chiusura con `Esc`; focus spostato nel pannello all'apertura; `aria-label` su X e tile; `role="dialog"` e `aria-modal`.
- **Fallback `backdrop-filter`**: i browser che non lo supportano (rari, vecchi) ricevono un fondo semi-opaco solido via `@supports not (backdrop-filter: blur(1px))` — il pop-up resta usabile, perde solo l'effetto vetro.
- **Nessun blocco del render**: il componente è puro client-side; la home si carica normalmente, il pop-up vi si sovrappone.
- **SSR/idratazione**: non applicabile (app SPA Vite, nessun SSR).

## Testing

- Mockup statico approvato: `docs/language-popup-mockup.html`.
- Verifica manuale post-implementazione: in una finestra incognito (localStorage pulito) aprire la home → il pop-up appare; scegliere una lingua → il sito cambia lingua e il pop-up sparisce; ricaricare → il pop-up non riappare. Ripetere chiudendo con la X → resta italiano, non riappare.
- Verifica che il pop-up NON appaia aprendo direttamente `/admin` o `/firma/...`.

## Non in scope

- Rilevamento automatico della lingua dal browser (`navigator.language`): si potrebbe pre-evidenziare la lingua probabile, ma per ora il pop-up mostra le 5 lingue alla pari. Eventuale estensione futura.
- Rimozione o restyling del `LanguageSwitcher` esistente: resta com'è.
- Traduzione di nuovi contenuti: il sito è già tradotto in 5 lingue.

## Decisioni di design (impeccable)

- **Register**: brand — è la prima impressione del sito, design come comunicazione.
- **Glassmorphism**: ammesso perché funzionale e non decorativo (overlay singolo, una volta per visitatore), come da eccezione "rare and purposeful".
- **Niente emoji**: le bandiere sono SVG disegnati, non emoji-bandiera.
- **Motion**: ease-out senza rimbalzo, coerente con le regole di motion.

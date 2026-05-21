# Pop-up selezione lingua liquid glass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrare al primo accesso alla home un pop-up liquid glass che invita il visitatore a scegliere la lingua tra le 5 disponibili.

**Architecture:** Un componente React `LanguageGate` montato dentro la route `/` (la home), quindi visibile solo lì. Al mount controlla un flag `langChosen` in `localStorage`: se assente mostra il pop-up. La scelta o la chiusura impostano il flag, così il pop-up appare una sola volta per visitatore.

**Tech Stack:** React 18, react-i18next, CSS (`backdrop-filter`), Vite.

**Spec di riferimento:** [`docs/superpowers/specs/2026-05-21-language-popup-design.md`](../specs/2026-05-21-language-popup-design.md)
**Mockup approvato:** [`docs/language-popup-mockup.html`](../../language-popup-mockup.html) — riferimento visivo per stili e bandiere SVG.

## File Structure

| File | Modifica |
|---|---|
| `frontend/src/components/LanguageGate.jsx` | Create — componente pop-up: logica, markup, 5 bandiere SVG inline |
| `frontend/src/index.css` | Modify — stili liquid glass (classi prefisso `lg-`), in coda al file |
| `frontend/src/App.jsx` | Modify — montare `<LanguageGate />` nella route `/` |

## Note sul testing

Il progetto non ha test automatici. La verifica è: build Vite senza errori (`npm run build`) + verifica manuale nel browser. Non scrivere test Jest/Vitest.

---

## Task 1: Componente `LanguageGate`

**Files:**
- Create: `frontend/src/components/LanguageGate.jsx`

- [ ] **Step 1: Creare il componente**

Crea `frontend/src/components/LanguageGate.jsx` con questo contenuto esatto:

```jsx
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// Bandiere come SVG inline (no emoji): viewBox quadrato, ritagliate in cerchio via CSS.
const FLAGS = {
  it: (
    <svg viewBox="0 0 3 3"><rect width="1" height="3" x="0" fill="#009246" /><rect width="1" height="3" x="1" fill="#fff" /><rect width="1" height="3" x="2" fill="#CE2B37" /></svg>
  ),
  en: (
    <svg viewBox="0 0 60 60">
      <rect width="60" height="60" fill="#012169" />
      <path d="M0,0 60,60 M60,0 0,60" stroke="#fff" strokeWidth="9" />
      <path d="M0,0 60,60 M60,0 0,60" stroke="#C8102E" strokeWidth="5" />
      <path d="M30,0 V60 M0,30 H60" stroke="#fff" strokeWidth="15" />
      <path d="M30,0 V60 M0,30 H60" stroke="#C8102E" strokeWidth="9" />
    </svg>
  ),
  de: (
    <svg viewBox="0 0 3 3"><rect width="3" height="1" y="0" fill="#000" /><rect width="3" height="1" y="1" fill="#DD0000" /><rect width="3" height="1" y="2" fill="#FFCE00" /></svg>
  ),
  es: (
    <svg viewBox="0 0 4 4"><rect width="4" height="1" y="0" fill="#AA151B" /><rect width="4" height="2" y="1" fill="#F1BF00" /><rect width="4" height="1" y="3" fill="#AA151B" /></svg>
  ),
  fr: (
    <svg viewBox="0 0 3 3"><rect width="1" height="3" x="0" fill="#0055A4" /><rect width="1" height="3" x="1" fill="#fff" /><rect width="1" height="3" x="2" fill="#EF4135" /></svg>
  ),
};

const LANGS = [
  { code: 'it', name: 'Italiano' },
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
];

export default function LanguageGate() {
  const { i18n } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Al mount: mostra il pop-up solo se la lingua non è ancora stata scelta.
  useEffect(() => {
    if (!localStorage.getItem('langChosen')) setVisible(true);
  }, []);

  // Chiusura: marca la scelta come fatta e sfuma via il pop-up.
  function dismiss() {
    localStorage.setItem('langChosen', '1');
    setLeaving(true);
    setTimeout(() => setVisible(false), 240);
  }

  function choose(code) {
    i18n.changeLanguage(code);
    localStorage.setItem('lang', code);
    dismiss();
  }

  // Tasto Esc per chiudere.
  useEffect(() => {
    if (!visible) return;
    function onKey(e) { if (e.key === 'Escape') dismiss(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={`lg-overlay${leaving ? ' lg-leaving' : ''}`}
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label="Seleziona la lingua / Select language"
    >
      <div className="lg-glass" onClick={(e) => e.stopPropagation()}>
        <button className="lg-x" onClick={dismiss} aria-label="Chiudi / Close">&#10005;</button>

        <div className="lg-head">
          <svg className="lg-globe" viewBox="0 0 44 44" fill="none">
            <circle cx="22" cy="22" r="20" stroke="#EA580C" strokeWidth="2.4" />
            <ellipse cx="22" cy="22" rx="9" ry="20" stroke="#EA580C" strokeWidth="2.4" />
            <path d="M3 16 H41 M3 28 H41" stroke="#EA580C" strokeWidth="2.4" />
          </svg>
          <div className="lg-title">Scegli la tua lingua</div>
          <div className="lg-sub">Choose &middot; Sprache &middot; Idioma &middot; Langue</div>
        </div>

        <div className="lg-langs">
          {LANGS.map((l) => (
            <button
              key={l.code}
              className="lg-lang"
              onClick={() => choose(l.code)}
              aria-label={l.name}
            >
              <span className="lg-flag">{FLAGS[l.code]}</span>
              <span className="lg-name">{l.name}</span>
              <span className="lg-go">&#8250;</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificare che il file sia sintatticamente valido**

Run: `cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo/frontend" && npx eslint src/components/LanguageGate.jsx 2>&1 | head -20`
Expected: nessun errore di parsing (eventuali warning di stile sono accettabili; un errore di sintassi NO).

Se `eslint` non è configurato e dà un errore di config, salta questo step e affidati al build del Task 3.

- [ ] **Step 3: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add frontend/src/components/LanguageGate.jsx
git commit -m "feat(i18n): componente LanguageGate per il pop-up selezione lingua"
```

---

## Task 2: Stili liquid glass

**Files:**
- Modify: `frontend/src/index.css` — aggiungere gli stili in coda al file

**Contesto:** Gli stili replicano il mockup approvato `docs/language-popup-mockup.html` (classi `.glass`, `.lang`, ecc.) ma con prefisso `lg-` per evitare collisioni con le classi globali esistenti.

- [ ] **Step 1: Aggiungere gli stili in coda a `index.css`**

Aggiungi alla fine di `frontend/src/index.css`:

```css
/* ─── Pop-up selezione lingua (liquid glass) ──────────────────────────────── */
.lg-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(43, 37, 32, 0.34);
  -webkit-backdrop-filter: blur(7px) saturate(115%);
  backdrop-filter: blur(7px) saturate(115%);
  animation: lg-fade-in 0.4s ease both;
}
.lg-overlay.lg-leaving { animation: lg-fade-out 0.24s ease both; }

@keyframes lg-fade-in  { from { opacity: 0; } to { opacity: 1; } }
@keyframes lg-fade-out { from { opacity: 1; } to { opacity: 0; } }

.lg-glass {
  position: relative;
  width: 400px;
  max-width: 100%;
  border-radius: 32px;
  padding: 32px 26px 26px;
  background: linear-gradient(155deg, rgba(255,255,255,0.40) 0%, rgba(255,255,255,0.10) 44%, rgba(255,255,255,0.22) 100%);
  -webkit-backdrop-filter: blur(60px) saturate(210%) brightness(1.08);
  backdrop-filter: blur(60px) saturate(210%) brightness(1.08);
  border: 1px solid rgba(255,255,255,0.72);
  box-shadow:
    0 36px 90px rgba(35,25,15,0.46),
    0 2px 10px rgba(35,25,15,0.18),
    inset 0 1.5px 1px rgba(255,255,255,0.95),
    inset 0 -22px 48px rgba(255,255,255,0.14),
    inset 0 0 60px rgba(255,255,255,0.12);
  animation: lg-pop-in 0.5s cubic-bezier(.22,1,.36,1) both;
}
.lg-leaving .lg-glass { animation: lg-pop-out 0.24s ease both; }

@keyframes lg-pop-in {
  from { opacity: 0; transform: scale(.93) translateY(10px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes lg-pop-out {
  from { opacity: 1; transform: scale(1); }
  to   { opacity: 0; transform: scale(.96); }
}

.lg-glass::before {
  content: '';
  position: absolute;
  left: 10%; right: 10%; top: 0;
  height: 46%;
  border-radius: 32px 32px 50% 50%;
  background: linear-gradient(180deg, rgba(255,255,255,0.50), rgba(255,255,255,0));
  pointer-events: none;
}
.lg-glass::after {
  content: '';
  position: absolute;
  left: 20%; right: 20%; bottom: -1px;
  height: 28%;
  border-radius: 50% 50% 32px 32px;
  background: linear-gradient(0deg, rgba(255,255,255,0.22), rgba(255,255,255,0));
  pointer-events: none;
}

.lg-x {
  position: absolute;
  top: 16px; right: 16px;
  width: 30px; height: 30px;
  border-radius: 50%;
  cursor: pointer;
  background: rgba(255,255,255,0.30);
  color: #5C5349;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255,255,255,0.5);
}

.lg-head { text-align: center; margin-bottom: 22px; }
.lg-globe { width: 42px; height: 42px; margin: 0 auto 12px; display: block; }
.lg-title {
  font-family: 'Barlow Semi Condensed', 'Barlow', sans-serif;
  font-weight: 700;
  font-size: 23px;
  color: #2B2520;
}
.lg-sub {
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.07em;
  color: #574F45;
  text-transform: uppercase;
  margin-top: 5px;
  text-shadow: 0 1px 2px rgba(255,255,255,0.6);
}

.lg-langs { display: flex; flex-direction: column; gap: 9px; }
.lg-lang {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 11px 15px;
  cursor: pointer;
  border-radius: 16px;
  background: linear-gradient(150deg, rgba(255,255,255,0.42), rgba(255,255,255,0.16));
  -webkit-backdrop-filter: blur(14px) saturate(150%);
  backdrop-filter: blur(14px) saturate(150%);
  border: 1px solid rgba(255,255,255,0.58);
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.7);
  transition: transform .18s cubic-bezier(.22,1,.36,1), background .18s ease, border-color .18s ease, box-shadow .18s ease;
}
.lg-lang:hover {
  transform: translateY(-1px);
  background: linear-gradient(150deg, rgba(255,255,255,0.66), rgba(255,255,255,0.34));
  border-color: #EA580C;
  box-shadow: 0 6px 20px rgba(234,88,12,0.22), inset 0 1px 1px rgba(255,255,255,0.85);
}
.lg-flag {
  width: 34px; height: 34px;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.7);
  box-shadow: 0 2px 6px rgba(0,0,0,0.14);
}
.lg-flag svg { width: 100%; height: 100%; display: block; }
.lg-name { font-size: 16px; font-weight: 600; color: #2B2520; flex: 1; text-align: left; }
.lg-go { color: #C9BEAE; font-size: 17px; font-weight: 700; }
.lg-lang:hover .lg-go { color: #EA580C; }

/* Fallback per browser senza backdrop-filter: fondo solido, resta usabile */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .lg-overlay { background: rgba(43,37,32,0.62); }
  .lg-glass   { background: #FBF7EF; }
  .lg-lang    { background: #FFFFFF; }
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add frontend/src/index.css
git commit -m "feat(i18n): stili liquid glass del pop-up lingua"
```

---

## Task 3: Montaggio in App.jsx + build + deploy

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Importare e montare `LanguageGate`**

In `frontend/src/App.jsx`, aggiungi l'import dopo gli altri import di componenti (dopo la riga `import CookieBanner ...`):

```jsx
import LanguageGate    from './components/LanguageGate.jsx';
```

Poi, nella route `/`, monta `<LanguageGate />` prima di `<BookingWizard />`. Sostituisci la riga:

```jsx
      <Route path="/"        element={<PublicLayout><BookingWizard /></PublicLayout>} />
```

con:

```jsx
      <Route path="/"        element={<PublicLayout><LanguageGate /><BookingWizard /></PublicLayout>} />
```

Così il pop-up è renderizzato solo sulla home `/`, non su `/admin`, `/firma/:id`, `/success`, `/cancel`, `/privacy`.

- [ ] **Step 2: Build di verifica**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo/frontend"
npm install
npm run build
```
Expected: build completata senza errori, output in `dist/`.

- [ ] **Step 3: Verifica visiva locale**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo/frontend"
npm run dev
```
Apri `http://localhost:5173` in una finestra **incognito** (localStorage pulito). Verifica:
- Il pop-up liquid glass appare sopra il calendario
- Il calendario si intravede sfocato dietro il vetro
- Cliccando una lingua: il sito cambia lingua, il pop-up sfuma via
- Ricaricando la pagina: il pop-up NON riappare
- In una nuova incognito, chiudendo con la X: resta italiano, e ricaricando non riappare
- Aprendo `http://localhost:5173/admin`: il pop-up NON appare

Ferma il dev server con `Ctrl+C`.

- [ ] **Step 4: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add frontend/src/App.jsx
git commit -m "feat(i18n): monta LanguageGate sulla home"
```

- [ ] **Step 5: Deploy**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
~/.npm-global/bin/vercel --prod --yes
```
Expected: deploy `READY`. Verifica con `curl -s -o /dev/null -w "%{http_code}" https://bike-rental-tarzo-app.vercel.app/` → `200`.

---

## Self-Review

- [x] **Spec coverage:** ogni requisito dello spec ha una task:
  - Componente `LanguageGate` + logica `localStorage` `langChosen`/`lang` → Task 1
  - Solo home pubblica → Task 3 (montato dentro la route `/`)
  - Chiudibile X / click fuori / Esc → Task 1 (`dismiss`, `onClick` overlay, listener Esc)
  - Design liquid glass come il mockup → Task 2
  - Fallback `backdrop-filter` → Task 2 (`@supports`)
  - Animazione ingresso/uscita ease-out → Task 1 (stato `leaving`) + Task 2 (keyframes)
  - Bandiere SVG, non emoji → Task 1 (`FLAGS`)
  - Accessibilità (`role="dialog"`, `aria-modal`, `aria-label`, Esc) → Task 1
- [x] **Placeholder scan:** nessun TBD/TODO. Il componente, il CSS e la modifica di App.jsx hanno codice completo.
- [x] **Type consistency:** le classi CSS (`lg-overlay`, `lg-glass`, `lg-x`, `lg-head`, `lg-globe`, `lg-title`, `lg-sub`, `lg-langs`, `lg-lang`, `lg-flag`, `lg-name`, `lg-go`, `lg-leaving`) usate nel JSX di Task 1 corrispondono esattamente a quelle definite nel CSS di Task 2. Il flag `localStorage` è sempre `langChosen`, la chiave lingua è sempre `lang`.

## Definition of Done

- Il pop-up appare al primo accesso alla home, con design liquid glass
- Scegliendo una lingua il sito cambia lingua e il pop-up non riappare
- Chiudendo (X / fuori / Esc) resta italiano e il pop-up non riappare
- Il pop-up non appare su admin/firma/success/cancel/privacy
- Build Vite senza errori, deploy completato

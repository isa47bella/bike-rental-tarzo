import { useState, useEffect } from 'react';
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

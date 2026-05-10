import { useTranslation } from 'react-i18next';

const LANGS = [
  { code: 'it', label: 'IT' },
  { code: 'en', label: 'EN' },
  { code: 'de', label: 'DE' },
  { code: 'es', label: 'ES' },
  { code: 'fr', label: 'FR' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  function changeLang(code) {
    i18n.changeLanguage(code);
    localStorage.setItem('lang', code);
  }

  return (
    <div className="lang-switcher">
      {LANGS.map(l => (
        <button
          key={l.code}
          className={`lang-btn${i18n.language === l.code ? ' active' : ''}`}
          onClick={() => changeLang(l.code)}
          aria-label={l.label}
          title={l.label}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

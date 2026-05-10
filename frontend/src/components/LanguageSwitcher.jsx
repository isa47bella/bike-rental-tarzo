import { useTranslation } from 'react-i18next';

const LANGS = [
  { code: 'it', flag: '🇮🇹' },
  { code: 'en', flag: '🇬🇧' },
  { code: 'de', flag: '🇩🇪' },
  { code: 'es', flag: '🇪🇸' },
  { code: 'fr', flag: '🇫🇷' },
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
          aria-label={l.code.toUpperCase()}
          title={l.code.toUpperCase()}
        >
          {l.flag}
        </button>
      ))}
    </div>
  );
}

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import it from './locales/it.json';
import en from './locales/en.json';
import de from './locales/de.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

const savedLang = localStorage.getItem('lang') || 'it';

i18n
  .use(initReactI18next)
  .init({
    resources: { it: { translation: it }, en: { translation: en }, de: { translation: de }, es: { translation: es }, fr: { translation: fr } },
    lng:             savedLang,
    fallbackLng:     'it',
    interpolation:   { escapeValue: false },
  });

export default i18n;

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api.js';
import ProgressBar     from './ProgressBar.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import StepDate        from './steps/StepDate.jsx';
import StepTime        from './steps/StepTime.jsx';
import StepRentalType  from './steps/StepRentalType.jsx';
import StepBike        from './steps/StepBike.jsx';
import StepContact     from './steps/StepContact.jsx';
import StepSummary     from './steps/StepSummary.jsx';

const TOTAL_STEPS = 6;

const INITIAL_BOOKING = {
  data_ritiro:         null,
  orario_ritiro:       null,
  tipo_noleggio:       null,
  giorni:              1,
  bicicletta_id:       null,
  modello_nome:        '',
  cliente_nome:        '',
  cliente_email:       '',
  cliente_telefono:    '',
  cliente_note:        '',
  data_restituzione:   null,
  orario_restituzione: null,
  prezzo_totale:       0,
};

export default function BookingWizard() {
  const { t } = useTranslation();
  const [step,    setStep]    = useState(1);
  const [booking, setBooking] = useState(INITIAL_BOOKING);

  useEffect(() => {
    if (booking.data_ritiro && booking.orario_ritiro && booking.tipo_noleggio) {
      api.calcolaRestituzione(
        booking.data_ritiro,
        booking.orario_ritiro,
        booking.tipo_noleggio,
        booking.giorni || 1
      ).then(res => {
        setBooking(b => ({
          ...b,
          data_restituzione:   res.data_restituzione,
          orario_restituzione: res.orario_restituzione,
        }));
      }).catch(() => {});
    }
  }, [booking.data_ritiro, booking.orario_ritiro, booking.tipo_noleggio, booking.giorni]);

  function updateBooking(partial) {
    setBooking(b => ({ ...b, ...partial }));
  }

  function next() {
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function back() {
    setStep(s => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const stepProps = { booking, onChange: updateBooking, onNext: next, onBack: back };

  return (
    <div className="page-wrapper">
      <header className="header">
        <div className="header-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/>
            <path d="M15 6a1 1 0 000-2h-3l-3 9 2 1"/><path d="M9 6l1 4h7l-2-4H9z"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <h1>Bike Rental Tarzo</h1>
          <p>{t('header.subtitle')}</p>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="main-content">
        <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />

        <div className="card">
          {step === 1 && <StepDate        {...stepProps} />}
          {step === 2 && <StepTime        {...stepProps} />}
          {step === 3 && <StepRentalType  {...stepProps} />}
          {step === 4 && <StepBike        {...stepProps} />}
          {step === 5 && <StepContact     {...stepProps} />}
          {step === 6 && <StepSummary     {...stepProps} />}
        </div>

        <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.82rem', marginTop: 8 }}>
          {t('wizard.problems')}
        </div>

        {/* Esperienze personalizzate */}
        <div className="custom-exp-card">
          <div className="custom-exp-header">
            <div className="custom-exp-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <h3 className="custom-exp-title">{t('customExp.title')}</h3>
          </div>
          <p className="custom-exp-subtitle">{t('customExp.subtitle')}</p>
          <div className="custom-exp-tags">
            {t('customExp.tags', { returnObjects: true }).map(tag => (
              <span key={tag} className="custom-exp-tag">{tag}</span>
            ))}
          </div>
          <a
            href={`https://wa.me/393928614635?text=${encodeURIComponent('Ciao! Vorrei informazioni su un\'esperienza personalizzata in bici.')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="custom-exp-btn"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {t('customExp.cta')}
          </a>
          <p className="custom-exp-note">{t('customExp.note')}</p>
        </div>
      </main>

      {step >= 3 && booking.prezzo_totale > 0 && (
        <div className="sticky-price">
          <div>
            <div className="price-label">{t('wizard.totalLabel')}</div>
            <div className="price-value">€{Number(booking.prezzo_totale).toFixed(2)}</div>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', textAlign: 'right' }}>
            {t('wizard.payAt')}
          </div>
        </div>
      )}
    </div>
  );
}

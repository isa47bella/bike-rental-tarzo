import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import ProgressBar     from './ProgressBar.jsx';
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
  cliente_nome:        '',
  cliente_email:       '',
  cliente_telefono:    '',
  cliente_note:        '',
  data_restituzione:   null,
  orario_restituzione: null,
  prezzo_totale:       0,
};

export default function BookingWizard() {
  const [step,    setStep]    = useState(1);
  const [booking, setBooking] = useState(INITIAL_BOOKING);

  // Quando tipo/orario/data cambiano, aggiorna data+orario restituzione
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
      {/* Header */}
      <header className="header">
        <div style={{ fontSize: '1.8rem' }}>🚲</div>
        <div>
          <h1>Bike Rental Tarzo</h1>
          <p>Colline del Prosecco UNESCO · Via Pecol 22, Arfanta di Tarzo (TV)</p>
        </div>
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

        {/* Nota contatto */}
        <div style={{
          textAlign: 'center',
          color: 'var(--text-light)',
          fontSize: '0.82rem',
          marginTop: 8,
        }}>
          Problemi? Scrivici su WhatsApp 📱
        </div>
      </main>

      {/* Sticky price banner (visibile dagli step 3 in poi) */}
      {step >= 3 && booking.prezzo_totale > 0 && (
        <div className="sticky-price">
          <div>
            <div className="price-label">Totale prenotazione</div>
            <div className="price-value">€{Number(booking.prezzo_totale).toFixed(2)}</div>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', textAlign: 'right' }}>
            Paga solo<br />al checkout
          </div>
        </div>
      )}
    </div>
  );
}

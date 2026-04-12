import { useState } from 'react';

function validate(fields) {
  const errors = {};
  if (!fields.cliente_nome?.trim())
    errors.cliente_nome = 'Il nome è obbligatorio';
  if (!fields.cliente_email?.trim())
    errors.cliente_email = 'L\'email è obbligatoria';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.cliente_email))
    errors.cliente_email = 'Email non valida';
  if (!fields.cliente_telefono?.trim())
    errors.cliente_telefono = 'Il telefono è obbligatorio';
  else if (!/^[+\d\s\-()]{7,20}$/.test(fields.cliente_telefono))
    errors.cliente_telefono = 'Telefono non valido';
  return errors;
}

export default function StepContact({ booking, onChange, onNext, onBack }) {
  const [touched, setTouched] = useState({});

  const errors  = validate(booking);
  const hasErrors = Object.keys(errors).length > 0;

  function handleBlur(field) {
    setTouched(t => ({ ...t, [field]: true }));
  }

  function handleChange(field, value) {
    onChange({ [field]: value });
  }

  function handleNext() {
    // Marca tutti come toccati per mostrare tutti gli errori
    setTouched({ cliente_nome: true, cliente_email: true, cliente_telefono: true });
    if (!hasErrors) onNext();
  }

  return (
    <div>
      <h2 className="step-title">I tuoi contatti</h2>
      <p className="step-subtitle">
        Riceverai la conferma via email. Nessuno spam, solo la prenotazione.
      </p>

      <div className="form-group">
        <label htmlFor="nome">Nome e Cognome *</label>
        <input
          id="nome"
          type="text"
          placeholder="Mario Rossi"
          value={booking.cliente_nome || ''}
          onChange={e => handleChange('cliente_nome', e.target.value)}
          onBlur={() => handleBlur('cliente_nome')}
          className={touched.cliente_nome && errors.cliente_nome ? 'error' : ''}
          autoComplete="name"
        />
        {touched.cliente_nome && errors.cliente_nome && (
          <div className="error-msg">{errors.cliente_nome}</div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="email">Email *</label>
        <input
          id="email"
          type="email"
          placeholder="mario@example.com"
          value={booking.cliente_email || ''}
          onChange={e => handleChange('cliente_email', e.target.value)}
          onBlur={() => handleBlur('cliente_email')}
          className={touched.cliente_email && errors.cliente_email ? 'error' : ''}
          autoComplete="email"
        />
        {touched.cliente_email && errors.cliente_email && (
          <div className="error-msg">{errors.cliente_email}</div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="tel">Telefono / WhatsApp *</label>
        <input
          id="tel"
          type="tel"
          placeholder="+39 320 123 4567"
          value={booking.cliente_telefono || ''}
          onChange={e => handleChange('cliente_telefono', e.target.value)}
          onBlur={() => handleBlur('cliente_telefono')}
          className={touched.cliente_telefono && errors.cliente_telefono ? 'error' : ''}
          autoComplete="tel"
        />
        {touched.cliente_telefono && errors.cliente_telefono && (
          <div className="error-msg">{errors.cliente_telefono}</div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="note">Note (opzionale)</label>
        <textarea
          id="note"
          placeholder="Altezza, richieste speciali, punto di incontro..."
          value={booking.cliente_note || ''}
          onChange={e => handleChange('cliente_note', e.target.value)}
          rows={3}
          style={{ resize: 'vertical' }}
        />
      </div>

      <div style={{
        background: 'var(--verde-pale2)',
        border: '1px solid #b7e4c7',
        borderRadius: 8,
        padding: '12px 16px',
        fontSize: '0.82rem',
        color: 'var(--text-light)',
        marginBottom: 8,
      }}>
        🔒 I tuoi dati sono usati solo per gestire la prenotazione.
        Non vengono condivisi con terze parti.
      </div>

      <div className="btn-nav-row">
        <button className="btn btn-secondary" onClick={onBack}>← Indietro</button>
        <button className="btn btn-primary" onClick={handleNext}>
          Vai al pagamento →
        </button>
      </div>
    </div>
  );
}

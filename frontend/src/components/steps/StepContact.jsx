import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function StepContact({ booking, onChange, onNext, onBack }) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState({});

  function validate(fields) {
    const errors = {};
    if (!fields.cliente_nome?.trim())
      errors.cliente_nome = t('stepContact.errors.nameRequired');
    if (!fields.cliente_email?.trim())
      errors.cliente_email = t('stepContact.errors.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.cliente_email))
      errors.cliente_email = t('stepContact.errors.emailInvalid');
    if (!fields.cliente_telefono?.trim())
      errors.cliente_telefono = t('stepContact.errors.phoneRequired');
    else if (!/^[+\d\s\-()]{7,20}$/.test(fields.cliente_telefono))
      errors.cliente_telefono = t('stepContact.errors.phoneInvalid');
    return errors;
  }

  const errors    = validate(booking);
  const hasErrors = Object.keys(errors).length > 0;

  function handleBlur(field) {
    setTouched(t => ({ ...t, [field]: true }));
  }

  function handleChange(field, value) {
    onChange({ [field]: value });
  }

  function handleNext() {
    setTouched({ cliente_nome: true, cliente_email: true, cliente_telefono: true });
    if (!hasErrors) onNext();
  }

  return (
    <div>
      <h2 className="step-title">{t('stepContact.title')}</h2>
      <p className="step-subtitle">{t('stepContact.subtitle')}</p>

      <div className="form-group">
        <label htmlFor="nome">{t('stepContact.name')} *</label>
        <input
          id="nome"
          type="text"
          placeholder={t('stepContact.namePlaceholder')}
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
        <label htmlFor="email">{t('stepContact.email')} *</label>
        <input
          id="email"
          type="email"
          placeholder="email@example.com"
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
        <label htmlFor="tel">{t('stepContact.phone')} *</label>
        <input
          id="tel"
          type="tel"
          placeholder={t('stepContact.phonePlaceholder')}
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
        <label htmlFor="note">{t('stepContact.notes')}</label>
        <textarea
          id="note"
          placeholder={t('stepContact.notesPlaceholder')}
          value={booking.cliente_note || ''}
          onChange={e => handleChange('cliente_note', e.target.value)}
          rows={3}
          style={{ resize: 'vertical' }}
        />
      </div>

      <div style={{ background: 'var(--verde-pale2)', border: '1px solid #b7e4c7', borderRadius: 8, padding: '12px 16px', fontSize: '0.82rem', color: 'var(--text-light)', marginBottom: 8 }}>
        {t('stepContact.privacy')}
      </div>

      <div className="btn-nav-row">
        <button className="btn btn-secondary" onClick={onBack}>{t('common.back')}</button>
        <button className="btn btn-primary" onClick={handleNext}>
          {t('stepContact.goPayment')}
        </button>
      </div>
    </div>
  );
}

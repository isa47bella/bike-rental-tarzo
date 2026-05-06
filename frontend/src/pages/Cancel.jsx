import { Link } from 'react-router-dom';

const IconX = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--destructive)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
  </svg>
);

export default function CancelPage() {
  return (
    <div className="result-page">
      <div className="result-card">
        <div className="result-icon"><IconX /></div>
        <h1 style={{ color: 'var(--destructive)' }}>Pagamento annullato</h1>
        <p>
          Il pagamento è stato annullato. Nessun addebito è stato effettuato.<br />
          Puoi riprovare quando vuoi.
        </p>
        <Link to="/" className="btn btn-primary btn-full">
          Riprova la prenotazione
        </Link>
      </div>
    </div>
  );
}

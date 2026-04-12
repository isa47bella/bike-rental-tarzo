import { Link } from 'react-router-dom';

export default function CancelPage() {
  return (
    <div className="result-page">
      <div className="result-card">
        <div className="result-icon">❌</div>
        <h1 style={{ color: '#c0392b' }}>Pagamento annullato</h1>
        <p>
          Il pagamento è stato annullato. Nessun addebito è stato effettuato.<br />
          Puoi riprovare quando vuoi.
        </p>
        <Link to="/" className="btn btn-primary btn-full" style={{ marginBottom: 12 }}>
          🚲 Riprova la prenotazione
        </Link>
      </div>
    </div>
  );
}

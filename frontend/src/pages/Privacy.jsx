import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="privacy-page">
      <div className="privacy-container">
        <div className="privacy-back">
          <Link to="/" className="privacy-back-link">
            ← Torna al sito
          </Link>
        </div>

        <h1 className="privacy-title">Privacy Policy & Cookie Policy</h1>
        <p className="privacy-meta">Ultimo aggiornamento: maggio 2025</p>

        <section className="privacy-section">
          <h2>1. Titolare del Trattamento</h2>
          <p>
            <strong>Arfanta Bike Rental</strong><br />
            Via Pecol 22, Arfanta di Tarzo (TV) — 31020 Italia<br />
            Email: <a href="mailto:arfantabikerental@gmail.com">arfantabikerental@gmail.com</a><br />
            Tel: <a href="tel:+393928614635">+39 392 8614635</a>
          </p>
        </section>

        <section className="privacy-section">
          <h2>2. Dati Raccolti e Finalità</h2>
          <p>Raccogliamo i seguenti dati personali esclusivamente per le finalità indicate:</p>
          <table className="privacy-table">
            <thead>
              <tr>
                <th>Dato</th>
                <th>Finalità</th>
                <th>Base giuridica</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Nome e cognome</td>
                <td>Stipula contratto di noleggio</td>
                <td>Contratto (Art. 6.1.b GDPR)</td>
              </tr>
              <tr>
                <td>Email</td>
                <td>Invio conferma prenotazione e comunicazioni</td>
                <td>Contratto (Art. 6.1.b GDPR)</td>
              </tr>
              <tr>
                <td>Numero di telefono</td>
                <td>Comunicazioni urgenti legate al noleggio</td>
                <td>Contratto (Art. 6.1.b GDPR)</td>
              </tr>
              <tr>
                <td>Dati di pagamento</td>
                <td>Elaborazione pagamento e gestione cauzione</td>
                <td>Contratto (Art. 6.1.b GDPR)</td>
              </tr>
              <tr>
                <td>Note facoltative</td>
                <td>Personalizzazione del servizio</td>
                <td>Consenso (Art. 6.1.a GDPR)</td>
              </tr>
              <tr>
                <td>Indirizzo IP</td>
                <td>Sicurezza e firma digitale contratto</td>
                <td>Interesse legittimo (Art. 6.1.f GDPR)</td>
              </tr>
            </tbody>
          </table>
          <p style={{ marginTop: 12 }}>
            I dati <strong>non vengono utilizzati per finalità di marketing</strong>, profilazione o
            ceduti a terzi al di fuori dei responsabili del trattamento elencati di seguito.
          </p>
        </section>

        <section className="privacy-section">
          <h2>3. Responsabili del Trattamento (Sub-processor)</h2>
          <p>Per erogare il servizio ci avvaliamo dei seguenti fornitori terzi, ciascuno dotato di adeguate garanzie GDPR:</p>
          <ul className="privacy-list">
            <li>
              <strong>Stripe Inc.</strong> (pagamenti) — USA, Standard Contractual Clauses —{' '}
              <a href="https://stripe.com/it/privacy" target="_blank" rel="noopener noreferrer">stripe.com/privacy</a>
            </li>
            <li>
              <strong>Supabase Inc.</strong> (database cloud) — USA/EU, Standard Contractual Clauses —{' '}
              <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">supabase.com/privacy</a>
            </li>
            <li>
              <strong>Vercel Inc.</strong> (hosting applicazione) — USA, Standard Contractual Clauses —{' '}
              <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">vercel.com/legal/privacy-policy</a>
            </li>
            <li>
              <strong>Google LLC</strong> (servizio email Gmail SMTP) — USA, Standard Contractual Clauses —{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">policies.google.com/privacy</a>
            </li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>4. Periodo di Conservazione</h2>
          <p>
            I dati personali vengono conservati per un massimo di <strong>5 anni</strong> dalla data della prenotazione,
            dopodiché vengono eliminati in modo sicuro. I dati necessari per obblighi fiscali e contabili
            sono conservati per <strong>10 anni</strong> ai sensi della normativa vigente.
          </p>
        </section>

        <section className="privacy-section">
          <h2>5. Cookie Policy</h2>
          <p>
            Questo sito utilizza esclusivamente <strong>cookie tecnici strettamente necessari</strong> al
            funzionamento del servizio. Non vengono utilizzati cookie di profilazione, tracciamento o marketing.
          </p>

          <h3>Cookie e dati di sessione utilizzati</h3>
          <table className="privacy-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Durata</th>
                <th>Scopo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>arfanta_cookie_consent</code></td>
                <td>localStorage</td>
                <td>1 anno</td>
                <td>Salva la preferenza di consenso ai cookie</td>
              </tr>
              <tr>
                <td><code>i18nextLng</code></td>
                <td>localStorage</td>
                <td>Persistente</td>
                <td>Memorizza la lingua selezionata dall'utente</td>
              </tr>
              <tr>
                <td>Cookie Stripe</td>
                <td>Cookie di terze parti</td>
                <td>Sessione</td>
                <td>Gestione sessione di pagamento sicura (Stripe Checkout)</td>
              </tr>
              <tr>
                <td><code>admin_token</code></td>
                <td>sessionStorage</td>
                <td>Sessione</td>
                <td>Autenticazione pannello amministrativo (solo uso interno)</td>
              </tr>
            </tbody>
          </table>

          <p style={{ marginTop: 12 }}>
            I cookie tecnici non richiedono consenso ai sensi dell'art. 122 del D.lgs. 196/2003 e delle
            Linee Guida del Garante per la protezione dei dati personali. Cliccando su "Solo necessari"
            nel banner non viene installato alcun cookie aggiuntivo rispetto a quelli sopra elencati.
          </p>

          <h3 style={{ marginTop: 16 }}>Come disabilitare i cookie</h3>
          <p>
            È possibile gestire o disabilitare i cookie tramite le impostazioni del proprio browser.
            Si noti che la disabilitazione dei cookie tecnici potrebbe compromettere il corretto
            funzionamento del sito e del processo di pagamento.
          </p>
        </section>

        <section className="privacy-section">
          <h2>6. Diritti dell'Interessato</h2>
          <p>Ai sensi degli artt. 15-22 del GDPR, hai il diritto di:</p>
          <ul className="privacy-list">
            <li><strong>Accesso</strong> — ottenere copia dei tuoi dati personali in nostro possesso</li>
            <li><strong>Rettifica</strong> — correggere dati inesatti o incompleti</li>
            <li><strong>Cancellazione</strong> — richiedere la cancellazione dei tuoi dati ("diritto all'oblio")</li>
            <li><strong>Limitazione</strong> — limitare il trattamento dei tuoi dati in determinati casi</li>
            <li><strong>Portabilità</strong> — ricevere i tuoi dati in formato strutturato e leggibile da macchina</li>
            <li><strong>Opposizione</strong> — opporti al trattamento basato su interesse legittimo</li>
            <li><strong>Revoca del consenso</strong> — revocare in qualsiasi momento il consenso prestato</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            Per esercitare i tuoi diritti, scrivi a:{' '}
            <a href="mailto:arfantabikerental@gmail.com">arfantabikerental@gmail.com</a>.
            Risponderemo entro 30 giorni dalla ricezione della richiesta.
          </p>
        </section>

        <section className="privacy-section">
          <h2>7. Reclamo all'Autorità di Controllo</h2>
          <p>
            Hai il diritto di proporre reclamo al{' '}
            <strong>Garante per la protezione dei dati personali</strong> (
            <a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer">www.garanteprivacy.it</a>
            ) qualora ritieni che il trattamento dei tuoi dati violi il GDPR.
          </p>
        </section>

        <section className="privacy-section">
          <h2>8. Modifiche alla Privacy Policy</h2>
          <p>
            Ci riserviamo il diritto di aggiornare questa Privacy Policy in qualsiasi momento.
            Le modifiche saranno pubblicate su questa pagina con aggiornamento della data in cima.
            Ti invitiamo a consultarla periodicamente.
          </p>
        </section>

        <div className="privacy-footer">
          <p>Arfanta Bike Rental · Via Pecol 22, Arfanta di Tarzo (TV) · <a href="mailto:arfantabikerental@gmail.com">arfantabikerental@gmail.com</a></p>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

// ─── Termini e Condizioni completi (5 lingue) ─────────────────────────────────

const TERMS = {
  it: [
    {
      title: 'Art. 1 — Oggetto e Parti',
      text: 'Il presente contratto regola il noleggio di una bicicletta elettrica da parte di Arfanta Bike Rental (di seguito "Noleggiatore"), con sede in Via Pecol 22, Arfanta di Tarzo (TV), email: arfantabikerental@gmail.com, nei confronti del cliente (di seguito "Conduttore").',
    },
    {
      title: 'Art. 2 — Requisiti del Conduttore',
      text: 'Il Conduttore dichiara di avere almeno 18 anni di età, di essere fisicamente idoneo alla guida di una bicicletta elettrica e di non essere sotto l\'effetto di alcol, droghe o farmaci che possano alterare la capacità di guida. Al momento del ritiro dovrà esibire un documento d\'identità valido.',
    },
    {
      title: 'Art. 3 — Uso del Veicolo',
      text: 'La bicicletta è consegnata in perfetto stato di manutenzione. Il Conduttore si impegna a: (a) utilizzarla esclusivamente per uso personale e ricreativo su strade e percorsi idonei; (b) rispettare il Codice della Strada e le norme locali; (c) non partecipare a gare, competizioni o prove cronometrate; (d) non subaffittare il mezzo a terzi; (e) non apportare modifiche ai componenti della bicicletta; (f) non trasportare passeggeri se non espressamente previsto dal modello; (g) indossare il casco (vivamente consigliato). È vietato l\'uso fuori strada (off-road) non concordato con il Noleggiatore.',
    },
    {
      title: 'Art. 4 — Ritiro e Restituzione',
      text: 'La bicicletta deve essere ritirata e restituita negli orari concordati in sede. Per ritardi nella restituzione superiori a 30 minuti, il Noleggiatore si riserva il diritto di addebitare €10 per ogni ora o frazione di ora aggiuntiva. La bicicletta va restituita nello stesso stato in cui è stata consegnata: pulita, funzionante e con la batteria non completamente scarica.',
    },
    {
      title: 'Art. 5 — Responsabilità per Danni e Furto',
      text: 'Il Conduttore è responsabile di qualsiasi danno alla bicicletta (ammaccature, rotture, graffi profondi) causato per negligenza, uso improprio o incidente durante il periodo di noleggio, indipendentemente dall\'autore del sinistro. In caso di furto, il Conduttore è responsabile per il valore integrale del mezzo. Una cauzione di €500 viene pre-autorizzata sulla carta di credito al momento del ritiro e sbloccata alla restituzione senza danni. L\'usura fisiologica derivante dal normale utilizzo non è addebitata.',
    },
    {
      title: 'Art. 6 — Esclusioni di Responsabilità',
      text: 'Il Noleggiatore declina ogni responsabilità per: (a) danni a terzi o a cose causati dal Conduttore durante il noleggio; (b) infortuni fisici subiti dal Conduttore durante l\'utilizzo del mezzo; (c) guasti meccanici dovuti ad uso improprio o negligenza. Il Conduttore è invitato a verificare la propria copertura assicurativa personale. La bicicletta è dotata di assistenza di primo livello (kit foratura disponibile su richiesta).',
    },
    {
      title: 'Art. 7 — Cancellazione e Rimborso',
      text: 'Cancellazioni comunicate oltre 48 ore prima dell\'inizio del noleggio: rimborso integrale dell\'importo pagato. Cancellazioni entro 48 ore dall\'inizio: nessun rimborso, salvo forza maggiore documentata (es. ricovero ospedaliero, grave lutto familiare), valutata individualmente dal Noleggiatore. Condizioni meteorologiche avverse non danno diritto a rimborso automatico.',
    },
    {
      title: 'Art. 8 — Trattamento dei Dati Personali (GDPR)',
      text: 'Ai sensi del Regolamento UE 2016/679 (GDPR) e del D.lgs. 196/2003, i dati personali del Conduttore (nome, cognome, email, telefono, dati di prenotazione) sono trattati da Arfanta Bike Rental in qualità di Titolare del trattamento per le seguenti finalità: (a) esecuzione del contratto di noleggio; (b) invio di comunicazioni relative alla prenotazione; (c) adempimento di obblighi legali e fiscali. I dati non sono ceduti a terzi, ad eccezione dei soggetti strettamente necessari all\'erogazione del servizio (es. gestore pagamenti Stripe). Sono conservati per un periodo massimo di 5 anni dalla data della prenotazione, dopodiché vengono cancellati in modo sicuro. Il Conduttore ha diritto di accedere, rettificare, cancellare i propri dati, opporsi al trattamento, richiederne la portabilità e revocare il consenso in qualsiasi momento, scrivendo a arfantabikerental@gmail.com.',
    },
    {
      title: 'Art. 9 — Legge Applicabile e Foro Competente',
      text: 'Il presente contratto è regolato dalla legge italiana. Per qualsiasi controversia derivante dal presente contratto, le parti concordano la competenza esclusiva del Tribunale di Treviso.',
    },
  ],

  en: [
    {
      title: 'Art. 1 — Subject and Parties',
      text: 'This agreement governs the rental of an electric bicycle by Arfanta Bike Rental (hereinafter "Lessor"), located at Via Pecol 22, Arfanta di Tarzo (TV), Italy, email: arfantabikerental@gmail.com, to the customer (hereinafter "Renter").',
    },
    {
      title: 'Art. 2 — Requirements',
      text: 'The Renter declares to be at least 18 years of age, physically fit to ride an electric bicycle, and not under the influence of alcohol, drugs or medications that may impair riding ability. A valid identity document must be presented at the time of pickup.',
    },
    {
      title: 'Art. 3 — Use of the Bicycle',
      text: 'The bicycle is provided in perfect working condition. The Renter agrees to: (a) use it solely for personal and recreational purposes on suitable roads and paths; (b) comply with the Italian Highway Code and local regulations; (c) not participate in any race, competition or timed event; (d) not sublet the bicycle to third parties; (e) not modify any bicycle components; (f) not carry passengers unless the model expressly permits it; (g) wear a helmet (strongly recommended). Off-road use must be agreed in advance with the Lessor.',
    },
    {
      title: 'Art. 4 — Pickup and Return',
      text: 'The bicycle must be picked up and returned at the agreed times and location. For returns more than 30 minutes late, the Lessor reserves the right to charge €10 per additional hour or fraction thereof. The bicycle must be returned in the same condition as delivered: clean, functioning, and not with a completely discharged battery.',
    },
    {
      title: 'Art. 5 — Liability for Damage and Theft',
      text: 'The Renter is liable for any damage to the bicycle (dents, breakages, deep scratches) caused by negligence, improper use, or accident during the rental period, regardless of who caused the incident. In the event of theft, the Renter is liable for the full replacement value of the bicycle. A €500 security deposit is pre-authorized on the credit card at pickup and released upon undamaged return. Normal wear and tear from ordinary use is not charged.',
    },
    {
      title: 'Art. 6 — Limitation of Liability',
      text: 'The Lessor accepts no liability for: (a) damage to third parties or property caused by the Renter during the rental; (b) personal injuries sustained by the Renter during use; (c) mechanical failures due to improper use or negligence. The Renter is advised to verify their personal insurance coverage.',
    },
    {
      title: 'Art. 7 — Cancellation and Refund',
      text: 'Cancellations made more than 48 hours before the start of the rental: full refund. Cancellations within 48 hours of the start: no refund, unless force majeure is documented (e.g. hospitalisation, bereavement), assessed individually by the Lessor. Adverse weather conditions do not entitle the Renter to an automatic refund.',
    },
    {
      title: 'Art. 8 — Personal Data Processing (GDPR)',
      text: 'Pursuant to EU Regulation 2016/679 (GDPR), the Renter\'s personal data (name, email, telephone, booking details) are processed by Arfanta Bike Rental as Data Controller for the following purposes: (a) performance of the rental agreement; (b) sending booking-related communications; (c) fulfilment of legal and fiscal obligations. Data are not shared with third parties, except those strictly necessary for service delivery (e.g. Stripe payment processor). Data are retained for a maximum of 5 years from the booking date, after which they are securely deleted. The Renter has the right to access, rectify, delete, object to processing, request portability and withdraw consent at any time by writing to arfantabikerental@gmail.com.',
    },
    {
      title: 'Art. 9 — Governing Law and Jurisdiction',
      text: 'This agreement is governed by Italian law. For any dispute arising from this agreement, the parties agree on the exclusive jurisdiction of the Court of Treviso, Italy.',
    },
  ],

  de: [
    {
      title: 'Art. 1 — Gegenstand und Parteien',
      text: 'Dieser Vertrag regelt die Vermietung eines Elektrofahrrads durch Arfanta Bike Rental (im Folgenden „Vermieter"), mit Sitz in Via Pecol 22, Arfanta di Tarzo (TV), Italien, E-Mail: arfantabikerental@gmail.com, an den Kunden (im Folgenden „Mieter").',
    },
    {
      title: 'Art. 2 — Anforderungen',
      text: 'Der Mieter erklärt, mindestens 18 Jahre alt zu sein, körperlich in der Lage zu sein, ein Elektrofahrrad zu fahren, und nicht unter dem Einfluss von Alkohol, Drogen oder Medikamenten zu stehen, die die Fahrtüchtigkeit beeinträchtigen könnten. Bei der Abholung ist ein gültiger Personalausweis vorzulegen.',
    },
    {
      title: 'Art. 3 — Nutzung des Fahrrads',
      text: 'Das Fahrrad wird in einwandfreiem Zustand übergeben. Der Mieter verpflichtet sich: (a) es ausschließlich für den persönlichen Freizeitgebrauch auf geeigneten Straßen und Wegen zu nutzen; (b) die Straßenverkehrsordnung und lokale Vorschriften einzuhalten; (c) nicht an Rennen, Wettkämpfen oder Zeitfahrten teilzunehmen; (d) das Fahrrad nicht unterzuvermieten; (e) keine Änderungen an den Fahrradkomponenten vorzunehmen; (f) keinen Beifahrer zu befördern, sofern das Modell dies nicht ausdrücklich erlaubt; (g) einen Helm zu tragen (dringend empfohlen). Geländefahrten (Offroad) müssen im Voraus mit dem Vermieter abgestimmt werden.',
    },
    {
      title: 'Art. 4 — Abholung und Rückgabe',
      text: 'Das Fahrrad muss zu den vereinbarten Zeiten abgeholt und zurückgegeben werden. Bei Rückgabe von mehr als 30 Minuten Verspätung behält sich der Vermieter das Recht vor, €10 pro angefangene Stunde in Rechnung zu stellen. Das Fahrrad ist in demselben Zustand zurückzugeben, in dem es übergeben wurde: sauber, funktionsfähig und nicht mit vollständig entladener Batterie.',
    },
    {
      title: 'Art. 5 — Haftung für Schäden und Diebstahl',
      text: 'Der Mieter haftet für alle Schäden am Fahrrad (Dellen, Brüche, tiefe Kratzer), die durch Fahrlässigkeit, unsachgemäßen Gebrauch oder einen Unfall während der Mietzeit verursacht wurden, unabhängig davon, wer den Schaden verursacht hat. Im Falle eines Diebstahls haftet der Mieter für den vollen Wiederbeschaffungswert des Fahrrads. Eine Kaution von €500 wird bei der Abholung auf der Kreditkarte vorläufig autorisiert und nach unbeschädigter Rückgabe freigegeben. Normaler Verschleiß durch übliche Nutzung wird nicht in Rechnung gestellt.',
    },
    {
      title: 'Art. 6 — Haftungsausschluss',
      text: 'Der Vermieter übernimmt keine Haftung für: (a) Schäden an Dritten oder Sachen, die durch den Mieter während der Mietzeit verursacht werden; (b) körperliche Verletzungen des Mieters bei der Nutzung des Fahrrads; (c) mechanische Störungen aufgrund unsachgemäßer Nutzung oder Fahrlässigkeit. Der Mieter wird empfohlen, seinen persönlichen Versicherungsschutz zu überprüfen.',
    },
    {
      title: 'Art. 7 — Stornierung und Erstattung',
      text: 'Stornierungen, die mehr als 48 Stunden vor Beginn der Miete mitgeteilt werden: vollständige Rückerstattung. Stornierungen innerhalb von 48 Stunden vor Beginn: keine Rückerstattung, es sei denn, es liegt ein nachgewiesener Fall höherer Gewalt vor (z.B. Krankenhausaufenthalt, schwerer Trauerfall), der individuell vom Vermieter bewertet wird. Ungünstige Wetterbedingungen berechtigen nicht zu einer automatischen Rückerstattung.',
    },
    {
      title: 'Art. 8 — Datenschutz (DSGVO)',
      text: 'Gemäß der EU-Verordnung 2016/679 (DSGVO) werden die personenbezogenen Daten des Mieters (Name, E-Mail, Telefon, Buchungsdaten) von Arfanta Bike Rental als Verantwortlichem für folgende Zwecke verarbeitet: (a) Erfüllung des Mietvertrags; (b) Zusendung buchungsbezogener Mitteilungen; (c) Erfüllung rechtlicher und steuerlicher Pflichten. Die Daten werden nicht an Dritte weitergegeben, außer an jene, die zur Erbringung des Dienstes unbedingt erforderlich sind (z.B. Stripe für die Zahlungsabwicklung). Die Daten werden maximal 5 Jahre ab dem Buchungsdatum aufbewahrt und anschließend sicher gelöscht. Der Mieter hat das Recht auf Auskunft, Berichtigung, Löschung, Widerspruch, Datenübertragbarkeit und Widerruf der Einwilligung, durch Schreiben an arfantabikerental@gmail.com.',
    },
    {
      title: 'Art. 9 — Anwendbares Recht und Gerichtsstand',
      text: 'Dieser Vertrag unterliegt italienischem Recht. Für etwaige Streitigkeiten aus diesem Vertrag vereinbaren die Parteien die ausschließliche Zuständigkeit des Gerichts Treviso, Italien.',
    },
  ],

  es: [
    {
      title: 'Art. 1 — Objeto y Partes',
      text: 'El presente contrato regula el alquiler de una bicicleta eléctrica por parte de Arfanta Bike Rental (en adelante "Arrendador"), con sede en Via Pecol 22, Arfanta di Tarzo (TV), Italia, email: arfantabikerental@gmail.com, al cliente (en adelante "Arrendatario").',
    },
    {
      title: 'Art. 2 — Requisitos',
      text: 'El Arrendatario declara tener al menos 18 años de edad, estar físicamente capacitado para conducir una bicicleta eléctrica y no estar bajo los efectos del alcohol, drogas o medicamentos que puedan afectar la capacidad de conducción. Deberá presentar un documento de identidad válido en el momento de la recogida.',
    },
    {
      title: 'Art. 3 — Uso de la Bicicleta',
      text: 'La bicicleta se entrega en perfecto estado de mantenimiento. El Arrendatario se compromete a: (a) utilizarla exclusivamente para uso personal y recreativo en carreteras y caminos adecuados; (b) respetar el Código de Circulación y las normativas locales; (c) no participar en carreras, competiciones ni pruebas cronometradas; (d) no subarrendar el vehículo; (e) no realizar modificaciones en los componentes; (f) no transportar pasajeros salvo que el modelo lo permita expresamente; (g) llevar casco (muy recomendado). El uso fuera de carretera debe acordarse previamente con el Arrendador.',
    },
    {
      title: 'Art. 4 — Recogida y Devolución',
      text: 'La bicicleta debe recogerse y devolverse en los horarios acordados. Por retrasos en la devolución superiores a 30 minutos, el Arrendador se reserva el derecho de cobrar €10 por cada hora adicional o fracción. La bicicleta debe devolverse en el mismo estado en que fue entregada: limpia, en funcionamiento y sin la batería completamente descargada.',
    },
    {
      title: 'Art. 5 — Responsabilidad por Daños y Robo',
      text: 'El Arrendatario es responsable de cualquier daño a la bicicleta (abolladuras, roturas, arañazos profundos) causado por negligencia, uso indebido o accidente durante el período de alquiler, independientemente de quién haya causado el incidente. En caso de robo, el Arrendatario es responsable del valor íntegro del vehículo. Una fianza de €500 se preautoriza en la tarjeta de crédito al recoger y se libera al devolver sin daños. El desgaste normal por uso ordinario no se factura.',
    },
    {
      title: 'Art. 6 — Limitación de Responsabilidad',
      text: 'El Arrendador declina toda responsabilidad por: (a) daños a terceros o a bienes causados por el Arrendatario durante el alquiler; (b) lesiones físicas sufridas por el Arrendatario durante el uso; (c) averías mecánicas debidas a uso indebido o negligencia. Se recomienda al Arrendatario verificar su cobertura de seguro personal.',
    },
    {
      title: 'Art. 7 — Cancelación y Reembolso',
      text: 'Cancelaciones comunicadas con más de 48 horas de antelación: reembolso íntegro. Cancelaciones dentro de las 48 horas previas: sin reembolso, salvo fuerza mayor debidamente documentada (p. ej. hospitalización, duelo grave), evaluada individualmente por el Arrendador. Las condiciones meteorológicas adversas no dan derecho a un reembolso automático.',
    },
    {
      title: 'Art. 8 — Protección de Datos (RGPD)',
      text: 'De conformidad con el Reglamento UE 2016/679 (RGPD), los datos personales del Arrendatario (nombre, email, teléfono, datos de reserva) son tratados por Arfanta Bike Rental como Responsable del tratamiento con las siguientes finalidades: (a) ejecución del contrato de alquiler; (b) envío de comunicaciones relacionadas con la reserva; (c) cumplimiento de obligaciones legales y fiscales. Los datos no se ceden a terceros, salvo los estrictamente necesarios para la prestación del servicio (p. ej. Stripe para el pago). Se conservan un máximo de 5 años desde la fecha de reserva, tras los cuales se eliminan de forma segura. El Arrendatario tiene derecho a acceder, rectificar, suprimir, oponerse al tratamiento, solicitar la portabilidad y revocar el consentimiento en cualquier momento escribiendo a arfantabikerental@gmail.com.',
    },
    {
      title: 'Art. 9 — Ley Aplicable y Jurisdicción',
      text: 'El presente contrato se rige por la legislación italiana. Para cualquier controversia derivada de este contrato, las partes acuerdan la competencia exclusiva del Tribunal de Treviso, Italia.',
    },
  ],

  fr: [
    {
      title: 'Art. 1 — Objet et Parties',
      text: 'Le présent contrat régit la location d\'un vélo électrique par Arfanta Bike Rental (ci-après « Loueur »), dont le siège est Via Pecol 22, Arfanta di Tarzo (TV), Italie, email : arfantabikerental@gmail.com, au profit du client (ci-après « Locataire »).',
    },
    {
      title: 'Art. 2 — Conditions requises',
      text: 'Le Locataire déclare avoir au moins 18 ans, être physiquement apte à conduire un vélo électrique et ne pas être sous l\'influence de l\'alcool, de drogues ou de médicaments susceptibles d\'altérer ses capacités de conduite. Une pièce d\'identité valide devra être présentée au moment de la prise en charge.',
    },
    {
      title: 'Art. 3 — Utilisation du Vélo',
      text: 'Le vélo est remis en parfait état de fonctionnement. Le Locataire s\'engage à : (a) l\'utiliser exclusivement à des fins personnelles et récréatives sur des routes et chemins appropriés ; (b) respecter le Code de la route et les réglementations locales ; (c) ne pas participer à des courses, compétitions ou épreuves chronométrées ; (d) ne pas sous-louer le vélo à des tiers ; (e) ne pas modifier les composants du vélo ; (f) ne pas transporter de passagers sauf si le modèle le permet expressément ; (g) porter un casque (fortement recommandé). L\'utilisation hors route doit être convenue à l\'avance avec le Loueur.',
    },
    {
      title: 'Art. 4 — Prise en Charge et Restitution',
      text: 'Le vélo doit être pris en charge et restitué aux horaires convenus. Pour tout retard de restitution supérieur à 30 minutes, le Loueur se réserve le droit de facturer €10 par heure supplémentaire ou fraction d\'heure. Le vélo doit être restitué dans le même état qu\'au moment de la remise : propre, en état de marche et avec une batterie non complètement déchargée.',
    },
    {
      title: 'Art. 5 — Responsabilité pour Dommages et Vol',
      text: 'Le Locataire est responsable de tout dommage au vélo (bosses, casses, griffures profondes) causé par négligence, mauvais usage ou accident pendant la période de location, quel que soit l\'auteur du sinistre. En cas de vol, le Locataire est responsable de la valeur intégrale du vélo. Une caution de €500 est pré-autorisée sur la carte de crédit lors de la prise en charge et débloquée à la restitution sans dommage. L\'usure normale due à une utilisation ordinaire n\'est pas facturée.',
    },
    {
      title: 'Art. 6 — Limitation de Responsabilité',
      text: 'Le Loueur décline toute responsabilité pour : (a) les dommages causés à des tiers ou à des biens par le Locataire pendant la location ; (b) les blessures physiques subies par le Locataire lors de l\'utilisation du vélo ; (c) les pannes mécaniques dues à un mauvais usage ou à la négligence. Il est conseillé au Locataire de vérifier sa couverture d\'assurance personnelle.',
    },
    {
      title: 'Art. 7 — Annulation et Remboursement',
      text: 'Annulations effectuées plus de 48 heures avant le début de la location : remboursement intégral. Annulations dans les 48 heures précédant la location : aucun remboursement, sauf cas de force majeure dûment documenté (ex. hospitalisation, deuil grave), apprécié individuellement par le Loueur. Les mauvaises conditions météorologiques n\'ouvrent pas droit à un remboursement automatique.',
    },
    {
      title: 'Art. 8 — Protection des Données (RGPD)',
      text: 'Conformément au Règlement UE 2016/679 (RGPD), les données personnelles du Locataire (nom, email, téléphone, données de réservation) sont traitées par Arfanta Bike Rental en qualité de Responsable du traitement aux fins suivantes : (a) exécution du contrat de location ; (b) envoi de communications relatives à la réservation ; (c) respect des obligations légales et fiscales. Les données ne sont pas transmises à des tiers, sauf à ceux strictement nécessaires à la prestation du service (ex. Stripe pour les paiements). Elles sont conservées pendant 5 ans maximum à compter de la date de réservation, puis supprimées de manière sécurisée. Le Locataire dispose des droits d\'accès, de rectification, d\'effacement, d\'opposition, de portabilité et de retrait du consentement à tout moment en écrivant à arfantabikerental@gmail.com.',
    },
    {
      title: 'Art. 9 — Droit Applicable et Juridiction',
      text: 'Le présent contrat est régi par le droit italien. Pour tout litige découlant de ce contrat, les parties conviennent de la compétence exclusive du Tribunal de Trévise, Italie.',
    },
  ],
};

// ─── Traduzioni UI ────────────────────────────────────────────────────────────

const T = {
  it: {
    title: 'Contratto di Noleggio',
    subtitle: 'Bicicletta Elettrica — Arfanta Bike Rental',
    summary: 'Riepilogo Prenotazione',
    code: 'Codice prenotazione',
    fCliente: 'Cliente', fTipo: 'Tipo noleggio', fRitiro: 'Ritiro', fRestituzione: 'Restituzione', fPrezzo: 'Importo pagato',
    types: { mezza_mattina: 'Mezza Giornata Mattina (09:00–13:00)', mezza_pomeriggio: 'Mezza Giornata Pomeriggio (14:00–18:00)', intera_giornata: 'Giornata Intera (09:00–18:00)', multi_giorno: 'Multi-Giorno' },
    termsTitle: 'Termini e Condizioni Completi',
    termsHint: 'Scorri per leggere i termini completi prima di firmare',
    checks: [
      'Ho letto e accetto integralmente i <strong>Termini e Condizioni</strong> di noleggio sopra riportati (Artt. 1–7).',
      'Mi impegno a restituire la bicicletta in perfette condizioni <strong>entro l\'orario concordato</strong> (Art. 4).',
      'Sono consapevole della mia <strong>responsabilità per danni e furto</strong> e della cauzione di €500 (Art. 5).',
      'Acconsento al <strong>trattamento dei miei dati personali</strong> ai sensi del GDPR per la gestione del noleggio (Art. 8).',
    ],
    nameLabel: 'Il tuo nome completo', namePlaceholder: 'Es. Mario Rossi',
    signBtn: 'Firma il Contratto', signing: 'Firma in corso…',
    mustCheck: 'Accetta tutti i punti per procedere con la firma.', mustName: 'Inserisci il tuo nome completo prima di firmare.',
    successTitle: 'Contratto Firmato!', successMsg: 'Grazie, il contratto è stato firmato correttamente. Puoi chiudere questa pagina.',
    successDate: 'Data e ora firma:', successName: 'Firmato da:',
    alreadyTitle: 'Contratto già firmato', alreadyMsg: 'Questo contratto risulta già firmato. Non è necessaria alcuna azione.',
    signedBy: 'Firmato da:', signedOn: 'Data firma:',
    loading: 'Caricamento…', notFound: 'Prenotazione non trovata o non ancora confermata.', errGeneric: 'Si è verificato un errore. Riprova.',
    location: 'Via Pecol 22, Arfanta di Tarzo (TV)', giorni: 'giorni',
    scrollRead: 'Scorri ↓',
  },
  en: {
    title: 'Rental Agreement', subtitle: 'Electric Bicycle — Arfanta Bike Rental',
    summary: 'Booking Summary', code: 'Booking code',
    fCliente: 'Customer', fTipo: 'Rental type', fRitiro: 'Pickup', fRestituzione: 'Return', fPrezzo: 'Amount paid',
    types: { mezza_mattina: 'Half Day Morning (09:00–13:00)', mezza_pomeriggio: 'Half Day Afternoon (14:00–18:00)', intera_giornata: 'Full Day (09:00–18:00)', multi_giorno: 'Multi-Day' },
    termsTitle: 'Full Terms & Conditions',
    termsHint: 'Scroll to read all terms before signing',
    checks: [
      'I have read and fully accept the <strong>Terms and Conditions</strong> above (Arts. 1–7).',
      'I commit to returning the bicycle in perfect condition <strong>by the agreed return time</strong> (Art. 4).',
      'I acknowledge my <strong>liability for damage and theft</strong> and the €500 security deposit (Art. 5).',
      'I consent to the <strong>processing of my personal data</strong> under GDPR for rental management purposes (Art. 8).',
    ],
    nameLabel: 'Your full name', namePlaceholder: 'E.g. John Smith',
    signBtn: 'Sign the Agreement', signing: 'Signing…',
    mustCheck: 'Please accept all terms to proceed.', mustName: 'Please enter your full name before signing.',
    successTitle: 'Agreement Signed!', successMsg: 'Thank you, the agreement has been successfully signed. You may close this page.',
    successDate: 'Date and time signed:', successName: 'Signed by:',
    alreadyTitle: 'Agreement already signed', alreadyMsg: 'This agreement has already been signed. No further action is required.',
    signedBy: 'Signed by:', signedOn: 'Date signed:',
    loading: 'Loading…', notFound: 'Booking not found or not yet confirmed.', errGeneric: 'An error occurred. Please try again.',
    location: 'Via Pecol 22, Arfanta di Tarzo (TV) — Italy', giorni: 'days', scrollRead: 'Scroll ↓',
  },
  de: {
    title: 'Mietvertrag', subtitle: 'Elektrofahrrad — Arfanta Bike Rental',
    summary: 'Buchungsübersicht', code: 'Buchungscode',
    fCliente: 'Kunde', fTipo: 'Mietart', fRitiro: 'Abholung', fRestituzione: 'Rückgabe', fPrezzo: 'Bezahlter Betrag',
    types: { mezza_mattina: 'Halbtag Vormittag (09:00–13:00)', mezza_pomeriggio: 'Halbtag Nachmittag (14:00–18:00)', intera_giornata: 'Ganztag (09:00–18:00)', multi_giorno: 'Mehrtägig' },
    termsTitle: 'Vollständige Allgemeine Geschäftsbedingungen',
    termsHint: 'Scrollen Sie, um alle Bedingungen vor der Unterschrift zu lesen',
    checks: [
      'Ich habe die <strong>Allgemeinen Geschäftsbedingungen</strong> (Art. 1–7) vollständig gelesen und akzeptiere sie.',
      'Ich verpflichte mich, das Fahrrad in einwandfreiem Zustand <strong>bis zur vereinbarten Rückgabezeit</strong> zurückzugeben (Art. 4).',
      'Ich bin mir meiner <strong>Haftung für Schäden und Diebstahl</strong> und der Kaution von €500 bewusst (Art. 5).',
      'Ich stimme der <strong>Verarbeitung meiner personenbezogenen Daten</strong> gemäß DSGVO zum Zweck der Mietverwaltung zu (Art. 8).',
    ],
    nameLabel: 'Ihr vollständiger Name', namePlaceholder: 'z.B. Max Mustermann',
    signBtn: 'Vertrag unterzeichnen', signing: 'Unterschrift läuft…',
    mustCheck: 'Bitte akzeptieren Sie alle Punkte.', mustName: 'Bitte geben Sie Ihren vollständigen Namen ein.',
    successTitle: 'Vertrag unterzeichnet!', successMsg: 'Vielen Dank, der Vertrag wurde erfolgreich unterzeichnet. Sie können diese Seite schließen.',
    successDate: 'Datum und Uhrzeit:', successName: 'Unterzeichnet von:',
    alreadyTitle: 'Vertrag bereits unterzeichnet', alreadyMsg: 'Dieser Vertrag wurde bereits unterzeichnet.',
    signedBy: 'Unterzeichnet von:', signedOn: 'Datum:',
    loading: 'Laden…', notFound: 'Buchung nicht gefunden oder noch nicht bestätigt.', errGeneric: 'Ein Fehler ist aufgetreten.',
    location: 'Via Pecol 22, Arfanta di Tarzo (TV) — Italien', giorni: 'Tage', scrollRead: 'Scrollen ↓',
  },
  es: {
    title: 'Contrato de Alquiler', subtitle: 'Bicicleta Eléctrica — Arfanta Bike Rental',
    summary: 'Resumen de la Reserva', code: 'Código de reserva',
    fCliente: 'Cliente', fTipo: 'Tipo de alquiler', fRitiro: 'Recogida', fRestituzione: 'Devolución', fPrezzo: 'Importe pagado',
    types: { mezza_mattina: 'Medio Día Mañana (09:00–13:00)', mezza_pomeriggio: 'Medio Día Tarde (14:00–18:00)', intera_giornata: 'Día Completo (09:00–18:00)', multi_giorno: 'Varios Días' },
    termsTitle: 'Términos y Condiciones Completos',
    termsHint: 'Desplácese para leer todos los términos antes de firmar',
    checks: [
      'He leído y acepto íntegramente los <strong>Términos y Condiciones</strong> anteriores (Arts. 1–7).',
      'Me comprometo a devolver la bicicleta en perfectas condiciones <strong>antes del horario acordado</strong> (Art. 4).',
      'Soy consciente de mi <strong>responsabilidad por daños y robo</strong> y de la fianza de €500 (Art. 5).',
      'Consiento el <strong>tratamiento de mis datos personales</strong> según el RGPD para la gestión del alquiler (Art. 8).',
    ],
    nameLabel: 'Su nombre completo', namePlaceholder: 'Ej. Juan García',
    signBtn: 'Firmar el Contrato', signing: 'Firmando…',
    mustCheck: 'Acepte todos los puntos para continuar.', mustName: 'Introduzca su nombre completo.',
    successTitle: '¡Contrato Firmado!', successMsg: 'Gracias, el contrato ha sido firmado correctamente. Puede cerrar esta página.',
    successDate: 'Fecha y hora:', successName: 'Firmado por:',
    alreadyTitle: 'Contrato ya firmado', alreadyMsg: 'Este contrato ya ha sido firmado.',
    signedBy: 'Firmado por:', signedOn: 'Fecha:',
    loading: 'Cargando…', notFound: 'Reserva no encontrada o aún no confirmada.', errGeneric: 'Se ha producido un error.',
    location: 'Via Pecol 22, Arfanta di Tarzo (TV) — Italia', giorni: 'días', scrollRead: 'Desplazar ↓',
  },
  fr: {
    title: 'Contrat de Location', subtitle: 'Vélo Électrique — Arfanta Bike Rental',
    summary: 'Récapitulatif de Réservation', code: 'Code de réservation',
    fCliente: 'Client', fTipo: 'Type de location', fRitiro: 'Prise en charge', fRestituzione: 'Retour', fPrezzo: 'Montant payé',
    types: { mezza_mattina: 'Demi-Journée Matin (09h00–13h00)', mezza_pomeriggio: 'Demi-Journée Après-midi (14h00–18h00)', intera_giornata: 'Journée Complète (09h00–18h00)', multi_giorno: 'Plusieurs Jours' },
    termsTitle: 'Conditions Générales Complètes',
    termsHint: 'Faites défiler pour lire toutes les conditions avant de signer',
    checks: [
      'J\'ai lu et j\'accepte intégralement les <strong>Conditions Générales</strong> ci-dessus (Art. 1–7).',
      'Je m\'engage à restituer le vélo en parfait état <strong>avant l\'heure de retour convenue</strong> (Art. 4).',
      'Je reconnais ma <strong>responsabilité en cas de dommages et de vol</strong> et la caution de €500 (Art. 5).',
      'Je consens au <strong>traitement de mes données personnelles</strong> au titre du RGPD pour la gestion de la location (Art. 8).',
    ],
    nameLabel: 'Votre nom complet', namePlaceholder: 'Ex. Jean Dupont',
    signBtn: 'Signer le Contrat', signing: 'Signature en cours…',
    mustCheck: 'Veuillez accepter tous les points pour continuer.', mustName: 'Veuillez entrer votre nom complet.',
    successTitle: 'Contrat Signé !', successMsg: 'Merci, le contrat a été signé avec succès. Vous pouvez fermer cette page.',
    successDate: 'Date et heure :', successName: 'Signé par :',
    alreadyTitle: 'Contrat déjà signé', alreadyMsg: 'Ce contrat a déjà été signé.',
    signedBy: 'Signé par :', signedOn: 'Date :',
    loading: 'Chargement…', notFound: 'Réservation introuvable ou pas encore confirmée.', errGeneric: 'Une erreur s\'est produite.',
    location: 'Via Pecol 22, Arfanta di Tarzo (TV) — Italie', giorni: 'jours', scrollRead: 'Défiler ↓',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LOCALE_MAP = { it: 'it-IT', en: 'en-GB', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' };

function fmtDate(dateStr, lang) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(LOCALE_MAP[lang] || 'it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtDateTime(isoStr, lang) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleString(LOCALE_MAP[lang] || 'it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page:        { minHeight: '100vh', background: '#f0f4f8', fontFamily: "'Segoe UI', Arial, sans-serif", padding: '0 0 60px' },
  header:      { background: '#2D8659', color: '#fff', padding: '28px 24px 24px', textAlign: 'center' },
  logo:        { fontSize: 36, marginBottom: 4 },
  h1:          { margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#fff' },
  hsub:        { margin: 0, fontSize: '0.85rem', color: '#b7e4c7', fontWeight: 400 },
  card:        { background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,.08)', maxWidth: 620, margin: '28px auto 0', padding: '28px 28px 24px' },
  secTitle:    { fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2D8659', marginBottom: 14, marginTop: 0 },
  summaryBox:  { background: '#f0faf4', borderRadius: 8, padding: '16px 18px', marginBottom: 24 },
  row:         { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #d8eed6', fontSize: '0.88rem', gap: 8 },
  rowLabel:    { color: '#666', flexShrink: 0 },
  rowVal:      { fontWeight: 600, color: '#1a3a2a', textAlign: 'right' },
  codeBox:     { background: '#1a5c3a', color: '#fff', borderRadius: 6, padding: '5px 14px', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.12em', display: 'inline-block', marginTop: 10 },
  divider:     { border: 'none', borderTop: '1px solid #e8f0eb', margin: '20px 0' },
  // T&C box
  termsBox:    { border: '1px solid #c8ddd0', borderRadius: 8, maxHeight: 280, overflowY: 'auto', background: '#fafffe', marginBottom: 6, padding: '16px 18px', fontSize: '0.82rem', lineHeight: 1.65, color: '#333' },
  termsHint:   { textAlign: 'center', fontSize: '0.74rem', color: '#2D8659', marginBottom: 18, opacity: 0.8 },
  artTitle:    { fontWeight: 700, color: '#1a5c3a', marginBottom: 4, marginTop: 14, fontSize: '0.84rem' },
  artText:     { margin: '0 0 8px', color: '#444' },
  // checkboxes
  checkItem:   { display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12, cursor: 'pointer' },
  checkbox:    { width: 20, height: 20, minWidth: 20, borderRadius: 4, border: '2px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', marginTop: 1, background: '#fff' },
  checkboxOn:  { background: '#2D8659', borderColor: '#2D8659' },
  checkText:   { fontSize: '0.86rem', color: '#333', lineHeight: 1.55 },
  // name + button
  fieldLabel:  { display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#2D8659', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  input:       { width: '100%', padding: '12px 14px', border: '2px solid #d1e5d9', borderRadius: 8, fontSize: '1rem', outline: 'none', boxSizing: 'border-box', transition: 'border .15s' },
  errBox:      { background: '#fff0f0', border: '1px solid #ffaaaa', borderRadius: 8, padding: '10px 14px', fontSize: '0.88rem', color: '#c0392b', marginBottom: 14 },
  signBtn:     { width: '100%', padding: '15px', background: '#2D8659', color: '#fff', border: 'none', borderRadius: 10, fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer', transition: 'background .15s', marginTop: 6 },
  signBtnDis:  { background: '#9bb5a8', cursor: 'not-allowed' },
  // success
  successCard: { textAlign: 'center', padding: '20px 0 4px' },
  successIcon: { fontSize: 56, marginBottom: 12 },
  successH:    { fontSize: '1.4rem', fontWeight: 700, color: '#2D8659', margin: '0 0 8px' },
  successP:    { color: '#555', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 20px' },
  successMeta: { background: '#f0faf4', borderRadius: 8, padding: '14px 18px', fontSize: '0.88rem', textAlign: 'left' },
  footer:      { textAlign: 'center', fontSize: '0.75rem', color: '#999', marginTop: 24, lineHeight: 1.8 },
  spinner:     { textAlign: 'center', padding: '80px 24px', color: '#666', fontSize: '0.95rem' },
  notFound:    { textAlign: 'center', padding: '80px 24px', color: '#c0392b', fontSize: '0.95rem' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function FirmaPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [booking,   setBooking]   = useState(null);
  const [loadErr,   setLoadErr]   = useState(null);
  const [fetching,  setFetching]  = useState(true);

  const [checks,   setChecks]   = useState([false, false, false, false]);
  const [nome,     setNome]     = useState('');
  const [signing,  setSigning]  = useState(false);
  const [signErr,  setSignErr]  = useState(null);
  const [signed,   setSigned]   = useState(false);
  const [signedAt, setSignedAt] = useState(null);
  const termsRef = useRef(null);

  useEffect(() => {
    fetch(`/api/firma/${id}?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setLoadErr(d.error);
        else {
          setBooking(d);
          if (d.firma_at) { setSigned(true); setSignedAt(d.firma_at); setNome(d.firma_nome || ''); }
        }
      })
      .catch(e => setLoadErr(e.message))
      .finally(() => setFetching(false));
  }, [id, token]);

  const lang       = booking?.lingua || 'it';
  const t          = T[lang]     || T.it;
  const articles   = TERMS[lang] || TERMS.it;
  const allChecked = checks.every(Boolean);

  function toggleCheck(i) {
    setChecks(prev => { const n = [...prev]; n[i] = !n[i]; return n; });
    setSignErr(null);
  }

  async function handleSign() {
    if (!allChecked) { setSignErr(t.mustCheck); return; }
    if (!nome.trim()) { setSignErr(t.mustName); return; }
    setSigning(true);
    setSignErr(null);
    try {
      const res = await fetch(`/api/firma/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firma_nome: nome.trim(), token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.errGeneric);
      setSigned(true);
      setSignedAt(new Date().toISOString());
    } catch (e) {
      setSignErr(e.message);
    } finally {
      setSigning(false);
    }
  }

  // ── Loading / Error states ─────────────────────────────────────────────────

  if (fetching) return <div style={S.page}><div style={S.spinner}>🔄 {T.it.loading}</div></div>;
  if (loadErr)  return <div style={S.page}><div style={S.notFound}>⚠️ {loadErr}</div></div>;

  const b = booking;
  const alreadySigned = b.firma_at && !signedAt;

  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.header}>
        <div style={S.logo}>🚲</div>
        <h1 style={S.h1}>{t.title}</h1>
        <p style={S.hsub}>{t.subtitle}</p>
      </div>

      <div style={S.card}>

        {/* ── Success (just signed) ── */}
        {signed && (
          <div style={S.successCard}>
            <div style={S.successIcon}>✅</div>
            <h2 style={S.successH}>{t.successTitle}</h2>
            <p style={S.successP}>{t.successMsg}</p>
            <div style={S.successMeta}>
              <div style={{ marginBottom: 6 }}><strong style={{ color: '#2D8659' }}>{t.successName}</strong> {nome || b.firma_nome}</div>
              <div><strong style={{ color: '#2D8659' }}>{t.successDate}</strong> {fmtDateTime(signedAt || b.firma_at, lang)}</div>
            </div>
          </div>
        )}

        {/* ── Already signed (prior session) ── */}
        {!signed && alreadySigned && (
          <div style={S.successCard}>
            <div style={S.successIcon}>✅</div>
            <h2 style={S.successH}>{t.alreadyTitle}</h2>
            <p style={S.successP}>{t.alreadyMsg}</p>
            <div style={S.successMeta}>
              <div style={{ marginBottom: 6 }}><strong style={{ color: '#2D8659' }}>{t.signedBy}</strong> {b.firma_nome}</div>
              <div><strong style={{ color: '#2D8659' }}>{t.signedOn}</strong> {fmtDateTime(b.firma_at, lang)}</div>
            </div>
          </div>
        )}

        {/* ── Contract form ── */}
        {!signed && !alreadySigned && (
          <>
            {/* Booking Summary */}
            <p style={S.secTitle}>{t.summary}</p>
            <div style={S.summaryBox}>
              <div style={{ ...S.row, borderBottom: 'none', paddingBottom: 0 }}>
                <span style={S.rowLabel}>{t.code}</span>
                <span style={S.codeBox}>{b.id.toUpperCase().substring(0, 8)}</span>
              </div>
              <div style={{ ...S.row, marginTop: 10 }}>
                <span style={S.rowLabel}>{t.fCliente}</span>
                <span style={S.rowVal}>{b.cliente_nome}</span>
              </div>
              <div style={S.row}>
                <span style={S.rowLabel}>{t.fTipo}</span>
                <span style={S.rowVal}>{(t.types[b.tipo_noleggio] || b.tipo_noleggio) + (b.giorni > 1 ? ` · ${b.giorni} ${t.giorni}` : '')}</span>
              </div>
              <div style={S.row}>
                <span style={S.rowLabel}>{t.fRitiro}</span>
                <span style={S.rowVal}>{fmtDate(b.data_ritiro, lang)} {b.orario_ritiro?.substring(0, 5)}</span>
              </div>
              <div style={{ ...S.row, borderBottom: 'none' }}>
                <span style={S.rowLabel}>{t.fRestituzione}</span>
                <span style={S.rowVal}>{fmtDate(b.data_restituzione, lang)} {b.orario_restituzione?.substring(0, 5)}</span>
              </div>
            </div>

            <hr style={S.divider} />

            {/* Full T&C */}
            <p style={S.secTitle}>{t.termsTitle}</p>
            <div ref={termsRef} style={S.termsBox}>
              {articles.map((art, i) => (
                <div key={i}>
                  <p style={{ ...S.artTitle, marginTop: i === 0 ? 0 : 14 }}>{art.title}</p>
                  <p style={S.artText}>{art.text}</p>
                </div>
              ))}
            </div>
            <p style={S.termsHint}>{t.termsHint}</p>

            {/* Checkboxes */}
            {t.checks.map((label, i) => (
              <div key={i} style={S.checkItem} onClick={() => toggleCheck(i)}>
                <div style={{ ...S.checkbox, ...(checks[i] ? S.checkboxOn : {}) }}>
                  {checks[i] && (
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <polyline points="1.5,5.5 4,8.5 9.5,2.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span style={S.checkText} dangerouslySetInnerHTML={{ __html: label }} />
              </div>
            ))}

            <hr style={S.divider} />

            {/* Name input */}
            <div style={{ marginBottom: 16 }}>
              <label style={S.fieldLabel}>{t.nameLabel}</label>
              <input
                type="text"
                placeholder={t.namePlaceholder}
                value={nome}
                onChange={e => { setNome(e.target.value); setSignErr(null); }}
                style={S.input}
                onFocus={e => (e.target.style.borderColor = '#2D8659')}
                onBlur={e => (e.target.style.borderColor = '#d1e5d9')}
                autoComplete="name"
              />
            </div>

            {signErr && <div style={S.errBox}>⚠️ {signErr}</div>}

            <button
              style={{ ...S.signBtn, ...(!allChecked || !nome.trim() || signing ? S.signBtnDis : {}) }}
              onClick={handleSign}
              disabled={!allChecked || !nome.trim() || signing}
            >
              {signing ? t.signing : `✍️  ${t.signBtn}`}
            </button>
          </>
        )}

        {/* Footer */}
        <div style={S.footer}>
          📍 {t.location}<br />
          Arfanta Bike Rental · Colline del Prosecco di Conegliano e Valdobbiadene — UNESCO<br />
          <a href="mailto:arfantabikerental@gmail.com" style={{ color: '#2D8659' }}>arfantabikerental@gmail.com</a>
        </div>
      </div>
    </div>
  );
}

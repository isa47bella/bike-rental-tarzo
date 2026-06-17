import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

// ─── Contenuti contratto (5 lingue) — allineati a backend/lib/contratto-terms.js ──
// Struttura per lingua: { intro, conditions[], rulesTitle, rules[], privacy }

const TERMS = {
  it: {
    intro: `Le condizioni di noleggio elencate di seguito sono parte integrante del presente contratto.`,
    conditions: [
      `Il locatario si assume la piena responsabilità dell'oggetto o degli oggetti che prende in noleggio, dichiarando di essere idoneo e capace di usarlo, senza creare rischi per sé stesso né per terzi.`,
      `Il locatario dichiara di ritirare il materiale noleggiato in perfetto stato di funzionamento e manutenzione, assumendosi la piena responsabilità dei rischi durante l'uso.`,
      `Durante l'uso delle bici e accessori, il locatario deve sempre attenersi al codice stradale e rispettare le norme di sicurezza; in caso di sosta chiudere la bici con apposito lucchetto o tenerla sempre nelle vicinanze e a vista per evitare possibili furti o manomissioni.`,
      `Il materiale non è assicurato; in caso di furto il locatario deve sporgere regolare denuncia presso le forze dell'ordine competenti. In caso di smarrimento o danni vandalici il locatario si impegna a darne avviso e a corrispondere entro la giornata il valore dell'oggetto o degli oggetti interessati, ovvero dei danni subiti, secondo il valore di mercato.`,
      `In caso di uso inadeguato o danneggiamento del materiale noleggiato, il ripristino sarà addebitato al locatario secondo il valore e il listino in vigore, oltre al costo della manodopera.`,
      `Al momento del ritiro viene pre-autorizzata sulla carta di credito una cauzione di 500 € a garanzia del mezzo e degli accessori; tale importo viene rilasciato alla restituzione del materiale in assenza di danni. In caso di danni, furto o smarrimento, l'importo necessario al ripristino o alla sostituzione potrà essere trattenuto fino al valore della cauzione, fermo restando quanto stabilito ai punti precedenti.`,
      `La sostituzione del materiale con altro di pari valore durante il noleggio sarà sempre possibile.`,
      `La presente esclusione di responsabilità civile e penale comprende in particolare i diritti al risarcimento dei danni a persone o cose derivanti sia da colpa che da messa in pericolo, indipendentemente dal relativo titolo giuridico.`,
      `Il presente contratto deve essere esclusivamente accettato e firmato da persona maggiorenne, anche in nome e per conto di più persone o di un gruppo, assumendosi la responsabilità di tutte le clausole del contratto ed esibendo un documento di identità valido.`,
      `Le riconsegne del materiale noleggiato devono avvenire nel posto accordato entro l'orario di chiusura; in caso di ritardo avvisare per tempo telefonicamente il gestore del punto di riconsegna.`,
      `La risoluzione anticipata del contratto di noleggio è possibile mediante la restituzione del materiale senza pretese di rimborso da parte del locatario; i rimborsi si effettuano esclusivamente in caso di malattia e/o infortunio mediante l'esibizione di certificato medico.`,
    ],
    rulesTitle: `Regole di buon comportamento e utilizzo delle bici`,
    rules: [
      `Rispettare il codice stradale e i sensi di marcia, rispettando i pedoni e tutti i mezzi in circolazione.`,
      `Rispettare gli abitanti, la natura e gli animali; non percorrere strade o sentieri vietati alle bici.`,
      `Usare sempre il casco di protezione adeguato e a norma.`,
      `Controllare sempre il materiale noleggiato prima di partire.`,
    ],
    privacy: `Dichiaro di aver letto e compreso l'informativa sul trattamento dei miei dati personali in conformità agli artt. 13 e 14 del Regolamento Europeo 679/2016 e del Codice della Privacy novellato dal D.lgs. 101/2018. Il locatario autorizza l'uso dei propri dati personali per uso statistico; eventuali comunicazioni commerciali verranno inviate in ottemperanza a quanto previsto dall'Art. 6 Comma 1 lettera f) e dal correlato Considerando 47 del GDPR. Mediante la firma accetto tutte le condizioni e il materiale di noleggio elencato.`,
  },
  en: {
    intro: `The rental terms listed below are an integral part of this agreement.`,
    conditions: [
      `The hirer takes full responsibility for the rental item(s), declaring that they are fit and able to use them, without creating any risk to themselves or to third parties.`,
      `The hirer acknowledges that they receive the rented equipment in perfect working order and properly maintained, assuming full responsibility for the risks during its use.`,
      `When using the bikes and accessories, the hirer must at all times comply with the rules of the road and observe the safety regulations; when stopping, lock the bike with a suitable lock or keep it within sight and close at hand to prevent possible theft or tampering.`,
      `The equipment is not insured; in the event of theft, the hirer must file a formal report with the competent law-enforcement authorities. In the event of loss or vandalism, the hirer undertakes to report the matter and to pay, within the same day, for the item(s) concerned or the damage incurred, at market value.`,
      `In the event of inadequate use or damage to the rented equipment, restoration will be charged to the hirer based on the value and the price list in force, plus labour costs.`,
      `At pickup, a security deposit of €500 is pre-authorised on the credit card to guarantee the vehicle and accessories; this amount is released upon return of the equipment without damage. In the event of damage, theft or loss, the amount required for repair or replacement may be withheld up to the value of the deposit, without prejudice to the preceding clauses.`,
      `During the rental period, the equipment may at any time be replaced with another item of equal value.`,
      `This exclusion of civil and criminal liability includes in particular the rights to compensation for damage to persons or property arising from both fault and endangerment, irrespective of their legal basis.`,
      `This contract must be accepted and signed exclusively by an adult, including on behalf of several persons or a group, thereby accepting responsibility for all the terms of the contract and presenting a valid identity document.`,
      `The rented equipment must be returned at the agreed location within the closing time; in the event of delay, notify the operator of the return point in good time by telephone.`,
      `Early termination of the rental agreement is possible by returning the equipment, with no claim to a refund by the hirer; refunds are made exclusively in the event of illness and/or injury upon presentation of a medical certificate.`,
    ],
    rulesTitle: `Rules of good behaviour and use of the bikes`,
    rules: [
      `Obey the rules of the road and the direction of traffic, showing consideration for pedestrians and all other road users.`,
      `Respect the inhabitants, nature and animals; do not travel on roads or paths prohibited to bikes.`,
      `Always use an appropriate and standard-compliant protective helmet.`,
      `Always check the rented equipment before you leave.`,
    ],
    privacy: `I declare that I have read and understood the information on the processing of my personal data in accordance with arts. 13 and 14 of European Regulation 679/2016 and the Italian Privacy Code as amended by Legislative Decree 101/2018. The hirer authorises the use of their personal data for statistical purposes; any commercial communications will be sent in compliance with the provisions of Art. 6 Paragraph 1 letter f) and the related Recital 47 of the GDPR. By signing, I accept all the conditions and acknowledge the rental equipment listed above.`,
  },
  de: {
    intro: `Die nachstehend aufgeführten Mietbedingungen sind integraler Bestandteil dieser Vereinbarung.`,
    conditions: [
      `Der Mieter übernimmt die volle Verantwortung für den/die Mietgegenstand(e) und erklärt, dass er körperlich geeignet und in der Lage ist, ihn zu nutzen, ohne sich selbst oder Dritte zu gefährden.`,
      `Der Mieter erklärt, das gemietete Material in einwandfreiem Betriebs- und Wartungszustand entgegenzunehmen und dabei die volle Verantwortung für die Risiken bei der Nutzung zu tragen.`,
      `Bei der Nutzung von Fahrrädern und Zubehör muss der Mieter stets die Straßenverkehrsordnung einhalten und die Sicherheitsvorschriften beachten; bei einer Pause das Fahrrad mit einem geeigneten Schloss abschließen bzw. anschließen oder es stets in der Nähe und in Sichtweite halten, um möglichem Diebstahl oder Manipulationen vorzubeugen.`,
      `Das Material ist nicht versichert; im Falle eines Diebstahls muss der Mieter ordnungsgemäß Anzeige bei den zuständigen Behörden erstatten. Im Falle von Verlust oder Vandalismus verpflichtet sich der Mieter, den betreffenden Gegenstand bzw. den entstandenen Schaden noch am selben Tag zu melden und entsprechend dem Marktwert zu bezahlen.`,
      `Bei unsachgemäßer Nutzung oder Beschädigung des Mietmaterials werden die Wiederherstellungskosten dem Mieter nach dem geltenden Wert und der geltenden Preisliste, zuzüglich der Arbeitskosten, in Rechnung gestellt.`,
      `Bei der Abholung wird eine Kaution von 500 € auf der Kreditkarte vorautorisiert, um das Fahrzeug und das Zubehör abzusichern; dieser Betrag wird bei schadenfreier Rückgabe des Materials freigegeben. Im Falle von Schäden, Diebstahl oder Verlust kann der für die Reparatur oder den Ersatz erforderliche Betrag bis zur Höhe der Kaution einbehalten werden, unbeschadet der vorstehenden Punkte.`,
      `Der Austausch des Materials gegen ein gleichwertiges ist während der Anmietung jederzeit möglich.`,
      `Der vereinbarte Ausschluss der zivil- und strafrechtlichen Haftung des Vermieters umfasst insbesondere Schadensersatzansprüche wegen Personen- und Sachschäden, die sowohl aus Verschulden als auch aus Gefährdung entstehen, unabhängig von ihrer rechtlichen Ursache.`,
      `Dieser Vertrag darf ausschließlich von einer volljährigen Person akzeptiert und unterzeichnet werden, auch im Namen mehrerer Personen oder einer Gruppe; die unterzeichnende Person übernimmt dabei die Verantwortung für alle Punkte des Vertrages und legt einen gültigen Ausweis vor.`,
      `Die Rückgabe des gemieteten Materials muss am vereinbarten Ort innerhalb der Schließzeit erfolgen; im Falle einer Verspätung den Betreiber des Rückgabepunkts rechtzeitig telefonisch benachrichtigen.`,
      `Die vorzeitige Beendigung des Mietvertrages ist durch Rückgabe des Materials ohne Erstattungsanspruch des Mieters möglich; Erstattungen erfolgen ausschließlich bei Krankheit und/oder Verletzung gegen Vorlage eines ärztlichen Attests.`,
    ],
    rulesTitle: `Regeln für gutes Verhalten und Nutzung der Fahrräder`,
    rules: [
      `Die Straßenverkehrsordnung und die vorgeschriebene Fahrtrichtung beachten, unter Rücksichtnahme auf Fußgänger und alle anderen Verkehrsteilnehmer.`,
      `Die Einwohner, die Natur und die Tiere respektieren; keine für Fahrräder gesperrten Straßen oder Wege befahren.`,
      `Stets einen geeigneten und normgerechten Schutzhelm tragen.`,
      `Das gemietete Material stets vor der Abfahrt überprüfen.`,
    ],
    privacy: `Hiermit erkläre ich, dass ich die Datenschutzinformation zur Verarbeitung meiner personenbezogenen Daten gemäß Art. 13 und 14 der Europäischen Verordnung 679/2016 und des italienischen Datenschutzkodex in der durch das Gesetzesdekret 101/2018 geänderten Fassung gelesen und verstanden habe. Der Mieter willigt in die Verwendung seiner personenbezogenen Daten zu statistischen Zwecken ein; etwaige kommerzielle Mitteilungen werden unter Beachtung der Bestimmungen von Art. 6 Abs. 1 Buchstabe f) und dem damit verbundenen Erwägungsgrund 47 der DS-GVO versandt. Mit der Unterzeichnung akzeptiere ich alle Bedingungen und das aufgeführte Mietmaterial.`,
  },
  es: {
    intro: `Las condiciones de alquiler que se enumeran a continuación son parte integrante del presente contrato.`,
    conditions: [
      `El arrendatario asume la plena responsabilidad del/de los objeto(s) que toma en alquiler, declarando ser idóneo y capaz de usarlo(s), sin crear riesgos para sí mismo ni para terceros.`,
      `El arrendatario declara recibir el material alquilado en perfecto estado de funcionamiento y mantenimiento, asumiendo la plena responsabilidad de los riesgos durante el uso del mismo.`,
      `Durante el uso de las bicicletas y los accesorios, el arrendatario debe atenerse siempre al código de circulación y respetar las normas de seguridad; en caso de parada, cerrar la bicicleta con el candado correspondiente o mantenerla siempre cerca y a la vista para evitar posibles robos o manipulaciones.`,
      `El material no está asegurado; en caso de robo el arrendatario debe presentar la correspondiente denuncia ante las fuerzas del orden competentes. En caso de pérdida o daños por vandalismo, el arrendatario se compromete a avisar y pagar dentro del mismo día el/los objeto(s) en cuestión, o los daños ocurridos, según el valor de mercado.`,
      `En caso de uso inadecuado o daño del material alquilado, la reparación se cargará al arrendatario según el valor y la lista de precios vigente, más el coste de la mano de obra.`,
      `En el momento de la recogida se preautoriza en la tarjeta de crédito una fianza de 500 € como garantía del vehículo y los accesorios; dicho importe se liberará tras la devolución del material sin daños. En caso de daños, robo o pérdida, el importe necesario para la reparación o sustitución podrá retenerse hasta el valor de la fianza, sin perjuicio de lo establecido en los puntos anteriores.`,
      `La sustitución del material por otro de igual valor durante el alquiler será siempre posible.`,
      `La presente exclusión de responsabilidad civil y penal comprende en particular los derechos de indemnización por daños a personas o cosas derivados tanto de culpa como de puesta en peligro, independientemente de su título jurídico.`,
      `El presente contrato debe ser aceptado y firmado exclusivamente por una persona mayor de edad, también en nombre de varias personas o de un grupo, haciéndose responsable de todos los puntos del contrato y exhibiendo un documento de identidad válido.`,
      `Las devoluciones del material alquilado deben realizarse en el lugar acordado dentro del horario de cierre; en caso de retraso, avisar con tiempo telefónicamente al gestor del punto de devolución.`,
      `La resolución anticipada del contrato de alquiler es posible mediante la devolución del material sin derecho a reembolso por parte del arrendatario; los reembolsos se efectúan exclusivamente en caso de enfermedad y/o accidente mediante la presentación de un certificado médico.`,
    ],
    rulesTitle: `Reglas de buen comportamiento y uso de las bicicletas`,
    rules: [
      `Respetar el código de circulación y los sentidos de marcha, respetando a los peatones y a todos los vehículos en circulación.`,
      `Respetar a los habitantes, la naturaleza y los animales; no recorrer carreteras o senderos prohibidos a las bicicletas.`,
      `Usar siempre el casco de protección adecuado y homologado.`,
      `Controlar siempre el material alquilado antes de partir.`,
    ],
    privacy: `Declaro haber leído y comprendido la información sobre el tratamiento de mis datos personales de conformidad con los arts. 13 y 14 del Reglamento Europeo 679/2016 y del Código de Privacidad italiano modificado por el D.lgs. 101/2018. Autorizo el uso de mis datos personales con fines estadísticos; las eventuales comunicaciones comerciales se enviarán de conformidad con lo previsto en el Art. 6, apartado 1, letra f) y el correspondiente Considerando 47 del RGPD. Mediante la firma acepto todas las condiciones y el material de alquiler enumerado.`,
  },
  fr: {
    intro: `Les conditions de location énumérées ci-dessous font partie intégrante du présent contrat.`,
    conditions: [
      `Le locataire assume l'entière responsabilité du/des objet(s) qu'il prend en location, déclarant être apte et capable de l'utiliser, sans créer de risque pour lui-même ni pour les tiers.`,
      `Le locataire déclare retirer le matériel loué en parfait état de fonctionnement et d'entretien, en assumant l'entière responsabilité des risques pendant son utilisation.`,
      `Lors de l'utilisation des vélos et des accessoires, le locataire doit toujours respecter le code de la route et les règles de sécurité ; en cas d'arrêt, attacher le vélo avec un antivol approprié ou le garder toujours à proximité et en vue afin d'éviter d'éventuels vols ou actes de malveillance.`,
      `Le matériel n'est pas assuré ; en cas de vol, le locataire doit déposer une plainte régulière auprès des forces de l'ordre compétentes. En cas de perte ou de dommages dus au vandalisme, le locataire s'engage à déclarer le sinistre et à régler dans la journée la valeur du/des objet(s) concerné(s), ou des dommages survenus, selon la valeur de marché.`,
      `En cas d'utilisation inappropriée ou de détérioration du matériel loué, la remise en état sera facturée au locataire selon la valeur et le tarif en vigueur, majorés du coût de la main-d'œuvre.`,
      `Au moment de la prise en charge, une caution de 500 € est pré-autorisée sur la carte de crédit pour garantir le vélo et les accessoires ; ce montant est libéré lors de la restitution du matériel, en l'absence de dommage. En cas de dommage, vol ou perte, le montant nécessaire à la réparation ou au remplacement pourra être retenu à hauteur de la valeur de la caution, sans préjudice des points précédents.`,
      `Le remplacement du matériel par un autre de valeur équivalente pendant la location sera toujours possible.`,
      `La présente exclusion de responsabilité civile et pénale comprend en particulier les droits à l'indemnisation des dommages aux personnes ou aux biens résultant aussi bien d'une faute que d'une mise en danger, indépendamment de leur fondement juridique.`,
      `Le présent contrat doit être accepté et signé exclusivement par une personne majeure, également au nom de plusieurs personnes ou d'un groupe, assumant la responsabilité de l'ensemble des clauses du contrat et présentant une pièce d'identité valide.`,
      `La restitution du matériel loué doit s'effectuer à l'endroit convenu avant l'heure de fermeture ; en cas de retard, prévenir à temps par téléphone le gestionnaire du point de restitution.`,
      `La résiliation anticipée du contrat de location est possible par la restitution du matériel, sans que le locataire puisse prétendre à un quelconque remboursement ; les remboursements sont effectués exclusivement pour maladie et/ou accident sur présentation d'un certificat médical.`,
    ],
    rulesTitle: `Règles de bon comportement et d'utilisation des vélos`,
    rules: [
      `Respecter le code de la route et les sens de circulation, en respectant les piétons et tous les véhicules en circulation.`,
      `Respecter les habitants, la nature et les animaux ; ne pas emprunter de routes ou de sentiers interdits aux vélos.`,
      `Toujours porter un casque de protection adéquat et conforme aux normes.`,
      `Toujours vérifier le matériel loué avant de partir.`,
    ],
    privacy: `Je déclare avoir lu et compris les informations relatives au traitement de mes données personnelles conformément aux art. 13 et 14 du règlement européen 679/2016 et du Code italien de la protection des données personnelles, modifié par le décret législatif n° 101/2018. Le locataire autorise l'utilisation de ses données personnelles à des fins statistiques ; les éventuelles communications commerciales seront envoyées conformément aux dispositions de l'art. 6, paragraphe 1, point f) et du considérant 47 du RGPD. En signant, j'accepte toutes les conditions et le matériel de location énuméré.`,
  },
};

// ─── Traduzioni UI ────────────────────────────────────────────────────────────

const T = {
  it: {
    kicker: 'Documento da firmare', title: 'Contratto di Noleggio', subtitle: 'E-bike — Arfanta Bike Rental',
    summary: 'Riepilogo prenotazione', code: 'Codice',
    fCliente: 'Cliente', fTipo: 'Tipo noleggio', fRitiro: 'Ritiro', fRestituzione: 'Restituzione', fPrezzo: 'Importo pagato',
    types: { mezza_mattina: 'Mezza Giornata Mattina (09:00–13:00)', mezza_pomeriggio: 'Mezza Giornata Pomeriggio (14:00–18:00)', intera_giornata: 'Giornata Intera (09:00–18:00)', multi_giorno: 'Multi-Giorno' },
    termsTitle: 'Condizioni di noleggio', privacyTitle: 'Informativa privacy',
    termsHint: 'Scorri per leggere tutto il contratto prima di firmare',
    checks: [
      'Ho letto e accetto integralmente le <strong>Condizioni di Noleggio</strong> sopra riportate.',
      'Mi impegno a restituire il materiale in perfette condizioni <strong>entro l\'orario concordato</strong>.',
      'Sono consapevole della mia <strong>responsabilità per danni e furto</strong> e della <strong>cauzione di €500</strong>.',
      'Acconsento al <strong>trattamento dei miei dati personali</strong> secondo l\'informativa privacy.',
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
  },
  en: {
    kicker: 'Document to sign', title: 'Rental Agreement', subtitle: 'E-bike — Arfanta Bike Rental',
    summary: 'Booking summary', code: 'Code',
    fCliente: 'Customer', fTipo: 'Rental type', fRitiro: 'Pickup', fRestituzione: 'Return', fPrezzo: 'Amount paid',
    types: { mezza_mattina: 'Half Day Morning (09:00–13:00)', mezza_pomeriggio: 'Half Day Afternoon (14:00–18:00)', intera_giornata: 'Full Day (09:00–18:00)', multi_giorno: 'Multi-Day' },
    termsTitle: 'Rental terms', privacyTitle: 'Privacy notice',
    termsHint: 'Scroll to read the whole agreement before signing',
    checks: [
      'I have read and fully accept the <strong>Rental Terms</strong> above.',
      'I commit to returning the material in perfect condition <strong>by the agreed return time</strong>.',
      'I acknowledge my <strong>liability for damage and theft</strong> and the <strong>€500 security deposit</strong>.',
      'I consent to the <strong>processing of my personal data</strong> as described in the privacy notice.',
    ],
    nameLabel: 'Your full name', namePlaceholder: 'E.g. John Smith',
    signBtn: 'Sign the Agreement', signing: 'Signing…',
    mustCheck: 'Please accept all terms to proceed.', mustName: 'Please enter your full name before signing.',
    successTitle: 'Agreement Signed!', successMsg: 'Thank you, the agreement has been successfully signed. You may close this page.',
    successDate: 'Date and time signed:', successName: 'Signed by:',
    alreadyTitle: 'Agreement already signed', alreadyMsg: 'This agreement has already been signed. No further action is required.',
    signedBy: 'Signed by:', signedOn: 'Date signed:',
    loading: 'Loading…', notFound: 'Booking not found or not yet confirmed.', errGeneric: 'An error occurred. Please try again.',
    location: 'Via Pecol 22, Arfanta di Tarzo (TV) — Italy', giorni: 'days',
  },
  de: {
    kicker: 'Zu unterzeichnendes Dokument', title: 'Mietvertrag', subtitle: 'E-Bike — Arfanta Bike Rental',
    summary: 'Buchungsübersicht', code: 'Code',
    fCliente: 'Kunde', fTipo: 'Mietart', fRitiro: 'Abholung', fRestituzione: 'Rückgabe', fPrezzo: 'Bezahlter Betrag',
    types: { mezza_mattina: 'Halbtag Vormittag (09:00–13:00)', mezza_pomeriggio: 'Halbtag Nachmittag (14:00–18:00)', intera_giornata: 'Ganztag (09:00–18:00)', multi_giorno: 'Mehrtägig' },
    termsTitle: 'Mietbedingungen', privacyTitle: 'Datenschutzhinweis',
    termsHint: 'Scrollen Sie, um den gesamten Vertrag vor der Unterschrift zu lesen',
    checks: [
      'Ich habe die <strong>Mietbedingungen</strong> vollständig gelesen und akzeptiere sie.',
      'Ich verpflichte mich, das Material in einwandfreiem Zustand <strong>bis zur vereinbarten Rückgabezeit</strong> zurückzugeben.',
      'Ich bin mir meiner <strong>Haftung für Schäden und Diebstahl</strong> und der <strong>Kaution von €500</strong> bewusst.',
      'Ich stimme der <strong>Verarbeitung meiner personenbezogenen Daten</strong> gemäß dem Datenschutzhinweis zu.',
    ],
    nameLabel: 'Ihr vollständiger Name', namePlaceholder: 'z.B. Max Mustermann',
    signBtn: 'Vertrag unterzeichnen', signing: 'Unterschrift läuft…',
    mustCheck: 'Bitte akzeptieren Sie alle Punkte.', mustName: 'Bitte geben Sie Ihren vollständigen Namen ein.',
    successTitle: 'Vertrag unterzeichnet!', successMsg: 'Vielen Dank, der Vertrag wurde erfolgreich unterzeichnet. Sie können diese Seite schließen.',
    successDate: 'Datum und Uhrzeit:', successName: 'Unterzeichnet von:',
    alreadyTitle: 'Vertrag bereits unterzeichnet', alreadyMsg: 'Dieser Vertrag wurde bereits unterzeichnet.',
    signedBy: 'Unterzeichnet von:', signedOn: 'Datum:',
    loading: 'Laden…', notFound: 'Buchung nicht gefunden oder noch nicht bestätigt.', errGeneric: 'Ein Fehler ist aufgetreten.',
    location: 'Via Pecol 22, Arfanta di Tarzo (TV) — Italien', giorni: 'Tage',
  },
  es: {
    kicker: 'Documento a firmar', title: 'Contrato de Alquiler', subtitle: 'E-bike — Arfanta Bike Rental',
    summary: 'Resumen de la reserva', code: 'Código',
    fCliente: 'Cliente', fTipo: 'Tipo de alquiler', fRitiro: 'Recogida', fRestituzione: 'Devolución', fPrezzo: 'Importe pagado',
    types: { mezza_mattina: 'Medio Día Mañana (09:00–13:00)', mezza_pomeriggio: 'Medio Día Tarde (14:00–18:00)', intera_giornata: 'Día Completo (09:00–18:00)', multi_giorno: 'Varios Días' },
    termsTitle: 'Condiciones de alquiler', privacyTitle: 'Información de privacidad',
    termsHint: 'Desplácese para leer todo el contrato antes de firmar',
    checks: [
      'He leído y acepto íntegramente las <strong>Condiciones de Alquiler</strong> anteriores.',
      'Me comprometo a devolver el material en perfectas condiciones <strong>antes del horario acordado</strong>.',
      'Soy consciente de mi <strong>responsabilidad por daños y robo</strong> y de la <strong>fianza de €500</strong>.',
      'Consiento el <strong>tratamiento de mis datos personales</strong> según la información de privacidad.',
    ],
    nameLabel: 'Su nombre completo', namePlaceholder: 'Ej. Juan García',
    signBtn: 'Firmar el Contrato', signing: 'Firmando…',
    mustCheck: 'Acepte todos los puntos para continuar.', mustName: 'Introduzca su nombre completo.',
    successTitle: '¡Contrato Firmado!', successMsg: 'Gracias, el contrato ha sido firmado correctamente. Puede cerrar esta página.',
    successDate: 'Fecha y hora:', successName: 'Firmado por:',
    alreadyTitle: 'Contrato ya firmado', alreadyMsg: 'Este contrato ya ha sido firmado.',
    signedBy: 'Firmado por:', signedOn: 'Fecha:',
    loading: 'Cargando…', notFound: 'Reserva no encontrada o aún no confirmada.', errGeneric: 'Se ha producido un error.',
    location: 'Via Pecol 22, Arfanta di Tarzo (TV) — Italia', giorni: 'días',
  },
  fr: {
    kicker: 'Document à signer', title: 'Contrat de Location', subtitle: 'E-bike — Arfanta Bike Rental',
    summary: 'Récapitulatif de réservation', code: 'Code',
    fCliente: 'Client', fTipo: 'Type de location', fRitiro: 'Prise en charge', fRestituzione: 'Retour', fPrezzo: 'Montant payé',
    types: { mezza_mattina: 'Demi-Journée Matin (09h00–13h00)', mezza_pomeriggio: 'Demi-Journée Après-midi (14h00–18h00)', intera_giornata: 'Journée Complète (09h00–18h00)', multi_giorno: 'Plusieurs Jours' },
    termsTitle: 'Conditions de location', privacyTitle: 'Informations sur la confidentialité',
    termsHint: 'Faites défiler pour lire tout le contrat avant de signer',
    checks: [
      'J\'ai lu et j\'accepte intégralement les <strong>Conditions de Location</strong> ci-dessus.',
      'Je m\'engage à restituer le matériel en parfait état <strong>avant l\'heure de retour convenue</strong>.',
      'Je reconnais ma <strong>responsabilité en cas de dommages et de vol</strong> et la <strong>caution de €500</strong>.',
      'Je consens au <strong>traitement de mes données personnelles</strong> selon les informations sur la confidentialité.',
    ],
    nameLabel: 'Votre nom complet', namePlaceholder: 'Ex. Jean Dupont',
    signBtn: 'Signer le Contrat', signing: 'Signature en cours…',
    mustCheck: 'Veuillez accepter tous les points pour continuer.', mustName: 'Veuillez entrer votre nom complet.',
    successTitle: 'Contrat Signé !', successMsg: 'Merci, le contrat a été signé avec succès. Vous pouvez fermer cette page.',
    successDate: 'Date et heure :', successName: 'Signé par :',
    alreadyTitle: 'Contrat déjà signé', alreadyMsg: 'Ce contrat a déjà été signé.',
    signedBy: 'Signé par :', signedOn: 'Date :',
    loading: 'Chargement…', notFound: 'Réservation introuvable ou pas encore confirmée.', errGeneric: 'Une erreur s\'est produite.',
    location: 'Via Pecol 22, Arfanta di Tarzo (TV) — France', giorni: 'jours',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LOCALE_MAP = { it: 'it-IT', en: 'en-GB', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' };
const GREEN = '#1f7a4d';

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

// ─── Styles (design "Premium Moderno") ─────────────────────────────────────────

const S = {
  page:        { minHeight: '100vh', background: '#eef0ed', fontFamily: "'Helvetica Neue', Arial, sans-serif", padding: '0 0 60px', color: '#1c1f1d' },
  header:      { background: '#fff', padding: '30px 24px 26px', textAlign: 'center', borderBottom: '1px solid #e7eae6' },
  logo:        { height: 56, width: 'auto', marginBottom: 12 },
  kicker:      { fontSize: '0.6rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: GREEN, fontWeight: 700, marginBottom: 8 },
  h1:          { margin: '0 0 4px', fontFamily: 'Georgia, serif', fontSize: '1.8rem', fontWeight: 400, color: '#1c1f1d', letterSpacing: '-0.01em' },
  hsub:        { margin: 0, fontSize: '0.82rem', color: '#8b908b' },
  card:        { background: '#fff', borderRadius: 14, boxShadow: '0 4px 22px rgba(0,0,0,.07)', maxWidth: 640, margin: '24px auto 0', padding: '30px 28px 26px' },
  secTitle:    { fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: GREEN, marginBottom: 14, marginTop: 0 },
  grid:        { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#ededed', border: '1px solid #ededed', borderRadius: 8, overflow: 'hidden', marginBottom: 24 },
  cell:        { background: '#fff', padding: '12px 14px' },
  cellK:       { fontSize: '0.56rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8b908b', marginBottom: 4 },
  cellV:       { fontSize: '0.9rem', fontWeight: 600, color: '#1c1f1d' },
  codeV:       { fontFamily: "'Courier New', monospace", letterSpacing: '0.1em', color: GREEN, fontWeight: 700 },
  termsBox:    { border: '1px solid #e6eae6', borderRadius: 10, maxHeight: 300, overflowY: 'auto', background: '#fbfcfb', marginBottom: 8, padding: '18px 20px' },
  intro:       { fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '0.92rem', color: '#55605a', margin: '0 0 14px', lineHeight: 1.55 },
  condItem:    { display: 'flex', gap: 14, padding: '11px 0', borderTop: '1px solid #eef0ee' },
  condNum:     { fontFamily: 'Georgia, serif', fontSize: '1.2rem', color: '#cdd9d1', minWidth: 28, lineHeight: 1.2 },
  condText:    { fontFamily: 'Georgia, serif', fontSize: '0.86rem', lineHeight: 1.6, color: '#33392f' },
  subTitle:    { fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: GREEN, margin: '22px 0 10px' },
  rulesBox:    { borderLeft: `3px solid ${GREEN}`, background: '#f4faf6', borderRadius: '0 8px 8px 0', padding: '10px 16px' },
  ruleItem:    { fontFamily: 'Georgia, serif', fontSize: '0.86rem', color: '#33392f', padding: '5px 0 5px 20px', position: 'relative', lineHeight: 1.5 },
  ruleDot:     { position: 'absolute', left: 0, top: 9, width: 6, height: 6, border: `1.5px solid ${GREEN}`, borderRadius: '50%' },
  privacy:     { fontSize: '0.74rem', lineHeight: 1.6, color: '#7c827c', margin: '4px 0 0' },
  termsHint:   { textAlign: 'center', fontSize: '0.72rem', color: GREEN, marginBottom: 18, opacity: 0.85 },
  checkItem:   { display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12, cursor: 'pointer' },
  checkbox:    { width: 20, height: 20, minWidth: 20, borderRadius: 4, border: '2px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', marginTop: 1, background: '#fff' },
  checkboxOn:  { background: GREEN, borderColor: GREEN },
  checkText:   { fontSize: '0.86rem', color: '#333', lineHeight: 1.55 },
  divider:     { border: 'none', borderTop: '1px solid #eef0ee', margin: '20px 0' },
  fieldLabel:  { display: 'block', fontSize: '0.64rem', fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 7 },
  input:       { width: '100%', padding: '13px 14px', border: '1.5px solid #d8e0da', borderRadius: 9, fontSize: '1rem', outline: 'none', boxSizing: 'border-box', transition: 'border .15s', fontFamily: 'inherit' },
  errBox:      { background: '#fff0f0', border: '1px solid #ffaaaa', borderRadius: 8, padding: '10px 14px', fontSize: '0.88rem', color: '#c0392b', marginBottom: 14 },
  signBtn:     { width: '100%', padding: '15px', background: GREEN, color: '#fff', border: 'none', borderRadius: 11, fontSize: '1.02rem', fontWeight: 700, cursor: 'pointer', transition: 'background .15s', marginTop: 6, letterSpacing: '0.02em' },
  signBtnDis:  { background: '#9bbcab', cursor: 'not-allowed' },
  successCard: { textAlign: 'center', padding: '20px 0 4px' },
  successIcon: { fontSize: 54, marginBottom: 12 },
  successH:    { fontFamily: 'Georgia, serif', fontSize: '1.5rem', fontWeight: 400, color: GREEN, margin: '0 0 8px' },
  successP:    { color: '#555', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 20px' },
  successMeta: { background: '#f4faf6', borderRadius: 8, padding: '14px 18px', fontSize: '0.88rem', textAlign: 'left' },
  footer:      { textAlign: 'center', fontSize: '0.72rem', color: '#9a9f99', marginTop: 24, lineHeight: 1.8 },
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
  const terms      = TERMS[lang] || TERMS.it;
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
        <img src="/logo.png" alt="Arfanta Bike Rental" style={S.logo} />
        <div style={S.kicker}>{t.kicker}</div>
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
              <div style={{ marginBottom: 6 }}><strong style={{ color: GREEN }}>{t.successName}</strong> {nome || b.firma_nome}</div>
              <div><strong style={{ color: GREEN }}>{t.successDate}</strong> {fmtDateTime(signedAt || b.firma_at, lang)}</div>
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
              <div style={{ marginBottom: 6 }}><strong style={{ color: GREEN }}>{t.signedBy}</strong> {b.firma_nome}</div>
              <div><strong style={{ color: GREEN }}>{t.signedOn}</strong> {fmtDateTime(b.firma_at, lang)}</div>
            </div>
          </div>
        )}

        {/* ── Contract form ── */}
        {!signed && !alreadySigned && (
          <>
            {/* Booking Summary */}
            <p style={S.secTitle}>{t.summary}</p>
            <div style={S.grid}>
              <div style={S.cell}><div style={S.cellK}>{t.code}</div><div style={{ ...S.cellV, ...S.codeV }}>{b.id.toUpperCase().substring(0, 8)}</div></div>
              <div style={S.cell}><div style={S.cellK}>{t.fCliente}</div><div style={S.cellV}>{b.cliente_nome}</div></div>
              <div style={S.cell}><div style={S.cellK}>{t.fTipo}</div><div style={S.cellV}>{(t.types[b.tipo_noleggio] || b.tipo_noleggio) + (b.giorni > 1 ? ` · ${b.giorni} ${t.giorni}` : '')}</div></div>
              <div style={S.cell}><div style={S.cellK}>{t.fPrezzo}</div><div style={S.cellV}>€{Number(b.prezzo_totale || 0).toFixed(2)}</div></div>
              <div style={S.cell}><div style={S.cellK}>{t.fRitiro}</div><div style={S.cellV}>{fmtDate(b.data_ritiro, lang)} · {b.orario_ritiro?.substring(0, 5)}</div></div>
              <div style={S.cell}><div style={S.cellK}>{t.fRestituzione}</div><div style={S.cellV}>{fmtDate(b.data_restituzione, lang)} · {b.orario_restituzione?.substring(0, 5)}</div></div>
            </div>

            {/* Full contract */}
            <p style={S.secTitle}>{t.termsTitle}</p>
            <div ref={termsRef} style={S.termsBox}>
              <p style={S.intro}>{terms.intro}</p>
              {terms.conditions.map((c, i) => (
                <div key={i} style={{ ...S.condItem, ...(i === 0 ? { borderTop: 'none', paddingTop: 0 } : {}) }}>
                  <span style={S.condNum}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={S.condText}>{c}</span>
                </div>
              ))}

              <p style={S.subTitle}>{terms.rulesTitle}</p>
              <div style={S.rulesBox}>
                {terms.rules.map((r, i) => (
                  <div key={i} style={S.ruleItem}><span style={S.ruleDot} />{r}</div>
                ))}
              </div>

              <p style={S.subTitle}>{t.privacyTitle}</p>
              <p style={S.privacy}>{terms.privacy}</p>
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
                onFocus={e => (e.target.style.borderColor = GREEN)}
                onBlur={e => (e.target.style.borderColor = '#d8e0da')}
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
          <a href="mailto:arfantabikerental@gmail.com" style={{ color: GREEN }}>arfantabikerental@gmail.com</a>
        </div>
      </div>
    </div>
  );
}

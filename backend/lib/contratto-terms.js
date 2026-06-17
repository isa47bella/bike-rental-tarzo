// Contenuti contratto noleggio Arfanta — 5 lingue (it/en/de/es/fr)
// Testo ufficiale dal documento del cliente (IT/DE/EN); ES/FR tradotte.
// Revisione madrelingua applicata (grammatica/registro legale), significato invariato.
// Struttura per lingua: { intro, conditions[], rulesTitle, rules[], privacy }
// La clausola cauzione (n. 6) è allineata al funzionamento reale dell'app (€500 pre-autorizzati).

const CONTRATTO_TERMS = {
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

const TIPO_LABEL = {
  it: { mezza_mattina: 'Mezza Giornata Mattina (09:00–13:00)', mezza_pomeriggio: 'Mezza Giornata Pomeriggio (14:00–18:00)', intera_giornata: 'Giornata Intera (09:00–18:00)', multi_giorno: 'Multi-Giorno' },
  en: { mezza_mattina: 'Half Day Morning (09:00–13:00)', mezza_pomeriggio: 'Half Day Afternoon (14:00–18:00)', intera_giornata: 'Full Day (09:00–18:00)', multi_giorno: 'Multi-Day' },
  de: { mezza_mattina: 'Halbtag Vormittag (09:00–13:00)', mezza_pomeriggio: 'Halbtag Nachmittag (14:00–18:00)', intera_giornata: 'Ganztag (09:00–18:00)', multi_giorno: 'Mehrtägig' },
  es: { mezza_mattina: 'Medio Día Mañana (09:00–13:00)', mezza_pomeriggio: 'Medio Día Tarde (14:00–18:00)', intera_giornata: 'Día Completo (09:00–18:00)', multi_giorno: 'Varios Días' },
  fr: { mezza_mattina: 'Demi-Journée Matin (09h00–13h00)', mezza_pomeriggio: 'Demi-Journée Après-midi (14h00–18h00)', intera_giornata: 'Journée Complète (09h00–18h00)', multi_giorno: 'Plusieurs Jours' },
};

const CONTRATTO_TITLE = {
  it: 'Contratto di Noleggio', en: 'Rental Agreement',
  de: 'Mietvertrag',          es: 'Contrato de Alquiler', fr: 'Contrat de Location',
};

const CONTRATTO_FIELDS = {
  it: { kicker: 'Documento da firmare', giorni: 'giorni', summary: 'Riepilogo prenotazione', code: 'Codice', client: 'Cliente', type: 'Tipo noleggio', pickup: 'Ritiro', ret: 'Restituzione', price: 'Importo pagato', condTitle: 'Condizioni di noleggio', privacyTitle: 'Informativa privacy', terms: 'Termini e Condizioni', cert: 'Certificato di Firma Digitale', docid: 'ID Documento', signer: 'Firmato da', date: 'Data e ora firma (CET)', ip: 'Indirizzo IP', booking: 'Codice prenotazione', footer: 'Documento generato automaticamente da Arfanta Bike Rental. Questo documento ha valore legale ai fini della verifica del consenso contrattuale.', print: 'Stampa / Salva PDF' },
  en: { kicker: 'Document to sign', giorni: 'days', summary: 'Booking summary', code: 'Code', client: 'Customer', type: 'Rental type', pickup: 'Pickup', ret: 'Return', price: 'Amount paid', condTitle: 'Rental terms', privacyTitle: 'Privacy notice', terms: 'Terms & Conditions', cert: 'Digital Signature Certificate', docid: 'Document ID', signer: 'Signed by', date: 'Date and time (CET)', ip: 'IP Address', booking: 'Booking code', footer: 'Automatically generated by Arfanta Bike Rental. This document serves as legal proof of contractual consent.', print: 'Print / Save PDF' },
  de: { kicker: 'Zu unterzeichnendes Dokument', giorni: 'Tage', summary: 'Buchungsübersicht', code: 'Code', client: 'Kunde', type: 'Mietart', pickup: 'Abholung', ret: 'Rückgabe', price: 'Bezahlter Betrag', condTitle: 'Mietbedingungen', privacyTitle: 'Datenschutzhinweis', terms: 'AGB', cert: 'Digitales Signaturzertifikat', docid: 'Dokument-ID', signer: 'Unterzeichnet von', date: 'Datum und Uhrzeit (MEZ)', ip: 'IP-Adresse', booking: 'Buchungscode', footer: 'Automatisch von Arfanta Bike Rental generiert. Dieses Dokument dient als Nachweis der Vertragsannahme.', print: 'Drucken / Als PDF speichern' },
  es: { kicker: 'Documento a firmar', giorni: 'días', summary: 'Resumen de la reserva', code: 'Código', client: 'Cliente', type: 'Tipo', pickup: 'Recogida', ret: 'Devolución', price: 'Importe pagado', condTitle: 'Condiciones de alquiler', privacyTitle: 'Información de privacidad', terms: 'Términos y Condiciones', cert: 'Certificado de Firma Digital', docid: 'ID Documento', signer: 'Firmado por', date: 'Fecha y hora (CET)', ip: 'Dirección IP', booking: 'Código de reserva', footer: 'Generado automáticamente por Arfanta Bike Rental. Este documento sirve como prueba legal del consentimiento contractual.', print: 'Imprimir / Guardar PDF' },
  fr: { kicker: 'Document à signer', giorni: 'jours', summary: 'Récapitulatif de réservation', code: 'Code', client: 'Client', type: 'Type de location', pickup: 'Prise en charge', ret: 'Retour', price: 'Montant payé', condTitle: 'Conditions de location', privacyTitle: 'Informations sur la confidentialité', terms: 'Conditions Générales', cert: 'Certificat de Signature Numérique', docid: 'ID Document', signer: 'Signé par', date: 'Date et heure (CET)', ip: 'Adresse IP', booking: 'Code de réservation', footer: 'Généré automatiquement par Arfanta Bike Rental. Ce document atteste du consentement contractuel.', print: 'Imprimer / Enregistrer en PDF' },
};

const LOCALE_MAP = { it: 'it-IT', en: 'en-GB', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' };

module.exports = { CONTRATTO_TERMS, TIPO_LABEL, CONTRATTO_TITLE, CONTRATTO_FIELDS, LOCALE_MAP };

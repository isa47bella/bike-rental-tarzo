# Email manuali multilingua — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettere all'admin di inviare le email manuali (menu 3 puntini → "Invia email") nella lingua del cliente, scegliendola da un selettore, con gli 11 template rapidi tradotti in 5 lingue.

**Architecture:** I template escono da `AdminDashboard.jsx` e finiscono in un file dati dedicato `emailTemplates.js`, ognuno con `label` italiana + `subject`/`message` in 5 lingue. La finestra email guadagna un selettore "Lingua email" che si apre sulla lingua del cliente. Il backend riceve la lingua scelta e la usa per l'involucro dell'email.

**Tech Stack:** React 18 (frontend, ESM/Vite), Node.js + Express (backend), Nodemailer.

**Spec di riferimento:** [`docs/superpowers/specs/2026-05-21-email-manuali-multilingua-design.md`](../specs/2026-05-21-email-manuali-multilingua-design.md)

## File Structure

| File | Modifica |
|---|---|
| `frontend/src/lib/emailTemplates.js` | Create — gli 11 template con `label` IT + `subject`/`message` in 5 lingue |
| `backend/lib/email.js` | Modify — `sendAdminEmail` accetta un parametro `lang` |
| `backend/routes/admin.js` | Modify — endpoint `send-email` legge/valida `lang`, seleziona `lingua` |
| `frontend/src/lib/api.js` | Modify — `sendEmail` invia `lang` |
| `frontend/src/components/AdminDashboard.jsx` | Modify — rimuove `EMAIL_TEMPLATES` inline, importa dal nuovo file; selettore Lingua, stato, modal |

## Note sul testing

Il progetto **non ha test automatici**. Verifica: `node -c` per i file backend (CommonJS), `node --input-type=module --check` per il file frontend ESM, build Vite per il frontend, verifica funzionale manuale (Task 5). Non scrivere test Jest/Vitest.

## Lingue supportate

Codici lingua usati ovunque: `it`, `en`, `de`, `es`, `fr`. Etichette mostrate nel selettore: Italiano, English, Deutsch, Español, Français.

---

## Task 1: File dati `emailTemplates.js`

**Files:**
- Create: `frontend/src/lib/emailTemplates.js`

**Contesto:** oggi `EMAIL_TEMPLATES` è un array hardcoded (solo italiano) dentro `AdminDashboard.jsx`. Questo task crea il file dati con tutti gli 11 template tradotti in 5 lingue. La `label` resta sempre in italiano (la sceglie l'admin dal menu). I template 1-10 hanno contenuto; l'undicesimo ("Messaggio libero") ha i campi vuoti in ogni lingua. Numero WhatsApp `+39 392 8614635` e indirizzo `Via Pecol 22, Arfanta di Tarzo (TV)` restano invariati in tutte le lingue. Il segnaposto `[LINK_GOOGLE]` nel template "Richiesta recensione" resta invariato in tutte le lingue (lo sostituisce l'admin prima di inviare).

- [ ] **Step 1: Creare il file**

Crea `frontend/src/lib/emailTemplates.js` con questo contenuto esatto:

```javascript
// Template per le email manuali inviate dall'admin (menu 3 puntini → "Invia email").
// La `label` resta sempre in italiano: la sceglie l'admin leggendola dal menu a tendina.
// `subject` e `message` esistono in 5 lingue (it/en/de/es/fr); la lingua viene scelta
// dal selettore "Lingua email" nella finestra di invio.
// L'ultima voce, "Messaggio libero", ha i campi vuoti in ogni lingua: serve a partire
// da zero scrivendo un testo a mano.

export const EMAIL_TEMPLATES = [
  {
    label: 'Promemoria ritiro domani',
    it: {
      subject: "Promemoria: il tuo noleggio è domani — Arfanta Bike Rental",
      message: `Ti ricordiamo che domani è il giorno del tuo noleggio bici!\n\nRicorda di portare con te:\n• Documento di identità valido\n• Il codice della tua prenotazione\n\nTi aspettiamo in Via Pecol 22, Arfanta di Tarzo (TV).\n\nPer qualsiasi necessità contattaci via WhatsApp al +39 392 8614635.`,
    },
    en: {
      subject: "Reminder: your rental is tomorrow — Arfanta Bike Rental",
      message: `This is a reminder that tomorrow is the day of your bike rental!\n\nRemember to bring with you:\n• A valid ID document\n• Your booking code\n\nWe look forward to seeing you at Via Pecol 22, Arfanta di Tarzo (TV).\n\nFor anything you need, contact us on WhatsApp at +39 392 8614635.`,
    },
    de: {
      subject: "Erinnerung: Ihre Vermietung ist morgen — Arfanta Bike Rental",
      message: `Wir möchten Sie daran erinnern, dass morgen der Tag Ihrer Fahrradvermietung ist!\n\nBitte denken Sie daran, mitzubringen:\n• Einen gültigen Ausweis\n• Ihren Buchungscode\n\nWir erwarten Sie in Via Pecol 22, Arfanta di Tarzo (TV).\n\nBei Fragen erreichen Sie uns über WhatsApp unter +39 392 8614635.`,
    },
    es: {
      subject: "Recordatorio: tu alquiler es mañana — Arfanta Bike Rental",
      message: `Te recordamos que mañana es el día de tu alquiler de bicicletas.\n\nRecuerda traer contigo:\n• Un documento de identidad válido\n• El código de tu reserva\n\nTe esperamos en Via Pecol 22, Arfanta di Tarzo (TV).\n\nPara cualquier necesidad, contáctanos por WhatsApp al +39 392 8614635.`,
    },
    fr: {
      subject: "Rappel : votre location est demain — Arfanta Bike Rental",
      message: `Nous vous rappelons que demain est le jour de votre location de vélos !\n\nN'oubliez pas d'apporter avec vous :\n• Une pièce d'identité valide\n• Le code de votre réservation\n\nNous vous attendons à Via Pecol 22, Arfanta di Tarzo (TV).\n\nPour toute nécessité, contactez-nous sur WhatsApp au +39 392 8614635.`,
    },
  },
  {
    label: 'Conferma rimborso',
    it: {
      subject: "Rimborso confermato — Arfanta Bike Rental",
      message: `Abbiamo elaborato il rimborso per la tua prenotazione.\n\nI fondi torneranno sul tuo conto entro 5-10 giorni lavorativi, a seconda della tua banca.\n\nCi dispiace non aver potuto ospitarti questa volta. Speriamo di vederti presto sulle Colline del Prosecco!\n\nPer qualsiasi dubbio contattaci via WhatsApp al +39 392 8614635.`,
    },
    en: {
      subject: "Refund confirmed — Arfanta Bike Rental",
      message: `We have processed the refund for your booking.\n\nThe funds will return to your account within 5-10 business days, depending on your bank.\n\nWe are sorry we could not host you this time. We hope to see you soon in the Prosecco Hills!\n\nFor any questions, contact us on WhatsApp at +39 392 8614635.`,
    },
    de: {
      subject: "Rückerstattung bestätigt — Arfanta Bike Rental",
      message: `Wir haben die Rückerstattung für Ihre Buchung bearbeitet.\n\nDer Betrag wird je nach Ihrer Bank innerhalb von 5-10 Werktagen auf Ihr Konto zurückgebucht.\n\nEs tut uns leid, dass wir Sie dieses Mal nicht empfangen konnten. Wir hoffen, Sie bald auf den Prosecco-Hügeln zu sehen!\n\nBei Fragen erreichen Sie uns über WhatsApp unter +39 392 8614635.`,
    },
    es: {
      subject: "Reembolso confirmado — Arfanta Bike Rental",
      message: `Hemos procesado el reembolso de tu reserva.\n\nLos fondos volverán a tu cuenta en un plazo de 5 a 10 días hábiles, según tu banco.\n\nLamentamos no haber podido recibirte esta vez. ¡Esperamos verte pronto en las Colinas del Prosecco!\n\nPara cualquier duda, contáctanos por WhatsApp al +39 392 8614635.`,
    },
    fr: {
      subject: "Remboursement confirmé — Arfanta Bike Rental",
      message: `Nous avons traité le remboursement de votre réservation.\n\nLes fonds reviendront sur votre compte sous 5 à 10 jours ouvrés, selon votre banque.\n\nNous sommes désolés de ne pas avoir pu vous accueillir cette fois. Nous espérons vous voir bientôt sur les Collines du Prosecco !\n\nPour toute question, contactez-nous sur WhatsApp au +39 392 8614635.`,
    },
  },
  {
    label: 'Cauzione non autorizzata',
    it: {
      subject: "Importante: cauzione non autorizzata — Arfanta Bike Rental",
      message: `Abbiamo tentato di bloccare la cauzione di €500 sulla tua carta come garanzia per il noleggio, ma l'operazione non è andata a buon fine.\n\nSe non risolviamo questo problema entro domani, saremo costretti ad annullare la tua prenotazione.\n\nContattaci via WhatsApp al +39 392 8614635 o rispondi a questa email.\n\nGrazie per la comprensione.`,
    },
    en: {
      subject: "Important: security deposit not authorized — Arfanta Bike Rental",
      message: `We tried to place a hold of €500 on your card as a security deposit for the rental, but the operation was unsuccessful.\n\nIf we do not resolve this issue by tomorrow, we will be forced to cancel your booking.\n\nContact us on WhatsApp at +39 392 8614635 or reply to this email.\n\nThank you for your understanding.`,
    },
    de: {
      subject: "Wichtig: Kaution nicht autorisiert — Arfanta Bike Rental",
      message: `Wir haben versucht, eine Kaution von 500 € auf Ihrer Karte als Sicherheit für die Vermietung zu reservieren, doch der Vorgang ist fehlgeschlagen.\n\nWenn wir dieses Problem nicht bis morgen lösen, müssen wir Ihre Buchung leider stornieren.\n\nKontaktieren Sie uns über WhatsApp unter +39 392 8614635 oder antworten Sie auf diese E-Mail.\n\nVielen Dank für Ihr Verständnis.`,
    },
    es: {
      subject: "Importante: fianza no autorizada — Arfanta Bike Rental",
      message: `Hemos intentado bloquear la fianza de 500 € en tu tarjeta como garantía para el alquiler, pero la operación no se ha completado correctamente.\n\nSi no resolvemos este problema antes de mañana, nos veremos obligados a cancelar tu reserva.\n\nContáctanos por WhatsApp al +39 392 8614635 o responde a este correo.\n\nGracias por tu comprensión.`,
    },
    fr: {
      subject: "Important : caution non autorisée — Arfanta Bike Rental",
      message: `Nous avons tenté de bloquer la caution de 500 € sur votre carte en garantie de la location, mais l'opération n'a pas abouti.\n\nSi nous ne résolvons pas ce problème d'ici demain, nous serons contraints d'annuler votre réservation.\n\nContactez-nous sur WhatsApp au +39 392 8614635 ou répondez à cet e-mail.\n\nMerci de votre compréhension.`,
    },
  },
  {
    label: 'Cambio bicicletta',
    it: {
      subject: "Aggiornamento prenotazione: cambio bicicletta — Arfanta Bike Rental",
      message: `Ti informiamo che per la tua prenotazione è stato necessario assegnarti una bicicletta diversa rispetto a quella originale.\n\nLa bicicletta che riceverai è della stessa tipologia e qualità. Il tuo noleggio non subisce altre modifiche.\n\nPer qualsiasi domanda siamo disponibili via WhatsApp al +39 392 8614635.`,
    },
    en: {
      subject: "Booking update: bike change — Arfanta Bike Rental",
      message: `We would like to inform you that for your booking it was necessary to assign you a different bike from the original one.\n\nThe bike you will receive is of the same type and quality. Your rental is not affected by any other changes.\n\nFor any questions we are available on WhatsApp at +39 392 8614635.`,
    },
    de: {
      subject: "Buchungsaktualisierung: Fahrradwechsel — Arfanta Bike Rental",
      message: `Wir möchten Sie darüber informieren, dass wir Ihnen für Ihre Buchung ein anderes als das ursprüngliche Fahrrad zuweisen mussten.\n\nDas Fahrrad, das Sie erhalten, ist von gleicher Art und Qualität. An Ihrer Vermietung ändert sich sonst nichts.\n\nBei Fragen erreichen Sie uns über WhatsApp unter +39 392 8614635.`,
    },
    es: {
      subject: "Actualización de la reserva: cambio de bicicleta — Arfanta Bike Rental",
      message: `Te informamos de que para tu reserva ha sido necesario asignarte una bicicleta diferente a la original.\n\nLa bicicleta que recibirás es del mismo tipo y calidad. Tu alquiler no sufre ningún otro cambio.\n\nPara cualquier pregunta estamos disponibles por WhatsApp al +39 392 8614635.`,
    },
    fr: {
      subject: "Mise à jour de la réservation : changement de vélo — Arfanta Bike Rental",
      message: `Nous vous informons que pour votre réservation, il a été nécessaire de vous attribuer un vélo différent de celui prévu initialement.\n\nLe vélo que vous recevrez est du même type et de la même qualité. Votre location ne subit aucune autre modification.\n\nPour toute question, nous sommes disponibles sur WhatsApp au +39 392 8614635.`,
    },
  },
  {
    label: 'Ritardo restituzione',
    it: {
      subject: "Promemoria restituzione bicicletta — Arfanta Bike Rental",
      message: `Ci risulta che la bicicletta noleggiata non sia stata ancora restituita all'orario previsto.\n\nTi chiediamo di riconsegnare la bici il prima possibile in Via Pecol 22, Arfanta di Tarzo (TV).\n\nIn caso di difficoltà contattaci subito via WhatsApp al +39 392 8614635.\n\nGrazie per la collaborazione.`,
    },
    en: {
      subject: "Bike return reminder — Arfanta Bike Rental",
      message: `Our records show that the rented bike has not yet been returned at the scheduled time.\n\nWe kindly ask you to return the bike as soon as possible to Via Pecol 22, Arfanta di Tarzo (TV).\n\nIf you are having any difficulty, contact us right away on WhatsApp at +39 392 8614635.\n\nThank you for your cooperation.`,
    },
    de: {
      subject: "Erinnerung an die Fahrradrückgabe — Arfanta Bike Rental",
      message: `Nach unseren Unterlagen wurde das gemietete Fahrrad zur vereinbarten Zeit noch nicht zurückgegeben.\n\nWir bitten Sie, das Fahrrad so bald wie möglich in Via Pecol 22, Arfanta di Tarzo (TV) zurückzugeben.\n\nBei Schwierigkeiten kontaktieren Sie uns bitte sofort über WhatsApp unter +39 392 8614635.\n\nVielen Dank für Ihre Mitarbeit.`,
    },
    es: {
      subject: "Recordatorio de devolución de la bicicleta — Arfanta Bike Rental",
      message: `Nos consta que la bicicleta alquilada aún no se ha devuelto a la hora prevista.\n\nTe pedimos que devuelvas la bicicleta lo antes posible en Via Pecol 22, Arfanta di Tarzo (TV).\n\nSi tienes alguna dificultad, contáctanos de inmediato por WhatsApp al +39 392 8614635.\n\nGracias por tu colaboración.`,
    },
    fr: {
      subject: "Rappel de restitution du vélo — Arfanta Bike Rental",
      message: `Selon nos informations, le vélo loué n'a pas encore été restitué à l'heure prévue.\n\nNous vous demandons de rendre le vélo dès que possible à Via Pecol 22, Arfanta di Tarzo (TV).\n\nEn cas de difficulté, contactez-nous immédiatement sur WhatsApp au +39 392 8614635.\n\nMerci de votre collaboration.`,
    },
  },
  {
    label: 'Danni rilevati',
    it: {
      subject: "Comunicazione danni — Arfanta Bike Rental",
      message: `A seguito dell'ispezione della bicicletta restituita, abbiamo rilevato dei danni che non erano presenti al momento della consegna.\n\nAbbiamo proceduto con l'addebito del costo di riparazione sulla tua carta, come previsto dal contratto di noleggio firmato.\n\nPer qualsiasi chiarimento siamo disponibili via WhatsApp al +39 392 8614635 o via email.\n\nGrazie per la comprensione.`,
    },
    en: {
      subject: "Damage notification — Arfanta Bike Rental",
      message: `Following the inspection of the returned bike, we found damage that was not present at the time of delivery.\n\nWe have charged the repair cost to your card, as provided for in the signed rental agreement.\n\nFor any clarification we are available on WhatsApp at +39 392 8614635 or by email.\n\nThank you for your understanding.`,
    },
    de: {
      subject: "Schadensmeldung — Arfanta Bike Rental",
      message: `Bei der Überprüfung des zurückgegebenen Fahrrads haben wir Schäden festgestellt, die bei der Übergabe nicht vorhanden waren.\n\nWir haben die Reparaturkosten Ihrer Karte belastet, wie im unterzeichneten Mietvertrag vorgesehen.\n\nFür Rückfragen erreichen Sie uns über WhatsApp unter +39 392 8614635 oder per E-Mail.\n\nVielen Dank für Ihr Verständnis.`,
    },
    es: {
      subject: "Comunicación de daños — Arfanta Bike Rental",
      message: `Tras la inspección de la bicicleta devuelta, hemos detectado daños que no estaban presentes en el momento de la entrega.\n\nHemos procedido a cargar el coste de la reparación en tu tarjeta, según lo previsto en el contrato de alquiler firmado.\n\nPara cualquier aclaración estamos disponibles por WhatsApp al +39 392 8614635 o por correo electrónico.\n\nGracias por tu comprensión.`,
    },
    fr: {
      subject: "Notification de dommages — Arfanta Bike Rental",
      message: `À la suite de l'inspection du vélo restitué, nous avons constaté des dommages qui n'étaient pas présents au moment de la remise.\n\nNous avons débité le coût de la réparation sur votre carte, comme prévu par le contrat de location signé.\n\nPour toute précision, nous sommes disponibles sur WhatsApp au +39 392 8614635 ou par e-mail.\n\nMerci de votre compréhension.`,
    },
  },
  {
    label: 'Ringraziamento post-noleggio',
    it: {
      subject: "Grazie per aver scelto Arfanta Bike Rental!",
      message: `Grazie per aver noleggiato con noi! Speriamo che tu abbia trascorso una splendida giornata sulle Colline del Prosecco.\n\nSe ti è piaciuta l'esperienza, ti saremmo grati se lasciassi una recensione su Google — ci aiuta molto a far conoscere questo posto magico!\n\nSperiamo di rivederti presto!\n\nLo staff di Arfanta Bike Rental 🚲`,
    },
    en: {
      subject: "Thank you for choosing Arfanta Bike Rental!",
      message: `Thank you for renting with us! We hope you had a wonderful day in the Prosecco Hills.\n\nIf you enjoyed the experience, we would be grateful if you left a review on Google — it really helps us share this magical place!\n\nWe hope to see you again soon!\n\nThe Arfanta Bike Rental team 🚲`,
    },
    de: {
      subject: "Danke, dass Sie Arfanta Bike Rental gewählt haben!",
      message: `Vielen Dank, dass Sie bei uns gemietet haben! Wir hoffen, Sie hatten einen wunderschönen Tag auf den Prosecco-Hügeln.\n\nWenn Ihnen das Erlebnis gefallen hat, würden wir uns über eine Bewertung auf Google freuen — das hilft uns sehr, diesen magischen Ort bekannt zu machen!\n\nWir hoffen, Sie bald wiederzusehen!\n\nIhr Team von Arfanta Bike Rental 🚲`,
    },
    es: {
      subject: "¡Gracias por elegir Arfanta Bike Rental!",
      message: `¡Gracias por alquilar con nosotros! Esperamos que hayas pasado un día estupendo en las Colinas del Prosecco.\n\nSi te ha gustado la experiencia, te agradeceríamos que dejaras una reseña en Google: ¡nos ayuda mucho a dar a conocer este lugar mágico!\n\n¡Esperamos verte pronto de nuevo!\n\nEl equipo de Arfanta Bike Rental 🚲`,
    },
    fr: {
      subject: "Merci d'avoir choisi Arfanta Bike Rental !",
      message: `Merci d'avoir loué chez nous ! Nous espérons que vous avez passé une magnifique journée sur les Collines du Prosecco.\n\nSi vous avez apprécié l'expérience, nous vous serions reconnaissants de laisser un avis sur Google — cela nous aide beaucoup à faire connaître ce lieu magique !\n\nNous espérons vous revoir bientôt !\n\nL'équipe d'Arfanta Bike Rental 🚲`,
    },
  },
  {
    label: 'Avviso meteo avverso',
    it: {
      subject: "Avviso meteo per il tuo noleggio — Arfanta Bike Rental",
      message: `Ti informiamo che per la data del tuo noleggio sono previste condizioni meteo avverse (pioggia/temporale).\n\nSe desideri spostare la data, contattaci il prima possibile via WhatsApp al +39 392 8614635 e troveremo insieme una soluzione.\n\nIn alternativa, puoi comunque effettuare il noleggio: le nostre bici sono adatte anche a condizioni umide, ma ti consigliamo abbigliamento impermeabile.\n\nGrazie per la comprensione.`,
    },
    en: {
      subject: "Weather alert for your rental — Arfanta Bike Rental",
      message: `We would like to inform you that adverse weather conditions (rain/storms) are forecast for the date of your rental.\n\nIf you would like to move the date, contact us as soon as possible on WhatsApp at +39 392 8614635 and we will find a solution together.\n\nAlternatively, you can still go ahead with the rental: our bikes are suitable for wet conditions too, but we recommend waterproof clothing.\n\nThank you for your understanding.`,
    },
    de: {
      subject: "Wetterwarnung für Ihre Vermietung — Arfanta Bike Rental",
      message: `Wir möchten Sie darüber informieren, dass für das Datum Ihrer Vermietung schlechtes Wetter (Regen/Gewitter) vorhergesagt ist.\n\nWenn Sie das Datum verschieben möchten, kontaktieren Sie uns so bald wie möglich über WhatsApp unter +39 392 8614635, und wir finden gemeinsam eine Lösung.\n\nAlternativ können Sie die Vermietung trotzdem durchführen: Unsere Fahrräder eignen sich auch für nasse Bedingungen, wir empfehlen jedoch wetterfeste Kleidung.\n\nVielen Dank für Ihr Verständnis.`,
    },
    es: {
      subject: "Aviso meteorológico para tu alquiler — Arfanta Bike Rental",
      message: `Te informamos de que para la fecha de tu alquiler se prevén condiciones meteorológicas adversas (lluvia/tormenta).\n\nSi deseas cambiar la fecha, contáctanos lo antes posible por WhatsApp al +39 392 8614635 y encontraremos juntos una solución.\n\nComo alternativa, puedes realizar el alquiler igualmente: nuestras bicicletas también son aptas para condiciones húmedas, pero te recomendamos ropa impermeable.\n\nGracias por tu comprensión.`,
    },
    fr: {
      subject: "Alerte météo pour votre location — Arfanta Bike Rental",
      message: `Nous vous informons que des conditions météorologiques défavorables (pluie/orage) sont prévues pour la date de votre location.\n\nSi vous souhaitez déplacer la date, contactez-nous dès que possible sur WhatsApp au +39 392 8614635 et nous trouverons ensemble une solution.\n\nVous pouvez également effectuer la location malgré tout : nos vélos conviennent aussi aux conditions humides, mais nous vous recommandons des vêtements imperméables.\n\nMerci de votre compréhension.`,
    },
  },
  {
    label: 'Richiesta recensione',
    it: {
      subject: "Come è andata la tua esperienza? — Arfanta Bike Rental",
      message: `Speriamo che il tuo noleggio sia stato di tuo gradimento!\n\nLa tua opinione è molto importante per noi. Se hai 2 minuti, lascia una recensione su Google — ci aiuta enormemente:\n\nhttps://g.page/r/[LINK_GOOGLE]\n\nE se qualcosa non ha funzionato al meglio, scrivici direttamente via WhatsApp al +39 392 8614635: vogliamo sempre migliorare.\n\nGrazie e a presto!`,
    },
    en: {
      subject: "How was your experience? — Arfanta Bike Rental",
      message: `We hope you enjoyed your rental!\n\nYour opinion is very important to us. If you have 2 minutes, please leave a review on Google — it helps us enormously:\n\nhttps://g.page/r/[LINK_GOOGLE]\n\nAnd if something didn't go as well as it should have, write to us directly on WhatsApp at +39 392 8614635: we always want to improve.\n\nThank you and see you soon!`,
    },
    de: {
      subject: "Wie war Ihr Erlebnis? — Arfanta Bike Rental",
      message: `Wir hoffen, Ihre Vermietung hat Ihnen gefallen!\n\nIhre Meinung ist uns sehr wichtig. Wenn Sie 2 Minuten Zeit haben, hinterlassen Sie bitte eine Bewertung auf Google — das hilft uns enorm:\n\nhttps://g.page/r/[LINK_GOOGLE]\n\nUnd falls etwas nicht optimal gelaufen ist, schreiben Sie uns direkt über WhatsApp unter +39 392 8614635: Wir möchten uns immer verbessern.\n\nVielen Dank und bis bald!`,
    },
    es: {
      subject: "¿Qué tal tu experiencia? — Arfanta Bike Rental",
      message: `¡Esperamos que hayas disfrutado de tu alquiler!\n\nTu opinión es muy importante para nosotros. Si tienes 2 minutos, deja una reseña en Google: nos ayuda enormemente:\n\nhttps://g.page/r/[LINK_GOOGLE]\n\nY si algo no ha funcionado del todo bien, escríbenos directamente por WhatsApp al +39 392 8614635: siempre queremos mejorar.\n\n¡Gracias y hasta pronto!`,
    },
    fr: {
      subject: "Comment s'est passée votre expérience ? — Arfanta Bike Rental",
      message: `Nous espérons que votre location vous a plu !\n\nVotre avis est très important pour nous. Si vous avez 2 minutes, laissez un avis sur Google — cela nous aide énormément :\n\nhttps://g.page/r/[LINK_GOOGLE]\n\nEt si quelque chose ne s'est pas déroulé au mieux, écrivez-nous directement sur WhatsApp au +39 392 8614635 : nous voulons toujours nous améliorer.\n\nMerci et à bientôt !`,
    },
  },
  {
    label: 'Richiesta modifica',
    it: {
      subject: "Modifica prenotazione — Arfanta Bike Rental",
      message: `In merito alla tua prenotazione, vorremmo chiederti di contattarci per definire alcuni dettagli.\n\nPuoi raggiungerci via WhatsApp al +39 392 8614635 oppure rispondendo a questa email.\n\nGrazie.`,
    },
    en: {
      subject: "Booking change — Arfanta Bike Rental",
      message: `Regarding your booking, we would like to ask you to contact us to settle a few details.\n\nYou can reach us on WhatsApp at +39 392 8614635 or by replying to this email.\n\nThank you.`,
    },
    de: {
      subject: "Buchungsänderung — Arfanta Bike Rental",
      message: `Bezüglich Ihrer Buchung möchten wir Sie bitten, uns zu kontaktieren, um einige Details zu klären.\n\nSie erreichen uns über WhatsApp unter +39 392 8614635 oder indem Sie auf diese E-Mail antworten.\n\nVielen Dank.`,
    },
    es: {
      subject: "Modificación de la reserva — Arfanta Bike Rental",
      message: `En relación con tu reserva, nos gustaría pedirte que nos contactes para concretar algunos detalles.\n\nPuedes contactarnos por WhatsApp al +39 392 8614635 o respondiendo a este correo.\n\nGracias.`,
    },
    fr: {
      subject: "Modification de la réservation — Arfanta Bike Rental",
      message: `Concernant votre réservation, nous souhaiterions vous demander de nous contacter afin de préciser quelques détails.\n\nVous pouvez nous joindre sur WhatsApp au +39 392 8614635 ou en répondant à cet e-mail.\n\nMerci.`,
    },
  },
  {
    label: 'Messaggio libero',
    it: { subject: "", message: `` },
    en: { subject: "", message: `` },
    de: { subject: "", message: `` },
    es: { subject: "", message: `` },
    fr: { subject: "", message: `` },
  },
];
```

- [ ] **Step 2: Verificare la sintassi**

Run: `cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo" && node --input-type=module --check < frontend/src/lib/emailTemplates.js && echo "sintassi OK"`
Expected: stampa `sintassi OK`.

- [ ] **Step 3: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add frontend/src/lib/emailTemplates.js
git commit -m "feat(email): template manuali in 5 lingue (file dati dedicato)"
```

---

## Task 2: Backend — `sendAdminEmail` accetta `lang`

**Files:**
- Modify: `backend/lib/email.js` — funzione `sendAdminEmail`

**Contesto:** `sendAdminEmail(prenotazione, subject, messageText)` oggi fa `const lang = prenotazione.lingua || 'it'`. Siccome chi la chiama non passa mai `lingua` nella prenotazione, ricade sempre su `it`. Aggiungiamo un parametro `lang` esplicito; resta il fallback a `prenotazione.lingua` e poi `it`.

- [ ] **Step 1: Modificare la firma e la risoluzione della lingua**

In `backend/lib/email.js`, trovare l'inizio della funzione `sendAdminEmail`:

```javascript
async function sendAdminEmail(prenotazione, subject, messageText) {
  const lang = prenotazione.lingua || 'it';
  const t = emailT(lang);
```

e sostituirlo con:

```javascript
async function sendAdminEmail(prenotazione, subject, messageText, lang) {
  const lingua = lang || prenotazione.lingua || 'it';
  const t = emailT(lingua);
```

- [ ] **Step 2: Aggiornare l'uso della lingua nello shell**

Nella stessa funzione `sendAdminEmail`, trovare la riga che costruisce l'HTML:

```javascript
    html:    buildEmailShell({ lang, heroAlt: t.footerUnesco, bodyHtml }),
```

e sostituirla con:

```javascript
    html:    buildEmailShell({ lang: lingua, heroAlt: t.footerUnesco, bodyHtml }),
```

(Nel resto della funzione non ci sono altri usi della variabile `lang`: usava `lang` solo in `emailT(lang)` e in `buildEmailShell`. Dopo questa modifica la variabile si chiama `lingua`.)

- [ ] **Step 3: Verificare la sintassi**

Run: `cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo" && node -c backend/lib/email.js && echo OK`
Expected: stampa `OK`.

- [ ] **Step 4: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/lib/email.js
git commit -m "feat(email): sendAdminEmail accetta la lingua come parametro"
```

---

## Task 3: Backend — endpoint `send-email` riceve e valida `lang`

**Files:**
- Modify: `backend/routes/admin.js` — endpoint `POST /bookings/:id/send-email`

**Contesto:** l'endpoint oggi legge `{ subject, message }`, seleziona la prenotazione senza `lingua` e chiama `sendAdminEmail(prenotazione, subject, message)`. Va aggiornato per leggere `lang` dal body, selezionare anche `lingua` (fallback), validare la lingua e passarla a `sendAdminEmail`.

- [ ] **Step 1: Sostituire il corpo dell'endpoint**

In `backend/routes/admin.js`, sostituire INTERAMENTE il corpo di `router.post('/bookings/:id/send-email', ...)`. Codice attuale:

```javascript
router.post('/bookings/:id/send-email', async (req, res) => {
  const { subject, message } = req.body;
  if (!subject?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'Oggetto e messaggio sono obbligatori' });
  }

  const { data: prenotazione, error } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, cliente_email, data_ritiro')
    .eq('id', req.params.id)
    .single();

  if (error || !prenotazione) {
    return res.status(404).json({ error: 'Prenotazione non trovata' });
  }

  try {
    await sendAdminEmail(prenotazione, subject.trim(), message.trim());
    console.log(`[admin send-email] Email inviata a ${prenotazione.cliente_email} — "${subject}"`);
    await logAction('send_email', req.params.id, { subject: subject.trim(), to: prenotazione.cliente_email }, getIp(req));
    return res.json({ success: true });
  } catch (e) {
    console.error('[admin send-email] Errore:', e.message);
    return res.status(500).json({ error: 'Errore invio email: ' + e.message });
  }
});
```

Nuovo codice:

```javascript
router.post('/bookings/:id/send-email', async (req, res) => {
  const { subject, message, lang } = req.body;
  if (!subject?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'Oggetto e messaggio sono obbligatori' });
  }

  const { data: prenotazione, error } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, cliente_email, data_ritiro, lingua')
    .eq('id', req.params.id)
    .single();

  if (error || !prenotazione) {
    return res.status(404).json({ error: 'Prenotazione non trovata' });
  }

  // Lingua dell'email: quella scelta dall'admin, validata; fallback alla
  // lingua della prenotazione e infine all'italiano.
  const LINGUE_VALIDE = ['it', 'en', 'de', 'es', 'fr'];
  const lingua = LINGUE_VALIDE.includes(lang) ? lang : (prenotazione.lingua || 'it');

  try {
    await sendAdminEmail(prenotazione, subject.trim(), message.trim(), lingua);
    console.log(`[admin send-email] Email (${lingua}) inviata a ${prenotazione.cliente_email} — "${subject}"`);
    await logAction('send_email', req.params.id, { subject: subject.trim(), lingua, to: prenotazione.cliente_email }, getIp(req));
    return res.json({ success: true });
  } catch (e) {
    console.error('[admin send-email] Errore:', e.message);
    return res.status(500).json({ error: 'Errore invio email: ' + e.message });
  }
});
```

- [ ] **Step 2: Verificare la sintassi**

Run: `cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo" && node -c backend/routes/admin.js && echo OK`
Expected: stampa `OK`.

- [ ] **Step 3: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/routes/admin.js
git commit -m "feat(email): endpoint send-email riceve e valida la lingua"
```

---

## Task 4: Frontend — selettore lingua nella finestra email

**Files:**
- Modify: `frontend/src/lib/api.js` — helper `sendEmail`
- Modify: `frontend/src/components/AdminDashboard.jsx` — import, stato, handler, `renderEmailModal`

**Contesto:** la finestra "Invia email" (`renderEmailModal`) ha un menu "Template rapido" che riempie Oggetto e Messaggio. Va aggiunto un selettore "Lingua email" che si apre sulla lingua del cliente; scegliendo un template i campi si riempiono nella lingua selezionata; cambiando lingua i campi si riaggiornano (se un template è selezionato). L'array `EMAIL_TEMPLATES` inline va rimosso e importato dal file creato in Task 1.

- [ ] **Step 1: Aggiornare l'helper `sendEmail` in `api.js`**

In `frontend/src/lib/api.js`, trovare:

```javascript
  sendEmail: (id, subject, message) =>
    adminPost(`/admin/bookings/${id}/send-email`, { subject, message }),
```

e sostituirlo con:

```javascript
  sendEmail: (id, subject, message, lang) =>
    adminPost(`/admin/bookings/${id}/send-email`, { subject, message, lang }),
```

- [ ] **Step 2: Importare `EMAIL_TEMPLATES` e rimuovere l'array inline**

In `frontend/src/components/AdminDashboard.jsx`, trovare la riga di import esistente:

```javascript
import { adminApi } from '../lib/api';
```

e aggiungere SUBITO DOPO:

```javascript
import { EMAIL_TEMPLATES } from '../lib/emailTemplates';
```

Poi rimuovere INTERAMENTE la dichiarazione `const EMAIL_TEMPLATES = [ ... ];` inline (l'array degli 11 template, dalla riga `const EMAIL_TEMPLATES = [` fino alla riga `];` che lo chiude). Quel blocco è ora sostituito dall'import.

- [ ] **Step 3: Aggiungere lo stato per lingua e template selezionato**

In `AdminDashboard.jsx`, trovare il blocco di stato della email modal:

```javascript
  // Email modal
  const [emailModal,   setEmailModal]   = useState(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
```

e sostituirlo con:

```javascript
  // Email modal
  const [emailModal,   setEmailModal]   = useState(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailLang,    setEmailLang]    = useState('it');
  const [emailTemplateIdx, setEmailTemplateIdx] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
```

- [ ] **Step 4: Aggiungere l'helper `applyTemplate` e aggiornare `handleSendEmail`**

In `AdminDashboard.jsx`, trovare la funzione `handleSendEmail`:

```javascript
  async function handleSendEmail() {
    if (!emailSubject.trim() || !emailMessage.trim()) return;
    setEmailLoading(true);
    try {
      await adminApi.sendEmail(emailModal.id, emailSubject, emailMessage);
      alert(`Email inviata a ${emailModal.email}`);
      setEmailModal(null); setEmailSubject(''); setEmailMessage('');
    } catch (e) { alert('Errore invio email: ' + e.message); }
    finally { setEmailLoading(false); }
  }
```

e sostituirla con (aggiunge `applyTemplate` prima, passa `emailLang`, azzera `emailTemplateIdx`):

```javascript
  // Riempie Oggetto e Messaggio col template `idx` nella lingua `lang`.
  function applyTemplate(idx, lang) {
    const tpl = EMAIL_TEMPLATES[idx];
    if (!tpl) return;
    const testo = tpl[lang] || tpl.it;
    setEmailSubject(testo.subject);
    setEmailMessage(testo.message);
  }

  async function handleSendEmail() {
    if (!emailSubject.trim() || !emailMessage.trim()) return;
    setEmailLoading(true);
    try {
      await adminApi.sendEmail(emailModal.id, emailSubject, emailMessage, emailLang);
      alert(`Email inviata a ${emailModal.email}`);
      setEmailModal(null); setEmailSubject(''); setEmailMessage(''); setEmailTemplateIdx('');
    } catch (e) { alert('Errore invio email: ' + e.message); }
    finally { setEmailLoading(false); }
  }
```

- [ ] **Step 5: Aggiornare l'apertura della finestra dal menu 3 puntini**

In `AdminDashboard.jsx`, trovare il bottone "Invia email" dell'actionsheet:

```javascript
            <button className="ac-actionsheet-btn" onClick={act(() => { setEmailModal({ id: b.id, nome: b.cliente_nome, email: b.cliente_email }); setEmailSubject(''); setEmailMessage(''); })}>
              <IconMail /><span>Invia email</span>
            </button>
```

e sostituirlo con (aggiunge `lingua` allo stato `emailModal`, inizializza `emailLang` con la lingua del cliente, azzera `emailTemplateIdx`):

```javascript
            <button className="ac-actionsheet-btn" onClick={act(() => { setEmailModal({ id: b.id, nome: b.cliente_nome, email: b.cliente_email, lingua: b.lingua || 'it' }); setEmailSubject(''); setEmailMessage(''); setEmailLang(b.lingua || 'it'); setEmailTemplateIdx(''); })}>
              <IconMail /><span>Invia email</span>
            </button>
```

- [ ] **Step 6: Aggiornare `renderEmailModal`**

In `AdminDashboard.jsx`, trovare il blocco dei due campi "Template rapido" e "Oggetto" dentro `renderEmailModal`:

```javascript
          <div className="ac-field">
            <label className="ac-label">Template rapido</label>
            <select className="ac-select" onChange={e => { const t = EMAIL_TEMPLATES[e.target.value]; if (t) { setEmailSubject(t.subject); setEmailMessage(t.message); } }} defaultValue="">
              <option value="" disabled>Scegli template…</option>
              {EMAIL_TEMPLATES.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
            </select>
          </div>
          <div className="ac-field">
            <label className="ac-label">Oggetto</label>
```

e sostituirlo con (aggiunge il selettore Lingua sopra, rende controllato il select dei template, aggiorna gli onChange):

```javascript
          <div className="ac-field">
            <label className="ac-label">Lingua email</label>
            <select className="ac-select" value={emailLang} onChange={e => {
              const lang = e.target.value;
              setEmailLang(lang);
              if (emailTemplateIdx !== '') applyTemplate(Number(emailTemplateIdx), lang);
            }}>
              <option value="it">Italiano</option>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
            </select>
          </div>
          <div className="ac-field">
            <label className="ac-label">Template rapido</label>
            <select className="ac-select" value={emailTemplateIdx} onChange={e => {
              const idx = e.target.value;
              setEmailTemplateIdx(idx);
              if (idx !== '') applyTemplate(Number(idx), emailLang);
            }}>
              <option value="" disabled>Scegli template…</option>
              {EMAIL_TEMPLATES.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
            </select>
          </div>
          <div className="ac-field">
            <label className="ac-label">Oggetto</label>
```

- [ ] **Step 7: Verificare sintassi e build**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo/frontend" && npm run build 2>&1 | tail -5
```
Expected: build completata senza errori.

- [ ] **Step 8: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add frontend/src/lib/api.js frontend/src/components/AdminDashboard.jsx
git commit -m "feat(email): selettore lingua nella finestra Invia email"
```

---

## Task 5: Deploy e verifica

- [ ] **Step 1: Deploy**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
~/.npm-global/bin/vercel --prod --yes 2>&1 | grep -iE "error|Ready|Production|readyState" | head -6
```
Expected: deploy `READY`.

- [ ] **Step 2: Smoke test**

```bash
curl -s -o /dev/null -w "health: %{http_code}\n" https://bike-rental-tarzo-app.vercel.app/api/health
```
Expected: health `200`.

- [ ] **Step 3: Verifica funzionale (manuale)**

Dall'admin panel:
- Aprire una prenotazione con `lingua` straniera (badge lingua diverso da IT) → menu 3 puntini → "Invia email": la finestra deve aprirsi col selettore "Lingua email" già sulla lingua del cliente.
- Scegliere un template dal menu "Template rapido" (nomi in italiano): Oggetto e Messaggio si riempiono nella lingua selezionata.
- Cambiare il selettore "Lingua email" su un'altra lingua: Oggetto e Messaggio si riaggiornano nella nuova lingua.
- Inviare: verificare che l'email arrivi col contenuto e l'involucro (intestazione/saluto/footer) nella lingua scelta.
- Ripetere con una prenotazione italiana: la finestra si apre su Italiano, tutto come prima.

Questo step richiede una prenotazione reale: va eseguito dall'utente o concordato con lui.

---

## Self-Review

- **Spec coverage:**
  - File dati `emailTemplates.js` con 11 template × 5 lingue → Task 1
  - Selettore "Lingua email" con default sulla lingua del cliente → Task 4 (Step 5 inizializza `emailLang`, Step 6 il selettore)
  - Override manuale su qualunque lingua → Task 4 Step 6 (il `<select>` con le 5 opzioni)
  - Label dei template in italiano → Task 1 (campo `label`) + Task 4 Step 6 (`{t.label}`)
  - Contenuto template nella lingua selezionata → Task 4 Step 4 (`applyTemplate`)
  - Riaggiornamento al cambio lingua → Task 4 Step 6 (onChange del selettore lingua)
  - Fix bug backend (lingua nell'involucro) → Task 2 + Task 3
  - `sendEmail` invia `lang` → Task 4 Step 1
- **Placeholder scan:** nessun TBD/TODO. Tutte le traduzioni sono complete e mostrate. Il segnaposto `[LINK_GOOGLE]` nel template "Richiesta recensione" è contenuto preesistente del template italiano, mantenuto identico in tutte le lingue (non è un placeholder del piano).
- **Type consistency:** la struttura dei template `{ label, it:{subject,message}, en, de, es, fr }` è identica in Task 1 e usata coerentemente in Task 4 (`tpl[lang].subject`/`.message`, `tpl.label`). I codici lingua `it/en/de/es/fr` coincidono tra `emailTemplates.js` (Task 1), il `<select>` (Task 4), `LINGUE_VALIDE` (Task 3) e il fallback di `sendAdminEmail` (Task 2). La firma `sendAdminEmail(prenotazione, subject, messageText, lang)` (Task 2) corrisponde alla chiamata in `admin.js` (Task 3). `sendEmail(id, subject, message, lang)` (Task 4 Step 1) corrisponde alla chiamata in `handleSendEmail` (Task 4 Step 4).

## Definition of Done

- `emailTemplates.js` creato con 11 template in 5 lingue
- La finestra "Invia email" ha il selettore "Lingua email", preimpostato sulla lingua del cliente
- Scegliendo un template, Oggetto/Messaggio escono nella lingua selezionata; cambiando lingua si riaggiornano
- L'email inviata ha contenuto e involucro coerenti con la lingua scelta
- Deploy completato, smoke test ok

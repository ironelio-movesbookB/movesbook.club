/**
 * Words of the public club / team website (`/site/<slug>`).
 * Seeded into Settings → Language (`translations`, category `website`); edits there win.
 */
export const WEBSITE_TEXTS_CATEGORY = 'website';

export const WEBSITE_PUBLIC_TEXTS: Record<string, { en: string; it: string }> = {
  web_language: { en: 'Language', it: 'Lingua' },
  web_nav_about: { en: 'About us', it: 'Chi siamo' },
  web_nav_services: { en: 'Services', it: 'Servizi' },
  web_nav_events: { en: 'Events', it: 'Eventi' },
  web_nav_shop: { en: 'Shop', it: 'Shop' },
  web_nav_sponsors: { en: 'Sponsors', it: 'Sponsor' },
  web_nav_donate: { en: '5x1000', it: '5x1000' },
  web_nav_contacts: { en: 'Contacts', it: 'Contatti' },
  web_preview_banner: {
    en: 'Preview: the website is not published yet.',
    it: 'Anteprima: il sito non è ancora pubblicato.',
  },
  web_members: { en: 'Members', it: 'Iscritti' },
  web_staff: { en: 'Staff and coaches', it: 'Staff e allenatori' },
  web_since: { en: 'Since', it: 'Dal' },
  web_about_title: { en: 'Our reality', it: 'La nostra realtà' },
  web_services_title: { en: 'Useful sections', it: 'Sezioni utili' },
  web_services_text: {
    en: 'Everything you need, in one place.',
    it: 'Tutto quello che ti serve, in un unico posto.',
  },
  web_sec_registrations: { en: 'Registrations and Renewals', it: 'Iscrizioni e rinnovi' },
  web_sec_registrations_text: {
    en: 'Quick, paperless online membership. Join our club or renew your membership from the comfort of your home by filling out our digital form in just a few clicks.',
    it: 'Iscrizione online rapida e senza carta. Entra nel nostro club o rinnova il tesseramento comodamente da casa compilando il nostro modulo digitale in pochi clic.',
  },
  web_sec_online_payments: { en: 'Digital Payments', it: 'Pagamenti digitali' },
  web_sec_online_payments_text: {
    en: 'Secure and flexible online transactions. Pay your club deadlines online with complete peace of mind. Choose the payment method that works best for you from the available options.',
    it: 'Transazioni online sicure e flessibili. Paga le scadenze del club online in totale tranquillità. Scegli il metodo di pagamento più adatto a te tra quelli disponibili.',
  },
  web_sec_documents: { en: 'Document Archive', it: 'Archivio documenti' },
  web_sec_documents_text: {
    en: 'An official, always-accessible repository. Visit the download section to access key club documentation—including regulations, our statute, privacy forms, and official guides—all right at your fingertips.',
    it: 'Un archivio ufficiale, sempre accessibile. Visita la sezione download per consultare la documentazione fondamentale del club, tra cui regolamenti, statuto, moduli privacy e guide ufficiali, tutto a portata di mano.',
  },
  web_sec_calendar: { en: 'Activity Calendar', it: 'Calendario attività' },
  web_sec_calendar_text: {
    en: 'Events, competitions, and courses—just a click away. Never miss a moment of club life. Keep track of our up-to-date schedule for details on matches, lessons, exhibitions, and other events.',
    it: 'Eventi, gare e corsi, a un clic di distanza. Non perdere nemmeno un momento della vita del club. Consulta il nostro calendario sempre aggiornato per scoprire i dettagli su partite, lezioni, esibizioni e altri eventi.',
  },
  web_sec_medical_visit: { en: 'Medical Certificate', it: 'Certificato medico' },
  web_sec_medical_visit_text: {
    en: 'Easily update your medical clearance. Ensure your sports eligibility remains up to date. Simply enter the new expiration date and upload a photo or PDF of your medical certificate.',
    it: 'Aggiorna facilmente la tua idoneità medica. Mantieni sempre valida la tua idoneità sportiva. Ti basta inserire la nuova data di scadenza e caricare una foto o un PDF del tuo certificato medico.',
  },
  web_sec_documents_empty: {
    en: 'Ask us for the club documents.',
    it: 'Chiedici i documenti del club.',
  },
  web_open: { en: 'Open', it: 'Apri' },
  web_contact_us: { en: 'Contact us', it: 'Contattaci' },
  web_doc_rules: { en: 'Club rules', it: 'Regolamento' },
  web_doc_privacy: { en: 'Privacy policy', it: 'Informativa privacy' },
  web_close: { en: 'Close', it: 'Chiudi' },
  web_events_title: { en: 'Events and tournaments', it: 'Eventi e tornei' },
  web_events_empty: { en: 'No upcoming events at the moment.', it: 'Nessun evento in programma al momento.' },
  web_shop_title: { en: 'Shop', it: 'Shop' },
  web_shop_text: { en: 'Our services and products.', it: 'I nostri servizi e prodotti.' },
  web_shop_promo_title: { en: 'Purchase products', it: 'Acquista i prodotti' },
  web_shop_promo_text: {
    en: 'Kits, gear and club merchandise: browse our shop and order online.',
    it: 'Divise, attrezzatura e merchandising del club: sfoglia il nostro shop e ordina online.',
  },
  web_shop_promo_cta: { en: 'Shop online', it: 'Vai allo shop' },
  web_shop_ask: { en: 'Ask for information', it: 'Chiedi informazioni' },
  web_sponsors_title: { en: 'Our sponsors', it: 'I nostri sponsor' },
  web_sponsors_text: {
    en: 'Thanks to the partners who support us.',
    it: 'Grazie ai partner che ci sostengono.',
  },
  web_become_sponsor: { en: 'Become a sponsor', it: 'Diventa sponsor' },
  web_sponsored_by: { en: 'Sponsored by', it: 'Sponsorizzato da' },
  web_donate_title: { en: 'Donate your 5x1000', it: 'Dona il tuo 5x1000' },
  web_donate_text: {
    en: 'It costs you nothing: in your tax return sign the box for amateur sports associations and write our tax code.',
    it: 'Non ti costa nulla: nella dichiarazione dei redditi firma nel riquadro delle associazioni sportive dilettantistiche e scrivi il nostro codice fiscale.',
  },
  web_tax_code: { en: 'Tax code', it: 'Codice fiscale' },
  web_copy: { en: 'Copy', it: 'Copia' },
  web_copied: { en: 'Copied', it: 'Copiato' },
  web_contacts_title: { en: 'Contacts', it: 'Contatti' },
  web_follow_us: { en: 'Follow us', it: 'Seguici' },
  web_website: { en: 'Website', it: 'Sito web' },
  web_not_found: { en: 'This website is not available.', it: 'Questo sito non è disponibile.' },
  web_powered: { en: 'Powered by Movesbook', it: 'Realizzato con Movesbook' },
};

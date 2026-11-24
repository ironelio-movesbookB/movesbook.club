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
  web_sec_registrations: { en: 'Online registration', it: 'Iscrizione online' },
  web_sec_registrations_text: {
    en: 'Join us: fill in the registration form online.',
    it: 'Unisciti a noi: compila il modulo di iscrizione online.',
  },
  web_sec_online_payments: { en: 'Fee payments', it: 'Pagamento quote' },
  web_sec_online_payments_text: {
    en: 'Pay the fees of the season {season} online.',
    it: 'Paga online le quote della stagione {season}.',
  },
  web_sec_documents: { en: 'Documents', it: 'Documenti' },
  web_sec_documents_text: {
    en: 'Rules, privacy policy and useful documents.',
    it: 'Regolamento, informativa privacy e documenti utili.',
  },
  web_sec_calendar: { en: 'Calendar', it: 'Calendario' },
  web_sec_calendar_text: {
    en: 'Trainings, matches and appointments.',
    it: 'Allenamenti, partite e appuntamenti.',
  },
  web_sec_medical_visit: { en: 'Medical visit', it: 'Visita medica' },
  web_sec_medical_visit_text: {
    en: 'Book the medical visit for the sports certificate.',
    it: 'Prenota la visita medica per il certificato sportivo.',
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

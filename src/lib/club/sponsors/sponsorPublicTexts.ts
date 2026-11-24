/**
 * Words of the public sponsorship kit and sponsor report pages.
 * Seeded into Settings → Language (`translations`, category `sponsors`); edits there win.
 */
export const SPONSOR_TEXTS_CATEGORY = 'sponsors';

export const SPONSOR_PUBLIC_TEXTS: Record<string, { en: string; it: string }> = {
  // ---- sponsorship kit ----
  spk_title: { en: 'Sponsorship kit', it: 'Kit sponsorizzazione' },
  spk_language: { en: 'Language', it: 'Lingua' },
  spk_hero_title: { en: 'Grow your brand with {club}', it: 'Fai crescere il tuo brand con {club}' },
  spk_hero_text: {
    en: 'Become our sponsor and reach our athletes, families and fans every day: in the app, on our web pages and in our emails.',
    it: 'Diventa nostro sponsor e raggiungi ogni giorno i nostri atleti, le famiglie e i tifosi: nell’app, sulle nostre pagine web e nelle nostre email.',
  },
  spk_contact_us: { en: 'Contact us', it: 'Contattaci' },
  spk_brand_title: { en: 'Take your brand into our community', it: 'Porta il tuo brand nella nostra community' },
  spk_brand_text: { en: 'Real people who follow us every week.', it: 'Persone reali che ci seguono ogni settimana.' },
  spk_members: { en: 'Members', it: 'Iscritti' },
  spk_staff: { en: 'Staff and coaches', it: 'Staff e allenatori' },
  spk_groups: { en: 'Groups and teams', it: 'Gruppi e squadre' },
  spk_years: { en: 'Years of activity', it: 'Anni di attività' },
  spk_results_title: { en: 'Our results', it: 'I nostri risultati' },
  spk_results_text: {
    en: 'Who we are and where your brand will be seen.',
    it: 'Chi siamo e dove sarà visto il tuo brand.',
  },
  spk_demographics: { en: 'Demographics', it: 'Dati demografici' },
  spk_gender: { en: 'Gender', it: 'Genere' },
  spk_male: { en: 'Male', it: 'Uomini' },
  spk_female: { en: 'Female', it: 'Donne' },
  spk_not_specified: { en: 'Not specified', it: 'Non specificato' },
  spk_age: { en: 'Age', it: 'Età' },
  spk_years_old: { en: 'years', it: 'anni' },
  spk_touchpoints: { en: 'Touchpoints', it: 'Punti di contatto' },
  spk_touch_app: { en: 'App sections', it: 'Sezioni dell’app' },
  spk_touch_web: { en: 'Web pages', it: 'Pagine web' },
  spk_touch_email: { en: 'Automatic emails', it: 'Email automatiche' },
  spk_views_30: { en: 'Sponsor views in the last 30 days', it: 'Visualizzazioni sponsor negli ultimi 30 giorni' },
  spk_clicks_30: { en: 'Sponsor clicks in the last 30 days', it: 'Clic sugli sponsor negli ultimi 30 giorni' },
  spk_transparency_title: { en: 'Total transparency', it: 'Trasparenza totale' },
  spk_transparency_text: {
    en: 'You always know where your brand appears, how many people see it and how many click it.',
    it: 'Sai sempre dove appare il tuo brand, quante persone lo vedono e quante ci cliccano.',
  },
  spk_app_preview: { en: 'Your banner in the app', it: 'Il tuo banner nell’app' },
  spk_your_brand_here: { en: 'Your brand here', it: 'Il tuo brand qui' },
  spk_report_preview: { en: 'Your sponsor report', it: 'Il tuo report sponsor' },
  spk_example: { en: 'Example', it: 'Esempio' },
  spk_what_title: { en: 'What you get', it: 'Cosa ottieni' },
  spk_what_1_title: { en: 'Visibility in the app', it: 'Visibilità nell’app' },
  spk_what_1_text: {
    en: 'Your logo or banner in the sections our members use every day: registrations, calendar, payments and shop.',
    it: 'Il tuo logo o banner nelle sezioni che i nostri iscritti usano ogni giorno: iscrizioni, calendario, pagamenti e shop.',
  },
  spk_what_2_title: { en: 'Space on our web pages', it: 'Spazio sulle nostre pagine web' },
  spk_what_2_text: {
    en: 'Your brand on our public pages: events, online registrations and online payments.',
    it: 'Il tuo brand sulle nostre pagine pubbliche: eventi, iscrizioni online e pagamenti online.',
  },
  spk_what_3_title: { en: 'Logo in our emails', it: 'Logo nelle nostre email' },
  spk_what_3_text: {
    en: 'Your logo in the medical certificate, payment and membership reminder emails.',
    it: 'Il tuo logo nelle email di promemoria per certificato medico, pagamenti e tesseramento.',
  },
  spk_what_4_title: { en: 'Link to your website', it: 'Link al tuo sito' },
  spk_what_4_text: {
    en: 'Every click on your logo or banner opens your website or your offer.',
    it: 'Ogni clic sul tuo logo o banner apre il tuo sito o la tua offerta.',
  },
  spk_what_5_title: { en: 'Report with real numbers', it: 'Report con numeri reali' },
  spk_what_5_text: {
    en: 'Views, clicks and CTR for any period, with a link you can open whenever you want.',
    it: 'Visualizzazioni, clic e CTR per qualsiasi periodo, con un link che puoi aprire quando vuoi.',
  },
  spk_what_6_title: { en: 'The values of sport', it: 'I valori dello sport' },
  spk_what_6_text: {
    en: 'Your brand next to effort, team spirit and a healthy lifestyle.',
    it: 'Il tuo brand accanto a impegno, spirito di squadra e uno stile di vita sano.',
  },
  spk_why_title: { en: 'Why choose us', it: 'Perché sceglierci' },
  spk_why_1_title: { en: 'A targeted audience', it: 'Un pubblico mirato' },
  spk_why_1_text: {
    en: 'Local athletes and families: an audience that is hard to reach with classic advertising.',
    it: 'Atleti e famiglie del territorio: un pubblico difficile da raggiungere con la pubblicità classica.',
  },
  spk_why_2_title: { en: 'Measurable', it: 'Misurabile' },
  spk_why_2_text: {
    en: 'You don’t pay for a promise: you see the real results of your sponsorship.',
    it: 'Non paghi una promessa: vedi i risultati reali della tua sponsorizzazione.',
  },
  spk_why_3_title: { en: 'Flexible', it: 'Flessibile' },
  spk_why_3_text: {
    en: 'You choose the sections and the format, logo or banner, and you can change them during the season.',
    it: 'Scegli le sezioni e il formato, logo o banner, e puoi cambiarli durante la stagione.',
  },
  spk_compare_title: { en: 'Classic sponsorship or sponsorship with us?', it: 'Sponsorizzazione classica o con noi?' },
  spk_compare_classic: { en: 'Classic (banner at the venue, flyers)', it: 'Classica (striscione, volantini)' },
  spk_compare_ours: { en: 'With {club}', it: 'Con {club}' },
  spk_cmp_1: { en: 'Seen every day, also away from the venue', it: 'Visto ogni giorno, anche fuori dall’impianto' },
  spk_cmp_2: { en: 'Views and clicks measured', it: 'Visualizzazioni e clic misurati' },
  spk_cmp_3: { en: 'Direct link to your website', it: 'Link diretto al tuo sito' },
  spk_cmp_4: { en: 'Can be changed during the season', it: 'Modificabile durante la stagione' },
  spk_cmp_5: { en: 'Present in the emails to the members', it: 'Presente nelle email agli iscritti' },
  spk_sponsors_title: { en: 'They already chose us', it: 'Ci hanno già scelto' },
  spk_cta_title: { en: 'Become our sponsor', it: 'Diventa nostro sponsor' },
  spk_cta_text: {
    en: 'Write to us: we will prepare a proposal that fits your brand.',
    it: 'Scrivici: prepareremo una proposta su misura per il tuo brand.',
  },
  spk_call: { en: 'Call', it: 'Chiama' },
  spk_website: { en: 'Website', it: 'Sito web' },
  spk_not_found: { en: 'This page is not available.', it: 'Questa pagina non è disponibile.' },
  spk_powered: { en: 'Powered by Movesbook', it: 'Realizzato con Movesbook' },

  // ---- sections (kit + report) ----
  spk_section_presentation: { en: 'Club presentation', it: 'Presentazione della società' },
  spk_section_online_registrations: { en: 'Online registrations', it: 'Iscrizioni online' },
  spk_section_medical_visit: { en: 'Medical visit booking', it: 'Prenotazione visita medica' },
  spk_section_shared_calendar: { en: 'Shared calendar', it: 'Calendario condiviso' },
  spk_section_online_payments: { en: 'Online payments', it: 'Pagamenti online' },
  spk_section_events_page: { en: 'Events page', it: 'Pagina eventi' },
  spk_section_fee_payments: { en: 'Fee payments', it: 'Pagamento quote' },
  spk_section_members_app: { en: 'Members app', it: 'App iscritti' },
  spk_section_online_shop: { en: 'Online shop', it: 'Shop online' },
  spk_section_email_medical_expiry: { en: 'Email: medical certificate expiry', it: 'Email: scadenza certificato medico' },
  spk_section_email_payment_reminder: { en: 'Email: payment reminders', it: 'Email: promemoria pagamenti' },
  spk_section_email_membership_reminder: { en: 'Email: membership reminder', it: 'Email: promemoria tesseramento' },

  // ---- sponsor report ----
  spr_title: { en: 'Sponsor report', it: 'Report sponsor' },
  spr_with_club: { en: 'Sponsorship with {club}', it: 'Sponsorizzazione con {club}' },
  spr_period: { en: 'Period', it: 'Periodo' },
  spr_from: { en: 'From', it: 'Dal' },
  spr_to: { en: 'To', it: 'Al' },
  spr_update: { en: 'Update', it: 'Aggiorna' },
  spr_views: { en: 'Views', it: 'Visualizzazioni' },
  spr_clicks: { en: 'Clicks', it: 'Clic' },
  spr_ctr: { en: 'CTR', it: 'CTR' },
  spr_ctr_hint: { en: 'Clicks out of views', it: 'Clic sulle visualizzazioni' },
  spr_sources: { en: 'Active sources', it: 'Fonti attive' },
  spr_sources_hint: { en: 'Sections with views or clicks', it: 'Sezioni con visualizzazioni o clic' },
  spr_by_section: { en: 'Results by section', it: 'Risultati per sezione' },
  spr_section: { en: 'Section', it: 'Sezione' },
  spr_no_data: { en: 'No views or clicks in this period.', it: 'Nessuna visualizzazione o clic in questo periodo.' },
  spr_placements: { en: 'Where your brand is shown', it: 'Dove viene mostrato il tuo brand' },
  spr_no_placements: { en: 'No section selected yet.', it: 'Nessuna sezione ancora selezionata.' },
  spr_logo: { en: 'Logo', it: 'Logo' },
  spr_banner: { en: 'Banner', it: 'Banner' },
  spr_contract: { en: 'Contract', it: 'Contratto' },
  spr_your_banner: { en: 'Your banner', it: 'Il tuo banner' },
  spr_print: { en: 'Print / save as PDF', it: 'Stampa / salva PDF' },
  spr_generated: { en: 'Generated on {date}', it: 'Generato il {date}' },
  spr_not_found: { en: 'This report is not available.', it: 'Questo report non è disponibile.' },
};

export type SponsorTextKey = keyof typeof SPONSOR_PUBLIC_TEXTS;

/** `{name}` placeholders. */
export function fillSponsorText(text: string, vars: Record<string, string | number> = {}): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

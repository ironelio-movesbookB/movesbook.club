import { fetchTranslationValues } from './infoRepsLongText';
import { normalizeToolsLanguage } from '@/utils/toolsProfileLanguage';

/** Shown when confirming / after removing a member from Archive of Users. */
export const MEMBER_REMOVE_SLOTS_INFO_KEY = 'Member_remove_slots_info' as const;

/** Shown when residual slots are below 10 on opening Archive of Members. */
export const ARCHIVE_LOW_SLOTS_NOTICE_KEY = 'Archive_low_available_slots_notice' as const;

/** Body of the “Add new available slots” modal (purchase form placeholder until that task). */
export const ADD_AVAILABLE_SLOTS_FORM_KEY = 'Add_available_slots_form' as const;

export const MEMBER_REMOVE_SLOTS_INFO_EN =
  '<p><strong>Attention!</strong></p>' +
  '<p>Removing a member is an &lsquo;internal&rsquo; club matter, based on whether or not it is useful to keep that member in your records.</p>' +
  '<p>A member can be removed as the club sees fit, or moved to &lsquo;Archived members&rsquo;; in either case, this will not change the number of available slots—which is determined by the total number of available slots minus the number of members already added.</p>';

export const MEMBER_REMOVE_SLOTS_INFO_IT =
  '<p><strong>Attenzione!</strong></p>' +
  '<p>La rimozione di un membro è una questione &lsquo;interna&rsquo; del club, in base all&rsquo;utilità o meno di mantenere quel membro nei propri archivi.</p>' +
  '<p>Un membro può essere rimosso a discrezione del club, oppure spostato in &lsquo;Membri archiviati&rsquo;; in entrambi i casi, questo non modifica il numero di posti disponibili—determinato dal totale dei posti disponibili meno il numero di membri già aggiunti.</p>';

export const ARCHIVE_LOW_SLOTS_NOTICE_EN =
  '<p><strong>Notice</strong></p>' +
  '<p>The number of available slots is running low.</p>' +
  '<p>To allow new users to be added to the database, click the button &lsquo;Add new available slots&rsquo;.</p>';

export const ARCHIVE_LOW_SLOTS_NOTICE_IT =
  '<p><strong>Avviso</strong></p>' +
  '<p>Il numero di posti disponibili sta per esaurirsi.</p>' +
  '<p>Per consentire l&rsquo;aggiunta di nuovi utenti al database, fare clic sul pulsante &lsquo;Aggiungi nuovi posti disponibili&rsquo;.</p>';

export const ADD_AVAILABLE_SLOTS_FORM_EN =
  '<p>Add new available slots for the inclusion of members.</p>' +
  '<p>The purchase form for additional slots will open in this window. You will be able to choose how many slots to add to the total available for your club.</p>';

export const ADD_AVAILABLE_SLOTS_FORM_IT =
  '<p>Aggiungi nuovi posti disponibili per l&rsquo;inserimento dei membri.</p>' +
  '<p>Il modulo di acquisto di posti aggiuntivi si aprirà in questa finestra. Potrai scegliere quanti posti aggiungere al totale disponibile per il tuo club.</p>';

export function getAddAvailableSlotsButtonLabels(language: string): {
  title: string;
  subtitle: string;
} {
  if (normalizeToolsLanguage(language) === 'it') {
    return {
      title: 'Aggiungi nuovi posti disponibili',
      subtitle: 'Aggiungi nuovi posti disponibili per l’inserimento dei membri',
    };
  }
  return {
    title: 'Add new available slots',
    subtitle: 'Add new available slots for the inclusion of members',
  };
}

export function getLowSlotsNoticeTitle(language: string): string {
  return normalizeToolsLanguage(language) === 'it' ? 'Avviso' : 'Notice';
}

export function getAddAvailableSlotsModalTitle(language: string): string {
  return getAddAvailableSlotsButtonLabels(language).title;
}

async function fetchLocaleLongText(
  key: string,
  language: string,
  fallbackEn: string,
  fallbackIt: string,
): Promise<string> {
  const lang = normalizeToolsLanguage(language);
  const fallback = lang === 'it' ? fallbackIt : fallbackEn;
  try {
    const values = await fetchTranslationValues(key);
    const localized = values?.[lang]?.trim();
    if (localized) return localized;
    if (lang !== 'en') return fallback;
    return values?.en?.trim() || fallbackEn;
  } catch {
    return fallback;
  }
}

export async function fetchMemberRemoveSlotsInfoText(language: string): Promise<string> {
  return fetchLocaleLongText(
    MEMBER_REMOVE_SLOTS_INFO_KEY,
    language,
    MEMBER_REMOVE_SLOTS_INFO_EN,
    MEMBER_REMOVE_SLOTS_INFO_IT,
  );
}

export async function fetchArchiveLowSlotsNoticeText(language: string): Promise<string> {
  return fetchLocaleLongText(
    ARCHIVE_LOW_SLOTS_NOTICE_KEY,
    language,
    ARCHIVE_LOW_SLOTS_NOTICE_EN,
    ARCHIVE_LOW_SLOTS_NOTICE_IT,
  );
}

export async function fetchAddAvailableSlotsFormText(language: string): Promise<string> {
  return fetchLocaleLongText(
    ADD_AVAILABLE_SLOTS_FORM_KEY,
    language,
    ADD_AVAILABLE_SLOTS_FORM_EN,
    ADD_AVAILABLE_SLOTS_FORM_IT,
  );
}

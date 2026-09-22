import {
  parseClubDescriptionMeta,
  type ClubDescriptionMeta,
} from '@/lib/club/clubSidebarLabel';
import { emptyTeamContacts } from '@/lib/team/teamProfileDefaults';
import type { TeamContacts } from '@/lib/team/teamProfileTypes';

function trimStr(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseClubContacts(
  description: string | null | undefined,
): TeamContacts {
  const meta = parseClubDescriptionMeta(description);
  const stored = meta.clubContacts;
  const base = emptyTeamContacts();
  if (!stored || typeof stored !== 'object') {
    return {
      ...base,
      website: trimStr(meta.website) || base.website,
      email: trimStr(meta.mail) || base.email,
      phone1: trimStr(meta.phone) || base.phone1,
    };
  }
  return {
    website: trimStr(stored.website) || trimStr(meta.website),
    email: trimStr(stored.email) || trimStr(meta.mail),
    pec: trimStr(stored.pec),
    phone1: trimStr(stored.phone1) || trimStr(meta.phone),
    phone2: trimStr(stored.phone2),
    facebook: trimStr(stored.facebook),
    instagram: trimStr(stored.instagram),
    whatsapp: trimStr(stored.whatsapp),
    telegram: trimStr(stored.telegram),
  };
}

export function mergeClubContactsForSave(
  existingDescription: string | null | undefined,
  contacts: TeamContacts,
): string {
  const prev = parseClubDescriptionMeta(existingDescription);
  const nextContacts: TeamContacts = {
    website: trimStr(contacts.website),
    email: trimStr(contacts.email),
    pec: trimStr(contacts.pec),
    phone1: trimStr(contacts.phone1),
    phone2: trimStr(contacts.phone2),
    facebook: trimStr(contacts.facebook),
    instagram: trimStr(contacts.instagram),
    whatsapp: trimStr(contacts.whatsapp),
    telegram: trimStr(contacts.telegram),
  };
  const meta: ClubDescriptionMeta = {
    ...prev,
    clubContacts: nextContacts,
    // Keep legacy single fields in sync for club profile / sidebar readers.
    website: nextContacts.website || undefined,
    mail: nextContacts.email || undefined,
    phone: nextContacts.phone1 || undefined,
  };
  return JSON.stringify(meta);
}

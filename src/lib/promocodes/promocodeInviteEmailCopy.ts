import { normalizeLegacyLanguageCode } from '@/lib/promocodes/legacyLanguageCode';

export type InviteEmailCopy = {
  subject: string;
  mailFrom: string;
  message: string;
  regards: string;
  officialInvite: string;
  joinTitle: string;
  promotionalCode: string;
  otherInfo: string;
  visitAlso: string;
  expiresOn: string;
  openInvitation: string;
  copyInviteLink: string;
  introHeading: string;
};

const COPY_BY_LANG: Record<string, InviteEmailCopy> = {
  en: {
    subject: 'Email Invitation',
    mailFrom: 'This mail is sent from',
    message: 'Message',
    regards: 'Regards,',
    officialInvite: 'Official invite',
    joinTitle: 'Join Movesbook with a promotional code',
    promotionalCode: 'Promotional code',
    otherInfo: 'Other info',
    visitAlso: 'Visit also',
    expiresOn: 'Promotional code expires on',
    openInvitation: 'Open your invitation',
    copyInviteLink: 'Or copy this invite link',
    introHeading: 'Message of intro',
  },
  it: {
    subject: 'Invito via email',
    mailFrom: 'Questa email è inviata da',
    message: 'Messaggio',
    regards: 'Cordiali saluti,',
    officialInvite: 'Invito ufficiale',
    joinTitle: 'Unisciti a Movesbook con un codice promozionale',
    promotionalCode: 'Codice promozionale',
    otherInfo: 'Altre informazioni',
    visitAlso: 'Visita anche',
    expiresOn: 'Il codice promozionale scade il',
    openInvitation: 'Apri il tuo invito',
    copyInviteLink: 'Oppure copia questo link di invito',
    introHeading: 'Messaggio introduttivo',
  },
  fr: {
    subject: 'Invitation par e-mail',
    mailFrom: 'Ce message est envoyé par',
    message: 'Message',
    regards: 'Cordialement,',
    officialInvite: 'Invitation officielle',
    joinTitle: 'Rejoignez Movesbook avec un code promotionnel',
    promotionalCode: 'Code promotionnel',
    otherInfo: 'Autres informations',
    visitAlso: 'Visitez aussi',
    expiresOn: 'Le code promotionnel expire le',
    openInvitation: 'Ouvrir votre invitation',
    copyInviteLink: 'Ou copiez ce lien d’invitation',
    introHeading: 'Message d’introduction',
  },
  de: {
    subject: 'E-Mail-Einladung',
    mailFrom: 'Diese E-Mail wurde gesendet von',
    message: 'Nachricht',
    regards: 'Mit freundlichen Grüßen,',
    officialInvite: 'Offizielle Einladung',
    joinTitle: 'Treten Sie Movesbook mit einem Aktionscode bei',
    promotionalCode: 'Aktionscode',
    otherInfo: 'Weitere Informationen',
    visitAlso: 'Besuchen Sie auch',
    expiresOn: 'Der Aktionscode läuft ab am',
    openInvitation: 'Ihre Einladung öffnen',
    copyInviteLink: 'Oder kopieren Sie diesen Einladungslink',
    introHeading: 'Einführungsnachricht',
  },
  es: {
    subject: 'Invitación por correo',
    mailFrom: 'Este correo fue enviado por',
    message: 'Mensaje',
    regards: 'Saludos,',
    officialInvite: 'Invitación oficial',
    joinTitle: 'Únete a Movesbook con un código promocional',
    promotionalCode: 'Código promocional',
    otherInfo: 'Otra información',
    visitAlso: 'Visita también',
    expiresOn: 'El código promocional vence el',
    openInvitation: 'Abrir tu invitación',
    copyInviteLink: 'O copia este enlace de invitación',
    introHeading: 'Mensaje introductorio',
  },
};

export function getInviteEmailCopy(languageCode: string | null | undefined): InviteEmailCopy {
  const code = normalizeLegacyLanguageCode(languageCode);
  return COPY_BY_LANG[code] ?? COPY_BY_LANG.en;
}

export function inviteEmailSubject(languageCode: string | null | undefined): string {
  return getInviteEmailCopy(languageCode).subject;
}

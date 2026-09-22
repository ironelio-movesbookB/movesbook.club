export type QuickRegisterLang = 'en' | 'it' | 'fr' | 'de' | 'es';

export const QUICK_REGISTER_LANG_OPTIONS: { code: QuickRegisterLang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
];

type QuickRegisterStrings = {
  registerYourself: string;
  alreadyHaveAccount: string;
  logIn: string;
  goToMovesbook: string;
  typeHereYourUsername: string;
  usernamePlaceholder: string;
  usernameAvailable: string;
  usernameTaken: string;
  usernameVerifyFailed: string;
  usernameMatchesExisting: string;
  yourMailToRegister: string;
  mailAddressPlaceholder: string;
  retypeYourEmail: string;
  yourPassword: string;
  passwordPlaceholder: string;
  retypeYourPassword: string;
  typeHereYourData: string;
  country: string;
  selectCountry: string;
  countryHint: string;
  userType: string;
  selectUserType: string;
  userTypeHint: string;
  selectVersion: string;
  loading: string;
  versionHint: string;
  noVersions: string;
  duration: string;
  tripleSubscription: string;
  discountPct: string;
  firstSubscriptionCost: string;
  renewalCost: string;
  gender: string;
  selectGender: string;
  male: string;
  female: string;
  sport: string;
  selectSport: string;
  havePromocode: string;
  promocodeEarnHint: string;
  promocodeBanner: string;
  discountWithPromocode: string;
  credits: string;
  creditReceiverHint: string;
  creditSenderHint: string;
  membersHint: string;
  officialInviteEmail: string;
  officialInviteNote: string;
  usernameOfWhoInvitedYou: string;
  retypeUsername: string;
  inviteFilledNote: string;
  totalPayment: string;
  payWithVirtualCard: string;
  register: string;
  registering: string;
  cancel: string;
  language: string;
  singleUser: string;
  club: string;
};

const EN: QuickRegisterStrings = {
  registerYourself: 'Register yourself',
  alreadyHaveAccount: 'Have you already an account Movesbook?',
  logIn: 'Log in',
  goToMovesbook: 'Go to Movesbook',
  typeHereYourUsername: 'Type here your username',
  usernamePlaceholder: 'Username',
  usernameAvailable: 'This username is available.',
  usernameTaken: 'This username is already taken.',
  usernameVerifyFailed: 'Could not verify username. Please try again.',
  usernameMatchesExisting: 'Username matches your existing account.',
  yourMailToRegister: 'Your mail to register',
  mailAddressPlaceholder: 'mail address',
  retypeYourEmail: 'Retype your email *',
  yourPassword: 'Your password',
  passwordPlaceholder: 'Password*',
  retypeYourPassword: 'Retype your password',
  typeHereYourData: 'Type here your data',
  country: 'Country*',
  selectCountry: 'Select country',
  countryHint: 'Together with the country selected, pricing is calculated in your currency.',
  userType: 'User type*',
  selectUserType: 'Select user type',
  userTypeHint: 'User type will affect the versions available.',
  selectVersion: 'Select version',
  loading: 'Loading...',
  versionHint: 'The version chosen will affect the cost.',
  noVersions: 'No versions available for this user type.',
  duration: 'Duration',
  tripleSubscription: 'Triple subscription',
  discountPct: 'discount',
  firstSubscriptionCost: 'First subscription cost',
  renewalCost: 'Renewal cost',
  gender: 'Gender*',
  selectGender: 'Select gender',
  male: 'Male',
  female: 'Female',
  sport: 'Sport*',
  selectSport: 'Select sport',
  havePromocode:
    'Have you a promocode ? If yes type it here to have a discount and some benefits for you',
  promocodeEarnHint:
    'You earn and benefit when you register yourself and when also will do it someone who received your invite to register',
  promocodeBanner:
    'Discount, number of members assigned, and credits earned using your promocode',
  discountWithPromocode: 'Discount with promocode',
  credits: 'Credits',
  creditReceiverHint: 'For the club that receive the invitation and decides to register itself',
  creditSenderHint: 'For the sender club each time a club suggested will register itself',
  membersHint: 'Number of members available or that will be added to the existing ones',
  officialInviteEmail: 'Official invitation email (Movesbook)',
  officialInviteNote: '(Invitation from Movesbook – official address)',
  usernameOfWhoInvitedYou: 'Username of who invited you *',
  retypeUsername: 'Retype username *',
  inviteFilledNote: '(Filled from your invite link — cannot be edited)',
  totalPayment: 'Total payment',
  payWithVirtualCard: 'Pay with virtual credit card',
  register: 'Register',
  registering: 'Registering…',
  cancel: 'Cancel',
  language: 'Language',
  singleUser: 'Single User',
  club: 'Club',
};

const IT: QuickRegisterStrings = {
  registerYourself: 'Registrati',
  alreadyHaveAccount: 'Hai già un account Movesbook?',
  logIn: 'Accedi',
  goToMovesbook: 'Vai a Movesbook',
  typeHereYourUsername: 'Digita qui il tuo username',
  usernamePlaceholder: 'Username',
  usernameAvailable: 'Questo username è disponibile.',
  usernameTaken: 'Questo username è già in uso.',
  usernameVerifyFailed: 'Impossibile verificare lo username. Riprova.',
  usernameMatchesExisting: 'Lo username corrisponde al tuo account esistente.',
  yourMailToRegister: 'La tua email per registrarti',
  mailAddressPlaceholder: 'indirizzo email',
  retypeYourEmail: 'Ridigita la tua email *',
  yourPassword: 'La tua password',
  passwordPlaceholder: 'Password*',
  retypeYourPassword: 'Ridigita la password',
  typeHereYourData: 'Inserisci i tuoi dati',
  country: 'Paese*',
  selectCountry: 'Seleziona paese',
  countryHint: 'In base al paese selezionato, il prezzo è calcolato nella tua valuta.',
  userType: 'Tipo utente*',
  selectUserType: 'Seleziona tipo utente',
  userTypeHint: 'Il tipo utente influisce sulle versioni disponibili.',
  selectVersion: 'Seleziona versione',
  loading: 'Caricamento...',
  versionHint: 'La versione scelta influisce sul costo.',
  noVersions: 'Nessuna versione disponibile per questo tipo utente.',
  duration: 'Durata',
  tripleSubscription: 'Abbonamento triplo',
  discountPct: 'sconto',
  firstSubscriptionCost: 'Costo primo abbonamento',
  renewalCost: 'Costo rinnovo',
  gender: 'Genere*',
  selectGender: 'Seleziona genere',
  male: 'Maschio',
  female: 'Femmina',
  sport: 'Sport*',
  selectSport: 'Seleziona sport',
  havePromocode:
    'Hai un codice promozionale? Se sì, inseriscilo qui per ottenere uno sconto e altri vantaggi',
  promocodeEarnHint:
    'Guadagni e benefici quando ti registri e quando lo farà anche qualcuno che ha ricevuto il tuo invito',
  promocodeBanner:
    'Sconto, numero di membri assegnati e crediti guadagnati con il tuo codice promozionale',
  discountWithPromocode: 'Sconto con codice promozionale',
  credits: 'Crediti',
  creditReceiverHint: 'Per il club che riceve l’invito e decide di registrarsi',
  creditSenderHint: 'Per il club mittente ogni volta che un club suggerito si registra',
  membersHint: 'Numero di membri disponibili o da aggiungere a quelli esistenti',
  officialInviteEmail: 'Email di invito ufficiale (Movesbook)',
  officialInviteNote: '(Invito da Movesbook – indirizzo ufficiale)',
  usernameOfWhoInvitedYou: 'Username di chi ti ha invitato *',
  retypeUsername: 'Ridigita username *',
  inviteFilledNote: '(Compilato dal link di invito — non modificabile)',
  totalPayment: 'Pagamento totale',
  payWithVirtualCard: 'Paga con carta di credito virtuale',
  register: 'Registrati',
  registering: 'Registrazione…',
  cancel: 'Annulla',
  language: 'Lingua',
  singleUser: 'Utente singolo',
  club: 'Club',
};

const FR: QuickRegisterStrings = {
  ...EN,
  registerYourself: 'Inscrivez-vous',
  alreadyHaveAccount: 'Avez-vous déjà un compte Movesbook ?',
  logIn: 'Connexion',
  goToMovesbook: 'Aller à Movesbook',
  typeHereYourUsername: 'Saisissez votre nom d’utilisateur',
  usernameAvailable: 'Ce nom d’utilisateur est disponible.',
  usernameTaken: 'Ce nom d’utilisateur est déjà pris.',
  yourMailToRegister: 'Votre e-mail pour vous inscrire',
  mailAddressPlaceholder: 'adresse e-mail',
  retypeYourEmail: 'Retapez votre e-mail *',
  yourPassword: 'Votre mot de passe',
  retypeYourPassword: 'Retapez votre mot de passe',
  typeHereYourData: 'Saisissez vos données',
  country: 'Pays*',
  selectCountry: 'Sélectionner le pays',
  userType: 'Type d’utilisateur*',
  selectUserType: 'Sélectionner le type',
  selectVersion: 'Sélectionner la version',
  firstSubscriptionCost: 'Coût du premier abonnement',
  renewalCost: 'Coût du renouvellement',
  gender: 'Genre*',
  selectGender: 'Sélectionner le genre',
  male: 'Homme',
  female: 'Femme',
  sport: 'Sport*',
  selectSport: 'Sélectionner le sport',
  havePromocode:
    'Avez-vous un code promo ? Si oui, saisissez-le ici pour obtenir une réduction et des avantages',
  discountWithPromocode: 'Réduction avec code promo',
  credits: 'Crédits',
  usernameOfWhoInvitedYou: 'Nom d’utilisateur de qui vous a invité *',
  retypeUsername: 'Retapez le nom d’utilisateur *',
  totalPayment: 'Paiement total',
  payWithVirtualCard: 'Payer avec une carte virtuelle',
  register: 'S’inscrire',
  registering: 'Inscription…',
  cancel: 'Annuler',
  language: 'Langue',
  singleUser: 'Utilisateur unique',
  club: 'Club',
};

const DE: QuickRegisterStrings = {
  ...EN,
  registerYourself: 'Registrieren Sie sich',
  alreadyHaveAccount: 'Haben Sie bereits ein Movesbook-Konto?',
  logIn: 'Anmelden',
  goToMovesbook: 'Zu Movesbook',
  typeHereYourUsername: 'Geben Sie hier Ihren Benutzernamen ein',
  usernameAvailable: 'Dieser Benutzername ist verfügbar.',
  usernameTaken: 'Dieser Benutzername ist bereits vergeben.',
  yourMailToRegister: 'Ihre E-Mail zur Registrierung',
  mailAddressPlaceholder: 'E-Mail-Adresse',
  retypeYourEmail: 'E-Mail erneut eingeben *',
  yourPassword: 'Ihr Passwort',
  retypeYourPassword: 'Passwort erneut eingeben',
  typeHereYourData: 'Geben Sie hier Ihre Daten ein',
  country: 'Land*',
  selectCountry: 'Land auswählen',
  userType: 'Benutzertyp*',
  selectUserType: 'Benutzertyp auswählen',
  selectVersion: 'Version auswählen',
  firstSubscriptionCost: 'Kosten erstes Abonnement',
  renewalCost: 'Verlängerungskosten',
  gender: 'Geschlecht*',
  selectGender: 'Geschlecht auswählen',
  male: 'Männlich',
  female: 'Weiblich',
  sport: 'Sport*',
  selectSport: 'Sport auswählen',
  havePromocode:
    'Haben Sie einen Promocode? Falls ja, geben Sie ihn hier ein für Rabatt und Vorteile',
  discountWithPromocode: 'Rabatt mit Promocode',
  credits: 'Credits',
  usernameOfWhoInvitedYou: 'Benutzername des Einladenden *',
  retypeUsername: 'Benutzername erneut eingeben *',
  totalPayment: 'Gesamtzahlung',
  payWithVirtualCard: 'Mit virtueller Kreditkarte zahlen',
  register: 'Registrieren',
  registering: 'Registrierung…',
  cancel: 'Abbrechen',
  language: 'Sprache',
  singleUser: 'Einzelbenutzer',
  club: 'Club',
};

const ES: QuickRegisterStrings = {
  ...EN,
  registerYourself: 'Regístrate',
  alreadyHaveAccount: '¿Ya tienes una cuenta Movesbook?',
  logIn: 'Iniciar sesión',
  goToMovesbook: 'Ir a Movesbook',
  typeHereYourUsername: 'Escribe aquí tu nombre de usuario',
  usernameAvailable: 'Este nombre de usuario está disponible.',
  usernameTaken: 'Este nombre de usuario ya está en uso.',
  yourMailToRegister: 'Tu correo para registrarte',
  mailAddressPlaceholder: 'dirección de correo',
  retypeYourEmail: 'Vuelve a escribir tu correo *',
  yourPassword: 'Tu contraseña',
  retypeYourPassword: 'Vuelve a escribir la contraseña',
  typeHereYourData: 'Escribe aquí tus datos',
  country: 'País*',
  selectCountry: 'Seleccionar país',
  userType: 'Tipo de usuario*',
  selectUserType: 'Seleccionar tipo',
  selectVersion: 'Seleccionar versión',
  firstSubscriptionCost: 'Coste de la primera suscripción',
  renewalCost: 'Coste de renovación',
  gender: 'Género*',
  selectGender: 'Seleccionar género',
  male: 'Masculino',
  female: 'Femenino',
  sport: 'Deporte*',
  selectSport: 'Seleccionar deporte',
  havePromocode:
    '¿Tienes un código promocional? Si es así, escríbelo aquí para obtener un descuento y beneficios',
  discountWithPromocode: 'Descuento con código promocional',
  credits: 'Créditos',
  usernameOfWhoInvitedYou: 'Usuario de quien te invitó *',
  retypeUsername: 'Vuelve a escribir el usuario *',
  totalPayment: 'Pago total',
  payWithVirtualCard: 'Pagar con tarjeta virtual',
  register: 'Registrarse',
  registering: 'Registrando…',
  cancel: 'Cancelar',
  language: 'Idioma',
  singleUser: 'Usuario individual',
  club: 'Club',
};

const BY_LANG: Record<QuickRegisterLang, QuickRegisterStrings> = {
  en: EN,
  it: IT,
  fr: FR,
  de: DE,
  es: ES,
};

export function normalizeQuickRegisterLang(language: string | null | undefined): QuickRegisterLang {
  const code = (language || 'en').toLowerCase().slice(0, 2);
  if (code === 'it' || code === 'fr' || code === 'de' || code === 'es') return code;
  return 'en';
}

export function getQuickRegisterStrings(language: string | null | undefined): QuickRegisterStrings {
  return BY_LANG[normalizeQuickRegisterLang(language)];
}

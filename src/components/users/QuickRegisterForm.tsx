'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { COUNTRY_SELECT_OPTIONS } from '@/constants/countries.constants';
import {
  QUICK_REGISTER_SUCCESS_MESSAGE,
  type RegistrationStatus,
} from '@/lib/users/quickRegisterShared';
import { filterSportsCatalogForUserType, sportOptionsForUserType } from '@/lib/users/quickRegisterSports';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getQuickRegisterStrings,
  normalizeQuickRegisterLang,
} from '@/lib/users/quickRegisterI18n';

type VersionOption = { id: string; name: string };
type SelectOption = { id: string; name: string };

function fmtYmd(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' : ''}${m}-${day < 10 ? '0' : ''}${day}`;
}

/** Width in `ch` units sized to displayed digits (min/max caps). */
function compactInputWidth(value: string, minCh = 3, maxCh = 10): CSSProperties {
  const len = Math.max(minCh, String(value ?? '').length + 1);
  return { width: `${Math.min(maxCh, len)}ch` };
}

/** Default username: local part of the email (before @). */
function usernameDefaultFromEmail(email: string): string {
  const trimmed = email.trim();
  if (!trimmed || trimmed.includes(',')) return '';
  const at = trimmed.indexOf('@');
  if (at <= 0) return '';
  return trimmed.slice(0, at).trim();
}

export default function QuickRegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentLanguage, setLanguage } = useLanguage();
  const t = getQuickRegisterStrings(currentLanguage);

  const originEmail = searchParams?.get('user_email')?.split(',')[0]?.trim() ?? '';
  const initialPromocode = searchParams?.get('promocode')?.trim() ?? '';
  const inviteByMovesbook = searchParams?.get('invite_by') === 'movesbook';
  const inviterFromUrl = searchParams?.get('inviter')?.trim() ?? '';
  const langFromUrl = searchParams?.get('lang')?.trim() ?? '';

  const [username, setUsername] = useState(() => usernameDefaultFromEmail(originEmail));
  const [email, setEmail] = useState(originEmail);
  const [reEmail, setReEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [country, setCountry] = useState('');
  const [userType, setUserType] = useState('');
  const [versionId, setVersionId] = useState('');
  const [gender, setGender] = useState('');
  const [sport, setSport] = useState('');
  const [promocode, setPromocode] = useState(initialPromocode);
  const [inviterUsername, setInviterUsername] = useState(inviterFromUrl);
  const [confirmInviterUsername, setConfirmInviterUsername] = useState(inviterFromUrl);
  const [movesbookOfficialEmail, setMovesbookOfficialEmail] = useState('admin@movesbook.com');

  const [sports, setSports] = useState<SelectOption[]>([]);
  const [allSports, setAllSports] = useState<SelectOption[]>([]);
  const [versions, setVersions] = useState<VersionOption[]>([]);
  const [promocodeVersionIds, setPromocodeVersionIds] = useState('');
  const [inviterReadonly, setInviterReadonly] = useState(inviteByMovesbook || Boolean(inviterFromUrl));

  const [registrationType, setRegistrationType] = useState<'new' | 'renewal'>('new');
  const [registrationDetail, setRegistrationDetail] = useState<string>('new');
  const [existingUsername, setExistingUsername] = useState('');
  const [subscriptionEndDate, setSubscriptionEndDate] = useState('');
  const [versionDurationDays, setVersionDurationDays] = useState('');

  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountHidden, setDiscountHidden] = useState('');
  const [credit, setCredit] = useState('');
  const [credit2, setCredit2] = useState('');
  const [membersNumber, setMembersNumber] = useState('');
  const [totalPayment, setTotalPayment] = useState('');
  const [payWithVirtualCard, setPayWithVirtualCard] = useState(true);
  const [tripleDurationDays, setTripleDurationDays] = useState('');
  const [tripleDurationPrice, setTripleDurationPrice] = useState('');
  const [tripleDurationDiscount, setTripleDurationDiscount] = useState('');
  const [useTripleSubscription, setUseTripleSubscription] = useState(false);

  const [promoFeedback, setPromoFeedback] = useState<{ text: string; kind: 'success' | 'error' | '' }>({
    text: '',
    kind: '',
  });
  const [emailStatus, setEmailStatus] = useState('');
  const [registrationStatusMessage, setRegistrationStatusMessage] = useState('');
  const [usernameStatus, setUsernameStatus] = useState('');
  const [usernameStatusColor, setUsernameStatusColor] = useState('#116611');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const initDone = useRef(false);
  const usernameEditedRef = useRef(false);
  const reEmailTouchedRef = useRef(false);
  const [reEmailConfirmReady, setReEmailConfirmReady] = useState(false);

  const handleReEmailFocus = () => {
    reEmailTouchedRef.current = true;
    setReEmailConfirmReady(true);
  };

  const handleReEmailChange = (value: string) => {
    reEmailTouchedRef.current = true;
    setReEmail(value);
  };

  const clearReEmailAutofill = useCallback(() => {
    if (!reEmailTouchedRef.current) {
      setReEmail('');
    }
  }, []);

  useEffect(() => {
    if (!langFromUrl) return;
    setLanguage(normalizeQuickRegisterLang(langFromUrl));
  }, [langFromUrl, setLanguage]);

  useEffect(() => {
    const timers = [0, 50, 150, 350, 700].map((ms) =>
      window.setTimeout(() => clearReEmailAutofill(), ms)
    );
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [clearReEmailAutofill]);

  const applyUsernameFromEmail = useCallback((emailVal: string, opts?: { force?: boolean }) => {
    if (usernameEditedRef.current && !opts?.force) return;
    const suggested = usernameDefaultFromEmail(emailVal);
    if (suggested) setUsername(suggested);
  }, []);

  const clearSubscriptionDetails = useCallback(() => {
    setCredit('');
    setCredit2('');
    setPrice('');
    setDiscount('');
    setDiscountHidden('');
    setMembersNumber('');
    setTotalPayment('');
    setVersionDurationDays('');
    setTripleDurationDays('');
    setTripleDurationPrice('');
    setTripleDurationDiscount('');
    setUseTripleSubscription(false);
  }, []);

  const applyRegistrationStatus = useCallback(
    (status: RegistrationStatus, opts?: { showEmailStatus?: boolean }) => {
      setRegistrationType(status.type);
      setRegistrationDetail(status.detail);
      setSubscriptionEndDate(status.subscription_end_date ?? '');
      setExistingUsername(status.existing_username ?? '');

      if (opts?.showEmailStatus !== false) {
        if (status.type === 'renewal') {
          setEmailStatus('Renew');
        } else {
          setEmailStatus('New');
        }
      }

      if (status.detail === 'renewal_active') {
        setRegistrationStatusMessage(
          'Your subscription is still active. Renewal will start the day after your current subscription ends.'
        );
      } else if (status.detail === 'renewal_expired') {
        setRegistrationStatusMessage(
          'Your previous subscription has ended. A new subscription period will start from today when you complete registration.'
        );
      } else {
        setRegistrationStatusMessage('');
      }
    },
    []
  );

  const loadSubscriptionData = useCallback(
    async (opts?: {
      userTypeVal?: string;
      versionVal?: string;
      promo?: string;
      regType?: string;
      countryVal?: string;
    }) => {
      const ut = opts?.userTypeVal ?? userType;
      const vid = opts?.versionVal ?? versionId;
      if (!ut || !vid) {
        clearSubscriptionDetails();
        return;
      }

      try {
        const res = await fetch('/api/users/quick-register/subscription-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userType: ut,
            version_id: vid,
            promocode: opts?.promo ?? promocode,
            country: opts?.countryVal ?? country,
            registration_type: (opts?.regType ?? registrationType) === 'renewal' ? 'renewal' : 'first',
          }),
        });
        const data = await res.json();
        if (!data || typeof data !== 'object') {
          clearSubscriptionDetails();
          return;
        }

        const rec = data;
        const priceVal = rec.price != null && rec.price !== '' ? String(rec.price) : '';
        const discountVal =
          rec.discount_with_promocode != null && rec.discount_with_promocode !== ''
            ? String(rec.discount_with_promocode)
            : '';

        setCredit(rec.credit2 != null ? String(rec.credit2) : '');
        setCredit2(rec.credit != null ? String(rec.credit) : '');

        const duration =
          rec.days_duration != null && rec.days_duration !== '' ? parseInt(String(rec.days_duration), 10) : NaN;
        setVersionDurationDays(Number.isFinite(duration) ? String(duration) : '');

        setTripleDurationDays(
          rec.triple_duration_days != null ? String(rec.triple_duration_days) : ''
        );
        setTripleDurationPrice(
          rec.triple_duration_price != null ? String(rec.triple_duration_price) : ''
        );
        setTripleDurationDiscount(
          rec.triple_duration_discount != null ? String(rec.triple_duration_discount) : ''
        );
        setUseTripleSubscription(false);

        const regType = opts?.regType ?? registrationType;
        let membersVal = '';
        if (String(ut) === '8') {
          membersVal = rec.members_number1 != null ? String(rec.members_number1) : '';
        } else if (regType === 'renewal') {
          membersVal = rec.members_number2 != null ? String(rec.members_number2) : '';
        } else {
          membersVal = rec.members_number1 != null ? String(rec.members_number1) : '';
        }
        setMembersNumber(membersVal);

        setPrice(priceVal);
        setDiscount(discountVal);
        setDiscountHidden(discountVal);

        const priceNum = parseFloat(priceVal);
        const discNum = parseFloat(discountVal);
        const activePrice = priceNum;
        if (Number.isFinite(activePrice) && Number.isFinite(discNum)) {
          setTotalPayment((activePrice * (1 - discNum / 100)).toFixed(2));
        } else if (Number.isFinite(activePrice)) {
          setTotalPayment(activePrice.toFixed(2));
        } else {
          setTotalPayment('');
        }
      } catch {
        clearSubscriptionDetails();
      }
    },
    [userType, versionId, promocode, registrationType, country, clearSubscriptionDetails]
  );

  const validatePromocode = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) {
        setPromoFeedback({ text: '', kind: '' });
        setDiscount('');
        return { success: false };
      }

      const params = new URLSearchParams({ promocode: trimmed });
      if (inviteByMovesbook) {
        params.set('invite_email', movesbookOfficialEmail.trim().toLowerCase());
      } else if (inviterUsername.trim()) {
        params.set('inviter_username', inviterUsername.trim());
      } else {
        const inviteEmail = originEmail || email.trim().toLowerCase();
        if (inviteEmail) params.set('invite_email', inviteEmail);
      }

      try {
        const res = await fetch(`/api/users/quick-register/validate-promocode?${params.toString()}`);
        const data = await res.json();
        if (data.success) {
          setPromoFeedback({ text: data.message, kind: 'success' });
          if (data.data?.version_id) {
            setPromocodeVersionIds(String(data.data.version_id));
          }
          if (userType && versionId) {
            void loadSubscriptionData({ promo: trimmed });
          }
          return data;
        }
        setPromoFeedback({ text: data.message || 'Invalid promocode', kind: 'error' });
        setDiscount('');
        return data;
      } catch {
        setPromoFeedback({ text: 'Could not validate promocode.', kind: 'error' });
        return { success: false };
      }
    },
    [
      inviteByMovesbook,
      movesbookOfficialEmail,
      inviterUsername,
      originEmail,
      email,
      userType,
      versionId,
      loadSubscriptionData,
    ]
  );

  const loadVersions = useCallback(
    async (userTypeVal: string, versionIds: string) => {
      if (!userTypeVal) {
        setVersions([]);
        setVersionId('');
        clearSubscriptionDetails();
        return;
      }
      setLoadingVersions(true);
      try {
        const res = await fetch('/api/users/quick-register/versions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userType: userTypeVal, promocodeVersionIds: versionIds }),
        });
        const data = await res.json();
        const list: VersionOption[] = Object.entries(data ?? {}).map(([id, name]) => ({
          id,
          name: String(name),
        }));
        setVersions(list);
        setVersionId('');
        clearSubscriptionDetails();
      } catch {
        setVersions([]);
      } finally {
        setLoadingVersions(false);
      }
    },
    [clearSubscriptionDetails]
  );

  const applySportsForUserType = useCallback(
    (type: string, catalog: SelectOption[]) => {
      if (!type) {
        setSports(catalog.length > 0 ? catalog : [...sportOptionsForUserType('5')]);
        return;
      }
      const next = filterSportsCatalogForUserType(type, catalog);
      setSports(next);
      setSport((prev) => (next.some((s) => s.id === prev) ? prev : ''));
    },
    []
  );

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    const params = new URLSearchParams();
    if (originEmail) params.set('user_email', originEmail);
    if (initialPromocode) params.set('promocode', initialPromocode);
    if (inviteByMovesbook) params.set('invite_by', 'movesbook');
    if (inviterFromUrl) params.set('inviter', inviterFromUrl);

    void fetch(`/api/users/quick-register/init?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.movesbookOfficialEmail) setMovesbookOfficialEmail(data.movesbookOfficialEmail);
        if (data.inviterUsername) {
          setInviterUsername(data.inviterUsername);
          setConfirmInviterUsername(data.inviterUsername);
        }
        if (typeof data.inviterReadonly === 'boolean') setInviterReadonly(data.inviterReadonly);
        if (data.promocodeAllowedVersionIds) setPromocodeVersionIds(data.promocodeAllowedVersionIds);
        if (Array.isArray(data.sports) && data.sports.length > 0) {
          setAllSports(data.sports);
          applySportsForUserType(userType, data.sports);
        } else {
          setAllSports([]);
          applySportsForUserType(userType, []);
        }
      })
      .catch(() => undefined);

    if (originEmail) {
      void fetch(
        `/api/users/quick-register/detect-registration-status?email=${encodeURIComponent(originEmail)}`
      )
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.status) {
            applyRegistrationStatus(data.status, { showEmailStatus: false });
            if (data.status.type === 'renewal' && data.status.existing_username) {
              setUsername(data.status.existing_username);
              usernameEditedRef.current = true;
            } else {
              applyUsernameFromEmail(originEmail);
            }
          }
        })
        .catch(() => undefined);
    }

    if (initialPromocode) {
      void validatePromocode(initialPromocode);
    }
  }, [originEmail, initialPromocode, inviteByMovesbook, inviterFromUrl, applyRegistrationStatus, validatePromocode, applyUsernameFromEmail]);

  const handleEmailChange = async () => {
    const val = email.trim();
    if (!val) {
      setEmailStatus('');
      setRegistrationStatusMessage('');
      setRegistrationType('new');
      setRegistrationDetail('new');
      return;
    }

    try {
      const res = await fetch(
        `/api/users/quick-register/detect-registration-status?email=${encodeURIComponent(val)}`
      );
      const data = await res.json();
      if (data.success && data.status) {
        applyRegistrationStatus(data.status);
        if (data.status.type === 'renewal' && data.status.existing_username) {
          setUsername(data.status.existing_username);
          usernameEditedRef.current = true;
        } else {
          applyUsernameFromEmail(val);
        }
        if (userType && versionId) {
          void loadSubscriptionData({ regType: data.status.type });
        }
      }
    } catch {
      setEmailStatus('');
    }
    void handleUsernameBlur();
  };

  const handleUsernameBlur = async () => {
    const u = username.trim();
    setUsernameStatus('');
    if (u.length < 5) return;

    if (registrationType === 'renewal' && existingUsername && u.toLowerCase() === existingUsername.toLowerCase()) {
      setUsernameStatus(t.usernameMatchesExisting);
      setUsernameStatusColor('#0d47a1');
      return;
    }
    if (registrationType === 'renewal') return;

    try {
      const params = new URLSearchParams({ username: u, email: email.trim().toLowerCase() });
      const res = await fetch(`/api/users/quick-register/check-username?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUsernameStatus(t.usernameVerifyFailed);
        setUsernameStatusColor('#a61b1b');
        return;
      }
      if (data.available) {
        setUsernameStatus(t.usernameAvailable);
        setUsernameStatusColor('#116611');
      } else {
        setUsernameStatus(data.message || t.usernameTaken);
        setUsernameStatusColor('#a61b1b');
      }
    } catch {
      setUsernameStatus(t.usernameVerifyFailed);
      setUsernameStatusColor('#a61b1b');
    }
  };

  const handleUserTypeChange = (value: string) => {
    setUserType(value);
    applySportsForUserType(value, allSports);
    void loadVersions(value, promocodeVersionIds);
  };

  const handleVersionChange = (value: string) => {
    setVersionId(value);
    if (value) {
      void loadSubscriptionData({ versionVal: value, userTypeVal: userType });
    } else {
      clearSubscriptionDetails();
    }
  };

  useEffect(() => {
    if (!userType || !versionId) return;
    void loadSubscriptionData({ regType: registrationType });
  }, [registrationType, userType, versionId, loadSubscriptionData]);

  useEffect(() => {
    const basePrice = useTripleSubscription ? tripleDurationPrice : price;
    const priceNum = parseFloat(basePrice);
    const discNum = parseFloat(discount);
    if (Number.isFinite(priceNum) && Number.isFinite(discNum)) {
      setTotalPayment((priceNum * (1 - discNum / 100)).toFixed(2));
    } else if (Number.isFinite(priceNum)) {
      setTotalPayment(priceNum.toFixed(2));
    }
  }, [useTripleSubscription, price, tripleDurationPrice, discount]);

  const confirmRenewal = (): boolean => {
    if (registrationType !== 'renewal') return true;

    const dur = parseInt(versionDurationDays, 10);
    const durationValid = Number.isFinite(dur) && dur > 0 ? dur : null;

    if (registrationDetail === 'renewal_expired') {
      if (
        !window.confirm(
          'You already have an account with this email. Your previous subscription has ended. A new subscription will start from today. Do you want to continue?'
        )
      ) {
        return false;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let newEndExpired = '';
      if (durationValid) {
        const de = new Date(today.getTime());
        de.setDate(de.getDate() + durationValid);
        newEndExpired = fmtYmd(de);
      }
      let msg2 =
        'Your new subscription will run from today' + (newEndExpired ? ` until ${newEndExpired}` : '');
      msg2 += '. Duration, price and discount for the selected version will apply. Do you want to proceed?';
      return window.confirm(msg2);
    }

    if (
      !window.confirm(
        'You already have an account with this username and email. If you proceed, your current subscription will be extended. Do you want to continue?'
      )
    ) {
      return false;
    }

    let newEndDateStr = '';
    if (subscriptionEndDate && durationValid) {
      const d = new Date(subscriptionEndDate);
      if (!Number.isNaN(d.getTime())) {
        d.setDate(d.getDate() + 1 + durationValid);
        newEndDateStr = fmtYmd(d);
      }
    }
    let msg2 = 'The current subscription will be extended from the day after your current period ends';
    if (newEndDateStr) msg2 += ` until ${newEndDateStr}`;
    msg2 += '. Duration, price and discount of the renewal will be applied. Do you want to proceed?';
    return window.confirm(msg2);
  };

  const handleRegister = async () => {
    setError('');
    setSuccessMessage('');

    if (registrationType === 'renewal' && existingUsername) {
      if (username.trim().toLowerCase() !== existingUsername.toLowerCase()) {
        setError(
          `You already have an account with this email address. Please use your existing username: ${existingUsername}`
        );
        return;
      }
    }

    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }
    if (username.trim().length < 5) {
      setError('Your username must be at least 5 characters long');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (!reEmail.trim()) {
      setError('Please Retype your email');
      return;
    }
    if (email.trim().toLowerCase() !== reEmail.trim().toLowerCase()) {
      setError('Please Retype same email');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }
    if (password.length < 5) {
      setError('Your password must be at least 5 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Please enter the same password as above');
      return;
    }
    if (!country) {
      setError('Please select your country');
      return;
    }
    if (!userType) {
      setError('Please select your user type');
      return;
    }
    if (!versionId) {
      setError('Please select a subscription version');
      return;
    }
    if (!gender) {
      setError('Please select gender');
      return;
    }
    if (!sport) {
      setError('Please select your sport');
      return;
    }

    const code = promocode.trim();
    if (code) {
      const promoResult = await validatePromocode(code);
      if (!promoResult.success) {
        setError(
          (promoResult as { message?: string }).message || 'This promocode is invalid or has expired.'
        );
        return;
      }
    }

    if (registrationType === 'new') {
      try {
        const params = new URLSearchParams({
          username: username.trim(),
          email: email.trim().toLowerCase(),
        });
        const res = await fetch(`/api/users/quick-register/check-username?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError('Could not verify username. Please try again.');
          return;
        }
        if (!data.available) {
          setError(data.message || 'This username is already taken. Please choose another.');
          return;
        }
      } catch {
        setError('Could not verify username. Please try again.');
        return;
      }
    }

    if (!confirmRenewal()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/users/quick-register/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          re_email: reEmail.trim(),
          password,
          confim_password: confirmPassword,
          country,
          usertype: userType,
          version_id: versionId,
          gender,
          sport,
          promocode: code,
          inviter_username: inviterUsername.trim() || undefined,
          confirm_inviter_username: confirmInviterUsername.trim() || undefined,
          invite_by_movesbook: inviteByMovesbook,
          origin_email: originEmail || undefined,
          disccount_hidden: discountHidden,
          payment_method: payWithVirtualCard ? 'virtual_card' : 'standard',
          total_payment: totalPayment,
        }),
      });
      const raw = await res.text();
      let data: { success?: boolean; message?: string; error?: string } | null = null;
      if (raw.trim()) {
        try {
          data = JSON.parse(raw) as { success?: boolean; message?: string; error?: string };
        } catch {
          throw new Error('Registration failed: invalid server response.');
        }
      }
      if (!data) {
        throw new Error(
          res.ok
            ? 'Registration failed: empty server response.'
            : `Registration failed (${res.status}). Please try again.`
        );
      }
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Registration failed');
      }
      setSuccessMessage(data.message || QUICK_REGISTER_SUCCESS_MESSAGE);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="quickregistration" style={{ marginTop: 20 }}>
      <div className="quickregi-title">{t.registerYourself}</div>
      <div className="quickregi-subtitle">
        {t.alreadyHaveAccount}{' '}
        <Link href="/login" target="_blank">
          {t.logIn}
        </Link>
      </div>

      {successMessage ? (
        <div className="qr-registration-success" role="status">
          <p>{successMessage}</p>
          <Link href="/login" className="btnRed qr-registration-success-link">
            {t.goToMovesbook}
          </Link>
        </div>
      ) : null}

      <form
        id="quick-register-form"
        onSubmit={(e) => e.preventDefault()}
        noValidate
        autoComplete="off"
        style={{ display: successMessage ? 'none' : undefined }}
      >
        {inviteByMovesbook ? <input type="hidden" name="invite_by_movesbook" value="1" /> : null}
        <input type="hidden" name="origin_email" id="origin_email" value={originEmail} />
        <input type="hidden" id="registration_type" value={registrationType} />
        <input type="hidden" id="registration_detail" value={registrationDetail} />
        <input type="hidden" id="subscription_end_date" value={subscriptionEndDate} />
        <input type="hidden" id="existing_username" value={existingUsername} />
        <input type="hidden" id="version_duration_days" value={versionDurationDays} />
        {/* Absorb browser autofill so the confirmation field stays empty */}
        <input
          type="email"
          name="email"
          tabIndex={-1}
          autoComplete="email"
          className="qr-autofill-trap"
          aria-hidden="true"
          defaultValue=""
          readOnly
        />

        <div className="quickregi-form">
          <div className="quickregi-left" style={{ border: 'none', paddingRight: 0 }}>
            {error ? <div className="red">{error}</div> : null}

            <div className="div-row">
              <span className="span-label-title">{t.typeHereYourUsername}</span>
              <input
                style={{ border: '2px solid #7f7f7f !important' }}
                type="text"
                placeholder={t.usernamePlaceholder}
                name="username"
                id="textUsername"
                value={username}
                autoComplete="off"
                onChange={(e) => {
                  usernameEditedRef.current = true;
                  setUsername(e.target.value);
                }}
                onBlur={() => void handleUsernameBlur()}
              />
              {usernameStatus ? (
                <div
                  id="username-status"
                  style={{ marginTop: 6, fontWeight: 'bold', color: usernameStatusColor }}
                >
                  {usernameStatus}
                </div>
              ) : null}
            </div>

            <div className="div-line" />

            <div className="div-row">
              <span className="span-label-title">{t.yourMailToRegister}</span>
              <input
                style={{ border: '2px solid #7f7f7f !important' }}
                type="email"
                className="input-highlight"
                placeholder={t.mailAddressPlaceholder}
                name="register_email"
                id="textEmail"
                value={email}
                autoComplete="email"
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                onBlur={() => void handleEmailChange()}
              />
              <div
                id="email-status"
                style={{
                  marginTop: 6,
                  fontWeight: 'bold',
                  color:
                    emailStatus === 'Renew'
                      ? '#610d1c'
                      : emailStatus === 'New'
                        ? '#116611'
                        : '#6e1a27',
                }}
              >
                {emailStatus}
              </div>
            </div>

            <div
              id="registration-status-message"
              className={`registration-status-message${
                registrationDetail === 'renewal_active'
                  ? ' status-renewal-active'
                  : registrationDetail === 'renewal_expired'
                    ? ' status-renewal'
                    : ''
              }`}
              style={{ display: registrationStatusMessage ? 'block' : 'none' }}
            >
              {registrationStatusMessage}
            </div>

            <div className="div-row">
              <span className="span-label-title">{t.retypeYourEmail}</span>
              <input
                style={{ border: '2px solid #7f7f7f !important' }}
                type="text"
                inputMode="email"
                className="input-highlight qr-email-confirm-input"
                placeholder={t.retypeYourEmail}
                name="register_email_confirm"
                id="textReEmail"
                value={reEmail}
                readOnly={!reEmailConfirmReady}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore
                data-form-type="other"
                onFocus={handleReEmailFocus}
                onChange={(e) => handleReEmailChange(e.target.value)}
                onAnimationStart={(e) => {
                  if (e.animationName === 'qr-detect-autofill' && !reEmailTouchedRef.current) {
                    setReEmail('');
                  }
                }}
              />
            </div>

            <div className="div-line" />

            <div className="div-row">
              <span className="span-label-title">{t.yourPassword}</span>
              <input
                style={{ border: '2px solid #7f7f7f !important' }}
                type="password"
                className="password-highlight"
                placeholder={t.passwordPlaceholder}
                name="password"
                id="textPassword"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="div-row">
              <input
                style={{ border: '2px solid #7f7f7f !important' }}
                type="password"
                className="password-highlight"
                placeholder={t.retypeYourPassword}
                name="confim_password"
                id="textRePassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="div-line" />

            <div className="div-row">
              <span className="span-label-title">{t.typeHereYourData}</span>
            </div>

            <div className="qr-data-section">
              <div className="qr-field-row">
                <span className="qr-label">{t.country}</span>
                <div className="qr-control">
                  <select
                    id="sltCountry"
                    name="country"
                    value={country}
                    onChange={(e) => {
                      const next = e.target.value;
                      setCountry(next);
                      if (userType && versionId) {
                        void loadSubscriptionData({ promo: promocode, countryVal: next });
                      }
                    }}
                  >
                    <option value="">{t.selectCountry}</option>
                    {COUNTRY_SELECT_OPTIONS.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="qr-hint">{t.countryHint}</span>
              </div>

              <div className="qr-field-row qr-field-row-plan">
                <span className="qr-label">{t.userType}</span>
                <div className="qr-control">
                  <select
                    id="sltUsertype"
                    name="usertype"
                    value={userType}
                    onChange={(e) => handleUserTypeChange(e.target.value)}
                  >
                    <option value="">{t.selectUserType}</option>
                    <option value="5">{t.singleUser}</option>
                    <option value="8">{t.club}</option>
                  </select>
                </div>
                <span className="qr-hint">{t.userTypeHint}</span>
                <div className="qr-control qr-control-version">
                  <select
                    id="version"
                    name="version_id"
                    value={versionId}
                    onChange={(e) => handleVersionChange(e.target.value)}
                    disabled={loadingVersions || !userType}
                  >
                    <option value="">{loadingVersions ? t.loading : t.selectVersion}</option>
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="qr-hint">{t.versionHint}</span>
                {!loadingVersions && userType && versions.length === 0 ? (
                  <span className="qr-hint qr-hint-block">{t.noVersions}</span>
                ) : null}
              </div>

              <div className="qr-field-row qr-pricing-one-row">
                <input
                  type="text"
                  className="qr-input-numeric"
                  id="price"
                  readOnly
                  value={useTripleSubscription ? tripleDurationPrice : price}
                  style={compactInputWidth(useTripleSubscription ? tripleDurationPrice : price, 3, 8)}
                />
                {versionDurationDays ? (
                  <span className="qr-hint qr-hint-inline">
                    {t.duration}: {useTripleSubscription ? tripleDurationDays : versionDurationDays} days
                  </span>
                ) : (
                  <span className="qr-hint qr-hint-inline" />
                )}
                {tripleDurationPrice ? (
                  <label className="qr-triple-inline">
                    <input
                      type="checkbox"
                      checked={useTripleSubscription}
                      onChange={(e) => setUseTripleSubscription(e.target.checked)}
                    />
                    <span>
                      {t.tripleSubscription} — {tripleDurationPrice}
                      {tripleDurationDiscount ? ` (${tripleDurationDiscount}% ${t.discountPct})` : ''}
                      {tripleDurationDays ? ` · ${tripleDurationDays} days` : ''}
                    </span>
                  </label>
                ) : (
                  <span />
                )}
                <span className="qr-label-inline qr-cost-label">
                  {registrationType === 'renewal' ? t.renewalCost : t.firstSubscriptionCost}
                </span>
              </div>

              <div className="qr-field-row">
                <span className="qr-label">{t.gender}</span>
                <div className="qr-control">
                  <select id="sltGender" name="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">{t.selectGender}</option>
                    <option value="M">{t.male}</option>
                    <option value="F">{t.female}</option>
                  </select>
                </div>
              </div>

              <div className="qr-field-row">
                <span className="qr-label">{t.sport}</span>
                <div className="qr-control">
                  <select id="sltSport" name="sport" value={sport} onChange={(e) => setSport(e.target.value)}>
                    <option value="">{t.selectSport}</option>
                    {(sports.length > 0 ? sports : sportOptionsForUserType(userType || '5')).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="qr-promo-section">
              <div className="qr-promo-intro-row">
                <span className="qr-promo-intro-label">{t.havePromocode}</span>
                <input
                  type="text"
                  className="qr-row-input qr-promo-intro-input input-highlight-promocode"
                  name="promocode"
                  value={promocode}
                  id="promocode"
                  onChange={(e) => setPromocode(e.target.value)}
                  onBlur={() => void validatePromocode(promocode)}
                  style={compactInputWidth(promocode || 'promocode', 12, 24)}
                />
                <span className="qr-hint qr-promo-intro-aside">{t.promocodeEarnHint}</span>
              </div>
              <div className="qr-promo-banner">{t.promocodeBanner}</div>

              <div className="qr-promo-discount-row">
                <div className="qr-promo-discount-control">
                  <span className="qr-promo-label">{t.discountWithPromocode}</span>
                  <input
                    type="text"
                    className="qr-input-numeric"
                    id="discount_with_promocode"
                    value={discount}
                    readOnly
                    style={compactInputWidth(discount, 3, 6)}
                  />
                </div>
                {promoFeedback.text ? (
                  <div
                    id="promocode-feedback"
                    className={`promocode-feedback ${promoFeedback.kind === 'success' ? 'promo-success' : 'promo-error'}`}
                  >
                    {promoFeedback.text}
                  </div>
                ) : null}
              </div>

              <div className="qr-promo-credits">
                <div className="qr-promo-credits-title">{t.credits}</div>
                <div className="qr-promo-credit-row">
                  <span className="qr-hint">{t.creditReceiverHint}</span>
                  <input
                    type="text"
                    className="qr-input-numeric credit"
                    id="credit"
                    readOnly
                    value={credit}
                    style={compactInputWidth(credit, 3, 8)}
                  />
                </div>
                <div className="qr-promo-credit-row">
                  <span className="qr-hint">{t.creditSenderHint}</span>
                  <input
                    type="text"
                    className="qr-input-numeric credit2"
                    id="credit2"
                    readOnly
                    value={credit2}
                    style={compactInputWidth(credit2, 3, 8)}
                  />
                </div>
                <div className="qr-promo-credit-row">
                  <span className="qr-hint">{t.membersHint}</span>
                  <input
                    type="text"
                    className="qr-input-numeric"
                    id="members_number"
                    readOnly
                    value={membersNumber}
                    style={compactInputWidth(membersNumber, 3, 10)}
                  />
                </div>
              </div>

              <div className="qr-invite-fields">
                {inviteByMovesbook ? (
                  <>
                    <div className="qr-aligned-row">
                      <span className="qr-row-label">{t.officialInviteEmail}</span>
                      <input
                        type="text"
                        className="qr-row-input input-highlight"
                        value={movesbookOfficialEmail}
                        id="sender_email"
                        readOnly
                      />
                    </div>
                    <p className="qr-note">{t.officialInviteNote}</p>
                  </>
                ) : (
                  <>
                    <div className="qr-aligned-row">
                      <span className="qr-row-label">{t.usernameOfWhoInvitedYou}</span>
                      <input
                        type="text"
                        name="inviter_username"
                        className="qr-row-input input-highlight"
                        style={{ background: inviterReadonly ? '#eee' : undefined }}
                        value={inviterUsername}
                        id="inviter_username"
                        readOnly={inviterReadonly}
                        onChange={(e) => setInviterUsername(e.target.value)}
                      />
                      <span className="qr-row-label">{t.retypeUsername}</span>
                      <input
                        type="text"
                        name="confirm_inviter_username"
                        className="qr-row-input input-highlight"
                        style={{ background: inviterReadonly ? '#eee' : undefined }}
                        value={confirmInviterUsername}
                        id="confirm_inviter_username"
                        readOnly={inviterReadonly}
                        onChange={(e) => setConfirmInviterUsername(e.target.value)}
                      />
                    </div>
                    {inviterReadonly ? (
                      <p className="qr-note">{t.inviteFilledNote}</p>
                    ) : null}
                  </>
                )}

              </div>

              <div className="div-row" id="total-payment-row">
                <div className="payment-row-item">
                  <span className="qr-payment-label">{t.totalPayment}</span>
                  <input
                    type="text"
                    className="payment-total-input qr-input-numeric"
                    id="total_payment"
                    value={totalPayment}
                    readOnly
                    style={compactInputWidth(totalPayment, 5, 12)}
                  />
                </div>
                <div className="payment-row-item payment-logos">
                  <label className="inline-flex items-center gap-2 text-sm mr-3" style={{ color: '#7b0a26' }}>
                    <input
                      type="checkbox"
                      checked={payWithVirtualCard}
                      onChange={(e) => setPayWithVirtualCard(e.target.checked)}
                    />
                    {t.payWithVirtualCard}
                  </label>
                  <Image src="/img/payment_logo/logo_visa.svg" alt="Visa" width={45} height={28} />
                  <Image src="/img/payment_logo/logo_mc.svg" alt="Mastercard" width={45} height={28} />
                  <Image src="/img/payment_logo/logo_discover.svg" alt="Discover" width={45} height={28} />
                  <Image src="/img/payment_logo/logo_paypal.svg" alt="PayPal" width={45} height={28} />
                  <Image src="/img/payment_logo/logo_amex.svg" alt="Amex" width={45} height={28} />
                </div>
                <div className="payment-row-item payment-actions">
                  <input
                    className="btnRed btn-register-lg"
                    type="button"
                    value={loading ? t.registering : t.register}
                    disabled={loading}
                    onClick={() => void handleRegister()}
                  />
                  <input
                    className="button-black-promocode btn-register-lg"
                    type="button"
                    value={t.cancel}
                    onClick={() => router.push('/')}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

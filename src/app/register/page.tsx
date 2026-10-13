'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { COUNTRIES } from '@/lib/news/countries';
import { ALL_COUNTRIES } from '@/constants/countries.constants';
import { SUPPORTED_LANGUAGES } from '@/constants/tools.constants';
import WaysToGetStartedSection from '@/components/register/WaysToGetStartedSection';
import {
  getDefaultVersionId,
  type RegistrationUserType,
} from '@/lib/registration/waysToGetStarted';
import type { CountryPriceInfo } from '@/lib/countries/countryPriceFormula';

export default function RegisterPage() {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    firstName: '',
    surname: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    userType: 'athlete' as 'athlete' | 'coach' | 'team' | 'club' | 'group',
    gender: '' as '' | 'male' | 'female' | 'other',
    birthdate: '',
    country: '',
    language: 'en',
    subscriptionVersionId: getDefaultVersionId('athlete') as number | null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [specialOfferVersionId, setSpecialOfferVersionId] = useState<number | null>(null);
  const [countryPrice, setCountryPrice] = useState<CountryPriceInfo | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!formData.country) {
      setCountryPrice(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/public/country-pricing?country=${encodeURIComponent(formData.country)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: CountryPriceInfo | null) => {
        if (!cancelled) setCountryPrice(data);
      })
      .catch(() => {
        if (!cancelled) setCountryPrice(null);
      });
    return () => {
      cancelled = true;
    };
  }, [formData.country]);

  const specialOfferConfirmed =
    specialOfferVersionId !== null && specialOfferVersionId === formData.subscriptionVersionId;
  const selectedVersionId = formData.subscriptionVersionId;
  const handleSpecialOfferConfirmChange = useCallback(
    (confirmed: boolean) => setSpecialOfferVersionId(confirmed ? selectedVersionId : null),
    [selectedVersionId],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError(t('alert_password_mismatch'));
      setIsLoading(false);
      return;
    }
    
    // Validate country selection
    if (!formData.country) {
      setError('Please select your country');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${formData.firstName} ${formData.surname}`.trim(),
          firstName: formData.firstName,
          surname: formData.surname,
          username: formData.username,
          email: formData.email,
          password: formData.password,
          userType: formData.userType,
          gender: formData.gender || undefined,
          birthdate: formData.birthdate || undefined,
          country: formData.country,
          language: formData.language,
          subscriptionVersionId: formData.subscriptionVersionId ?? undefined,
          useSpecialOffer: specialOfferConfirmed,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.specialOfferUnavailable) setSpecialOfferVersionId(null);
        if (data.resumePaymentId) {
          router.push(`/register/payment/${encodeURIComponent(data.resumePaymentId)}`);
          return;
        }
        throw new Error(data.error || 'Registration failed');
      }

      setSuccess(true);
      router.push(typeof data.next === 'string' && data.next ? data.next : '/?showLogin=true');

    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.push('/');
  };

  const handleLoginClick = () => {
    router.push('/?showLogin=true');
  };

  return (
    <div className="min-h-screen flex items-start justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 py-12">
      {/* Background Image with Overlay */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/images/licensed-image.jpg"
          alt="Workout Dashboard"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black bg-opacity-60"></div>
      </div>

      {/* Back Button */}
      <div className="absolute top-6 left-6 z-10">
        <button
          onClick={handleBack}
          className="flex items-center text-white hover:text-gray-200 transition-colors bg-white bg-opacity-10 backdrop-blur-sm px-4 py-2 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          {t('btn_back_to_home')}
        </button>
      </div>

      {/* Centered Transparent Form */}
      <div className="relative z-10 w-full max-w-2xl mb-12">
        <div className="bg-white bg-opacity-10 backdrop-blur-xl rounded-3xl shadow-2xl border border-cyan-500 border-opacity-30 p-6 overflow-visible">
          {/* Logo and Header */}
          <div className="text-center mb-5">
            <h1 className="text-3xl font-bold text-white mb-1">MovesBook</h1>
            <p className="text-cyan-100 text-base">{t('auth_join_community')}</p>
          </div>

          {error && (
            <div className="bg-red-500 bg-opacity-20 backdrop-blur-sm border border-red-400 border-opacity-30 text-red-200 px-3 py-2 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500 bg-opacity-20 backdrop-blur-sm border border-green-400 border-opacity-30 text-green-200 px-3 py-2 rounded-xl mb-4 text-sm">
              {t('auth_registration_success')}
            </div>
          )}
          <form className="space-y-4 pb-8" onSubmit={handleSubmit}>
            {/* User Type Selection - Full Width */}
            <div>
              <label htmlFor="user-type" className="block text-sm font-medium text-white mb-2">
                {t('auth_select_user_type')}: <span className="text-red-400">*</span>
              </label>
              <select
                id="user-type"
                name="userType"
                required
                className="w-full px-4 py-2.5 bg-white bg-opacity-10 backdrop-blur-sm border border-cyan-500 border-opacity-30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-200"
                style={{ color: formData.userType ? 'white' : '#a0d2eb' }}
                value={formData.userType}
                onChange={(e) => {
                  const userType = e.target.value as RegistrationUserType;
                  setFormData({
                    ...formData,
                    userType,
                    subscriptionVersionId: getDefaultVersionId(userType),
                  });
                }}
              >
                <option value="athlete" className="text-gray-800">Athlete</option>
                <option value="coach" className="text-gray-800">Coach</option>
                <option value="team" className="text-gray-800">Team</option>
                <option value="club" className="text-gray-800">Club</option>
                <option value="group" className="text-gray-800">Group</option>
              </select>
            </div>

            {/* Country - prices below depend on it */}
            <div className="relative">
              <label htmlFor="country" className="block text-sm font-medium text-white mb-2">
                Country <span className="text-red-400">*</span>
              </label>
              <select
                id="country"
                name="country"
                required
                size={1}
                className="w-full px-4 py-2.5 bg-white bg-opacity-10 backdrop-blur-sm border border-cyan-500 border-opacity-30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-200 appearance-none cursor-pointer"
                style={{
                  color: formData.country ? 'white' : '#a0d2eb',
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23a0d2eb' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.5rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em',
                  paddingRight: '2.5rem',
                  WebkitAppearance: 'menulist',
                  MozAppearance: 'menulist'
                }}
                value={formData.country}
                onChange={(e) => setFormData({...formData, country: e.target.value})}
              >
                <option value="" className="text-gray-400 bg-gray-800">Select country</option>
                {COUNTRIES.map((country) => (
                  <option key={country} value={country} className="text-white bg-gray-800">
                    {country}
                  </option>
                ))}
              </select>
              {countryPrice &&
              countryPrice.currencyCode &&
              countryPrice.currencyCode !== 'EUR' &&
              countryPrice.eurToLocal ? (
                <p className="mt-1 text-xs text-cyan-100">
                  Prices for {formData.country} are shown in EUR and {countryPrice.currencyCode}
                  {countryPrice.currencyDescription ? ` (${countryPrice.currencyDescription})` : ''}.
                </p>
              ) : null}
            </div>

            <WaysToGetStartedSection
              userType={formData.userType}
              onUserTypeChange={(userType) =>
                setFormData({
                  ...formData,
                  userType,
                  subscriptionVersionId: getDefaultVersionId(userType),
                })
              }
              selectedVersionId={formData.subscriptionVersionId}
              onVersionSelect={(subscriptionVersionId) =>
                setFormData({ ...formData, subscriptionVersionId })
              }
              lang={formData.language}
              specialOfferConfirmed={specialOfferConfirmed}
              onSpecialOfferConfirmChange={handleSpecialOfferConfirmChange}
              countryPrice={countryPrice}
            />

            {/* Name + Surname - 2 Columns */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-white mb-2">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  className="w-full px-4 py-2.5 bg-white bg-opacity-10 backdrop-blur-sm border border-cyan-500 border-opacity-30 rounded-xl text-white placeholder-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-200"
                  placeholder="First name"
                  value={formData.firstName}
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                />
              </div>

              <div>
                <label htmlFor="surname" className="block text-sm font-medium text-white mb-2">
                  Surname <span className="text-red-400">*</span>
                </label>
                <input
                  id="surname"
                  name="surname"
                  type="text"
                  required
                  className="w-full px-4 py-2.5 bg-white bg-opacity-10 backdrop-blur-sm border border-cyan-500 border-opacity-30 rounded-xl text-white placeholder-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-200"
                  placeholder="Surname"
                  value={formData.surname}
                  onChange={(e) => setFormData({...formData, surname: e.target.value})}
                />
              </div>
            </div>

            {/* Username - Full Width */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-white mb-2">
                {t('auth_username')} <span className="text-red-400">*</span>
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="w-full px-4 py-2.5 bg-white bg-opacity-10 backdrop-blur-sm border border-cyan-500 border-opacity-30 rounded-xl text-white placeholder-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-200"
                placeholder="Username"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
              />
            </div>

            {/* Email - Full Width */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full px-4 py-2.5 bg-white bg-opacity-10 backdrop-blur-sm border border-cyan-500 border-opacity-30 rounded-xl text-white placeholder-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-200"
                placeholder="Email address"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>

            {/* Preferred language + Gender - 2 Columns */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="language" className="block text-sm font-medium text-white mb-2">
                  Preferred Language <span className="text-red-400">*</span>
                </label>
                <select
                  id="language"
                  name="language"
                  required
                  className="w-full px-4 py-2.5 bg-white bg-opacity-10 backdrop-blur-sm border border-cyan-500 border-opacity-30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-200"
                  style={{ color: formData.language ? 'white' : '#a0d2eb' }}
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code} className="text-gray-800">
                      {lang.name} ({lang.code.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-white mb-2">
                  Gender <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <select
                  id="gender"
                  name="gender"
                  className="w-full px-4 py-2.5 bg-white bg-opacity-10 backdrop-blur-sm border border-cyan-500 border-opacity-30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-200"
                  style={{ color: formData.gender ? 'white' : '#a0d2eb' }}
                  value={formData.gender}
                  onChange={(e) => setFormData({...formData, gender: e.target.value as any})}
                >
                  <option value="" className="text-gray-400">Not specified</option>
                  <option value="male" className="text-gray-800">Male</option>
                  <option value="female" className="text-gray-800">Female</option>
                  <option value="other" className="text-gray-800">Other</option>
                </select>
              </div>
            </div>

            {/* Birthdate (Optional for Statistics) */}
            <div>
              <label htmlFor="birthdate" className="block text-sm font-medium text-white mb-2">
                Birthdate <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <input
                id="birthdate"
                name="birthdate"
                type="date"
                className="w-full px-4 py-2.5 bg-white bg-opacity-10 backdrop-blur-sm border border-cyan-500 border-opacity-30 rounded-xl text-white placeholder-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-200"
                style={{ colorScheme: 'dark' }}
                value={formData.birthdate}
                onChange={(e) => setFormData({...formData, birthdate: e.target.value})}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Password + Confirm Password - 2 Columns */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                  Password <span className="text-red-400">*</span>
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 bg-white bg-opacity-10 backdrop-blur-sm border border-cyan-500 border-opacity-30 rounded-xl text-white placeholder-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-200"
                  placeholder="Min 6 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-white mb-2">
                  Confirm <span className="text-red-400">*</span>
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 bg-white bg-opacity-10 backdrop-blur-sm border border-cyan-500 border-opacity-30 rounded-xl text-white placeholder-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-200"
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                />
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="flex items-center pt-2">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                required
                className="w-4 h-4 text-cyan-400 bg-white bg-opacity-10 border-cyan-500 border-opacity-30 rounded focus:ring-cyan-400 focus:ring-offset-transparent flex-shrink-0"
              />
              <label htmlFor="terms" className="ml-2 block text-xs text-cyan-100">
                {t('auth_agree_to')}{' '}
                <Link href="/terms" className="text-cyan-300 hover:text-cyan-200 underline">
                  {t('footer_terms')}
                </Link>{' '}
                {t('auth_terms_and')}{' '}
                <Link href="/privacy" className="text-cyan-300 hover:text-cyan-200 underline">
                  {t('footer_privacy')}
                </Link>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-6 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:from-cyan-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-2xl"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  {t('btn_creating_account')}
                </div>
              ) : specialOfferConfirmed ? (
                'Create Account in special offer'
              ) : (
                t('btn_register')
              )}
            </button>

            {/* Sign In Link */}
            <div className="text-center pt-2">
              <span className="text-xs text-cyan-200">
                {t('btn_already_have_account')}{' '}
                <button
                  type="button"
                  onClick={handleLoginClick}
                  className="font-semibold text-white hover:text-cyan-200 transition-colors underline"
                >
                  {t('btn_sign_in_here')}
                </button>
              </span>
            </div>
          </form>
        </div>

        {/* Additional Decorative Elements */}
        <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-3xl blur-xl opacity-20 -z-10"></div>
      </div>

    </div>
  );
}
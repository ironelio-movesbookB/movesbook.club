import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SportType, UserType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ensureUserSettingsColumns } from '@/lib/userSettingsDb';
import { getSubscriptionById } from '@/lib/admin/subscriptionSettingsMock';
import {
  mergeNetworkSubscriptionHistory,
  periodDisplayStatus,
} from '@/lib/admin/networkSubscriptionHistory';
import {
  addDaysYmd,
  ensureSpecialOfferTables,
  reserveSpecialOfferSlot,
  SpecialOfferUnavailableError,
  todayYmd,
  versionDurationDays,
  type SpecialOfferRegistration,
} from '@/lib/subscriptions/specialOffers';
import { getCountryPriceInfo } from '@/lib/countries/countryPricingDb';
import {
  localAmount,
  priceForCountry,
  type CountryPriceInfo,
} from '@/lib/countries/countryPriceFormula';
import { getActivePaymentCredentials } from '@/lib/payments/paymentSettings';
import {
  createRegistrationPayment,
  ensureRegistrationPaymentTables,
  findPendingRegistrationPayment,
  setAccountActivationStatus,
  type RegistrationPaymentStatus,
} from '@/lib/registration/registrationPayments';
import {
  registrationOrigin,
  sendActivationEmailSafely,
} from '@/lib/registration/registrationFlow';


export async function POST(request: NextRequest) {
  try {
    const { 
      name, 
      firstName, 
      surname, 
      username, 
      email, 
      password, 
      userType, 
      gender, 
      birthdate, 
      country,
      language,
      subscriptionVersionId,
      useSpecialOffer,
    } = await request.json();

    const requestedVersion =
      subscriptionVersionId != null ? getSubscriptionById(Number(subscriptionVersionId)) : undefined;
    const selectedVersion =
      requestedVersion && requestedVersion.userType === userType ? requestedVersion : undefined;
    const withSpecialOffer = Boolean(useSpecialOffer && selectedVersion);
    if (useSpecialOffer && !selectedVersion) {
      return NextResponse.json(
        { error: 'Select the version of the special offer' },
        { status: 400 },
      );
    }

    const normalizedUsername = typeof username === 'string' ? username.trim() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim() : '';

    console.log('Registration attempt:', {
      name,
      firstName,
      surname,
      username: normalizedUsername,
      email: normalizedEmail,
      userType,
      country,
    });

    // Validate required fields
    if (!name || !normalizedUsername || !normalizedEmail || !password || !userType || !country) {
      return NextResponse.json(
        { error: 'All required fields must be filled' },
        { status: 400 }
      );
    }

    // Check if user already exists (report which field conflicts)
    const existingByEmail = await prisma.user.findFirst({
      where: { email: normalizedEmail },
      select: { id: true, email: true, username: true, password: true },
    });
    const existingByUsername = await prisma.user.findFirst({
      where: { username: normalizedUsername },
      select: { id: true, email: true, username: true },
    });

    // Same person submitting again before paying: send them back to their payment page.
    if (existingByEmail && existingByUsername && existingByEmail.id === existingByUsername.id) {
      const pending = await findPendingRegistrationPayment(existingByEmail.id);
      if (
        pending &&
        existingByEmail.password &&
        (await bcrypt.compare(String(password ?? ''), existingByEmail.password))
      ) {
        return NextResponse.json(
          {
            error: 'This account is waiting for payment',
            resumePaymentId: pending.id,
          },
          { status: 409 },
        );
      }
    }

    if (existingByEmail || existingByUsername) {
      const conflicts: string[] = [];
      if (existingByEmail) conflicts.push('email');
      if (existingByUsername) conflicts.push('username');
      return NextResponse.json(
        {
          error: `User with this ${conflicts.join(' and ')} already exists`,
          conflicts,
        },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Map frontend userType to database UserType enum
    const dbUserType = mapUserType(userType);

    console.log('Creating user with type:', dbUserType);

    // Load admin defaults for user's language (fallback to 'en')
    const userLanguage =
      typeof language === 'string' && language.trim() ? language.trim().toLowerCase() : 'en';
    console.log(`Loading admin defaults for language: ${userLanguage}`);

    await ensureUserSettingsColumns();
    if (withSpecialOffer) await ensureSpecialOfferTables();

    // Accounts that pick a version go through payment (or the test/free skip) and activation.
    const usesPaymentFlow = Boolean(selectedVersion);
    let countryPrice: CountryPriceInfo = {
      country: String(country),
      factor: 1,
      currencyCode: 'EUR',
      currencyDescription: '',
      eurToLocal: 1,
    };
    let testMode = true;
    if (usesPaymentFlow) {
      await ensureRegistrationPaymentTables();
      try {
        countryPrice = await getCountryPriceInfo(String(country));
      } catch (e) {
        console.error('Registration: country pricing unavailable, using base prices', e);
      }
      const credentials = await getActivePaymentCredentials();
      testMode = credentials.testMode;
      const mayNeedPayment =
        withSpecialOffer || Number(selectedVersion?.price1 ?? 0) > 0;
      if (mayNeedPayment && !testMode && !credentials.stripe && !credentials.paypal) {
        return NextResponse.json(
          { error: 'Online payment is not available at the moment. Please try again later.' },
          { status: 503 },
        );
      }
    }

    const [colorDefaults, toolsDefaults, favouritesDefaults] = await Promise.all([
      prisma.colorDefaults.findUnique({ where: { language: userLanguage } }),
      prisma.toolsDefaults.findUnique({ where: { language: userLanguage } }),
      prisma.favouritesDefaults.findUnique({ where: { language: userLanguage } }),
    ]);

    // Fallback defaults if admin hasn't set them yet
    const defaultColorSettings = {
      pageBackground: '#ffffff',
      dayHeader: '#f3f4f6',
      moveframeHeader: '#e5e7eb',
      movelapHeader: '#d1d5db',
      microlapBackground: '#f9fafb',
      selectedRow: '#3b82f6',
      buttonAdd: '#10b981',
      buttonEdit: '#f59e0b',
      buttonDelete: '#ef4444',
      buttonPrint: '#6b7280',
      alternateRow: '#f9fafc',
    };

    const defaultSports = [
      { sport: SportType.SWIM, order: 0 },
      { sport: SportType.BIKE, order: 1 },
      { sport: SportType.RUN, order: 2 },
      { sport: SportType.BODY_BUILDING, order: 3 },
    ];

    const defaultPeriods = [
      { name: 'Preparation', description: 'Initial training phase', color: '#3b82f6' },
      { name: 'Competition', description: 'Main competition phase', color: '#ef4444' },
      { name: 'Recovery', description: 'Active recovery phase', color: '#10b981' },
    ];

    const defaultSections = [
      { name: 'Warm-up', description: 'Pre-workout activation', color: '#f59e0b' },
      { name: 'Main Set', description: 'Primary workout component', color: '#ef4444' },
      { name: 'Cool-down', description: 'Post-workout recovery', color: '#10b981' },
    ];

    // Atomic create: if settings/sports/etc fail, do not leave a half-registered user
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name,
          firstName: firstName || undefined,
          surname: surname || undefined,
          username: normalizedUsername,
          email: normalizedEmail,
          password: hashedPassword,
          userType: dbUserType,
          gender: gender || undefined,
          birthdate: birthdate ? new Date(birthdate) : undefined,
          country: country || undefined,
        },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          userType: true,
          createdAt: true,
        },
      });

      let offerRegistration: SpecialOfferRegistration | null = null;
      if (withSpecialOffer && selectedVersion) {
        offerRegistration = await reserveSpecialOfferSlot(tx, {
          versionId: selectedVersion.id,
          userId: created.id,
        });
      }

      let adminSettings = '{}';
      let paymentId: string | null = null;
      let paymentStatus: RegistrationPaymentStatus | null = null;
      if (selectedVersion) {
        const dateStart = offerRegistration?.dateStart ?? todayYmd();
        const dateEnd =
          offerRegistration?.dateEnd ??
          addDaysYmd(dateStart, versionDurationDays(selectedVersion.id));
        const basePriceEur = Number(offerRegistration?.costEuro ?? selectedVersion.price1 ?? 0);
        const amountEur = priceForCountry(basePriceEur, countryPrice.factor);
        const amountLocalValue =
          countryPrice.currencyCode && countryPrice.currencyCode !== 'EUR'
            ? localAmount(amountEur, countryPrice.eurToLocal)
            : null;
        paymentStatus = amountEur <= 0 ? 'free' : testMode ? 'test' : 'pending';
        const periodId = `register-${Date.now()}`;
        adminSettings = mergeNetworkSubscriptionHistory('{}', [
          {
            id: periodId,
            dateStart,
            dateEnd,
            version: selectedVersion.name,
            status: periodDisplayStatus(dateEnd),
            amountPaid: paymentStatus === 'pending' ? '' : '0',
            paymentMethod: paymentStatus,
          },
        ]);
        paymentId = await createRegistrationPayment(tx, {
          userId: created.id,
          status: paymentStatus,
          versionId: selectedVersion.id,
          versionName: selectedVersion.name,
          specialOffer: Boolean(offerRegistration),
          basePriceEur,
          amountEur,
          country: String(country),
          currencyCode: countryPrice.currencyCode || 'EUR',
          eurToLocal: countryPrice.eurToLocal,
          amountLocal: amountLocalValue,
          language: userLanguage,
          periodId,
        });
        await setAccountActivationStatus(
          tx,
          created.id,
          paymentStatus === 'pending' ? 'pending_payment' : 'pending_activation',
        );
      }

      await tx.userSettings.create({
        data: {
          userId: created.id,
          adminSettings,
          colorSettings: colorDefaults?.data
            ? JSON.stringify(colorDefaults.data)
            : JSON.stringify(defaultColorSettings),
          toolsSettings: toolsDefaults?.data ? JSON.stringify(toolsDefaults.data) : '{}',
          favouritesSettings: favouritesDefaults?.data
            ? JSON.stringify(favouritesDefaults.data)
            : '{}',
          myBestSettings: '{}',
          workoutPreferences: '{}',
          socialSettings: '{}',
          notificationSettings: '{}',
          widgetArrangement: '[]',
          language: userLanguage,
        },
      });

      for (const sportData of defaultSports) {
        await tx.userMainSport.create({
          data: {
            userId: created.id,
            sport: sportData.sport,
            order: sportData.order,
          },
        });
      }

      for (const period of defaultPeriods) {
        await tx.period.create({
          data: {
            userId: created.id,
            name: period.name,
            description: period.description,
            color: period.color,
          },
        });
      }

      for (const section of defaultSections) {
        await tx.workoutSection.create({
          data: {
            userId: created.id,
            name: section.name,
            description: section.description,
            color: section.color,
          },
        });
      }

      return { ...created, paymentId, paymentStatus };
    });

    const { paymentId, paymentStatus, ...user } = result;
    console.log('User created:', user.id);

    if (paymentId && paymentStatus) {
      if (paymentStatus === 'pending') {
        return NextResponse.json({
          success: true,
          user,
          paymentRequired: true,
          paymentId,
          next: `/register/payment/${paymentId}`,
        });
      }
      await sendActivationEmailSafely(user.id, registrationOrigin(request));
      return NextResponse.json({
        success: true,
        user,
        paymentRequired: false,
        paymentId,
        next: `/register/success?p=${paymentId}`,
      });
    }

    // No version chosen (e.g. coach invitation): account is usable right away, as before.
    const token = require('@/lib/auth').generateToken(
      user.id,
      user.email,
      user.username,
      user.userType
    );

    return NextResponse.json({
      success: true,
      token,
      user,
    });
  } catch (error: any) {
    if (error instanceof SpecialOfferUnavailableError) {
      return NextResponse.json({ error: error.message, specialOfferUnavailable: true }, { status: 409 });
    }

    console.error('Registration error:', error);

    // More detailed error logging
    if (error.code) {
      console.error('Error code:', error.code);
      console.error('Error meta:', error.meta);
    }

    // Unique constraint race (email/username taken between check and insert)
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(', ')
        : error.meta?.target || 'email or username';
      return NextResponse.json(
        { error: `User with this ${target} already exists` },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}

function mapUserType(frontendType: string): UserType {
  const typeMap: { [key: string]: UserType } = {
    'athlete': UserType.ATHLETE,
    'coach': UserType.COACH,
    'team': UserType.TEAM,
    'club': UserType.CLUB,
    'group': UserType.GROUP,
    'groupAdmin': UserType.GROUP_ADMIN
  };
  
  return typeMap[frontendType] || UserType.ATHLETE;
}
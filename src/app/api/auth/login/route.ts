import { NextRequest, NextResponse } from 'next/server';
import { UserType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyPassword, generateToken, hashPassword } from '@/lib/auth';
import { MOVESBOOK_LOGIN_USER_TYPES } from '@/lib/adminLoginLogLabels';
import { tryEntityCompanyLogin } from '@/lib/entity/entityDirectLogin';
import { tryEntityDirectAccessLogin } from '@/lib/entity/entityDirectAccessLogin';
import {
  parseEntityRedirectMeta,
  type EntityDirectAccessKind,
} from '@/lib/entity/entityDirectAccessMeta';
import mysql from 'mysql2/promise';
import {
  findPendingRegistrationPayment,
  getAccountActivationStatus,
} from '@/lib/registration/registrationPayments';
import { registrationOrigin, sendActivationEmailSafely } from '@/lib/registration/registrationFlow';

const ACTIVATION_RESEND_MS = 60 * 60 * 1000;

/** Accounts registered with the payment flow log in only after payment and email activation. */
async function registrationActivationBlock(
  request: NextRequest,
  userId: string,
): Promise<NextResponse | null> {
  const activation = await getAccountActivationStatus(userId);
  if (!activation || activation.status === 'active') return null;
  if (activation.status === 'pending_payment') {
    const pending = await findPendingRegistrationPayment(userId);
    return NextResponse.json(
      {
        error: 'Your registration payment is not completed yet.',
        reason: 'payment_pending',
        paymentUrl: pending ? `/register/payment/${pending.id}` : undefined,
      },
      { status: 403 },
    );
  }
  const lastSent = activation.emailSentAt ? new Date(activation.emailSentAt).getTime() : 0;
  const resent =
    Date.now() - lastSent > ACTIVATION_RESEND_MS &&
    (await sendActivationEmailSafely(userId, registrationOrigin(request)));
  return NextResponse.json(
    {
      error: resent
        ? 'Your account is not activated yet. We sent you a new activation email.'
        : 'Your account is not activated yet. Open your email and click "Activate account".',
      reason: 'activation_pending',
    },
    { status: 403 },
  );
}

type LegacyDbConfig = {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
};

const getLegacyDbConfig = (): LegacyDbConfig | null => {
  const legacyUrl = process.env.LEGACY_DATABASE_URL || process.env.LEGACY_DB_URL;
  if (legacyUrl) {
    try {
      const parsed = new URL(legacyUrl);
      return {
        host: parsed.hostname,
        port: Number(parsed.port) || 3306,
        user: decodeURIComponent(parsed.username || ''),
        password: decodeURIComponent(parsed.password || ''),
        database: parsed.pathname.replace(/^\//, '')
      };
    } catch {
      return null;
    }
  }

  const prodLegacyUrl = process.env.PROD_DATABASE_URL || process.env.PROD_DB_URL;
  if (prodLegacyUrl) {
    try {
      const parsed = new URL(prodLegacyUrl);
      return {
        host: parsed.hostname,
        port: Number(parsed.port) || 3306,
        user: decodeURIComponent(parsed.username || ''),
        password: decodeURIComponent(parsed.password || ''),
        database: parsed.pathname.replace(/^\//, '')
      };
    } catch {
      return null;
    }
  }

  const host = process.env.LEGACY_DB_HOST;
  const user = process.env.LEGACY_DB_USER;
  const database = process.env.LEGACY_DB_NAME;
  if (!host || !user || !database) {
    return null;
  }

  return {
    host,
    port: Number(process.env.LEGACY_DB_PORT || 3306),
    user,
    password: process.env.LEGACY_DB_PASSWORD || undefined,
    database
  };
};

const isMysql = () => (process.env.DATABASE_URL || '').startsWith('mysql');

const ensureLegacyMappingTable = async () => {
  if (isMysql()) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS legacy_id_mappings (
        id VARCHAR(255) PRIMARY KEY,
        legacy_table VARCHAR(255),
        legacy_id INTEGER,
        new_id VARCHAR(255)
      )
    `);
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS legacy_id_mappings (
      id TEXT PRIMARY KEY,
      legacy_table TEXT,
      legacy_id INTEGER,
      new_id TEXT
    )
  `);
};

const upsertLegacyMapping = async (mappingId: string, legacyId: number, newId: string) => {
  if (isMysql()) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO legacy_id_mappings (id, legacy_table, legacy_id, new_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE legacy_table=VALUES(legacy_table), legacy_id=VALUES(legacy_id), new_id=VALUES(new_id)`,
      mappingId,
      'users',
      legacyId,
      newId
    );
    return;
  }

  await prisma.$executeRawUnsafe(
    `INSERT OR REPLACE INTO legacy_id_mappings (id, legacy_table, legacy_id, new_id)
     VALUES (?, ?, ?, ?)`,
    mappingId,
    'users',
    legacyId,
    newId
  );
};

const fetchLegacyUsersFromExternalDb = async (
  config: LegacyDbConfig,
  loginIdentifier: string,
  rawLoginIdentifier: string
): Promise<any[]> => {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database
  });

  try {
    let columns: string[] = [];
    try {
      const [rows] = await connection.execute<any[]>(
        'SELECT COLUMN_NAME as name FROM information_schema.COLUMNS WHERE table_name = ? AND table_schema = DATABASE()',
        ['users']
      );
      if (Array.isArray(rows)) {
        columns = rows
          .map((row: any) => row?.name || row?.COLUMN_NAME)
          .filter((value: any) => typeof value === 'string');
      }
    } catch {
      columns = [];
    }

    const optionalColumns = [
      'staff_alternative_password',
      'enabled_staff_alternative_password',
      'alternate_club_pass',
      'enable_login_as_club_admin'
    ];

    const selectedOptionalColumns = optionalColumns.filter((column) =>
      columns.length > 0 ? columns.includes(column) : false
    );

    const selectColumns = [
      'id',
      'username',
      'email',
      'password',
      'alternate_pass',
      'staff_password',
      ...selectedOptionalColumns,
      "COALESCE(firstname, '') as firstname",
      "COALESCE(lastname, '') as lastname",
      'role_id',
      "CASE WHEN created IS NULL OR created = '0000-00-00' THEN CURRENT_TIMESTAMP ELSE created END as created"
    ];

    const legacySql = `
      SELECT ${selectColumns.join(', ')}
      FROM users
      WHERE (TRIM(email) = ? OR TRIM(username) = ? OR lower(TRIM(email)) = lower(?) OR lower(TRIM(username)) = lower(?))
      AND (delete_status IS NULL OR lower(TRIM(delete_status)) = 'n')
      ORDER BY id DESC
    `;

    const [rows] = await connection.execute<any[]>(legacySql, [
      loginIdentifier,
      loginIdentifier,
      loginIdentifier,
      loginIdentifier
    ]);
    let legacyUser = Array.isArray(rows) ? rows : [];

    if (legacyUser.length === 0 && rawLoginIdentifier) {
      const exactSql = `
        SELECT ${selectColumns.join(', ')}
        FROM users
        WHERE (email = ? OR username = ?)
        AND delete_status = 'N'
        ORDER BY id DESC
        LIMIT 1
      `;
      const [exactRows] = await connection.execute<any[]>(exactSql, [
        rawLoginIdentifier,
        rawLoginIdentifier
      ]);
      legacyUser = Array.isArray(exactRows) ? exactRows : [];
    }

    return legacyUser;
  } finally {
    await connection.end();
  }
};

const hasLegacyUsersTable = async (): Promise<boolean> => {
  if (isMysql()) {
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        'SELECT 1 FROM information_schema.COLUMNS WHERE table_name = ? AND table_schema = DATABASE() LIMIT 1',
        'users'
      );
      if (Array.isArray(rows) && rows.length > 0) return true;
    } catch (error) {
    }
    return false;
  }

  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1"
    );
    if (Array.isArray(rows) && rows.length > 0) return true;
  } catch (error) {
  }

  return false;
};

type EntityAccessMode = 'company-password' | 'direct-access-only';

function applyEntityLoginRedirect(redirectTo: string, mode: EntityAccessMode) {
  const meta = parseEntityRedirectMeta(redirectTo);
  return {
    entityDirectLoginRedirect: redirectTo,
    entityAccessMode: mode,
    entityKind: meta?.kind ?? null,
    entityId: meta?.entityId ?? null,
    clubAccessMode: meta?.kind === 'club' ? mode : null,
    clubAccessClubId: meta?.kind === 'club' ? meta.entityId : null,
  };
}

async function tryEntityCredentialLogins(
  loginIdentifier: string,
  password: string,
) {
  const entityLogin = await tryEntityCompanyLogin(loginIdentifier, password);
  if (entityLogin) {
    const adminUser = await loadAdminUserForEntityLogin(entityLogin.adminId);
    if (adminUser) {
      return {
        user: adminUser,
        ...applyEntityLoginRedirect(entityLogin.redirectTo, 'company-password'),
      };
    }
  }
  const directLogin = await tryEntityDirectAccessLogin(loginIdentifier, password);
  if (directLogin) {
    const adminUser = await loadAdminUserForEntityLogin(directLogin.adminId);
    if (adminUser) {
      return {
        user: adminUser,
        ...applyEntityLoginRedirect(directLogin.redirectTo, 'direct-access-only'),
      };
    }
  }
  return null;
}

async function loadAdminUserForEntityLogin(adminId: string) {
  return prisma.user.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      country: true,
      image: true,
      password: true,
      userType: true,
      createdAt: true,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { email, username, identifier, password, userType } = await request.json();

    // Support both email/username separately or combined in identifier field
    const rawLoginIdentifier = identifier || email || username || '';
    const loginIdentifier = rawLoginIdentifier.trim();

    // Validate required fields
    if (!loginIdentifier || !password) {
      return NextResponse.json(
        { error: 'Email/Username and password are required' },
        { status: 400 }
      );
    }

    // Find user by email OR username in NEW table first (case-insensitive for MySQL)
    // Try with exact match first, then lowercase match
    console.log(`🔍 Searching for user with identifier: ${loginIdentifier}`);
    const newUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: loginIdentifier },
          { username: loginIdentifier },
          { email: loginIdentifier.toLowerCase() },
          { username: loginIdentifier.toLowerCase() }
        ]
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        country: true,
        image: true,
        password: true,
        userType: true,
        createdAt: true,
      }
    });
    let user = null;
    let passwordAlreadyVerified = false;
    let entityDirectLoginRedirect: string | null = null;
    let entityAccessMode: EntityAccessMode | null = null;
    let entityKind: EntityDirectAccessKind | null = null;
    let entityId: string | null = null;
    let clubAccessMode: EntityAccessMode | null = null;
    let clubAccessClubId: string | null = null;
    
    if (newUsers.length > 0) {
      for (const candidate of newUsers) {
        console.log(`✅ User found: ${candidate.username} (${candidate.email}), ID: ${candidate.id}`);
        console.log(`🔐 Password hash length: ${candidate.password?.length || 0}, starts with: ${candidate.password?.substring(0, 10) || 'N/A'}`);
        const isPasswordValid = await verifyPassword(password, candidate.password);
        if (isPasswordValid) {
          user = candidate;
          passwordAlreadyVerified = true;
          break;
        }
      }
    } else {
      console.log(`❌ User not found in new table for identifier: ${loginIdentifier}`);
    }
    if (!user) {
      const rawUser = await prisma.$queryRaw<any[]>`
        SELECT id, name, username, email, country, image, password, userType, createdAt
        FROM users_new
        WHERE lower(email) = lower(${loginIdentifier}) OR lower(username) = lower(${loginIdentifier})
      `;
      if (rawUser.length > 0) {
        for (const candidate of rawUser) {
          const isPasswordValid = await verifyPassword(password, candidate.password);
          if (isPasswordValid) {
            user = candidate;
            passwordAlreadyVerified = true;
            break;
          }
        }
      }
    }

    // If not found in new table, check LEGACY table and migrate on login (if legacy table exists)
    if (!user) {
      try {
        console.log(`User not found in new table, checking legacy table for: ${loginIdentifier}`);
        
        let legacyUser: any[] = [];
        const legacyDbConfig = getLegacyDbConfig();
        if (legacyDbConfig) {
          try {
            legacyUser = await fetchLegacyUsersFromExternalDb(
              legacyDbConfig,
              loginIdentifier,
              rawLoginIdentifier
            );
          } catch (legacyDbError) {
            console.error('Legacy DB lookup failed:', legacyDbError);
          }
        }

        const legacyTableExists = await hasLegacyUsersTable();
        if (legacyUser.length === 0 && legacyTableExists) {
          try {
            let columnNames = new Set<string>();
            try {
              const columns = await prisma.$queryRawUnsafe<any[]>(
                'SELECT COLUMN_NAME as name FROM information_schema.COLUMNS WHERE table_name = ? AND table_schema = DATABASE()',
                'users'
              );
              if (Array.isArray(columns)) {
                for (const column of columns) {
                  const columnName = column?.name || column?.COLUMN_NAME;
                  if (columnName) columnNames.add(columnName);
                }
              }
            } catch (schemaError) {
              columnNames = new Set<string>();
            }

            const optionalColumns = [
              'alternate_pass',
              'staff_password',
              'staff_alternative_password',
              'enabled_staff_alternative_password',
              'alternate_club_pass',
              'enable_login_as_club_admin'
            ];

            const selectOptionalColumns = optionalColumns.map((column) =>
              columnNames.has(column) ? column : `NULL AS ${column}`
            );
            const firstNameExpr = columnNames.has('firstname') ? "COALESCE(firstname, '') as firstname" : "'' as firstname";
            const lastNameExpr = columnNames.has('lastname') ? "COALESCE(lastname, '') as lastname" : "'' as lastname";
            const createdExpr = columnNames.has('created')
              ? "CASE WHEN created IS NULL OR created = '0000-00-00' THEN CURRENT_TIMESTAMP ELSE created END as created"
              : 'CURRENT_TIMESTAMP as created';
            const roleExpr = columnNames.has('role_id') ? 'role_id' : 'NULL AS role_id';
            const deleteStatusClause = columnNames.has('delete_status')
              ? "AND (delete_status IS NULL OR lower(TRIM(delete_status)) = 'n')"
              : '';

            const selectColumns = [
              'id',
              'username',
              'email',
              'password',
              ...selectOptionalColumns,
              firstNameExpr,
              lastNameExpr,
              roleExpr,
              createdExpr
            ];

            const legacySql = `
              SELECT ${selectColumns.join(', ')}
              FROM users
              WHERE (TRIM(email) = ? OR TRIM(username) = ? OR lower(TRIM(email)) = lower(?) OR lower(TRIM(username)) = lower(?))
              ${deleteStatusClause}
              ORDER BY id DESC
            `;

            legacyUser = await prisma.$queryRawUnsafe<any[]>(
              legacySql,
              loginIdentifier,
              loginIdentifier,
              loginIdentifier,
              loginIdentifier
            );
          } catch (legacyQueryError: any) {
            legacyUser = [];
          }

          if (legacyUser.length === 0 && rawLoginIdentifier) {
            try {
              legacyUser = await prisma.$queryRawUnsafe<any[]>(
                `SELECT id, username, email, password, NULL AS alternate_pass, NULL AS staff_password,
                        '' AS firstname, '' AS lastname, NULL AS role_id, CURRENT_TIMESTAMP AS created
                 FROM users
                 WHERE (email = ? OR username = ?)
                 ORDER BY id DESC
                 LIMIT 1`,
                rawLoginIdentifier,
                rawLoginIdentifier
              );
            } catch (legacyExactError: any) {
            }
          }
        }

        if (legacyUser.length > 0) {
        let matchedLegacy = null;
        let passwordForNewUser = '';
        let whichPasswordWorked = '';
        for (const candidate of legacyUser) {
          let isPasswordValid = false;
          let candidatePasswordForNewUser = candidate.password || '';
          if (candidate.password) {
            isPasswordValid = await verifyPassword(password, candidate.password);
            if (isPasswordValid) whichPasswordWorked = 'main';
          }
          if (!isPasswordValid && candidate.alternate_pass) {
            isPasswordValid = await verifyPassword(password, candidate.alternate_pass);
            if (isPasswordValid) whichPasswordWorked = 'alternate';
          }
          if (!isPasswordValid && candidate.staff_password) {
            isPasswordValid = password === candidate.staff_password;
            if (isPasswordValid) whichPasswordWorked = 'staff';
          }
          if (!isPasswordValid && candidate.staff_alternative_password && (candidate.enabled_staff_alternative_password === 1 || candidate.enabled_staff_alternative_password === '1')) {
            isPasswordValid = await verifyPassword(password, candidate.staff_alternative_password);
            if (isPasswordValid) whichPasswordWorked = 'staff_alternative';
          }
          if (!isPasswordValid && candidate.alternate_club_pass && (candidate.enable_login_as_club_admin === 1 || candidate.enable_login_as_club_admin === '1')) {
            isPasswordValid = await verifyPassword(password, candidate.alternate_club_pass);
            if (isPasswordValid) whichPasswordWorked = 'club_alternate';
          }
          if (isPasswordValid) {
            matchedLegacy = candidate;
            if (whichPasswordWorked === 'alternate') {
              candidatePasswordForNewUser = candidate.alternate_pass || candidate.password || '';
            } else if (whichPasswordWorked === 'staff') {
              candidatePasswordForNewUser = await hashPassword(password);
            } else if (whichPasswordWorked === 'staff_alternative') {
              candidatePasswordForNewUser = candidate.staff_alternative_password || candidate.password || '';
            } else if (whichPasswordWorked === 'club_alternate') {
              candidatePasswordForNewUser = candidate.alternate_club_pass || candidate.password || '';
            }
            passwordForNewUser = candidatePasswordForNewUser;
            break;
          }
        }

        if (!matchedLegacy) {
          return NextResponse.json(
            { error: 'Invalid email/username or password' },
            { status: 401 }
          );
        }

        const legacy = matchedLegacy;
        const legacyEmail = legacy.email ? legacy.email.trim() : '';
        const legacyUsername = legacy.username ? legacy.username.trim() : '';
        console.log(`Found user in legacy table: ${legacy.username}`);
        console.log(`Checking password fields: main=${!!legacy.password}, alternate=${!!legacy.alternate_pass}, staff=${!!legacy.staff_password}`);
        console.log(`Password verification result: ✅ matched ${whichPasswordWorked}`);
        passwordAlreadyVerified = true;

        // Migrate user to new table on successful login
        const newId = `legacy_${legacy.id}_${Date.now()}`;
        const name = `${legacy.firstname || ''} ${legacy.lastname || ''}`.trim() || legacy.username;
        
        try {
          // Create user in new table
          user = await prisma.user.create({
            data: {
              id: newId,
              email: legacyEmail || `user${legacy.id}@movesbook.temp`,
              username: legacyUsername || `user${legacy.id}`,
                password: passwordForNewUser || '',
              name: name,
              userType: mapUserType(legacy.role_id || 1),
              createdAt: legacy.created || new Date(),
              updatedAt: new Date(),
            },
          });

          console.log(`✅ Migrated user ${legacy.username} to new table on login`);

          await ensureLegacyMappingTable();
          await upsertLegacyMapping(`${newId}_map`, legacy.id, newId);

        } catch (error) {
          console.error(`Failed to migrate user on login:`, error);
          // Continue with login even if migration fails
          user = {
            id: `temp_legacy_${legacy.id}`,
            name: name,
            username: legacyUsername || legacy.username,
            email: legacyEmail || legacy.email,
              password: passwordForNewUser || legacy.password,
            userType: mapUserType(legacy.role_id || 1),
            createdAt: legacy.created || new Date(),
            updatedAt: new Date(),
          } as any;
        }
      }
      } catch (legacyError: any) {
        // Legacy table doesn't exist or query failed - that's okay for new installations
        console.log('Legacy users table not found or inaccessible (this is normal for new installations)');
      }
    }

    if (!user) {
      const entityHit = await tryEntityCredentialLogins(loginIdentifier, password);
      if (entityHit) {
        user = entityHit.user;
        passwordAlreadyVerified = true;
        entityDirectLoginRedirect = entityHit.entityDirectLoginRedirect;
        entityAccessMode = entityHit.entityAccessMode;
        entityKind = entityHit.entityKind;
        entityId = entityHit.entityId;
        clubAccessMode = entityHit.clubAccessMode;
        clubAccessClubId = entityHit.clubAccessClubId;
      }
      if (!user) {
        return NextResponse.json(
          { error: 'Invalid email/username or password' },
          { status: 401 }
        );
      }
    }

    if (!passwordAlreadyVerified) {
      // Verify password (supports both SHA1 from old system and bcrypt from new system)
      console.log(`🔐 Verifying password for user: ${user.username}`);
      if (user.password) {
        console.log(`🔐 Password hash: ${user.password.substring(0, 20)}... (length: ${user.password.length})`);
      }
      const isPasswordValid = await verifyPassword(password, user.password);
      console.log(`🔐 Password verification result: ${isPasswordValid ? '✅ VALID' : '❌ INVALID'}`);
      
      if (!isPasswordValid) {
        if (!passwordAlreadyVerified) {
          const entityHit = await tryEntityCredentialLogins(loginIdentifier, password);
          if (entityHit) {
            user = entityHit.user;
            passwordAlreadyVerified = true;
            entityDirectLoginRedirect = entityHit.entityDirectLoginRedirect;
            entityAccessMode = entityHit.entityAccessMode;
            entityKind = entityHit.entityKind;
            entityId = entityHit.entityId;
            clubAccessMode = entityHit.clubAccessMode;
            clubAccessClubId = entityHit.clubAccessClubId;
          }
        }
        if (!passwordAlreadyVerified) {
          const username = user?.username || loginIdentifier;
          console.log(`❌ Password verification failed for user: ${username}`);
          return NextResponse.json(
            { error: 'Invalid email/username or password' },
            { status: 401 }
          );
        }
      } else {
        console.log(`✅ Password verified successfully for user: ${user.username}`);
      }
    }

    // Auto-upgrade disabled - keeping SHA1 passwords as-is

    // Check user type if specified
    if (userType) {
      const expectedUserType = mapUserType(userType);
      const clubStaffTypes = new Set<string>([
        UserType.CLUB_TRAINER,
        'CLUB_COADMIN',
        'CLUB_OPERATOR',
        'CLUB_COLLABORATOR',
      ]);
      const matchesClubStaffAsClub =
        expectedUserType === UserType.CLUB && clubStaffTypes.has(String(user.userType));
      if (user.userType !== expectedUserType && !matchesClubStaffAsClub) {
        return NextResponse.json(
          { error: `This account is not registered as a ${userType}` },
          { status: 403 }
        );
      }
    }

    const activationBlock = await registrationActivationBlock(request, user.id);
    if (activationBlock) return activationBlock;

    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
      select: { language: true, adminSettings: true },
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    const userLang = userSettings?.language || 'en';
    const userPayload = {
      ...userWithoutPassword,
      language: userLang,
    };

    let pcuAlert: { title: string; bodyHtml: string } | undefined;
    try {
      const { readPcuSettings } = await import('@/lib/admin/userPcuSettings');
      const { resolvePcuAlertDisplay } = await import('@/lib/admin/userPcuAlertMsg');
      const pcu = readPcuSettings(userSettings?.adminSettings);
      const resolved = resolvePcuAlertDisplay(pcu, 'login', userLang);
      if (resolved) pcuAlert = resolved;
    } catch {
      /* PCU alert optional */
    }

    if (MOVESBOOK_LOGIN_USER_TYPES.includes(user.userType)) {
      try {
        const { recordUserLoginLog } = await import('@/lib/loginLogSession');
        await recordUserLoginLog(user.id);
        await prisma.user.update({
          where: { id: user.id },
          data: { lastSeenAt: new Date() },
        });
      } catch {
        /* login log optional */
      }
    }

    // Generate JWT token with RSA signing
    const tokenExtra =
      entityAccessMode === 'direct-access-only' && entityKind && entityId
        ? {
            entityDirectAccessOnly: true,
            entityDirectAccessKind: entityKind,
            entityDirectAccessEntityId: entityId,
            ...(entityKind === 'club'
              ? {
                  clubDirectAccessOnly: true,
                  clubDirectAccessClubId: entityId,
                }
              : {}),
          }
        : {};

    const token = generateToken(
      user.id,
      user.email,
      user.username,
      user.userType,
      tokenExtra,
    );

    return NextResponse.json({
      success: true,
      token,
      user: userPayload,
      ...(entityDirectLoginRedirect ? { redirectTo: entityDirectLoginRedirect } : {}),
      ...(entityAccessMode ? { entityAccessMode } : {}),
      ...(entityKind ? { entityKind } : {}),
      ...(entityId ? { entityId } : {}),
      ...(clubAccessMode ? { clubAccessMode } : {}),
      ...(clubAccessClubId ? { clubId: clubAccessClubId } : {}),
      ...(pcuAlert ? { pcuAlert } : {}),
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Map legacy role_id to UserType
function mapUserType(roleIdOrType: number | string): UserType {
  // If it's already a string UserType, return it
  if (typeof roleIdOrType === 'string') {
    const typeMap: { [key: string]: UserType } = {
      'athlete': UserType.ATHLETE,
      'ATHLETE': UserType.ATHLETE,
      'coach': UserType.COACH,
      'COACH': UserType.COACH,
      'team': UserType.TEAM,
      'TEAM': UserType.TEAM,
      'TEAM_MANAGER': UserType.TEAM,
      'team_manager': UserType.TEAM,
      'club': UserType.CLUB,
      'CLUB': UserType.CLUB,
      'CLUB_TRAINER': UserType.CLUB,
      'club_trainer': UserType.CLUB,
      'CLUB_COADMIN': 'CLUB_COADMIN' as UserType,
      'club_coadmin': 'CLUB_COADMIN' as UserType,
      'CLUB_OPERATOR': 'CLUB_OPERATOR' as UserType,
      'club_operator': 'CLUB_OPERATOR' as UserType,
      'CLUB_COLLABORATOR': 'CLUB_COLLABORATOR' as UserType,
      'club_collaborator': 'CLUB_COLLABORATOR' as UserType,
      'group': UserType.GROUP,
      'GROUP': UserType.GROUP,
      'groupAdmin': UserType.GROUP_ADMIN,
      'GROUP_ADMIN': UserType.GROUP_ADMIN,
      'group_admin': UserType.GROUP_ADMIN,
      'admin': UserType.ADMIN,
      'ADMIN': UserType.ADMIN,
      '5': UserType.ATHLETE,
      '8': UserType.CLUB,
      '99': UserType.ADMIN
    };
    return typeMap[roleIdOrType] || UserType.ATHLETE;
  }
  
  // Map legacy role_id (number) to UserType
  const roleMap: { [key: number]: UserType } = {
    1: UserType.ATHLETE,
    2: UserType.COACH,
    3: UserType.TEAM,
    4: UserType.CLUB,
    // Legacy quickRegister uses role 5 for Single User and role 8 for Club.
    5: UserType.ATHLETE,
    6: UserType.GROUP_ADMIN,
    8: UserType.CLUB,
    99: UserType.ADMIN
  };
  return roleMap[roleIdOrType as number] || UserType.ATHLETE;
}

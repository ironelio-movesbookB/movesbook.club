import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * POSTs to these paths (bots, extensions, misconfigured clients) are not part of this app.
 * Answering in middleware avoids Next treating them as Server Actions and logging
 * "Failed to find Server Action" / `workers` errors on 404.
 */
const NOOP_POST_PATHS = new Set([
  '/submit',
  '/api/rsc',
  '/api/formaction',
]);

// Public routes that don't require authentication
const publicRoutes = [
  '/',
  '/register',
  '/privacy',
  '/terms',
  '/about',
  '/contact',
  '/why-movesbook',
  '/dealers',
  '/subscribe-newsletter',
  '/references',
  '/support',
  '/forum',
  '/blog',
  '/testimonials',
  '/news',
  '/sell-buy',
  '/job-offers',
  '/promote-yourself',
  '/our-shop'
];

// API routes that don't require authentication
const publicApiRoutes = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/reset-password',
  '/api/auth/reset-username',
  /** Invite registration form — guests have no token yet */
  '/api/users/quick-register',
  /** Super Admin bootstrap (exists check + first login/register; no token yet) */
  '/api/admin/super-admin/exists',
  '/api/admin/super-admin/login',
  '/api/admin/super-admin/register',
  /** Promocode generator — PHP PromocodesController::changeCode (Auth allow) */
  '/api/admin/promocodes/change-code',
  /** Outcome audio for <audio src> — no Authorization header on GET */
  '/api/outcome-messages',
  /**
   * Uploaded files (sponsor PDFs, banners, logos, …). Browser <a href>/<img src> have no
   * Authorization header; member-medical paths stay gated inside the route handler.
   */
  '/api/media',
  /** Public read APIs (editorial news, shared OGP groups, etc.) */
  '/api/public/',
  /** OGP News sponsored cards placement — loaded by the news grid without an Authorization header */
  '/api/news/ogp-sponsors',
  /** Used by admin editors (Settings, subscriptions, recipes) — token is often in localStorage only */
  '/api/translate',
  /** Site texts per language (section languages) — read by every visitor, logged in or not */
  '/api/translations',
  /** Global sport dropdown catalog — GET is public; PUT still requires Super Admin in the route */
  '/api/admin/sport-dropdown-parameters',
  /** Version settings shown during registration — GET is public; PUT / migrate require staff in the route */
  /** Registration page: active special offer of a version (guests have no token) */
  '/api/subscriptions/special-offer',
  /** Registration page: admin-saved version settings (sharing, info text, last news) */
  '/api/subscriptions/version-settings',
  /** External cron: sponsor contract/payment reminders (secret header) */
  '/api/club/sponsors/reminders',
  /** External cron: create due recurrent expense records (secret header) */
  '/api/club/expenses/recurrent',
  /** Registration payment page / success page (account not active yet, no token) */
  '/api/registration-payments',
  /** Member pay link from the club payment module (no login required) */
  '/api/club-member-payments',
];

/** Public share links (read-only workout day / session). */
function isPublicSharedWorkoutApi(pathname: string): boolean {
  return /^\/api\/workouts\/(days|sessions)\/[^/]+\/shared$/.test(pathname);
}

/** QR / shared member profile. GET with mode=view only; edits stay authenticated. */
function isPublicMemberProfileView(request: NextRequest): boolean {
  if (request.method !== 'GET') return false;
  if (request.nextUrl.searchParams.get('mode') !== 'view') return false;
  return /^\/api\/clubs\/[^/]+\/members\/[^/]+\/profile\/?$/.test(request.nextUrl.pathname);
}

/** Personal member photos are not medical files. The QR view page loads them without a club login. */
function isPublicMemberPhoto(request: NextRequest): boolean {
  if (request.method !== 'GET') return false;
  return request.nextUrl.pathname.startsWith('/api/media/uploads/member-photos/');
}

/** Documents folder Get-link / shared page — no Authorization header on public preview. */
function isPublicClubDocumentsFolderApi(request: NextRequest): boolean {
  if (request.method !== 'GET') return false;
  return /^\/api\/clubs\/[^/]+\/documents-folder\/public\/?$/.test(
    request.nextUrl.pathname,
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // PHP legacy casing (/users/deadLine). next.config redirects are case-insensitive
  // and loop on Windows; rewrite only when casing differs from the App Router folder.
  if (/^\/users\/deadline$/i.test(pathname) && pathname !== '/users/deadline') {
    const url = request.nextUrl.clone();
    url.pathname = '/users/deadline';
    return NextResponse.rewrite(url);
  }

  // Member medical files are private; they are served only via /api/media with an access check.
  if (pathname.toLowerCase().startsWith('/uploads/member-medical/')) {
    return new NextResponse('Not found', { status: 404 });
  }

  if (request.method === 'POST' && NOOP_POST_PATHS.has(pathname)) {
    return new NextResponse(null, { status: 204 });
  }

  // Allow public routes and shared read-only pages
  if (
    publicRoutes.includes(pathname) ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/shared/') ||
    pathname.startsWith('/news/group/') ||
    pathname.startsWith('/music/')
  ) {
    return NextResponse.next();
  }

  // For API routes, check authentication via token in header
  if (pathname.startsWith('/api/')) {
    const token = request.cookies.get('token') || request.headers.get('authorization');
    if (
      !token &&
      !publicApiRoutes.some((route) => pathname.startsWith(route)) &&
      !isPublicSharedWorkoutApi(pathname) &&
      !isPublicMemberProfileView(request) &&
      !isPublicMemberPhoto(request) &&
      !isPublicClubDocumentsFolderApi(request)
    ) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // Page auth is handled client-side
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    '/uploads/member-medical/:path*',
  ],
};

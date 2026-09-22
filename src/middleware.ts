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
  /** Public read APIs (editorial news, shared OGP groups, etc.) */
  '/api/public/',
  /** Used by admin editors (Settings, subscriptions, recipes) — token is often in localStorage only */
  '/api/translate',
  /** Global sport dropdown catalog — GET is public; PUT still requires Super Admin in the route */
  '/api/admin/sport-dropdown-parameters',
];

/** Public share links (read-only workout day / session). */
function isPublicSharedWorkoutApi(pathname: string): boolean {
  return /^\/api\/workouts\/(days|sessions)\/[^/]+\/shared$/.test(pathname);
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
      !isPublicSharedWorkoutApi(pathname)
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
  ],
};

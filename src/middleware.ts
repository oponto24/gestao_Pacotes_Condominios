import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const WEBHOOK_PATHS = ['/api/webhooks/'];

function isOriginAllowed(req: NextRequest): boolean {
  // Webhooks are exempt — they come from external services (Meta, Clerk)
  if (WEBHOOK_PATHS.some((p) => req.nextUrl.pathname.startsWith(p))) return true;

  // Non-mutation requests are always allowed
  if (!MUTATION_METHODS.has(req.method)) return true;

  const origin = req.headers.get('origin');
  // No Origin header = same-origin request (non-browser or same-page fetch)
  if (!origin) return true;

  // Allow if origin matches the app's host
  const host = req.headers.get('host');
  if (!host) return true;

  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=()',
};

export default clerkMiddleware((_auth, req) => {
  if (!isOriginAllowed(req)) {
    return NextResponse.json(
      { ok: false, code: 'csrf_rejected', message: 'Origin not allowed' },
      { status: 403 },
    );
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};

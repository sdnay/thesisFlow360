
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// Ensure these are loaded from .env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function middleware(request: NextRequest) {
  const logPrefix = `[Middleware V9]`; // Incrementing version for clarity
  console.log(`${logPrefix} === Nouvelle requête ===`);
  console.log(`${logPrefix} URL demandée: ${request.url}`);
  console.log(`${logPrefix} Pathname extrait: ${request.nextUrl.pathname}`);

  // Create an initial response object. This will be potentially reassigned by cookie handlers.
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Defensive redirection for old /auth/login path
  if (request.nextUrl.pathname === '/auth/login') {
    const correctLoginUrl = new URL('/login', request.url);
    request.nextUrl.searchParams.forEach((value, key) => {
      correctLoginUrl.searchParams.append(key, value);
    });
    console.warn(`${logPrefix} DÉFENSE: Pathname était '/auth/login'. REDIRECTION vers ${correctLoginUrl.toString()}`);
    return NextResponse.redirect(correctLoginUrl);
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(`${logPrefix} ERREUR CRITIQUE: Supabase URL ou Anon Key non configurée dans .env. Le middleware ne peut pas fonctionner correctement.`);
    // Return a generic error or allow public access, but auth will fail.
    // For now, we'll return the initial response which might lead to pages erroring out if they need Supabase.
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // If the cookie is set, update the request cookies and response cookies
          request.cookies.set({
            name,
            value,
            ...options,
          });
          // Re-create response to carry over new request cookies
          // This `response` is the one from the middleware's outer scope.
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          // If the cookie is removed, update the request cookies and response cookies
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
           // Re-create response
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Refresh session if expired - important to do this before checking for user
  // This might modify cookies, which is why the `set` and `remove` handlers above
  // need to re-assign the `response` object in the middleware's scope.
  const { data: { user } } = await supabase.auth.getUser();
  console.log(`${logPrefix} Session utilisateur (via getUser):`, user ? `Présente (ID: ${user.id})` : 'Absente');

  const { pathname } = request.nextUrl;
  const publicPaths = ['/login']; // Define public paths

  // If the user is not authenticated
  if (!user) {
    if (!publicPaths.includes(pathname)) {
      console.log(`${logPrefix} Utilisateur non authentifié essayant d'accéder à une route protégée (${pathname}).`);
      const loginUrl = new URL('/login', request.url);
      let redirectTo = request.nextUrl.pathname;
      if (request.nextUrl.search) {
        redirectTo += request.nextUrl.search;
      }
      loginUrl.searchParams.set('redirectTo', redirectTo);
      console.log(`${logPrefix} Redirection vers ${loginUrl.toString()}`);
      return NextResponse.redirect(loginUrl);
    }
    console.log(`${logPrefix} Utilisateur non authentifié sur ${pathname} (chemin public). Autorisation.`);
    return response; // Return the (potentially modified by cookie handlers) response
  }

  // If the user IS authenticated
  if (user) {
    if (publicPaths.includes(pathname) && pathname !== '/') {
      const redirectToParam = request.nextUrl.searchParams.get('redirectTo');
      let targetUrlPath = redirectToParam || '/';
      const tempTargetUrl = new URL(targetUrlPath, request.url);
      if (publicPaths.includes(tempTargetUrl.pathname) && tempTargetUrl.pathname !== '/') {
        targetUrlPath = '/';
      }
      const targetUrl = new URL(targetUrlPath, request.url);
      request.nextUrl.searchParams.forEach((value, key) => {
        if (key !== 'redirectTo' && !targetUrl.searchParams.has(key)) {
          targetUrl.searchParams.set(key, value);
        }
      });
      console.log(`${logPrefix} Utilisateur authentifié sur ${pathname} (chemin public). Redirection vers ${targetUrl.toString()}`);
      return NextResponse.redirect(targetUrl);
    }
  }

  console.log(`${logPrefix} Autorisation de passage pour ${pathname}.`);
  return response; // Return the (potentially modified by cookie handlers) response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|sounds/|favicon.ico).*)',
  ],
};

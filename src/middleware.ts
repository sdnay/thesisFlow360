import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const PRESERVED_URL_PARAMS = ['monospaceUid']; // Paramètres à préserver lors des redirections

// Définir les routes publiques qui ne nécessitent pas d'authentification
const PUBLIC_ROUTES = ['/login']; 
// Ajoutez ici d'autres routes publiques si nécessaire, par exemple : '/signup', '/forgot-password'

export async function middleware(request: NextRequest) {
  const logPrefix = `[Middleware V7]`;
  console.log(`${logPrefix} === Nouvelle requête ===`);
  console.log(`${logPrefix} URL demandée: ${request.url}`);
  console.log(`${logPrefix} Pathname extrait: ${request.nextUrl.pathname}`);

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !(supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'))) {
    console.error(`${logPrefix} ERREUR CRITIQUE: NEXT_PUBLIC_SUPABASE_URL manquant ou invalide.`);
    return new Response("Erreur de configuration serveur.", { status: 500 });
  }
  if (!supabaseAnonKey) {
    console.error(`${logPrefix} ERREUR CRITIQUE: NEXT_PUBLIC_SUPABASE_ANON_KEY manquant.`);
    return new Response("Erreur de configuration serveur.", { status: 500 });
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
          const headers = new Headers(request.headers);
          const newRequest = new NextRequest(request.url, { headers });
          response = NextResponse.next({ request: newRequest });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          const headers = new Headers(request.headers);
          const newRequest = new NextRequest(request.url, { headers });
          response = NextResponse.next({ request: newRequest });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  console.log(`${logPrefix} Session utilisateur (via getUser):`, user ? `Présente (ID: ${user.id})` : 'Absente');

  const { pathname } = request.nextUrl;

  // Liste des routes qui DOIVENT être protégées (excluant les routes publiques)
  const protectedApplicationRoutes = ['/', '/tasks', '/brain-dump', '/daily-plan', '/pomodoro', '/sources', '/add-chapter'];

  // Déterminer si la route est publique
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  // Déterminer si la route est une route d'application qui doit être protégée
  // Une route est protégée si elle n'est PAS publique ET qu'elle fait partie des protectedApplicationRoutes
  const isProtectedRoute = !isPublicRoute && protectedApplicationRoutes.some(route => pathname === route || (route.endsWith('/') && pathname.startsWith(route)));

  // Redirection défensive pour l'ancienne URL d'authentification
  if (pathname === '/auth/login') {
    const correctLoginUrl = new URL('/login', request.url);
    PRESERVED_URL_PARAMS.forEach(param => {
        if (request.nextUrl.searchParams.has(param)) {
            correctLoginUrl.searchParams.set(param, request.nextUrl.searchParams.get(param)!);
        }
    });
    console.warn(`${logPrefix} REDIRECTION DÉFENSIVE: Pathname était '/auth/login'. Redirection vers ${correctLoginUrl.toString()}`);
    return NextResponse.redirect(correctLoginUrl);
  }

  // Si l'utilisateur n'est pas authentifié ET que la route est protégée
  if (!user && isProtectedRoute) {
    console.log(`${logPrefix} Utilisateur non authentifié essayant d'accéder à une route protégée (${pathname}).`);
    const loginUrl = new URL('/login', request.url);
    
    let redirectToPath = pathname;
    if (request.nextUrl.search) {
      redirectToPath += request.nextUrl.search;
    }
    loginUrl.searchParams.set('redirectTo', redirectToPath);

    PRESERVED_URL_PARAMS.forEach(param => {
        if (request.nextUrl.searchParams.has(param)) {
            loginUrl.searchParams.set(param, request.nextUrl.searchParams.get(param)!);
        }
    });

    console.log(`${logPrefix} Redirection vers ${loginUrl.toString()}`);
    return NextResponse.redirect(loginUrl);
  }

  // Si l'utilisateur est authentifié ET qu'il essaie d'accéder à une route publique (comme /login)
  // (sauf si c'est la racine, qui peut être une page de dashboard)
  if (user && isPublicRoute && pathname !== '/') {
    const redirectToParam = request.nextUrl.searchParams.get('redirectTo');
    // Si redirectTo est aussi une route publique, rediriger vers la racine par défaut pour éviter les boucles.
    const targetPath = redirectToParam && !PUBLIC_ROUTES.includes(new URL(redirectToParam, request.url).pathname) ? redirectToParam : '/';
    const targetUrl = new URL(targetPath, request.url);

    PRESERVED_URL_PARAMS.forEach(param => {
        if (request.nextUrl.searchParams.has(param) && !targetUrl.searchParams.has(param)) {
            targetUrl.searchParams.set(param, request.nextUrl.searchParams.get(param)!);
        }
    });

    console.log(`${logPrefix} Utilisateur authentifié sur une route publique (${pathname}). Redirection vers ${targetUrl.toString()}`);
    return NextResponse.redirect(targetUrl);
  }

  console.log(`${logPrefix} Autorisation de passage pour ${pathname}.`);
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|sounds/|favicon.ico).*)',
  ],
};
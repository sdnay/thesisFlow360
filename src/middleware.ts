
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const PRESERVED_URL_PARAMS = ['monospaceUid']; // Ajoutez ici d'autres paramètres que vous souhaitez préserver

export async function middleware(request: NextRequest) {
  const logPrefix = `[Middleware V7]`; // Mise à jour du préfixe pour les nouveaux logs
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
    // Peut-être retourner une réponse d'erreur 500 ici pour éviter de continuer.
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
          // Si la requête est en train d'être modifiée, nous devons cloner les en-têtes
          // et les appliquer à la nouvelle réponse.
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
  const protectedRoutes = ['/', '/tasks', '/brain-dump', '/daily-plan', '/pomodoro', '/sources', '/add-chapter'];
  const isProtectedRoute = protectedRoutes.some(route => pathname === route || (route.endsWith('/') && pathname.startsWith(route)));


  // Redirection défensive pour l'ancienne URL d'authentification
  if (pathname === '/auth/login') {
    const correctLoginUrl = new URL('/login', request.url);
    // Préserver les paramètres d'URL pertinents
    PRESERVED_URL_PARAMS.forEach(param => {
        if (request.nextUrl.searchParams.has(param)) {
            correctLoginUrl.searchParams.set(param, request.nextUrl.searchParams.get(param)!);
        }
    });
    console.warn(`${logPrefix} REDIRECTION DÉFENSIVE: Pathname était '/auth/login'. Redirection vers ${correctLoginUrl.toString()}`);
    return NextResponse.redirect(correctLoginUrl);
  }


  if (!user && isProtectedRoute) {
    console.log(`${logPrefix} Utilisateur non authentifié essayant d'accéder à une route protégée (${pathname}).`);
    const loginUrl = new URL('/login', request.url);
    
    // Préserver les paramètres d'URL originaux et `redirectTo`
    let redirectToPath = pathname;
    if (request.nextUrl.search) { // S'il y a des searchParams
      redirectToPath += request.nextUrl.search;
    }
    loginUrl.searchParams.set('redirectTo', redirectToPath);

    // Préserver aussi les paramètres spécifiques comme monospaceUid
    PRESERVED_URL_PARAMS.forEach(param => {
        if (request.nextUrl.searchParams.has(param)) {
            loginUrl.searchParams.set(param, request.nextUrl.searchParams.get(param)!);
        }
    });

    console.log(`${logPrefix} Redirection vers ${loginUrl.toString()}`);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === '/login') {
    const redirectToParam = request.nextUrl.searchParams.get('redirectTo');
    const targetUrl = new URL(redirectToParam || '/', request.url);

     // Préserver les paramètres spécifiques comme monospaceUid lors de la redirection post-login
    PRESERVED_URL_PARAMS.forEach(param => {
        if (request.nextUrl.searchParams.has(param) && !targetUrl.searchParams.has(param)) {
            targetUrl.searchParams.set(param, request.nextUrl.searchParams.get(param)!);
        }
    });

    console.log(`${logPrefix} Utilisateur authentifié sur /login. Redirection vers ${targetUrl.toString()}`);
    return NextResponse.redirect(targetUrl);
  }

  console.log(`${logPrefix} Autorisation de passage pour ${pathname}.`);
  return response;
}

export const config = {
  matcher: [
    /*
     * Correspond à tous les chemins de requête sauf ceux qui commencent par :
     * - api (routes API)
     * - _next/static (fichiers statiques Next.js)
     * - _next/image (fichiers d'optimisation d'image Next.js)
     * - sounds/ (dossier pour les sons)
     * - favicon.ico (fichier favicon)
     * Le matcher doit capturer /auth/login pour la redirection défensive.
     */
    '/((?!api|_next/static|_next/image|sounds/|favicon.ico).*)',
  ],
};

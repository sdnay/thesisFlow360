
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // console.log('[Middleware] === Nouvelle requête ===');
  // console.log('[Middleware] URL demandée:', request.url);
  // console.log('[Middleware] Pathname extrait:', request.nextUrl.pathname);

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Vérification explicite des variables d'environnement
  if (!supabaseUrl || !(supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'))) {
    console.error('[Middleware] ERREUR: NEXT_PUBLIC_SUPABASE_URL est manquant ou invalide dans .env');
    // Potentiellement retourner une page d'erreur ou un statut 500 ici
    // Pour le développement, on laisse passer pour voir l'erreur sur la page de login si elle est demandée.
  }
  if (!supabaseAnonKey) {
    console.error('[Middleware] ERREUR: NEXT_PUBLIC_SUPABASE_ANON_KEY est manquant dans .env');
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
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  // console.log('[Middleware] Session utilisateur:', session ? 'Présente (connecté)' : 'Absente (déconnecté)');

  const pathname = request.nextUrl.pathname;
  const protectedRoutes = ['/', '/app', '/tasks', '/brain-dump', '/daily-plan', '/pomodoro', '/sources', '/add-chapter']; // Ajoutez ici toutes vos routes protégées

  // Si l'utilisateur n'est pas connecté et essaie d'accéder à une route protégée
  if (!session && protectedRoutes.some(route => pathname === route || (route.endsWith('/*') && pathname.startsWith(route.slice(0, -2))))) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname + request.nextUrl.search); // Conserve les query params originaux
    // console.log(`[Middleware] Utilisateur non authentifié sur route protégée (${pathname}). Redirection vers: ${loginUrl.toString()}`);
    return NextResponse.redirect(loginUrl);
  }

  // Si l'utilisateur est connecté et essaie d'accéder à la page de connexion
  if (session && pathname === '/login') {
    // console.log('[Middleware] Utilisateur authentifié sur /login. Redirection vers /');
    return NextResponse.redirect(new URL('/', request.url));
  }

  // console.log(`[Middleware] Autorisation de passage pour ${pathname}.`);
  return response;
}

export const config = {
  matcher: [
    /*
     * Correspond à tous les chemins de requête sauf ceux qui commencent par :
     * - api (routes API)
     * - _next/static (fichiers statiques Next.js)
     * - _next/image (fichiers d'optimisation d'image Next.js)
     * - favicon.ico (fichier favicon)
     * - sounds/ (dossier pour les sons)
     */
    '/((?!api|_next/static|_next/image|sounds/|favicon.ico).*)',
  ],
};


import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Vérifications initiales des variables d'environnement
  if (!supabaseUrl) {
    console.error("Middleware Critical Error: La variable d'environnement NEXT_PUBLIC_SUPABASE_URL n'est pas définie.");
    // Permettre à la page de connexion de tenter de s'afficher même en cas d'erreur de configuration critique
    if (request.nextUrl.pathname === '/auth/login') {
      console.warn("Tentative d'accès à /auth/login malgré l'absence de SUPABASE_URL.");
      return response; // Laisse passer vers la page de login
    }
    return new NextResponse("Erreur de configuration serveur : URL Supabase manquante.", { status: 500 });
  }

  if (!(supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'))) {
    console.error(`Middleware Critical Error: L'URL Supabase (NEXT_PUBLIC_SUPABASE_URL) semble invalide : '${supabaseUrl}'. Elle doit commencer par 'http://' ou 'https://'.`);
    if (request.nextUrl.pathname === '/auth/login') {
      console.warn("Tentative d'accès à /auth/login malgré une URL Supabase invalide.");
      return response;
    }
    return new NextResponse("Erreur de configuration serveur : URL Supabase invalide.", { status: 500 });
  }

  if (!supabaseAnonKey) {
    console.error("Middleware Critical Error: La variable d'environnement NEXT_PUBLIC_SUPABASE_ANON_KEY n'est pas définie.");
    if (request.nextUrl.pathname === '/auth/login') {
      console.warn("Tentative d'accès à /auth/login malgré l'absence de SUPABASE_ANON_KEY.");
      return response;
    }
    return new NextResponse("Erreur de configuration serveur : Clé anonyme Supabase manquante.", { status: 500 });
  }

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            // Il est crucial de recréer l'objet `response` si les cookies sont modifiés.
            // Cf: https://supabase.com/docs/guides/auth/server-side/nextjs#managing-session-with-middleware
            const newResponseHeaders = new Headers(request.headers);
            const newRequest = new NextRequest(request.nextUrl, {
                headers: newResponseHeaders,
            });
            response = NextResponse.next({ request: newRequest });
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            const newResponseHeaders = new Headers(request.headers);
            const newRequest = new NextRequest(request.nextUrl, {
                headers: newResponseHeaders,
            });
            response = NextResponse.next({ request: newRequest });
            response.cookies.set({ name, value: '', ...options });
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    const { pathname } = request.nextUrl;

    // Rediriger vers la page de connexion si l'utilisateur n'est pas authentifié et essaie d'accéder à une page protégée
    if (!session && pathname.startsWith('/app')) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      console.log(`Middleware: Utilisateur non authentifié redirigé de ${pathname} vers ${loginUrl.toString()}`);
      return NextResponse.redirect(loginUrl);
    }

    // Rediriger vers la page d'accueil si l'utilisateur est authentifié et essaie d'accéder à la page de connexion
    if (session && pathname === '/auth/login') {
      console.log("Middleware: Utilisateur authentifié redirigé de /auth/login vers /");
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Si aucune redirection, retourner la réponse (potentiellement modifiée par les gestionnaires de cookies)
    return response;

  } catch (e: any) {
    console.error('Middleware Error: Une erreur inattendue est survenue lors de l\'opération Supabase ou de la gestion de session.', e.message, e.stack);
    
    // Si une erreur survient et que l'utilisateur essaie d'accéder à la page de connexion,
    // laisser passer la requête pour éviter des boucles de redirection ou de cacher des erreurs de la page elle-même.
    if (request.nextUrl.pathname === '/auth/login') {
      console.warn("Middleware: Passage autorisé vers /auth/login malgré une erreur interne du middleware.");
      // Retourner une nouvelle réponse `NextResponse.next()` pour s'assurer qu'elle n'est pas "corrompue"
      // par un état précédent si les gestionnaires de cookies n'ont pas pu s'exécuter correctement.
      return NextResponse.next({
        request: {
          headers: request.headers,
        },
      });
    }

    // Pour les autres pages, une erreur dans le middleware est critique.
    return new NextResponse(
        'Une erreur interne est survenue dans le middleware. Veuillez réessayer plus tard.',
        { status: 500 }
    );
  }
}

export const config = {
  matcher: [
    /*
     * Correspond à tous les chemins de requête sauf ceux qui commencent par :
     * - api (chemins API)
     * - _next/static (fichiers statiques)
     * - _next/image (optimisation d'images)
     * - favicon.ico (fichier favicon)
     * - /sounds/ (pour éviter que le middleware ne bloque les fichiers audio)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sounds/).*)',
    // Spécifiquement les pages de l'application principale et les pages d'authentification
    '/app/:path*',
    '/auth/:path*',
  ],
};

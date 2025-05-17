
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { pathname } = request.nextUrl;
  console.log(`[Middleware] === Nouvelle requête ===`);
  console.log(`[Middleware] URL demandée: ${request.url}`);
  console.log(`[Middleware] Pathname extrait: ${pathname}`);

  // --- Vérification des variables d'environnement Supabase ---
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    console.error("[Middleware] ERREUR CRITIQUE: NEXT_PUBLIC_SUPABASE_URL n'est pas défini.");
    // Pour la page de login, on la laisse s'afficher même avec cette erreur serveur pour le debug.
    if (pathname === '/login') {
        console.warn("[Middleware] Tentative d'accès à /login malgré l'absence de SUPABASE_URL.");
        return response;
    }
    return new NextResponse("Erreur de configuration serveur : URL Supabase manquante.", { status: 500 });
  }

  if (!(supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'))) {
    console.error(`[Middleware] ERREUR CRITIQUE: L'URL Supabase (NEXT_PUBLIC_SUPABASE_URL) semble invalide : '${supabaseUrl}'. Elle doit commencer par 'http://' ou 'https://'.`);
     if (pathname === '/login') {
        console.warn("[Middleware] Tentative d'accès à /login malgré une URL Supabase invalide.");
        return response;
    }
    return new NextResponse("Erreur de configuration serveur : URL Supabase invalide.", { status: 500 });
  }

  if (!supabaseAnonKey) {
    console.error("[Middleware] ERREUR CRITIQUE: NEXT_PUBLIC_SUPABASE_ANON_KEY n'est pas défini.");
    if (pathname === '/login') {
        console.warn("[Middleware] Tentative d'accès à /login malgré l'absence de SUPABASE_ANON_KEY.");
        return response;
    }
    return new NextResponse("Erreur de configuration serveur : Clé anonyme Supabase manquante.", { status: 500 });
  }
  // --- Fin de la vérification des variables d'environnement ---

  // Redirection défensive : si /auth/login est atteint, forcer vers /login
  // Cela ne devrait pas être nécessaire si toutes les autres parties de l'application et les redirections
  // pointent correctement vers /login.
  if (pathname === '/auth/login') {
    const correctLoginUrl = new URL('/login', request.url);
    console.warn(`[Middleware] Redirection défensive : Pathname était '/auth/login'. Redirection vers ${correctLoginUrl.toString()}`);
    return NextResponse.redirect(correctLoginUrl);
  }

  try {
    console.log(`[Middleware] Initialisation du client Supabase pour le middleware...`);
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
            // Assurez-vous que `response` est la variable de portée du middleware.
            const currentHeaders = new Headers(response.headers); // Utiliser les headers de la réponse actuelle
            const newReq = new NextRequest(request.nextUrl.clone(), { headers: currentHeaders }); // Cloner la requête originale
            response = NextResponse.next({ request: newReq }); // Recréer la réponse
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            const currentHeaders = new Headers(response.headers);
            const newReq = new NextRequest(request.nextUrl.clone(), { headers: currentHeaders });
            response = NextResponse.next({ request: newReq });
            response.cookies.set({ name, value: '', ...options });
          },
        },
      }
    );

    console.log(`[Middleware] Récupération de la session Supabase...`);
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error(`[Middleware] Erreur lors de la récupération de la session: ${sessionError.message}`);
      // En cas d'erreur de session, laissez passer vers /login pour éviter une boucle, sinon erreur 500
      if (pathname === '/login') {
        console.warn("[Middleware] Erreur de session Supabase, mais autorisation de passage vers /login.");
        return response;
      }
      return new NextResponse("Erreur interne lors de la récupération de la session.", { status: 500 });
    }
    
    console.log(`[Middleware] Session utilisateur: ${session ? 'Présente (connecté)' : 'Absente (déconnecté)'}`);

    const isAppRoute = pathname.startsWith('/app') || pathname === '/'; // Protéger la racine et /app/*
    
    // Si l'utilisateur n'est pas connecté
    if (!session) {
      if (pathname === '/login') {
        console.log(`[Middleware] Utilisateur non authentifié sur /login. Autorisation.`);
        return response; // Autoriser l'accès à la page de connexion
      }
      if (isAppRoute) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirectTo', pathname); // Garder l'URL de redirection
        console.log(`[Middleware] Utilisateur non authentifié essayant d'accéder à une route protégée (${pathname}). Redirection vers ${loginUrl.toString()}`);
        return NextResponse.redirect(loginUrl);
      }
      console.log(`[Middleware] Utilisateur non authentifié sur une route non gérée spécifiquement (${pathname}). Autorisation par défaut.`);
      return response; // Pour les autres routes (ex: assets publics non matchés par le matcher négatif)
    }

    // Si l'utilisateur EST connecté
    if (session) {
      if (pathname === '/login') {
        const rootUrl = new URL('/', request.url);
        console.log(`[Middleware] Utilisateur authentifié essayant d'accéder à /login. Redirection vers ${rootUrl.toString()}.`);
        return NextResponse.redirect(rootUrl);
      }
    }

    console.log(`[Middleware] Autorisation de passage pour ${pathname} (Session: ${!!session}).`);
    return response;

  } catch (e: any) {
    console.error('[Middleware] ERREUR INATTENDUE dans le bloc try/catch principal:', e.message, e.stack);
    if (pathname === '/login') {
      console.warn("[Middleware] Erreur interne non gérée, mais autorisation de passage vers /login pour éviter boucle de redirection.");
      // Retourner une nouvelle réponse `NextResponse.next()` pour s'assurer qu'elle n'est pas "corrompue"
      return NextResponse.next({
        request: {
          headers: request.headers,
        },
      });
    }
    return new NextResponse(
        'Une erreur interne est survenue dans le middleware. Veuillez réessayer plus tard.',
        { status: 500 }
    );
  }
}

export const config = {
  matcher: [
    /*
     * Faire correspondre tous les chemins de requête sauf ceux commençant par :
     * - api (routes API)
     * - _next/static (fichiers statiques)
     * - _next/image (fichiers d'optimisation d'image)
     * - favicon.ico (fichier favicon)
     * - sounds/ (si vous avez des fichiers audio publics)
     * Assurez-vous que ce pattern correspond à vos besoins.
     */
    '/((?!api|_next/static|_next/image|sounds/|favicon.ico).*)',
  ],
};

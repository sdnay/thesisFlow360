
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

  if (!supabaseUrl) {
    console.error("Middleware Error: Supabase URL (NEXT_PUBLIC_SUPABASE_URL) is not defined.");
    // Optional: return a generic error response or allow request to proceed to potentially show a different error page
    // For now, we'll let it try to proceed, but createServerClient will likely fail.
    // return new NextResponse("Configuration error: Supabase URL missing", { status: 500 });
  } else if (!(supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'))) {
    console.error(`Middleware Error: The Supabase URL (NEXT_PUBLIC_SUPABASE_URL) appears to be invalid. It must start with 'http://' or 'https://'. Current value: '${supabaseUrl}'`);
    // return new NextResponse("Configuration error: Supabase URL invalid", { status: 500 });
  }

  if (!supabaseAnonKey) {
    console.error("Middleware Error: Supabase anonymous key (NEXT_PUBLIC_SUPABASE_ANON_KEY) is not defined.");
    // return new NextResponse("Configuration error: Supabase key missing", { status: 500 });
  }

  // Ensure variables are passed to createServerClient, even if they might be undefined
  // createServerClient itself will throw an error if they are invalid.
  const supabase = createServerClient(
    supabaseUrl || '', // Pass empty string if undefined, createServerClient should handle this
    supabaseAnonKey || '', // Pass empty string if undefined
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ // Re-assign response when cookies are set
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ // Re-assign response when cookies are set
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  const { pathname } = request.nextUrl;

  // Si l'utilisateur n'est pas connecté et essaie d'accéder à une page protégée (sous /app)
  if (!session && pathname.startsWith('/app')) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname); // Garder l'URL de redirection
    return NextResponse.redirect(loginUrl);
  }

  // Si l'utilisateur est connecté et essaie d'accéder à la page de connexion
  if (session && pathname === '/auth/login') {
    return NextResponse.redirect(new URL('/', request.url)); // Rediriger vers la page d'accueil
  }

  return response;
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

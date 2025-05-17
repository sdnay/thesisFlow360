
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
    // Spécifiquement les pages de l'application principale et les pages d'authentification
    '/app/:path*',
    '/auth/:path*',
  ],
};

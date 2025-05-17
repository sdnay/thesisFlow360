
"use client";

import type { FC, PropsWithChildren } from 'react';
import { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { AuthChangeEvent, Session, User, SignInWithPasswordCredentials, Subscription } from '@supabase/supabase-js';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  signInWithPassword: (credentials: Pick<SignInWithPasswordCredentials, 'email' | 'password'>) => Promise<{ error: Error | null; session: Session | null }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const getInitialSession = async () => {
      setIsLoading(true);
      console.log("[AuthContext] Récupération de la session initiale...");
      const { data: { session: initialSession }, error } = await supabase.auth.getSession();
      if (error) {
        console.error("[AuthContext] Erreur getInitialSession:", error);
      }
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setIsLoading(false);
      console.log("[AuthContext] Session initiale:", initialSession ? 'Présente' : 'Absente');

      // Initial check for redirection if on login page with session or protected page without session
      if (!initialSession && pathname !== '/login' && !pathname.startsWith('/_next/') && pathname !== '/favicon.ico') {
        const protectedRoutes = ['/', '/app', '/tasks', '/brain-dump', '/daily-plan', '/pomodoro', '/sources', '/add-chapter'];
        if (protectedRoutes.some(route => pathname === route || (route.endsWith('/*') && pathname.startsWith(route.slice(0, -2))))) {
            console.log(`[AuthContext] Initial load: Utilisateur non authentifié sur route protégée (${pathname}). Redirection vers /login.`);
            router.push(`/login?redirectTo=${pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`);
        }
      } else if (initialSession && pathname === '/login') {
        const redirectTo = searchParams.get('redirectTo') || '/';
        console.log(`[AuthContext] Initial load: Utilisateur authentifié sur /login. Redirection vers ${redirectTo}.`);
        router.push(redirectTo);
      }
    };

    getInitialSession();

    const { data: authListenerData } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        console.log(`[AuthContext] onAuthStateChange - Événement: ${event}, Nouvelle session:`, newSession ? 'Présente' : 'Absente');
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setIsLoading(false);

        if (event === 'SIGNED_OUT') {
          console.log("[AuthContext] Utilisateur déconnecté, redirection vers /login");
          router.push('/login');
        } else if (event === 'SIGNED_IN') {
          if (pathname === '/login' || pathname === '/auth/login') { // Check both just in case
            const redirectTo = searchParams.get('redirectTo') || '/';
            console.log(`[AuthContext] Utilisateur connecté sur la page de login, redirection vers: ${redirectTo}`);
            router.push(redirectTo);
          } else {
            // User signed in, but was not on the login page.
            // Usually, no redirect is needed here unless it's the very first sign-in of a session.
            // Or if they were on a public page and signed in via a modal.
            // For now, we assume the middleware or page logic handles other cases.
          }
        }
      }
    );

    // Correctly access the subscription object for unsubscribe
    const subscription = authListenerData?.subscription;

    return () => {
      subscription?.unsubscribe();
    };
  }, [router, pathname, searchParams]);

  const signOut = async () => {
    console.log("[AuthContext] Tentative de déconnexion...");
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("[AuthContext] Erreur de déconnexion:", error);
    }
    // onAuthStateChange gérera la mise à jour de l'état et la redirection
  };

  const signInWithPassword = useCallback(
    async (credentials: Pick<SignInWithPasswordCredentials, 'email' | 'password'>) => {
      setIsLoading(true);
      console.log("[AuthContext] Tentative de signInWithPassword...");
      const { data, error } = await supabase.auth.signInWithPassword(credentials);
      // onAuthStateChange devrait mettre à jour user et session.
      setIsLoading(false);
      if (error) {
        console.error("[AuthContext] Erreur signInWithPassword:", error);
      } else {
        console.log("[AuthContext] signInWithPassword réussi, session:", data.session ? 'Présente' : 'Absente');
      }
      return { error, session: data.session };
    },
    []
  );

  const value = useMemo(() => ({
    user,
    session,
    isLoading,
    signOut,
    signInWithPassword,
  }), [user, session, isLoading, signOut, signInWithPassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

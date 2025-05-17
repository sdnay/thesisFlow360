
"use client";

import type { FC, PropsWithChildren } from 'react';
import { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { AuthChangeEvent, Session, User, SignInWithPasswordCredentials } from '@supabase/supabase-js';
import { useRouter, usePathname, useSearchParams } from 'next/navigation'; // Ajout de usePathname et useSearchParams

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
  const pathname = usePathname(); // Pour connaître la page actuelle
  const searchParams = useSearchParams(); // Pour lire les query params comme redirectTo

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
    };

    getInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        console.log(`[AuthContext] onAuthStateChange - Événement: ${event}, Nouvelle session:`, newSession ? 'Présente' : 'Absente');
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setIsLoading(false); // Important de le mettre à false ici aussi

        if (event === 'SIGNED_OUT') {
          console.log("[AuthContext] Utilisateur déconnecté, redirection vers /login");
          router.push('/login');
        } else if (event === 'SIGNED_IN' && pathname === '/login') {
          const redirectTo = searchParams.get('redirectTo') || '/';
          console.log(`[AuthContext] Utilisateur connecté sur /login, redirection vers: ${redirectTo}`);
          router.push(redirectTo);
        }
      }
    );

    return () => {
      authListener?.unsubscribe();
    };
  }, [router, pathname, searchParams]);

  const signOut = async () => {
    console.log("[AuthContext] Tentative de déconnexion...");
    await supabase.auth.signOut();
    // onAuthStateChange gérera la redirection vers /login
  };

  const signInWithPassword = useCallback(
    async (credentials: Pick<SignInWithPasswordCredentials, 'email' | 'password'>) => {
      setIsLoading(true);
      console.log("[AuthContext] Tentative de signInWithPassword...");
      const { data, error } = await supabase.auth.signInWithPassword(credentials);
      // onAuthStateChange devrait mettre à jour user et session.
      // La redirection post-connexion est gérée par le listener onAuthStateChange si pathname est /login.
      setIsLoading(false);
      if(error) console.error("[AuthContext] Erreur signInWithPassword:", error);
      else console.log("[AuthContext] signInWithPassword réussi, session:", data.session ? 'Présente' : 'Absente');
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

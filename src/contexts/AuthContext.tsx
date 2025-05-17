
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
    setIsLoading(true);
    console.log("[AuthContext] Récupération de la session initiale...");
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (error) {
        console.error("[AuthContext] Erreur getSession:", error);
      }
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setIsLoading(false);
      console.log("[AuthContext] Session initiale terminée:", initialSession ? 'Présente' : 'Absente');
      // La redirection initiale est gérée par le middleware et les layouts/pages spécifiques
    });

    const { data: authListenerData } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession: Session | null) => {
        console.log(`[AuthContext] onAuthStateChange - Événement: ${event}, Nouvelle session:`, newSession ? 'Présente' : 'Absente');
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setIsLoading(false); // Important de mettre à jour isLoading ici aussi

        if (event === 'SIGNED_OUT') {
          console.log("[AuthContext] Utilisateur déconnecté, redirection vers /login depuis onAuthStateChange");
          router.push('/login');
        } else if (event === 'SIGNED_IN') {
          // Si l'utilisateur vient de se connecter, la page /login devrait gérer la redirection
          // via son propre useEffect basé sur la présence de la session.
          // Si l'utilisateur était sur /login lors de SIGNED_IN (par ex. via un autre onglet),
          // la page /login elle-même redirigera.
          const currentPath = pathname + searchParams.toString();
          const redirectTo = searchParams.get('redirectTo');
          if (pathname === '/login' && redirectTo) {
            console.log(`[AuthContext] SIGNED_IN sur /login, redirection vers redirectTo: ${redirectTo}`);
            router.push(redirectTo);
          } else if (pathname === '/login') {
            console.log(`[AuthContext] SIGNED_IN sur /login, redirection vers /`);
            router.push('/');
          }
        }
      }
    );

    const subscription = authListenerData?.subscription;

    return () => {
      subscription?.unsubscribe();
    };
  }, [router, pathname, searchParams]); // searchParams ajouté ici pour la logique SIGNED_IN

  const signOut = async () => {
    console.log("[AuthContext] Tentative de déconnexion...");
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("[AuthContext] Erreur de déconnexion:", error);
    }
    // onAuthStateChange gérera la mise à jour de l'état et la redirection vers /login
  };

  const signInWithPassword = useCallback(
    async (credentials: Pick<SignInWithPasswordCredentials, 'email' | 'password'>) => {
      setIsLoading(true); // Peut être utile si la connexion prend du temps
      console.log("[AuthContext] Tentative de signInWithPassword...");
      const { data, error } = await supabase.auth.signInWithPassword(credentials);
      // onAuthStateChange devrait mettre à jour user et session.
      // setIsLoading(false) sera géré par onAuthStateChange
      if (error) {
        console.error("[AuthContext] Erreur signInWithPassword:", error);
        setIsLoading(false); // S'assurer de le remettre à false en cas d'erreur ici aussi
      } else {
        console.log("[AuthContext] signInWithPassword réussi, session:", data.session ? 'Présente' : 'Absente');
        // isLoading sera mis à false par onAuthStateChange
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

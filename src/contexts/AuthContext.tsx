
"use client";

import type { FC, PropsWithChildren } from 'react';
import { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import type { AuthChangeEvent, Session, User, SignInWithPasswordCredentials } from '@supabase/supabase-js';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean; // True only during initial auth check
  initialAuthCheckCompleted: boolean;
  signOut: () => Promise<void>;
  signInWithPassword: (credentials: Pick<SignInWithPasswordCredentials, 'email' | 'password'>) => Promise<{ error: Error | null; session: Session | null }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<PropsWithChildren> = ({ children }) => {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [initialAuthCheckCompleted, setInitialAuthCheckCompleted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParamsHook = useSearchParams(); // Renamed to avoid conflict

  useEffect(() => {
    console.log("[AuthContext] Initialisation du contexte et récupération de la session initiale...");

    const getInitialSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        console.log("[AuthContext] Session initiale récupérée:", initialSession ? `Présente (User ID: ${initialSession.user.id})` : 'Absente');
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
      } catch (error) {
        console.error("[AuthContext] Erreur lors de getSession:", error);
      } finally {
        setInitialAuthCheckCompleted(true);
        console.log("[AuthContext] Vérification initiale de la session terminée.");
      }
    };

    getInitialSession();

    const { data: authListenerData } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession: Session | null) => {
        console.log(`[AuthContext] onAuthStateChange - Événement: ${event}, Nouvelle session:`, newSession ? `Présente (User ID: ${newSession.user.id})` : 'Absente', 'Pathname actuel:', pathname);
        
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        // S'assurer que initialAuthCheckCompleted est vrai si un événement d'auth se produit
        if (!initialAuthCheckCompleted) {
          setInitialAuthCheckCompleted(true);
        }

        if (event === 'SIGNED_OUT') {
          console.log("[AuthContext] Utilisateur déconnecté (SIGNED_OUT), redirection vers /login.");
          router.replace('/login'); // Utiliser replace pour ne pas polluer l'historique
        } else if (event === 'SIGNED_IN') {
          console.log(`[AuthContext] Événement SIGNED_IN détecté. Pathname actuel: ${pathname}`);
          const redirectToParam = searchParamsHook.get('redirectTo');

          // Rediriger SEULEMENT si l'utilisateur est actuellement sur la page /login
          // et qu'une session vient d'être établie (ce qui inclut INITIAL_SESSION au premier chargement sur /login)
          if (pathname === '/login') {
            if (redirectToParam) {
              console.log(`[AuthContext] SIGNED_IN sur /login, redirection vers redirectTo: ${redirectToParam}`);
              router.replace(redirectToParam);
            } else {
              console.log("[AuthContext] SIGNED_IN sur /login, redirection vers / par défaut.");
              router.replace('/');
            }
          }
          // Si SIGNED_IN (par exemple INITIAL_SESSION) se produit sur une autre page (ex: /tasks après un F5),
          // NE PAS rediriger depuis ici. La page est déjà la bonne.
        }
      }
    );
    
    const subscription = authListenerData?.subscription;

    return () => {
      subscription?.unsubscribe();
      console.log("[AuthContext] Listener onAuthStateChange désabonné.");
    };
  }, [supabase, router, initialAuthCheckCompleted, pathname, searchParamsHook]); // Ajout de pathname et searchParamsHook

  const signOut = useCallback(async () => {
    console.log("[AuthContext] Tentative de déconnexion...");
    await supabase.auth.signOut();
    // onAuthStateChange gérera la mise à jour de l'état et la redirection vers /login.
  }, [supabase]);

  const signInWithPassword = useCallback(
    async (credentials: Pick<SignInWithPasswordCredentials, 'email' | 'password'>) => {
      console.log("[AuthContext] Tentative de signInWithPassword...");
      const { data, error } = await supabase.auth.signInWithPassword(credentials);
      if (error) {
        console.error("[AuthContext] Erreur signInWithPassword:", error);
      } else {
        console.log("[AuthContext] signInWithPassword réussi, session:", data.session ? 'Présente' : 'Absente');
        // onAuthStateChange devrait gérer la mise à jour de l'état et la redirection.
      }
      return { error, session: data.session };
    },
    [supabase]
  );

  const value = useMemo(() => ({
    user,
    session,
    isLoading: !initialAuthCheckCompleted,
    initialAuthCheckCompleted,
    signOut,
    signInWithPassword,
  }), [user, session, initialAuthCheckCompleted, signOut, signInWithPassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

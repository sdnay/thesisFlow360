
"use client";

import type { FC, PropsWithChildren } from 'react';
import { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient'; // Modifié pour utiliser la fonction
import type { AuthChangeEvent, Session, User, SignInWithPasswordCredentials, Subscription } from '@supabase/supabase-js';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean; // Renommé depuis isAuthLoading pour clarté
  initialAuthCheckCompleted: boolean; // Pour savoir si la première vérification de session est terminée
  signOut: () => Promise<void>;
  signInWithPassword: (credentials: Pick<SignInWithPasswordCredentials, 'email' | 'password'>) => Promise<{ error: Error | null; session: Session | null }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<PropsWithChildren> = ({ children }) => {
  // Créez une instance du client Supabase pour le navigateur ici
  // Cela garantit que le client est créé uniquement côté client
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [initialAuthCheckCompleted, setInitialAuthCheckCompleted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    console.log("[AuthContext] Démarrage de la vérification initiale de la session...");

    const getInitialSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        console.log("[AuthContext] Session initiale récupérée:", initialSession ? 'Présente' : 'Absente');
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

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession: Session | null) => {
        console.log(`[AuthContext] onAuthStateChange - Événement: ${event}, Nouvelle session:`, newSession ? 'Présente' : 'Absente', 'Pathname actuel:', pathname);
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setInitialAuthCheckCompleted(true); // S'assurer que c'est toujours vrai après un changement

        if (event === 'SIGNED_OUT') {
          console.log("[AuthContext] Utilisateur déconnecté, redirection vers /login.");
          if (pathname !== '/login') { // Éviter une redirection si déjà sur /login
            router.push('/login');
          }
        } else if (event === 'SIGNED_IN') {
          const redirectTo = searchParams.get('redirectTo');
          console.log(`[AuthContext] SIGNED_IN détecté. redirectTo: ${redirectTo}, Pathname actuel: ${pathname}`);
          if (redirectTo) {
            console.log(`[AuthContext] Redirection vers redirectTo: ${redirectTo}`);
            router.push(redirectTo);
          } else {
            console.log("[AuthContext] Redirection vers / par défaut après SIGNED_IN.");
            router.push('/');
          }
        }
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
      console.log("[AuthContext] Listener onAuthStateChange désabonné.");
    };
  }, [supabase, router, pathname, searchParams]); // Ajout de supabase, pathname, searchParams aux dépendances

  const signOut = useCallback(async () => {
    console.log("[AuthContext] Tentative de déconnexion...");
    await supabase.auth.signOut();
    // onAuthStateChange gérera la mise à jour de l'état et la redirection.
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
    isLoading: !initialAuthCheckCompleted, // isLoading est vrai tant que la vérif initiale n'est pas faite
    initialAuthCheckCompleted,
    signOut,
    signInWithPassword,
  }), [user, session, initialAuthCheckCompleted, signOut, signInWithPassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

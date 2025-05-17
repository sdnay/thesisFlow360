
"use client";

import type { FC, PropsWithChildren } from 'react';
import { createContext, useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const getInitialSession = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setIsLoading(false);
    };

    getInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setIsLoading(false);

        if (event === 'SIGNED_OUT') {
          router.push('/auth/login');
        } else if (event === 'SIGNED_IN' && window.location.pathname === '/auth/login') {
          // Rediriger après connexion si l'utilisateur est sur la page de login
          // Vous pouvez stocker l'URL de redirection souhaitée avant d'aller à la page de login
          // et la récupérer ici, ou simplement rediriger vers le tableau de bord.
           router.push('/');
        }
      }
    );

    return () => {
      authListener?.unsubscribe();
    };
  }, [router]);

  const signOut = async () => {
    await supabase.auth.signOut();
    // onAuthStateChange gérera la redirection
  };

  const value = useMemo(() => ({
    user,
    session,
    isLoading,
    signOut,
  }), [user, session, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


"use client";

import type { FC, PropsWithChildren } from 'react';
import { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { AuthChangeEvent, Session, User, SignInWithPasswordCredentials } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  signInWithPassword: (credentials: SignInWithPasswordCredentials) => Promise<{ error: Error | null; session: Session | null }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const getInitialSession = async () => {
      setIsLoading(true);
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
          router.push('/login');
        } else if (event === 'SIGNED_IN' && (window.location.pathname === '/login' || window.location.pathname === '/auth/login')) {
          const redirectTo = new URLSearchParams(window.location.search).get('redirectTo') || '/';
          router.push(redirectTo);
        }
      }
    );

    return () => {
      authListener?.unsubscribe();
    };
  }, [router]);

  const signOut = async () => {
    await supabase.auth.signOut();
    // onAuthStateChange gérera la redirection vers /login
  };

  const signInWithPassword = useCallback(
    async (credentials: SignInWithPasswordCredentials) => {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword(credentials);
      // onAuthStateChange mettra à jour user et session, et gérera la redirection
      setIsLoading(false);
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


"use client";

import { AppLayout } from '@/components/layout/app-layout';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, isLoading, initialAuthCheckCompleted } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log(`[DashboardLayout] isLoading: ${isLoading}, initialAuthCheckCompleted: ${initialAuthCheckCompleted}, session: ${session ? 'Présente' : 'Absente'}`);
    // Rediriger seulement si la vérification initiale de l'authentification est terminée et qu'il n'y a pas de session
    if (initialAuthCheckCompleted && !session) {
      console.log("[DashboardLayout] Pas de session et vérification initiale terminée. Redirection vers /login.");
      router.replace('/login'); // Redirige si pas de session et que le chargement est terminé
    }
  }, [initialAuthCheckCompleted, session, router, isLoading]); // Ajout de isLoading pour ré-évaluer si cet état change

  // Afficher un loader tant que la vérification initiale de l'authentification n'est pas terminée
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-muted-foreground">Vérification de la session...</p>
      </div>
    );
  }

  // Si la vérification est terminée mais qu'il n'y a toujours pas de session,
  // le useEffect ci-dessus devrait avoir redirigé. On peut afficher un loader en attendant.
  if (!session) {
    return (
       <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-muted-foreground">Redirection vers la connexion...</p>
      </div>
    );
  }

  // Si l'utilisateur est connecté (session existe et vérification initiale terminée), afficher le layout de l'application
  return <AppLayout>{children}</AppLayout>;
}

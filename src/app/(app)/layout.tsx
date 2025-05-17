
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
  const { session, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // console.log(`[DashboardLayout] isLoading: ${isLoading}, session: ${session ? 'Présente' : 'Absente'}`);
    if (!isLoading && !session) {
      // console.log("[DashboardLayout] Pas de session et chargement terminé. Redirection vers /login.");
      router.replace('/login'); // Redirige si pas de session et que le chargement est terminé
    }
  }, [isLoading, session, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-muted-foreground">Chargement de la session...</p>
      </div>
    );
  }

  if (!session) {
    // Affiche un état de chargement ou rien en attendant la redirection gérée par le useEffect.
    // Cela évite un flash de contenu non protégé si le middleware n'a pas encore agi (moins probable avec le matcher actuel).
    return (
       <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-muted-foreground">Vérification de l'authentification...</p>
      </div>
    );
  }

  // Si l'utilisateur est connecté (session existe), afficher le layout de l'application
  return <AppLayout>{children}</AppLayout>;
}

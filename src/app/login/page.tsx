
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn } from 'lucide-react';

export default function LoginPage() {
  // console.log("[LoginPage] Component RENDERED");

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signInWithPassword, session, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    // Si l'utilisateur est déjà connecté (session existe et auth n'est plus en chargement),
    // et qu'il arrive sur la page de login, on le redirige.
    if (!isAuthLoading && session) {
      const redirectTo = searchParams.get('redirectTo') || '/';
      // console.log(`[LoginPage] Session active détectée (isAuthLoading: ${isAuthLoading}). Redirection vers: ${redirectTo}`);
      router.replace(redirectTo);
    }
  }, [session, isAuthLoading, router, searchParams]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    // console.log(`[LoginPage] Tentative de connexion avec l'email: ${email}`);

    const { error, session: newSession } = await signInWithPassword({ email, password });

    if (error) {
      console.error("[LoginPage] Erreur de connexion Supabase:", error);
      toast({
        title: "Erreur de connexion",
        description: error.message || "Une erreur est survenue. Veuillez réessayer.",
        variant: "destructive",
      });
    } else if (newSession) {
      // console.log("[LoginPage] Connexion réussie, nouvelle session:", newSession);
      toast({
        title: "Connexion réussie",
        description: "Vous allez être redirigé.",
      });
      // La redirection est maintenant principalement gérée par le listener onAuthStateChange dans AuthContext
      // et par le middleware pour les accès initiaux.
      // On pourrait forcer ici, mais laissons AuthContext le gérer pour la cohérence.
      // const redirectTo = searchParams.get('redirectTo') || '/';
      // router.replace(redirectTo);
    } else {
      // Ce cas ne devrait pas arriver si signInWithPassword retourne toujours une session ou une erreur.
      console.error("[LoginPage] Problème inattendu: pas de session ni d'erreur après la tentative de connexion.");
      toast({
        title: "Erreur inattendue",
        description: "Un problème est survenu lors de la connexion. Veuillez réessayer.",
        variant: "destructive",
      });
    }
    setIsSubmitting(false);
  };

  // Si AuthContext est en train de charger la session initiale, OU si une session existe déjà
  // et que la redirection (via useEffect ci-dessus) est en cours, afficher un loader.
  if (isAuthLoading || (!isAuthLoading && session)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/40">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  // Si chargement terminé et pas de session, afficher le formulaire de connexion.
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">Connexion à ThesisFlow360</CardTitle>
          <CardDescription>Accédez à votre espace de travail.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="nom@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isSubmitting}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting || isAuthLoading}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? 'Connexion en cours...' : 'Se Connecter'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

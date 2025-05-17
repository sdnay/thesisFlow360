
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
  console.log("[LoginPage] Component RENDERED");

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signInWithPassword, session, isLoading: isAuthContextLoading, initialAuthCheckCompleted } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    // Rediriger si l'utilisateur est déjà connecté ET que la vérification initiale de la session est terminée
    if (initialAuthCheckCompleted && session) {
      const redirectTo = searchParams.get('redirectTo') || '/';
      console.log(`[LoginPage] Session active et vérification initiale terminée. Redirection vers: ${redirectTo}`);
      router.replace(redirectTo);
    }
  }, [session, initialAuthCheckCompleted, router, searchParams]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    console.log(`[LoginPage] Tentative de connexion avec l'email: ${email}`);

    const { error } = await signInWithPassword({ email, password });

    if (error) {
      console.error("[LoginPage] Erreur de connexion Supabase:", error);
      toast({
        title: "Erreur de connexion",
        description: error.message || "Une erreur est survenue. Veuillez réessayer.",
        variant: "destructive",
      });
    } else {
      // La redirection est maintenant gérée par le listener onAuthStateChange dans AuthContext
      // et par le useEffect de cette page si la session devient active.
      console.log("[LoginPage] Appel à signInWithPassword terminé. La redirection sera gérée par AuthContext ou useEffect.");
      toast({
        title: "Connexion en cours...",
        description: "Vous allez être redirigé.",
      });
    }
    setIsSubmitting(false);
  };

  // Si AuthContext est encore en train de vérifier la session initiale
  if (isAuthContextLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/40">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement de la session...</p>
      </div>
    );
  }

  // Si la vérification initiale est terminée et qu'il y a une session,
  // le useEffect ci-dessus devrait rediriger. On affiche un loader pendant la redirection.
  if (initialAuthCheckCompleted && session) {
     return (
       <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/40">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Redirection en cours...</p>
      </div>
    );
  }

  // Sinon (vérification terminée, pas de session), afficher le formulaire
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
            <Button type="submit" className="w-full" disabled={isSubmitting}>
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

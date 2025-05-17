
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
  console.log("[LoginPage] Component RENDERED"); // Log de débogage

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signInWithPassword, session } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    if (session) {
      const redirectTo = searchParams.get('redirectTo') || '/';
      router.replace(redirectTo);
    }
  }, [session, router, searchParams]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    console.log(`[LoginPage] Tentative de connexion avec l'email: ${email}`);

    const { error, session: newSession } = await signInWithPassword(email, password);

    if (error) {
      console.error("[LoginPage] Erreur de connexion Supabase:", error);
      toast({
        title: "Erreur de connexion",
        description: error.message || "Une erreur est survenue. Veuillez réessayer.",
        variant: "destructive",
      });
    } else if (newSession) {
      console.log("[LoginPage] Connexion réussie, session:", newSession);
      toast({
        title: "Connexion réussie",
        description: "Vous allez être redirigé.",
      });
      // La redirection est gérée par le useEffect ci-dessus
      // ou par le middleware si la session est détectée.
      // Forcer une redirection ici peut être redondant mais sûr :
      const redirectTo = searchParams.get('redirectTo') || '/';
      router.replace(redirectTo);
    } else {
      // Cas improbable où il n'y a ni session ni erreur
      console.error("[LoginPage] Problème inattendu: pas de session ni d'erreur après la tentative de connexion.");
      toast({
        title: "Erreur inattendue",
        description: "Un problème est survenu. Veuillez réessayer.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  if (session) {
    // Affiche un état de chargement pendant la redirection si la session est déjà active
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Redirection en cours...</p>
      </div>
    );
  }

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
                disabled={isLoading}
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
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              {isLoading ? 'Connexion en cours...' : 'Se Connecter'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

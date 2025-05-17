
"use client";

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn } from 'lucide-react';
import { Logo } from '@/components/icons/logo'; // Assurez-vous que ce chemin est correct

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Erreur de connexion",
          description: error.message || "Vérifiez vos identifiants.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Connexion réussie",
          description: "Redirection vers votre tableau de bord...",
        });
        // onAuthStateChange dans AuthContext gérera la redirection
        // ou vous pouvez forcer une redirection ici si nécessaire.
        // Par exemple, si la page précédente était stockée :
        const redirectTo = searchParams.get('redirectTo') || '/';
        router.push(redirectTo);
      }
    } catch (error: any) {
      toast({
        title: "Erreur inattendue",
        description: error.message || "Une erreur s'est produite.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-sm shadow-xl">
      <CardHeader className="items-center text-center">
        <Logo className="h-12 w-auto mb-4" />
        <CardTitle className="text-2xl">Connexion</CardTitle>
        <CardDescription>Accédez à votre espace ThesisFlow360.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="nom@example.com"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="********"
              disabled={isLoading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="mr-2 h-4 w-4" />
            )}
            Se Connecter
          </Button>
        </form>
      </CardContent>
       <CardFooter className="flex flex-col items-center text-xs text-muted-foreground pt-4">
        {/* Optionnel: Lien vers l'inscription si vous l'activez */}
        {/* <p>Pas encore de compte ? <Link href="/auth/signup" className="text-primary hover:underline">S'inscrire</Link></p> */}
      </CardFooter>
    </Card>
  );
}

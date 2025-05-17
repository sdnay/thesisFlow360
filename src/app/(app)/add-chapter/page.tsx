// src/app/(app)/add-chapter/page.tsx
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2 } from 'lucide-react';
import type { Chapter } from '@/types';

export default function AddChapterPage() {
  const [chapterName, setChapterName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleAddChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterName.trim()) {
      toast({
        title: "Erreur de validation",
        description: "Le nom du chapitre est requis.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const newChapterPayload: Omit<Chapter, 'id' | 'created_at' | 'supervisor_comments'> & { supervisor_comments?: string[] } = {
        name: chapterName.trim(),
        progress: 0,
        status: 'Non commencé',
        supervisor_comments: [], // Initialiser avec un tableau vide
      };

      const { error } = await supabase.from('chapters').insert(newChapterPayload);

      if (error) throw error;

      toast({
        title: "Chapitre ajouté",
        description: `Le chapitre "${chapterName.trim()}" a été ajouté avec succès.`,
      });
      setChapterName('');
      router.push('/#dashboard'); // Rediriger vers le tableau de bord après l'ajout
    } catch (e: any) {
      console.error("Erreur lors de l'ajout du chapitre:", e);
      toast({
        title: "Erreur d'enregistrement",
        description: e.message || "Impossible d'ajouter le chapitre.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col items-center justify-center">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Ajouter un Nouveau Chapitre</CardTitle>
          <CardDescription>
            Entrez le nom de votre nouveau chapitre. La progression sera initialisée à 0% et le statut à "Non commencé".
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleAddChapter}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="chapterName" className="mb-1.5 block">Nom du Chapitre</Label>
              <Input
                id="chapterName"
                value={chapterName}
                onChange={(e) => setChapterName(e.target.value)}
                placeholder="ex : Introduction, Revue de Littérature, etc."
                disabled={isLoading}
                className="text-base"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading || !chapterName.trim()} className="w-full">
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlusCircle className="mr-2 h-4 w-4" />
              )}
              {isLoading ? 'Ajout en cours...' : 'Ajouter le Chapitre'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

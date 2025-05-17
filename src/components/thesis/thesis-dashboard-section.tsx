
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// import { Textarea } from '@/components/ui/textarea'; // Pas utilisé pour les commentaires ici
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import type { Chapter } from '@/types';
import { PlusCircle, Edit3, Trash2, MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

interface ChapterProgressCardProps {
  chapter: Chapter;
  onEdit: (chapter: Chapter) => void;
  onDelete: (chapterId: string) => void;
  onAddComment: (chapterId: string, comment: string) => Promise<void>;
}

const ChapterProgressCard: FC<ChapterProgressCardProps> = ({ chapter, onEdit, onDelete, onAddComment }) => {
  const [comment, setComment] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [isAddingComment, setIsAddingComment] = useState(false);

  const handleAddCommentInternal = async () => {
    if (comment.trim()) {
      setIsAddingComment(true);
      await onAddComment(chapter.id, comment.trim());
      setComment('');
      setShowCommentInput(false);
      setIsAddingComment(false);
    }
  };

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-200">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{chapter.name}</CardTitle>
            <CardDescription>{chapter.status}</CardDescription>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => onEdit(chapter)} aria-label="Modifier le chapitre">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(chapter.id)} aria-label="Supprimer le chapitre" className="text-destructive hover:text-destructive/80">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-2 text-sm font-medium">Progression : {chapter.progress}%</div>
        <Progress value={chapter.progress} className="w-full h-3" />
        {chapter.supervisor_comments && chapter.supervisor_comments.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Commentaires du superviseur :</h4>
            <ul className="list-disc list-inside text-xs space-y-1">
              {chapter.supervisor_comments.map((comment, index) => (
                <li key={index}>{comment}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-2">
        {showCommentInput ? (
          <div className="w-full flex gap-2 items-center">
            <Input 
              value={comment} 
              onChange={(e) => setComment(e.target.value)} 
              placeholder="Nouveau commentaire..."
              className="flex-grow"
              disabled={isAddingComment}
            />
            <Button onClick={handleAddCommentInternal} size="sm" disabled={isAddingComment || !comment.trim()}>
              {isAddingComment ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
              Ajouter
            </Button>
            <Button onClick={() => setShowCommentInput(false)} size="sm" variant="outline" disabled={isAddingComment}>Annuler</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowCommentInput(true)}>
            <MessageSquare className="mr-2 h-4 w-4" /> Ajouter un commentaire
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};


export function ThesisDashboardSection() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentChapter, setCurrentChapter] = useState<Partial<Chapter> | null>(null);
  const [isLoading, setIsLoading] = useState(false); // For modal operations
  const [isFetching, setIsFetching] = useState(true);
  const { toast } = useToast();

  const fetchChapters = useCallback(async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase.from('chapters').select('*').order('name');
      if (error) throw error;
      setChapters(data || []);
    } catch (e: any) {
      toast({ title: "Erreur", description: "Impossible de charger les chapitres.", variant: "destructive" });
      console.error("Erreur fetchChapters:", e);
    } finally {
      setIsFetching(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchChapters();
  }, [fetchChapters]);

  const openModalForNew = () => {
    setCurrentChapter({ name: '', progress: 0, status: 'Non commencé', supervisor_comments: [] });
    setIsModalOpen(true);
  };

  const openModalForEdit = (chapter: Chapter) => {
    setCurrentChapter(JSON.parse(JSON.stringify(chapter))); // Deep copy pour éviter modif directe
    setIsModalOpen(true);
  };

  const handleSaveChapter = async () => {
    if (!currentChapter || !currentChapter.name) {
        toast({title: "Erreur de validation", description: "Le nom du chapitre est requis.", variant: "destructive"});
        return;
    }
    setIsLoading(true);
    try {
      if (currentChapter.id) { 
        const { id, ...chapterToUpdate } = currentChapter;
        const { error } = await supabase.from('chapters').update(chapterToUpdate).eq('id', id);
        if (error) throw error;
        toast({ title: "Chapitre modifié", description: `"${currentChapter.name}" a été mis à jour.` });
      } else { 
        const { error } = await supabase.from('chapters').insert([currentChapter as Omit<Chapter, 'id'>]);
        if (error) throw error;
        toast({ title: "Chapitre ajouté", description: `"${currentChapter.name}" a été ajouté.` });
      }
      setIsModalOpen(false);
      setCurrentChapter(null);
      await fetchChapters();
    } catch (e: any) {
      toast({ title: "Erreur d'enregistrement", description: e.message, variant: "destructive" });
      console.error("Erreur handleSaveChapter:", e);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteChapter = async (chapterId: string) => {
    try {
      const { error } = await supabase.from('chapters').delete().eq('id', chapterId);
      if (error) throw error;
      toast({ title: "Chapitre supprimé" });
      await fetchChapters();
    } catch (e: any) {
      toast({ title: "Erreur de suppression", description: e.message, variant: "destructive" });
      console.error("Erreur handleDeleteChapter:", e);
    }
  };

  const handleAddCommentToChapter = async (chapterId: string, comment: string) => {
    try {
      const chapterToUpdate = chapters.find(ch => ch.id === chapterId);
      if (!chapterToUpdate) throw new Error("Chapitre non trouvé");

      const updatedComments = [...(chapterToUpdate.supervisor_comments || []), comment];
      const { error } = await supabase
        .from('chapters')
        .update({ supervisor_comments: updatedComments })
        .eq('id', chapterId);
      if (error) throw error;
      toast({ title: "Commentaire ajouté" });
      await fetchChapters(); // Re-fetch to update UI, or update local state optimistically
    } catch (e: any) {
      toast({ title: "Erreur d'ajout de commentaire", description: e.message, variant: "destructive" });
      console.error("Erreur handleAddCommentToChapter:", e);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Tableau de Bord de la Thèse</h2>
        <Button onClick={openModalForNew} disabled={isFetching}>
          <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un Chapitre
        </Button>
      </div>

      {isFetching ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : chapters.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">Aucun chapitre ajouté pour le moment. Commencez par ajouter votre premier chapitre !</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {chapters.map((chapter) => (
            <ChapterProgressCard 
              key={chapter.id} 
              chapter={chapter} 
              onEdit={openModalForEdit}
              onDelete={handleDeleteChapter}
              onAddComment={handleAddCommentToChapter}
            />
          ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={(open) => {if (!isLoading) setIsModalOpen(open)}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentChapter?.id ? 'Modifier le Chapitre' : 'Ajouter un Nouveau Chapitre'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="chapterName" className="block text-sm font-medium mb-1">Nom du Chapitre</label>
              <Input
                id="chapterName"
                value={currentChapter?.name || ''}
                onChange={(e) => setCurrentChapter(prev => ({ ...prev, name: e.target.value }))}
                placeholder="ex : Introduction"
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="chapterProgress" className="block text-sm font-medium mb-1">Progression (%)</label>
              <Input
                id="chapterProgress"
                type="number"
                min="0"
                max="100"
                value={currentChapter?.progress || 0}
                onChange={(e) => setCurrentChapter(prev => ({ ...prev, progress: parseInt(e.target.value, 10) || 0 }))}
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="chapterStatus" className="block text-sm font-medium mb-1">Statut</label>
              <Input
                id="chapterStatus"
                value={currentChapter?.status || ''}
                onChange={(e) => setCurrentChapter(prev => ({ ...prev, status: e.target.value }))}
                placeholder="ex : En cours"
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {if(!isLoading) setIsModalOpen(false)}} disabled={isLoading}>Annuler</Button>
            <Button onClick={handleSaveChapter} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enregistrer le Chapitre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// src/app/(app)/add-chapter/page.tsx
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit3, Trash2, MessageSquare, Loader2, ListTree } from 'lucide-react';
import type { Chapter } from '@/types';

interface ChapterCardProps {
  chapter: Chapter;
  onEdit: (chapter: Chapter) => void;
  onDelete: (chapterId: string) => void;
  onAddComment: (chapterId: string, comment: string) => Promise<void>;
  isLoadingActions: boolean;
}

const ChapterCard: FC<ChapterCardProps> = ({ chapter, onEdit, onDelete, onAddComment, isLoadingActions }) => {
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
            <Button variant="ghost" size="icon" onClick={() => onEdit(chapter)} aria-label="Modifier le chapitre" disabled={isLoadingActions}>
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(chapter.id)} aria-label="Supprimer le chapitre" className="text-destructive hover:text-destructive/80" disabled={isLoadingActions}>
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
            <ul className="list-disc list-inside text-xs space-y-1 max-h-20 overflow-y-auto">
              {chapter.supervisor_comments.map((c, index) => (
                <li key={index}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-2 pt-4">
        {showCommentInput ? (
          <div className="w-full flex gap-2 items-center">
            <Input 
              value={comment} 
              onChange={(e) => setComment(e.target.value)} 
              placeholder="Nouveau commentaire..."
              className="flex-grow text-sm"
              disabled={isAddingComment || isLoadingActions}
            />
            <Button onClick={handleAddCommentInternal} size="sm" disabled={isAddingComment || !comment.trim() || isLoadingActions}>
              {isAddingComment ? <Loader2 className="mr-2 h-3 w-3 animate-spin"/> : null}
              Ajouter
            </Button>
            <Button onClick={() => setShowCommentInput(false)} size="sm" variant="outline" disabled={isAddingComment || isLoadingActions}>Annuler</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowCommentInput(true)} disabled={isLoadingActions}>
            <MessageSquare className="mr-2 h-3 w-3" /> Ajouter un commentaire
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default function ManageThesisPlanPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentChapter, setCurrentChapter] = useState<Partial<Chapter> | null>(null); // For add/edit form
  const [isFormLoading, setIsFormLoading] = useState(false); // For modal/form operations
  const [isFetchingChapters, setIsFetchingChapters] = useState(true);
  const [isLoadingChapterActions, setIsLoadingChapterActions] = useState(false); // For card actions (delete, add comment)

  const { toast } = useToast();
  const router = useRouter();

  const fetchChapters = useCallback(async () => {
    setIsFetchingChapters(true);
    try {
      const { data, error } = await supabase.from('chapters').select('*').order('created_at', { ascending: true }); // Or order by name
      if (error) throw error;
      setChapters(data || []);
    } catch (e: any) {
      toast({ title: "Erreur", description: "Impossible de charger les chapitres.", variant: "destructive" });
      console.error("Erreur fetchChapters:", e);
    } finally {
      setIsFetchingChapters(false);
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
    setCurrentChapter(JSON.parse(JSON.stringify(chapter))); 
    setIsModalOpen(true);
  };

  const handleSaveChapter = async () => {
    if (!currentChapter || !currentChapter.name?.trim()) {
        toast({title: "Erreur de validation", description: "Le nom du chapitre est requis.", variant: "destructive"});
        return;
    }
    setIsFormLoading(true);
    try {
      const chapterPayload = {
        name: currentChapter.name.trim(),
        progress: currentChapter.progress || 0,
        status: currentChapter.status?.trim() || 'Non commencé',
        supervisor_comments: currentChapter.supervisor_comments || [],
      };

      if (currentChapter.id) { 
        const { error } = await supabase.from('chapters').update(chapterPayload).eq('id', currentChapter.id);
        if (error) throw error;
        toast({ title: "Chapitre modifié", description: `"${chapterPayload.name}" a été mis à jour.` });
      } else { 
        const { error } = await supabase.from('chapters').insert([chapterPayload]);
        if (error) throw error;
        toast({ title: "Chapitre ajouté", description: `"${chapterPayload.name}" a été ajouté.` });
      }
      setIsModalOpen(false);
      setCurrentChapter(null);
      await fetchChapters();
    } catch (e: any)
{
      toast({ title: "Erreur d'enregistrement", description: e.message || "Impossible d'enregistrer le chapitre.", variant: "destructive" });
      console.error("Erreur handleSaveChapter:", e);
    } finally {
      setIsFormLoading(false);
    }
  };
  
  const handleDeleteChapter = async (chapterId: string) => {
    setIsLoadingChapterActions(true);
    try {
      const { error } = await supabase.from('chapters').delete().eq('id', chapterId);
      if (error) throw error;
      toast({ title: "Chapitre supprimé" });
      await fetchChapters();
    } catch (e: any) {
      toast({ title: "Erreur de suppression", description: e.message, variant: "destructive" });
      console.error("Erreur handleDeleteChapter:", e);
    } finally {
      setIsLoadingChapterActions(false);
    }
  };

  const handleAddCommentToChapter = async (chapterId: string, comment: string) => {
    setIsLoadingChapterActions(true);
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
      await fetchChapters(); 
    } catch (e: any) {
      toast({ title: "Erreur d'ajout de commentaire", description: e.message, variant: "destructive" });
      console.error("Erreur handleAddCommentToChapter:", e);
    } finally {
      setIsLoadingChapterActions(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center">
          <ListTree className="mr-3 h-7 w-7 text-primary" />
          Gestion du Plan de Thèse
        </h1>
        <Button onClick={openModalForNew} disabled={isFetchingChapters || isFormLoading}>
          <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un Chapitre
        </Button>
      </div>

      {isFetchingChapters ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : chapters.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Commencez votre plan !</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Aucun chapitre défini pour le moment. Ajoutez votre premier chapitre pour structurer votre thèse.</p>
            <Button onClick={openModalForNew} className="mt-4" disabled={isFormLoading}>
              <PlusCircle className="mr-2 h-4 w-4" /> Créer le premier chapitre
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {chapters.map((chapter) => (
            <ChapterCard 
              key={chapter.id} 
              chapter={chapter} 
              onEdit={openModalForEdit}
              onDelete={handleDeleteChapter}
              onAddComment={handleAddCommentToChapter}
              isLoadingActions={isLoadingChapterActions}
            />
          ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={(open) => {if (!isFormLoading) setIsModalOpen(open)}}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{currentChapter?.id ? 'Modifier le Chapitre' : 'Ajouter un Nouveau Chapitre'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="chapterName" className="mb-1.5 block">Nom du Chapitre</Label>
              <Input
                id="chapterName"
                value={currentChapter?.name || ''}
                onChange={(e) => setCurrentChapter(prev => ({ ...prev, name: e.target.value }))}
                placeholder="ex : Introduction, Revue de Littérature..."
                disabled={isFormLoading}
                className="text-base"
              />
            </div>
            <div>
              <Label htmlFor="chapterProgress" className="mb-1.5 block">Progression (%)</Label>
              <Input
                id="chapterProgress"
                type="number"
                min="0"
                max="100"
                value={currentChapter?.progress || 0}
                onChange={(e) => setCurrentChapter(prev => ({ ...prev, progress: parseInt(e.target.value, 10) || 0 }))}
                disabled={isFormLoading}
                className="text-base"
              />
            </div>
            <div>
              <Label htmlFor="chapterStatus" className="mb-1.5 block">Statut</Label>
              <Input
                id="chapterStatus"
                value={currentChapter?.status || ''}
                onChange={(e) => setCurrentChapter(prev => ({ ...prev, status: e.target.value }))}
                placeholder="ex : Non commencé, En cours, Terminé"
                disabled={isFormLoading}
                className="text-base"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {if(!isFormLoading) setIsModalOpen(false)}} disabled={isFormLoading}>Annuler</Button>
            <Button onClick={handleSaveChapter} disabled={isFormLoading}>
              {isFormLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isFormLoading ? 'Enregistrement...' : (currentChapter?.id ? 'Mettre à Jour' : 'Ajouter le Chapitre')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

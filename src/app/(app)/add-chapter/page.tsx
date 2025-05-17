
// src/app/(app)/add-chapter/page.tsx
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit3, Trash2, MessageSquare, Loader2, ListTree, Save, ExternalLink, Eye } from 'lucide-react';
import type { Chapter } from '@/types';
import { Textarea } from '@/components/ui/textarea';

interface ChapterCardProps {
  chapter: Chapter;
  onEdit: (chapter: Chapter) => void;
  onDelete: (chapterId: string) => void;
  onAddCommentRequest: (chapterId: string) => void; // Renamed
  isLoadingActions: boolean;
}

const ChapterCardItem: FC<ChapterCardProps> = ({ chapter, onEdit, onDelete, onAddCommentRequest, isLoadingActions }) => { // Renamed component
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-grow">
            <CardTitle className="text-base md:text-lg">{chapter.name}</CardTitle>
            <CardDescription className="text-xs md:text-sm">{chapter.status}</CardDescription>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="outline" size="icon" onClick={() => onEdit(chapter)} aria-label="Modifier le chapitre" disabled={isLoadingActions} className="h-8 w-8">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="destructiveOutline" size="icon" onClick={() => onDelete(chapter.id)} aria-label="Supprimer le chapitre" disabled={isLoadingActions} className="h-8 w-8">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="mb-1 text-xs md:text-sm font-medium">Progression : {chapter.progress}%</div>
        <Progress value={chapter.progress} className="w-full h-2.5 md:h-3" />
        {chapter.supervisor_comments && chapter.supervisor_comments.length > 0 && (
          <div className="mt-3">
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Commentaires :</h4>
            <ul className="list-disc list-inside text-xs space-y-0.5 max-h-20 overflow-y-auto custom-scrollbar pr-1">
              {chapter.supervisor_comments.map((c, index) => (
                <li key={index} className="truncate" title={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-3 border-t">
        <Button variant="ghost" size="sm" onClick={() => onAddCommentRequest(chapter.id)} disabled={isLoadingActions} className="w-full text-xs text-muted-foreground hover:text-primary">
          <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Ajouter/Voir Commentaires
        </Button>
      </CardFooter>
    </Card>
  );
};

export default function ManageThesisPlanPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  
  const [currentChapter, setCurrentChapter] = useState<Partial<Chapter> | null>(null);
  const [chapterForComment, setChapterForComment] = useState<Chapter | null>(null);
  const [newCommentText, setNewCommentText] = useState('');

  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isFetchingChapters, setIsFetchingChapters] = useState(true);
  const [isLoadingChapterActions, setIsLoadingChapterActions] = useState(false);

  const { toast } = useToast();

  const fetchChapters = useCallback(async () => {
    setIsFetchingChapters(true);
    try {
      const { data, error } = await supabase.from('chapters').select('*').order('name', { ascending: true });
      if (error) throw error;
      setChapters(data || []);
    } catch (e: any) {
      let detailedMessage = "Une erreur inconnue est survenue lors du chargement des chapitres.";
      if (e && typeof e === 'object') {
        if ('message' in e && typeof e.message === 'string') detailedMessage = e.message;
        const supabaseErrorDetails = e.details ? `Détails: ${e.details}` : '';
        const supabaseErrorCode = e.code ? `Code: ${e.code}` : '';
        console.error(`Erreur fetchChapters: ${detailedMessage}`, supabaseErrorDetails, supabaseErrorCode, "Objet d'erreur complet:", e);
      } else {
        console.error("Erreur fetchChapters non-objet:", e);
      }
      toast({ title: "Erreur de chargement", description: "Impossible de charger la liste des chapitres.", variant: "destructive" });
    } finally {
      setIsFetchingChapters(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchChapters();
    const channel = supabase
      .channel('db-chapters-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chapters' }, fetchChapters)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchChapters]);

  const openModalForNew = () => {
    setCurrentChapter({ name: '', progress: 0, status: 'Non commencé', supervisor_comments: [] });
    setIsEditModalOpen(true);
  };

  const openModalForEdit = (chapter: Chapter) => {
    setCurrentChapter(JSON.parse(JSON.stringify(chapter)));
    setIsEditModalOpen(true);
  };

  const openCommentModal = (chapterId: string) => {
    const chapter = chapters.find(c => c.id === chapterId);
    if (chapter) {
      setChapterForComment(chapter);
      setIsCommentModalOpen(true);
    }
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
        supervisor_comments: currentChapter.supervisor_comments || [], // Keep existing comments if editing
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
      setIsEditModalOpen(false);
      setCurrentChapter(null);
      // fetchChapters(); // Realtime listener will handle update
    } catch (e: any) {
      toast({ title: "Erreur d'enregistrement", description: (e as Error).message || "Impossible d'enregistrer le chapitre.", variant: "destructive" });
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
      // fetchChapters(); // Realtime listener
    } catch (e: any) {
      toast({ title: "Erreur de suppression", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleDeleteChapter:", e);
    } finally {
      setIsLoadingChapterActions(false);
    }
  };

  const handleSaveComment = async () => {
    if (!chapterForComment || !newCommentText.trim()) return;
    setIsLoadingChapterActions(true);
    try {
      const updatedComments = [...(chapterForComment.supervisor_comments || []), newCommentText.trim()];
      const { error } = await supabase
        .from('chapters')
        .update({ supervisor_comments: updatedComments })
        .eq('id', chapterForComment.id);
      if (error) throw error;
      toast({ title: "Commentaire ajouté" });
      setNewCommentText('');
      // fetchChapters(); // Realtime listener
      // Optimistically update local state for immediate feedback if needed, or rely on realtime
      const updatedChapter = { ...chapterForComment, supervisor_comments: updatedComments };
      setChapterForComment(updatedChapter); 
      setChapters(prev => prev.map(ch => ch.id === updatedChapter.id ? updatedChapter : ch));


    } catch (e: any) {
      toast({ title: "Erreur d'ajout de commentaire", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleSaveComment:", e);
    } finally {
      setIsLoadingChapterActions(false);
    }
  };
  
  const handleDeleteComment = async (chapterId: string, commentIndex: number) => {
      const chapterToUpdate = chapters.find(ch => ch.id === chapterId);
      if (!chapterToUpdate || !chapterToUpdate.supervisor_comments) return;

      setIsLoadingChapterActions(true);
      try {
          const updatedComments = chapterToUpdate.supervisor_comments.filter((_, index) => index !== commentIndex);
          const { error } = await supabase
              .from('chapters')
              .update({ supervisor_comments: updatedComments })
              .eq('id', chapterId);
          if (error) throw error;
          toast({ title: "Commentaire supprimé" });
          // fetchChapters(); // Realtime
           const updatedChapter = { ...chapterToUpdate, supervisor_comments: updatedComments };
           setChapterForComment(updatedChapter);
           setChapters(prev => prev.map(ch => ch.id === updatedChapter.id ? updatedChapter : ch));
      } catch (e:any) {
          toast({ title: "Erreur de suppression du commentaire", description: e.message, variant: "destructive" });
      } finally {
          setIsLoadingChapterActions(false);
      }
  };


  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <ListTree className="h-7 w-7 text-primary" />
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
            Gestion du Plan de Thèse
          </h1>
        </div>
        <Button onClick={openModalForNew} disabled={isFetchingChapters || isFormLoading}>
          <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un Chapitre
        </Button>
      </div>

      {isFetchingChapters ? (
        <div className="flex-grow flex justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : chapters.length === 0 ? (
        <Card className="flex-grow flex flex-col items-center justify-center text-center p-6">
          <CardHeader>
            <CardTitle>Commencez votre plan !</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Aucun chapitre défini pour le moment. Ajoutez votre premier chapitre pour structurer votre thèse.</p>
            <Button onClick={openModalForNew} disabled={isFormLoading}>
              <PlusCircle className="mr-2 h-4 w-4" /> Créer le premier chapitre
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex-grow grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start overflow-y-auto custom-scrollbar pr-1 pb-4">
          {chapters.map((chapter) => (
            <ChapterCardItem
              key={chapter.id}
              chapter={chapter}
              onEdit={openModalForEdit}
              onDelete={handleDeleteChapter}
              onAddCommentRequest={openCommentModal}
              isLoadingActions={isLoadingChapterActions}
            />
          ))}
        </div>
      )}

      {/* Edit/Add Chapter Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={(open) => {if (!isFormLoading) setIsEditModalOpen(open)}}>
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
              />
            </div>
            <div>
              <Label htmlFor="chapterProgress" className="mb-1.5 block">Progression (%)</Label>
              <Input
                id="chapterProgress"
                type="number"
                min="0"
                max="100"
                value={currentChapter?.progress === undefined ? '' : currentChapter.progress}
                onChange={(e) => setCurrentChapter(prev => ({ ...prev, progress: e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0 }))}
                disabled={isFormLoading}
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
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {if(!isFormLoading) setIsEditModalOpen(false)}} disabled={isFormLoading}>Annuler</Button>
            <Button onClick={handleSaveChapter} disabled={isFormLoading || !currentChapter?.name?.trim()}>
              {isFormLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isFormLoading ? 'Enregistrement...' : (currentChapter?.id ? 'Mettre à Jour' : 'Ajouter')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comments Modal */}
      <Dialog open={isCommentModalOpen} onOpenChange={setIsCommentModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Commentaires pour "{chapterForComment?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
            {chapterForComment?.supervisor_comments && chapterForComment.supervisor_comments.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {chapterForComment.supervisor_comments.map((comment, index) => (
                  <li key={index} className="p-2 border rounded-md bg-muted/50 flex justify-between items-start">
                    <span className="whitespace-pre-wrap flex-grow">{comment}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 ml-2" onClick={() => handleDeleteComment(chapterForComment.id, index)} disabled={isLoadingChapterActions}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive/70 hover:text-destructive"/>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun commentaire pour ce chapitre.</p>
            )}
            <div className="pt-4 border-t">
              <Label htmlFor="newComment" className="block mb-1.5">Ajouter un commentaire</Label>
              <Textarea 
                id="newComment"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Écrivez votre commentaire ici..."
                rows={3}
                disabled={isLoadingChapterActions}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button variant="outline" disabled={isLoadingChapterActions}>Fermer</Button>
            </DialogClose>
            <Button onClick={handleSaveComment} disabled={isLoadingChapterActions || !newCommentText.trim()}>
              {isLoadingChapterActions ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
              Enregistrer le commentaire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

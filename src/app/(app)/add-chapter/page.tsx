
// src/app/(app)/add-chapter/page.tsx
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, Loader2, ListTree, Save, FolderOpen, MessageSquare, MoreVertical, Edit } from 'lucide-react';
import type { Chapter } from '@/types';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


interface ChapterCardItemProps {
  chapter: Chapter;
  onEditRequest: (chapter: Chapter) => void;
  onDeleteRequest: (chapterId: string) => void;
  onCommentManagerRequest: (chapter: Chapter) => void;
  isLoadingActionsForId: string | null;
}

const ChapterCardItem: FC<ChapterCardItemProps> = ({
  chapter,
  onEditRequest,
  onDeleteRequest,
  onCommentManagerRequest,
  isLoadingActionsForId,
}) => {
  const lastComment = chapter.supervisor_comments && chapter.supervisor_comments.length > 0
    ? chapter.supervisor_comments[chapter.supervisor_comments.length - 1]
    : null;

  const isLoading = isLoadingActionsForId === chapter.id;

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col h-full bg-card">
      <CardHeader className="pb-3 pt-4">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-grow min-w-0">
            <CardTitle className="text-base md:text-lg leading-tight truncate" title={chapter.name}>
              {chapter.name}
            </CardTitle>
            <CardDescription className="text-xs md:text-sm pt-0.5">{chapter.status}</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                <span className="sr-only">Options du chapitre</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditRequest(chapter)} disabled={isLoading}>
                <Edit className="mr-2 h-4 w-4" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDeleteRequest(chapter.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10" disabled={isLoading}>
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="flex-grow py-2 space-y-2">
        <div className="mb-1 text-xs md:text-sm font-medium">Progression : {chapter.progress}%</div>
        <Progress value={chapter.progress} className="w-full h-2.5 md:h-3" aria-label={`Progression ${chapter.progress}%`} />

        {chapter.supervisor_comments && chapter.supervisor_comments.length > 0 && (
          <div className="mt-3 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-semibold text-muted-foreground">Dernier Commentaire :</h4>
              <Badge variant="outline" className="text-xs">{chapter.supervisor_comments.length} commentaire(s)</Badge>
            </div>
            {lastComment && (
               <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger className="w-full text-left">
                    <p className="text-xs text-muted-foreground italic line-clamp-2">
                      {lastComment}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" className="max-w-xs whitespace-pre-wrap bg-popover text-popover-foreground p-2 rounded-md shadow-lg border">
                    <p>{lastComment}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-3 pb-4 border-t mt-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onCommentManagerRequest(chapter)}
          disabled={isLoading}
          className="w-full text-xs text-muted-foreground hover:text-primary hover:bg-primary/5"
        >
          <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
          Gérer les Commentaires ({chapter.supervisor_comments?.length || 0})
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

  const [isFormLoading, setIsFormLoading] = useState(false); // For modal save/update
  const [isFetchingChapters, setIsFetchingChapters] = useState(true);
  const [isLoadingChapterActionsForId, setIsLoadingChapterActionsForId] = useState<string | null>(null); // Stores ID of chapter being acted upon on the card

  const { toast } = useToast();

  const fetchChapters = useCallback(async () => {
    setIsFetchingChapters(true);
    try {
      const { data, error } = await supabase.from('chapters').select('*').order('name', { ascending: true });
      if (error) throw error;
      setChapters(data || []);
    } catch (e: any) {
      let detailedMessage = "Une erreur inconnue est survenue lors du chargement des chapitres.";
      if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') {
        detailedMessage = e.message;
      }
      console.error(`Erreur fetchChapters: ${detailedMessage}`, "Objet d'erreur complet:", e);
      toast({ title: "Erreur de chargement", description: `Impossible de charger la liste des chapitres. ${detailedMessage}`, variant: "destructive" });
    } finally {
      setIsFetchingChapters(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchChapters();
    const channel = supabase
      .channel('db-chapters-manage-plan-page')
      .on<Chapter>('postgres_changes', { event: '*', schema: 'public', table: 'chapters' }, (_payload) => {
        fetchChapters(); // Re-fetch all chapters on any change from other clients or direct DB changes
      })
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

  const openCommentManager = (chapter: Chapter) => {
    setChapterForComment(JSON.parse(JSON.stringify(chapter)));
    setNewCommentText('');
    setIsCommentModalOpen(true);
  };

  const handleSaveChapter = async () => {
    if (!currentChapter || !currentChapter.name?.trim()) {
      toast({ title: "Erreur de validation", description: "Le nom du chapitre est requis.", variant: "destructive" });
      return;
    }
    setIsFormLoading(true);
    try {
      const chapterPayload = {
        name: currentChapter.name.trim(),
        progress: currentChapter.progress === undefined ? 0 : Number(currentChapter.progress),
        status: currentChapter.status?.trim() || 'Non commencé',
        supervisor_comments: currentChapter.supervisor_comments || [],
      };

      if (currentChapter.id) { // UPDATE
        const { data: updatedChapterFromDb, error } = await supabase
          .from('chapters')
          .update(chapterPayload)
          .eq('id', currentChapter.id)
          .select()
          .single();
        if (error) throw error;
        if (updatedChapterFromDb) {
          setChapters(prevChapters =>
            prevChapters.map(ch => ch.id === updatedChapterFromDb.id ? updatedChapterFromDb : ch)
          );
        }
        toast({ title: "Chapitre modifié", description: `"${chapterPayload.name}" a été mis à jour.` });
      } else { // INSERT
        const { data: newChapterFromDb, error } = await supabase
          .from('chapters')
          .insert(chapterPayload) // Removed array for single insert
          .select()
          .single();
        if (error) throw error;
        if (newChapterFromDb) {
          // Realtime will handle the fetch, but for instant UI add, we can do this:
           setChapters(prevChapters => [...prevChapters, newChapterFromDb].sort((a, b) => a.name.localeCompare(b.name)));
        }
        toast({ title: "Chapitre ajouté", description: `"${chapterPayload.name}" a été ajouté.` });
      }
      setIsEditModalOpen(false);
      setCurrentChapter(null);
    } catch (e: any) {
      toast({ title: "Erreur d'enregistrement", description: (e as Error).message || "Impossible d'enregistrer le chapitre.", variant: "destructive" });
      console.error("Erreur handleSaveChapter:", e);
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    setIsLoadingChapterActionsForId(chapterId);
    try {
      const { error } = await supabase.from('chapters').delete().eq('id', chapterId);
      if (error) throw error;
      setChapters(prevChapters => prevChapters.filter(ch => ch.id !== chapterId));
      toast({ title: "Chapitre supprimé" });
    } catch (e: any) {
      toast({ title: "Erreur de suppression", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleDeleteChapter:", e);
    } finally {
      setIsLoadingChapterActionsForId(null);
    }
  };

  const handleSaveComment = async () => {
    if (!chapterForComment || !newCommentText.trim()) return;
    setIsLoadingChapterActionsForId(chapterForComment.id);
    try {
      const updatedComments = [...(chapterForComment.supervisor_comments || []), newCommentText.trim()];
      const { data: updatedChapterFromDb, error } = await supabase
        .from('chapters')
        .update({ supervisor_comments: updatedComments })
        .eq('id', chapterForComment.id)
        .select()
        .single();

      if (error) throw error;
      if (updatedChapterFromDb) {
        setChapters(prevChapters =>
          prevChapters.map(ch => ch.id === updatedChapterFromDb.id ? updatedChapterFromDb : ch)
        );
        setChapterForComment(updatedChapterFromDb); // Update the chapter in the modal
      }
      toast({ title: "Commentaire ajouté" });
      setNewCommentText('');
    } catch (e: any) {
      toast({ title: "Erreur d'ajout de commentaire", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleSaveComment:", e);
    } finally {
      setIsLoadingChapterActionsForId(null);
    }
  };

  const handleDeleteComment = async (commentIndex: number) => {
    if (!chapterForComment || !chapterForComment.supervisor_comments) return;
    setIsLoadingChapterActionsForId(chapterForComment.id);
    try {
      const updatedComments = chapterForComment.supervisor_comments.filter((_, index) => index !== commentIndex);
      const { data: updatedChapterFromDb, error } = await supabase
        .from('chapters')
        .update({ supervisor_comments: updatedComments })
        .eq('id', chapterForComment.id)
        .select()
        .single();
      if (error) throw error;

      if (updatedChapterFromDb) {
         setChapters(prevChapters =>
          prevChapters.map(ch => ch.id === updatedChapterFromDb.id ? updatedChapterFromDb : ch)
        );
        setChapterForComment(updatedChapterFromDb); // Update the chapter in the modal
      }
      toast({ title: "Commentaire supprimé" });
    } catch (e: any) {
      toast({ title: "Erreur de suppression du commentaire", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleDeleteComment:", e);
    } finally {
      setIsLoadingChapterActionsForId(null);
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
        <Card className="flex-grow flex flex-col items-center justify-center text-center p-6">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Chargement des chapitres...</p>
        </Card>
      ) : chapters.length === 0 ? (
        <Card className="flex-grow flex flex-col items-center justify-center text-center p-6 border-dashed bg-muted/20">
          <CardHeader className="items-center">
            <FolderOpen className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <CardTitle className="text-xl">Commencez à structurer votre thèse !</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto text-sm">
              Aucun chapitre n'a encore été défini. Ajoutez les sections principales de votre travail de recherche pour commencer à organiser vos idées et votre progression.
            </p>
            <Button onClick={openModalForNew} disabled={isFormLoading} size="lg">
              <PlusCircle className="mr-2 h-5 w-5" /> Créer le premier chapitre
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex-grow grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-start overflow-y-auto custom-scrollbar pr-1 pb-4">
          {chapters.map((chapter) => (
            <ChapterCardItem
              key={chapter.id}
              chapter={chapter}
              onEditRequest={openModalForEdit}
              onDeleteRequest={handleDeleteChapter}
              onCommentManagerRequest={openCommentManager}
              isLoadingActionsForId={isLoadingChapterActionsForId}
            />
          ))}
        </div>
      )}

      <Dialog open={isEditModalOpen} onOpenChange={(open) => { if (!isFormLoading) setIsEditModalOpen(open) }}>
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
                onChange={(e) => setCurrentChapter(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                placeholder="ex : Introduction, Revue de Littérature..."
                disabled={isFormLoading}
                className="text-sm"
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
                onChange={(e) => setCurrentChapter(prev => prev ? ({ ...prev, progress: e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0 }) : null)}
                disabled={isFormLoading}
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="chapterStatus" className="mb-1.5 block">Statut</Label>
              <Input
                id="chapterStatus"
                value={currentChapter?.status || ''}
                onChange={(e) => setCurrentChapter(prev => prev ? ({ ...prev, status: e.target.value }) : null)}
                placeholder="ex : Non commencé, En cours, Terminé"
                disabled={isFormLoading}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { if (!isFormLoading) setIsEditModalOpen(false) }} disabled={isFormLoading}>Annuler</Button>
            <Button onClick={handleSaveChapter} disabled={isFormLoading || !currentChapter?.name?.trim()}>
              {isFormLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isFormLoading ? 'Enregistrement...' : (currentChapter?.id ? 'Mettre à Jour' : 'Ajouter')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCommentModalOpen} onOpenChange={(open) => {if (isLoadingChapterActionsForId !== chapterForComment?.id) setIsCommentModalOpen(open)}}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Commentaires pour "{chapterForComment?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="max-h-[40vh] overflow-y-auto custom-scrollbar pr-2 space-y-2">
              {chapterForComment?.supervisor_comments && chapterForComment.supervisor_comments.length > 0 ? (
                chapterForComment.supervisor_comments.map((comment, index) => (
                  <div key={index} className="p-2.5 border rounded-md bg-muted/50 flex justify-between items-start gap-2 text-sm">
                    <p className="whitespace-pre-wrap flex-grow leading-relaxed">{comment}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleDeleteComment(index)}
                      disabled={isLoadingChapterActionsForId === chapterForComment?.id}
                      title="Supprimer ce commentaire"
                    >
                      {isLoadingChapterActionsForId === chapterForComment?.id && isLoadingChapterActionsForId === chapterForComment.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive/70 hover:text-destructive" />}
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun commentaire pour ce chapitre.</p>
              )}
            </div>
            <div className="pt-4 border-t">
              <Label htmlFor="newComment" className="block mb-1.5 text-sm font-medium">Ajouter un commentaire</Label>
              <Textarea
                id="newComment"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Écrivez votre commentaire ici..."
                rows={3}
                disabled={isLoadingChapterActionsForId === chapterForComment?.id}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isLoadingChapterActionsForId === chapterForComment?.id}>Fermer</Button>
            </DialogClose>
            <Button onClick={handleSaveComment} disabled={isLoadingChapterActionsForId === chapterForComment?.id || !newCommentText.trim()}>
              {isLoadingChapterActionsForId === chapterForComment?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

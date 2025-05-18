
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, Loader2, ListTree, Save, FolderOpen, MessageSquare, AlertTriangle } from 'lucide-react';
import type { Chapter, Task, DailyObjective, Tag } from '@/types';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';

// Import des composants extraits
import ChapterCardItem from './manage-plan-components/ChapterCardItem';
import LinkedItemsModal from './manage-plan-components/LinkedItemsModal';
import ManageTagsModal from './manage-plan-components/ManageTagsModal';

export default function ManageThesisPlan() {
  const { user } = useAuth();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]); // Tags globaux pour l'utilisateur

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [isLinkedItemsModalOpen, setIsLinkedItemsModalOpen] = useState(false);
  const [isManageTagsModalOpen, setIsManageTagsModalOpen] = useState(false);

  const [currentChapter, setCurrentChapter] = useState<Partial<Chapter> & { id?: string } | null>(null); // Pour l'édition/ajout
  const [chapterForComment, setChapterForComment] = useState<Chapter | null>(null);
  const [chapterForLinkedItems, setChapterForLinkedItems] = useState<Chapter | null>(null);
  const [chapterForTags, setChapterForTags] = useState<Chapter | null>(null);

  const [linkedTasks, setLinkedTasks] = useState<Task[]>([]);
  const [linkedObjectives, setLinkedObjectives] = useState<DailyObjective[]>([]);

  const [newCommentText, setNewCommentText] = useState('');
  const [isFormLoading, setIsFormLoading] = useState(false); // Pour la modale d'édition/ajout de chapitre
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [isLoadingChapterActionsForId, setIsLoadingChapterActionsForId] = useState<string | null>(null); // Pour actions sur une carte (delete, save comment, save tags)
  const [isLoadingLinkedItems, setIsLoadingLinkedItems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPageData = useCallback(async () => {
    if (!user) return;
    setIsFetchingData(true);
    setError(null);
    try {
      const [chaptersRes, tagsRes] = await Promise.all([
        supabase.from('chapters').select('*, chapter_tags(tags(*))').eq('user_id', user.id).order('name', { ascending: true }),
        supabase.from('tags').select('*').eq('user_id', user.id).order('name')
      ]);

      if (chaptersRes.error) throw chaptersRes.error;
      if (tagsRes.error) throw tagsRes.error;

      const processedChapters = (chaptersRes.data || []).map(ch => ({
        ...ch,
        user_id: user.id, // Assurer que user_id est présent
        tags: ch.chapter_tags?.map((ct: any) => ct.tags) || [],
      }));
      setChapters(processedChapters);
      setAvailableTags((tagsRes.data || []).map(t => ({ ...t, user_id: user.id })));

    } catch (e: any) {
      const errorMessage = (e as Error).message || "Erreur de chargement des données.";
      setError(errorMessage);
      toast({ title: "Erreur Chargement", description: errorMessage, variant: "destructive" });
      console.error("Erreur fetchPageData (ManageThesisPlan):", e);
    }
    finally { setIsFetchingData(false); }
  }, [toast, user]);

  useEffect(() => {
    if (user) {
      fetchPageData();
    } else {
      setChapters([]);
      setAvailableTags([]);
      setIsFetchingData(false);
    }
  }, [user, fetchPageData]);
  
  // Supabase Realtime Subscription
  useEffect(() => {
    if (!user) return;
  
    const chaptersChannel = supabase
      .channel(`db-chapters-plan-page-user-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chapters', filter: `user_id=eq.${user.id}` }, 
        (payload) => { console.log('Realtime: Chapters change detected', payload); fetchPageData(); }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chapter_tags' }, // Devrait être plus spécifique si possible
        (payload) => { console.log('Realtime: Chapter_tags change detected', payload); fetchPageData(); }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags', filter: `user_id=eq.${user.id}` }, 
        (payload) => { console.log('Realtime: Tags change detected', payload); fetchPageData(); }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Realtime: Subscribed to plan updates for user ${user.id}`);
        }
        if (err) {
          console.error(`Realtime: Subscription error for plan updates`, err);
        }
      });
  
    return () => {
      supabase.removeChannel(chaptersChannel);
    };
  }, [user, fetchPageData]);


  const fetchLinkedItems = useCallback(async (chapterId: string) => {
    if (!chapterId || !user) return;
    setIsLoadingLinkedItems(true);
    try {
      const [tasksRes, objectivesRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('chapter_id', chapterId).eq('user_id', user.id),
        supabase.from('daily_objectives').select('*').eq('chapter_id', chapterId).eq('user_id', user.id)
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (objectivesRes.error) throw objectivesRes.error;
      setLinkedTasks((tasksRes.data || []).map(t => ({ ...t, user_id: user.id })));
      setLinkedObjectives((objectivesRes.data || []).map(o => ({ ...o, user_id: user.id })));
    } catch (e: any) {
      toast({ title: "Erreur Éléments Liés", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsLoadingLinkedItems(false);
    }
  }, [toast, user]);

  const openModalForNew = () => { setCurrentChapter({ name: '', progress: 0, status: 'Non commencé', supervisor_comments: [], tags: [] }); setIsEditModalOpen(true); };
  const openModalForEdit = (chapter: Chapter) => { setCurrentChapter(JSON.parse(JSON.stringify(chapter))); setIsEditModalOpen(true); };
  const openCommentManager = (chapter: Chapter) => { setChapterForComment(JSON.parse(JSON.stringify(chapter))); setNewCommentText(''); setIsCommentModalOpen(true); };
  const openLinkedItemsManager = (chapter: Chapter) => { setChapterForLinkedItems(chapter); fetchLinkedItems(chapter.id); setIsLinkedItemsModalOpen(true); };
  const openManageTagsModal = (chapter: Chapter) => { setChapterForTags(chapter); setIsManageTagsModalOpen(true); };

  const handleSaveChapter = async () => {
    if (!currentChapter || !currentChapter.name?.trim() || !user) {
      toast({ title: "Validation", description: "Le nom du chapitre est requis.", variant: "destructive" });
      return;
    }
    setIsFormLoading(true);
    setError(null);
    try {
      const chapterPayload = {
        user_id: user.id,
        name: currentChapter.name.trim(),
        progress: currentChapter.progress === undefined ? 0 : Number(currentChapter.progress),
        status: currentChapter.status?.trim() || 'Non commencé',
        supervisor_comments: currentChapter.supervisor_comments || []
      };

      if (currentChapter.id) { // UPDATE
        const { data: updatedChapterFromDb, error } = await supabase
          .from('chapters').update(chapterPayload).eq('id', currentChapter.id).eq('user_id', user.id)
          .select('*, chapter_tags(tags(*))').single();
        if (error) throw error;
        if (updatedChapterFromDb) {
          const processedChapter = { ...updatedChapterFromDb, user_id: user.id, tags: updatedChapterFromDb.chapter_tags?.map((ct: any) => ct.tags) || [] };
          setChapters(prev => prev.map(ch => ch.id === processedChapter.id ? processedChapter : ch).sort((a, b) => a.name.localeCompare(b.name)));
        }
      } else { // INSERT
        const { data: newChapterFromDb, error } = await supabase
          .from('chapters').insert(chapterPayload).select('*, chapter_tags(tags(*))').single(); // Assume new chapters have no tags initially from DB
        if (error) throw error;
        if (newChapterFromDb) {
           const processedChapter = { ...newChapterFromDb, user_id: user.id, tags: [] }; // New chapters start with no tags from DB
           setChapters(prev => [...prev, processedChapter].sort((a, b) => a.name.localeCompare(b.name)));
        }
      }
      toast({ title: currentChapter.id ? "Chapitre Modifié" : "Chapitre Ajouté" });
      setIsEditModalOpen(false); setCurrentChapter(null);
    } catch (e: any) {
      const errorMessage = (e as Error).message || "Impossible d'enregistrer le chapitre.";
      setError(errorMessage); toast({ title: "Erreur d'enregistrement", description: errorMessage, variant: "destructive" });
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!user) return;
    setIsLoadingChapterActionsForId(chapterId);
    setError(null);
    try {
      // Dissocier avant de supprimer pour éviter les erreurs de contrainte si ON DELETE n'est pas CASCADE pour tasks/objectives
      await supabase.from('tasks').update({ chapter_id: null }).eq('chapter_id', chapterId).eq('user_id', user.id);
      await supabase.from('daily_objectives').update({ chapter_id: null }).eq('chapter_id', chapterId).eq('user_id', user.id);
      // Les tables de jonction (chapter_tags) devraient avoir ON DELETE CASCADE
      const { error } = await supabase.from('chapters').delete().eq('id', chapterId).eq('user_id', user.id);
      if (error) throw error;
      setChapters(prev => prev.filter(ch => ch.id !== chapterId));
      toast({ title: "Chapitre Supprimé" });
    } catch (e: any) {
      const errorMessage = (e as Error).message || "Impossible de supprimer le chapitre.";
      setError(errorMessage); toast({ title: "Erreur de Suppression", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoadingChapterActionsForId(null);
    }
  };

  const handleSaveChapterTags = async (chapterId: string, tagsToSave: Tag[]) => {
    if (!user) return;
    setIsLoadingChapterActionsForId(chapterId);
    setError(null);
    try {
      // Supprimer les anciens liens de tags pour ce chapitre
      await supabase.from('chapter_tags').delete().eq('chapter_id', chapterId);
      // Insérer les nouveaux liens si des tags sont à sauvegarder
      if (tagsToSave.length > 0) {
        const newLinks = tagsToSave.map(tag => ({ chapter_id: chapterId, tag_id: tag.id }));
        const { error: linkError } = await supabase.from('chapter_tags').insert(newLinks);
        if (linkError) throw linkError;
      }
      
      // Mettre à jour l'état local du chapitre avec les nouveaux tags
      setChapters(prevChapters =>
        prevChapters.map(ch =>
          ch.id === chapterId ? { ...ch, tags: tagsToSave } : ch
        ).sort((a, b) => a.name.localeCompare(b.name))
      );
      toast({ title: "Tags Mis à Jour" });
      setIsManageTagsModalOpen(false);
      setChapterForTags(null);
    } catch (e: any) {
      const errorMessage = (e as Error).message || "Impossible de sauvegarder les tags.";
      setError(errorMessage); toast({ title: "Erreur Tags", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoadingChapterActionsForId(null);
    }
  };
  
  const handleGlobalTagUpdate = (newTag: Tag) => {
    setAvailableTags(prev => [...prev.filter(t => t.id !== newTag.id), newTag].sort((a,b) => a.name.localeCompare(b.name)));
  };

  const handleSaveComment = async () => {
    if (!chapterForComment || !newCommentText.trim() || !user) return;
    setIsLoadingChapterActionsForId(chapterForComment.id);
    setError(null);
    try {
      const updatedComments = [...(chapterForComment.supervisor_comments || []), newCommentText.trim()];
      const { data: updatedChapterFromDb, error } = await supabase
        .from('chapters').update({ supervisor_comments: updatedComments }).eq('id', chapterForComment.id).eq('user_id', user.id)
        .select('*, chapter_tags(tags(*))').single(); // Récupérer les tags aussi
      if (error) throw error;
      if (updatedChapterFromDb) {
        const processedChapter = { ...updatedChapterFromDb, user_id: user.id, tags: updatedChapterFromDb.chapter_tags?.map((ct: any) => ct.tags) || [] };
        setChapters(prev => prev.map(ch => ch.id === processedChapter.id ? processedChapter : ch).sort((a, b) => a.name.localeCompare(b.name)));
        setChapterForComment(processedChapter); // Mettre à jour l'état de la modale
      }
      toast({ title: "Commentaire Ajouté" }); setNewCommentText('');
    } catch (e: any) {
      const errorMessage = (e as Error).message || "Impossible d'ajouter le commentaire.";
      setError(errorMessage); toast({ title: "Erreur Commentaire", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoadingChapterActionsForId(null);
    }
  };

  const handleDeleteComment = async (commentIndex: number) => {
    if (!chapterForComment || !chapterForComment.supervisor_comments || !user) return;
    setIsLoadingChapterActionsForId(chapterForComment.id);
    setError(null);
    try {
      const updatedComments = chapterForComment.supervisor_comments.filter((_, index) => index !== commentIndex);
      const { data: updatedChapterFromDb, error } = await supabase
        .from('chapters').update({ supervisor_comments: updatedComments }).eq('id', chapterForComment.id).eq('user_id', user.id)
        .select('*, chapter_tags(tags(*))').single();
      if (error) throw error;
      if (updatedChapterFromDb) {
        const processedChapter = { ...updatedChapterFromDb, user_id: user.id, tags: updatedChapterFromDb.chapter_tags?.map((ct: any) => ct.tags) || [] };
        setChapters(prev => prev.map(ch => ch.id === processedChapter.id ? processedChapter : ch).sort((a, b) => a.name.localeCompare(b.name)));
        setChapterForComment(processedChapter);
      }
      toast({ title: "Commentaire Supprimé" });
    } catch (e: any) {
      const errorMessage = (e as Error).message || "Impossible de supprimer le commentaire.";
      setError(errorMessage); toast({ title: "Erreur Suppression Commentaire", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoadingChapterActionsForId(null);
    }
  };

  if (!user && isFetchingData) {
    return (
      <div className="p-4 md:p-6 h-full flex flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-3" />
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <ListTree className="h-7 w-7 text-primary" />
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Gestion du Plan de Thèse</h1>
        </div>
        <Button onClick={openModalForNew} disabled={isFetchingData || isFormLoading}>
          <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un Chapitre
        </Button>
      </div>

      {isFetchingData ? (
        <Card className="flex-grow flex flex-col items-center justify-center text-center p-6">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Chargement des chapitres...</p>
        </Card>
      ) : error ? (
        <Card className="flex-grow flex flex-col items-center justify-center text-center p-6 border-destructive bg-destructive/10">
          <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
          <p className="font-semibold text-destructive">Erreur de chargement</p>
          <p className="text-sm text-destructive/80 mt-1 mb-3 max-w-md mx-auto">{error}</p>
          <Button onClick={fetchPageData} variant="destructive" className="mt-4">Réessayer</Button>
        </Card>
      ) : chapters.length === 0 ? (
        <Card className="flex-grow flex flex-col items-center justify-center text-center p-6 border-dashed bg-muted/20">
          <CardHeader className="items-center">
            <FolderOpen className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <CardTitle className="text-xl">Commencez à structurer votre thèse !</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto text-sm">Aucun chapitre défini. Cliquez sur le bouton ci-dessous pour créer votre premier chapitre.</p>
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
              onViewLinkedItemsRequest={openLinkedItemsManager}
              onManageTagsRequest={openManageTagsModal}
            />
          ))}
        </div>
      )}

      <Dialog open={isEditModalOpen} onOpenChange={(open) => { if (!isFormLoading) { setIsEditModalOpen(open); if (!open) setCurrentChapter(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">{currentChapter?.id ? 'Modifier le Chapitre' : 'Ajouter un Nouveau Chapitre'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="chapterNameModal" className="mb-1.5 block text-sm">Nom du Chapitre</Label>
              <Input id="chapterNameModal" value={currentChapter?.name || ''} onChange={(e) => setCurrentChapter(prev => prev ? ({ ...prev, name: e.target.value }) : null)} disabled={isFormLoading} className="text-sm" />
            </div>
            <div>
              <Label htmlFor="chapterProgressModal" className="mb-1.5 block text-sm">Progression (%)</Label>
              <Input id="chapterProgressModal" type="number" min="0" max="100" value={currentChapter?.progress === undefined ? '' : currentChapter.progress} onChange={(e) => setCurrentChapter(prev => prev ? ({ ...prev, progress: e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0 }) : null)} disabled={isFormLoading} className="text-sm" />
            </div>
            <div>
              <Label htmlFor="chapterStatusModal" className="mb-1.5 block text-sm">Statut</Label>
              <Input id="chapterStatusModal" value={currentChapter?.status || ''} onChange={(e) => setCurrentChapter(prev => prev ? ({ ...prev, status: e.target.value }) : null)} disabled={isFormLoading} className="text-sm" />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => { if (!isFormLoading) { setIsEditModalOpen(false); setCurrentChapter(null); } }} disabled={isFormLoading}>Annuler</Button>
            <Button onClick={handleSaveChapter} disabled={isFormLoading || !currentChapter?.name?.trim()}>
              {isFormLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isFormLoading ? (currentChapter?.id ? 'Mise à jour...' : 'Ajout...') : (currentChapter?.id ? 'Mettre à Jour' : 'Ajouter le Chapitre')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCommentModalOpen} onOpenChange={(open) => { if (isLoadingChapterActionsForId !== chapterForComment?.id) { setIsCommentModalOpen(open); if(!open) setChapterForComment(null); }}}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Commentaires pour "{chapterForComment?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="max-h-[40vh] overflow-y-auto custom-scrollbar pr-2 space-y-2">
              {chapterForComment?.supervisor_comments && chapterForComment.supervisor_comments.length > 0 ? (
                chapterForComment.supervisor_comments.map((comment, index) => (
                  <div key={index} className="p-2.5 border rounded-md bg-muted/50 flex justify-between items-start gap-2 text-sm">
                    <p className="whitespace-pre-wrap flex-grow leading-relaxed">{comment}</p>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDeleteComment(index)} disabled={isLoadingChapterActionsForId === chapterForComment?.id} title="Supprimer le commentaire">
                      <Trash2 className="h-3.5 w-3.5 text-destructive/70 hover:text-destructive" />
                    </Button>
                  </div>
                ))
              ) : <p className="text-sm text-muted-foreground text-center py-4">Aucun commentaire pour ce chapitre.</p>}
            </div>
            <div className="pt-4 border-t">
              <Label htmlFor="newCommentModal" className="block mb-1.5 text-sm font-medium">Ajouter un commentaire</Label>
              <Textarea id="newCommentModal" value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} rows={3} disabled={isLoadingChapterActionsForId === chapterForComment?.id} className="text-sm" />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <DialogClose asChild><Button variant="outline" disabled={isLoadingChapterActionsForId === chapterForComment?.id}>Fermer</Button></DialogClose>
            <Button onClick={handleSaveComment} disabled={isLoadingChapterActionsForId === chapterForComment?.id || !newCommentText.trim()}>
              {isLoadingChapterActionsForId === chapterForComment?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LinkedItemsModal 
        isOpen={isLinkedItemsModalOpen} 
        onOpenChange={(open) => { setIsLinkedItemsModalOpen(open); if (!open) setChapterForLinkedItems(null); }} 
        chapter={chapterForLinkedItems} 
        tasks={linkedTasks} 
        objectives={linkedObjectives}
        isLoadingLinkedItems={isLoadingLinkedItems}
      />
      <ManageTagsModal 
        isOpen={isManageTagsModalOpen} 
        onOpenChange={(open) => { setIsManageTagsModalOpen(open); if (!open) setChapterForTags(null); }} 
        chapter={chapterForTags} 
        availableTags={availableTags.filter(t => t.user_id === user?.id)} 
        onGlobalTagsUpdate={handleGlobalTagUpdate}
        onSaveTags={handleSaveChapterTags} 
        isLoading={isLoadingChapterActionsForId === chapterForTags?.id}
      />
    </div>
  );
}

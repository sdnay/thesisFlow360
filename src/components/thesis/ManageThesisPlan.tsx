
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2, ListTree, FolderOpen, AlertTriangle } from 'lucide-react';
import type { Chapter, Task, Tag } from '@/types'; // Assurez-vous que Task est importé
import { useAuth } from '@/hooks/useAuth';

import ChapterCardItem from './manage-plan-components/ChapterCardItem';
import LinkedItemsModal from './manage-plan-components/LinkedItemsModal';
import ManageTagsModal from './manage-plan-components/ManageTagsModal';
import { Textarea } from '../ui/textarea'; // Ajouté

// Fonction de calcul de progression
function calculateChapterProgress(chapterId: string, allTasks: Task[]): number {
  const tasksForChapter = allTasks.filter(task => task.chapter_id === chapterId && task.user_id === supabase.auth.getUser()?.then(u => u.data.user?.id).catch(() => null)); // Assurez-vous de filtrer par user_id si applicable
  if (tasksForChapter.length === 0) {
    return 0;
  }
  const completedTasks = tasksForChapter.filter(task => task.completed).length;
  return Math.round((completedTasks / tasksForChapter.length) * 100);
}


export default function ManageThesisPlan() {
  const { user } = useAuth();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [allUserTasks, setAllUserTasks] = useState<Task[]>([]); // Pour calculer la progression
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [isLinkedItemsModalOpen, setIsLinkedItemsModalOpen] = useState(false);
  const [isManageTagsModalOpen, setIsManageTagsModalOpen] = useState(false);

  const [currentChapter, setCurrentChapter] = useState<Partial<Chapter> & { id?: string } | null>(null);
  const [chapterForComment, setChapterForComment] = useState<Chapter | null>(null);
  const [chapterForLinkedItems, setChapterForLinkedItems] = useState<Chapter | null>(null);
  const [chapterForTags, setChapterForTags] = useState<Chapter | null>(null);

  const [linkedTasks, setLinkedTasks] = useState<Task[]>([]);
  // const [linkedObjectives, setLinkedObjectives] = useState<DailyObjective[]>([]); // DailyObjective non importé

  const [newCommentText, setNewCommentText] = useState('');
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [isLoadingChapterActionsForId, setIsLoadingChapterActionsForId] = useState<string | null>(null);
  const [isLoadingLinkedItems, setIsLoadingLinkedItems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPageData = useCallback(async () => {
    if (!user) {
      setChapters([]); setAllUserTasks([]); setAvailableTags([]);
      setIsFetchingData(false); return;
    }
    setIsFetchingData(true); setError(null);
    try {
      const [chaptersRes, tasksRes, tagsRes] = await Promise.all([
        supabase.from('chapters').select('*, chapter_tags(tags(*))').eq('user_id', user.id).order('name', { ascending: true }),
        supabase.from('tasks').select('*').eq('user_id', user.id), // Récupérer toutes les tâches de l'utilisateur
        supabase.from('tags').select('*').eq('user_id', user.id).order('name')
      ]);

      if (chaptersRes.error) throw chaptersRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (tagsRes.error) throw tagsRes.error;
      
      setChapters((chaptersRes.data || []).map(ch => ({ ...ch, tags: ch.chapter_tags?.map((ct: any) => ct.tags) || [] })));
      setAllUserTasks(tasksRes.data || []);
      setAvailableTags(tagsRes.data || []);

    } catch (e: any) {
      const errorMessage = (e as Error).message || "Erreur de chargement des données.";
      setError(errorMessage);
      toast({ title: "Erreur Chargement", description: errorMessage, variant: "destructive" });
    } finally {
      setIsFetchingData(false);
    }
  }, [toast, user]);

  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);
  
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`db-manage-thesis-plan-user-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chapters', filter: `user_id=eq.${user.id}` }, () => fetchPageData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` }, () => fetchPageData()) // Écouter les tâches aussi
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chapter_tags' }, () => fetchPageData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags', filter: `user_id=eq.${user.id}` }, () => fetchPageData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchPageData]);


  const openModalForNew = () => { setCurrentChapter({ name: '', progress: 0, status: 'Non commencé', supervisor_comments: [], tags: [] }); setIsEditModalOpen(true); };
  const openModalForEdit = (chapter: Chapter) => { setCurrentChapter(JSON.parse(JSON.stringify(chapter))); setIsEditModalOpen(true); };
  const openCommentManager = (chapter: Chapter) => { setChapterForComment(JSON.parse(JSON.stringify(chapter))); setNewCommentText(''); setIsCommentModalOpen(true); };
  
  const openLinkedItemsManager = async (chapter: Chapter) => {
    if (!user) return;
    setChapterForLinkedItems(chapter);
    setIsLoadingLinkedItems(true);
    setIsLinkedItemsModalOpen(true);
    try {
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('chapter_id', chapter.id)
        .eq('user_id', user.id);
      if (tasksError) throw tasksError;
      setLinkedTasks(tasksData || []);
      // TODO: Fetch linked objectives
    } catch (e: any) {
      toast({ title: "Erreur Éléments Liés", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsLoadingLinkedItems(false);
    }
  };
  const openManageTagsModal = (chapter: Chapter) => { setChapterForTags(chapter); setIsManageTagsModalOpen(true); };

  const handleSaveChapter = async () => {
    if (!currentChapter || !currentChapter.name?.trim() || !user) return;
    setIsFormLoading(true); setError(null);
    const chapterPayload = {
      user_id: user.id,
      name: currentChapter.name.trim(),
      progress: currentChapter.progress === undefined ? 0 : Number(currentChapter.progress),
      status: currentChapter.status?.trim() || 'Non commencé',
      supervisor_comments: currentChapter.supervisor_comments || []
    };
    try {
      if (currentChapter.id) {
        const { data: updatedChapter, error } = await supabase.from('chapters').update(chapterPayload).eq('id', currentChapter.id).select('*, chapter_tags(tags(*))').single();
        if (error) throw error;
        setChapters(prev => prev.map(ch => ch.id === updatedChapter?.id ? { ...(updatedChapter as Chapter), tags: updatedChapter?.chapter_tags?.map((ct: any) => ct.tags) || [] } : ch).sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const { data: newChapter, error } = await supabase.from('chapters').insert(chapterPayload).select('*, chapter_tags(tags(*))').single();
        if (error) throw error;
        setChapters(prev => [...prev, { ...(newChapter as Chapter), tags: newChapter?.chapter_tags?.map((ct: any) => ct.tags) || [] }].sort((a, b) => a.name.localeCompare(b.name)));
      }
      toast({ title: currentChapter.id ? "Chapitre Modifié" : "Chapitre Ajouté" });
      setIsEditModalOpen(false); setCurrentChapter(null);
    } catch (e: any) {
      const errorMessage = (e as Error).message;
      setError(errorMessage); toast({ title: "Erreur d'enregistrement", description: errorMessage, variant: "destructive" });
    } finally { setIsFormLoading(false); }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!user) return;
    setIsLoadingChapterActionsForId(chapterId); setError(null);
    try {
      await supabase.from('tasks').update({ chapter_id: null }).eq('chapter_id', chapterId).eq('user_id', user.id);
      // await supabase.from('daily_objectives').update({ chapter_id: null }).eq('chapter_id', chapterId).eq('user_id', user.id); // DailyObjective non importé
      await supabase.from('chapter_tags').delete().eq('chapter_id', chapterId);
      const { error } = await supabase.from('chapters').delete().eq('id', chapterId).eq('user_id', user.id);
      if (error) throw error;
      setChapters(prev => prev.filter(ch => ch.id !== chapterId));
      toast({ title: "Chapitre Supprimé" });
    } catch (e: any) {
      const errorMessage = (e as Error).message;
      setError(errorMessage); toast({ title: "Erreur de Suppression", description: errorMessage, variant: "destructive" });
    } finally { setIsLoadingChapterActionsForId(null); }
  };

  const handleSaveChapterTags = async (chapterId: string, tagsToSave: Tag[]) => {
    if (!user) return;
    setIsLoadingChapterActionsForId(chapterId); setError(null);
    try {
      await supabase.from('chapter_tags').delete().eq('chapter_id', chapterId);
      if (tagsToSave.length > 0) {
        const newLinks = tagsToSave.map(tag => ({ chapter_id: chapterId, tag_id: tag.id }));
        const { error: linkError } = await supabase.from('chapter_tags').insert(newLinks);
        if (linkError) throw linkError;
      }
      setChapters(prevChapters => prevChapters.map(ch => ch.id === chapterId ? { ...ch, tags: tagsToSave } : ch).sort((a,b) => a.name.localeCompare(b.name)));
      toast({ title: "Tags Mis à Jour" });
      setIsManageTagsModalOpen(false); setChapterForTags(null);
    } catch (e: any) {
      const errorMessage = (e as Error).message;
      setError(errorMessage); toast({ title: "Erreur Tags", description: errorMessage, variant: "destructive" });
    } finally { setIsLoadingChapterActionsForId(null); }
  };
  
  const handleGlobalTagUpdate = (newTag: Tag) => {
    setAvailableTags(prev => [...prev.filter(t => t.id !== newTag.id), newTag].sort((a,b) => a.name.localeCompare(b.name)));
  };

  const handleSaveComment = async () => {
    if (!chapterForComment || !newCommentText.trim() || !user) return;
    setIsLoadingChapterActionsForId(chapterForComment.id); setError(null);
    try {
      const updatedComments = [...(chapterForComment.supervisor_comments || []), newCommentText.trim()];
      const { data: updatedChapter, error } = await supabase.from('chapters').update({ supervisor_comments: updatedComments }).eq('id', chapterForComment.id).select('*, chapter_tags(tags(*))').single();
      if (error) throw error;
      const processedChapter = { ...(updatedChapter as Chapter), tags: updatedChapter?.chapter_tags?.map((ct: any) => ct.tags) || [] };
      setChapters(prev => prev.map(ch => ch.id === processedChapter.id ? processedChapter : ch).sort((a,b) => a.name.localeCompare(b.name)));
      setChapterForComment(processedChapter);
      toast({ title: "Commentaire Ajouté" }); setNewCommentText('');
    } catch (e: any) {
      const errorMessage = (e as Error).message;
      setError(errorMessage); toast({ title: "Erreur Commentaire", description: errorMessage, variant: "destructive" });
    } finally { setIsLoadingChapterActionsForId(null); }
  };

  const handleDeleteComment = async (commentIndex: number) => {
    if (!chapterForComment || !chapterForComment.supervisor_comments || !user) return;
    setIsLoadingChapterActionsForId(chapterForComment.id); setError(null);
    try {
      const updatedComments = chapterForComment.supervisor_comments.filter((_, index) => index !== commentIndex);
      const { data: updatedChapter, error } = await supabase.from('chapters').update({ supervisor_comments: updatedComments }).eq('id', chapterForComment.id).select('*, chapter_tags(tags(*))').single();
      if (error) throw error;
      const processedChapter = { ...(updatedChapter as Chapter), tags: updatedChapter?.chapter_tags?.map((ct: any) => ct.tags) || [] };
      setChapters(prev => prev.map(ch => ch.id === processedChapter.id ? processedChapter : ch).sort((a,b) => a.name.localeCompare(b.name)));
      setChapterForComment(processedChapter);
      toast({ title: "Commentaire Supprimé" });
    } catch (e: any) {
      const errorMessage = (e as Error).message;
      setError(errorMessage); toast({ title: "Erreur Suppression Commentaire", description: errorMessage, variant: "destructive" });
    } finally { setIsLoadingChapterActionsForId(null); }
  };

  if (!user && !isFetchingData) {
    return (
      <div className="p-4 md:p-6 h-full flex flex-col items-center justify-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-3" />
        <p className="text-muted-foreground text-lg">Veuillez vous connecter pour gérer le plan de votre thèse.</p>
      </div>
    );
  }
  
  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <ListTree className="h-7 w-7 text-primary" />
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Structure de la Thèse</h1>
        </div>
        <Button onClick={openModalForNew} disabled={isFetchingData || isFormLoading || !user}>
          <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un Chapitre
        </Button>
      </div>

      {isFetchingData ? (
        <div className="flex-grow flex flex-col items-center justify-center text-center p-6">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Chargement des chapitres...</p>
        </div>
      ) : error ? (
        <Card className="flex-grow flex flex-col items-center justify-center text-center p-6 border-destructive bg-destructive/10">
          <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
          <p className="font-semibold text-destructive">Erreur de chargement</p>
          <p className="text-sm text-destructive/80 mt-1 mb-3 max-w-md mx-auto">{error}</p>
          <Button onClick={fetchPageData} variant="destructive" className="mt-4">Réessayer</Button>
        </Card>
      ) : chapters.length === 0 ? (
        <Card className="flex-grow flex flex-col items-center justify-center text-center p-6 border-dashed bg-muted/20">
          <CardHeader className="items-center"><FolderOpen className="h-16 w-16 text-muted-foreground/50 mb-4" /><CardTitle className="text-xl">Commencez à structurer votre thèse !</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground mb-4 max-w-md mx-auto text-sm">Aucun chapitre défini. Cliquez ci-dessous pour créer votre premier chapitre.</p><Button onClick={openModalForNew} disabled={isFormLoading} size="lg"><PlusCircle className="mr-2 h-5 w-5" /> Créer le premier chapitre</Button></CardContent>
        </Card>
      ) : (
        <div className="flex-grow grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-start overflow-y-auto custom-scrollbar pr-1 pb-4">
          {chapters.map((chapter) => (
            <ChapterCardItem
              key={chapter.id}
              chapter={{...chapter, progress: calculateChapterProgress(chapter.id, allUserTasks)}}
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
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle className="text-lg">{currentChapter?.id ? 'Modifier le Chapitre' : 'Ajouter un Nouveau Chapitre'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label htmlFor="chapterNameModal" className="mb-1.5 block text-sm">Nom</Label><Input id="chapterNameModal" value={currentChapter?.name || ''} onChange={(e) => setCurrentChapter(prev => prev ? ({ ...prev, name: e.target.value }) : null)} disabled={isFormLoading} className="text-sm" /></div>
            <div><Label htmlFor="chapterStatusModal" className="mb-1.5 block text-sm">Statut</Label><Input id="chapterStatusModal" value={currentChapter?.status || ''} onChange={(e) => setCurrentChapter(prev => prev ? ({ ...prev, status: e.target.value }) : null)} disabled={isFormLoading} className="text-sm" /></div>
            {/* La progression est calculée, donc on ne la modifie plus manuellement ici */}
          </div>
          <DialogFooter className="mt-2"><Button variant="outline" onClick={() => { if (!isFormLoading) { setIsEditModalOpen(false); setCurrentChapter(null); } }} disabled={isFormLoading}>Annuler</Button><Button onClick={handleSaveChapter} disabled={isFormLoading || !currentChapter?.name?.trim()}><Loader2 className={isFormLoading ? "mr-2 h-4 w-4 animate-spin" : "hidden"} />{currentChapter?.id ? 'Mettre à Jour' : 'Ajouter'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCommentModalOpen} onOpenChange={(open) => { if (isLoadingChapterActionsForId !== chapterForComment?.id) { setIsCommentModalOpen(open); if(!open) setChapterForComment(null); }}}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle className="text-lg">Commentaires pour "{chapterForComment?.name}"</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="max-h-[40vh] overflow-y-auto custom-scrollbar pr-2 space-y-2">
              {chapterForComment?.supervisor_comments && chapterForComment.supervisor_comments.length > 0 ? (
                chapterForComment.supervisor_comments.map((comment, index) => (
                  <div key={index} className="p-2.5 border rounded-md bg-muted/50 flex justify-between items-start gap-2 text-sm">
                    <p className="whitespace-pre-wrap flex-grow leading-relaxed">{comment}</p>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDeleteComment(index)} disabled={isLoadingChapterActionsForId === chapterForComment?.id} title="Supprimer commentaire"><Loader2 className={isLoadingChapterActionsForId === chapterForComment?.id ? "h-3.5 w-3.5 animate-spin" : "hidden"} /><Trash2 className={isLoadingChapterActionsForId === chapterForComment?.id ? "hidden" : "h-3.5 w-3.5 text-destructive/70 hover:text-destructive"} /></Button>
                  </div>
                ))
              ) : <p className="text-sm text-muted-foreground text-center py-4">Aucun commentaire.</p>}
            </div>
            <div className="pt-4 border-t"><Label htmlFor="newCommentModal" className="block mb-1.5 text-sm">Nouveau commentaire</Label><Textarea id="newCommentModal" value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} rows={3} disabled={isLoadingChapterActionsForId === chapterForComment?.id} className="text-sm" /></div>
          </div>
          <DialogFooter className="mt-2"><DialogClose asChild><Button variant="outline" disabled={isLoadingChapterActionsForId === chapterForComment?.id}>Fermer</Button></DialogClose><Button onClick={handleSaveComment} disabled={isLoadingChapterActionsForId === chapterForComment?.id || !newCommentText.trim()}><Loader2 className={isLoadingChapterActionsForId === chapterForComment?.id ? "mr-2 h-4 w-4 animate-spin" : "hidden"} />Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <LinkedItemsModal isOpen={isLinkedItemsModalOpen} onOpenChange={(open) => { setIsLinkedItemsModalOpen(open); if (!open) setChapterForLinkedItems(null); }} chapter={chapterForLinkedItems} tasks={linkedTasks} objectives={[] /* TODO: Passer les objectifs liés */} isLoadingLinkedItems={isLoadingLinkedItems}/>
      <ManageTagsModal isOpen={isManageTagsModalOpen} onOpenChange={(open) => { setIsManageTagsModalOpen(open); if (!open) setChapterForTags(null); }} chapter={chapterForTags} availableTags={availableTags.filter(t => t.user_id === user?.id)} onGlobalTagsUpdate={handleGlobalTagUpdate} onSaveTags={handleSaveChapterTags} isLoading={isLoadingChapterActionsForId === chapterForTags?.id}/>
    </div>
  );
}

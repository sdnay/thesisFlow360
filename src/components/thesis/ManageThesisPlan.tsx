
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
import type { Chapter, Task, Tag } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Textarea } from '../ui/textarea';

import ChapterCardItem from './manage-plan-components/ChapterCardItem';
// Retiré car la page de détail gère cela directement : import LinkedItemsModal from './manage-plan-components/LinkedItemsModal';
import ManageTagsModal from './manage-plan-components/ManageTagsModal';


// Fonction de calcul de progression (pourrait être dans un fichier utils)
function calculateChapterProgress(chapterId: string, allTasks: Task[]): number {
  if (!allTasks || allTasks.length === 0) return 0;
  const tasksForChapter = allTasks.filter(task => task.chapter_id === chapterId);
  if (tasksForChapter.length === 0) {
    return 0; // Ou une autre valeur par défaut si aucune tâche n'est liée
  }
  const completedTasks = tasksForChapter.filter(task => task.completed).length;
  return Math.round((completedTasks / tasksForChapter.length) * 100);
}


export default function ManageThesisPlan() {
  const { user } = useAuth();
  const router = useRouter();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [allUserTasks, setAllUserTasks] = useState<Task[]>([]); // Pour calculer la progression
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [isManageTagsModalOpen, setIsManageTagsModalOpen] = useState(false);

  const [currentChapter, setCurrentChapter] = useState<Partial<Chapter> & { id?: string } | null>(null);
  const [chapterForComment, setChapterForComment] = useState<Chapter | null>(null);
  const [chapterForTags, setChapterForTags] = useState<Chapter | null>(null);

  const [newCommentText, setNewCommentText] = useState('');
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [isLoadingChapterActionsForId, setIsLoadingChapterActionsForId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPageData = useCallback(async () => {
    if (!user) {
      setChapters([]);
      setAllUserTasks([]);
      setAvailableTags([]);
      setIsFetchingData(false);
      return;
    }
    setIsFetchingData(true);
    setError(null);
    try {
      const [chaptersRes, tasksRes, tagsRes] = await Promise.all([
        supabase.from('chapters').select('*, chapter_tags(tags(*))').eq('user_id', user.id).order('name', { ascending: true }),
        supabase.from('tasks').select('id, chapter_id, completed').eq('user_id', user.id), // Seulement les champs nécessaires pour la progression
        supabase.from('tags').select('*').eq('user_id', user.id).order('name')
      ]);

      if (chaptersRes.error) throw chaptersRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (tagsRes.error) throw tagsRes.error;
      
      const fetchedChapters = (chaptersRes.data || []).map(ch => ({ 
        ...ch, 
        tags: ch.chapter_tags?.map((ct: any) => ct.tags as Tag) || [] 
      }));
      setChapters(fetchedChapters);
      setAllUserTasks(tasksRes.data || []);
      setAvailableTags(tagsRes.data || []);

    } catch (e: any) {
      const typedError = e as Error;
      const errorMessage = typedError.message || "Erreur de chargement des données.";
      setError(errorMessage);
      console.error("Erreur fetchPageData (ManageThesisPlan):", typedError);
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
    const channels = [
      supabase.channel(`db-manage-thesis-plan-chapters-user-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chapters', filter: `user_id=eq.${user.id}` }, (payload) => { console.log('Realtime chapters change:', payload); fetchPageData(); })
        .subscribe(),
      supabase.channel(`db-manage-thesis-plan-tasks-user-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` }, (payload) => { console.log('Realtime tasks change:', payload); fetchPageData(); }) // Pour recalculer la progression
        .subscribe(),
      supabase.channel(`db-manage-thesis-plan-chapter_tags-user-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chapter_tags' }, (payload: any) => {
             // Need to check if the change affects current user's chapters/tags
             // This is a bit broad, ideally filter by chapter_id linked to the user
             console.log("Chapter_tags change, refetching page data for thesis plan", payload);
             fetchPageData();
        })
        .subscribe(),
       supabase.channel(`db-manage-thesis-plan-tags-user-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tags', filter: `user_id=eq.${user.id}` }, (payload) => { console.log('Realtime tags change:', payload); fetchPageData(); })
        .subscribe()
    ];
    
    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [user, fetchPageData]);


  const openModalForNew = () => { setCurrentChapter({ name: '', progress: 0, status: 'Non commencé', supervisor_comments: [], tags: [] }); setIsEditModalOpen(true); };
  const openModalForEdit = (chapter: Chapter) => { setCurrentChapter(JSON.parse(JSON.stringify(chapter))); setIsEditModalOpen(true); };
  const openCommentManager = (chapter: Chapter) => { setChapterForComment(JSON.parse(JSON.stringify(chapter))); setNewCommentText(''); setIsCommentModalOpen(true); };
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
      if (currentChapter.id) { // Modification
        const { data: updatedChapter, error } = await supabase
          .from('chapters')
          .update(chapterPayload)
          .eq('id', currentChapter.id)
          .eq('user_id', user.id) // Sécurité
          .select('*, chapter_tags(tags(*))') // Récupérer avec les tags
          .single();
        if (error) throw error;
        if (updatedChapter) {
          const processedChapter: Chapter = { ...updatedChapter, tags: updatedChapter.chapter_tags?.map((ct: any) => ct.tags as Tag) || [] };
          setChapters(prev => prev.map(ch => ch.id === processedChapter.id ? processedChapter : ch).sort((a, b) => a.name.localeCompare(b.name)));
        }
      } else { // Ajout
        const { data: newChapter, error } = await supabase
          .from('chapters')
          .insert(chapterPayload)
          .select('*, chapter_tags(tags(*))') // Récupérer avec les tags (sera vide au début)
          .single();
        if (error) throw error;
        if (newChapter) {
            const processedChapter: Chapter = { ...newChapter, tags: newChapter.chapter_tags?.map((ct: any) => ct.tags as Tag) || [] };
            setChapters(prev => [...prev, processedChapter].sort((a, b) => a.name.localeCompare(b.name)));
        }
      }
      toast({ title: currentChapter.id ? "Chapitre Modifié" : "Chapitre Ajouté" });
      setIsEditModalOpen(false); setCurrentChapter(null);
    } catch (e: any) {
      const typedError = e as Error;
      setError(typedError.message); 
      console.error("Erreur handleSaveChapter:", typedError);
      toast({ title: "Erreur d'enregistrement", description: typedError.message, variant: "destructive" });
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!user) return;
    setIsLoadingChapterActionsForId(chapterId); setError(null);
    try {
      await supabase.from('tasks').update({ chapter_id: null }).eq('chapter_id', chapterId).eq('user_id', user.id);
      await supabase.from('daily_objectives').update({ chapter_id: null }).eq('chapter_id', chapterId).eq('user_id', user.id);
      await supabase.from('chapter_tags').delete().eq('chapter_id', chapterId); // Supabase RLS devrait gérer la sécurité user_id ici via la table chapters
      await supabase.from('chapter_sources').delete().eq('chapter_id', chapterId); // Supabase RLS
      await supabase.from('brain_dump_entries').update({ chapter_id: null }).eq('chapter_id', chapterId).eq('user_id', user.id);
      await supabase.from('pomodoro_sessions').update({ chapter_id: null }).eq('chapter_id', chapterId).eq('user_id', user.id);

      const { error } = await supabase.from('chapters').delete().eq('id', chapterId).eq('user_id', user.id);
      if (error) throw error;
      setChapters(prev => prev.filter(ch => ch.id !== chapterId)); // Mise à jour manuelle
      toast({ title: "Chapitre Supprimé" });
    } catch (e: any) {
      const typedError = e as Error;
      setError(typedError.message); 
      console.error("Erreur handleDeleteChapter:", typedError);
      toast({ title: "Erreur de Suppression", description: typedError.message, variant: "destructive" });
    } finally {
      setIsLoadingChapterActionsForId(null);
    }
  };
  
  const handleGlobalTagUpdate = (newOrUpdatedTag: Tag) => {
    setAvailableTags(prev => {
      const tagExists = prev.some(t => t.id === newOrUpdatedTag.id);
      if (tagExists) {
        return prev.map(t => t.id === newOrUpdatedTag.id ? newOrUpdatedTag : t).sort((a,b) => a.name.localeCompare(b.name));
      }
      return [...prev, newOrUpdatedTag].sort((a,b) => a.name.localeCompare(b.name));
    });
  };

  const handleSaveChapterTags = async (chapterId: string, tagsToSave: Tag[]) => {
    if (!user) return;
    setIsLoadingChapterActionsForId(chapterId); setError(null);
    try {
      // 1. Supprimer les anciennes liaisons pour ce chapitre
      // La politique RLS sur chapter_tags doit s'assurer que l'utilisateur ne peut supprimer que les liaisons
      // pour les chapitres qui lui appartiennent.
      const { error: deleteError } = await supabase.from('chapter_tags').delete().eq('chapter_id', chapterId);
      if (deleteError) throw deleteError;

      // 2. Insérer les nouvelles liaisons
      if (tagsToSave.length > 0) {
        const newLinks = tagsToSave.map(tag => ({ chapter_id: chapterId, tag_id: tag.id }));
        const { error: linkError } = await supabase.from('chapter_tags').insert(newLinks);
        if (linkError) throw linkError;
      }
      
      // 3. Mettre à jour l'état local du chapitre concerné
      setChapters(prevChapters => 
        prevChapters.map(ch => 
          ch.id === chapterId ? { ...ch, tags: tagsToSave } : ch
        ).sort((a,b) => a.name.localeCompare(b.name))
      );
      
      toast({ title: "Tags Mis à Jour" });
      setIsManageTagsModalOpen(false); setChapterForTags(null);
    } catch (e: any) { // Accolade ouvrante ici
      const typedError = e as Error;
      setError(typedError.message);
      console.error("Erreur handleSaveChapterTags:", typedError);
      toast({ title: "Erreur Tags", description: typedError.message, variant: "destructive" });
    } finally {
      setIsLoadingChapterActionsForId(null);
    }
  };
  
  const handleSaveComment = async () => {
    if (!chapterForComment || !newCommentText.trim() || !user) return;
    setIsLoadingChapterActionsForId(chapterForComment.id); setError(null);
    try {
      const updatedComments = [...(chapterForComment.supervisor_comments || []), newCommentText.trim()];
      const { data: updatedChapter, error } = await supabase
        .from('chapters')
        .update({ supervisor_comments: updatedComments })
        .eq('id', chapterForComment.id)
        .eq('user_id', user.id) // Sécurité
        .select('*, chapter_tags(tags(*))')
        .single();

      if (error) throw error;
      
      if (updatedChapter) {
        const processedChapter: Chapter = { ...updatedChapter, tags: updatedChapter.chapter_tags?.map((ct: any) => ct.tags as Tag) || [] };
        setChapters(prev => prev.map(ch => ch.id === processedChapter.id ? processedChapter : ch).sort((a,b) => a.name.localeCompare(b.name)));
        setChapterForComment(processedChapter);
      }
      toast({ title: "Commentaire Ajouté" }); setNewCommentText('');
    } catch (e: any) {
      const typedError = e as Error;
      setError(typedError.message); 
      console.error("Erreur handleSaveComment:", typedError);
      toast({ title: "Erreur Commentaire", description: typedError.message, variant: "destructive" });
    } finally {
      setIsLoadingChapterActionsForId(null);
    }
  };

  const handleDeleteComment = async (commentIndex: number) => {
    if (!chapterForComment || !chapterForComment.supervisor_comments || !user) return;
    setIsLoadingChapterActionsForId(chapterForComment.id); setError(null);
    try {
      const updatedComments = chapterForComment.supervisor_comments.filter((_, index) => index !== commentIndex);
      const { data: updatedChapter, error } = await supabase
        .from('chapters')
        .update({ supervisor_comments: updatedComments })
        .eq('id', chapterForComment.id)
        .eq('user_id', user.id) // Sécurité
        .select('*, chapter_tags(tags(*))')
        .single();

      if (error) throw error;
      if (updatedChapter) {
        const processedChapter: Chapter = { ...updatedChapter, tags: updatedChapter.chapter_tags?.map((ct: any) => ct.tags as Tag) || [] };
        setChapters(prev => prev.map(ch => ch.id === processedChapter.id ? processedChapter : ch).sort((a,b) => a.name.localeCompare(b.name)));
        setChapterForComment(processedChapter);
      }
      toast({ title: "Commentaire Supprimé" });
    } catch (e: any) {
      const typedError = e as Error;
      setError(typedError.message); 
      console.error("Erreur handleDeleteComment:", typedError);
      toast({ title: "Erreur Suppression Commentaire", description: typedError.message, variant: "destructive" });
    } finally {
      setIsLoadingChapterActionsForId(null);
    }
  };

  if (!user && !isFetchingData) {
    return (
      <div className="p-4 md:p-6 h-full flex flex-col items-center justify-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-3" />
        <p className="text-muted-foreground text-lg">Veuillez vous connecter pour gérer le plan de votre thèse.</p>
        <Button asChild className="mt-4"><Link href="/login">Se connecter</Link></Button>
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
          <CardContent><p className="text-muted-foreground mb-4 max-w-md mx-auto text-sm">Aucun chapitre défini. Cliquez ci-dessous pour créer votre premier chapitre.</p><Button onClick={openModalForNew} disabled={isFormLoading || !user} size="lg"><PlusCircle className="mr-2 h-5 w-5" /> Créer le premier chapitre</Button></CardContent>
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
            <div>
              <Label htmlFor="chapterProgressModal" className="mb-1.5 block text-sm">Progression Manuelle (%)</Label>
              <Input id="chapterProgressModal" type="number" min="0" max="100" value={currentChapter?.progress === undefined ? '' : currentChapter.progress} onChange={(e) => setCurrentChapter(prev => prev ? ({ ...prev, progress: e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0 }) : null)} disabled={isFormLoading} className="text-sm" />
              <p className="text-xs text-muted-foreground mt-1">La progression peut aussi être calculée automatiquement en fonction des tâches liées. Ce champ permet un ajustement manuel.</p>
            </div>
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
      
      <ManageTagsModal 
        isOpen={isManageTagsModalOpen} 
        onOpenChange={(open) => { if (isLoadingChapterActionsForId !== chapterForTags?.id) { setIsManageTagsModalOpen(open); if (!open) setChapterForTags(null); }}}
        chapter={chapterForTags} 
        availableTags={availableTags.filter(t => t.user_id === user?.id)} 
        onGlobalTagsUpdate={handleGlobalTagUpdate} 
        onSaveTags={handleSaveChapterTags} 
        isLoading={isLoadingChapterActionsForId === chapterForTags?.id}
      />
    </div>
  );
}


    
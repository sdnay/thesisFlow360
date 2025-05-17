
"use client"; // Renommé depuis add-chapter/page.tsx pour clarté

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
import { PlusCircle, Trash2, Loader2, ListTree, Save, FolderOpen, MessageSquare, MoreVertical, Edit, Eye, AlertTriangle } from 'lucide-react';
import type { Chapter, Task, DailyObjective } from '@/types'; // Import Task, DailyObjective
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Link from 'next/link';

interface ChapterCardItemProps {
  chapter: Chapter;
  onEditRequest: (chapter: Chapter) => void;
  onDeleteRequest: (chapterId: string) => void;
  onCommentManagerRequest: (chapter: Chapter) => void;
  isLoadingActionsForId: string | null;
  onViewLinkedItemsRequest: (chapter: Chapter) => void; // Nouvelle prop
}

const ChapterCardItem: FC<ChapterCardItemProps> = ({
  chapter, onEditRequest, onDeleteRequest, onCommentManagerRequest, isLoadingActionsForId, onViewLinkedItemsRequest
}) => {
  const lastComment = chapter.supervisor_comments && chapter.supervisor_comments.length > 0 ? chapter.supervisor_comments[chapter.supervisor_comments.length - 1] : null;
  const isLoading = isLoadingActionsForId === chapter.id;

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col h-full bg-card">
      <CardHeader className="pb-3 pt-4">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-grow min-w-0">
            <CardTitle className="text-base md:text-lg leading-tight truncate" title={chapter.name}>{chapter.name}</CardTitle>
            <CardDescription className="text-xs md:text-sm pt-0.5">{chapter.status}</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={isLoading}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}<span className="sr-only">Options</span></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditRequest(chapter)} disabled={isLoading}><Edit className="mr-2 h-4 w-4" />Modifier</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewLinkedItemsRequest(chapter)} disabled={isLoading}><Eye className="mr-2 h-4 w-4" />Voir Éléments Liés</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDeleteRequest(chapter.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10" disabled={isLoading}><Trash2 className="mr-2 h-4 w-4" />Supprimer</DropdownMenuItem>
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
            {lastComment && (<TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger className="w-full text-left"><p className="text-xs text-muted-foreground italic line-clamp-2">{lastComment}</p></TooltipTrigger><TooltipContent side="bottom" align="start" className="max-w-xs whitespace-pre-wrap bg-popover text-popover-foreground p-2 rounded-md shadow-lg border"><p>{lastComment}</p></TooltipContent></Tooltip></TooltipProvider>)}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-3 pb-4 border-t mt-auto">
        <Button variant="outline" size="sm" onClick={() => onCommentManagerRequest(chapter)} disabled={isLoading} className="w-full text-xs text-muted-foreground hover:text-primary hover:bg-primary/5">
          <MessageSquare className="mr-1.5 h-3.5 w-3.5" />Gérer Commentaires ({chapter.supervisor_comments?.length || 0})
        </Button>
      </CardFooter>
    </Card>
  );
};

// Modale pour afficher les éléments liés
interface LinkedItemsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  chapter: Chapter | null;
  tasks: Task[];
  objectives: DailyObjective[];
}

const LinkedItemsModal: FC<LinkedItemsModalProps> = ({ isOpen, onOpenChange, chapter, tasks, objectives }) => {
  if (!chapter) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Éléments Liés à "{chapter.name}"</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
          <div>
            <h3 className="text-md font-semibold mb-2">Tâches ({tasks.length})</h3>
            {tasks.length > 0 ? (
              <ul className="space-y-1 text-sm list-disc pl-5">
                {tasks.map(task => <li key={task.id} className={cn(task.completed && "line-through text-muted-foreground")}>{task.text}</li>)}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Aucune tâche liée.</p>}
          </div>
          <div>
            <h3 className="text-md font-semibold mb-2">Objectifs du Jour ({objectives.length})</h3>
             {objectives.length > 0 ? (
              <ul className="space-y-1 text-sm list-disc pl-5">
                {objectives.map(obj => <li key={obj.id} className={cn(obj.completed && "line-through text-muted-foreground")}>{obj.text} (pour le {format(new Date(obj.objective_date), 'dd/MM/yy')})</li>)}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Aucun objectif lié.</p>}
          </div>
          {/* Ici, on pourrait ajouter les notes du vide-cerveau ou sources par tags si implémenté */}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Fermer</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


export default function ManageThesisPlanPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [isLinkedItemsModalOpen, setIsLinkedItemsModalOpen] = useState(false); // Nouvel état

  const [currentChapter, setCurrentChapter] = useState<Partial<Chapter> | null>(null);
  const [chapterForComment, setChapterForComment] = useState<Chapter | null>(null);
  const [chapterForLinkedItems, setChapterForLinkedItems] = useState<Chapter | null>(null); // Nouvel état
  const [linkedTasks, setLinkedTasks] = useState<Task[]>([]);
  const [linkedObjectives, setLinkedObjectives] = useState<DailyObjective[]>([]);

  const [newCommentText, setNewCommentText] = useState('');
  const [isFormLoading, setIsFormLoading] = useState(false); 
  const [isFetchingChapters, setIsFetchingChapters] = useState(true);
  const [isLoadingChapterActionsForId, setIsLoadingChapterActionsForId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchChapters = useCallback(async () => {
    setIsFetchingChapters(true); setError(null);
    try {
      const { data, error: dbError } = await supabase.from('chapters').select('*').order('name', { ascending: true });
      if (dbError) throw dbError;
      setChapters(data || []);
    } catch (e: any) { /* ... (gestion erreur existante) ... */ } 
    finally { setIsFetchingChapters(false); }
  }, [toast]);

  useEffect(() => { /* ... (useEffect pour fetchChapters et subscription existant) ... */ 
     fetchChapters();
    const channel = supabase
      .channel('db-chapters-manage-plan-page-v3-integrated')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chapters' }, (_payload) => fetchChapters())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchChapters]);


  const fetchLinkedItems = useCallback(async (chapterId: string) => {
    if (!chapterId) return;
    try {
      const [tasksRes, objectivesRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('chapter_id', chapterId),
        supabase.from('daily_objectives').select('*').eq('chapter_id', chapterId)
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (objectivesRes.error) throw objectivesRes.error;
      setLinkedTasks(tasksRes.data || []);
      setLinkedObjectives(objectivesRes.data || []);
    } catch (e: any) {
      toast({ title: "Erreur", description: "Impossible de charger les éléments liés.", variant: "destructive" });
      console.error("Erreur fetchLinkedItems:", e);
    }
  }, [toast]);

  const openModalForNew = () => { setCurrentChapter({ name: '', progress: 0, status: 'Non commencé', supervisor_comments: [] }); setIsEditModalOpen(true); };
  const openModalForEdit = (chapter: Chapter) => { setCurrentChapter(JSON.parse(JSON.stringify(chapter))); setIsEditModalOpen(true); };
  const openCommentManager = (chapter: Chapter) => { setChapterForComment(JSON.parse(JSON.stringify(chapter))); setNewCommentText(''); setIsCommentModalOpen(true); };
  
  const openLinkedItemsManager = (chapter: Chapter) => {
    setChapterForLinkedItems(chapter);
    fetchLinkedItems(chapter.id); // Charger les données
    setIsLinkedItemsModalOpen(true);
  };

  const handleSaveChapter = async () => {
    if (!currentChapter || !currentChapter.name?.trim()) { /* ... validation ... */ return; }
    setIsFormLoading(true);
    try {
      const chapterPayload = { name: currentChapter.name.trim(), progress: currentChapter.progress === undefined ? 0 : Number(currentChapter.progress), status: currentChapter.status?.trim() || 'Non commencé', supervisor_comments: currentChapter.supervisor_comments || [] };
      let savedChapter: Chapter | null = null;
      if (currentChapter.id) {
        const { data: updatedChapterFromDb, error } = await supabase.from('chapters').update(chapterPayload).eq('id', currentChapter.id).select().single();
        if (error) throw error;
        savedChapter = updatedChapterFromDb;
        if (savedChapter) setChapters(prev => prev.map(ch => ch.id === savedChapter!.id ? savedChapter! : ch));
        toast({ title: "Chapitre modifié" });
      } else {
        const { data: newChapterFromDb, error } = await supabase.from('chapters').insert(chapterPayload).select().single();
        if (error) throw error;
        savedChapter = newChapterFromDb;
        if (savedChapter) setChapters(prev => [...prev, savedChapter!].sort((a, b) => a.name.localeCompare(b.name)));
        toast({ title: "Chapitre ajouté" });
      }
      setIsEditModalOpen(false); setCurrentChapter(null);
    } catch (e: any) { /* ... (gestion erreur existante) ... */ } 
    finally { setIsFormLoading(false); }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    setIsLoadingChapterActionsForId(chapterId);
    try {
      // Avant de supprimer le chapitre, mettre à jour chapter_id à NULL pour les tâches et objectifs liés
      await supabase.from('tasks').update({ chapter_id: null }).eq('chapter_id', chapterId);
      await supabase.from('daily_objectives').update({ chapter_id: null }).eq('chapter_id', chapterId);
      // Puis supprimer le chapitre
      const { error } = await supabase.from('chapters').delete().eq('id', chapterId);
      if (error) throw error;
      setChapters(prev => prev.filter(ch => ch.id !== chapterId));
      toast({ title: "Chapitre supprimé" });
    } catch (e: any) { /* ... (gestion erreur existante) ... */ } 
    finally { setIsLoadingChapterActionsForId(null); }
  };

  const handleSaveComment = async () => {
    if (!chapterForComment || !newCommentText.trim()) return;
    setIsLoadingChapterActionsForId(chapterForComment.id);
    try {
      const updatedComments = [...(chapterForComment.supervisor_comments || []), newCommentText.trim()];
      const { data: updatedChapterFromDb, error } = await supabase.from('chapters').update({ supervisor_comments: updatedComments }).eq('id', chapterForComment.id).select().single();
      if (error) throw error;
      if (updatedChapterFromDb) {
        setChapters(prev => prev.map(ch => ch.id === updatedChapterFromDb!.id ? updatedChapterFromDb! : ch));
        setChapterForComment(updatedChapterFromDb); 
      }
      toast({ title: "Commentaire ajouté" }); setNewCommentText('');
    } catch (e: any) { /* ... (gestion erreur existante) ... */ } 
    finally { setIsLoadingChapterActionsForId(null); }
  };

  const handleDeleteComment = async (commentIndex: number) => {
    if (!chapterForComment || !chapterForComment.supervisor_comments) return;
    setIsLoadingChapterActionsForId(chapterForComment.id);
    try {
      const updatedComments = chapterForComment.supervisor_comments.filter((_, index) => index !== commentIndex);
      const { data: updatedChapterFromDb, error } = await supabase.from('chapters').update({ supervisor_comments: updatedComments }).eq('id', chapterForComment.id).select().single();
      if (error) throw error;
      if (updatedChapterFromDb) {
         setChapters(prev => prev.map(ch => ch.id === updatedChapterFromDb!.id ? updatedChapterFromDb! : ch));
         setChapterForComment(updatedChapterFromDb); 
      }
      toast({ title: "Commentaire supprimé" });
    } catch (e: any) { /* ... (gestion erreur existante) ... */ } 
    finally { setIsLoadingChapterActionsForId(null); }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3"><ListTree className="h-7 w-7 text-primary" /><h1 className="text-xl md:text-2xl font-semibold tracking-tight">Gestion du Plan de Thèse</h1></div>
        <Button onClick={openModalForNew} disabled={isFetchingChapters || isFormLoading}><PlusCircle className="mr-2 h-4 w-4" /> Ajouter un Chapitre</Button>
      </div>

      {isFetchingChapters ? ( <Card className="flex-grow flex flex-col items-center justify-center text-center p-6"><Loader2 className="h-10 w-10 animate-spin text-primary mb-4" /><p className="text-muted-foreground">Chargement des chapitres...</p></Card>
      ) : error ? ( <Card className="flex-grow flex flex-col items-center justify-center text-center p-6 border-destructive bg-destructive/10"><AlertTriangle className="h-10 w-10 text-destructive mb-4" /><p className="font-semibold text-destructive">Erreur de chargement</p><p className="text-sm text-destructive/80 mt-1 mb-3 max-w-md mx-auto">{error}</p><Button onClick={fetchChapters} variant="destructive" className="mt-4">Réessayer</Button></Card>
      ) : chapters.length === 0 ? ( <Card className="flex-grow flex flex-col items-center justify-center text-center p-6 border-dashed bg-muted/20"><CardHeader className="items-center"><FolderOpen className="h-16 w-16 text-muted-foreground/50 mb-4" /><CardTitle className="text-xl">Commencez à structurer votre thèse !</CardTitle></CardHeader><CardContent><p className="text-muted-foreground mb-4 max-w-md mx-auto text-sm">Aucun chapitre défini. Ajoutez les sections principales de votre travail.</p><Button onClick={openModalForNew} disabled={isFormLoading} size="lg"><PlusCircle className="mr-2 h-5 w-5" /> Créer le premier chapitre</Button></CardContent></Card>
      ) : (
        <div className="flex-grow grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-start overflow-y-auto custom-scrollbar pr-1 pb-4">
          {chapters.map((chapter) => (
            <ChapterCardItem key={chapter.id} chapter={chapter} onEditRequest={openModalForEdit} onDeleteRequest={handleDeleteChapter} onCommentManagerRequest={openCommentManager} isLoadingActionsForId={isLoadingChapterActionsForId} onViewLinkedItemsRequest={openLinkedItemsManager} />
          ))}
        </div>
      )}

      <Dialog open={isEditModalOpen} onOpenChange={(open) => { if (!isFormLoading) setIsEditModalOpen(open); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{currentChapter?.id ? 'Modifier le Chapitre' : 'Ajouter un Nouveau Chapitre'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label htmlFor="chapterName" className="mb-1.5 block">Nom du Chapitre</Label><Input id="chapterName" value={currentChapter?.name || ''} onChange={(e) => setCurrentChapter(prev => prev ? ({ ...prev, name: e.target.value }) : null)} placeholder="ex : Introduction..." disabled={isFormLoading} className="text-sm" /></div>
            <div><Label htmlFor="chapterProgress" className="mb-1.5 block">Progression (%)</Label><Input id="chapterProgress" type="number" min="0" max="100" value={currentChapter?.progress === undefined ? '' : currentChapter.progress} onChange={(e) => setCurrentChapter(prev => prev ? ({ ...prev, progress: e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0 }) : null)} disabled={isFormLoading} className="text-sm" /></div>
            <div><Label htmlFor="chapterStatus" className="mb-1.5 block">Statut</Label><Input id="chapterStatus" value={currentChapter?.status || ''} onChange={(e) => setCurrentChapter(prev => prev ? ({ ...prev, status: e.target.value }) : null)} placeholder="ex : Non commencé..." disabled={isFormLoading} className="text-sm" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => { if (!isFormLoading) setIsEditModalOpen(false); }} disabled={isFormLoading}>Annuler</Button><Button onClick={handleSaveChapter} disabled={isFormLoading || !currentChapter?.name?.trim()}>{isFormLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} {isFormLoading ? 'Enregistrement...' : (currentChapter?.id ? 'Mettre à Jour' : 'Ajouter')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCommentModalOpen} onOpenChange={(open) => {if (isLoadingChapterActionsForId !== chapterForComment?.id) setIsCommentModalOpen(open); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Commentaires pour "{chapterForComment?.name}"</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="max-h-[40vh] overflow-y-auto custom-scrollbar pr-2 space-y-2">
              {chapterForComment?.supervisor_comments && chapterForComment.supervisor_comments.length > 0 ? (
                chapterForComment.supervisor_comments.map((comment, index) => (
                  <div key={index} className="p-2.5 border rounded-md bg-muted/50 flex justify-between items-start gap-2 text-sm">
                    <p className="whitespace-pre-wrap flex-grow leading-relaxed">{comment}</p>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDeleteComment(index)} disabled={isLoadingChapterActionsForId === chapterForComment?.id} title="Supprimer"><Trash2 className="h-3.5 w-3.5 text-destructive/70 hover:text-destructive" /></Button>
                  </div>
                ))
              ) : <p className="text-sm text-muted-foreground text-center py-4">Aucun commentaire.</p>}
            </div>
            <div className="pt-4 border-t"><Label htmlFor="newComment" className="block mb-1.5 text-sm font-medium">Ajouter un commentaire</Label><Textarea id="newComment" value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} placeholder="Écrivez votre commentaire..." rows={3} disabled={isLoadingChapterActionsForId === chapterForComment?.id} className="text-sm" /></div>
          </div>
          <DialogFooter><DialogClose asChild><Button variant="outline" disabled={isLoadingChapterActionsForId === chapterForComment?.id}>Fermer</Button></DialogClose><Button onClick={handleSaveComment} disabled={isLoadingChapterActionsForId === chapterForComment?.id || !newCommentText.trim()}>{isLoadingChapterActionsForId === chapterForComment?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      
      <LinkedItemsModal 
        isOpen={isLinkedItemsModalOpen} 
        onOpenChange={setIsLinkedItemsModalOpen}
        chapter={chapterForLinkedItems}
        tasks={linkedTasks}
        objectives={linkedObjectives}
      />
    </div>
  );
}

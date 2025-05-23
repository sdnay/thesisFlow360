"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { Chapter, DailyObjective, Task, BrainDumpEntry, PomodoroSession } from '@/types';
import { PlusCircle, Edit3, Trash2, MessageSquare, Loader2, ListChecks, CheckCircle, Notebook, TimerIcon } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ChapterProgressCardProps {
  chapter: Chapter;
  onEdit: (chapter: Chapter) => void;
  onDelete: (chapterId: string) => void;
  onAddComment: (chapterId: string, comment: string) => Promise<void>;
  isLoadingCardActions: boolean;
}

const ChapterProgressCard: FC<ChapterProgressCardProps> = ({ chapter, onEdit, onDelete, onAddComment, isLoadingCardActions }) => {
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
            <Button variant="ghost" size="icon" onClick={() => onEdit(chapter)} aria-label="Modifier le chapitre" disabled={isLoadingCardActions}>
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(chapter.id)} aria-label="Supprimer le chapitre" className="text-destructive hover:text-destructive/80" disabled={isLoadingCardActions}>
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
              disabled={isAddingComment || isLoadingCardActions}
            />
            <Button onClick={handleAddCommentInternal} size="sm" disabled={isAddingComment || !comment.trim() || isLoadingCardActions}>
              {isAddingComment ? <Loader2 className="mr-2 h-3 w-3 animate-spin"/> : null}
              Ajouter
            </Button>
            <Button onClick={() => setShowCommentInput(false)} size="sm" variant="outline" disabled={isAddingComment || isLoadingCardActions}>Annuler</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowCommentInput(true)} disabled={isLoadingCardActions}>
            <MessageSquare className="mr-2 h-3 w-3" /> Ajouter un commentaire
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};


export function ThesisDashboardSection() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [dailyObjectives, setDailyObjectives] = useState<DailyObjective[]>([]);
  const [tasksSummary, setTasksSummary] = useState<{ total: number, pending: number, completed: number }>({ total: 0, pending: 0, completed: 0 });
  const [recentBrainDumps, setRecentBrainDumps] = useState<BrainDumpEntry[]>([]);
  const [recentPomodoros, setRecentPomodoros] = useState<PomodoroSession[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentChapter, setCurrentChapter] = useState<Partial<Chapter> | null>(null);
  
  const [isLoadingChapters, setIsLoadingChapters] = useState(true);
  const [isLoadingObjectives, setIsLoadingObjectives] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingBrainDumps, setIsLoadingBrainDumps] = useState(true);
  const [isLoadingPomodoros, setIsLoadingPomodoros] = useState(true);
  const [isSavingChapter, setIsSavingChapter] = useState(false);
  const [isLoadingCardActions, setIsLoadingCardActions] = useState(false);

  const { toast } = useToast();

  const fetchChapters = useCallback(async () => {
    setIsLoadingChapters(true);
    try {
      const { data, error } = await supabase.from('chapters').select('*').order('name');
      if (error) throw error;
      setChapters(data || []);
    } catch (e: any) {
      toast({ title: "Erreur Chapitres", description: "Impossible de charger les chapitres.", variant: "destructive" });
      console.error("Erreur fetchChapters:", e);
    } finally {
      setIsLoadingChapters(false);
    }
  }, [toast]);

  const fetchDailyObjectives = useCallback(async () => {
    setIsLoadingObjectives(true);
    try {
      const { data, error } = await supabase.from('daily_objectives').select('*').eq('completed', false).limit(3);
      if (error) throw error;
      setDailyObjectives(data || []);
    } catch (e: any) {
      toast({ title: "Erreur Objectifs", description: "Impossible de charger les objectifs du jour.", variant: "destructive" });
      console.error("Erreur fetchDailyObjectives:", e);
    } finally {
      setIsLoadingObjectives(false);
    }
  }, [toast]);

  const fetchTasksSummary = useCallback(async () => {
    setIsLoadingTasks(true);
    try {
      const { data, error, count } = await supabase.from('tasks').select('*', { count: 'exact' });
      if (error) throw error;
      const pending = data?.filter(t => !t.completed).length || 0;
      const completed = data?.filter(t => t.completed).length || 0;
      setTasksSummary({ total: count || 0, pending, completed });
    } catch (e: any) {
      toast({ title: "Erreur Tâches", description: "Impossible de charger le résumé des tâches.", variant: "destructive" });
      console.error("Erreur fetchTasksSummary:", e);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [toast]);

  const fetchRecentBrainDumps = useCallback(async () => {
    setIsLoadingBrainDumps(true);
    try {
      const { data, error } = await supabase
        .from('brain_dump_entries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      setRecentBrainDumps(data || []);
    } catch (e: any) {
      toast({ title: "Erreur Vide-Cerveau", description: "Impossible de charger les notes récentes.", variant: "destructive" });
      console.error("Erreur fetchRecentBrainDumps:", e);
    } finally {
      setIsLoadingBrainDumps(false);
    }
  }, [toast]);

  const fetchRecentPomodoros = useCallback(async () => {
    setIsLoadingPomodoros(true);
    try {
      const { data, error } = await supabase
        .from('pomodoro_sessions')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(3);
      if (error) throw error;
      setRecentPomodoros(data || []);
    } catch (e: any) {
      toast({ title: "Erreur Pomodoro", description: "Impossible de charger les sessions récentes.", variant: "destructive" });
      console.error("Erreur fetchRecentPomodoros:", e);
    } finally {
      setIsLoadingPomodoros(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchChapters();
    fetchDailyObjectives();
    fetchTasksSummary();
    fetchRecentBrainDumps();
    fetchRecentPomodoros();
  }, [fetchChapters, fetchDailyObjectives, fetchTasksSummary, fetchRecentBrainDumps, fetchRecentPomodoros]);

  const openModalForNewChapter = () => {
    setCurrentChapter({ name: '', progress: 0, status: 'Non commencé', supervisor_comments: [] });
    setIsModalOpen(true);
  };

  const openModalForEditChapter = (chapter: Chapter) => {
    setCurrentChapter(JSON.parse(JSON.stringify(chapter)));
    setIsModalOpen(true);
  };

  const handleSaveChapter = async () => {
    if (!currentChapter || !currentChapter.name?.trim()) {
        toast({title: "Erreur de validation", description: "Le nom du chapitre est requis.", variant: "destructive"});
        return;
    }
    setIsSavingChapter(true);
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
    } catch (e: any) {
      toast({ title: "Erreur d'enregistrement", description: (e as Error).message || "Impossible d'enregistrer le chapitre.", variant: "destructive" });
      console.error("Erreur handleSaveChapter:", e);
    } finally {
      setIsSavingChapter(false);
    }
  };
  
  const handleDeleteChapter = async (chapterId: string) => {
    setIsLoadingCardActions(true);
    try {
      const { error } = await supabase.from('chapters').delete().eq('id', chapterId);
      if (error) throw error;
      toast({ title: "Chapitre supprimé" });
      await fetchChapters();
    } catch (e: any) {
      toast({ title: "Erreur de suppression", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleDeleteChapter:", e);
    } finally {
      setIsLoadingCardActions(false);
    }
  };

  const handleAddCommentToChapter = async (chapterId: string, comment: string) => {
    setIsLoadingCardActions(true);
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
      toast({ title: "Erreur d'ajout de commentaire", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleAddCommentToChapter:", e);
    } finally {
      setIsLoadingCardActions(false);
    }
  };

  const isLoadingAny = isLoadingChapters || isLoadingObjectives || isLoadingTasks || isLoadingBrainDumps || isLoadingPomodoros;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Aperçu Général du Projet de Thèse</h2>
        <Button onClick={openModalForNewChapter} disabled={isLoadingAny || isSavingChapter}>
          <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un Chapitre
        </Button>
      </div>

      {isLoadingAny && !chapters.length && !dailyObjectives.length ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2">Chargement du tableau de bord...</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Chapters Section */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Progression des Chapitres</CardTitle>
              <CardDescription>Vue d'ensemble de l'avancement de votre thèse.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingChapters ? (
                <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : chapters.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Aucun chapitre défini. <Link href="/add-chapter" className="text-primary hover:underline">Gérez votre plan de thèse ici.</Link></p>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {chapters.map((chapter) => (
                    <ChapterProgressCard 
                      key={chapter.id} 
                      chapter={chapter} 
                      onEdit={openModalForEditChapter}
                      onDelete={handleDeleteChapter}
                      onAddComment={handleAddCommentToChapter}
                      isLoadingCardActions={isLoadingCardActions}
                    />
                  ))}
                </div>
              )}
            </CardContent>
             <CardFooter>
                <Button asChild variant="outline" size="sm">
                    <Link href="/add-chapter"><ListChecks className="mr-2 h-4 w-4" /> Gérer le Plan Détaillé</Link>
                </Button>
            </CardFooter>
          </Card>

          {/* Other Summaries Column */}
          <div className="space-y-6">
            {/* Daily Objectives Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Objectifs du Jour Actifs</CardTitle>
                 <CardDescription>Vos priorités pour aujourd'hui.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingObjectives ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : dailyObjectives.length === 0 ? (
                  <p className="text-muted-foreground text-center text-sm py-2">Aucun objectif actif pour aujourd'hui.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {dailyObjectives.map(obj => (
                      <li key={obj.id} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" /> {obj.text}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
              <CardFooter>
                <Button asChild variant="outline" size="sm">
                    <Link href="/daily-plan"><ListChecks className="mr-2 h-4 w-4" /> Voir le Plan du Jour</Link>
                </Button>
              </CardFooter>
            </Card>

            {/* Tasks Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Résumé des Tâches</CardTitle>
                 <CardDescription>Votre charge de travail actuelle.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTasks ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : (
                  <div className="space-y-1 text-sm">
                    <p>Total des tâches : <span className="font-semibold">{tasksSummary.total}</span></p>
                    <p>En attente : <span className="font-semibold text-orange-600">{tasksSummary.pending}</span></p>
                    <p>Terminées : <span className="font-semibold text-green-600">{tasksSummary.completed}</span></p>
                  </div>
                )}
              </CardContent>
               <CardFooter>
                <Button asChild variant="outline" size="sm">
                    <Link href="/tasks"><ListChecks className="mr-2 h-4 w-4" /> Gérer les Tâches</Link>
                </Button>
              </CardFooter>
            </Card>

            {/* Recent Brain Dumps */}
            <Card>
              <CardHeader>
                <CardTitle>Notes Récentes (Vide-Cerveau)</CardTitle>
                 <CardDescription>Vos dernières idées et pensées.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingBrainDumps ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : recentBrainDumps.length === 0 ? (
                  <p className="text-muted-foreground text-center text-sm py-2">Aucune note récente.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {recentBrainDumps.map(dump => (
                      <li key={dump.id} className="truncate p-2 border rounded-md bg-muted/30">
                        {dump.text} <span className="text-xs text-muted-foreground ml-1">({dump.status})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
              <CardFooter>
                <Button asChild variant="outline" size="sm">
                    <Link href="/brain-dump"><Notebook className="mr-2 h-4 w-4" /> Aller au Vide-Cerveau</Link>
                </Button>
              </CardFooter>
            </Card>

            {/* Recent Pomodoro Sessions */}
            <Card>
              <CardHeader>
                <CardTitle>Sessions Pomodoro Récentes</CardTitle>
                <CardDescription>Votre historique de travail focus.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPomodoros ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : recentPomodoros.length === 0 ? (
                  <p className="text-muted-foreground text-center text-sm py-2">Aucune session récente.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {recentPomodoros.map(pomo => (
                       <li key={pomo.id} className="p-2 border rounded-md bg-muted/30">
                        <p>{pomo.duration} min - {format(new Date(pomo.start_time), "d MMM, HH:mm", { locale: fr })}</p>
                        {pomo.notes && <p className="text-xs text-muted-foreground truncate">Notes: {pomo.notes}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
              <CardFooter>
                <Button asChild variant="outline" size="sm">
                    <Link href="/pomodoro"><TimerIcon className="mr-2 h-4 w-4" /> Aller au Minuteur Pomodoro</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={(open) => {if (!isSavingChapter) setIsModalOpen(open)}}>
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
                disabled={isSavingChapter}
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
                disabled={isSavingChapter}
              />
            </div>
            <div>
              <label htmlFor="chapterStatus" className="block text-sm font-medium mb-1">Statut</label>
              <Input
                id="chapterStatus"
                value={currentChapter?.status || ''}
                onChange={(e) => setCurrentChapter(prev => ({ ...prev, status: e.target.value }))}
                placeholder="ex : En cours"
                disabled={isSavingChapter}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {if(!isSavingChapter) setIsModalOpen(false)}} disabled={isSavingChapter}>Annuler</Button>
            <Button onClick={handleSaveChapter} disabled={isSavingChapter || !currentChapter?.name?.trim()}>
              {isSavingChapter ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSavingChapter ? 'Enregistrement...' : (currentChapter?.id ? 'Mettre à Jour' : 'Ajouter le Chapitre')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
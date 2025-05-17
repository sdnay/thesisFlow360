
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { Chapter, DailyObjective, Task, BrainDumpEntry, PomodoroSession, TaskType } from '@/types';
import { PlusCircle, Edit3, Trash2, MessageSquare, Loader2, ListChecks, CheckCircle, Notebook, TimerIcon, TrendingUp, Target as TargetIcon, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const taskTypeLabels: Record<TaskType, string> = {
  urgent: "Urgent",
  important: "Important",
  reading: "Lecture",
  chatgpt: "ChatGPT",
  secondary: "Secondaire",
};

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
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [recentBrainDumps, setRecentBrainDumps] = useState<BrainDumpEntry[]>([]);
  const [recentPomodoros, setRecentPomodoros] = useState<PomodoroSession[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentChapter, setCurrentChapter] = useState<Partial<Chapter> | null>(null);

  const [isLoadingChapters, setIsLoadingChapters] = useState(true);
  const [isLoadingObjectives, setIsLoadingObjectives] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingBrainDumps, setIsLoadingBrainDumps] = useState(true);
  const [isLoadingPomodoros, setIsLoadingPomodoros] = useState(true);
  const [isSavingChapter, setIsSavingChapter] = useState(false);
  const [isLoadingCardActions, setIsLoadingCardActions] = useState(false);
  const [isLoadingObjectiveToggle, setIsLoadingObjectiveToggle] = useState<string | null>(null);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);

  const { toast } = useToast();

  const fetchAllData = useCallback(async () => {
    setIsLoadingChapters(true);
    setIsLoadingObjectives(true);
    setIsLoadingTasks(true);
    setIsLoadingBrainDumps(true);
    setIsLoadingPomodoros(true);
    setErrorLoading(null);

    try {
      const [
        chaptersRes,
        objectivesRes,
        tasksRes,
        brainDumpsRes,
        pomodorosRes,
      ] = await Promise.all([
        supabase.from('chapters').select('*').order('name'),
        supabase.from('daily_objectives').select('*').order('created_at'),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('brain_dump_entries').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('pomodoro_sessions').select('*').order('start_time', { ascending: false }).limit(5),
      ]);

      if (chaptersRes.error) throw new Error(`Chapitres: ${chaptersRes.error.message}`);
      setChapters(chaptersRes.data || []);
      if (chaptersRes.data && chaptersRes.data.length > 0) {
        const totalProgress = chaptersRes.data.reduce((sum, chapter) => sum + chapter.progress, 0);
        setOverallProgress(Math.round(totalProgress / chaptersRes.data.length));
      } else {
        setOverallProgress(0);
      }
      setIsLoadingChapters(false);

      if (objectivesRes.error) throw new Error(`Objectifs: ${objectivesRes.error.message}`);
      setDailyObjectives(objectivesRes.data || []);
      setIsLoadingObjectives(false);

      if (tasksRes.error) throw new Error(`Tâches: ${tasksRes.error.message}`);
      setAllTasks(tasksRes.data || []);
      setIsLoadingTasks(false);

      if (brainDumpsRes.error) throw new Error(`Vide-cerveau: ${brainDumpsRes.error.message}`);
      setRecentBrainDumps(brainDumpsRes.data || []);
      setIsLoadingBrainDumps(false);

      if (pomodorosRes.error) throw new Error(`Pomodoros: ${pomodorosRes.error.message}`);
      setRecentPomodoros(pomodorosRes.data || []);
      setIsLoadingPomodoros(false);

    } catch (e: any) {
      console.error("Erreur fetchAllData:", e);
      setErrorLoading(e.message || "Une erreur est survenue lors du chargement des données du tableau de bord.");
      toast({ title: "Erreur de chargement", description: e.message, variant: "destructive" });
      // Set all loading states to false on error
      setIsLoadingChapters(false);
      setIsLoadingObjectives(false);
      setIsLoadingTasks(false);
      setIsLoadingBrainDumps(false);
      setIsLoadingPomodoros(false);
    }
  }, [toast]);


  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);


  const handleToggleObjective = async (id: string, completed: boolean) => {
    setIsLoadingObjectiveToggle(id);
    try {
      const { error } = await supabase
        .from('daily_objectives')
        .update({ completed })
        .eq('id', id);
      if (error) throw error;
      setDailyObjectives(prev => prev.map(obj => obj.id === id ? {...obj, completed} : obj));
      // toast({ title: "Objectif mis à jour" }); // Peut-être trop verbeux pour le dashboard
    } catch (e: any) {
      toast({ title: "Erreur de mise à jour", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleToggleObjective:", e);
    } finally {
       setIsLoadingObjectiveToggle(null);
    }
  };

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
      await fetchAllData(); // Refresh all dashboard data
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
      await fetchAllData(); // Refresh all dashboard data
    } catch (e: any)      {
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
      await fetchAllData(); // Refresh all dashboard data
    } catch (e: any) {
      toast({ title: "Erreur d'ajout de commentaire", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleAddCommentToChapter:", e);
    } finally {
      setIsLoadingCardActions(false);
    }
  };

  const isLoadingAnyData = isLoadingChapters || isLoadingObjectives || isLoadingTasks || isLoadingBrainDumps || isLoadingPomodoros;

  const objectivesCompletedCount = dailyObjectives.filter(obj => obj.completed).length;
  const objectivesTotalCount = dailyObjectives.length;
  const objectivesCompletionPercentage = objectivesTotalCount > 0 ? Math.round((objectivesCompletedCount / objectivesTotalCount) * 100) : 0;

  const tasksPending = allTasks.filter(t => !t.completed);
  const tasksCompletedCount = allTasks.length - tasksPending.length;
  const tasksPendingByType = tasksPending.reduce((acc, task) => {
    acc[task.type] = (acc[task.type] || 0) + 1;
    return acc;
  }, {} as Record<TaskType, number>);

  const brainDumpsToProcessCount = recentBrainDumps.filter(d => d.status === 'captured').length;
  const pomodoroTotalMinutesRecent = recentPomodoros.reduce((sum, pomo) => sum + pomo.duration, 0);


  if (errorLoading) {
    return (
      <div className="p-4 md:p-6 flex flex-col items-center justify-center h-full text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">Erreur de Chargement du Tableau de Bord</h2>
        <p className="text-muted-foreground mb-4">{errorLoading}</p>
        <Button onClick={fetchAllData} disabled={isLoadingAnyData}>
          {isLoadingAnyData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Réessayer de charger
        </Button>
      </div>
    );
  }
  
  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6"> {/* Ajout de h-full overflow-y-auto ici */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Aperçu Général du Projet de Thèse</h1>
        <Button onClick={openModalForNewChapter} disabled={isLoadingAnyData || isSavingChapter}>
          <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un Chapitre
        </Button>
      </div>

      {isLoadingAnyData && !chapters.length && !dailyObjectives.length && !allTasks.length? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2">Chargement du tableau de bord...</p>
        </div>
      ) : (
        <>
          <Card className="shadow-lg border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center text-primary">
                <TrendingUp className="mr-2 h-6 w-6" />
                Progression Globale de la Thèse
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingChapters ? (
                <div className="flex justify-center py-2"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <>
                  <Progress value={overallProgress} className="w-full h-4 mb-2" />
                  <p className="text-center text-xl font-semibold">{overallProgress}%</p>
                  <p className="text-center text-xs text-muted-foreground">{chapters.length} chapitre(s) suivi(s)</p>
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chapters Section - Prend plus de place */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
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
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2"> {/* Scroll interne pour les chapitres si la liste est longue */}
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
            </div>

            {/* KPIs Column - Prend le reste de l'espace */}
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><TargetIcon className="mr-2 h-5 w-5 text-green-600" />Objectifs du Jour</CardTitle>
                   <CardDescription>
                     {isLoadingObjectives ? <Loader2 className="h-4 w-4 animate-spin" /> : 
                      `${objectivesCompletedCount} / ${objectivesTotalCount} complété(s) (${objectivesCompletionPercentage}%)`}
                   </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingObjectives ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : dailyObjectives.length === 0 ? (
                    <p className="text-muted-foreground text-center text-sm py-2">Aucun objectif défini pour aujourd'hui.</p>
                  ) : (
                    <ul className="space-y-2 text-sm max-h-48 overflow-y-auto"> {/* Scroll interne pour les objectifs */}
                      {dailyObjectives.map(obj => (
                        <li key={obj.id} className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted/30">
                          <Checkbox
                            id={`dash-obj-${obj.id}`}
                            checked={obj.completed}
                            onCheckedChange={(checked) => handleToggleObjective(obj.id, !!checked)}
                            disabled={isLoadingObjectiveToggle === obj.id}
                            aria-label={obj.completed ? "Marquer comme non terminé" : "Marquer comme terminé"}
                          />
                          <label
                            htmlFor={`dash-obj-${obj.id}`}
                            className={cn(
                              "flex-grow cursor-pointer",
                              obj.completed && "line-through text-muted-foreground"
                            )}
                          >
                            {obj.text}
                          </label>
                          {isLoadingObjectiveToggle === obj.id && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
                <CardFooter>
                  <Button asChild variant="outline" size="sm">
                      <Link href="/daily-plan"><ListChecks className="mr-2 h-4 w-4" /> Gérer le Plan du Jour</Link>
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Résumé des Tâches</CardTitle>
                   <CardDescription>
                     {isLoadingTasks ? <Loader2 className="h-4 w-4 animate-spin" /> : 
                      `${allTasks.length} tâche(s) au total.`}
                   </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingTasks ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <p>En attente : <span className="font-semibold text-orange-600">{tasksPending.length}</span></p>
                      {tasksPending.length > 0 && (
                        <div className="pl-4 text-xs space-y-0.5 max-h-32 overflow-y-auto"> {/* Scroll interne pour les types de tâches */}
                          {Object.entries(taskTypeLabels).map(([type, label]) => {
                              const count = tasksPendingByType[type as TaskType] || 0;
                              if (count > 0) {
                                  return <p key={type}>{label}: <span className="font-medium">{count}</span></p>;
                              }
                              return null;
                          })}
                          {Object.keys(tasksPendingByType).length === 0 && <p className="text-muted-foreground">Aucune tâche en attente par type.</p>}
                        </div>
                      )}
                      <p>Terminées : <span className="font-semibold text-green-600">{tasksCompletedCount}</span></p>
                    </div>
                  )}
                </CardContent>
                 <CardFooter>
                  <Button asChild variant="outline" size="sm">
                      <Link href="/tasks"><ListChecks className="mr-2 h-4 w-4" /> Gérer les Tâches</Link>
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Vide-Cerveau</CardTitle>
                   <CardDescription>
                     {isLoadingBrainDumps ? <Loader2 className="h-4 w-4 animate-spin" /> : 
                      `${brainDumpsToProcessCount} note(s) "capturée(s)" à traiter.`}
                   </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingBrainDumps ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : recentBrainDumps.length === 0 ? (
                    <p className="text-muted-foreground text-center text-sm py-2">Aucune note récente.</p>
                  ) : (
                    <ul className="space-y-2 text-sm  max-h-40 overflow-y-auto"> {/* Scroll interne pour les notes */}
                      {recentBrainDumps.slice(0,3).map(dump => ( 
                        <li key={dump.id} className="truncate p-2 border rounded-md bg-muted/30">
                          {dump.text} <Badge variant={dump.status === 'captured' ? 'destructive' : 'secondary'} className="ml-1 text-xs">{dump.status}</Badge>
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

              <Card>
                <CardHeader>
                  <CardTitle>Sessions Pomodoro</CardTitle>
                  <CardDescription>
                    {isLoadingPomodoros ? <Loader2 className="h-4 w-4 animate-spin" /> : 
                     `${recentPomodoros.length} sessions récentes (${pomodoroTotalMinutesRecent} min).`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingPomodoros ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : recentPomodoros.length === 0 ? (
                    <p className="text-muted-foreground text-center text-sm py-2">Aucune session récente.</p>
                  ) : (
                    <ul className="space-y-2 text-sm max-h-40 overflow-y-auto"> {/* Scroll interne pour les pomodoros */}
                      {recentPomodoros.slice(0,3).map(pomo => ( 
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
        </>
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

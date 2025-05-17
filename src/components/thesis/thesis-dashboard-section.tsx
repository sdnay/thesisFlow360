
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import * as DialogComponents from '@/components/ui/dialog';
import type { Chapter, DailyObjective, Task, BrainDumpEntry, PomodoroSession, TaskType } from '@/types';
import { PlusCircle, Edit3, Eye, Loader2, ListChecks, CheckCircle, Notebook, TimerIcon, TrendingUp, Target as TargetIcon, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { format } from 'date-fns';
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

const taskTypeColorsShort: Record<TaskType, string> = {
  urgent: "bg-red-500",
  important: "bg-orange-500",
  reading: "bg-green-500",
  chatgpt: "bg-blue-500",
  secondary: "bg-gray-500",
};


interface ChapterProgressCardProps {
  chapter: Chapter;
  onEditModalOpen: (chapter: Chapter) => void;
}

const ChapterProgressCard: FC<ChapterProgressCardProps> = ({ chapter, onEditModalOpen }) => {
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col bg-card">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-base md:text-lg">{chapter.name}</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => onEditModalOpen(chapter)} aria-label="Modifier le chapitre" className="h-7 w-7 text-muted-foreground hover:text-primary">
            <Edit3 className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription className="text-xs">{chapter.status}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="mb-1 text-xs font-medium">Progression : {chapter.progress}%</div>
        <Progress value={chapter.progress} className="w-full h-2.5" />
        {chapter.supervisor_comments && chapter.supervisor_comments.length > 0 && (
          <div className="mt-3">
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Commentaires récents :</h4>
            <ul className="list-disc list-inside text-xs space-y-0.5 max-h-16 overflow-y-auto custom-scrollbar pr-1">
              {chapter.supervisor_comments.slice(-2).map((c, index) => ( 
                <li key={index} className="truncate" title={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-3 border-t">
        <Button asChild variant="outline" size="sm" className="w-full text-xs">
            <Link href="/add-chapter"><Eye className="mr-1.5 h-3.5 w-3.5" /> Voir/Gérer Plan Détaillé</Link>
        </Button>
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

  const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);
  const [currentChapterForModal, setCurrentChapterForModal] = useState<Partial<Chapter> | null>(null);

  const [isLoadingChapters, setIsLoadingChapters] = useState(true);
  const [isLoadingObjectives, setIsLoadingObjectives] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingBrainDumps, setIsLoadingBrainDumps] = useState(true);
  const [isLoadingPomodoros, setIsLoadingPomodoros] = useState(true);
  const [isSavingChapter, setIsSavingChapter] = useState(false);

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
        supabase.from('daily_objectives').select('*').order('text'), 
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('brain_dump_entries').select('*').order('created_at', { ascending: false }).limit(3),
        supabase.from('pomodoro_sessions').select('*').order('start_time', { ascending: false }).limit(3),
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
      setIsLoadingChapters(false);
      setIsLoadingObjectives(false);
      setIsLoadingTasks(false);
      setIsLoadingBrainDumps(false);
      setIsLoadingPomodoros(false);
    }
  }, [toast]);


  useEffect(() => {
    fetchAllData();
    const channel = supabase
      .channel('db-changes-dashboard-section')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chapters' }, fetchAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_objectives' }, fetchAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brain_dump_entries' }, fetchAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pomodoro_sessions' }, fetchAllData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAllData]);


  const handleToggleObjective = async (id: string, completed: boolean) => {
    setIsLoadingObjectiveToggle(id);
    try {
      const { error } = await supabase
        .from('daily_objectives')
        .update({ completed })
        .eq('id', id);
      if (error) throw error;
    } catch (e: any) {
      toast({ title: "Erreur de mise à jour", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleToggleObjective:", e);
    } finally {
       setIsLoadingObjectiveToggle(null);
    }
  };

  const openModalForNewChapter = () => {
    setCurrentChapterForModal({ name: '', progress: 0, status: 'Non commencé', supervisor_comments: [] });
    setIsChapterModalOpen(true);
  };

  const openModalForEditChapter = (chapter: Chapter) => {
    setCurrentChapterForModal(JSON.parse(JSON.stringify(chapter))); 
    setIsChapterModalOpen(true);
  };

  const handleSaveChapter = async () => {
    if (!currentChapterForModal || !currentChapterForModal.name?.trim()) {
        toast({title: "Erreur de validation", description: "Le nom du chapitre est requis.", variant: "destructive"});
        return;
    }
    setIsSavingChapter(true);
    try {
      const chapterPayload = {
        name: currentChapterForModal.name.trim(),
        progress: currentChapterForModal.progress || 0,
        status: currentChapterForModal.status?.trim() || 'Non commencé',
        supervisor_comments: currentChapterForModal.supervisor_comments || [],
      };

      if (currentChapterForModal.id) {
        const { error } = await supabase.from('chapters').update(chapterPayload).eq('id', currentChapterForModal.id);
        if (error) throw error;
        toast({ title: "Chapitre modifié", description: `"${chapterPayload.name}" a été mis à jour.` });
      } else {
        const { error } = await supabase.from('chapters').insert([chapterPayload]);
        if (error) throw error;
        toast({ title: "Chapitre ajouté", description: `"${chapterPayload.name}" a été ajouté.` });
      }
      setIsChapterModalOpen(false);
      setCurrentChapterForModal(null);
    } catch (e: any) {
      toast({ title: "Erreur d'enregistrement", description: (e as Error).message || "Impossible d'enregistrer le chapitre.", variant: "destructive" });
      console.error("Erreur handleSaveChapter:", e);
    } finally {
      setIsSavingChapter(false);
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
    <div className="p-3 md:p-4 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Tableau de Bord ThesisFlow</h1>
        <Button onClick={openModalForNewChapter} disabled={isLoadingAnyData || isSavingChapter} size="sm">
          <PlusCircle className="mr-2 h-4 w-4" /> Nouveau Chapitre
        </Button>
      </div>

      {isLoadingAnyData && !chapters.length && !dailyObjectives.length && !allTasks.length ? (
        <div className="flex justify-center items-center py-10 min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Chargement du tableau de bord...</p>
        </div>
      ) : (
        <>
          <Card className="shadow-lg border-primary/20 bg-gradient-to-br from-card to-muted/20">
            <CardHeader>
              <CardTitle className="flex items-center text-primary text-lg md:text-xl">
                <TrendingUp className="mr-2 h-5 w-5" />
                Progression Globale de la Thèse
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingChapters ? (
                <div className="flex justify-center py-2"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <>
                  <Progress value={overallProgress} className="w-full h-3 md:h-4 mb-2" />
                  <p className="text-center text-lg md:text-xl font-semibold">{overallProgress}%</p>
                  <p className="text-center text-xs text-muted-foreground">{chapters.length} chapitre(s) suivi(s)</p>
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="lg:col-span-2">
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base md:text-lg">Progression des Chapitres</CardTitle>
                  <CardDescription className="text-xs md:text-sm">Avancement détaillé de chaque section.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  {isLoadingChapters ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : chapters.length === 0 ? (
                    <div className="text-center py-6">
                        <p className="text-muted-foreground mb-3">Aucun chapitre défini.</p>
                        <Button asChild variant="default" size="sm">
                            <Link href="/add-chapter"><PlusCircle className="mr-2 h-4 w-4"/>Commencer le Plan</Link>
                        </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
                      {chapters.map((chapter) => (
                        <ChapterProgressCard
                          key={chapter.id}
                          chapter={chapter}
                          onEditModalOpen={openModalForEditChapter}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1 space-y-4 md:space-y-6">
              <Card>
                <CardHeader className="pb-3 pt-4">
                  <CardTitle className="flex items-center text-base md:text-lg"><TargetIcon className="mr-2 h-4 w-4 text-green-600" />Objectifs du Jour</CardTitle>
                   <CardDescription className="text-xs">
                     {isLoadingObjectives ? <Loader2 className="h-3 w-3 animate-spin inline-block mr-1" /> : null}
                      {objectivesCompletedCount} / {objectivesTotalCount} complété(s) ({objectivesCompletionPercentage}%)
                   </CardDescription>
                </CardHeader>
                <CardContent className="max-h-40 overflow-y-auto custom-scrollbar pr-1">
                  {isLoadingObjectives ? (
                    <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : dailyObjectives.length === 0 ? (
                    <p className="text-muted-foreground text-center text-xs py-2">Aucun objectif défini.</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs">
                      {dailyObjectives.map(obj => (
                        <li key={obj.id} className="flex items-center gap-2 p-1.5 border rounded-md hover:bg-muted/30 transition-colors bg-card">
                          <Checkbox
                            id={`dash-obj-${obj.id}`}
                            checked={obj.completed}
                            onCheckedChange={(checked) => handleToggleObjective(obj.id, !!checked)}
                            disabled={isLoadingObjectiveToggle === obj.id}
                            className="h-3.5 w-3.5"
                          />
                          <label
                            htmlFor={`dash-obj-${obj.id}`}
                            className={cn(
                              "flex-grow cursor-pointer truncate",
                              obj.completed && "line-through text-muted-foreground"
                            )}
                            title={obj.text}
                          >
                            {obj.text}
                          </label>
                          {isLoadingObjectiveToggle === obj.id && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
                <CardFooter className="pt-3 pb-4 border-t">
                  <Button asChild variant="outline" size="xs" className="w-full text-xs">
                      <Link href="/daily-plan"><ListChecks className="mr-1.5 h-3.5 w-3.5" /> Gérer le Plan du Jour</Link>
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader className="pb-3 pt-4">
                  <CardTitle className="text-base md:text-lg">Résumé des Tâches</CardTitle>
                   <CardDescription className="text-xs">
                     {isLoadingTasks ? <Loader2 className="h-3 w-3 animate-spin inline-block mr-1" /> : null}
                      {tasksPending.length} en attente / {allTasks.length} au total.
                   </CardDescription>
                </CardHeader>
                <CardContent className="max-h-48 overflow-y-auto custom-scrollbar pr-1 text-xs">
                  {isLoadingTasks ? (
                    <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <span className="font-semibold">En attente : </span>
                        <span className="font-bold text-orange-600">{tasksPending.length}</span>
                      </div>
                      {tasksPending.length > 0 && (
                        <div className="pl-2 space-y-1">
                          {Object.entries(taskTypeLabels).map(([type, label]) => {
                              const count = tasksPendingByType[type as TaskType] || 0;
                              if (count > 0) {
                                  return (
                                    <div key={type} className="flex justify-between items-center text-xs">
                                      <div className="flex items-center">
                                        <span className={cn("w-2 h-2 rounded-full mr-1.5", taskTypeColorsShort[type as TaskType])}></span>
                                        {label}:
                                      </div>
                                      <span className="font-semibold">{count}</span>
                                    </div>
                                  );
                              }
                              return null;
                          })}
                        </div>
                      )}
                       <div className="pt-1">
                        <span className="font-semibold">Terminées : </span>
                        <span className="font-bold text-green-600">{tasksCompletedCount}</span>
                       </div>
                    </div>
                  )}
                </CardContent>
                 <CardFooter className="pt-3 pb-4 border-t">
                  <Button asChild variant="outline" size="xs" className="w-full text-xs">
                      <Link href="/tasks"><ListChecks className="mr-1.5 h-3.5 w-3.5" /> Gérer les Tâches</Link>
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader className="pb-3 pt-4">
                  <CardTitle className="text-base md:text-lg">Vide-Cerveau</CardTitle>
                   <CardDescription className="text-xs">
                     {isLoadingBrainDumps ? <Loader2 className="h-3 w-3 animate-spin inline-block mr-1" /> : null}
                      {brainDumpsToProcessCount} note(s) "capturée(s)" à traiter.
                   </CardDescription>
                </CardHeader>
                <CardContent className="max-h-32 overflow-y-auto custom-scrollbar pr-1">
                  {isLoadingBrainDumps ? (
                    <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : recentBrainDumps.length === 0 ? (
                    <p className="text-muted-foreground text-center text-xs py-2">Aucune note récente.</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs">
                      {recentBrainDumps.map(dump => (
                        <li key={dump.id} className="truncate p-1.5 border rounded-md bg-muted/20 hover:bg-muted/40 transition-colors" title={dump.text}>
                          {dump.text} <Badge variant={dump.status === 'captured' ? 'destructive' : 'secondary'} className="ml-1 text-xs opacity-80 h-5 px-1.5">{dump.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
                <CardFooter className="pt-3 pb-4 border-t">
                  <Button asChild variant="outline" size="xs" className="w-full text-xs">
                      <Link href="/brain-dump"><Notebook className="mr-1.5 h-3.5 w-3.5" /> Aller au Vide-Cerveau</Link>
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader className="pb-3 pt-4">
                  <CardTitle className="text-base md:text-lg">Sessions Pomodoro</CardTitle>
                  <CardDescription className="text-xs">
                    {isLoadingPomodoros ? <Loader2 className="h-3 w-3 animate-spin inline-block mr-1" /> : null}
                     {recentPomodoros.length} récentes ({pomodoroTotalMinutesRecent} min au total).
                  </CardDescription>
                </CardHeader>
                <CardContent className="max-h-32 overflow-y-auto custom-scrollbar pr-1">
                  {isLoadingPomodoros ? (
                    <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : recentPomodoros.length === 0 ? (
                    <p className="text-muted-foreground text-center text-xs py-2">Aucune session récente.</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs">
                      {recentPomodoros.map(pomo => (
                         <li key={pomo.id} className="p-1.5 border rounded-md bg-muted/20 hover:bg-muted/40 transition-colors">
                          <p className="truncate font-medium">{pomo.duration} min - {format(new Date(pomo.start_time), "d MMM, HH:mm", { locale: fr })}</p>
                          {pomo.notes && <p className="text-xs text-muted-foreground truncate" title={pomo.notes}>Notes: {pomo.notes}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
                <CardFooter className="pt-3 pb-4 border-t">
                  <Button asChild variant="outline" size="xs" className="w-full text-xs">
                      <Link href="/pomodoro"><TimerIcon className="mr-1.5 h-3.5 w-3.5" /> Aller au Minuteur</Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </>
      )}

      <DialogComponents.Dialog open={isChapterModalOpen} onOpenChange={(open) => {if (!isSavingChapter) setIsChapterModalOpen(open)}}>
        <DialogComponents.DialogContent>
          <DialogComponents.DialogHeader>
            <DialogComponents.DialogTitle>{currentChapterForModal?.id ? 'Modifier le Chapitre' : 'Ajouter un Nouveau Chapitre'}</DialogComponents.DialogTitle>
          </DialogComponents.DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="dashChapterName" className="block text-sm font-medium mb-1">Nom du Chapitre</Label>
              <Input
                id="dashChapterName"
                value={currentChapterForModal?.name || ''}
                onChange={(e) => setCurrentChapterForModal(prev => ({ ...prev, name: e.target.value }))}
                placeholder="ex : Introduction"
                disabled={isSavingChapter}
              />
            </div>
            <div>
              <Label htmlFor="dashChapterProgress" className="block text-sm font-medium mb-1">Progression (%)</Label>
              <Input
                id="dashChapterProgress"
                type="number"
                min="0"
                max="100"
                value={currentChapterForModal?.progress === undefined ? '' : currentChapterForModal.progress}
                onChange={(e) => setCurrentChapterForModal(prev => ({ ...prev, progress: e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0 }))}
                disabled={isSavingChapter}
              />
            </div>
            <div>
              <Label htmlFor="dashChapterStatus" className="block text-sm font-medium mb-1">Statut</Label>
              <Input
                id="dashChapterStatus"
                value={currentChapterForModal?.status || ''}
                onChange={(e) => setCurrentChapterForModal(prev => ({ ...prev, status: e.target.value }))}
                placeholder="ex : En cours"
                disabled={isSavingChapter}
              />
            </div>
          </div>
          <DialogComponents.DialogFooter>
            <Button variant="outline" onClick={() => {if(!isSavingChapter) setIsChapterModalOpen(false)}} disabled={isSavingChapter}>Annuler</Button>
            <Button onClick={handleSaveChapter} disabled={isSavingChapter || !currentChapterForModal?.name?.trim()}>
              {isSavingChapter ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4"/>}
              {isSavingChapter ? 'Enregistrement...' : (currentChapterForModal?.id ? 'Mettre à Jour' : 'Ajouter')}
            </Button>
          </DialogComponents.DialogFooter>
        </DialogComponents.DialogContent>
      </DialogComponents.Dialog>
    </div>
  );
}

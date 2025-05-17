
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import type { Chapter, DailyObjective, Task, BrainDumpEntry, PomodoroSession, TaskType } from '@/types';
import { PlusCircle, Edit3, Trash2, MessageSquare, Loader2, ListChecks, CheckCircle, Notebook, TimerIcon, TrendingUp, Target as TargetIcon, AlertTriangle, ExternalLink, Eye } from 'lucide-react';
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

const taskTypeColors: Record<TaskType, string> = {
  urgent: "border-red-500/50 bg-red-50 text-red-700",
  important: "border-orange-500/50 bg-orange-50 text-orange-700",
  reading: "border-green-500/50 bg-green-50 text-green-700",
  chatgpt: "border-blue-500/50 bg-blue-50 text-blue-700",
  secondary: "border-gray-500/50 bg-gray-50 text-gray-700",
};


interface ChapterProgressCardProps {
  chapter: Chapter;
  onEditModalOpen: (chapter: Chapter) => void; // Renamed to avoid conflict
}

const ChapterProgressCard: FC<ChapterProgressCardProps> = ({ chapter, onEditModalOpen }) => {
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-base md:text-lg">{chapter.name}</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => onEditModalOpen(chapter)} aria-label="Modifier le chapitre" className="h-7 w-7">
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
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Commentaires :</h4>
            <ul className="list-disc list-inside text-xs space-y-0.5 max-h-16 overflow-y-auto custom-scrollbar">
              {chapter.supervisor_comments.map((c, index) => (
                <li key={index} className="truncate">{c}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-3">
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
  const [isLoadingCardActions, setIsLoadingCardActions] = useState(false); // For delete/add comment on chapters
  const [isLoadingObjectiveToggle, setIsLoadingObjectiveToggle] = useState<string | null>(null);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [chapterForComment, setChapterForComment] = useState<string | null>(null);


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
        supabase.from('brain_dump_entries').select('*').order('created_at', { ascending: false }).limit(3), // Limiting to 3 for dashboard
        supabase.from('pomodoro_sessions').select('*').order('start_time', { ascending: false }).limit(3), // Limiting to 3 for dashboard
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
    // Set up a listener for changes in the database (optional, can be intensive)
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        console.log('Changement DB reçu!', payload);
        fetchAllData(); // Re-fetch all data on any change
      })
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
      // Optimistic update handled by Supabase realtime or fetchAllData
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
      // Data will be re-fetched by Supabase listener or manually if needed
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
    } catch (e: any)      {
      toast({ title: "Erreur de suppression", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleDeleteChapter:", e);
    } finally {
      setIsLoadingCardActions(false);
    }
  };

  const handleAddCommentToChapter = async () => {
    if (!chapterForComment || !newCommentText.trim()) return;
    setIsLoadingCardActions(true);
    try {
      const chapterToUpdate = chapters.find(ch => ch.id === chapterForComment);
      if (!chapterToUpdate) throw new Error("Chapitre non trouvé");

      const updatedComments = [...(chapterToUpdate.supervisor_comments || []), newCommentText.trim()];
      const { error } = await supabase
        .from('chapters')
        .update({ supervisor_comments: updatedComments })
        .eq('id', chapterForComment);
      if (error) throw error;
      toast({ title: "Commentaire ajouté" });
      setNewCommentText('');
      setChapterForComment(null);
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
    <div className="p-3 md:p-4 space-y-4 md:space-y-6"> {/* Reduced padding slightly for more content space */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Tableau de Bord ThesisFlow</h1>
        <Button onClick={openModalForNewChapter} disabled={isLoadingAnyData || isSavingChapter} size="sm">
          <PlusCircle className="mr-2 h-4 w-4" /> Nouveau Chapitre
        </Button>
      </div>

      {isLoadingAnyData && !chapters.length && !dailyObjectives.length && !allTasks.length ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Chargement du tableau de bord...</p>
        </div>
      ) : (
        <>
          <Card className="shadow-lg border-primary/30 bg-gradient-to-br from-primary/5 to-background">
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

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {/* Chapters Section - Spans 2 columns on larger screens */}
            <div className="md:col-span-2 xl:col-span-2 space-y-4 md:space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base md:text-lg">Progression des Chapitres</CardTitle>
                  <CardDescription className="text-xs md:text-sm">Avancement détaillé de chaque section de votre thèse.</CardDescription>
                </CardHeader>
                <CardContent>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 max-h-[calc(100vh-20rem)] overflow-y-auto custom-scrollbar pr-1">
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

            {/* KPIs Column - Spans 1 column */}
            <div className="space-y-4 md:space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-base md:text-lg"><TargetIcon className="mr-2 h-4 w-4 text-green-600" />Objectifs du Jour</CardTitle>
                   <CardDescription className="text-xs">
                     {isLoadingObjectives ? <Loader2 className="h-3 w-3 animate-spin inline-block" /> :
                      `${objectivesCompletedCount} / ${objectivesTotalCount} (${objectivesCompletionPercentage}%)`}
                   </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingObjectives ? (
                    <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : dailyObjectives.length === 0 ? (
                    <p className="text-muted-foreground text-center text-xs py-2">Aucun objectif défini.</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs max-h-32 overflow-y-auto custom-scrollbar pr-1">
                      {dailyObjectives.slice(0, 5).map(obj => ( // Show up to 5 objectives
                        <li key={obj.id} className="flex items-center gap-2 p-1.5 border rounded-md hover:bg-muted/30 transition-colors">
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
                <CardFooter className="pt-2">
                  <Button asChild variant="outline" size="xs" className="w-full text-xs">
                      <Link href="/daily-plan"><ListChecks className="mr-1.5 h-3.5 w-3.5" /> Gérer le Plan du Jour</Link>
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base md:text-lg">Résumé des Tâches</CardTitle>
                   <CardDescription className="text-xs">
                     {isLoadingTasks ? <Loader2 className="h-3 w-3 animate-spin inline-block" /> :
                      `${tasksPending.length} en attente / ${allTasks.length} au total.`}
                   </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingTasks ? (
                    <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : (
                    <div className="space-y-1.5 text-xs max-h-36 overflow-y-auto custom-scrollbar pr-1">
                      <p>En attente : <span className="font-semibold text-orange-600">{tasksPending.length}</span></p>
                      {tasksPending.length > 0 && (
                        <div className="pl-3 text-xs space-y-0.5">
                          {Object.entries(taskTypeLabels).map(([type, label]) => {
                              const count = tasksPendingByType[type as TaskType] || 0;
                              if (count > 0) {
                                  return <p key={type} className={cn("flex justify-between items-center", taskTypeColors[type as TaskType], "px-1.5 py-0.5 rounded-sm")}><span>{label}:</span> <Badge variant="secondary" className="text-xs">{count}</Badge></p>;
                              }
                              return null;
                          })}
                        </div>
                      )}
                      <p>Terminées : <span className="font-semibold text-green-600">{tasksCompletedCount}</span></p>
                    </div>
                  )}
                </CardContent>
                 <CardFooter className="pt-2">
                  <Button asChild variant="outline" size="xs" className="w-full text-xs">
                      <Link href="/tasks"><ListChecks className="mr-1.5 h-3.5 w-3.5" /> Gérer les Tâches</Link>
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base md:text-lg">Vide-Cerveau</CardTitle>
                   <CardDescription className="text-xs">
                     {isLoadingBrainDumps ? <Loader2 className="h-3 w-3 animate-spin inline-block" /> :
                      `${brainDumpsToProcessCount} note(s) à traiter.`}
                   </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingBrainDumps ? (
                    <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : recentBrainDumps.length === 0 ? (
                    <p className="text-muted-foreground text-center text-xs py-2">Aucune note récente.</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs max-h-28 overflow-y-auto custom-scrollbar pr-1">
                      {recentBrainDumps.map(dump => (
                        <li key={dump.id} className="truncate p-1.5 border rounded-md bg-muted/40 hover:bg-muted/70 transition-colors" title={dump.text}>
                          {dump.text} <Badge variant={dump.status === 'captured' ? 'destructive' : 'secondary'} className="ml-1 text-xs opacity-80">{dump.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
                <CardFooter className="pt-2">
                  <Button asChild variant="outline" size="xs" className="w-full text-xs">
                      <Link href="/brain-dump"><Notebook className="mr-1.5 h-3.5 w-3.5" /> Aller au Vide-Cerveau</Link>
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base md:text-lg">Sessions Pomodoro</CardTitle>
                  <CardDescription className="text-xs">
                    {isLoadingPomodoros ? <Loader2 className="h-3 w-3 animate-spin inline-block" /> :
                     `${recentPomodoros.length} récentes (${pomodoroTotalMinutesRecent} min).`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingPomodoros ? (
                    <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : recentPomodoros.length === 0 ? (
                    <p className="text-muted-foreground text-center text-xs py-2">Aucune session récente.</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs max-h-28 overflow-y-auto custom-scrollbar pr-1">
                      {recentPomodoros.map(pomo => (
                         <li key={pomo.id} className="p-1.5 border rounded-md bg-muted/40 hover:bg-muted/70 transition-colors">
                          <p className="truncate">{pomo.duration} min - {format(new Date(pomo.start_time), "d MMM, HH:mm", { locale: fr })}</p>
                          {pomo.notes && <p className="text-xs text-muted-foreground truncate" title={pomo.notes}>Notes: {pomo.notes}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
                <CardFooter className="pt-2">
                  <Button asChild variant="outline" size="xs" className="w-full text-xs">
                      <Link href="/pomodoro"><TimerIcon className="mr-1.5 h-3.5 w-3.5" /> Aller au Minuteur</Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

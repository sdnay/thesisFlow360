
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import * as DialogComponents from '@/components/ui/dialog';
import type { Chapter, DailyObjective, Task, BrainDumpEntry, PomodoroSession, TaskType, Source } from '@/types';
import { 
  PlusCircle, Edit3, Eye, Loader2, ListChecks, CheckCircle, Notebook, TimerIcon, TrendingUp, 
  Target as TargetIcon, AlertTriangle, FolderOpen, BookOpen, Layers, AlertCircle, Info, Hourglass
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const taskTypeLabels: Record<TaskType, string> = {
  urgent: "Urgent",
  important: "Important",
  reading: "Lecture",
  chatgpt: "ChatGPT",
  secondary: "Secondaire",
};

const taskTypeColors: Record<TaskType, { bg: string, text: string, border: string }> = {
  urgent: { bg: "bg-red-100 dark:bg-red-900/50", text: "text-red-700 dark:text-red-300", border: "border-red-500" },
  important: { bg: "bg-orange-100 dark:bg-orange-900/50", text: "text-orange-700 dark:text-orange-300", border: "border-orange-500" },
  reading: { bg: "bg-green-100 dark:bg-green-900/50", text: "text-green-700 dark:text-green-300", border: "border-green-500" },
  chatgpt: { bg: "bg-blue-100 dark:bg-blue-900/50", text: "text-blue-700 dark:text-blue-300", border: "border-blue-500" },
  secondary: { bg: "bg-gray-100 dark:bg-gray-700/50", text: "text-gray-700 dark:text-gray-300", border: "border-gray-500" },
};


interface CompactChapterCardProps {
  chapter: Chapter;
  onEditModalOpen: (chapter: Chapter) => void;
}

const CompactChapterCard: FC<CompactChapterCardProps> = ({ chapter, onEditModalOpen }) => {
  const commentsPreview = chapter.supervisor_comments?.slice(-1)[0] || null; // Get the last comment

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-150 flex flex-col bg-card h-full">
      <CardHeader className="pb-2 pt-3 px-3 md:px-4">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-sm md:text-base font-semibold leading-tight line-clamp-2" title={chapter.name}>
            {chapter.name}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={() => onEditModalOpen(chapter)} aria-label="Modifier le chapitre" className="h-7 w-7 text-muted-foreground hover:text-primary shrink-0">
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <CardDescription className="text-xs pt-0.5">
          <Badge variant={chapter.progress === 100 ? "default" : "secondary"} className={cn(chapter.progress === 100 ? "bg-green-500 hover:bg-green-600" : "")}>
            {chapter.status}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow py-2 px-3 md:px-4 space-y-2">
        <Progress value={chapter.progress} className="w-full h-2" aria-label={`Progression ${chapter.progress}%`} />
        <p className="text-xs text-muted-foreground text-right">{chapter.progress}%</p>
        {commentsPreview && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mt-1.5 text-xs text-muted-foreground flex items-start gap-1.5 border-t pt-1.5">
                  <Info className="h-3.5 w-3.5 shrink-0 text-primary/70 mt-0.5" />
                  <p className="line-clamp-2 italic">{commentsPreview}</p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="max-w-xs whitespace-pre-wrap">
                <p className="font-semibold mb-1">Dernier commentaire :</p>
                <p>{commentsPreview}</p>
                {chapter.supervisor_comments && chapter.supervisor_comments.length > 1 && (
                   <p className="text-xs text-muted-foreground mt-1">(et {chapter.supervisor_comments.length -1} autre(s))</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </CardContent>
      <CardFooter className="pt-2 pb-3 px-3 md:px-4 border-t mt-auto">
        <Button asChild variant="outline" size="xs" className="w-full text-xs">
            <Link href="/add-chapter"><Layers className="mr-1.5 h-3 w-3" /> Gérer Plan</Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

const KPIWidget: FC<{ title: string; value: string | number; description?: string; icon?: React.ElementType, link?: string; linkText?: string, children?: React.ReactNode }> = 
  ({ title, value, description, icon: Icon, link, linkText, children }) => {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-150 bg-card h-full flex flex-col">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-muted-foreground">{title}</CardTitle>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent className="flex-grow py-2 px-4">
        <div className="text-2xl font-bold text-primary">{value}</div>
        {description && <p className="text-xs text-muted-foreground pt-0.5">{description}</p>}
        {children}
      </CardContent>
      {link && linkText && (
        <CardFooter className="pt-2 pb-3 px-4 border-t mt-auto">
          <Button asChild variant="link" size="xs" className="p-0 h-auto text-xs">
            <Link href={link}>{linkText} <span aria-hidden="true">→</span></Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};


export function ThesisDashboardSection() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [dailyObjectives, setDailyObjectives] = useState<DailyObjective[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [recentBrainDumps, setRecentBrainDumps] = useState<BrainDumpEntry[]>([]);
  const [recentPomodoros, setRecentPomodoros] = useState<PomodoroSession[]>([]);
  const [recentSources, setRecentSources] = useState<Source[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);

  const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);
  const [currentChapterForModal, setCurrentChapterForModal] = useState<Partial<Chapter> | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingChapter, setIsSavingChapter] = useState(false);
  const [isLoadingObjectiveToggle, setIsLoadingObjectiveToggle] = useState<string | null>(null);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);

  const { toast } = useToast();

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    setErrorLoading(null);
    try {
      const [
        chaptersRes,
        objectivesRes,
        tasksRes,
        brainDumpsRes,
        pomodorosRes,
        sourcesRes,
      ] = await Promise.all([
        supabase.from('chapters').select('*').order('name'),
        supabase.from('daily_objectives').select('*').order('text'),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('brain_dump_entries').select('*').order('created_at', { ascending: false }).limit(3),
        supabase.from('pomodoro_sessions').select('*').order('start_time', { ascending: false }).limit(3),
        supabase.from('sources').select('id, title, type, created_at').order('created_at', { ascending: false }).limit(2),
      ]);

      const errors = [chaptersRes.error, objectivesRes.error, tasksRes.error, brainDumpsRes.error, pomodorosRes.error, sourcesRes.error].filter(Boolean);
      if (errors.length > 0) {
        throw new Error(errors.map(e => e?.message).join(', '));
      }

      setChapters(chaptersRes.data || []);
      if (chaptersRes.data && chaptersRes.data.length > 0) {
        const totalProgress = chaptersRes.data.reduce((sum, chapter) => sum + chapter.progress, 0);
        setOverallProgress(Math.round(totalProgress / chaptersRes.data.length));
      } else {
        setOverallProgress(0);
      }
      
      setDailyObjectives(objectivesRes.data || []);
      setAllTasks(tasksRes.data || []);
      setRecentBrainDumps(brainDumpsRes.data || []);
      setRecentPomodoros(pomodorosRes.data || []);
      setRecentSources(sourcesRes.data || []);

    } catch (e: any) {
      console.error("Erreur fetchAllData:", e);
      setErrorLoading(e.message || "Une erreur est survenue lors du chargement des données du tableau de bord.");
      toast({ title: "Erreur de chargement", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);


  useEffect(() => {
    fetchAllData();
    const channel = supabase
      .channel('db-changes-dashboard-section-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chapters' }, fetchAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_objectives' }, fetchAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brain_dump_entries' }, fetchAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pomodoro_sessions' }, fetchAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sources' }, fetchAllData)
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
      // Data will be refetched by Supabase listener
    } catch (e: any) {
      toast({ title: "Erreur de mise à jour", description: (e as Error).message, variant: "destructive" });
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
        toast({ title: "Chapitre modifié" });
      } else {
        const { error } = await supabase.from('chapters').insert([chapterPayload]);
        if (error) throw error;
        toast({ title: "Chapitre ajouté" });
      }
      setIsChapterModalOpen(false);
      setCurrentChapterForModal(null);
    } catch (e: any) {
      toast({ title: "Erreur d'enregistrement", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsSavingChapter(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 flex flex-col items-center justify-center h-full text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Chargement du tableau de bord...</p>
      </div>
    );
  }
  
  if (errorLoading) {
    return (
      <div className="p-4 md:p-6 flex flex-col items-center justify-center h-full text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">Erreur de Chargement</h2>
        <p className="text-muted-foreground mb-4 max-w-md">{errorLoading}</p>
        <Button onClick={fetchAllData} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Réessayer
        </Button>
      </div>
    );
  }
  
  const objectivesCompletedCount = dailyObjectives.filter(obj => obj.completed).length;
  const objectivesTotalCount = dailyObjectives.length;
  const objectivesCompletionPercentage = objectivesTotalCount > 0 ? Math.round((objectivesCompletedCount / objectivesTotalCount) * 100) : 0;

  const tasksPending = allTasks.filter(t => !t.completed);
  const tasksPendingByType = tasksPending.reduce((acc, task) => {
    acc[task.type] = (acc[task.type] || 0) + 1;
    return acc;
  }, {} as Record<TaskType, number>);
  const urgentOrImportantPendingCount = (tasksPendingByType.urgent || 0) + (tasksPendingByType.important || 0);

  const brainDumpsToProcessCount = recentBrainDumps.filter(d => d.status === 'captured').length;
  const pomodoroTotalMinutesRecent = recentPomodoros.reduce((sum, pomo) => sum + pomo.duration, 0);

  return (
    <div className="p-2 md:p-4 space-y-4 md:space-y-6 h-full overflow-y-auto custom-scrollbar">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Tableau de Bord ThesisFlow</h1>
        <Button onClick={openModalForNewChapter} disabled={isLoading || isSavingChapter} size="sm">
          <PlusCircle className="mr-2 h-4 w-4" /> Nouveau Chapitre
        </Button>
      </div>

      {/* Overall Progress Card */}
      <Card className="shadow-lg border-primary/30 bg-gradient-to-r from-card to-primary/10 dark:to-primary/20">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="flex items-center text-primary text-lg md:text-xl">
            <TrendingUp className="mr-2 h-5 w-5" />
            Progression Globale de la Thèse
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          <Progress value={overallProgress} className="w-full h-3.5 md:h-4 mb-1.5" />
          <p className="text-center text-xl md:text-2xl font-bold text-primary">{overallProgress}%</p>
          {chapters.length > 0 ? (
            <p className="text-center text-xs text-muted-foreground">{chapters.length} chapitre(s) en cours</p>
          ):(
            <p className="text-center text-xs text-muted-foreground">Commencez par ajouter des chapitres.</p>
          )}
        </CardContent>
      </Card>

      {/* Main Grid for Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        
        {/* KPIs Column / Section 1 (Objectives & Tasks) */}
        <div className="md:col-span-1 lg:col-span-1 flex flex-col gap-4 md:gap-6">
          <KPIWidget 
            title="Objectifs du Jour" 
            value={`${objectivesCompletedCount}/${objectivesTotalCount}`} 
            description={objectivesTotalCount > 0 ? `(${objectivesCompletionPercentage}%) complétés` : "Aucun objectif défini"}
            icon={TargetIcon}
            link="/daily-plan"
            linkText="Gérer le plan du jour"
          >
            {objectivesTotalCount > 0 && <Progress value={objectivesCompletionPercentage} className="w-full h-1.5 mt-2" />}
            <div className="mt-2 space-y-1 max-h-24 overflow-y-auto custom-scrollbar pr-1">
              {dailyObjectives.slice(0,3).map(obj => (
                <div key={obj.id} className="flex items-center gap-2 text-xs">
                  <Checkbox id={`dash-obj-${obj.id}`} checked={obj.completed} disabled={true} className="h-3.5 w-3.5"/>
                  <label htmlFor={`dash-obj-${obj.id}`} className={cn("truncate", obj.completed && "line-through text-muted-foreground")}>{obj.text}</label>
                </div>
              ))}
              {dailyObjectives.length > 3 && <p className="text-xs text-muted-foreground text-center">...</p>}
            </div>
          </KPIWidget>

          <KPIWidget 
            title="Tâches en Attente" 
            value={tasksPending.length} 
            description={urgentOrImportantPendingCount > 0 ? `${urgentOrImportantPendingCount} urgentes/importantes` : "Prêt à attaquer !"}
            icon={ListChecks}
            link="/tasks"
            linkText="Gérer les tâches"
          >
             <div className="mt-2 space-y-0.5 text-xs">
              {Object.entries(tasksPendingByType).map(([type, count]) => {
                  if (count > 0) {
                    const typeInfo = taskTypeColors[type as TaskType] || taskTypeColors.secondary;
                    return (
                      <div key={type} className={`flex justify-between items-center p-1 rounded-sm text-xs ${typeInfo.bg} ${typeInfo.text}`}>
                        <span>{taskTypeLabels[type as TaskType]}</span>
                        <Badge variant="secondary" className={`px-1.5 py-0 h-5 ${typeInfo.bg} ${typeInfo.text}`}>{count}</Badge>
                      </div>
                    );
                  }
                  return null;
              })}
            </div>
          </KPIWidget>
        </div>

        {/* Chapters Section - Takes more space */}
        <div className="md:col-span-2 lg:col-span-2">
          <Card className="h-full flex flex-col shadow-sm">
            <CardHeader className="pb-2 pt-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base md:text-lg flex items-center"><Layers className="mr-2 h-5 w-5 text-primary/80" />Progression des Chapitres</CardTitle>
                <Button asChild variant="outline" size="xs">
                    <Link href="/add-chapter">Tout Voir/Gérer</Link>
                </Button>
              </div>
              <CardDescription className="text-xs md:text-sm">Aperçu de l'avancement de vos sections principales.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow py-2">
              {chapters.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center justify-center h-full">
                    <FolderOpen className="mx-auto h-12 w-12 opacity-40 mb-3"/>
                    <p className="font-medium text-sm mb-1">Aucun chapitre défini.</p>
                    <p className="text-xs mb-3">Organisez votre thèse en ajoutant des chapitres.</p>
                    <Button onClick={openModalForNewChapter} size="sm">
                        <PlusCircle className="mr-2 h-4 w-4"/>Créer le premier chapitre
                    </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                  {chapters.slice(0, 6).map((chapter) => ( // Show up to 6 chapters directly
                    <CompactChapterCard
                      key={chapter.id}
                      chapter={chapter}
                      onEditModalOpen={openModalForEditChapter}
                    />
                  ))}
                </div>
              )}
            </CardContent>
            {chapters.length > 6 && (
                 <CardFooter className="pt-2 pb-3 border-t justify-center">
                    <Button asChild variant="link" size="sm">
                        <Link href="/add-chapter">Voir tous les {chapters.length} chapitres...</Link>
                    </Button>
                </CardFooter>
            )}
          </Card>
        </div>

        {/* Other KPIs Column / Section 2 (Pomodoro, Brain Dump, Sources) */}
         <div className="md:col-span-1 lg:col-span-1 flex flex-col gap-4 md:gap-6">
            <KPIWidget 
                title="Focus Pomodoro" 
                value={`${formatDistanceToNowStrict(new Date(Date.now() - pomodoroTotalMinutesRecent * 60000), {locale: fr, unit: 'minute'})}`}
                description={`${recentPomodoros.length} session(s) récente(s)`}
                icon={Hourglass} // Changed from TimerIcon for variety
                link="/pomodoro"
                linkText="Lancer / Voir le journal"
            />
         </div>
         <div className="md:col-span-1 lg:col-span-1 flex flex-col gap-4 md:gap-6">
            <KPIWidget 
                title="Vide-Cerveau" 
                value={brainDumpsToProcessCount} 
                description={`note(s) "capturée(s)" à traiter`}
                icon={Notebook}
                link="/brain-dump"
                linkText="Accéder au vide-cerveau"
            />
        </div>
        <div className="md:col-span-1 lg:col-span-1 flex flex-col gap-4 md:gap-6">
             <KPIWidget 
                title="Sources Récentes" 
                value={recentSources.length > 0 ? recentSources[0].title : "Aucune"}
                description={recentSources.length > 1 ? `et ${recentSources.length-1} autre(s)` : (recentSources.length === 1 ? sourceTypeText(recentSources[0].type) : "Ajoutez des sources !")}
                icon={BookOpen}
                link="/sources"
                linkText="Gérer la bibliothèque"
            >
              {recentSources.length > 0 && (
                <ul className="mt-1.5 space-y-1 text-xs max-h-20 overflow-y-auto custom-scrollbar pr-1">
                  {recentSources.map(src => (
                    <li key={src.id} className="truncate p-1 border rounded-sm bg-muted/30 hover:bg-muted/50" title={src.title}>
                      <span className="font-medium">{src.title}</span> ({sourceTypeText(src.type)})
                    </li>
                  ))}
                </ul>
              )}
            </KPIWidget>
        </div>

      </div>

      <DialogComponents.Dialog open={isChapterModalOpen} onOpenChange={(open) => {if (!isSavingChapter) setIsChapterModalOpen(open)}}>
        <DialogComponents.DialogContent className="sm:max-w-md">
          <DialogComponents.DialogHeader>
            <DialogComponents.DialogTitle className="text-lg">{currentChapterForModal?.id ? 'Modifier le Chapitre' : 'Ajouter un Nouveau Chapitre'}</DialogComponents.DialogTitle>
          </DialogComponents.DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <Label htmlFor="dashChapterNameModal" className="block text-sm font-medium mb-1.5">Nom du Chapitre</Label>
              <Input
                id="dashChapterNameModal"
                value={currentChapterForModal?.name || ''}
                onChange={(e) => setCurrentChapterForModal(prev => ({ ...prev, name: e.target.value }))}
                placeholder="ex : Introduction"
                disabled={isSavingChapter}
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="dashChapterProgressModal" className="block text-sm font-medium mb-1.5">Progression (%)</Label>
              <Input
                id="dashChapterProgressModal"
                type="number"
                min="0"
                max="100"
                value={currentChapterForModal?.progress === undefined ? '' : currentChapterForModal.progress}
                onChange={(e) => setCurrentChapterForModal(prev => ({ ...prev, progress: e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0 }))}
                disabled={isSavingChapter}
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="dashChapterStatusModal" className="block text-sm font-medium mb-1.5">Statut</Label>
              <Input
                id="dashChapterStatusModal"
                value={currentChapterForModal?.status || ''}
                onChange={(e) => setCurrentChapterForModal(prev => ({ ...prev, status: e.target.value }))}
                placeholder="ex : En cours"
                disabled={isSavingChapter}
                className="text-sm"
              />
            </div>
          </div>
          <DialogComponents.DialogFooter className="mt-2">
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

// Helper function (can be moved to utils or kept here if only used here)
function sourceTypeText(type: Source['type']): string {
    switch (type) {
        case 'pdf': return 'PDF';
        case 'website': return 'Site Web';
        case 'interview': return 'Entretien';
        case 'field_notes': return 'Notes Terrain';
        case 'other': return 'Autre';
        default: return type;
    }
}

    
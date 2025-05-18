
"use client";

import type { FC } from 'react'; // Import FC
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import * as DialogComponents from '@/components/ui/dialog'; // Use namespace import
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
import { useAuth } from '@/hooks/useAuth'; // Import useAuth
import CompactChapterCard from './dashboard-components/CompactChapterCard';
import KPIWidget from './dashboard-components/KPIWidget';

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

// Helper function (can be moved to utils or kept here if only used here)
function sourceTypeText(type: Source['type']): string {
    switch (type) {
        case 'pdf': return 'PDF';
        case 'website': return 'Site Web';
        case 'interview': return 'Entretien';
        case 'field_notes': return 'Notes Terrain';
        case 'other': return 'Autre';
        default: return type as string; // Cast to string for exhaustiveness
    }
}

export function ThesisDashboardSection() {
  const { user } = useAuth(); // Get user from AuthContext
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
    if (!user) {
      setIsLoading(false);
      setErrorLoading("Utilisateur non authentifié. Veuillez vous connecter.");
      setChapters([]); setDailyObjectives([]); setAllTasks([]); 
      setRecentBrainDumps([]); setRecentPomodoros([]); setRecentSources([]);
      setOverallProgress(0);
      return;
    }
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
        supabase.from('chapters').select('*').eq('user_id', user.id).order('name'),
        supabase.from('daily_objectives').select('*').eq('user_id', user.id).order('text'),
        supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('brain_dump_entries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3),
        supabase.from('pomodoro_sessions').select('*').eq('user_id', user.id).order('start_time', { ascending: false }).limit(3),
        supabase.from('sources').select('id, title, type, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3),
      ]);

      const errors = [chaptersRes.error, objectivesRes.error, tasksRes.error, brainDumpsRes.error, pomodorosRes.error, sourcesRes.error].filter(Boolean);
      if (errors.length > 0) {
        const errorMessages = errors.map(e => e?.message).join(', ');
        throw new Error(errorMessages || "Une erreur inconnue est survenue lors de la récupération des données.");
      }

      setChapters(chaptersRes.data || []);
      if (chaptersRes.data && chaptersRes.data.length > 0) {
        const totalProgress = chaptersRes.data.reduce((sum, chapter) => sum + (chapter.progress || 0), 0);
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
  }, [toast, user]);


  useEffect(() => {
    if (user) {
      fetchAllData();
    } else {
      // Clear data if user logs out or is not present initially
      setIsLoading(false);
      setChapters([]); setDailyObjectives([]); setAllTasks([]); 
      setRecentBrainDumps([]); setRecentPomodoros([]); setRecentSources([]);
      setOverallProgress(0);
    }
    
    // Set up Supabase real-time subscriptions if user is present
    if (user) {
      const subscriptions = [
        { table: 'chapters', callback: fetchAllData },
        { table: 'daily_objectives', callback: fetchAllData },
        { table: 'tasks', callback: fetchAllData },
        { table: 'brain_dump_entries', callback: fetchAllData },
        { table: 'pomodoro_sessions', callback: fetchAllData },
        { table: 'sources', callback: fetchAllData },
      ].map(subInfo => 
        supabase
          .channel(`db-dashboard-${subInfo.table}-user-${user.id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: subInfo.table, filter: `user_id=eq.${user.id}` }, subInfo.callback)
          .subscribe()
      );

      return () => {
        subscriptions.forEach(sub => supabase.removeChannel(sub));
      };
    }
  }, [user, fetchAllData]);


  const handleToggleObjective = async (id: string, completed: boolean) => {
    if (!user) return;
    setIsLoadingObjectiveToggle(id);
    try {
      const { error } = await supabase
        .from('daily_objectives')
        .update({ completed, completed_at: completed ? new Date().toISOString() : null })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      // Data will be refetched by Supabase listener, or update local state for faster UI
      setDailyObjectives(prev => prev.map(obj => obj.id === id ? {...obj, completed, completed_at: completed ? new Date().toISOString() : null } : obj));
    } catch (e: any) {
      toast({ title: "Erreur de mise à jour", description: (e as Error).message, variant: "destructive" });
    } finally {
       setIsLoadingObjectiveToggle(null);
    }
  };

  const openModalForNewChapter = () => {
    setCurrentChapterForModal({ name: '', progress: 0, status: 'Non commencé', supervisor_comments: [], user_id: user?.id });
    setIsChapterModalOpen(true);
  };

  const openModalForEditChapter = (chapter: Chapter) => {
    setCurrentChapterForModal(JSON.parse(JSON.stringify(chapter))); 
    setIsChapterModalOpen(true);
  };

  const handleSaveChapter = async () => {
    if (!user || !currentChapterForModal || !currentChapterForModal.name?.trim()) {
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
        user_id: user.id, // Ensure user_id is set
      };

      if (currentChapterForModal.id) {
        const { data: updatedChapter, error } = await supabase.from('chapters').update(chapterPayload).eq('id', currentChapterForModal.id).eq('user_id', user.id).select().single();
        if (error) throw error;
        if (updatedChapter) {
          setChapters(prev => prev.map(ch => ch.id === updatedChapter.id ? updatedChapter : ch));
        }
        toast({ title: "Chapitre modifié" });
      } else {
        const { data: newChapter, error } = await supabase.from('chapters').insert(chapterPayload).select().single();
        if (error) throw error;
        if (newChapter) {
          setChapters(prev => [...prev, newChapter].sort((a,b) => a.name.localeCompare(b.name)));
        }
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

  if (isLoading && !errorLoading) { // Show loading if initial fetch is in progress and no error yet
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
  
  const objectivesToday = dailyObjectives.filter(obj => format(new Date(obj.objective_date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'));
  const objectivesCompletedCount = objectivesToday.filter(obj => obj.completed).length;
  const objectivesTotalCount = objectivesToday.length;
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
    <div className="p-3 md:p-4 space-y-4 md:space-y-6 h-full overflow-y-auto custom-scrollbar">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Tableau de Bord ThesisFlow</h1>
        <Button onClick={openModalForNewChapter} disabled={isLoading || isSavingChapter} size="sm">
          <PlusCircle className="mr-2 h-4 w-4" /> Nouveau Chapitre
        </Button>
      </div>

      <Card className="shadow-md border-primary/30 bg-gradient-to-r from-card to-primary/10 dark:to-primary/20">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="flex items-center text-primary text-base md:text-lg">
            <TrendingUp className="mr-2 h-5 w-5" />
            Progression Globale de la Thèse
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          <Progress value={overallProgress} className="w-full h-3 md:h-3.5 mb-1.5" />
          <p className="text-center text-lg md:text-xl font-bold text-primary">{overallProgress}%</p>
          {chapters.length > 0 ? (
            <p className="text-center text-xs text-muted-foreground">{chapters.length} chapitre(s) en cours</p>
          ):(
            <p className="text-center text-xs text-muted-foreground">Commencez par ajouter des chapitres.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        
        <KPIWidget 
          title="Objectifs du Jour" 
          value={`${objectivesCompletedCount}/${objectivesTotalCount}`} 
          description={objectivesTotalCount > 0 ? `(${objectivesCompletionPercentage}%) complétés` : "Aucun objectif pour aujourd'hui"}
          icon={TargetIcon}
          link="/daily-plan"
          linkText="Gérer le plan du jour"
        >
          {objectivesTotalCount > 0 && <Progress value={objectivesCompletionPercentage} className="w-full h-1.5 mt-1.5" />}
          <div className="mt-2 space-y-1 max-h-24 overflow-y-auto custom-scrollbar pr-1">
            {objectivesToday.length === 0 && <p className="text-xs text-muted-foreground italic">Aucun objectif pour aujourd'hui.</p>}
            {objectivesToday.slice(0,3).map(obj => (
              <div key={obj.id} className="flex items-center gap-2 text-xs">
                <Checkbox 
                  id={`dash-obj-${obj.id}`} 
                  checked={obj.completed} 
                  onCheckedChange={(checked) => handleToggleObjective(obj.id, !!checked)}
                  disabled={isLoadingObjectiveToggle === obj.id}
                  className="h-3.5 w-3.5"
                />
                <Label htmlFor={`dash-obj-${obj.id}`} className={cn("truncate cursor-pointer", obj.completed && "line-through text-muted-foreground")}>{obj.text}</Label>
                 {isLoadingObjectiveToggle === obj.id && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
            ))}
            {objectivesToday.length > 3 && <p className="text-xs text-muted-foreground text-center">...</p>}
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
           <div className="mt-1.5 space-y-0.5 text-xs max-h-28 overflow-y-auto custom-scrollbar pr-1">
            {Object.entries(taskTypeLabels).map(([type, label]) => {
                const count = tasksPendingByType[type as TaskType] || 0;
                if (count > 0) {
                  const typeInfo = taskTypeColors[type as TaskType] || taskTypeColors.secondary;
                  return (
                    <div key={type} className={`flex justify-between items-center p-1 rounded-sm text-xs ${typeInfo.bg} ${typeInfo.text}`}>
                      <span>{label}</span>
                      <Badge variant="secondary" className={`px-1.5 py-0 h-5 ${typeInfo.bg} ${typeInfo.text} border ${typeInfo.border}`}>{count}</Badge>
                    </div>
                  );
                }
                return null;
            })}
            {tasksPending.length === 0 && <p className="text-xs text-muted-foreground italic">Aucune tâche en attente.</p>}
          </div>
        </KPIWidget>

        <KPIWidget 
            title="Focus Pomodoro (Récent)" 
            value={`${formatDistanceToNowStrict(new Date(Date.now() - pomodoroTotalMinutesRecent * 60000), {locale: fr, unit: 'minute'})}`}
            description={`${recentPomodoros.length} session(s) récente(s)`}
            icon={Hourglass}
            link="/pomodoro"
            linkText="Lancer / Voir le journal"
        />
        
        <KPIWidget 
            title="Vide-Cerveau" 
            value={brainDumpsToProcessCount} 
            description={`note(s) "capturée(s)" à traiter`}
            icon={Notebook}
            link="/brain-dump"
            linkText="Accéder au vide-cerveau"
        />
        
        <KPIWidget 
            title="Sources Récentes" 
            value={recentSources.length > 0 ? recentSources[0].title.substring(0,25)+(recentSources[0].title.length > 25 ? "..." : "") : "Aucune"}
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

        <div className="lg:col-span-3"> {/* Section chapitres prend toute la largeur sur lg */}
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
                  {chapters.slice(0, 6).map((chapter) => (
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
                onChange={(e) => setCurrentChapterForModal(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
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
                onChange={(e) => setCurrentChapterForModal(prev => prev ? ({ ...prev, progress: e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0 }) : null)}
                disabled={isSavingChapter}
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="dashChapterStatusModal" className="block text-sm font-medium mb-1.5">Statut</Label>
              <Input
                id="dashChapterStatusModal"
                value={currentChapterForModal?.status || ''}
                onChange={(e) => setCurrentChapterForModal(prev => prev ? ({ ...prev, status: e.target.value }) : null)}
                placeholder="ex : En cours"
                disabled={isSavingChapter}
                className="text-sm"
              />
            </div>
          </div>
          <DialogComponents.DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => {if(!isSavingChapter) {setIsChapterModalOpen(false); setCurrentChapterForModal(null);}}} disabled={isSavingChapter}>Annuler</Button>
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


"use client";

import { useState, useEffect, useRef, useCallback, type FC } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import type { PomodoroSession, Task, DailyObjective, Chapter } from '@/types';
import { Play, Pause, RotateCcw, Loader2, Timer, ListChecks, Hourglass } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams, useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import PomodoroLogItem from './pomodoro-components/PomodoroLogItem';
import { ScrollArea } from '@/components/ui/scroll-area';

const DEFAULT_SESSION_DURATION = 25;
const MAX_SESSION_DURATION = 120;
const MIN_SESSION_DURATION = 5;
const NONE_VALUE = "none"; // Constant for "none" selection

export function PomodoroSection() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_SESSION_DURATION);
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [pomodoroLog, setPomodoroLog] = useState<PomodoroSession[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [linkedTaskId, setLinkedTaskId] = useState<string | undefined>(undefined);
  const [linkedObjectiveId, setLinkedObjectiveId] = useState<string | undefined>(undefined);
  const [linkedChapterId, setLinkedChapterId] = useState<string | undefined>(undefined);
  const [contextText, setContextText] = useState('');

  const [tasks, setTasks] = useState<Pick<Task, 'id' | 'text'>[]>([]);
  const [objectives, setObjectives] = useState<Pick<DailyObjective, 'id' | 'text'>[]>([]);
  const [chapters, setChapters] = useState<Pick<Chapter, 'id' | 'name'>[]>([]);

  const [isLogging, setIsLogging] = useState(false);
  const [isFetchingLog, setIsFetchingLog] = useState(true);
  const [isFetchingLinkableItems, setIsFetchingLinkableItems] = useState(true);

  const { toast } = useToast();

  const fetchLinkableItems = useCallback(async () => {
    if (!user) {
      setIsFetchingLinkableItems(false);
      setTasks([]);
      setObjectives([]);
      setChapters([]);
      return;
    }
    setIsFetchingLinkableItems(true);
    try {
      const [tasksRes, objectivesRes, chaptersRes] = await Promise.all([
        supabase.from('tasks').select('id, text').eq('user_id', user.id).eq('completed', false).order('created_at', { ascending: false }).limit(50),
        supabase.from('daily_objectives').select('id, text').eq('user_id', user.id).eq('completed', false).order('objective_date', { ascending: false }).limit(50),
        supabase.from('chapters').select('id, name').eq('user_id', user.id).order('name').limit(50)
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (objectivesRes.error) throw objectivesRes.error;
      if (chaptersRes.error) throw chaptersRes.error;
      
      setTasks(tasksRes.data || []);
      setObjectives(objectivesRes.data || []);
      setChapters(chaptersRes.data?.map(c => ({ id: c.id, name: c.name })) || []);
    } catch (e: any) {
      toast({ title: "Erreur", description: "Impossible de charger les éléments à lier.", variant: "destructive" });
      console.error("Erreur fetchLinkableItems:", e);
    } finally {
      setIsFetchingLinkableItems(false);
    }
  }, [user, toast]);

  useEffect(() => {
    const taskIdParam = searchParams.get('taskId');
    const taskTextParam = searchParams.get('taskText');
    const objectiveIdParam = searchParams.get('objectiveId');
    const chapterIdParam = searchParams.get('chapterId');

    let newContextText = '';
    if (taskTextParam) newContextText = `Pomodoro pour la tâche : ${decodeURIComponent(taskTextParam)}`;
    setContextText(newContextText);

    setLinkedTaskId(taskIdParam || undefined);
    setLinkedObjectiveId(objectiveIdParam || undefined);
    setLinkedChapterId(chapterIdParam || undefined);

    if (user) {
      fetchLinkableItems();
    }
    // Optionnel: router.replace(pathname, undefined);
  }, [searchParams, user, fetchLinkableItems, router]);


  const fetchPomodoroLog = useCallback(async () => {
    if (!user) {
      setPomodoroLog([]);
      setIsFetchingLog(false);
      return;
    }
    setIsFetchingLog(true);
    try {
      const { data, error } = await supabase
        .from('pomodoro_sessions')
        .select('*, tasks(id,text), daily_objectives(id,text), chapters(id,name)')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false })
        .limit(20);
      if (error) throw error;
      setPomodoroLog((data || []).map(s => ({ ...s, user_id: user.id })));
    } catch (e: any) {
      toast({ title: "Erreur", description: "Impossible de charger le journal Pomodoro.", variant: "destructive" });
      console.error("Erreur fetchPomodoroLog:", e);
    } finally {
      setIsFetchingLog(false);
    }
  }, [toast, user]);

  useEffect(() => {
    if(user) { // Ensure user is available before fetching
        fetchPomodoroLog();
    }
  }, [user, fetchPomodoroLog]); // Add user as a dependency

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`db-pomodoro-section-user-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pomodoro_sessions', filter: `user_id=eq.${user.id}` }, 
        (payload) => {
          fetchPomodoroLog();
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchPomodoroLog]);

  useEffect(() => { setTimeLeft(durationMinutes * 60); }, [durationMinutes]);

  const logSession = useCallback(async (completed: boolean) => {
    if (!user || isLogging) return;
    setIsLogging(true);
    try {
      const actualDurationUsed = durationMinutes - Math.floor(timeLeft / 60);
      const sessionStartTime = new Date(Date.now() - (actualDurationUsed * 60 * 1000));

      const newSessionPayload = {
        user_id: user.id,
        start_time: sessionStartTime.toISOString(),
        duration: actualDurationUsed > 0 ? actualDurationUsed : durationMinutes, // Log the intended duration if reset before 1 min
        notes: sessionNotes.trim() || null,
        task_id: linkedTaskId || null,
        daily_objective_id: linkedObjectiveId || null,
        chapter_id: linkedChapterId || null,
      };
      
      const { data: newSession, error } = await supabase
        .from('pomodoro_sessions')
        .insert(newSessionPayload)
        .select('*, tasks(id,text), daily_objectives(id,text), chapters(id,name)')
        .single();
      
      if (error) throw error;

      if (newSession) {
        setPomodoroLog(prevLog => [{ ...newSession, user_id: user.id } as PomodoroSession, ...prevLog.slice(0, 19)]);
      }

      setSessionNotes(contextText || ''); // Reset notes to context or empty
      toast({ title: "Session enregistrée" });
    } catch (e: any) {
      toast({ title: "Erreur d'enregistrement", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur logSession:", e);
    } finally {
      setIsLogging(false);
    }
  }, [user, durationMinutes, timeLeft, sessionNotes, linkedTaskId, linkedObjectiveId, linkedChapterId, toast, contextText, isLogging]);

  useEffect(() => {
    if (isActive && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timerRef.current!);
            setIsActive(false);
            logSession(true);
            toast({ title: "Session Pomodoro terminée !", description: "Prenez une petite pause." });
            audioRef.current?.play().catch(e => console.warn("Erreur lecture audio:", e));
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current!);
    }
    return () => clearInterval(timerRef.current!);
  }, [isActive, isPaused, logSession, toast]);

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isActive) return;
    let newDuration = parseInt(e.target.value, 10);
    if (isNaN(newDuration)) newDuration = DEFAULT_SESSION_DURATION;
    if (newDuration < MIN_SESSION_DURATION) newDuration = MIN_SESSION_DURATION;
    if (newDuration > MAX_SESSION_DURATION) newDuration = MAX_SESSION_DURATION;
    setDurationMinutes(newDuration);
  };

  const toggleTimer = () => {
    if (!user) {
      toast({ title: "Authentification requise", description: "Veuillez vous connecter pour utiliser le minuteur.", variant: "destructive" });
      return;
    }
    if (!isActive) {
      setIsActive(true); setIsPaused(false); setTimeLeft(durationMinutes * 60);
      if (contextText && !sessionNotes) setSessionNotes(contextText); // Pre-fill notes if context exists and notes are empty
    } else {
      setIsPaused(!isPaused);
    }
  };

  const resetTimer = () => {
    if (isActive) { logSession(false); }
    setIsActive(false); setIsPaused(false); setTimeLeft(durationMinutes * 60);
  };

  const deleteLogItem = async (id: string) => {
    if (!user || isLogging) return;
    setIsLogging(true); // Use isLogging to disable delete button during any logging/deleting operation
    try {
      const { error } = await supabase.from('pomodoro_sessions').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      setPomodoroLog(prevLog => prevLog.filter(session => session.id !== id));
      toast({ title: "Session supprimée du journal" });
    } catch (e: any) {
      toast({ title: "Erreur de suppression", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur deleteLogItem:", e);
    } finally {
      setIsLogging(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60); const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercentage = ((durationMinutes * 60 - timeLeft) / (durationMinutes * 60)) * 100;

  useEffect(() => {
    if (typeof window !== "undefined") { audioRef.current = new Audio('/sounds/notification.mp3'); audioRef.current.load(); }
  }, []);

  if (!user && isFetchingLinkableItems && isFetchingLog) {
     return (
        <div className="p-4 md:p-6 h-full flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-3" />
            <p className="text-muted-foreground">Chargement...</p>
        </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex items-center gap-3">
        <Timer className="h-7 w-7 text-primary" />
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Minuteur & Journal Pomodoro</h1>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="items-center pt-6 pb-4">
          <CardTitle className="text-5xl md:text-6xl font-mono tracking-wider text-primary">{formatTime(timeLeft)}</CardTitle>
          <CardDescription className="text-center text-sm md:text-base pt-1">Concentrez-vous pendant {durationMinutes} minutes.</CardDescription>
          {contextText && <p className="text-sm text-center text-muted-foreground pt-1">{contextText}</p>}
        </CardHeader>
        <CardContent className="space-y-4 px-4 md:px-6 pb-4">
          <Progress value={isActive ? progressPercentage : 0} className="w-full h-3 md:h-4" />
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <Label htmlFor="duration" className="text-sm font-medium whitespace-nowrap">Durée (min) :</Label>
            <Input id="duration" type="number" value={durationMinutes} onChange={handleDurationChange} min={MIN_SESSION_DURATION} max={MAX_SESSION_DURATION} className="w-full sm:w-24 text-center text-sm h-9" disabled={isActive || isLogging} />
          </div>
          <Textarea placeholder="Sur quoi travaillez-vous ? (Optionnel)" value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} rows={2} className="text-sm" disabled={isLogging || !user} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t">
            <Select 
              onValueChange={(value) => setLinkedTaskId(value === NONE_VALUE ? undefined : value)} 
              value={linkedTaskId || NONE_VALUE} 
              disabled={isActive || !!searchParams.get('taskId') || isFetchingLinkableItems || !user}
            >
              <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Lier à une Tâche..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Aucune Tâche</SelectItem>
                {tasks.map(t => <SelectItem key={t.id} value={t.id}>{t.text.substring(0, 30)}{t.text.length > 30 ? '...' : ''}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select 
              onValueChange={(value) => setLinkedObjectiveId(value === NONE_VALUE ? undefined : value)} 
              value={linkedObjectiveId || NONE_VALUE} 
              disabled={isActive || !!searchParams.get('objectiveId') || isFetchingLinkableItems || !user}
            >
              <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Lier à un Objectif..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Aucun Objectif</SelectItem>
                {objectives.map(o => <SelectItem key={o.id} value={o.id}>{o.text.substring(0, 30)}{o.text.length > 30 ? '...' : ''}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select 
              onValueChange={(value) => setLinkedChapterId(value === NONE_VALUE ? undefined : value)} 
              value={linkedChapterId || NONE_VALUE} 
              disabled={isActive || !!searchParams.get('chapterId') || isFetchingLinkableItems || !user}
            >
              <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Lier à un Chapitre..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Aucun Chapitre</SelectItem>
                {chapters.map(c => <SelectItem key={c.id} value={c.id}>{c.name.substring(0, 30)}{c.name.length > 30 ? '...' : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3 p-4 md:p-6 border-t">
          <Button onClick={toggleTimer} size="lg" className="w-full sm:w-40 text-base py-3" disabled={isLogging || !user}>
            {isActive && !isPaused ? <Pause className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />}
            {isActive && !isPaused ? 'Pause' : (isActive && isPaused ? 'Reprendre' : 'Démarrer')}
          </Button>
          <Button onClick={resetTimer} variant="outline" size="lg" disabled={isLogging || (!isActive && timeLeft === durationMinutes * 60) || !user} className="w-full sm:w-40 text-base py-3">
            <RotateCcw className="mr-2 h-5 w-5" /> Réinitialiser
          </Button>
        </CardFooter>
      </Card>

      <Card className="flex-grow flex flex-col shadow-md overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Journal des Sessions</CardTitle>
          <CardDescription className="text-xs md:text-sm">Historique de vos sessions Pomodoro.</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow p-0">
          <ScrollArea className="h-full custom-scrollbar">
            <div className="p-3 md:p-4">
              {!user && !isFetchingLog ? (
                <div className="flex flex-col items-center justify-center text-center py-10 text-muted-foreground">
                  <Hourglass className="mx-auto h-12 w-12 opacity-40 mb-3" />
                  <p className="font-medium">Connectez-vous pour voir votre journal.</p>
                </div>
              ) : isFetchingLog ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="mt-3 text-muted-foreground">Chargement du journal...</p>
                </div>
              ) : pomodoroLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-10 text-muted-foreground">
                  <Hourglass className="mx-auto h-12 w-12 opacity-40 mb-3" />
                  <p className="font-medium text-lg mb-1">Aucune session enregistrée.</p>
                  <p className="text-sm mb-4">Utilisez le minuteur pour commencer à suivre vos sessions de travail !</p>
                  <Button onClick={() => document.getElementById('duration')?.focus()} size="sm" disabled={!user}>
                    <Timer className="mr-2 h-4 w-4" /> Démarrer une session
                  </Button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {pomodoroLog.map((session) => (
                    <PomodoroLogItem key={session.id} session={session} onDelete={deleteLogItem} isLoading={isLogging} />
                  ))}
                </ul>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

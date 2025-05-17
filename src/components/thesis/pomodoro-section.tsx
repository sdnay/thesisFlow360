
"use client";

import { useState, useEffect, useRef, type FC, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Assurez-vous que Label est importé
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import type { PomodoroSession, Task, DailyObjective, Chapter } from '@/types';
import { Play, Pause, RotateCcw, Trash2, Loader2, Timer, ListChecks, Link as LinkIconLucide, Target as TargetIcon, ListTree } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useSearchParams, useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth'; // Ajouté

const DEFAULT_SESSION_DURATION = 25;
const MAX_SESSION_DURATION = 120;
const MIN_SESSION_DURATION = 5;

interface PomodoroLogItemProps {
  session: PomodoroSession;
  onDelete: (id: string) => Promise<void>;
  isLoading: boolean;
}

const PomodoroLogItem: FC<PomodoroLogItemProps> = ({ session, onDelete, isLoading }) => {
  return (
    <li className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3.5 border rounded-lg bg-card hover:bg-muted/30 transition-colors shadow-sm">
      <div className="flex-grow mb-2 sm:mb-0 space-y-1">
        <p className="text-sm font-medium">Session de <span className="text-primary font-semibold">{session.duration} min</span></p>
        <p className="text-xs text-muted-foreground">{format(new Date(session.start_time), "eeee d MMMM yyyy 'à' HH:mm", { locale: fr })}</p>
        {session.notes && <p className="text-xs text-foreground mt-1.5 pt-1.5 border-t border-dashed whitespace-pre-wrap">Notes : {session.notes}</p>}
        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
            {session.tasks && <span className="flex items-center gap-1"><ListChecks className="h-3 w-3"/> Tâche: {session.tasks.text.substring(0,30)}{session.tasks.text.length > 30 ? '...' : ''}</span>}
            {session.daily_objectives && <span className="flex items-center gap-1"><TargetIcon className="h-3 w-3"/> Obj: {session.daily_objectives.text.substring(0,30)}{session.daily_objectives.text.length > 30 ? '...' : ''}</span>}
            {session.chapters && <span className="flex items-center gap-1"><ListTree className="h-3 w-3"/> Chap: {session.chapters.name.substring(0,30)}{session.chapters.name.length > 30 ? '...' : ''}</span>}
        </div>
      </div>
       <Button variant="ghost" size="icon" onClick={() => onDelete(session.id)} aria-label="Supprimer" className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 h-8 w-8 self-start sm:self-center" disabled={isLoading}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
};

export function PomodoroSection() {
  const { user } = useAuth(); // Ajouté
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

  const [linkedTaskId, setLinkedTaskId] = useState<string | undefined>(searchParams.get('taskId') || undefined);
  const [linkedObjectiveId, setLinkedObjectiveId] = useState<string | undefined>(searchParams.get('objectiveId') || undefined);
  const [linkedChapterId, setLinkedChapterId] = useState<string | undefined>(searchParams.get('chapterId') || undefined);
  const [contextText, setContextText] = useState('');

  const [tasks, setTasks] = useState<Pick<Task, 'id' | 'text'>[]>([]);
  const [objectives, setObjectives] = useState<Pick<DailyObjective, 'id' | 'text'>[]>([]);
  const [chapters, setChapters] = useState<Pick<Chapter, 'id' | 'name'>[]>([]);

  const [isLogging, setIsLogging] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const { toast } = useToast();

  const fetchLinkableItems = useCallback(async () => {
    if (!user) return;
    const [tasksRes, objectivesRes, chaptersRes] = await Promise.all([
        supabase.from('tasks').select('id, text').eq('user_id', user.id).eq('completed', false).order('created_at', {ascending: false}).limit(50),
        supabase.from('daily_objectives').select('id, text').eq('user_id', user.id).eq('completed', false).order('objective_date', {ascending: false}).limit(50),
        supabase.from('chapters').select('id, name').eq('user_id', user.id).order('name').limit(50)
    ]);
    if(tasksRes.data) setTasks(tasksRes.data);
    if(objectivesRes.data) setObjectives(objectivesRes.data);
    if(chaptersRes.data) setChapters(chaptersRes.data.map(c => ({id: c.id, name: c.name})));
  }, [user]);


  useEffect(() => {
    const taskTextParam = searchParams.get('taskText');
    const objectiveTextParam = searchParams.get('objectiveText');
    const chapterNameParam = searchParams.get('chapterName');

    if (taskTextParam) setContextText(`Pomodoro pour la tâche : ${decodeURIComponent(taskTextParam)}`);
    else if (objectiveTextParam) setContextText(`Pomodoro pour l'objectif : ${decodeURIComponent(objectiveTextParam)}`);
    else if (chapterNameParam) setContextText(`Pomodoro pour le chapitre : ${decodeURIComponent(chapterNameParam)}`);
    else setContextText(''); // Reset si aucun paramètre pertinent

    setLinkedTaskId(searchParams.get('taskId') || undefined);
    setLinkedObjectiveId(searchParams.get('objectiveId') || undefined);
    setLinkedChapterId(searchParams.get('chapterId') || undefined);

    if (user) {
      fetchLinkableItems();
    }
     // Ne pas nettoyer les params d'URL ici pour permettre le rafraîchissement
  }, [searchParams, user, fetchLinkableItems]);


  const fetchPomodoroLog = useCallback(async () => {
    if (!user) return;
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('pomodoro_sessions')
        .select('*, tasks(id,text), daily_objectives(id,text), chapters(id,name)')
        .eq('user_id', user.id) // Filtrer par user_id
        .order('start_time', { ascending: false })
        .limit(20);
      if (error) throw error;
      setPomodoroLog((data || []).map(s => ({...s, user_id: user.id })));
    } catch (e: any) {
        toast({ title: "Erreur", description: "Impossible de charger le journal Pomodoro.", variant: "destructive" });
    }
    finally { setIsFetching(false); }
  }, [toast, user]); // Ajout de user aux dépendances

  useEffect(() => {
    if (user) {
      fetchPomodoroLog();
    }
  }, [user, fetchPomodoroLog]); // Déclencher si user change

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('db-pomodoro-page-auth')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pomodoro_sessions', filter: `user_id=eq.${user.id}` }, () => fetchPomodoroLog())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchPomodoroLog]); // S'abonner/se désabonner si user change

  useEffect(() => { setTimeLeft(durationMinutes * 60); }, [durationMinutes]);

  const logSession = useCallback(async (completed: boolean) => {
    if (!user) return;
    setIsLogging(true);
    try {
      const actualDurationUsed = durationMinutes - Math.floor(timeLeft / 60);
      const sessionStartTime = new Date(Date.now() - (actualDurationUsed * 60 * 1000));

      const newSessionPayload = {
        user_id: user.id, // Ajouté
        start_time: sessionStartTime.toISOString(),
        duration: actualDurationUsed > 0 ? actualDurationUsed : durationMinutes,
        notes: sessionNotes.trim() || null,
        task_id: linkedTaskId || null,
        daily_objective_id: linkedObjectiveId || null,
        chapter_id: linkedChapterId || null,
      };
      // @ts-ignore
      const { data: newSession, error } = await supabase.from('pomodoro_sessions').insert(newSessionPayload).select('*, tasks(id,text), daily_objectives(id,text), chapters(id,name)').single();
      if (error) throw error;

      if(newSession) {
        setPomodoroLog(prevLog => [{...newSession, user_id: user.id}, ...prevLog]);
      }

      setSessionNotes(contextText || ''); // Réinitialiser avec le contexte ou vide
      // Conserver les IDs liés si l'utilisateur veut enchaîner sur la même tâche/objectif
      toast({ title: "Session enregistrée" });
    } catch (e: any) {
        toast({ title: "Erreur d'enregistrement", description: (e as Error).message, variant: "destructive" });
    }
    finally { setIsLogging(false); }
  }, [durationMinutes, timeLeft, sessionNotes, linkedTaskId, linkedObjectiveId, linkedChapterId, toast, user, contextText]);

  useEffect(() => {
     if (isActive && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timerRef.current!);
            setIsActive(false);
            logSession(true);
            toast({ title: "Session Pomodoro terminée !", description: "Prenez une petite pause."});
            audioRef.current?.play();
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
    if (!isActive) {
      setIsActive(true); setIsPaused(false); setTimeLeft(durationMinutes * 60);
      if (contextText && !sessionNotes) setSessionNotes(contextText);
    } else {
      setIsPaused(!isPaused);
    }
  };
  const resetTimer = () => {
    if (isActive) { logSession(false); }
    setIsActive(false); setIsPaused(false); setTimeLeft(durationMinutes * 60);
  };

  const deleteLogItem = async (id: string) => {
    if (!user) return;
    setIsLogging(true); // Peut utiliser un autre état de chargement si besoin
    try {
      const { error } = await supabase.from('pomodoro_sessions').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      setPomodoroLog(prevLog => prevLog.filter(session => session.id !== id));
      toast({ title: "Session supprimée" });
    } catch (e: any) {
       toast({ title: "Erreur de suppression", description: (e as Error).message, variant: "destructive" });
    }
    finally { setIsLogging(false); }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60); const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };
  const progressPercentage = ((durationMinutes * 60 - timeLeft) / (durationMinutes * 60)) * 100;
  useEffect(() => {
    if (typeof window !== "undefined") { audioRef.current = new Audio('/sounds/notification.mp3'); audioRef.current.load(); }
  }, []);
  
  if (!user && isFetching) {
     return (
        <div className="p-4 md:p-6 h-full flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-3" />
            <p className="text-muted-foreground">Chargement...</p>
        </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex items-center gap-3"><Timer className="h-7 w-7 text-primary" /><h1 className="text-xl md:text-2xl font-semibold tracking-tight">Minuteur & Journal Pomodoro</h1></div>

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
            <Input id="duration" type="number" value={durationMinutes} onChange={handleDurationChange} min={MIN_SESSION_DURATION} max={MAX_SESSION_DURATION} className="w-full sm:w-24 text-center text-sm" disabled={isActive || isLogging} />
          </div>
          <Textarea placeholder="Sur quoi travaillez-vous ? (Optionnel)" value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} rows={2} className="text-sm" disabled={isLogging} />

          {/* Section pour lier manuellement */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-2 border-t">
              <Select onValueChange={setLinkedTaskId} value={linkedTaskId || "none"} disabled={isActive || !!searchParams.get('taskId')}>
                  <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Lier à une Tâche..."/></SelectTrigger>
                  <SelectContent><SelectItem value="none">Aucune Tâche</SelectItem>{tasks.map(t => <SelectItem key={t.id} value={t.id}>{t.text.substring(0,30)}...</SelectItem>)}</SelectContent>
              </Select>
               <Select onValueChange={setLinkedObjectiveId} value={linkedObjectiveId || "none"} disabled={isActive || !!searchParams.get('objectiveId')}>
                  <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Lier à un Objectif..."/></SelectTrigger>
                  <SelectContent><SelectItem value="none">Aucun Objectif</SelectItem>{objectives.map(o => <SelectItem key={o.id} value={o.id}>{o.text.substring(0,30)}...</SelectItem>)}</SelectContent>
              </Select>
               <Select onValueChange={setLinkedChapterId} value={linkedChapterId || "none"} disabled={isActive || !!searchParams.get('chapterId')}>
                  <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Lier à un Chapitre..."/></SelectTrigger>
                  <SelectContent><SelectItem value="none">Aucun Chapitre</SelectItem>{chapters.map(c => <SelectItem key={c.id} value={c.id}>{c.name.substring(0,30)}...</SelectItem>)}</SelectContent>
              </Select>
          </div>

        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3 p-4 md:p-6 border-t">
          <Button onClick={toggleTimer} size="lg" className="w-full sm:w-36" disabled={isLogging}>{isActive && !isPaused ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />} {isActive && !isPaused ? 'Pause' : (isActive && isPaused ? 'Reprendre' : 'Démarrer')}</Button>
          <Button onClick={resetTimer} variant="outline" size="lg" disabled={isLogging || (!isActive && timeLeft === durationMinutes * 60)} className="w-full sm:w-36"><RotateCcw className="h-5 w-5" /> Réinitialiser</Button>
        </CardFooter>
      </Card>

      <Card className="flex-grow flex flex-col shadow-md overflow-hidden">
        <CardHeader><CardTitle className="text-lg md:text-xl">Journal des Sessions</CardTitle><CardDescription className="text-xs md:text-sm">Historique de vos sessions.</CardDescription></CardHeader>
        <CardContent className="flex-grow overflow-y-auto space-y-3 p-4 custom-scrollbar">
          {isFetching ? ( <div className="flex-grow flex justify-center items-center py-10"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Chargement...</p></div>
          ) : pomodoroLog.length === 0 ? ( <div className="flex-grow flex flex-col items-center justify-center text-center p-6 text-muted-foreground border-dashed border rounded-md"><ListChecks className="mx-auto h-16 w-16 opacity-50 mb-4"/><p className="font-medium text-lg mb-1">Aucune session.</p><p className="text-sm mb-4">Utilisez le minuteur pour enregistrer vos sessions !</p><Button onClick={() => document.getElementById('duration')?.focus()}><Timer className="mr-2 h-4 w-4"/> Démarrer une session</Button></div>
          ) : ( <ul className="space-y-3">{pomodoroLog.map((session) => <PomodoroLogItem key={session.id} session={session} onDelete={deleteLogItem} isLoading={isLogging}/>)}</ul> )}
        </CardContent>
      </Card>
    </div>
  );
}

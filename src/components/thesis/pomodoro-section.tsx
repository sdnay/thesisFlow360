
"use client";

import { useState, useEffect, useRef, type FC, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import type { PomodoroSession, Task, DailyObjective, Chapter } from '@/types'; // Chapter, Task, DailyObjective importés
import { Play, Pause, RotateCcw, Trash2, Loader2, Timer, ListChecks, Link as LinkIcon } from 'lucide-react'; 
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useSearchParams, useRouter } from 'next/navigation'; // Pour lire les params d'URL
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


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
        {/* Affichage des éléments liés */}
        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
            {session.tasks && <span className="flex items-center gap-1"><ListChecks className="h-3 w-3"/> Tâche: {session.tasks.text}</span>}
            {session.daily_objectives && <span className="flex items-center gap-1"><Target className="h-3 w-3"/> Obj: {session.daily_objectives.text}</span>}
            {session.chapters && <span className="flex items-center gap-1"><ListTree className="h-3 w-3"/> Chap: {session.chapters.name}</span>}
        </div>
      </div>
       <Button variant="ghost" size="icon" onClick={() => onDelete(session.id)} aria-label="Supprimer" className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 h-8 w-8 self-start sm:self-center" disabled={isLoading}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
};

export function PomodoroSection() {
  const searchParams = useSearchParams();
  const router = useRouter(); // Pour nettoyer les params d'URL

  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_SESSION_DURATION);
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [pomodoroLog, setPomodoroLog] = useState<PomodoroSession[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // États pour lier la session
  const [linkedTaskId, setLinkedTaskId] = useState<string | undefined>(searchParams.get('taskId') || undefined);
  const [linkedObjectiveId, setLinkedObjectiveId] = useState<string | undefined>(searchParams.get('objectiveId') || undefined);
  const [linkedChapterId, setLinkedChapterId] = useState<string | undefined>(searchParams.get('chapterId') || undefined);
  const [contextText, setContextText] = useState(''); // Pour afficher "Pomodoro pour : [texte de la tâche/objectif]"

  const [isLogging, setIsLogging] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const { toast } = useToast();

  // Charger les tâches, objectifs, chapitres pour les sélecteurs de liaison (optionnel, si on veut lier manuellement)
  // Pour l'instant, on se base sur les params d'URL.
  const [tasks, setTasks] = useState<Pick<Task, 'id' | 'text'>[]>([]);
  const [objectives, setObjectives] = useState<Pick<DailyObjective, 'id' | 'text'>[]>([]);
  const [chapters, setChapters] = useState<Pick<Chapter, 'id' | 'name'>[]>([]);


  // Pré-remplir les notes si un contexte est passé par URL
  useEffect(() => {
    const taskText = searchParams.get('taskText');
    const objectiveText = searchParams.get('objectiveText');
    const chapterName = searchParams.get('chapterName');

    if (taskText) setContextText(`Pomodoro pour la tâche : ${decodeURIComponent(taskText)}`);
    else if (objectiveText) setContextText(`Pomodoro pour l'objectif : ${decodeURIComponent(objectiveText)}`);
    else if (chapterName) setContextText(`Pomodoro pour le chapitre : ${decodeURIComponent(chapterName)}`);
    
    // Optionnel : charger la liste des items pour liaison manuelle si besoin
    const fetchLinkableItems = async () => {
        const [tasksRes, objectivesRes, chaptersRes] = await Promise.all([
            supabase.from('tasks').select('id, text').eq('completed', false).order('created_at', {ascending: false}).limit(50),
            supabase.from('daily_objectives').select('id, text').eq('completed', false).order('objective_date', {ascending: false}).limit(50),
            supabase.from('chapters').select('id, name').order('name').limit(50)
        ]);
        if(tasksRes.data) setTasks(tasksRes.data);
        if(objectivesRes.data) setObjectives(objectivesRes.data);
        if(chaptersRes.data) setChapters(chaptersRes.data.map(c => ({id: c.id, name: c.name})));
    };
    fetchLinkableItems();

    // Nettoyer les params d'URL après lecture pour éviter qu'ils ne persistent
    // Ceci peut être fait après le premier démarrage de session par exemple
    // router.replace('/pomodoro', { scroll: false }); 
  }, [searchParams, router]);


  const fetchPomodoroLog = useCallback(async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('pomodoro_sessions')
        .select('*, tasks(id,text), daily_objectives(id,text), chapters(id,name)') // Charger les relations
        .order('start_time', { ascending: false })
        .limit(20);
      if (error) throw error;
      setPomodoroLog(data || []);
    } catch (e: any) { /* ... gestion erreur ... */ } 
    finally { setIsFetching(false); }
  }, [toast]);

  useEffect(() => { fetchPomodoroLog(); /* ... abonnement Supabase (comme avant) ... */ 
     const channel = supabase
      .channel('db-pomodoro-page-integrated')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pomodoro_sessions' }, fetchPomodoroLog)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPomodoroLog]);

  useEffect(() => { setTimeLeft(durationMinutes * 60); }, [durationMinutes]);

  const logSession = useCallback(async (completed: boolean) => {
    setIsLogging(true);
    try {
      const actualDurationUsed = durationMinutes - Math.floor(timeLeft / 60);
      const sessionStartTime = new Date(Date.now() - (actualDurationUsed * 60 * 1000));
      
      const newSessionPayload: Omit<PomodoroSession, 'id' | 'created_at'> = {
        start_time: sessionStartTime.toISOString(),
        duration: actualDurationUsed > 0 ? actualDurationUsed : durationMinutes,
        notes: sessionNotes.trim() || null,
        task_id: linkedTaskId || null,
        daily_objective_id: linkedObjectiveId || null,
        chapter_id: linkedChapterId || null,
        // completed: completed, // Si vous avez ajouté cette colonne
      };
      const { data: newSession, error } = await supabase.from('pomodoro_sessions').insert(newSessionPayload).select().single();
      if (error) throw error;
      if(newSession) {
        // Mise à jour manuelle de l'état pour une UI instantanée
        // Re-fetch des relations pour affichage correct dans la liste
        const { data: fetchedNewSession, error: fetchError } = await supabase
          .from('pomodoro_sessions')
          .select('*, tasks(id,text), daily_objectives(id,text), chapters(id,name)')
          .eq('id', newSession.id)
          .single();
        
        if (fetchError || !fetchedNewSession) {
            console.warn("N'a pas pu re-fetcher la nouvelle session avec relations, affichage via Realtime.");
            // fetchPomodoroLog(); // ou laisser Realtime faire
        } else {
            setPomodoroLog(prevLog => [fetchedNewSession, ...prevLog]);
        }
      }
      
      setSessionNotes(''); 
      // Optionnel: Reset les IDs liés après enregistrement
      // setLinkedTaskId(undefined); setLinkedObjectiveId(undefined); setLinkedChapterId(undefined); setContextText('');
      // router.replace('/pomodoro', { scroll: false }); // Nettoie les params d'URL
      toast({ title: "Session enregistrée" });
    } catch (e: any) { /* ... gestion erreur ... */ } 
    finally { setIsLogging(false); }
  }, [durationMinutes, timeLeft, sessionNotes, linkedTaskId, linkedObjectiveId, linkedChapterId, toast]);

  useEffect(() => { /* ... (logique du timer comme avant, appelant logSession) ... */ 
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

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... (comme avant) ... */ 
    if (isActive) return;
    let newDuration = parseInt(e.target.value, 10);
    if (isNaN(newDuration)) newDuration = DEFAULT_SESSION_DURATION;
    if (newDuration < MIN_SESSION_DURATION) newDuration = MIN_SESSION_DURATION;
    if (newDuration > MAX_SESSION_DURATION) newDuration = MAX_SESSION_DURATION;
    setDurationMinutes(newDuration);
  };
  const toggleTimer = () => { /* ... (comme avant) ... */ 
    if (!isActive) { 
      setIsActive(true); setIsPaused(false); setTimeLeft(durationMinutes * 60); 
      if (contextText && !sessionNotes) setSessionNotes(contextText); // Pré-remplir les notes avec le contexte
    } else { 
      setIsPaused(!isPaused);
    }
  };
  const resetTimer = () => { /* ... (comme avant, appelant logSession(false) si active) ... */ 
    if (isActive) { logSession(false); }
    setIsActive(false); setIsPaused(false); setTimeLeft(durationMinutes * 60);
    // setSessionNotes(''); // Conserver les notes si l'utilisateur veut redémarrer pour la même chose
  };
  const deleteLogItem = async (id: string) => { /* ... (comme avant, mise à jour manuelle de l'état) ... */ 
    setIsLogging(true);
    try {
      const { error } = await supabase.from('pomodoro_sessions').delete().eq('id', id);
      if (error) throw error;
      setPomodoroLog(prevLog => prevLog.filter(session => session.id !== id));
      toast({ title: "Session supprimée" });
    } catch (e: any) { /* ... */ } 
    finally { setIsLogging(false); }
  };

  const formatTime = (seconds: number) => { /* ... (comme avant) ... */ 
    const m = Math.floor(seconds / 60); const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };
  const progressPercentage = ((durationMinutes * 60 - timeLeft) / (durationMinutes * 60)) * 100;
  useEffect(() => { /* ... (audioRef comme avant) ... */ 
    if (typeof window !== "undefined") { audioRef.current = new Audio('/sounds/notification.mp3'); audioRef.current.load(); }
  }, []);

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
          
          {/* Section optionnelle pour lier manuellement si aucun param URL */}
          {!linkedTaskId && !linkedObjectiveId && !linkedChapterId && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-2 border-t">
                <Select onValueChange={setLinkedTaskId} value={linkedTaskId || "none"} disabled={isActive}>
                    <SelectTrigger><SelectValue placeholder="Lier à une Tâche..."/></SelectTrigger>
                    <SelectContent><SelectItem value="none">Aucune Tâche</SelectItem>{tasks.map(t => <SelectItem key={t.id} value={t.id}>{t.text.substring(0,30)}...</SelectItem>)}</SelectContent>
                </Select>
                 <Select onValueChange={setLinkedObjectiveId} value={linkedObjectiveId || "none"} disabled={isActive}>
                    <SelectTrigger><SelectValue placeholder="Lier à un Objectif..."/></SelectTrigger>
                    <SelectContent><SelectItem value="none">Aucun Objectif</SelectItem>{objectives.map(o => <SelectItem key={o.id} value={o.id}>{o.text.substring(0,30)}...</SelectItem>)}</SelectContent>
                </Select>
                 <Select onValueChange={setLinkedChapterId} value={linkedChapterId || "none"} disabled={isActive}>
                    <SelectTrigger><SelectValue placeholder="Lier à un Chapitre..."/></SelectTrigger>
                    <SelectContent><SelectItem value="none">Aucun Chapitre</SelectItem>{chapters.map(c => <SelectItem key={c.id} value={c.id}>{c.name.substring(0,30)}...</SelectItem>)}</SelectContent>
                </Select>
            </div>
          )}

        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3 p-4 md:p-6 border-t">
          <Button onClick={toggleTimer} size="lg" className="w-full sm:w-36" disabled={isLogging}>{isActive && !isPaused ? <Pause /> : <Play />} {isActive && !isPaused ? 'Pause' : (isActive && isPaused ? 'Reprendre' : 'Démarrer')}</Button>
          <Button onClick={resetTimer} variant="outline" size="lg" disabled={isLogging || (!isActive && timeLeft === durationMinutes * 60)} className="w-full sm:w-36"><RotateCcw /> Réinitialiser</Button>
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

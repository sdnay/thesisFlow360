
"use client";

import { useState, useEffect, useRef, type FC, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import type { PomodoroSession } from '@/types';
import { Play, Pause, RotateCcw, Trash2, Loader2, Timer } from 'lucide-react'; // Removed ListChecks, Save
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';


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
    <li className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 border rounded-lg bg-card hover:bg-muted/30 transition-colors shadow-sm">
      <div className="flex-grow mb-2 sm:mb-0">
        <p className="text-sm font-medium">
          Session de <span className="text-primary font-semibold">{session.duration} min</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(session.start_time), "eeee d MMMM yyyy 'à' HH:mm", { locale: fr })}
        </p>
        {session.notes && <p className="text-xs text-foreground mt-1.5 pt-1.5 border-t border-dashed">Notes : {session.notes}</p>}
      </div>
       <Button variant="ghost" size="icon" onClick={() => onDelete(session.id)} aria-label="Supprimer la session" className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 h-7 w-7 self-start sm:self-center" disabled={isLoading}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
};

export function PomodoroSection() {
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_SESSION_DURATION);
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [pomodoroLog, setPomodoroLog] = useState<PomodoroSession[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isLogging, setIsLogging] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const { toast } = useToast();

  const fetchPomodoroLog = useCallback(async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('pomodoro_sessions')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(20);
      if (error) throw error;
      setPomodoroLog(data || []);
    } catch (e: any) {
      toast({ title: "Erreur", description: "Impossible de charger le journal Pomodoro.", variant: "destructive" });
      console.error("Erreur fetchPomodoroLog:", e);
    } finally {
      setIsFetching(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPomodoroLog();
    const channel = supabase
      .channel('db-pomodoro-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pomodoro_sessions' }, fetchPomodoroLog)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPomodoroLog]);


  useEffect(() => {
    setTimeLeft(durationMinutes * 60);
  }, [durationMinutes]);

  const logSession = useCallback(async (completed: boolean) => {
    setIsLogging(true);
    try {
      const actualDurationUsed = durationMinutes - Math.floor(timeLeft / 60);
      const newSessionPayload: Omit<PomodoroSession, 'id'> = {
        start_time: new Date(Date.now() - (actualDurationUsed * 60 * 1000)).toISOString(),
        duration: actualDurationUsed > 0 ? actualDurationUsed : durationMinutes,
        notes: sessionNotes || (completed ? `Session de ${durationMinutes} min terminée` : `Session de ${durationMinutes} min interrompue`),
      };
      const { error } = await supabase.from('pomodoro_sessions').insert(newSessionPayload);
      if (error) throw error;
      
      setSessionNotes(''); 
      toast({ title: "Session enregistrée" });
    } catch (e: any) {
      toast({ title: "Erreur d'enregistrement", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur logSession:", e);
    } finally {
      setIsLogging(false);
    }
  }, [durationMinutes, timeLeft, sessionNotes, toast]);


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
      setIsActive(true);
      setIsPaused(false);
      setTimeLeft(durationMinutes * 60); 
    } else { 
      setIsPaused(!isPaused);
    }
  };

  const resetTimer = () => {
    if (isActive) { 
        logSession(false); 
    }
    setIsActive(false);
    setIsPaused(false);
    setTimeLeft(durationMinutes * 60);
    setSessionNotes('');
  };
  
  const deleteLogItem = async (id: string) => {
    setIsLogging(true);
    try {
      const { error } = await supabase.from('pomodoro_sessions').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Session supprimée du journal" });
    } catch (e: any) {
      toast({ title: "Erreur de suppression", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur deleteLogItem:", e);
    } finally {
      setIsLogging(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercentage = ((durationMinutes * 60 - timeLeft) / (durationMinutes * 60)) * 100;

  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio('/sounds/notification.mp3'); 
      audioRef.current.load();
    }
  }, []);


  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex items-center gap-3">
        <Timer className="h-7 w-7 text-primary" />
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Minuteur & Journal Pomodoro</h1>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="items-center">
          <CardTitle className="text-5xl md:text-6xl font-mono tracking-wider text-primary">
            {formatTime(timeLeft)}
          </CardTitle>
          <CardDescription className="text-center text-xs md:text-sm">
            Concentrez-vous pendant {durationMinutes} minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 md:px-6">
          <Progress value={isActive ? progressPercentage : 0} className="w-full h-3 md:h-4" />
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <Label htmlFor="duration" className="text-sm font-medium whitespace-nowrap">Durée (min) :</Label>
            <Input
              id="duration"
              type="number"
              value={durationMinutes}
              onChange={handleDurationChange}
              min={MIN_SESSION_DURATION}
              max={MAX_SESSION_DURATION}
              className="w-full sm:w-24 text-center text-sm"
              disabled={isActive || isLogging}
              aria-label="Durée de la session en minutes"
            />
          </div>
          <Textarea
            placeholder="Sur quoi travaillez-vous pendant cette session ? (Optionnel)"
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            rows={2}
            className="text-sm"
            disabled={isLogging}
          />
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3 p-4 md:p-6">
          <Button onClick={toggleTimer} size="lg" className="w-full sm:w-36" disabled={isLogging}>
            {isActive && !isPaused ? <Pause className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />}
            {isActive && !isPaused ? 'Pause' : (isActive && isPaused ? 'Reprendre' : 'Démarrer')}
          </Button>
          <Button onClick={resetTimer} variant="outline" size="lg" disabled={isLogging || (!isActive && timeLeft === durationMinutes * 60)} className="w-full sm:w-36">
            <RotateCcw className="mr-2 h-5 w-5" /> Réinitialiser
          </Button>
        </CardFooter>
      </Card>

      <Card className="flex-grow flex flex-col shadow-md overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Journal des Sessions Pomodoro</CardTitle>
          <CardDescription className="text-xs md:text-sm">Historique de vos sessions de travail.</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow overflow-y-auto space-y-3 p-4 custom-scrollbar">
          {isFetching ? (
            <div className="flex justify-center items-center h-full py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : pomodoroLog.length === 0 ? (
            <div className="text-center py-10">
                <Timer className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3"/>
                <p className="text-muted-foreground">Aucune session enregistrée.</p>
                <p className="text-xs text-muted-foreground">Utilisez le minuteur pour commencer !</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {pomodoroLog.map((session) => (
                <PomodoroLogItem key={session.id} session={session} onDelete={deleteLogItem} isLoading={isLogging}/>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

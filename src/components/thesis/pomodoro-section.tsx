
"use client";

import { useState, useEffect, useRef, type FC, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import type { PomodoroSession } from '@/types';
import { Play, Pause, RotateCcw, ListChecks, Trash2, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_SESSION_DURATION = 25; 
const MAX_SESSION_DURATION = 120; 
const MIN_SESSION_DURATION = 1; 

interface PomodoroLogItemProps {
  session: PomodoroSession;
  onDelete: (id: string) => Promise<void>;
  isLoading: boolean;
}

const PomodoroLogItem: FC<PomodoroLogItemProps> = ({ session, onDelete, isLoading }) => {
  return (
    <li className="flex justify-between items-center p-3 border rounded-md bg-card hover:bg-muted/50">
      <div>
        <p className="text-sm font-medium">
          Session de {session.duration} min - {format(new Date(session.start_time), "d MMM, HH:mm", { locale: fr })}
        </p>
        {session.notes && <p className="text-xs text-muted-foreground mt-1">Notes : {session.notes}</p>}
      </div>
       <Button variant="ghost" size="icon" onClick={() => onDelete(session.id)} aria-label="Supprimer la session" className="text-destructive hover:text-destructive/80" disabled={isLoading}>
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
  const [isLogging, setIsLogging] = useState(false); // For add/delete log item
  const [isFetching, setIsFetching] = useState(true);
  const { toast } = useToast();

  const fetchPomodoroLog = useCallback(async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('pomodoro_sessions')
        .select('*')
        .order('start_time', { ascending: false });
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
  }, [fetchPomodoroLog]);


  useEffect(() => {
    setTimeLeft(durationMinutes * 60);
  }, [durationMinutes]);

  const logSession = useCallback(async (completed: boolean) => {
    setIsLogging(true);
    try {
      const newSessionPayload: Omit<PomodoroSession, 'id'> = {
        start_time: new Date(Date.now() - (durationMinutes * 60 - timeLeft) * 1000).toISOString(), 
        duration: durationMinutes,
        notes: completed ? (sessionNotes || `Session de ${durationMinutes} min terminée`) : (sessionNotes || `Session de ${durationMinutes} min incomplète (réinitialisée)`),
      };
      const { error } = await supabase.from('pomodoro_sessions').insert(newSessionPayload);
      if (error) throw error;
      
      setSessionNotes(''); 
      await fetchPomodoroLog();
      toast({ title: "Session enregistrée" });
    } catch (e: any) {
      toast({ title: "Erreur d'enregistrement", description: e.message, variant: "destructive" });
      console.error("Erreur logSession:", e);
    } finally {
      setIsLogging(false);
    }
  }, [durationMinutes, timeLeft, sessionNotes, fetchPomodoroLog, toast]);


  useEffect(() => {
    if (isActive && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timerRef.current!);
            setIsActive(false);
            logSession(true); 
            toast({ title: "Session Pomodoro terminée !" });
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current!);
    }
    return () => clearInterval(timerRef.current!);
  }, [isActive, isPaused, durationMinutes, logSession, toast]); // Added logSession and toast

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
        logSession(false); // Log as incomplete if reset while active
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
      await fetchPomodoroLog();
      toast({ title: "Session supprimée du journal" });
    } catch (e: any) {
      toast({ title: "Erreur de suppression", description: e.message, variant: "destructive" });
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

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h2 className="text-2xl font-semibold">Minuteur & Journal Pomodoro</h2>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-5xl font-mono tracking-wider">
            {formatTime(timeLeft)}
          </CardTitle>
          <CardDescription className="text-center">
            Définissez la durée de votre session de travail profond (1-120 minutes).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={isActive ? progressPercentage : 0} className="w-full h-3" />
          <div className="flex items-center gap-2">
            <label htmlFor="duration" className="text-sm font-medium">Durée (min) :</label>
            <Input
              id="duration"
              type="number"
              value={durationMinutes}
              onChange={handleDurationChange}
              min={MIN_SESSION_DURATION}
              max={MAX_SESSION_DURATION}
              className="w-20"
              disabled={isActive || isLogging}
            />
          </div>
          <Input
            placeholder="Optionnel : Sur quoi travaillez-vous ?"
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            disabled={!isActive || isLogging} // Disabled if timer not active OR if logging
          />
        </CardContent>
        <CardFooter className="flex justify-center gap-3">
          <Button onClick={toggleTimer} size="lg" className="w-32" disabled={isLogging}>
            {isActive && !isPaused ? <Pause className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />}
            {isActive && !isPaused ? 'Pause' : (isActive && isPaused ? 'Reprendre' : 'Démarrer')}
          </Button>
          <Button onClick={resetTimer} variant="outline" size="lg" disabled={isLogging}>
            <RotateCcw className="mr-2 h-5 w-5" /> Réinitialiser
          </Button>
        </CardFooter>
      </Card>

      
      <Card>
        <CardHeader>
          <CardTitle>Journal des Sessions</CardTitle>
          <CardDescription>Historique de vos sessions de travail profond.</CardDescription>
        </CardHeader>
        <CardContent>
          {isFetching ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : pomodoroLog.length === 0 ? (
            <p className="text-muted-foreground text-center">Aucune session enregistrée pour le moment.</p>
          ) : (
            <ul className="space-y-3 max-h-96 overflow-y-auto">
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

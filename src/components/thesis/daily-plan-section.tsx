
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import type { DailyObjective } from '@/types';
import { PlusCircle, Trash2, Edit3, Loader2, Target, Save, CalendarDays, ChevronLeft, ChevronRight, AlertTriangle, Info, History, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parseISO, startOfDay, isToday, isPast, subDays, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface DailyObjectiveItemProps {
  objective: DailyObjective;
  onToggle: (id: string, completed: boolean, objective_date: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (objective: DailyObjective) => void;
  isLoading: boolean;
  isPastObjective?: boolean;
}

const DailyObjectiveItem: FC<DailyObjectiveItemProps> = ({ objective, onToggle, onDelete, onEdit, isLoading, isPastObjective = false }) => {
  return (
    <div className={cn(
      "flex items-start sm:items-center justify-between p-3.5 rounded-lg border transition-colors duration-150 group",
      objective.completed ? "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/50" 
                          : "bg-card hover:bg-muted/30 dark:hover:bg-muted/20",
      isPastObjective && !objective.completed && "bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40"
    )}>
      <div className="flex items-start sm:items-center gap-3 flex-grow min-w-0">
        <Checkbox
          id={`obj-${objective.id}`}
          checked={objective.completed}
          onCheckedChange={(checked) => onToggle(objective.id, !!checked, objective.objective_date)}
          aria-label={objective.completed ? 'Marquer comme non terminé' : 'Marquer comme terminé'}
          disabled={isLoading}
          className={cn(
            "mt-1 sm:mt-0 h-5 w-5 shrink-0", 
            objective.completed ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-700" 
                                : (isPastObjective ? "border-amber-500 data-[state=checked]:bg-amber-600" : "border-primary")
          )}
        />
        <div className="flex-grow">
            <label
            htmlFor={`obj-${objective.id}`}
            className={cn(
                "text-sm font-medium leading-normal cursor-pointer break-words w-full",
                objective.completed && "line-through text-muted-foreground"
            )}
            >
            {objective.text}
            </label>
            {isPastObjective && (
                <p className="text-xs text-muted-foreground mt-0.5">
                    Date originale: {format(parseISO(objective.objective_date), "d MMM yyyy", { locale: fr })}
                </p>
            )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        {!isPastObjective && (
          <Button variant="ghost" size="icon" onClick={() => onEdit(objective)} aria-label="Modifier l'objectif" disabled={isLoading} className="h-8 w-8 opacity-50 group-hover:opacity-100 text-muted-foreground hover:text-primary">
            <Edit3 className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={() => onDelete(objective.id)} aria-label="Supprimer l'objectif" className="text-destructive/70 hover:text-destructive h-8 w-8 opacity-50 group-hover:opacity-100" disabled={isLoading}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export function DailyPlanSection() {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [objectives, setObjectives] = useState<DailyObjective[]>([]);
  const [overdueObjectives, setOverdueObjectives] = useState<DailyObjective[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newObjectiveText, setNewObjectiveText] = useState('');
  const [editingObjective, setEditingObjective] = useState<DailyObjective | null>(null);
  
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isItemLoading, setIsItemLoading] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const formatDateForSupabase = (date: Date): string => {
    return format(date, 'yyyy-MM-dd');
  };

  const fetchObjectivesForDate = useCallback(async (date: Date) => {
    setIsFetching(true);
    setError(null);
    try {
      const dateString = formatDateForSupabase(date);
      const { data, error: dbError } = await supabase
        .from('daily_objectives')
        .select('*')
        .eq('objective_date', dateString)
        .order('created_at', { ascending: true });

      if (dbError) throw dbError;
      setObjectives(data || []);
    } catch (e: any) {
      const msg = "Impossible de charger les objectifs pour la date sélectionnée.";
      setError(msg + ` (${e.message})`);
      toast({ title: "Erreur", description: msg, variant: "destructive" });
      console.error("Erreur fetchObjectivesForDate:", e);
    } finally {
      setIsFetching(false);
    }
  }, [toast]);

  const fetchOverdueObjectives = useCallback(async () => {
    // Fetch non-completed objectives from the past (e.g., last 7 days, excluding today)
    if (!isToday(selectedDate)) return; // Only fetch overdue if viewing today's plan

    try {
      const sevenDaysAgo = formatDateForSupabase(subDays(new Date(), 7));
      const yesterday = formatDateForSupabase(subDays(new Date(), 1));
      
      const { data, error: dbError } = await supabase
        .from('daily_objectives')
        .select('*')
        .eq('completed', false)
        .gte('objective_date', sevenDaysAgo)
        .lte('objective_date', yesterday) 
        .order('objective_date', { ascending: true });

      if (dbError) throw dbError;
      setOverdueObjectives(data || []);
    } catch (e: any) {
      toast({ title: "Erreur", description: "Impossible de charger les objectifs en retard.", variant: "destructive" });
      console.error("Erreur fetchOverdueObjectives:", e);
    }
  }, [toast, selectedDate]);

  useEffect(() => {
    fetchObjectivesForDate(selectedDate);
    if (isToday(selectedDate)) {
      fetchOverdueObjectives();
    } else {
      setOverdueObjectives([]); // Clear overdue if not viewing today
    }
  }, [selectedDate, fetchObjectivesForDate, fetchOverdueObjectives]);

  // Supabase real-time subscription
   useEffect(() => {
    const channel = supabase
      .channel('db-daily-objectives-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_objectives' }, (payload) => {
        // Check if the change affects the currently selected date or overdue objectives
        const changedRecord = payload.new as DailyObjective || payload.old as DailyObjective;
        if (changedRecord && changedRecord.objective_date === formatDateForSupabase(selectedDate)) {
          fetchObjectivesForDate(selectedDate);
        }
        if (isToday(selectedDate) && changedRecord && isPast(parseISO(changedRecord.objective_date)) && !changedRecord.completed) {
             fetchOverdueObjectives();
        } else if (isToday(selectedDate) && changedRecord && isPast(parseISO(changedRecord.objective_date)) && payload.eventType === 'UPDATE' && (payload.new as DailyObjective).completed) {
             fetchOverdueObjectives(); // Refresh if an overdue task was completed
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, fetchObjectivesForDate, fetchOverdueObjectives]);


  const handleAddOrUpdateObjective = async () => {
    if (newObjectiveText.trim() === '') return;
    
    const currentObjectivesForDate = objectives.filter(obj => !obj.completed && obj.objective_date === formatDateForSupabase(selectedDate));
    if (!editingObjective && currentObjectivesForDate.length >= 5 && isToday(selectedDate)) {
         toast({title: "Limite d'objectifs actifs", description: "Concentrez-vous sur 5 objectifs majeurs maximum par jour.", variant: "default"});
         return;
    }

    setIsFormLoading(true);
    try {
      const objectivePayload = {
        text: newObjectiveText.trim(),
        objective_date: formatDateForSupabase(selectedDate), // Use selectedDate for new/edited objectives
        completed: editingObjective ? editingObjective.completed : false,
        completed_at: editingObjective && editingObjective.completed ? (editingObjective.completed_at || new Date().toISOString()) : null,
      };

      if (editingObjective) {
        const { error } = await supabase
          .from('daily_objectives')
          .update(objectivePayload)
          .eq('id', editingObjective.id);
        if (error) throw error;
        toast({ title: "Objectif mis à jour" });
      } else {
        const { error } = await supabase.from('daily_objectives').insert(objectivePayload);
        if (error) throw error;
        toast({ title: "Objectif ajouté" });
      }
      setNewObjectiveText('');
      setEditingObjective(null);
      setIsModalOpen(false);
      // Data re-fetch handled by Supabase listener or direct call if preferred
      // fetchObjectivesForDate(selectedDate); 
    } catch (e: any) {
      toast({ title: "Erreur d'enregistrement", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleAddOrUpdateObjective:", e);
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleToggleObjective = async (id: string, completed: boolean, objectiveDate: string) => {
    setIsItemLoading(id);
    try {
      const updatePayload: Partial<DailyObjective> = { 
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      };
      const { error } = await supabase
        .from('daily_objectives')
        .update(updatePayload)
        .eq('id', id);
      if (error) throw error;
      
      // Optimistic update for faster UI response, listener will confirm
      if (objectiveDate === formatDateForSupabase(selectedDate)) {
        setObjectives(prev => prev.map(obj => obj.id === id ? {...obj, ...updatePayload} : obj));
      }
      if (isPast(parseISO(objectiveDate)) && !completed) { // if unchecking an overdue
        fetchOverdueObjectives();
      } else if (isPast(parseISO(objectiveDate)) && completed) { // if checking an overdue
        setOverdueObjectives(prev => prev.filter(obj => obj.id !== id));
      }

    } catch (e: any) {
      toast({ title: "Erreur de mise à jour", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleToggleObjective:", e);
    } finally {
       setIsItemLoading(null);
    }
  };

  const handleDeleteObjective = async (id: string) => {
    setIsItemLoading(id);
    try {
      const { error } = await supabase.from('daily_objectives').delete().eq('id', id);
      if (error) throw error;
      if (editingObjective && editingObjective.id === id) {
        setNewObjectiveText('');
        setEditingObjective(null);
        setIsModalOpen(false);
      }
      toast({ title: "Objectif supprimé" });
    } catch (e: any) {
      toast({ title: "Erreur de suppression", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleDeleteObjective:", e);
    } finally {
      setIsItemLoading(null);
    }
  };

  const openEditModal = (objective: DailyObjective) => {
    setEditingObjective(objective);
    setNewObjectiveText(objective.text);
    setIsModalOpen(true);
  };
  
  const openNewModal = () => {
    setEditingObjective(null);
    setNewObjectiveText('');
    setIsModalOpen(true);
  };

  const completedCount = objectives.filter(obj => obj.completed).length;
  const totalForSelectedDate = objectives.length;
  const completionPercentage = totalForSelectedDate > 0 ? Math.round((completedCount / totalForSelectedDate) * 100) : 0;

  const navigateDate = (offset: number) => {
    setSelectedDate(prevDate => startOfDay(addDays(prevDate, offset)));
  };

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <Target className="h-7 w-7 text-primary" />
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
            Plan du Jour {isToday(selectedDate) ? "" : `(${format(selectedDate, "d MMM yyyy", { locale: fr })})`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateDate(-1)} aria-label="Jour précédent">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                <CalendarDays className="mr-2 h-4 w-4" />
                {format(selectedDate, "PPP", { locale: fr })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(startOfDay(date))}
                initialFocus
                locale={fr}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={() => navigateDate(1)} aria-label="Jour suivant" disabled={isToday(selectedDate)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button onClick={openNewModal} disabled={isFetching || isFormLoading || (objectives.filter(obj => !obj.completed && obj.objective_date === formatDateForSupabase(selectedDate)).length >= 5 && isToday(selectedDate) && !editingObjective)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Objectif
          </Button>
        </div>
      </div>
      
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base md:text-lg">Progression pour le {format(selectedDate, "d MMMM", { locale: fr })}</CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          <Progress value={completionPercentage} className="w-full h-3 mb-1" />
          <p className="text-xs text-muted-foreground text-center">
            {completedCount} / {totalForSelectedDate} objectif(s) complété(s) ({completionPercentage}%)
          </p>
        </CardContent>
      </Card>

      {isToday(selectedDate) && overdueObjectives.length > 0 && (
        <Accordion type="single" collapsible className="w-full" defaultValue="overdue">
          <AccordionItem value="overdue">
            <AccordionTrigger className="text-base md:text-lg font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 py-3">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Objectifs en Retard ({overdueObjectives.length})
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-3">
              {overdueObjectives.map((objective) => (
                <DailyObjectiveItem
                  key={objective.id}
                  objective={objective}
                  onToggle={handleToggleObjective}
                  onDelete={handleDeleteObjective}
                  onEdit={() => {/* Modifier les objectifs en retard n'est pas implémenté directement ici */}}
                  isLoading={isItemLoading === objective.id}
                  isPastObjective={true}
                />
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {isFetching ? (
        <Card className="flex-grow flex flex-col items-center justify-center text-center p-6">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Chargement des objectifs...</p>
        </Card>
      ) : error ? (
         <Card className="flex-grow flex flex-col items-center justify-center text-center p-6 border-destructive bg-destructive/10">
            <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
            <p className="font-semibold text-destructive">Erreur de chargement</p>
            <p className="text-sm text-destructive/80 mt-1 mb-3 max-w-md mx-auto">{error}</p>
            <Button onClick={() => fetchObjectivesForDate(selectedDate)} variant="destructive">Réessayer</Button>
        </Card>
      ) : totalForSelectedDate === 0 ? (
        <Card className="flex-grow flex flex-col items-center justify-center text-center p-6 border-dashed">
          <Target className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4"/>
          <CardTitle className="text-xl">Aucun objectif pour {isToday(selectedDate) ? "aujourd'hui" : `le ${format(selectedDate, "d MMM", {locale: fr})}`} !</CardTitle>
          <p className="text-muted-foreground my-2 max-w-md mx-auto">Définissez des priorités claires pour cette journée.</p>
          <Button onClick={openNewModal} size="lg" className="mt-2">
            <PlusCircle className="mr-2 h-5 w-5" /> Définir un objectif
          </Button>
        </Card>
      ) : (
        <div className="flex-grow space-y-3 overflow-y-auto custom-scrollbar pr-1 pb-4">
          {objectives.map((objective) => (
            <DailyObjectiveItem
              key={objective.id}
              objective={objective}
              onToggle={handleToggleObjective}
              onDelete={handleDeleteObjective}
              onEdit={openEditModal}
              isLoading={isItemLoading === objective.id}
              isPastObjective={isPast(selectedDate) && !isToday(selectedDate)}
            />
          ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={(open) => {if(!isFormLoading) setIsModalOpen(open)}}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="text-lg">{editingObjective ? "Modifier l'Objectif" : `Nouvel Objectif (${format(selectedDate, "d MMM", { locale: fr })})`}</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-3">
                 <div>
                    <Label htmlFor="objectiveTextModal" className="mb-1.5 block text-sm">Description de l'objectif</Label>
                    <Input
                        id="objectiveTextModal"
                        value={newObjectiveText}
                        onChange={(e) => setNewObjectiveText(e.target.value)}
                        placeholder="ex : Finaliser le chapitre méthodologie"
                        className="text-sm"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddOrUpdateObjective()}
                        disabled={isFormLoading}
                        aria-label="Texte de l'objectif"
                    />
                </div>
                 {objectives.filter(obj => !obj.completed && obj.objective_date === formatDateForSupabase(selectedDate)).length >= 5 && !editingObjective && isToday(selectedDate) && (
                    <p className="text-xs text-orange-600 flex items-center gap-1.5"><Info className="h-3.5 w-3.5"/>Vous avez atteint la limite de 5 objectifs actifs pour aujourd'hui.</p>
                )}
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline" disabled={isFormLoading}>Annuler</Button>
                </DialogClose>
                <Button 
                    onClick={handleAddOrUpdateObjective} 
                    disabled={isFormLoading || !newObjectiveText.trim() || (objectives.filter(obj => !obj.completed && obj.objective_date === formatDateForSupabase(selectedDate)).length >= 5 && !editingObjective && isToday(selectedDate))}
                >
                {isFormLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingObjective ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
                {editingObjective ? 'Enregistrer' : 'Ajouter'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

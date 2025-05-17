
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import type { DailyObjective } from '@/types';
import { PlusCircle, Trash2, Edit3, Loader2, Target, Save } from 'lucide-react'; // Removed Check
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

interface DailyObjectiveItemProps {
  objective: DailyObjective;
  onToggle: (id: string, completed: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (objective: DailyObjective) => void;
  isLoading: boolean;
}

const DailyObjectiveItem: FC<DailyObjectiveItemProps> = ({ objective, onToggle, onDelete, onEdit, isLoading }) => {
  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-lg border transition-colors duration-150",
      objective.completed ? "bg-green-50 border-green-300 hover:bg-green-100" : "bg-card hover:bg-muted/30"
    )}>
      <div className="flex items-center gap-3 flex-grow min-w-0">
        <Checkbox
          id={`obj-${objective.id}`}
          checked={objective.completed}
          onCheckedChange={(checked) => onToggle(objective.id, !!checked)}
          aria-label={objective.completed ? 'Marquer comme non terminé' : 'Marquer comme terminé'}
          disabled={isLoading}
          className={cn(objective.completed ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-700" : "border-primary")}
        />
        <label
          htmlFor={`obj-${objective.id}`}
          className={cn(
            "text-sm font-medium leading-none cursor-pointer break-words w-full",
            objective.completed && "line-through text-muted-foreground"
          )}
        >
          {objective.text}
        </label>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => onEdit(objective)} aria-label="Modifier l'objectif" disabled={isLoading} className="h-7 w-7 hover:bg-black/5">
          <Edit3 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(objective.id)} aria-label="Supprimer l'objectif" className="text-destructive/70 hover:text-destructive h-7 w-7 hover:bg-destructive/10" disabled={isLoading}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export function DailyPlanSection() {
  const [objectives, setObjectives] = useState<DailyObjective[]>([]);
  const [newObjectiveText, setNewObjectiveText] = useState('');
  const [editingObjective, setEditingObjective] = useState<DailyObjective | null>(null);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isItemLoading, setIsItemLoading] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const { toast } = useToast();

  const fetchObjectives = useCallback(async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase.from('daily_objectives').select('*').order('text');
      if (error) throw error;
      setObjectives(data || []);
    } catch (e: any) {
      toast({ title: "Erreur", description: "Impossible de charger les objectifs.", variant: "destructive" });
      console.error("Erreur fetchObjectives:", e);
    } finally {
      setIsFetching(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchObjectives();
    const channel = supabase
      .channel('db-dailyobjectives-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_objectives' }, fetchObjectives)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchObjectives]);

  const handleAddOrUpdateObjective = async () => {
    if (newObjectiveText.trim() === '') return;
    setIsFormLoading(true);
    try {
      if (editingObjective) {
        const { error } = await supabase
          .from('daily_objectives')
          .update({ text: newObjectiveText.trim() })
          .eq('id', editingObjective.id);
        if (error) throw error;
        setEditingObjective(null);
        toast({ title: "Objectif mis à jour" });
      } else {
        if (objectives.filter(obj => !obj.completed).length >= 5) {
          toast({title: "Limite d'objectifs actifs", description: "Concentrez-vous sur 5 objectifs majeurs maximum par jour.", variant: "default"});
          setIsFormLoading(false);
          return;
        }
        const newObjectivePayload: Omit<DailyObjective, 'id'> = {
          text: newObjectiveText.trim(),
          completed: false,
        };
        const { error } = await supabase.from('daily_objectives').insert(newObjectivePayload);
        if (error) throw error;
        toast({ title: "Objectif ajouté" });
      }
      setNewObjectiveText('');
    } catch (e: any) {
      toast({ title: "Erreur d'enregistrement", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleAddOrUpdateObjective:", e);
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleToggleObjective = async (id: string, completed: boolean) => {
    setIsItemLoading(id);
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
      }
      toast({ title: "Objectif supprimé" });
    } catch (e: any) {
      toast({ title: "Erreur de suppression", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleDeleteObjective:", e);
    } finally {
      setIsItemLoading(null);
    }
  };

  const handleEditObjective = (objective: DailyObjective) => {
    setEditingObjective(objective);
    setNewObjectiveText(objective.text);
    const formCard = document.getElementById('add-objective-card');
    if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  
  const completedCount = objectives.filter(obj => obj.completed).length;
  const pendingCount = objectives.length - completedCount;
  const completionPercentage = objectives.length > 0 ? Math.round((completedCount / objectives.length) * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex items-center gap-3">
        <Target className="h-7 w-7 text-primary" />
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Plan du Jour</h1>
      </div>
      
      <Card id="add-objective-card" className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">{editingObjective ? "Modifier l'Objectif" : 'Nouvel Objectif Quotidien'}</CardTitle>
          <CardDescription className="text-xs md:text-sm">Définissez vos priorités pour aujourd'hui (max 5 actifs).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={newObjectiveText}
              onChange={(e) => setNewObjectiveText(e.target.value)}
              placeholder="ex : Finaliser le chapitre méthodologie"
              className="flex-grow text-sm"
              onKeyPress={(e) => e.key === 'Enter' && handleAddOrUpdateObjective()}
              disabled={isFormLoading || isFetching}
              aria-label="Texte de l'objectif"
            />
            <Button onClick={handleAddOrUpdateObjective} disabled={isFormLoading || !newObjectiveText.trim() || isFetching} className="w-full sm:w-auto">
              {isFormLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingObjective ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
              {editingObjective ? 'Enregistrer' : 'Ajouter'}
            </Button>
            {editingObjective && (
              <Button variant="outline" onClick={() => { setEditingObjective(null); setNewObjectiveText(''); }} disabled={isFormLoading} className="w-full sm:w-auto">Annuler</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isFetching ? (
        <div className="flex-grow flex justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
        <Card className="shadow-sm">
            <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-base md:text-lg">Progression Journalière</CardTitle>
            </CardHeader>
            <CardContent>
                <Progress value={completionPercentage} className="w-full h-3 mb-1" />
                <p className="text-xs text-muted-foreground text-center">
                    {completedCount} / {objectives.length} objectif(s) complété(s) ({completionPercentage}%)
                </p>
            </CardContent>
        </Card>
        {objectives.length === 0 ? (
            <Card className="flex-grow flex flex-col items-center justify-center text-center p-6 bg-muted/30">
                <Target className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3"/>
                <p className="text-muted-foreground">Aucun objectif défini pour aujourd'hui.</p>
                <p className="text-xs text-muted-foreground">Ajoutez-en pour structurer votre journée !</p>
            </Card>
            ) : (
            <div className="flex-grow space-y-3 overflow-y-auto custom-scrollbar pr-1 pb-4">
                {objectives.map((objective) => (
                <DailyObjectiveItem
                    key={objective.id}
                    objective={objective}
                    onToggle={handleToggleObjective}
                    onDelete={handleDeleteObjective}
                    onEdit={handleEditObjective}
                    isLoading={isItemLoading === objective.id}
                />
                ))}
            </div>
            )}
        </>
      )}
    </div>
  );
}

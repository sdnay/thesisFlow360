
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import type { DailyObjective } from '@/types';
import { PlusCircle, Trash2, Edit3, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

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
      "flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors",
      objective.completed ? "bg-muted/30" : "bg-card"
    )}>
      <div className="flex items-center gap-3">
        <Checkbox
          id={`obj-${objective.id}`}
          checked={objective.completed}
          onCheckedChange={(checked) => onToggle(objective.id, !!checked)}
          aria-label={objective.completed ? 'Marquer comme non terminé' : 'Marquer comme terminé'}
          disabled={isLoading}
        />
        <label
          htmlFor={`obj-${objective.id}`}
          className={cn(
            "text-sm font-medium leading-none cursor-pointer",
            objective.completed && "line-through text-muted-foreground"
          )}
        >
          {objective.text}
        </label>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => onEdit(objective)} aria-label="Modifier l'objectif" disabled={isLoading}>
          <Edit3 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(objective.id)} aria-label="Supprimer l'objectif" className="text-destructive hover:text-destructive/80" disabled={isLoading}>
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
  const [isLoading, setIsLoading] = useState(false); // For add/update
  const [isCardLoading, setIsCardLoading] = useState(false); // For toggle/delete
  const [isFetching, setIsFetching] = useState(true);
  const { toast } = useToast();

  const fetchObjectives = useCallback(async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase.from('daily_objectives').select('*').order('text'); // Assuming created_at is not there, order by text
      if (error) throw error;
      setObjectives(data || []);
    } catch (e: any) {
      toast({ title: "Erreur", description: "Impossible de charger les objectifs du jour.", variant: "destructive" });
      console.error("Erreur fetchObjectives:", e);
    } finally {
      setIsFetching(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchObjectives();
  }, [fetchObjectives]);

  const handleAddOrUpdateObjective = async () => {
    if (newObjectiveText.trim() === '') return;
    setIsLoading(true);
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
        if (objectives.filter(obj => !obj.completed).length >= 3) {
          toast({title: "Limite atteinte", description: "Vous ne pouvez avoir que 3 objectifs majeurs actifs par jour.", variant: "default"});
          setIsLoading(false);
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
      await fetchObjectives();
    } catch (e: any) {
      toast({ title: "Erreur d'enregistrement", description: e.message, variant: "destructive" });
      console.error("Erreur handleAddOrUpdateObjective:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleObjective = async (id: string, completed: boolean) => {
    setIsCardLoading(true);
    try {
      const { error } = await supabase
        .from('daily_objectives')
        .update({ completed })
        .eq('id', id);
      if (error) throw error;
      await fetchObjectives();
    } catch (e: any) {
      toast({ title: "Erreur de mise à jour", description: e.message, variant: "destructive" });
      console.error("Erreur handleToggleObjective:", e);
    } finally {
       setIsCardLoading(false);
    }
  };

  const handleDeleteObjective = async (id: string) => {
    setIsCardLoading(true);
    try {
      const { error } = await supabase.from('daily_objectives').delete().eq('id', id);
      if (error) throw error;
      if (editingObjective && editingObjective.id === id) {
        setNewObjectiveText('');
        setEditingObjective(null);
      }
      await fetchObjectives();
      toast({ title: "Objectif supprimé" });
    } catch (e: any) {
      toast({ title: "Erreur de suppression", description: e.message, variant: "destructive" });
      console.error("Erreur handleDeleteObjective:", e);
    } finally {
      setIsCardLoading(false);
    }
  };

  const handleEditObjective = (objective: DailyObjective) => {
    setEditingObjective(objective);
    setNewObjectiveText(objective.text);
  };
  
  const completedCount = objectives.filter(obj => obj.completed).length;
  const pendingCount = objectives.length - completedCount;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h2 className="text-2xl font-semibold">Plan du Jour</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>{editingObjective ? "Modifier l'Objectif" : 'Ajouter un Nouvel Objectif'}</CardTitle>
          <CardDescription>Définissez 1 à 3 objectifs majeurs pour la journée.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={newObjectiveText}
              onChange={(e) => setNewObjectiveText(e.target.value)}
              placeholder="ex : Finaliser le chapitre méthodologie"
              className="flex-grow"
              onKeyPress={(e) => e.key === 'Enter' && handleAddOrUpdateObjective()}
              disabled={isLoading || isFetching}
            />
            <Button onClick={handleAddOrUpdateObjective} disabled={isLoading || !newObjectiveText.trim() || isFetching}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingObjective ? <Edit3 className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
              {editingObjective ? 'Mettre à Jour' : 'Ajouter'}
            </Button>
            {editingObjective && (
              <Button variant="outline" onClick={() => { setEditingObjective(null); setNewObjectiveText(''); }} disabled={isLoading}>Annuler</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isFetching ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : objectives.length === 0 ? (
         <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">Aucun objectif défini pour aujourd'hui. Ajoutez-en pour commencer !</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Objectifs du Jour</CardTitle>
            <CardDescription>
              {pendingCount > 0 && <>{pendingCount} en attente</>}
              {pendingCount > 0 && completedCount > 0 && ", "}
              {completedCount > 0 && <>{completedCount} terminé(s)</>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {objectives.map((objective) => (
              <DailyObjectiveItem
                key={objective.id}
                objective={objective}
                onToggle={handleToggleObjective}
                onDelete={handleDeleteObjective}
                onEdit={handleEditObjective}
                isLoading={isCardLoading}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

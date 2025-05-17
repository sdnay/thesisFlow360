"use client";

import { useState, type FC } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import type { DailyObjective } from '@/types';
import { PlusCircle, Trash2, Edit3, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

const initialObjectives: DailyObjective[] = [
  { id: 'do1', text: 'Écrire 500 mots pour le Chapitre 2', completed: false },
  { id: 'do2', text: 'Relire les commentaires du superviseur sur l\'Introduction', completed: true },
];

interface DailyObjectiveItemProps {
  objective: DailyObjective;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (objective: DailyObjective) => void;
}

const DailyObjectiveItem: FC<DailyObjectiveItemProps> = ({ objective, onToggle, onDelete, onEdit }) => {
  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors",
      objective.completed ? "bg-muted/30" : "bg-card"
    )}>
      <div className="flex items-center gap-3">
        <Checkbox
          id={`obj-${objective.id}`}
          checked={objective.completed}
          onCheckedChange={() => onToggle(objective.id)}
          aria-label={objective.completed ? 'Marquer comme non terminé' : 'Marquer comme terminé'}
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
        <Button variant="ghost" size="icon" onClick={() => onEdit(objective)} aria-label="Modifier l'objectif">
          <Edit3 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(objective.id)} aria-label="Supprimer l'objectif" className="text-destructive hover:text-destructive/80">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export function DailyPlanSection() {
  const [objectives, setObjectives] = useState<DailyObjective[]>(initialObjectives);
  const [newObjectiveText, setNewObjectiveText] = useState('');
  const [editingObjective, setEditingObjective] = useState<DailyObjective | null>(null);

  const handleAddOrUpdateObjective = () => {
    if (newObjectiveText.trim() === '') return;

    if (editingObjective) {
      setObjectives(
        objectives.map((obj) =>
          obj.id === editingObjective.id ? { ...obj, text: newObjectiveText.trim() } : obj
        )
      );
      setEditingObjective(null);
    } else {
      if (objectives.filter(obj => !obj.completed).length >= 3) {
        alert("Vous ne pouvez avoir que 3 objectifs majeurs actifs par jour au maximum.");
        return;
      }
      const newObjective: DailyObjective = {
        id: Date.now().toString(),
        text: newObjectiveText.trim(),
        completed: false,
      };
      setObjectives([newObjective, ...objectives]);
    }
    setNewObjectiveText('');
  };

  const handleToggleObjective = (id: string) => {
    setObjectives(
      objectives.map((obj) =>
        obj.id === id ? { ...obj, completed: !obj.completed } : obj
      )
    );
  };

  const handleDeleteObjective = (id: string) => {
    setObjectives(objectives.filter((obj) => obj.id !== id));
    if (editingObjective && editingObjective.id === id) {
      setNewObjectiveText('');
      setEditingObjective(null);
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
            />
            <Button onClick={handleAddOrUpdateObjective}>
              {editingObjective ? <Edit3 className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              {editingObjective ? 'Mettre à Jour' : 'Ajouter'}
            </Button>
            {editingObjective && (
              <Button variant="outline" onClick={() => { setEditingObjective(null); setNewObjectiveText(''); }}>Annuler</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {objectives.length === 0 ? (
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
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

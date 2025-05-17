
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import type { Task, TaskType } from '@/types';
import { modifyTaskList, type ModifyTaskListInput, type ModifyTaskListOutput } from '@/ai/flows/modify-task-list';
import { Bot, Trash2, PlusCircle, AlertTriangle, Edit2, CheckCircle, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { CheckIcon, ChevronDownIcon as ChevronUpDownIcon } from 'lucide-react'; // Remplacé ChevronUpDownIcon si non dispo
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';


const taskTypeColors: Record<TaskType, string> = {
  urgent: "bg-red-100 text-red-700 border-red-300 hover:bg-red-200",
  important: "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200",
  reading: "bg-green-100 text-green-700 border-green-300 hover:bg-green-200",
  chatgpt: "bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200",
  secondary: "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200",
};

const taskTypeLabels: Record<TaskType, string> = {
  urgent: "Urgent",
  important: "Important",
  reading: "Lecture",
  chatgpt: "ChatGPT",
  secondary: "Secondaire",
};


const TaskTypeSelector: FC<{ selectedType: TaskType, onSelectType: (type: TaskType) => void, disabled?: boolean }> = ({ selectedType, onSelectType, disabled }) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" role="combobox" aria-expanded={open} className="w-[120px] justify-between text-xs" disabled={disabled}>
          {taskTypeLabels[selectedType]}
          <ChevronUpDownIcon className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[120px] p-0">
        <Command>
          <CommandInput placeholder="Rechercher type..." className="h-8 text-xs" />
          <CommandEmpty>Aucun type trouvé.</CommandEmpty>
          <CommandList>
            <CommandGroup>
              {Object.entries(taskTypeLabels).map(([type, label]) => (
                <CommandItem
                  key={type}
                  value={type}
                  onSelect={(currentValue) => {
                    onSelectType(currentValue as TaskType);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 h-3 w-3",
                      selectedType === type ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const TaskItemDisplay: FC<{ task: Task, onToggle: (id: string, completed: boolean) => void, onDelete: (id: string) => void, onSetType: (id: string, type: TaskType) => void, onEdit: (task: Task) => void }> = ({ task, onToggle, onDelete, onSetType, onEdit }) => {
  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-md border transition-all duration-150",
      taskTypeColors[task.type],
      task.completed && "opacity-60"
    )}>
      <div className="flex items-center gap-3 flex-grow min-w-0">
        <Checkbox
          id={`task-${task.id}`}
          checked={task.completed}
          onCheckedChange={(checked) => onToggle(task.id, !!checked)}
          className={cn(
             task.type === 'urgent' ? "border-red-500 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-600"
            :task.type === 'important' ? "border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-600"
            : "border-primary"
          )}
        />
        <label
          htmlFor={`task-${task.id}`}
          className={cn(
            "text-sm font-medium leading-none cursor-pointer break-words w-full",
            task.completed && "line-through"
          )}
        >
          {task.text}
        </label>
      </div>
      <div className="flex items-center gap-1 ml-2 shrink-0">
        <TaskTypeSelector selectedType={task.type} onSelectType={(type) => onSetType(task.id, type)} />
         <Button variant="ghost" size="icon" onClick={() => onEdit(task)} className="h-7 w-7 hover:bg-black/5">
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(task.id)} className="h-7 w-7 hover:bg-black/5 text-destructive/80 hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};


export function AiTaskManagerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [instructions, setInstructions] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingTasks, setIsFetchingTasks] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  
  const [manualTaskText, setManualTaskText] = useState('');
  const [manualTaskType, setManualTaskType] = useState<TaskType>('secondary');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const { toast } = useToast();

  const fetchTasks = useCallback(async () => {
    setIsFetchingTasks(true);
    setError(null);
    try {
      const { data, error: supabaseError } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (supabaseError) throw supabaseError;
      setTasks(data || []);
    } catch (e: any) {
      console.error("Erreur lors de la récupération des tâches:", e);
      setError("Échec de la récupération des tâches.");
      toast({ title: "Erreur", description: "Impossible de charger les tâches.", variant: "destructive" });
    } finally {
      setIsFetchingTasks(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleAiModifyTasks = async () => {
    if (instructions.trim() === '') return;
    setIsLoading(true);
    setError(null);
    setAiReasoning(null);
    try {
      const currentTaskStrings = tasks.map(t => `${t.text} (ID: ${t.id}, Terminé: ${t.completed}, Type: ${t.type})`);
      const input: ModifyTaskListInput = {
        instructions,
        taskList: currentTaskStrings,
      };
      const result: ModifyTaskListOutput = await modifyTaskList(input);
      
      // Simplification: supprimer toutes les tâches actuelles et réinsérer celles de l'IA
      const { error: deleteError } = await supabase.from('tasks').delete().neq('id', '0'); // Supprime tout (condition fictive pour supprimer tout)
      if (deleteError) throw deleteError;

      const newTasksToInsert: Array<Omit<Task, 'id' | 'created_at'>> = result.modifiedTaskList.map((taskText) => {
        const completedMatch = taskText.match(/(?:Completed|Terminé): (true|false|vrai|faux)/i);
        const typeMatch = taskText.match(/(?:Type|Type): (urgent|important|reading|chatgpt|secondary)/i);
        
        return {
          text: taskText.replace(/\s*\((?:ID: [\w-]+, )?(?:Completed|Terminé): (?:true|false|vrai|faux), Type: \w+\)/gi, '').trim(),
          completed: completedMatch ? (completedMatch[1].toLowerCase() === 'true' || completedMatch[1].toLowerCase() === 'vrai') : false,
          type: typeMatch ? typeMatch[1].toLowerCase() as TaskType : 'secondary',
        };
      });

      if (newTasksToInsert.length > 0) {
        const { error: insertError } = await supabase.from('tasks').insert(newTasksToInsert);
        if (insertError) throw insertError;
      }
      
      setAiReasoning(result.reasoning);
      setInstructions('');
      await fetchTasks(); // Recharger les tâches depuis Supabase
      toast({ title: "Succès", description: "Liste de tâches modifiée par l'IA." });
    } catch (e: any) {
      console.error("Erreur lors de la modification de la liste des tâches avec l'IA:", e);
      setError("Échec de la modification des tâches avec l'IA.");
      toast({ title: "Erreur IA", description: e.message || "Une erreur est survenue.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddOrUpdateManualTask = async () => {
    if (manualTaskText.trim() === '') return;
    setIsLoading(true);
    setError(null);

    try {
      if (editingTask) {
        const { error: updateError } = await supabase
          .from('tasks')
          .update({ text: manualTaskText, type: manualTaskType })
          .eq('id', editingTask.id);
        if (updateError) throw updateError;
        setEditingTask(null);
        toast({ title: "Tâche mise à jour", description: `"${manualTaskText}" a été modifiée.` });
      } else {
        const newTaskPayload: Omit<Task, 'id' | 'created_at'> = {
          text: manualTaskText.trim(),
          completed: false,
          type: manualTaskType,
        };
        const { error: insertError } = await supabase.from('tasks').insert(newTaskPayload);
        if (insertError) throw insertError;
        toast({ title: "Tâche ajoutée", description: `"${manualTaskText}" a été ajoutée.` });
      }
      setManualTaskText('');
      setManualTaskType('secondary');
      await fetchTasks();
    } catch (e: any) {
      console.error("Erreur lors de l'ajout/modification manuelle de la tâche:", e);
      setError("Échec de l'enregistrement de la tâche.");
      toast({ title: "Erreur", description: e.message || "Impossible d'enregistrer la tâche.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTask = async (id: string, completed: boolean) => {
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ completed })
        .eq('id', id);
      if (updateError) throw updateError;
      await fetchTasks(); // Optimistic update could be done here too
    } catch (e: any) {
       console.error("Erreur lors du changement de statut de la tâche:", e);
       setError("Échec du changement de statut.");
       toast({ title: "Erreur", description: "Impossible de changer le statut de la tâche.", variant: "destructive" });
    }
  };

  const handleDeleteTask = async (id: string) => {
    setError(null);
    try {
      const { error: deleteError } = await supabase.from('tasks').delete().eq('id', id);
      if (deleteError) throw deleteError;
      
      if (editingTask && editingTask.id === id) {
          setEditingTask(null);
          setManualTaskText('');
          setManualTaskType('secondary');
      }
      await fetchTasks();
      toast({ title: "Tâche supprimée" });
    } catch (e: any) {
      console.error("Erreur lors de la suppression de la tâche:", e);
      setError("Échec de la suppression de la tâche.");
      toast({ title: "Erreur", description: "Impossible de supprimer la tâche.", variant: "destructive" });
    }
  };

  const handleSetTaskType = async (id: string, type: TaskType) => {
     setError(null);
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ type })
        .eq('id', id);
      if (updateError) throw updateError;
      await fetchTasks();
    } catch (e: any) {
       console.error("Erreur lors du changement de type de la tâche:", e);
       setError("Échec du changement de type.");
       toast({ title: "Erreur", description: "Impossible de changer le type de la tâche.", variant: "destructive" });
    }
  };
  
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setManualTaskText(task.text);
    setManualTaskType(task.type);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <h1 className="text-2xl font-semibold tracking-tight">Gestionnaire de Tâches IA</h1>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" /> Modification de Tâches Assistée par IA
          </CardTitle>
          <CardDescription>
            Donnez des instructions à l'IA pour gérer vos tâches (ex : "Ajouter une tâche pour écrire le chapitre 1", "Marquer 'revoir la littérature' comme urgent et terminé"). L'IA réécrira toute la liste.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Entrez les instructions pour l'IA..."
            rows={3}
            className="mb-2"
            disabled={isLoading}
          />
           {error && ( // Affichage de l'erreur générale pour la page
            <p className="text-xs text-destructive mt-1 mb-2 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {error}</p>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleAiModifyTasks} disabled={isLoading || !instructions.trim() || isFetchingTasks}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isLoading ? 'Traitement...' : 'Soumettre à l\'IA'}
          </Button>
        </CardFooter>
      </Card>

      {aiReasoning && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-sm text-blue-700">Raisonnement de l'IA</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-blue-600 whitespace-pre-wrap">{aiReasoning}</p>
          </CardContent>
        </Card>
      )}

       <Card>
        <CardHeader>
          <CardTitle>{editingTask ? 'Modifier la Tâche' : 'Ajouter une Nouvelle Tâche Manuellement'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            value={manualTaskText}
            onChange={(e) => setManualTaskText(e.target.value)}
            placeholder="Entrez la description de la tâche..."
            className="flex-grow"
            disabled={isLoading}
          />
          <div className="flex items-center gap-2">
            <TaskTypeSelector selectedType={manualTaskType} onSelectType={setManualTaskType} disabled={isLoading} />
            <Button onClick={handleAddOrUpdateManualTask} className="flex-shrink-0" disabled={isLoading || !manualTaskText.trim()}>
              {isLoading && editingTask ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingTask ? <Edit2 className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
              {isLoading && editingTask ? 'Mise à jour...' : (isLoading ? 'Ajout...' : (editingTask ? 'Mettre à Jour la Tâche' : 'Ajouter la Tâche'))}
            </Button>
            {editingTask && (
                <Button variant="outline" onClick={() => { setEditingTask(null); setManualTaskText(''); setManualTaskType('secondary');}} disabled={isLoading}>
                    Annuler la Modification
                </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="flex-grow flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>Vos Tâches</CardTitle>
          <CardDescription>{isFetchingTasks ? "Chargement..." : `${tasks.length} tâche(s)`}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow overflow-y-auto space-y-3 pr-1">
          {isFetchingTasks ? (
             <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : tasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucune tâche pour le moment. Ajoutez-en manuellement ou utilisez l'IA !</p>
          ) : (
            tasks.map((task) => (
              <TaskItemDisplay 
                key={task.id} 
                task={task} 
                onToggle={handleToggleTask} 
                onDelete={handleDeleteTask}
                onSetType={handleSetTaskType}
                onEdit={handleEditTask}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

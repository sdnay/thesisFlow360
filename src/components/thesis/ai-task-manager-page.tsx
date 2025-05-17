
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import type { Task, TaskType } from '@/types';
import { modifyTaskList, type ModifyTaskListInput, type ModifyTaskListOutput } from '@/ai/flows/modify-task-list';
import { Bot, Trash2, PlusCircle, AlertTriangle, Edit2, Save, Loader2, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { CheckIcon, ChevronDownIcon as ChevronUpDownIcon } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';


const taskTypeColors: Record<TaskType, string> = {
  urgent: "border-red-400 bg-red-50 text-red-700 hover:bg-red-100",
  important: "border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100",
  reading: "border-green-400 bg-green-50 text-green-700 hover:bg-green-100",
  chatgpt: "border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100",
  secondary: "border-gray-400 bg-gray-50 text-gray-700 hover:bg-gray-100",
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
        <Button variant="outline" size="sm" role="combobox" aria-expanded={open} className="w-[140px] justify-between text-sm" disabled={disabled}>
          {taskTypeLabels[selectedType]}
          <ChevronUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[140px] p-0">
        <Command>
          <CommandInput placeholder="Rechercher type..." className="h-9 text-sm" />
          <CommandEmpty>Aucun type.</CommandEmpty>
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
                  className="text-sm cursor-pointer"
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 h-4 w-4",
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

const TaskItemDisplay: FC<{ task: Task, onToggle: (id: string, completed: boolean) => void, onDelete: (id: string) => void, onSetType: (id: string, type: TaskType) => void, onEdit: (task: Task) => void, isLoading: boolean }> = ({ task, onToggle, onDelete, onSetType, onEdit, isLoading }) => {
  return (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-lg border transition-all duration-150", // Increased padding
      taskTypeColors[task.type],
      task.completed && "opacity-70"
    )}>
      <div className="flex items-center gap-3 flex-grow min-w-0 mr-3">
        <Checkbox
          id={`task-${task.id}`}
          checked={task.completed}
          onCheckedChange={(checked) => onToggle(task.id, !!checked)}
          className={cn(
            "h-5 w-5", // Slightly larger checkbox
             task.type === 'urgent' ? "border-red-500 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-600"
            :task.type === 'important' ? "border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-600"
            : "border-primary data-[state=checked]:bg-primary"
          )}
          disabled={isLoading}
        />
        <label
          htmlFor={`task-${task.id}`}
          className={cn(
            "text-base font-medium leading-tight cursor-pointer break-words w-full", // Increased font size and adjusted leading
            task.completed && "line-through text-muted-foreground"
          )}
        >
          {task.text}
        </label>
      </div>
      <div className="flex items-center gap-1.5 ml-2 shrink-0">
        <TaskTypeSelector selectedType={task.type} onSelectType={(type) => onSetType(task.id, type)} disabled={isLoading} />
         <Button variant="ghost" size="icon" onClick={() => onEdit(task)} className="h-8 w-8 hover:bg-black/5 disabled:opacity-50" disabled={isLoading}>
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(task.id)} className="h-8 w-8 hover:bg-black/5 text-destructive/80 hover:text-destructive disabled:opacity-50" disabled={isLoading}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};


export function AiTaskManagerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [instructions, setInstructions] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isManualTaskLoading, setIsManualTaskLoading] = useState(false);
  const [isTaskItemLoading, setIsTaskItemLoading] = useState<string | null>(null); // ID of task being modified
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
     const channel = supabase
      .channel('db-tasks-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks]);

  const handleAiModifyTasks = async () => {
    if (instructions.trim() === '') return;
    setIsAiLoading(true);
    setError(null);
    setAiReasoning(null);
    try {
      const currentTaskStrings = tasks.map(t => `${t.text} (ID: ${t.id}, Terminé: ${t.completed}, Type: ${t.type})`);
      const input: ModifyTaskListInput = {
        instructions,
        taskList: currentTaskStrings,
      };
      const result: ModifyTaskListOutput = await modifyTaskList(input);
      
      const { error: deleteError } = await supabase.from('tasks').delete().neq('id', '0'); 
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
      toast({ title: "Succès", description: "Liste de tâches modifiée par l'IA." });
    } catch (e: any) {
      console.error("Erreur lors de la modification de la liste des tâches avec l'IA:", e);
      setError(`Échec de la modification avec l'IA: ${e.message}`);
      toast({ title: "Erreur IA", description: e.message || "Une erreur est survenue.", variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAddOrUpdateManualTask = async () => {
    if (manualTaskText.trim() === '') return;
    setIsManualTaskLoading(true);
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
    } catch (e: any) {
      console.error("Erreur lors de l'ajout/modification manuelle de la tâche:", e);
      setError(`Échec de l'enregistrement: ${e.message}`);
      toast({ title: "Erreur", description: "Impossible d'enregistrer la tâche.", variant: "destructive" });
    } finally {
      setIsManualTaskLoading(false);
    }
  };

  const handleToggleTask = async (id: string, completed: boolean) => {
    setIsTaskItemLoading(id);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ completed })
        .eq('id', id);
      if (updateError) throw updateError;
    } catch (e: any) {
       console.error("Erreur lors du changement de statut de la tâche:", e);
       setError(`Échec du changement de statut: ${e.message}`);
       toast({ title: "Erreur", description: "Impossible de changer le statut de la tâche.", variant: "destructive" });
    } finally {
      setIsTaskItemLoading(null);
    }
  };

  const handleDeleteTask = async (id: string) => {
    setIsTaskItemLoading(id);
    setError(null);
    try {
      const { error: deleteError } = await supabase.from('tasks').delete().eq('id', id);
      if (deleteError) throw deleteError;
      
      if (editingTask && editingTask.id === id) {
          setEditingTask(null);
          setManualTaskText('');
          setManualTaskType('secondary');
      }
      toast({ title: "Tâche supprimée" });
    } catch (e: any) {
      console.error("Erreur lors de la suppression de la tâche:", e);
      setError(`Échec de la suppression: ${e.message}`);
      toast({ title: "Erreur", description: "Impossible de supprimer la tâche.", variant: "destructive" });
    } finally {
      setIsTaskItemLoading(null);
    }
  };

  const handleSetTaskType = async (id: string, type: TaskType) => {
    setIsTaskItemLoading(id);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ type })
        .eq('id', id);
      if (updateError) throw updateError;
    } catch (e: any) {
       console.error("Erreur lors du changement de type de la tâche:", e);
       setError(`Échec du changement de type: ${e.message}`);
       toast({ title: "Erreur", description: "Impossible de changer le type de la tâche.", variant: "destructive" });
    } finally {
      setIsTaskItemLoading(null);
    }
  };
  
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setManualTaskText(task.text);
    setManualTaskType(task.type);
    const formCard = document.getElementById('manual-task-card');
    if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex items-center gap-3">
        <ListTodo className="h-7 w-7 text-primary" />
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Gestionnaire de Tâches IA</h1>
      </div>
      
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <Bot className="h-5 w-5 text-primary" /> Gérer avec l'IA
          </CardTitle>
          <CardDescription className="text-sm md:text-base">
            L'IA peut réorganiser, ajouter ou modifier votre liste de tâches. Donnez des instructions claires (ex: "Ajoute 'relire chapitre X' comme urgent", "Marque toutes les tâches de lecture comme terminées").
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Entrez les instructions pour l'IA..."
            rows={3}
            className="mb-3 text-sm"
            disabled={isAiLoading || isFetchingTasks}
          />
        </CardContent>
        <CardFooter>
          <Button onClick={handleAiModifyTasks} disabled={isAiLoading || !instructions.trim() || isFetchingTasks}>
            {isAiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
            {isAiLoading ? 'Traitement IA...' : 'Soumettre à l\'IA'}
          </Button>
        </CardFooter>
      </Card>

      {aiReasoning && (
        <Card className="bg-accent/10 border-accent/30 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-accent">Raisonnement de l'IA</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-accent/80 whitespace-pre-wrap">{aiReasoning}</p>
          </CardContent>
        </Card>
      )}

       <Card className="shadow-md" id="manual-task-card">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">{editingTask ? 'Modifier la Tâche' : 'Ajouter une Tâche Manuellement'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={manualTaskText}
            onChange={(e) => setManualTaskText(e.target.value)}
            placeholder="Description de la tâche..."
            className="flex-grow text-sm"
            disabled={isManualTaskLoading}
            aria-label="Description de la tâche"
          />
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <TaskTypeSelector selectedType={manualTaskType} onSelectType={setManualTaskType} disabled={isManualTaskLoading} />
            <Button onClick={handleAddOrUpdateManualTask} className="flex-grow sm:flex-grow-0" disabled={isManualTaskLoading || !manualTaskText.trim()}>
              {isManualTaskLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingTask ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
              {isManualTaskLoading ? (editingTask ? 'Mise à jour...' : 'Ajout...') : (editingTask ? 'Enregistrer Modifs' : 'Ajouter la Tâche')}
            </Button>
            {editingTask && (
                <Button variant="outline" onClick={() => { setEditingTask(null); setManualTaskText(''); setManualTaskType('secondary');}} disabled={isManualTaskLoading}>
                    Annuler Modification
                </Button>
            )}
          </div>
           {error && (
            <p className="text-sm text-destructive flex items-center gap-1 pt-1"><AlertTriangle className="h-3.5 w-3.5" /> {error}</p>
          )}
        </CardContent>
      </Card>

      <Card className="flex-grow flex flex-col overflow-hidden shadow-md">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Vos Tâches</CardTitle>
          <CardDescription className="text-sm md:text-base">{isFetchingTasks ? "Chargement..." : `${tasks.length} tâche(s) au total.`}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow overflow-y-auto space-y-3 p-4 custom-scrollbar">
          {isFetchingTasks ? (
             <div className="flex justify-center items-center h-full py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-10">
                <ListTodo className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3"/>
                <p className="text-muted-foreground">Aucune tâche pour le moment.</p>
                <p className="text-xs text-muted-foreground">Ajoutez-en manuellement ou utilisez l'IA !</p>
            </div>
          ) : (
            tasks.map((task) => (
              <TaskItemDisplay 
                key={task.id} 
                task={task} 
                onToggle={handleToggleTask} 
                onDelete={handleDeleteTask}
                onSetType={handleSetTaskType}
                onEdit={handleEditTask}
                isLoading={isTaskItemLoading === task.id}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    
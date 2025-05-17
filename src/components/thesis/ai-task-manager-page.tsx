
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import type { Task, TaskType } from '@/types';
import { modifyTaskList, type ModifyTaskListInput, type ModifyTaskListOutput } from '@/ai/flows/modify-task-list';
import { Bot, Trash2, PlusCircle, AlertTriangle, Edit2, Save, Loader2, ListTodo, ChevronDownIcon as ChevronUpDownIcon, CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const taskTypeLabels: Record<TaskType, string> = {
  urgent: "Urgent",
  important: "Important",
  reading: "Lecture",
  chatgpt: "ChatGPT",
  secondary: "Secondaire",
};

const taskTypeBorderColors: Record<TaskType, string> = {
  urgent: "border-l-red-500",
  important: "border-l-orange-500",
  reading: "border-l-green-500",
  chatgpt: "border-l-blue-500",
  secondary: "border-l-gray-400",
};

const TaskTypeSelector: FC<{ 
  selectedType: TaskType; 
  onSelectType: (type: TaskType) => void; 
  disabled?: boolean;
  buttonClassName?: string;
}> = ({ selectedType, onSelectType, disabled, buttonClassName }) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          role="combobox" 
          aria-expanded={open} 
          className={cn("w-[150px] justify-between text-sm font-normal", buttonClassName)} 
          disabled={disabled}
        >
          {taskTypeLabels[selectedType]}
          <ChevronUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[150px] p-0">
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

interface TaskItemCardProps {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onSetType: (id: string, type: TaskType) => void;
  onEdit: (task: Task) => void;
  isCurrentItemLoading: boolean;
}

const TaskItemCard: FC<TaskItemCardProps> = ({ task, onToggle, onDelete, onSetType, onEdit, isCurrentItemLoading }) => {
  return (
    <Card className={cn(
      "relative overflow-hidden border-l-4 shadow-sm transition-all duration-150 hover:shadow-md", 
      taskTypeBorderColors[task.type], 
      task.completed && "opacity-70 bg-muted/30"
    )}>
      <CardContent className="p-4 flex items-start gap-4">
        <Checkbox
          id={`task-${task.id}`}
          checked={task.completed}
          onCheckedChange={(checked) => onToggle(task.id, !!checked)}
          className={cn(
            "mt-1 h-5 w-5 shrink-0",
            task.type === 'urgent' ? "border-red-500 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-600"
            : task.type === 'important' ? "border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-600"
            : "border-primary data-[state=checked]:bg-primary"
          )}
          disabled={isCurrentItemLoading}
          aria-label={task.completed ? "Marquer comme non terminée" : "Marquer comme terminée"}
        />
        <div className="flex-grow space-y-1.5 min-w-0">
          <p 
            className={cn(
              "text-base font-medium leading-snug break-words",
              task.completed && "line-through text-muted-foreground"
            )}
          >
            {task.text}
          </p>
          <p className="text-xs text-muted-foreground">
            Créé le : {task.created_at ? format(new Date(task.created_at), "d MMM yyyy, HH:mm", { locale: fr }) : 'Date inconnue'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0 ml-auto pl-2">
          <TaskTypeSelector 
            selectedType={task.type} 
            onSelectType={(type) => onSetType(task.id, type)} 
            disabled={isCurrentItemLoading}
            buttonClassName="h-8"
          />
          <div className="flex gap-1.5">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => onEdit(task)} 
              className="h-8 w-8 hover:bg-accent/50 disabled:opacity-50" 
              disabled={isCurrentItemLoading}
              title="Modifier la tâche"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => onDelete(task.id)} 
              className="h-8 w-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10 disabled:opacity-50" 
              disabled={isCurrentItemLoading}
              title="Supprimer la tâche"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};


export function AiTaskManagerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [instructions, setInstructions] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isManualTaskLoading, setIsManualTaskLoading] = useState(false);
  const [isTaskItemLoading, setIsTaskItemLoading] = useState<string | null>(null);
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
      
      const { error: deleteError } = await supabase.from('tasks').delete().neq('id', '0'); // Placeholder ID, adjust if needed
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
      console.error("Erreur IA:", e);
      const errorMessage = (e instanceof Error ? e.message : String(e)) || "Une erreur inconnue est survenue.";
      setError(`Échec de la modification avec l'IA: ${errorMessage}`);
      toast({ title: "Erreur IA", description: errorMessage, variant: "destructive" });
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
      const errorMessage = (e instanceof Error ? e.message : String(e)) || "Une erreur inconnue est survenue.";
      console.error("Erreur ajout/modif manuelle:", errorMessage, e);
      setError(`Échec de l'enregistrement: ${errorMessage}`);
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
       const errorMessage = (e instanceof Error ? e.message : String(e)) || "Une erreur inconnue est survenue.";
       console.error("Erreur toggle tâche:", errorMessage, e);
       setError(`Échec du changement de statut: ${errorMessage}`);
       toast({ title: "Erreur", description: "Impossible de changer le statut.", variant: "destructive" });
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
      const errorMessage = (e instanceof Error ? e.message : String(e)) || "Une erreur inconnue est survenue.";
      console.error("Erreur suppression tâche:", errorMessage, e);
      setError(`Échec de la suppression: ${errorMessage}`);
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
       const errorMessage = (e instanceof Error ? e.message : String(e)) || "Une erreur inconnue est survenue.";
       console.error("Erreur type tâche:", errorMessage, e);
       setError(`Échec du changement de type: ${errorMessage}`);
       toast({ title: "Erreur", description: "Impossible de changer le type.", variant: "destructive" });
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
          <CardDescription className="text-sm">
            L'IA peut réorganiser, ajouter ou modifier votre liste de tâches. Donnez des instructions claires.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Ex : \"Ajoute 'relire chapitre X' comme urgent\", \"Marque toutes les tâches de lecture comme terminées\"..."
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
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-medium text-accent">Raisonnement de l'IA</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-accent/80 whitespace-pre-wrap">{aiReasoning}</p>
          </CardContent>
        </Card>
      )}

       <Card className="shadow-md" id="manual-task-card">
        <CardHeader>
          <CardTitle className="text-lg">{editingTask ? 'Modifier la Tâche' : 'Ajouter une Tâche Manuellement'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={manualTaskText}
            onChange={(e) => setManualTaskText(e.target.value)}
            placeholder="Description de la nouvelle tâche..."
            className="text-sm"
            disabled={isManualTaskLoading}
            aria-label="Description de la tâche"
          />
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <TaskTypeSelector selectedType={manualTaskType} onSelectType={setManualTaskType} disabled={isManualTaskLoading} />
            <div className="flex-grow flex gap-2">
              <Button onClick={handleAddOrUpdateManualTask} className="flex-1" disabled={isManualTaskLoading || !manualTaskText.trim()}>
                {isManualTaskLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingTask ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
                {isManualTaskLoading ? (editingTask ? 'Mise à jour...' : 'Ajout...') : (editingTask ? 'Enregistrer Modifs' : 'Ajouter la Tâche')}
              </Button>
              {editingTask && (
                  <Button variant="outline" onClick={() => { setEditingTask(null); setManualTaskText(''); setManualTaskType('secondary');}} disabled={isManualTaskLoading}>
                      Annuler
                  </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {error && (
        <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-3 text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> 
                <p>{error}</p>
            </CardContent>
        </Card>
      )}


      <Card className="flex-grow flex flex-col shadow-md overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Vos Tâches</CardTitle>
          <CardDescription className="text-sm">{isFetchingTasks ? "Chargement..." : `${tasks.length} tâche(s) au total.`}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow overflow-y-auto space-y-3 p-4 custom-scrollbar">
          {isFetchingTasks ? (
             <div className="flex justify-center items-center h-full py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
                <ListTodo className="mx-auto h-12 w-12 opacity-50 mb-3"/>
                <p className="font-medium">Aucune tâche pour le moment.</p>
                <p className="text-xs">Ajoutez-en manuellement ou utilisez l'IA !</p>
            </div>
          ) : (
            tasks.map((task) => (
              <TaskItemCard 
                key={task.id} 
                task={task} 
                onToggle={handleToggleTask} 
                onDelete={handleDeleteTask}
                onSetType={handleSetTaskType}
                onEdit={handleEditTask}
                isCurrentItemLoading={isTaskItemLoading === task.id}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    
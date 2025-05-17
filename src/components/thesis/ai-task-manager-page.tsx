
"use client";

import { useState, type FC, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import type { Task, TaskType } from '@/types';
import { modifyTaskList, type ModifyTaskListInput, type ModifyTaskListOutput } from '@/ai/flows/modify-task-list';
import { Bot, Trash2, PlusCircle, AlertTriangle, Edit2, Save, Loader2, ListTodo, ListChecks, Filter, SortAsc } from 'lucide-react';
import { ChevronDownIcon as ChevronUpDownIcon, CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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

const taskTypeClasses: Record<TaskType, { border: string; badge: string; checkbox: string }> = {
  urgent: { 
    border: "border-l-red-500 dark:border-l-red-600", 
    badge: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
    checkbox: "border-red-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-600 dark:border-red-500 dark:data-[state=checked]:bg-red-600 dark:data-[state=checked]:border-red-700"
  },
  important: { 
    border: "border-l-orange-500 dark:border-l-orange-600", 
    badge: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700",
    checkbox: "border-orange-400 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-600 dark:border-orange-500 dark:data-[state=checked]:bg-orange-600 dark:data-[state=checked]:border-orange-700"
  },
  reading: { 
    border: "border-l-green-500 dark:border-l-green-600", 
    badge: "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700",
    checkbox: "border-green-400 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-600 dark:border-green-500 dark:data-[state=checked]:bg-green-600 dark:data-[state=checked]:border-green-700"
  },
  chatgpt: { 
    border: "border-l-blue-500 dark:border-l-blue-600", 
    badge: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
    checkbox: "border-blue-400 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-600 dark:border-blue-500 dark:data-[state=checked]:bg-blue-600 dark:data-[state=checked]:border-blue-700"
  },
  secondary: { 
    border: "border-l-gray-400 dark:border-l-gray-500", 
    badge: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-700/40 dark:text-gray-300 dark:border-gray-500",
    checkbox: "border-gray-400 data-[state=checked]:bg-gray-500 data-[state=checked]:border-gray-600 dark:border-gray-500 dark:data-[state=checked]:bg-gray-600 dark:data-[state=checked]:border-gray-700"
  },
};

const TaskTypeSelector: FC<{
  selectedType: TaskType;
  onSelectType: (type: TaskType) => void;
  disabled?: boolean;
  buttonClassName?: string;
  size?: 'sm' | 'default';
}> = ({ selectedType, onSelectType, disabled, buttonClassName, size = 'default' }) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between text-sm font-normal",
            size === 'sm' ? "h-9 w-[140px]" : "h-10 w-[160px]",
            buttonClassName
          )}
          disabled={disabled}
        >
          {taskTypeLabels[selectedType]}
          <ChevronUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn(size === 'sm' ? "w-[140px]" : "w-[160px]", "p-0")}>
        <Command>
          <CommandInput placeholder="Rechercher type..." className="h-9 text-sm" />
          <CommandList>
            <CommandEmpty>Aucun type.</CommandEmpty>
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

const TaskItemCard: FC<TaskItemCardProps> = ({
  task,
  onToggle,
  onDelete,
  onSetType,
  onEdit,
  isCurrentItemLoading
}) => {
  const typeStyle = taskTypeClasses[task.type] || taskTypeClasses.secondary;

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-l-4 shadow-sm transition-all duration-150 hover:shadow-md",
        typeStyle.border,
        task.completed && "opacity-70 bg-muted/50 dark:bg-muted/20"
      )}
    >
      <CardContent className="p-3 md:p-4 flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
        <Checkbox
          id={`task-${task.id}`}
          checked={task.completed}
          onCheckedChange={(checked) => onToggle(task.id, !!checked)}
          className={cn("mt-1 h-5 w-5 shrink-0", typeStyle.checkbox)}
          disabled={isCurrentItemLoading}
          aria-label={task.completed ? "Marquer comme non terminée" : "Marquer comme terminée"}
        />
        <div className="flex-grow space-y-1.5 min-w-0">
          <p
            className={cn(
              "text-base font-medium leading-relaxed break-words",
              task.completed && "line-through text-muted-foreground"
            )}
          >
            {task.text}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <Badge variant="outline" className={cn("font-normal py-0.5 px-1.5 h-auto", typeStyle.badge)}>
              {taskTypeLabels[task.type]}
            </Badge>
            <span className="text-muted-foreground">
              Créé : {task.created_at ? format(new Date(task.created_at), "d MMM yy, HH:mm", { locale: fr }) : 'N/A'}
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:items-end gap-2 shrink-0 ml-auto sm:pl-2 w-full sm:w-auto mt-2 sm:mt-0 border-t sm:border-none pt-2 sm:pt-0">
           <TaskTypeSelector
            selectedType={task.type}
            onSelectType={(type) => onSetType(task.id, type)}
            disabled={isCurrentItemLoading}
            size="sm"
            buttonClassName="w-full sm:w-[140px]"
          />
          <div className="flex gap-1.5 w-full sm:w-auto">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onEdit(task)}
              className="h-9 w-9 flex-grow sm:flex-grow-0"
              disabled={isCurrentItemLoading}
              title="Modifier la tâche"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="destructiveOutline"
              size="icon"
              onClick={() => onDelete(task.id)}
              className="h-9 w-9 flex-grow sm:flex-grow-0"
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

type FilterStatus = "all" | "pending" | "completed";
type FilterType = "all" | TaskType;
type SortOrder = "date-newest" | "date-oldest" | "type" | "text";

const sortOptions: { value: SortOrder; label: string }[] = [
  { value: "date-newest", label: "Date (plus récent)" },
  { value: "date-oldest", label: "Date (plus ancien)" },
  { value: "type", label: "Type de tâche" },
  { value: "text", label: "Texte (A-Z)" },
];

const statusOptions: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "Tous les statuts" },
  { value: "pending", label: "En attente" },
  { value: "completed", label: "Terminées" },
];

const typeFilterOptions: { value: FilterType; label: string }[] = [
  { value: "all", label: "Tous les types" },
  ...(Object.keys(taskTypeLabels) as TaskType[]).map(type => ({ value: type, label: taskTypeLabels[type] }))
];


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
  
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("date-newest");

  const { toast } = useToast();

  const fetchTasks = useCallback(async () => {
    setIsFetchingTasks(true);
    setError(null);
    try {
      const { data, error: supabaseError } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false }); // Initial fetch always newest first

      if (supabaseError) throw supabaseError;
      setTasks(data || []);
    } catch (e: any) {
      const errorMessage = e.message || "Une erreur inconnue est survenue.";
      setError(`Échec de la récupération des tâches: ${errorMessage}`);
      toast({ title: "Erreur de Chargement", description: `Impossible de charger les tâches: ${errorMessage}`, variant: "destructive" });
    } finally {
      setIsFetchingTasks(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTasks();
    const channel = supabase
      .channel('db-tasks-page-updates-aitaskmanager')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (_payload) => {
        fetchTasks();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks]);

  const filteredAndSortedTasks = useMemo(() => {
    let processedTasks = [...tasks];

    // Filter by status
    if (filterStatus === "pending") {
      processedTasks = processedTasks.filter(task => !task.completed);
    } else if (filterStatus === "completed") {
      processedTasks = processedTasks.filter(task => task.completed);
    }

    // Filter by type
    if (filterType !== "all") {
      processedTasks = processedTasks.filter(task => task.type === filterType);
    }

    // Sort
    switch (sortOrder) {
      case "date-newest":
        processedTasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "date-oldest":
        processedTasks.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "type":
        const typeOrder: TaskType[] = ["urgent", "important", "reading", "chatgpt", "secondary"];
        processedTasks.sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type));
        break;
      case "text":
        processedTasks.sort((a, b) => a.text.localeCompare(b.text, fr, { sensitivity: 'base' }));
        break;
    }
    return processedTasks;
  }, [tasks, filterStatus, filterType, sortOrder]);


  const handleAiModifyTasks = async () => {
    if (instructions.trim() === '') return;
    setIsAiLoading(true);
    setError(null);
    setAiReasoning(null);
    try {
      const currentTaskStrings = tasks.map(t => `${t.text} (ID: ${t.id}, Terminé: ${t.completed}, Type: ${t.type})`);
      const input: ModifyTaskListInput = { instructions, taskList: currentTaskStrings };
      const result: ModifyTaskListOutput = await modifyTaskList(input);

      const { error: deleteError } = await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all tasks
      if (deleteError) throw deleteError;

      const newTasksToInsert: Array<Omit<Task, 'id' | 'created_at'>> = result.modifiedTaskList.map((taskText) => {
        const textOnly = taskText.replace(/\s*\((?:ID: [\w-]+, )?(?:Terminé|Completed): (?:true|false|vrai|faux), Type: \w+\)/gi, '').trim();
        const completedMatch = taskText.match(/(?:Terminé|Completed): (true|false|vrai|faux)/i);
        const typeMatch = taskText.match(/Type: (urgent|important|reading|chatgpt|secondary)/i);
        return {
          text: textOnly,
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
      const errorMessage = e.message || "Une erreur inconnue est survenue lors de la modification par l'IA.";
      setError(errorMessage);
      toast({ title: "Erreur IA", description: errorMessage, variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAddOrUpdateManualTask = async () => {
    if (manualTaskText.trim() === '') {
      toast({ title: "Validation", description: "La description de la tâche ne peut pas être vide." });
      return;
    }
    setIsManualTaskLoading(true);
    setError(null);
    const taskPayload = { text: manualTaskText.trim(), type: manualTaskType, completed: editingTask ? editingTask.completed : false };
    try {
      if (editingTask) {
        const { error: updateError } = await supabase.from('tasks').update(taskPayload).eq('id', editingTask.id);
        if (updateError) throw updateError;
        toast({ title: "Tâche mise à jour", description: `"${manualTaskText}" a été modifiée.` });
      } else {
        const { error: insertError } = await supabase.from('tasks').insert(taskPayload);
        if (insertError) throw insertError;
        toast({ title: "Tâche ajoutée", description: `"${manualTaskText}" a été ajoutée.` });
      }
      setEditingTask(null);
      setManualTaskText('');
      setManualTaskType('secondary');
    } catch (e: any) {
      const errorMessage = e.message || "Une erreur inconnue est survenue.";
      setError(`Échec de l'enregistrement: ${errorMessage}`);
      toast({ title: "Erreur d'enregistrement", description: `Impossible d'enregistrer la tâche: ${errorMessage}`, variant: "destructive" });
    } finally {
      setIsManualTaskLoading(false);
    }
  };

  const handleToggleTask = async (id: string, completed: boolean) => {
    setIsTaskItemLoading(id);
    setError(null);
    try {
      const { error: updateError } = await supabase.from('tasks').update({ completed }).eq('id', id);
      if (updateError) throw updateError;
    } catch (e: any) {
      const errorMessage = e.message || "Impossible de changer le statut.";
      setError(errorMessage);
      toast({ title: "Erreur de Mise à Jour", description: errorMessage, variant: "destructive" });
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
        setEditingTask(null); setManualTaskText(''); setManualTaskType('secondary');
      }
      toast({ title: "Tâche supprimée" });
    } catch (e: any) {
      const errorMessage = e.message || "Impossible de supprimer la tâche.";
      setError(errorMessage);
      toast({ title: "Erreur de Suppression", description: errorMessage, variant: "destructive" });
    } finally {
      setIsTaskItemLoading(null);
    }
  };

  const handleSetTaskType = async (id: string, type: TaskType) => {
    setIsTaskItemLoading(id);
    setError(null);
    try {
      const { error: updateError } = await supabase.from('tasks').update({ type }).eq('id', id);
      if (updateError) throw updateError;
    } catch (e: any) {
      const errorMessage = e.message || "Impossible de changer le type.";
      setError(errorMessage);
      toast({ title: "Erreur de Mise à Jour", description: errorMessage, variant: "destructive" });
    } finally {
      setIsTaskItemLoading(null);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setManualTaskText(task.text);
    setManualTaskType(task.type);
    document.getElementById('manual-task-card-content')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex items-center gap-3">
        <ListTodo className="h-7 w-7 text-primary" />
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Gestionnaire de Tâches IA</h1>
      </div>

      <div className="flex flex-col lg:flex-row flex-grow gap-6 overflow-hidden">
        {/* --- Panneau de Contrôle (Gauche/Haut) --- */}
        <div className="lg:w-[380px] lg:max-w-sm xl:w-[420px] shrink-0 space-y-6 lg:overflow-y-auto custom-scrollbar lg:pr-2 pb-4 lg:pb-0">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bot className="h-5 w-5 text-primary" /> Gérer avec l'IA
              </CardTitle>
              <CardDescription className="text-sm">L'IA peut réorganiser, ajouter ou modifier votre liste.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Ex : Ajoute 'Relire chapitre X' comme urgent..."
                rows={3}
                className="mb-3 text-sm"
                disabled={isAiLoading || isFetchingTasks}
              />
            </CardContent>
            <CardFooter>
              <Button onClick={handleAiModifyTasks} disabled={isAiLoading || !instructions.trim() || isFetchingTasks} className="w-full">
                {isAiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                {isAiLoading ? 'Traitement IA...' : 'Soumettre à l\'IA'}
              </Button>
            </CardFooter>
          </Card>

          {aiReasoning && (
            <Card className="bg-accent/10 border-accent/30 shadow-sm">
              <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm font-medium text-accent">Raisonnement de l'IA</CardTitle></CardHeader>
              <CardContent className="py-3"><p className="text-xs text-accent/80 whitespace-pre-wrap">{aiReasoning}</p></CardContent>
            </Card>
          )}

          <Card className="shadow-md" id="manual-task-card">
            <CardHeader>
              <CardTitle className="text-lg">{editingTask ? 'Modifier la Tâche' : 'Ajouter une Tâche'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 py-4" id="manual-task-card-content">
              <Input
                value={manualTaskText}
                onChange={(e) => setManualTaskText(e.target.value)}
                placeholder="Description de la tâche..."
                className="text-sm"
                disabled={isManualTaskLoading}
                aria-label="Description de la tâche"
              />
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <TaskTypeSelector selectedType={manualTaskType} onSelectType={setManualTaskType} disabled={isManualTaskLoading} />
                <div className="flex-grow flex gap-2">
                  <Button onClick={handleAddOrUpdateManualTask} className="flex-1" disabled={isManualTaskLoading || !manualTaskText.trim()}>
                    {isManualTaskLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingTask ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
                    {isManualTaskLoading ? (editingTask ? 'Mise à jour...' : 'Ajout...') : (editingTask ? 'Enregistrer' : 'Ajouter')}
                  </Button>
                  {editingTask && (
                    <Button variant="outline" onClick={() => { setEditingTask(null); setManualTaskText(''); setManualTaskType('secondary'); }} disabled={isManualTaskLoading}>
                      Annuler
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Filter className="h-5 w-5 text-primary" /> Filtrer et Trier
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="filterStatus" className="text-sm">Statut</Label>
                <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as FilterStatus)}>
                  <SelectTrigger id="filterStatus"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filterType" className="text-sm">Type</Label>
                <Select value={filterType} onValueChange={(value) => setFilterType(value as FilterType)}>
                  <SelectTrigger id="filterType"><SelectValue /></SelectTrigger>
                  <SelectContent>
                     {typeFilterOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sortOrder" className="text-sm">Trier par</Label>
                <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
                  <SelectTrigger id="sortOrder"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sortOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- Panneau de la Liste des Tâches (Droite/Bas) --- */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Card className="flex-grow flex flex-col shadow-md overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">Vos Tâches</CardTitle>
              <CardDescription className="text-sm">
                {isFetchingTasks ? "Chargement..." : 
                  `${filteredAndSortedTasks.length} tâche(s) ${filterStatus !== 'all' || filterType !== 'all' ? 'correspondant aux filtres' : 'au total'}. 
                   ${tasks.filter(t => !t.completed).length} en attente.`
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-y-auto space-y-3 p-4 custom-scrollbar">
              {isFetchingTasks ? (
                <div className="flex-grow flex flex-col justify-center items-center py-10 text-muted-foreground">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                  <p>Chargement des tâches...</p>
                </div>
              ) : error ? (
                <div className="flex-grow flex flex-col justify-center items-center py-10 text-destructive border border-destructive/50 bg-destructive/10 rounded-md p-4">
                  <AlertTriangle className="h-10 w-10 mb-4" />
                  <p className="font-semibold">Erreur de chargement des tâches</p>
                  <p className="text-sm text-center mt-1">{error}</p>
                  <Button onClick={fetchTasks} variant="destructive" className="mt-4">Réessayer</Button>
                </div>
              ) : filteredAndSortedTasks.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center text-center p-6 text-muted-foreground border-dashed border rounded-md min-h-[200px]">
                  <ListChecks className="mx-auto h-16 w-16 opacity-50 mb-4" />
                  <p className="font-medium text-lg mb-1">
                    {tasks.length === 0 ? "Aucune tâche pour le moment." : "Aucune tâche ne correspond à vos filtres."}
                  </p>
                  <p className="text-sm mb-4">
                    {tasks.length === 0 ? "Utilisez les formulaires pour ajouter des tâches." : "Essayez d'ajuster vos filtres."}
                  </p>
                  {tasks.length === 0 && (
                    <Button onClick={() => document.getElementById('manual-task-card-content')?.scrollIntoView({ behavior: 'smooth' })}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Ajouter une tâche
                    </Button>
                  )}
                </div>
              ) : (
                filteredAndSortedTasks.map((task) => (
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
      </div>
    </div>
  );
}


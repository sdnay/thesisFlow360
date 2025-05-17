
"use client";

import { useState, type FC, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import type { Task, TaskType, Chapter, Tag } from '@/types';
import { modifyTaskList, type ModifyTaskListInput, type ModifyTaskListOutput } from '@/ai/flows/modify-task-list';
import { Bot, Trash2, PlusCircle, AlertTriangle, Edit2, Save, Loader2, ListTodo, ListChecks, Filter, ArrowUpDown, Tags, Link as LinkIcon, Timer, EllipsisVertical, XIcon, ChevronUpDownIcon as ChevronUpDownIconLucide } from 'lucide-react'; // ChevronUpDownIcon renommé
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
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth'; // Ajouté
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';


// TaskTypeSelector Component (pas de changement majeur ici, juste s'assurer qu'il est présent)
const taskTypeLabels: Record<TaskType, string> = { urgent: "Urgent", important: "Important", reading: "Lecture", chatgpt: "ChatGPT", secondary: "Secondaire" };
const taskTypeClasses: Record<TaskType, { border: string; badge: string; checkbox: string }> = {
  urgent: { border: "border-l-red-500 dark:border-l-red-600", badge: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700", checkbox: "border-red-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-600 dark:border-red-500 dark:data-[state=checked]:bg-red-600 dark:data-[state=checked]:border-red-700" },
  important: { border: "border-l-orange-500 dark:border-l-orange-600", badge: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700", checkbox: "border-orange-400 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-600 dark:border-orange-500 dark:data-[state=checked]:bg-orange-600 dark:data-[state=checked]:border-orange-700" },
  reading: { border: "border-l-green-500 dark:border-l-green-600", badge: "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700", checkbox: "border-green-400 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-600 dark:border-green-500 dark:data-[state=checked]:bg-green-600 dark:data-[state=checked]:border-green-700" },
  chatgpt: { border: "border-l-blue-500 dark:border-l-blue-600", badge: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700", checkbox: "border-blue-400 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-600 dark:border-blue-500 dark:data-[state=checked]:bg-blue-600 dark:data-[state=checked]:border-blue-700" },
  secondary: { border: "border-l-gray-400 dark:border-l-gray-500", badge: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-700/40 dark:text-gray-300 dark:border-gray-500", checkbox: "border-gray-400 data-[state=checked]:bg-gray-500 data-[state=checked]:border-gray-600 dark:border-gray-500 dark:data-[state=checked]:bg-gray-600 dark:data-[state=checked]:border-gray-700" },
};

const TaskTypeSelector: FC<{ selectedType: TaskType; onSelectType: (type: TaskType) => void; disabled?: boolean; buttonClassName?: string; size?: 'sm' | 'default';}> =
  ({ selectedType, onSelectType, disabled, buttonClassName, size = 'default' }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className={cn("justify-between text-sm font-normal", size === 'sm' ? "h-9 w-[140px]" : "h-10 w-[160px]", buttonClassName)} disabled={disabled}>
          {taskTypeLabels[selectedType]}
          <ChevronUpDownIconLucide className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn(size === 'sm' ? "w-[140px]" : "w-[160px]", "p-0")}>
        <Command>
          <CommandInput placeholder="Rechercher type..." className="h-9 text-sm" />
          <CommandList>
            <CommandEmpty>Aucun type.</CommandEmpty>
            <CommandGroup>
              {Object.entries(taskTypeLabels).map(([type, label]) => (
                <CommandItem key={type} value={type} onSelect={(currentValue) => { onSelectType(currentValue as TaskType); setOpen(false); }} className="text-sm cursor-pointer">
                  <CheckIcon className={cn("mr-2 h-4 w-4", selectedType === type ? "opacity-100" : "opacity-0")} />
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
// SimpleTagManager Component
const SimpleTagManager: FC<{
  availableTags: Tag[];
  selectedTags: Tag[];
  onTagAdd: (tagNameOrTag: string | Tag) => Promise<void>;
  onTagRemove: (tagId: string) => void;
  disabled?: boolean;
}> = ({ availableTags, selectedTags, onTagAdd, onTagRemove, disabled }) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);

  useEffect(() => {
    if (inputValue.trim() === '') {
      setSuggestions([]);
      return;
    }
    setSuggestions(
      availableTags.filter(
        (tag) =>
          tag.name.toLowerCase().includes(inputValue.toLowerCase()) &&
          !selectedTags.find((st) => st.id === tag.id)
      ).slice(0, 5)
    );
  }, [inputValue, availableTags, selectedTags]);

  const handleAdd = (tagOrName: Tag | string) => {
    onTagAdd(tagOrName);
    setInputValue('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {selectedTags.map((tag) => (
          <Badge key={tag.id} variant="secondary" style={tag.color ? { backgroundColor: tag.color, color: 'white' } : {}} className="text-xs">
            {tag.name}
            <XIcon className="ml-1.5 h-3 w-3 cursor-pointer" onClick={() => onTagRemove(tag.id)} />
          </Badge>
        ))}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ajouter ou créer un tag..."
            className="text-sm h-9"
            disabled={disabled}
          />
        </PopoverTrigger>
        {(suggestions.length > 0 || (inputValue && !availableTags.find(t => t.name.toLowerCase() === inputValue.toLowerCase()))) && (
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
            <Command>
              <CommandList>
                <CommandEmpty>
                  {inputValue ? `Créer "${inputValue}"?` : "Aucun tag trouvé."}
                </CommandEmpty>
                {suggestions.map((tag) => (
                  <CommandItem key={tag.id} value={tag.name} onSelect={() => handleAdd(tag)}>
                    {tag.name}
                  </CommandItem>
                ))}
                {inputValue && !availableTags.find(t => t.name.toLowerCase() === inputValue.toLowerCase()) && (
                  <CommandItem onSelect={() => handleAdd(inputValue)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Créer "{inputValue}"
                  </CommandItem>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
};


interface TaskItemCardProps {
  task: Task;
  onToggle: (id: string, completed: boolean) => Promise<void>;
  onSetType: (id: string, type: TaskType) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => Promise<void>; // Ajouté onDelete
  onStartPomodoro: (task: Task) => void;
  isCurrentItemLoading: boolean;
}

const TaskItemCard: FC<TaskItemCardProps> = ({ task, onToggle, onSetType, onEdit, onDelete, onStartPomodoro, isCurrentItemLoading }) => {
  const typeStyle = taskTypeClasses[task.type] || taskTypeClasses.secondary;

  return (
    <Card className={cn("relative overflow-hidden border-l-4 shadow-sm transition-all duration-150 hover:shadow-md", typeStyle.border, task.completed && "opacity-70 bg-muted/50 dark:bg-muted/20")}>
      <CardContent className="p-3 md:p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <Checkbox
            id={`task-${task.id}`}
            checked={task.completed}
            onCheckedChange={(checked) => onToggle(task.id, !!checked)}
            className={cn("mt-1 h-5 w-5 shrink-0", typeStyle.checkbox)}
            disabled={isCurrentItemLoading}
            aria-label={task.completed ? "Marquer comme non terminée" : "Marquer comme terminée"}
          />
          <div className="flex-grow space-y-1.5 min-w-0">
            <p className={cn("text-base font-medium leading-relaxed break-words", task.completed && "line-through text-muted-foreground")}>
              {task.text}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <Badge variant="outline" className={cn("font-normal py-0.5 px-1.5 h-auto", typeStyle.badge)}>{taskTypeLabels[task.type]}</Badge>
              <span className="text-muted-foreground">Créé : {task.created_at ? format(new Date(task.created_at), "d MMM yy, HH:mm", { locale: fr }) : 'N/A'}</span>
              {task.chapters && (
                <span className="text-muted-foreground flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" />
                  Chapitre: {task.chapters.name}
                </span>
              )}
            </div>
            {task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {task.tags.map(tag => (
                  <Badge key={tag.id} variant="secondary" style={tag.color ? { backgroundColor: tag.color, color: 'white' } : {}} className="text-xs">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-2 border-t sm:border-none sm:pt-0">
          <TaskTypeSelector selectedType={task.type} onSelectType={(type) => onSetType(task.id, type)} disabled={isCurrentItemLoading} size="sm" buttonClassName="w-full sm:w-[140px]" />
          <div className="flex gap-1.5 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={() => onStartPomodoro(task)} className="flex-grow sm:flex-grow-0" disabled={isCurrentItemLoading} title="Démarrer un Pomodoro pour cette tâche">
              <Timer className="mr-1.5 h-4 w-4" /> Pomodoro
            </Button>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9" disabled={isCurrentItemLoading} title="Plus d'actions">
                        <EllipsisVertical className="h-4 w-4"/>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(task)} disabled={isCurrentItemLoading}>
                        <Edit2 className="mr-2 h-4 w-4" /> Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(task.id)} disabled={isCurrentItemLoading} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

type FilterStatus = "all" | "pending" | "completed";
type FilterType = "all" | TaskType;
type SortOrder = "date-newest" | "date-oldest" | "type" | "text";
const sortOptions: { value: SortOrder; label: string }[] = [ { value: "date-newest", label: "Date (plus récent)" }, { value: "date-oldest", label: "Date (plus ancien)" }, { value: "type", label: "Type de tâche" }, { value: "text", label: "Texte (A-Z)" }, ];
const statusOptions: { value: FilterStatus; label: string }[] = [ { value: "all", label: "Tous les statuts" }, { value: "pending", label: "En attente" }, { value: "completed", label: "Terminées" }, ];
const typeFilterOptions: { value: FilterType; label: string }[] = [ { value: "all", label: "Tous les types" }, ...(Object.keys(taskTypeLabels) as TaskType[]).map(type => ({ value: type, label: taskTypeLabels[type] })) ];

export function AiTaskManagerPage() {
  const { user } = useAuth(); // Ajouté pour obtenir user_id
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [chapters, setChapters] = useState<Pick<Chapter, 'id' | 'name'>[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);

  const [instructions, setInstructions] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isManualTaskLoading, setIsManualTaskLoading] = useState(false);
  const [isTaskItemLoading, setIsTaskItemLoading] = useState<string | null>(null);
  const [isFetchingInitialData, setIsFetchingInitialData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);

  const [manualTaskText, setManualTaskText] = useState('');
  const [manualTaskType, setManualTaskType] = useState<TaskType>('secondary');
  const [manualTaskChapterId, setManualTaskChapterId] = useState<string | undefined>(undefined);
  const [manualTaskTags, setManualTaskTags] = useState<Tag[]>([]);

  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("date-newest");

  const { toast } = useToast();

  const fetchInitialData = useCallback(async () => {
    if (!user) return; // Ne rien faire si l'utilisateur n'est pas connecté
    setIsFetchingInitialData(true);
    setError(null);
    try {
      const [tasksRes, chaptersRes, tagsRes] = await Promise.all([
        supabase.from('tasks').select('*, chapters(id, name), task_tags(tags(id, name, color))').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('chapters').select('id, name').eq('user_id', user.id).order('name'),
        supabase.from('tags').select('*').eq('user_id', user.id).order('name') // Tags spécifiques à l'utilisateur
      ]);

      if (tasksRes.error) throw new Error(`Erreur tâches: ${tasksRes.error.message}`);
      if (chaptersRes.error) throw new Error(`Erreur chapitres: ${chaptersRes.error.message}`);
      if (tagsRes.error) throw new Error(`Erreur tags: ${tagsRes.error.message}`);

      const processedTasks = (tasksRes.data || []).map(task => ({
        ...task,
        tags: task.task_tags?.map((tt: any) => tt.tags) || [],
        chapters: task.chapters as { id: string, name: string } | null,
      }));
      setTasks(processedTasks);
      setChapters(chaptersRes.data || []);
      setAvailableTags(tagsRes.data || []);

    } catch (e: any) {
      const errorMessage = (e as Error).message || "Une erreur inconnue est survenue.";
      setError(`Échec de la récupération des données: ${errorMessage}`);
      toast({ title: "Erreur de Chargement", description: errorMessage, variant: "destructive" });
      console.error("Erreur fetchInitialData:", e);
    } finally {
      setIsFetchingInitialData(false);
    }
  }, [toast, user]); // Ajout de user aux dépendances

  useEffect(() => {
    if (user) { // Ne charger les données que si l'utilisateur est disponible
      fetchInitialData();
    }
  }, [user, fetchInitialData]); // Déclencher si user change

  useEffect(() => {
    if (!user) return; // Ne pas s'abonner si pas d'utilisateur

    const taskChannel = supabase
      .channel('tasks-page-updates-for-user')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` }, () => fetchInitialData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_tags' /* Potentiellement filtrer par user_id via la tâche liée */ }, () => fetchInitialData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags', filter: `user_id=eq.${user.id}` }, () => fetchInitialData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chapters', filter: `user_id=eq.${user.id}` }, () => fetchInitialData())
      .subscribe();

    return () => {
      supabase.removeChannel(taskChannel);
    };
  }, [user, fetchInitialData]); // S'abonner/se désabonner si user change

  const filteredAndSortedTasks = useMemo(() => {
    let processedTasks = [...tasks];
    if (filterStatus === "pending") processedTasks = processedTasks.filter(task => !task.completed);
    else if (filterStatus === "completed") processedTasks = processedTasks.filter(task => task.completed);
    if (filterType !== "all") processedTasks = processedTasks.filter(task => task.type === filterType);

    switch (sortOrder) {
      case "date-newest": processedTasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case "date-oldest": processedTasks.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      case "type": const typeOrder: TaskType[] = ["urgent", "important", "reading", "chatgpt", "secondary"]; processedTasks.sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type)); break;
      case "text": processedTasks.sort((a, b) => a.text.localeCompare(b.text, fr, { sensitivity: 'base' })); break;
    }
    return processedTasks;
  }, [tasks, filterStatus, filterType, sortOrder]);

  const saveTaskTags = async (taskId: string, tagsToSave: Tag[]) => {
    if (!user) return;
    // 1. Supprimer les anciennes liaisons
    await supabase.from('task_tags').delete().eq('task_id', taskId);
    // 2. Insérer les nouvelles liaisons
    if (tagsToSave.length > 0) {
      const newLinks = tagsToSave.map(tag => ({ task_id: taskId, tag_id: tag.id }));
      const { error: linkError } = await supabase.from('task_tags').insert(newLinks);
      if (linkError) throw new Error(`Erreur liaison nouveaux tags: ${linkError.message}`);
    }
  };

  const handleAddOrUpdateManualTask = async () => {
    if (!user || manualTaskText.trim() === '') return;
    setIsManualTaskLoading(true);
    setError(null);

    const taskPayload = {
      user_id: user.id, // Ajouté
      text: manualTaskText.trim(),
      type: manualTaskType,
      completed: editingTask ? editingTask.completed : false,
      chapter_id: manualTaskChapterId || null,
    };

    try {
      let savedTaskWithRelations: Task | null = null;
      if (editingTask) {
        const { data: updatedTask, error: updateError } = await supabase
          .from('tasks').update(taskPayload).eq('id', editingTask.id).eq('user_id', user.id).select().single();
        if (updateError) throw updateError;
        if (!updatedTask) throw new Error("La tâche mise à jour n'a pas été retournée.");
        await saveTaskTags(updatedTask.id, manualTaskTags);

        const { data: fetchedTask, error: fetchError } = await supabase.from('tasks')
          .select('*, chapters(id, name), task_tags(tags(id, name, color))')
          .eq('id', updatedTask.id).eq('user_id', user.id).single();
        if (fetchError || !fetchedTask) throw fetchError || new Error("Impossible de récupérer la tâche mise à jour avec ses relations.");

        savedTaskWithRelations = {
          ...fetchedTask,
          user_id: user.id,
          tags: fetchedTask.task_tags?.map((tt: any) => tt.tags) || [],
          chapters: fetchedTask.chapters as { id: string, name: string } | null,
        };
        setTasks(prevTasks => prevTasks.map(t => t.id === savedTaskWithRelations!.id ? savedTaskWithRelations! : t));
        toast({ title: "Tâche mise à jour" });
      } else {
        const { data: newTask, error: insertError } = await supabase
          .from('tasks').insert(taskPayload).select().single();
        if (insertError) throw insertError;
        if (!newTask) throw new Error("La nouvelle tâche n'a pas été retournée.");
        await saveTaskTags(newTask.id, manualTaskTags);
        const { data: fetchedTask, error: fetchError } = await supabase.from('tasks')
          .select('*, chapters(id, name), task_tags(tags(id, name, color))')
          .eq('id', newTask.id).eq('user_id', user.id).single();
        if (fetchError || !fetchedTask) throw fetchError || new Error("Impossible de récupérer la nouvelle tâche avec ses relations.");

        savedTaskWithRelations = {
          ...fetchedTask,
          user_id: user.id,
          tags: fetchedTask.task_tags?.map((tt: any) => tt.tags) || [],
          chapters: fetchedTask.chapters as { id: string, name: string } | null,
        };
        setTasks(prevTasks => [savedTaskWithRelations!, ...prevTasks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        toast({ title: "Tâche ajoutée" });
      }
      setEditingTask(null); setManualTaskText(''); setManualTaskType('secondary'); setManualTaskChapterId(undefined); setManualTaskTags([]);
    } catch (e: any) {
      const errorMessage = (e as Error).message || "Erreur inconnue.";
      setError(errorMessage); toast({ title: "Erreur d'enregistrement", description: errorMessage, variant: "destructive" });
    } finally {
      setIsManualTaskLoading(false);
    }
  };

  const handleToggleTask = async (id: string, completed: boolean) => {
    if (!user) return;
    setIsTaskItemLoading(id);
    setError(null);
    try {
      const { data: updatedTask, error } = await supabase
        .from('tasks').update({ completed }).eq('id', id).eq('user_id', user.id).select('*, chapters(id,name), task_tags(tags(id,name,color))').single();
      if (error) throw error;
      if (updatedTask) {
        const processedTask = { ...updatedTask, user_id: user.id, tags: updatedTask.task_tags?.map((tt: any) => tt.tags) || [], chapters: updatedTask.chapters as { id: string, name: string } | null };
        setTasks(prevTasks => prevTasks.map(t => t.id === id ? processedTask : t));
      }
    } catch (e: any) { /* ... gestion erreur ... */ }
    finally { setIsTaskItemLoading(null); }
  };

  const handleDeleteTask = async (id: string) => {
    if (!user) return;
    setIsTaskItemLoading(id);
    setError(null);
    try {
      await supabase.from('task_tags').delete().eq('task_id', id); // Les RLS sur task_tags s'assureront que seul le propriétaire peut faire ça indirectement
      const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      setTasks(prevTasks => prevTasks.filter(t => t.id !== id));
      if (editingTask && editingTask.id === id) { setEditingTask(null); setManualTaskText(''); setManualTaskType('secondary'); setManualTaskChapterId(undefined); setManualTaskTags([]); }
      toast({ title: "Tâche supprimée" });
    } catch (e: any) {
        const errorMessage = (e as Error).message || "Erreur inconnue.";
        setError(errorMessage); toast({ title: "Erreur de suppression", description: errorMessage, variant: "destructive" });
    }
    finally { setIsTaskItemLoading(null); }
  };

  const handleSetTaskType = async (id: string, type: TaskType) => {
    if (!user) return;
    setIsTaskItemLoading(id);
    setError(null);
    try {
      const { data: updatedTask, error } = await supabase
        .from('tasks').update({ type }).eq('id', id).eq('user_id', user.id).select('*, chapters(id,name), task_tags(tags(id,name,color))').single();
      if (error) throw error;
       if (updatedTask) {
        const processedTask = { ...updatedTask, user_id: user.id, tags: updatedTask.task_tags?.map((tt: any) => tt.tags) || [], chapters: updatedTask.chapters as { id: string, name: string } | null };
        setTasks(prevTasks => prevTasks.map(t => t.id === id ? processedTask : t));
      }
    } catch (e: any) { /* ... gestion erreur ... */ }
    finally { setIsTaskItemLoading(null); }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setManualTaskText(task.text);
    setManualTaskType(task.type);
    setManualTaskChapterId(task.chapter_id || undefined);
    setManualTaskTags(task.tags || []);
    document.getElementById('manual-task-card-content')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleStartPomodoroForTask = (task: Task) => {
    router.push(`/pomodoro?taskId=${task.id}&taskText=${encodeURIComponent(task.text)}`);
  };

  const handleAddTagToManualTask = async (tagNameOrTag: string | Tag) => {
    if (!user) return;
    let finalTag: Tag | undefined;
    if (typeof tagNameOrTag === 'string') {
      const existingTag = availableTags.find(t => t.name.toLowerCase() === tagNameOrTag.toLowerCase() && t.user_id === user.id);
      if (existingTag) {
        finalTag = existingTag;
      } else {
        const { data: newTagFromDb, error: tagError } = await supabase.from('tags').insert({ name: tagNameOrTag, user_id: user.id }).select().single();
        if (tagError) { toast({ title: "Erreur création Tag", description: tagError.message, variant: "destructive" }); return; }
        if (newTagFromDb) {
          finalTag = { ...newTagFromDb, user_id: user.id };
          setAvailableTags(prev => [...prev, finalTag!].sort((a,b) => a.name.localeCompare(b.name)));
        }
      }
    } else {
      finalTag = tagNameOrTag;
    }
    if (finalTag && !manualTaskTags.find(mt => mt.id === finalTag!.id)) {
      setManualTaskTags(prev => [...prev, finalTag!]);
    }
  };

  const handleRemoveTagFromManualTask = (tagId: string) => {
    setManualTaskTags(prev => prev.filter(t => t.id !== tagId));
  };

  const handleAiModifyTasks = async () => {
    if (!user || instructions.trim() === '') return;
    setIsAiLoading(true);
    setError(null);
    setAiReasoning(null);

    const currentTaskListStrings = tasks.map(t => `${t.text} (Type: ${t.type}, Complété: ${t.completed})`);
    const input: ModifyTaskListInput = { instructions, taskList: currentTaskListStrings };

    try {
      const result: ModifyTaskListOutput = await modifyTaskList(input);
      setAiReasoning(result.reasoning);

      // Supprimer toutes les tâches existantes de l'utilisateur
      const { error: deleteError } = await supabase.from('tasks').delete().eq('user_id', user.id);
      if (deleteError) throw deleteError;

      // Insérer les nouvelles tâches
      const newTasksToInsert = result.modifiedTaskList.map(taskString => {
        // Essayer d'extraire le type si l'IA le fournit, sinon 'secondary' par défaut
        const match = taskString.match(/\(Type:\s*(\w+)/i);
        let type: TaskType = 'secondary';
        if (match && match[1] && Object.keys(taskTypeLabels).includes(match[1].toLowerCase() as TaskType) ) {
            type = match[1].toLowerCase() as TaskType;
        }
        const text = taskString.replace(/\s*\(Type:\s*\w+.*?\)/i, '').trim(); // Enlever la partie type du texte

        return {
          text: text,
          type: type,
          completed: false, // Par défaut les nouvelles tâches de l'IA ne sont pas complétées
          user_id: user.id,
        };
      });

      if (newTasksToInsert.length > 0) {
        const { error: insertError } = await supabase.from('tasks').insert(newTasksToInsert);
        if (insertError) throw insertError;
      }
      // Le fetchInitialData via Realtime mettra à jour la liste des tâches
      toast({ title: "Liste des tâches modifiée par l'IA", description: "Votre liste a été mise à jour." });
    } catch (e: any) {
      const errorMessage = (e as Error).message || "Erreur de l'IA.";
      setError(errorMessage);
      toast({ title: "Erreur IA", description: errorMessage, variant: "destructive" });
    } finally {
      setIsAiLoading(false);
      setInstructions('');
    }
  };

  if (!user && !isFetchingInitialData) { // Si l'utilisateur n'est pas encore chargé mais que le fetch initial est terminé
      return (
        <div className="p-4 md:p-6 h-full flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-muted-foreground">Chargement des informations utilisateur...</p>
        </div>
    );
  }


  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex items-center gap-3">
        <ListTodo className="h-7 w-7 text-primary" />
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Gestionnaire de Tâches</h1>
      </div>

      <div className="flex flex-col lg:flex-row flex-grow gap-6 overflow-hidden">
        {/* Panneau de Contrôle */}
        <div className="lg:w-[420px] lg:max-w-md xl:w-[450px] shrink-0 space-y-6 lg:overflow-y-auto custom-scrollbar lg:pr-3 pb-4 lg:pb-0">
          <Card className="shadow-md">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Bot className="h-5 w-5 text-primary" /> Gérer avec l'IA</CardTitle><CardDescription className="text-sm">L'IA peut réorganiser, ajouter ou modifier votre liste.</CardDescription></CardHeader>
            <CardContent><Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Ex : Ajoute 'Relire chapitre X' comme urgent..." rows={3} className="mb-3 text-sm" disabled={isAiLoading || isFetchingInitialData} /></CardContent>
            <CardFooter><Button onClick={handleAiModifyTasks} disabled={isAiLoading || !instructions.trim() || isFetchingInitialData} className="w-full">{isAiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />} {isAiLoading ? 'Traitement IA...' : 'Soumettre à l\'IA'}</Button></CardFooter>
             {aiReasoning && (<CardFooter className="pt-3 text-xs text-muted-foreground italic border-t">Raisonnement IA : {aiReasoning}</CardFooter>)}
          </Card>

          <Card className="shadow-md" id="manual-task-card">
            <CardHeader><CardTitle className="text-lg">{editingTask ? 'Modifier la Tâche' : 'Ajouter une Tâche Manuellement'}</CardTitle></CardHeader>
            <CardContent className="space-y-4 py-4" id="manual-task-card-content">
              <div><Label htmlFor="manualTaskText" className="mb-1.5 block">Description</Label><Input id="manualTaskText" value={manualTaskText} onChange={(e) => setManualTaskText(e.target.value)} placeholder="Description..." className="text-sm" disabled={isManualTaskLoading} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label htmlFor="manualTaskTypeSelect" className="mb-1.5 block">Type</Label><TaskTypeSelector selectedType={manualTaskType} onSelectType={setManualTaskType} disabled={isManualTaskLoading} /></div>
                <div>
                  <Label htmlFor="manualTaskChapterSelect" className="mb-1.5 block">Chapitre (Optionnel)</Label>
                  <Select value={manualTaskChapterId || "none"} onValueChange={(value) => setManualTaskChapterId(value === "none" ? undefined : value)} disabled={isManualTaskLoading || chapters.length === 0}>
                    <SelectTrigger id="manualTaskChapterSelect" className="text-sm h-10"><SelectValue placeholder={chapters.length === 0 ? "Aucun chapitre" : "Lier à un chapitre..."} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun chapitre</SelectItem>
                      {chapters.map(chap => <SelectItem key={chap.id} value={chap.id}>{chap.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block">Tags (Optionnel)</Label>
                <SimpleTagManager
                  availableTags={availableTags}
                  selectedTags={manualTaskTags}
                  onTagAdd={handleAddTagToManualTask}
                  onTagRemove={handleRemoveTagFromManualTask}
                  disabled={isManualTaskLoading}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleAddOrUpdateManualTask} className="flex-1" disabled={isManualTaskLoading || !manualTaskText.trim()}>{isManualTaskLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingTask ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)} {isManualTaskLoading ? (editingTask ? 'Mise à jour...' : 'Ajout...') : (editingTask ? 'Enregistrer' : 'Ajouter la Tâche')}</Button>
                {editingTask && (<Button variant="outline" onClick={() => { setEditingTask(null); setManualTaskText(''); setManualTaskType('secondary'); setManualTaskChapterId(undefined); setManualTaskTags([]); }} disabled={isManualTaskLoading}>Annuler</Button>)}
              </div>
            </CardContent>
          </Card>

           <Card className="shadow-md">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Filter className="h-5 w-5 text-primary" /> Filtrer et Trier</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label htmlFor="filterStatusSel" className="text-sm mb-1.5 block">Statut</Label><Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as FilterStatus)}><SelectTrigger id="filterStatusSel" className="text-sm h-10"><SelectValue /></SelectTrigger><SelectContent>{statusOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label htmlFor="filterTypeSel" className="text-sm mb-1.5 block">Type</Label><Select value={filterType} onValueChange={(value) => setFilterType(value as FilterType)}><SelectTrigger id="filterTypeSel" className="text-sm h-10"><SelectValue /></SelectTrigger><SelectContent>{typeFilterOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label htmlFor="sortOrderSel" className="text-sm mb-1.5 block">Trier par</Label><Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}><SelectTrigger id="sortOrderSel" className="text-sm h-10"><SelectValue /></SelectTrigger><SelectContent>{sortOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div>
            </CardContent>
          </Card>
        </div>

        {/* Panneau Liste des Tâches */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Card className="flex-grow flex flex-col shadow-md overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">Vos Tâches</CardTitle>
              <CardDescription className="text-sm">{isFetchingInitialData ? "Chargement..." : `${filteredAndSortedTasks.length} tâche(s) ${filterStatus !== 'all' || filterType !== 'all' ? 'correspondant aux filtres' : 'au total'}. ${tasks.filter(t => !t.completed).length} en attente.`}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-y-auto space-y-3 p-4 custom-scrollbar">
              {isFetchingInitialData ? ( <div className="flex-grow flex flex-col justify-center items-center py-10 text-muted-foreground"><Loader2 className="h-10 w-10 animate-spin text-primary mb-4" /><p>Chargement des tâches...</p></div>
              ) : error ? ( <div className="flex-grow flex flex-col justify-center items-center py-10 text-destructive border border-destructive/50 bg-destructive/10 rounded-md p-4"><AlertTriangle className="h-10 w-10 mb-4" /><p className="font-semibold">Erreur de chargement</p><p className="text-sm text-center mt-1">{error}</p><Button onClick={fetchInitialData} variant="destructive" className="mt-4">Réessayer</Button></div>
              ) : filteredAndSortedTasks.length === 0 ? ( <div className="flex-grow flex flex-col items-center justify-center text-center p-6 text-muted-foreground border-dashed border rounded-md min-h-[200px]"><ListChecks className="mx-auto h-16 w-16 opacity-50 mb-4" /><p className="font-medium text-lg mb-1">{tasks.length === 0 ? "Aucune tâche pour le moment." : "Aucune tâche ne correspond à vos filtres."}</p><p className="text-sm mb-4">{tasks.length === 0 ? "Utilisez les formulaires pour ajouter des tâches." : "Essayez d'ajuster vos filtres."}</p>{tasks.length === 0 && (<Button onClick={() => { const el = document.getElementById('manual-task-card-content'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); const inputField = el.querySelector('input#manualTaskText'); if (inputField) (inputField as HTMLInputElement).focus(); } }}> <PlusCircle className="mr-2 h-4 w-4" /> Ajouter une tâche </Button>)}</div>
              ) : ( filteredAndSortedTasks.map((task) => ( <TaskItemCard key={task.id} task={task} onToggle={handleToggleTask} onSetType={handleSetTaskType} onEdit={handleEditTask} onDelete={handleDeleteTask} onStartPomodoro={handleStartPomodoroForTask} isCurrentItemLoading={isTaskItemLoading === task.id} /> )))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

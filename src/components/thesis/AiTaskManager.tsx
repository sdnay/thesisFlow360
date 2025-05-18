
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Task, TaskType, Chapter, Tag } from '@/types';
import { modifyTaskList, type ModifyTaskListInput, type ModifyTaskListOutput } from '@/ai/flows/modify-task-list';
import { Bot, Trash2, PlusCircle, AlertTriangle, Edit2, Save, Loader2, ListTodo, ListChecks, Filter as FilterIcon, ArrowUpDown, Tags as TagsIcon, ChevronsUpDownIcon as ChevronUpDownIconLucide, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import TagManager from '@/components/ui/tag-manager';
import TaskTypeSelector from './task-manager-components/TaskTypeSelector';
import TaskItemCard from './task-manager-components/TaskItemCard';

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
const taskTypeLabels: Record<TaskType, string> = { urgent: "Urgent", important: "Important", reading: "Lecture", chatgpt: "ChatGPT", secondary: "Secondaire" };
const typeFilterOptions: { value: FilterType; label: string }[] = [
  { value: "all", label: "Tous les types" },
  ...(Object.keys(taskTypeLabels) as TaskType[]).map(type => ({ value: type, label: taskTypeLabels[type] }))
];

export default function AiTaskManager() {
  const { user } = useAuth();
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
    if (!user) {
      setIsFetchingInitialData(false); return;
    }
    setIsFetchingInitialData(true); setError(null);
    try {
      const [tasksRes, chaptersRes, tagsRes] = await Promise.all([
        supabase.from('tasks').select('*, chapters(id, name), task_tags(tags(id, name, color))').eq('user_id', user.id),
        supabase.from('chapters').select('id, name').eq('user_id', user.id).order('name'),
        supabase.from('tags').select('*').eq('user_id', user.id).order('name')
      ]);

      if (tasksRes.error) throw new Error(`Erreur tâches: ${tasksRes.error.message}`);
      if (chaptersRes.error) throw new Error(`Erreur chapitres: ${chaptersRes.error.message}`);
      if (tagsRes.error) throw new Error(`Erreur tags: ${tagsRes.error.message}`);

      setTasks((tasksRes.data || []).map(task => ({ ...task, tags: task.task_tags?.map((tt: any) => tt.tags) || [], chapters: task.chapters as {id:string, name:string}|null })));
      setChapters(chaptersRes.data || []);
      setAvailableTags(tagsRes.data || []);

    } catch (e: any) {
      const errorMessage = (e as Error).message;
      setError(`Échec de la récupération des données: ${errorMessage}`);
      toast({ title: "Erreur de Chargement", description: errorMessage, variant: "destructive" });
    } finally {
      setIsFetchingInitialData(false);
    }
  }, [toast, user]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`ai-task-manager-user-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` }, (payload) => { console.log('Tasks change detected', payload); fetchInitialData();})
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_tags' }, (payload) => { console.log('Task_tags change detected', payload); fetchInitialData();}) // Peut être affiné
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags', filter: `user_id=eq.${user.id}` }, (payload) => { console.log('Tags change detected', payload); fetchInitialData();})
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chapters', filter: `user_id=eq.${user.id}` }, (payload) => { console.log('Chapters change detected', payload); fetchInitialData();})
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchInitialData]);

  const filteredAndSortedTasks = useMemo(() => {
    let processedTasks = [...tasks];
    if (filterStatus === "pending") processedTasks = processedTasks.filter(task => !task.completed);
    else if (filterStatus === "completed") processedTasks = processedTasks.filter(task => task.completed);
    if (filterType !== "all") processedTasks = processedTasks.filter(task => task.type === filterType);

    switch (sortOrder) {
      case "date-newest": processedTasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case "date-oldest": processedTasks.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      case "type": 
        const typeOrder: TaskType[] = ["urgent", "important", "reading", "chatgpt", "secondary"];
        processedTasks.sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type));
        break;
      case "text": processedTasks.sort((a, b) => a.text.localeCompare(b.text, fr, { sensitivity: 'base' })); break;
    }
    return processedTasks;
  }, [tasks, filterStatus, filterType, sortOrder]);

  const saveTaskTags = async (taskId: string, tagsToSave: Tag[]) => {
    if (!user) throw new Error("Utilisateur non authentifié.");
    await supabase.from('task_tags').delete().eq('task_id', taskId);
    if (tagsToSave.length > 0) {
      const newLinks = tagsToSave.map(tag => ({ task_id: taskId, tag_id: tag.id }));
      const { error: linkError } = await supabase.from('task_tags').insert(newLinks);
      if (linkError) throw new Error(`Erreur lors de la liaison des tags: ${linkError.message}`);
    }
  };

  const handleAddOrUpdateManualTask = async () => {
    if (!user || manualTaskText.trim() === '') return;
    setIsManualTaskLoading(true); setError(null);
    const taskPayload = {
      user_id: user.id, text: manualTaskText.trim(), type: manualTaskType,
      completed: editingTask ? editingTask.completed : false, chapter_id: manualTaskChapterId || null,
    };
    try {
      let savedTaskData: Pick<Task, 'id' | 'created_at'>;
      if (editingTask) {
        const { data, error } = await supabase.from('tasks').update(taskPayload).eq('id', editingTask.id).select('id, created_at').single();
        if (error) throw error;
        savedTaskData = data!;
      } else {
        const { data, error } = await supabase.from('tasks').insert(taskPayload).select('id, created_at').single();
        if (error) throw error;
        savedTaskData = data!;
      }
      await saveTaskTags(savedTaskData.id, manualTaskTags);
      
      // Re-fetch the task with all its relations to update the local state correctly
      const { data: fetchedTask, error: fetchError } = await supabase
        .from('tasks')
        .select('*, chapters(id, name), task_tags(tags(id, name, color))')
        .eq('id', savedTaskData.id)
        .eq('user_id', user.id)
        .single();

      if (fetchError || !fetchedTask) throw fetchError || new Error("Impossible de récupérer la tâche mise à jour avec ses relations.");
      
      const processedTask: Task = { ...fetchedTask, tags: fetchedTask.task_tags?.map((tt: any) => tt.tags) || [], chapters: fetchedTask.chapters as {id:string, name:string}|null };

      if (editingTask) {
        setTasks(prevTasks => prevTasks.map(t => t.id === processedTask.id ? processedTask : t));
        toast({ title: "Tâche mise à jour" });
      } else {
        setTasks(prevTasks => [processedTask, ...prevTasks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        toast({ title: "Tâche ajoutée" });
      }
      setEditingTask(null); setManualTaskText(''); setManualTaskType('secondary'); setManualTaskChapterId(undefined); setManualTaskTags([]);
    } catch (e: any) {
      const errorMessage = (e as Error).message;
      setError(errorMessage); toast({ title: "Erreur d'enregistrement", description: errorMessage, variant: "destructive" });
    } finally { setIsManualTaskLoading(false); }
  };

  const handleToggleTask = async (id: string, completed: boolean) => {
    if (!user) return; setIsTaskItemLoading(id); setError(null);
    try {
      const { data: updatedTask, error } = await supabase.from('tasks').update({ completed }).eq('id', id).select('*, chapters(id,name), task_tags(tags(id,name,color))').single();
      if (error) throw error;
      if (updatedTask) {
        const processedTask: Task = { ...updatedTask, tags: updatedTask.task_tags?.map((tt: any) => tt.tags) || [], chapters: updatedTask.chapters as {id:string, name:string}|null };
        setTasks(prevTasks => prevTasks.map(t => t.id === id ? processedTask : t));
      }
    } catch (e: any) { const errorMessage = (e as Error).message; setError(errorMessage); toast({ title: "Erreur MàJ Statut", description: errorMessage, variant: "destructive" });
    } finally { setIsTaskItemLoading(null); }
  };

  const handleDeleteTask = async (id: string) => {
    if (!user) return; setIsTaskItemLoading(id); setError(null);
    try {
      await supabase.from('task_tags').delete().eq('task_id', id); // Supprimer les liaisons de tags d'abord
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      setTasks(prevTasks => prevTasks.filter(t => t.id !== id));
      if (editingTask && editingTask.id === id) { setEditingTask(null); setManualTaskText(''); setManualTaskType('secondary'); setManualTaskChapterId(undefined); setManualTaskTags([]); }
      toast({ title: "Tâche supprimée" });
    } catch (e: any) { const errorMessage = (e as Error).message; setError(errorMessage); toast({ title: "Erreur de suppression", description: errorMessage, variant: "destructive" });
    } finally { setIsTaskItemLoading(null); }
  };

  const handleSetTaskType = async (id: string, type: TaskType) => {
    if (!user) return; setIsTaskItemLoading(id); setError(null);
    try {
      const { data: updatedTask, error } = await supabase.from('tasks').update({ type }).eq('id', id).select('*, chapters(id,name), task_tags(tags(id,name,color))').single();
      if (error) throw error;
      if (updatedTask) {
        const processedTask: Task = { ...updatedTask, tags: updatedTask.task_tags?.map((tt: any) => tt.tags) || [], chapters: updatedTask.chapters as {id:string, name:string}|null };
        setTasks(prevTasks => prevTasks.map(t => t.id === id ? processedTask : t));
      }
    } catch (e: any) { const errorMessage = (e as Error).message; setError(errorMessage); toast({ title: "Erreur MàJ Type", description: errorMessage, variant: "destructive" });
    } finally { setIsTaskItemLoading(null); }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task); setManualTaskText(task.text); setManualTaskType(task.type);
    setManualTaskChapterId(task.chapter_id || undefined); setManualTaskTags(task.tags || []);
    document.getElementById('manual-task-card-content')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleStartPomodoroForTask = (task: Task) => { router.push(`/pomodoro?taskId=${task.id}&taskText=${encodeURIComponent(task.text)}`); };

  const handleAddTagToManualTask = async (tagOrNewName: Tag | string) => {
    if (!user) return;
    let finalTag: Tag | undefined;
    if (typeof tagOrNewName === 'string') {
      const existingTag = availableTags.find(t => t.name.toLowerCase() === tagOrNewName.toLowerCase() && t.user_id === user.id);
      if (existingTag) {
        finalTag = existingTag;
      } else {
        const { data: newTagFromDb, error: tagError } = await supabase.from('tags').insert({ name: tagOrNewName, user_id: user.id }).select().single();
        if (tagError || !newTagFromDb) { toast({ title: "Erreur création Tag", description: tagError?.message, variant: "destructive" }); return; }
        finalTag = newTagFromDb;
        setAvailableTags(prev => [...prev, finalTag!].sort((a,b) => a.name.localeCompare(b.name)));
      }
    } else {
      finalTag = tagOrNewName;
    }
    if (finalTag && !manualTaskTags.find(mt => mt.id === finalTag!.id)) { setManualTaskTags(prev => [...prev, finalTag!]); }
  };

  const handleRemoveTagFromManualTask = (tagId: string) => { setManualTaskTags(prev => prev.filter(t => t.id !== tagId)); };
  
  const handleAiModifyTasks = async () => {
    if (!user || instructions.trim() === '') return; setIsAiLoading(true); setError(null); setAiReasoning(null);
    const currentTaskListStrings = tasks.map(t => `${t.text} (Type: ${t.type}, Complété: ${t.completed}, Chapitre: ${t.chapters?.name || 'Aucun'}, Tags: ${t.tags?.map(tag => tag.name).join(', ') || 'Aucun'})`);
    const input: ModifyTaskListInput = { instructions, taskList: currentTaskListStrings };
    try {
      const result: ModifyTaskListOutput = await modifyTaskList(input); setAiReasoning(result.reasoning);
      toast({ title: "Instructions IA traitées", description: "Actualisation des données...", duration: 3000 });
      await fetchInitialData(); 
    } catch (e: any) { const errorMessage = (e as Error).message; setError(errorMessage); toast({ title: "Erreur IA", description: errorMessage, variant: "destructive" });
    } finally { setIsAiLoading(false); setInstructions(''); }
  };
  
  if (!user && isFetchingInitialData) {
     return (<div className="p-4 md:p-6 h-full flex flex-col items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary mb-3" /><p className="text-muted-foreground">Chargement...</p></div>);
  }

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex items-center gap-3">
        <ListTodo className="h-7 w-7 text-primary" />
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Gestionnaire de Tâches</h1>
      </div>

      <div className="flex flex-col lg:flex-row flex-grow gap-6 overflow-hidden">
        <div className="lg:w-[380px] lg:max-w-sm xl:w-[420px] shrink-0 space-y-6 lg:overflow-y-auto custom-scrollbar lg:pr-2 pb-4 lg:pb-0">
          <Card className="shadow-md">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Bot className="h-5 w-5 text-primary" /> Gérer avec l'IA</CardTitle><CardDescription className="text-sm">L'IA peut réorganiser, ajouter ou modifier votre liste.</CardDescription></CardHeader>
            <CardContent><Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Ex : Ajoute 'Relire chapitre X' comme urgent..." rows={3} className="mb-3 text-sm" disabled={isAiLoading || isFetchingInitialData || !user} /></CardContent>
            <CardFooter><Button onClick={handleAiModifyTasks} disabled={isAiLoading || !instructions.trim() || isFetchingInitialData || !user} className="w-full">{isAiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />} {isAiLoading ? 'Traitement IA...' : 'Soumettre à l\'IA'}</Button></CardFooter>
            {aiReasoning && (<CardFooter className="pt-3 text-xs text-muted-foreground italic border-t flex items-start gap-1.5"><Info className="h-4 w-4 mt-0.5 shrink-0"/> <span>Raisonnement IA : {aiReasoning}</span></CardFooter>)}
          </Card>

          <Card className="shadow-md" id="manual-task-card">
            <CardHeader><CardTitle className="text-lg">{editingTask ? 'Modifier la Tâche' : 'Ajouter une Tâche Manuellement'}</CardTitle></CardHeader>
            <CardContent className="space-y-4 py-4" id="manual-task-card-content">
              <div><Label htmlFor="manualTaskText" className="mb-1.5 block text-sm">Description</Label><Input id="manualTaskText" value={manualTaskText} onChange={(e) => setManualTaskText(e.target.value)} placeholder="Description de la nouvelle tâche..." className="text-sm h-10" disabled={isManualTaskLoading || !user} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label htmlFor="manualTaskTypeSelect" className="mb-1.5 block text-sm">Type</Label><TaskTypeSelector selectedType={manualTaskType} onSelectType={setManualTaskType} disabled={isManualTaskLoading || !user} size="sm" /></div>
                <div>
                  <Label htmlFor="manualTaskChapterSelect" className="mb-1.5 block text-sm">Chapitre (Optionnel)</Label>
                  <Select value={manualTaskChapterId || "none"} onValueChange={(value) => setManualTaskChapterId(value === "none" ? undefined : value)} disabled={isManualTaskLoading || chapters.length === 0 || !user}>
                    <SelectTrigger id="manualTaskChapterSelect" className="text-sm h-9"><SelectValue placeholder={chapters.length === 0 ? "Aucun chapitre" : "Lier à un chapitre..."} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun chapitre</SelectItem>
                      {chapters.map(chap => <SelectItem key={chap.id} value={chap.id}>{chap.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Tags (Optionnel)</Label>
                <TagManager
                  availableTags={availableTags}
                  selectedTags={manualTaskTags}
                  onTagAdd={handleAddTagToManualTask}
                  onTagRemove={handleRemoveTagFromManualTask}
                  disabled={isManualTaskLoading || !user}
                  isLoading={isFetchingInitialData}
                  triggerLabel="Gérer les tags de la tâche"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleAddOrUpdateManualTask} className="flex-1 h-10" disabled={isManualTaskLoading || !manualTaskText.trim() || !user}>{isManualTaskLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingTask ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)} {isManualTaskLoading ? (editingTask ? 'Mise à jour...' : 'Ajout...') : (editingTask ? 'Enregistrer' : 'Ajouter')}</Button>
                {editingTask && (<Button variant="outline" onClick={() => { setEditingTask(null); setManualTaskText(''); setManualTaskType('secondary'); setManualTaskChapterId(undefined); setManualTaskTags([]); }} disabled={isManualTaskLoading} className="h-10">Annuler</Button>)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <Card className="flex-grow flex flex-col shadow-md overflow-hidden">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-y-2 gap-x-4">
              <div>
                <CardTitle className="text-lg">Vos Tâches</CardTitle>
                <CardDescription className="text-sm mt-1">
                  {isFetchingInitialData ? "Chargement..." : `${filteredAndSortedTasks.length} tâche(s) ${filterStatus !== 'all' || filterType !== 'all' ? 'correspondant aux filtres.' : `au total (${tasks.filter(t => !t.completed).length} en attente).`}`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as FilterStatus)} disabled={!user || isFetchingInitialData}>
                    <SelectTrigger className="text-xs h-8 w-auto sm:w-[140px]" aria-label="Filtrer par statut"><SelectValue /></SelectTrigger>
                    <SelectContent>{statusOptions.map(opt => <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterType} onValueChange={(value) => setFilterType(value as FilterType)} disabled={!user || isFetchingInitialData}>
                    <SelectTrigger className="text-xs h-8 w-auto sm:w-[140px]" aria-label="Filtrer par type"><SelectValue /></SelectTrigger>
                    <SelectContent>{typeFilterOptions.map(opt => <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)} disabled={!user || isFetchingInitialData}>
                    <SelectTrigger className="text-xs h-8 w-auto sm:w-[160px]" aria-label="Trier par"><SelectValue /></SelectTrigger>
                    <SelectContent>{sortOptions.map(opt => <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="flex-grow overflow-y-auto space-y-3 p-4 custom-scrollbar">
              {!user && !isFetchingInitialData ? (
                <div className="flex-grow flex flex-col justify-center items-center py-10 text-muted-foreground border border-dashed rounded-md min-h-[200px]">
                  <ListChecks className="mx-auto h-12 w-12 opacity-30 mb-3" />
                  <p className="font-medium">Connectez-vous pour gérer vos tâches.</p>
                </div>
              ) : isFetchingInitialData ? (
                <div className="flex-grow flex flex-col justify-center items-center py-10 text-muted-foreground">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                  <p>Chargement des tâches...</p>
                </div>
              ) : error ? (
                <div className="flex-grow flex flex-col justify-center items-center py-10 text-destructive border border-destructive/50 bg-destructive/10 rounded-md p-4">
                  <AlertTriangle className="h-10 w-10 mb-4" /><p className="font-semibold">Erreur de chargement</p>
                  <p className="text-sm text-center mt-1">{error}</p>
                  <Button onClick={fetchInitialData} variant="destructive" className="mt-4">Réessayer</Button>
                </div>
              ) : filteredAndSortedTasks.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center text-center p-6 text-muted-foreground border-dashed border rounded-md min-h-[200px]">
                  <ListChecks className="mx-auto h-16 w-16 opacity-30 mb-4" />
                  <p className="font-medium text-lg mb-1">{tasks.length === 0 ? "Aucune tâche pour le moment." : "Aucune tâche ne correspond à vos filtres."}</p>
                  <p className="text-sm mb-4">{tasks.length === 0 ? "Utilisez les formulaires pour ajouter des tâches." : "Essayez d'ajuster vos filtres."}</p>
                  {tasks.length === 0 && (<Button onClick={() => { const el = document.getElementById('manual-task-card-content'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); const inputField = el.querySelector('input#manualTaskText'); if (inputField) (inputField as HTMLInputElement).focus(); } }} disabled={!user}><PlusCircle className="mr-2 h-4 w-4" /> Ajouter une tâche</Button>)}
                </div>
              ) : (
                filteredAndSortedTasks.map((task) => (
                  <TaskItemCard key={task.id} task={task} onToggle={handleToggleTask} onSetType={handleSetTaskType} onEdit={handleEditTask} onDelete={handleDeleteTask} onStartPomodoro={handleStartPomodoroForTask} isCurrentItemLoading={isTaskItemLoading === task.id} />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

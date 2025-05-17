
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import type { DailyObjective, Chapter, Tag } from '@/types'; // Import Chapter, Tag
import { PlusCircle, Trash2, Edit3, Loader2, Target, Save, CalendarDays, ChevronLeft, ChevronRight, AlertTriangle, Info, History, CheckCircle2, Link as LinkIcon, Tags as TagsIcon } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
// Simule un composant TagManager simple
const SimpleObjectiveTagManager: FC<{
  availableTags: Tag[]; selectedTags: Tag[];
  onTagAdd: (tagNameOrTag: string | Tag) => Promise<void>;
  onTagRemove: (tagId: string) => void;
  disabled?: boolean;
}> = ({ availableTags, selectedTags, onTagAdd, onTagRemove, disabled }) => { /* ... (Logique similaire à AiTaskManagerPage) ... */ 
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
   useEffect(() => {
    if (inputValue.trim() === '') { setSuggestions([]); return; }
    setSuggestions( availableTags.filter( (tag) => tag.name.toLowerCase().includes(inputValue.toLowerCase()) && !selectedTags.find((st) => st.id === tag.id) ).slice(0, 5) );
  }, [inputValue, availableTags, selectedTags]);
  const handleAdd = (tagOrName: Tag | string) => { onTagAdd(tagOrName); setInputValue(''); };
  return (
    <div className="space-y-2 mt-2">
      <div className="flex flex-wrap gap-1">
        {selectedTags.map((tag) => (
          <Badge key={tag.id} variant="secondary" style={tag.color ? { backgroundColor: tag.color, color: 'white' } : {}}>
            {tag.name}
            <XIcon className="ml-1.5 h-3 w-3 cursor-pointer" onClick={() => onTagRemove(tag.id)} />
          </Badge>
        ))}
      </div>
       <Popover>
        <PopoverTrigger asChild>
          <Input value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Ajouter/créer tag..." className="text-sm h-9" disabled={disabled} />
        </PopoverTrigger>
        {(suggestions.length > 0 || (inputValue && !availableTags.find(t => t.name.toLowerCase() === inputValue.toLowerCase()))) && (
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
            <Command>
              <CommandList>
                <CommandEmpty>{inputValue ? `Créer "${inputValue}"?` : "Aucun tag."}</CommandEmpty>
                {suggestions.map((tag) => ( <CommandItem key={tag.id} value={tag.name} onSelect={() => handleAdd(tag)}>{tag.name}</CommandItem> ))}
                {inputValue && !availableTags.find(t => t.name.toLowerCase() === inputValue.toLowerCase()) && (
                  <CommandItem onSelect={() => handleAdd(inputValue)}><PlusCircle className="mr-2 h-4 w-4" /> Créer "{inputValue}"</CommandItem>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
};


interface DailyObjectiveItemProps { /* ... (comme avant, avec affichage chapitre et tags) ... */ 
  objective: DailyObjective;
  onToggle: (id: string, completed: boolean, objective_date: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (objective: DailyObjective) => void;
  isLoading: boolean;
  isPastObjective?: boolean;
}

const DailyObjectiveItem: FC<DailyObjectiveItemProps> = ({ objective, onToggle, onDelete, onEdit, isLoading, isPastObjective = false }) => {
  return (
    <div className={cn( "flex items-start sm:items-center justify-between p-3.5 rounded-lg border transition-colors duration-150 group", objective.completed ? "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/50" : "bg-card hover:bg-muted/30 dark:hover:bg-muted/20", isPastObjective && !objective.completed && "bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40" )}>
      <div className="flex items-start sm:items-center gap-3 flex-grow min-w-0">
        <Checkbox id={`obj-${objective.id}`} checked={objective.completed} onCheckedChange={(checked) => onToggle(objective.id, !!checked, objective.objective_date)} aria-label={objective.completed ? 'Non terminé' : 'Terminé'} disabled={isLoading} className={cn( "mt-1 sm:mt-0 h-5 w-5 shrink-0", objective.completed ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-700" : (isPastObjective ? "border-amber-500 data-[state=checked]:bg-amber-600" : "border-primary") )}/>
        <div className="flex-grow space-y-1">
            <label htmlFor={`obj-${objective.id}`} className={cn( "text-sm font-medium leading-normal cursor-pointer break-words w-full", objective.completed && "line-through text-muted-foreground" )}>{objective.text}</label>
            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
              {isPastObjective && (<span>Date: {format(parseISO(objective.objective_date), "d MMM yy", { locale: fr })}</span>)}
              {objective.chapters && ( <span className="flex items-center gap-1"><LinkIcon className="h-3 w-3" /> {objective.chapters.name}</span> )}
            </div>
            {objective.tags && objective.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {objective.tags.slice(0,3).map(tag => <Badge key={tag.id} variant="outline" className="text-xs py-0" style={tag.color ? {borderColor: tag.color, color: tag.color} : {}}>{tag.name}</Badge>)}
                {objective.tags.length > 3 && <Badge variant="outline" className="text-xs py-0">+{objective.tags.length - 3}</Badge>}
              </div>
            )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        {!isPastObjective && ( <Button variant="ghost" size="icon" onClick={() => onEdit(objective)} aria-label="Modifier" disabled={isLoading} className="h-8 w-8 opacity-50 group-hover:opacity-100 text-muted-foreground hover:text-primary"><Edit3 className="h-4 w-4" /></Button> )}
        <Button variant="ghost" size="icon" onClick={() => onDelete(objective.id)} aria-label="Supprimer" className="text-destructive/70 hover:text-destructive h-8 w-8 opacity-50 group-hover:opacity-100" disabled={isLoading}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
  );
};

export function DailyPlanSection() {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [objectives, setObjectives] = useState<DailyObjective[]>([]);
  const [overdueObjectives, setOverdueObjectives] = useState<DailyObjective[]>([]);
  const [chapters, setChapters] = useState<Pick<Chapter, 'id' | 'name'>[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newObjectiveText, setNewObjectiveText] = useState('');
  const [editingObjective, setEditingObjective] = useState<DailyObjective | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | undefined>(undefined);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isItemLoading, setIsItemLoading] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const formatDateForSupabase = (date: Date): string => format(date, 'yyyy-MM-dd');

  const fetchPageData = useCallback(async (dateToFetch: Date) => {
    setIsFetching(true); setError(null);
    try {
      const dateString = formatDateForSupabase(dateToFetch);
      const objectivesQuery = supabase.from('daily_objectives').select('*, chapters(id, name), daily_objective_tags(tags(id, name, color))').eq('objective_date', dateString).order('created_at', { ascending: true });
      const chaptersQuery = supabase.from('chapters').select('id, name').order('name');
      const tagsQuery = supabase.from('tags').select('*').order('name');
      
      let overdueQuery = null;
      if (isToday(dateToFetch)) {
        const sevenDaysAgo = formatDateForSupabase(subDays(new Date(), 7));
        const yesterday = formatDateForSupabase(subDays(new Date(), 1));
        overdueQuery = supabase.from('daily_objectives').select('*, chapters(id, name), daily_objective_tags(tags(id, name, color))').eq('completed', false).gte('objective_date', sevenDaysAgo).lte('objective_date', yesterday).order('objective_date', { ascending: true });
      }

      const [objRes, chapRes, tagsRes, overdueRes] = await Promise.all([objectivesQuery, chaptersQuery, tagsQuery, overdueQuery]);

      if (objRes.error) throw new Error(`Objectifs: ${objRes.error.message}`);
      if (chapRes.error) throw new Error(`Chapitres: ${chapRes.error.message}`);
      if (tagsRes.error) throw new Error(`Tags: ${tagsRes.error.message}`);
      if (overdueRes && overdueRes.error) throw new Error(`Objectifs en retard: ${overdueRes.error.message}`);

      setObjectives((objRes.data || []).map(o => ({...o, tags: o.daily_objective_tags?.map((dot:any) => dot.tags) || [], chapters: o.chapters as {id:string, name:string}|null })));
      setChapters(chapRes.data || []);
      setAvailableTags(tagsRes.data || []);
      if (isToday(dateToFetch)) {
        setOverdueObjectives((overdueRes?.data || []).map(o => ({...o, tags: o.daily_objective_tags?.map((dot:any) => dot.tags) || [], chapters: o.chapters as {id:string, name:string}|null })));
      } else {
        setOverdueObjectives([]);
      }
    } catch (e: any) { /* ... gestion erreur ... */ } 
    finally { setIsFetching(false); }
  }, [toast]);

  useEffect(() => { fetchPageData(selectedDate); }, [selectedDate, fetchPageData]);

  useEffect(() => {
    const channel = supabase.channel('daily-plan-updates-integrated')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_objectives' }, () => fetchPageData(selectedDate))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_objective_tags' }, () => fetchPageData(selectedDate))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' }, () => fetchPageData(selectedDate))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chapters' }, () => fetchPageData(selectedDate))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedDate, fetchPageData]);

  const saveObjectiveTags = async (objectiveId: string, tagsToSave: Tag[]) => {
    await supabase.from('daily_objective_tags').delete().eq('daily_objective_id', objectiveId);
    if (tagsToSave.length > 0) {
      const newLinks = tagsToSave.map(tag => ({ daily_objective_id: objectiveId, tag_id: tag.id }));
      await supabase.from('daily_objective_tags').insert(newLinks);
    }
  };

  const handleAddOrUpdateObjective = async () => { /* ... (logique existante + chapter_id et tags) ... */ 
    if (newObjectiveText.trim() === '') { toast({title:"Validation", description:"Texte requis"}); return; }
    setIsFormLoading(true);
    try {
      const objectivePayload = { text: newObjectiveText.trim(), objective_date: formatDateForSupabase(selectedDate), completed: editingObjective ? editingObjective.completed : false, completed_at: editingObjective?.completed ? (editingObjective.completed_at || new Date().toISOString()) : null, chapter_id: selectedChapterId || null };
      let savedObjective: DailyObjective | null = null;

      if (editingObjective) {
        const { data, error } = await supabase.from('daily_objectives').update(objectivePayload).eq('id', editingObjective.id).select().single();
        if (error) throw error;
        savedObjective = data;
      } else {
        const { data, error } = await supabase.from('daily_objectives').insert(objectivePayload).select().single();
        if (error) throw error;
        savedObjective = data;
      }

      if (savedObjective) {
        await saveObjectiveTags(savedObjective.id, selectedTags);
        const { data: fetchedObjective, error: fetchErr } = await supabase.from('daily_objectives').select('*, chapters(id,name), daily_objective_tags(tags(id,name,color))').eq('id', savedObjective.id).single();
        if (fetchErr || !fetchedObjective) throw fetchErr || new Error("Récupération échouée après sauvegarde.");
        
        const processedObjective = {...fetchedObjective, tags: fetchedObjective.daily_objective_tags?.map((dot:any) => dot.tags) || [], chapters: fetchedObjective.chapters as {id:string, name:string}|null };

        if (editingObjective) {
          setObjectives(prev => prev.map(obj => obj.id === processedObjective.id ? processedObjective : obj));
        } else {
          setObjectives(prev => [...prev, processedObjective]);
        }
        toast({ title: editingObjective ? "Objectif mis à jour" : "Objectif ajouté" });
      }
      setNewObjectiveText(''); setEditingObjective(null); setSelectedChapterId(undefined); setSelectedTags([]); setIsModalOpen(false);
    } catch (e: any) { toast({title:"Erreur", description: (e as Error).message, variant: "destructive"}); } 
    finally { setIsFormLoading(false); }
  };
  
  const handleToggleObjective = async (id: string, completed: boolean, objectiveDate: string) => { /* ... (logique existante + mise à jour manuelle de l'état) ... */ 
    setIsItemLoading(id);
    try {
      const updatePayload = { completed, completed_at: completed ? new Date().toISOString() : null };
      const { data: updatedObj, error } = await supabase.from('daily_objectives').update(updatePayload).eq('id', id).select().single();
      if (error) throw error;

      const updateState = (prevState: DailyObjective[]) => prevState.map(obj => obj.id === id ? { ...obj, ...updatedObj } : obj);
      
      if (objectiveDate === formatDateForSupabase(selectedDate)) {
        setObjectives(updateState);
      }
      if (isPast(parseISO(objectiveDate))) { // Gérer les objectifs en retard
         setOverdueObjectives(prevOverdue => completed ? prevOverdue.filter(obj => obj.id !== id) : updateState(prevOverdue));
      }
    } catch (e: any) { toast({title:"Erreur", description: (e as Error).message, variant:"destructive"}); } 
    finally { setIsItemLoading(null); }
  };

  const handleDeleteObjective = async (id: string) => { /* ... (logique existante + mise à jour manuelle de l'état) ... */ 
    setIsItemLoading(id);
    try {
      await supabase.from('daily_objective_tags').delete().eq('daily_objective_id', id);
      const { error } = await supabase.from('daily_objectives').delete().eq('id', id);
      if (error) throw error;
      setObjectives(prev => prev.filter(obj => obj.id !== id));
      setOverdueObjectives(prev => prev.filter(obj => obj.id !== id)); // Aussi pour les retards
      if (editingObjective && editingObjective.id === id) { /* ... reset form ... */ }
      toast({ title: "Objectif supprimé" });
    } catch (e: any) { toast({title:"Erreur", description: (e as Error).message, variant:"destructive"});} 
    finally { setIsItemLoading(null); }
  };

  const openEditModal = (objective: DailyObjective) => { setEditingObjective(objective); setNewObjectiveText(objective.text); setSelectedChapterId(objective.chapter_id || undefined); setSelectedTags(objective.tags || []); setIsModalOpen(true); };
  const openNewModal = () => { setEditingObjective(null); setNewObjectiveText(''); setSelectedChapterId(undefined); setSelectedTags([]); setIsModalOpen(true); };
  const navigateDate = (offset: number) => setSelectedDate(prevDate => startOfDay(addDays(prevDate, offset)));

  const handleAddTagToManualObjective = async (tagNameOrTag: string | Tag) => { /* ... (similaire à AiTaskManagerPage) ... */ 
    let finalTag: Tag | undefined = typeof tagNameOrTag === 'string' ? availableTags.find(t => t.name.toLowerCase() === tagNameOrTag.toLowerCase()) : tagNameOrTag;
    if (typeof tagNameOrTag === 'string' && !finalTag) {
      const { data: newTagFromDb, error: tagError } = await supabase.from('tags').insert({ name: tagNameOrTag }).select().single();
      if (tagError || !newTagFromDb) { toast({ title: "Erreur Tag", description: tagError?.message, variant: "destructive" }); return; }
      finalTag = newTagFromDb; setAvailableTags(prev => [...prev, newTagFromDb].sort((a,b)=>a.name.localeCompare(b.name)));
    }
    if (finalTag && !selectedTags.find(mt => mt.id === finalTag!.id)) { setSelectedTags(prev => [...prev, finalTag!]); }
  };
  const handleRemoveTagFromManualObjective = (tagId: string) => setSelectedTags(prev => prev.filter(t => t.id !== tagId));

  const completedCount = objectives.filter(obj => obj.completed).length;
  const totalForSelectedDate = objectives.length;
  const completionPercentage = totalForSelectedDate > 0 ? Math.round((completedCount / totalForSelectedDate) * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      {/* ... (Barre de titre et navigation de date comme avant) ... */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3"><Target className="h-7 w-7 text-primary" /><h1 className="text-xl md:text-2xl font-semibold tracking-tight">Plan du Jour {isToday(selectedDate) ? "" : `(${format(selectedDate, "d MMM yyyy", { locale: fr })})`}</h1></div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Popover><PopoverTrigger asChild><Button variant="outline" className="w-[180px] justify-start text-left font-normal"><CalendarDays className="mr-2 h-4 w-4" />{format(selectedDate, "PPP", { locale: fr })}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(startOfDay(date))} initialFocus locale={fr} /></PopoverContent></Popover>
          <Button variant="outline" size="icon" onClick={() => navigateDate(1)} disabled={isToday(selectedDate)}><ChevronRight className="h-4 w-4" /></Button>
          <Button onClick={openNewModal} disabled={isFetching || isFormLoading}><PlusCircle className="mr-2 h-4 w-4" /> Objectif</Button>
        </div>
      </div>
      
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4"><CardTitle className="text-base md:text-lg">Progression ({format(selectedDate, "d MMMM", { locale: fr })})</CardTitle></CardHeader>
        <CardContent className="py-3"><Progress value={completionPercentage} className="w-full h-3 mb-1" /><p className="text-xs text-muted-foreground text-center">{completedCount}/{totalForSelectedDate} complété(s) ({completionPercentage}%)</p></CardContent>
      </Card>

      {isToday(selectedDate) && overdueObjectives.length > 0 && (
        <Accordion type="single" collapsible className="w-full" defaultValue="overdue">
          <AccordionItem value="overdue">
            <AccordionTrigger className="text-base md:text-lg font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 py-3"><div className="flex items-center gap-2"><History className="h-5 w-5" />Objectifs en Retard ({overdueObjectives.length})</div></AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-3">
              {overdueObjectives.map((obj) => <DailyObjectiveItem key={obj.id} objective={obj} onToggle={handleToggleObjective} onDelete={handleDeleteObjective} onEdit={openEditModal} isLoading={isItemLoading === obj.id} isPastObjective={true} />)}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {isFetching ? ( /* ... (état de chargement comme avant) ... */ <Card className="flex-grow flex flex-col items-center justify-center text-center p-6"><Loader2 className="h-10 w-10 animate-spin text-primary mb-4" /><p className="text-muted-foreground">Chargement...</p></Card>
      ) : error ? ( /* ... (état d'erreur comme avant) ... */ <Card className="flex-grow flex flex-col items-center justify-center text-center p-6 border-destructive bg-destructive/10"><AlertTriangle className="h-10 w-10 text-destructive mb-4" /><p className="font-semibold text-destructive">Erreur</p><p className="text-sm text-destructive/80 mt-1 mb-3 max-w-md mx-auto">{error}</p><Button onClick={() => fetchPageData(selectedDate)} variant="destructive" className="mt-4">Réessayer</Button></Card>
      ) : totalForSelectedDate === 0 && overdueObjectives.length === 0 ? ( /* ... (état vide amélioré) ... */ <Card className="flex-grow flex flex-col items-center justify-center text-center p-6 border-dashed"><Target className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4"/><CardTitle className="text-xl">Aucun objectif pour {isToday(selectedDate) ? "aujourd'hui" : `le ${format(selectedDate, "d MMM", {locale: fr})}`}</CardTitle><p className="text-muted-foreground my-2 max-w-md mx-auto">Définissez des priorités claires.</p><Button onClick={openNewModal} size="lg" className="mt-2"><PlusCircle className="mr-2 h-5 w-5" /> Définir un objectif</Button></Card>
      ) : (
        <div className="flex-grow space-y-3 overflow-y-auto custom-scrollbar pr-1 pb-4">
          {objectives.map((obj) => <DailyObjectiveItem key={obj.id} objective={obj} onToggle={handleToggleObjective} onDelete={handleDeleteObjective} onEdit={openEditModal} isLoading={isItemLoading === obj.id} isPastObjective={isPast(selectedDate) && !isToday(selectedDate)} />)}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={(open) => {if(!isFormLoading) setIsModalOpen(open)}}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="text-lg">{editingObjective ? "Modifier" : `Nouvel Objectif (${format(selectedDate, "d MMM", { locale: fr })})`}</DialogTitle></DialogHeader>
            <div className="py-4 space-y-3">
                 <div><Label htmlFor="objectiveTextModal" className="mb-1.5 block">Description</Label><Input id="objectiveTextModal" value={newObjectiveText} onChange={(e) => setNewObjectiveText(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddOrUpdateObjective()} disabled={isFormLoading} /></div>
                 <div>
                    <Label htmlFor="objectiveChapterSelect" className="mb-1.5 block">Chapitre (Optionnel)</Label>
                    <Select value={selectedChapterId || "none"} onValueChange={(value) => setSelectedChapterId(value === "none" ? undefined : value)} disabled={isFormLoading || chapters.length === 0}>
                        <SelectTrigger id="objectiveChapterSelect"><SelectValue placeholder="Lier à un chapitre..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Aucun chapitre</SelectItem>
                            {chapters.map(chap => <SelectItem key={chap.id} value={chap.id}>{chap.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                 </div>
                 <div>
                    <Label className="mb-1.5 block">Tags (Optionnel)</Label>
                    <SimpleObjectiveTagManager availableTags={availableTags} selectedTags={selectedTags} onTagAdd={handleAddTagToManualObjective} onTagRemove={handleRemoveTagFromManualObjective} disabled={isFormLoading}/>
                 </div>
                 {/* ... (message limite objectifs comme avant) ... */}
                 {objectives.filter(obj => !obj.completed && obj.objective_date === formatDateForSupabase(selectedDate)).length >= 5 && !editingObjective && isToday(selectedDate) && ( <p className="text-xs text-orange-600 flex items-center gap-1.5"><Info className="h-3.5 w-3.5"/>Limite de 5 objectifs actifs/jour.</p> )}
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline" disabled={isFormLoading}>Annuler</Button></DialogClose>
                <Button onClick={handleAddOrUpdateObjective} disabled={isFormLoading || !newObjectiveText.trim() || (objectives.filter(obj => !obj.completed && obj.objective_date === formatDateForSupabase(selectedDate)).length >= 5 && !editingObjective && isToday(selectedDate))}>{isFormLoading ? <Loader2 /> : (editingObjective ? <Save /> : <PlusCircle />)} {editingObjective ? 'Enregistrer' : 'Ajouter'}</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

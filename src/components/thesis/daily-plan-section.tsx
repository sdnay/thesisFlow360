
"use client";

import { useState, type FC, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DailyObjective, Chapter, Tag } from '@/types';
import { PlusCircle, Trash2, Edit3, Loader2, Target as TargetIcon, Save, CalendarDays, ChevronLeft, ChevronRight, AlertTriangle, Info, History } from 'lucide-react';
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
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';

// Import des composants extraits
import SimpleObjectiveTagManager from './daily-plan-components/SimpleObjectiveTagManager';
import DailyObjectiveItem from './daily-plan-components/DailyObjectiveItem';


export function DailyPlanSection() {
  const { user } = useAuth();
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

  // Memoized date checks for consistency within a render
  const isSelectedDateToday = useMemo(() => isToday(selectedDate), [selectedDate]);
  const isSelectedDatePast = useMemo(() => isPast(selectedDate), [selectedDate]);


  const fetchPageData = useCallback(async (dateToFetch: Date) => {
    if (!user) {
      setIsFetching(false);
      setObjectives([]);
      setOverdueObjectives([]);
      setChapters([]);
      setAvailableTags([]);
      setError(null);
      return;
    }
    setIsFetching(true); setError(null);
    try {
      const dateString = formatDateForSupabase(dateToFetch);
      const objectivesQuery = supabase.from('daily_objectives').select('*, chapters(id, name), daily_objective_tags(tags(*))').eq('user_id', user.id).eq('objective_date', dateString).order('created_at', { ascending: true });
      const chaptersQuery = supabase.from('chapters').select('id, name').eq('user_id', user.id).order('name');
      const tagsQuery = supabase.from('tags').select('*').eq('user_id', user.id).order('name');

      let overdueQueryBuilder = null;
      if (isToday(dateToFetch)) { // Use isToday directly here, not the memoized one if dateToFetch can be different from selectedDate
        const sevenDaysAgo = formatDateForSupabase(subDays(new Date(), 7));
        const yesterday = formatDateForSupabase(subDays(new Date(), 1));
        overdueQueryBuilder = supabase.from('daily_objectives').select('*, chapters(id, name), daily_objective_tags(tags(*))').eq('user_id', user.id).eq('completed', false).gte('objective_date', sevenDaysAgo).lte('objective_date', yesterday).order('objective_date', { ascending: true });
      }
      
      const [objRes, chapRes, tagsRes, overdueResOrNull] = await Promise.all([
        objectivesQuery,
        chaptersQuery,
        tagsQuery,
        overdueQueryBuilder 
      ]);

      if (objRes.error) throw new Error(`Objectifs: ${objRes.error.message}`);
      if (chapRes.error) throw new Error(`Chapitres: ${chapRes.error.message}`);
      if (tagsRes.error) throw new Error(`Tags: ${tagsRes.error.message}`);
      if (overdueResOrNull && overdueResOrNull.error) throw new Error(`Objectifs en retard: ${overdueResOrNull.error.message}`);

      setObjectives((objRes.data || []).map(o => ({...o, user_id: user.id, tags: o.daily_objective_tags?.map((dot:any) => dot.tags) || [], chapters: o.chapters as {id:string, name:string}|null })));
      setChapters(chapRes.data || []);
      setAvailableTags((tagsRes.data || []).map(t => ({...t, user_id: user.id})));
      
      if (isToday(dateToFetch) && overdueResOrNull) {
        setOverdueObjectives((overdueResOrNull.data || []).map(o => ({...o, user_id: user.id, tags: o.daily_objective_tags?.map((dot:any) => dot.tags) || [], chapters: o.chapters as {id:string, name:string}|null })));
      } else {
        setOverdueObjectives([]);
      }
    } catch (e: any) {
       setError((e as Error).message || "Erreur de chargement des données.");
       toast({ title: "Erreur de chargement", description: (e as Error).message, variant: "destructive" });
       console.error("Erreur fetchPageData (DailyPlanSection):", e);
    }
    finally { setIsFetching(false); }
  }, [toast, user]); // Removed isSelectedDateToday from deps as fetchPageData can be called with a different date

  useEffect(() => { 
    if (user) {
      fetchPageData(selectedDate); 
    } else {
      setIsFetching(false);
      setObjectives([]);
      setOverdueObjectives([]);
      setChapters([]);
      setAvailableTags([]);
      setError(null);
    }
  }, [selectedDate, user, fetchPageData]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`db-daily-plan-user-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_objectives', filter: `user_id=eq.${user.id}` }, (payload) => { console.log("Daily objectives change", payload); fetchPageData(selectedDate); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_objective_tags' }, (payload) => { console.log("Daily objective tags change", payload); fetchPageData(selectedDate); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags', filter: `user_id=eq.${user.id}` }, (payload) => { console.log("Tags change", payload); fetchPageData(selectedDate); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chapters', filter: `user_id=eq.${user.id}` }, (payload) => { console.log("Chapters change for daily plan", payload); fetchPageData(selectedDate); })
      .subscribe((status, err) => {
        if (err) console.error(`Realtime subscription error for daily_plan user ${user.id}:`, err);
      });
    return () => { supabase.removeChannel(channel); };
  }, [selectedDate, user, fetchPageData]);

  const saveObjectiveTags = async (objectiveId: string, tagsToSave: Tag[]) => {
    if(!user) return;
    await supabase.from('daily_objective_tags').delete().eq('daily_objective_id', objectiveId);
    if (tagsToSave.length > 0) {
      const newLinks = tagsToSave.map(tag => ({ daily_objective_id: objectiveId, tag_id: tag.id }));
      const { error } = await supabase.from('daily_objective_tags').insert(newLinks);
      if (error) throw new Error(`Erreur liaison tags objectif: ${error.message}`);
    }
  };

  const handleAddOrUpdateObjective = async () => {
    if (!user || newObjectiveText.trim() === '') { toast({title:"Validation", description:"Texte de l'objectif requis."}); return; }
    setIsFormLoading(true);
    try {
      const objectivePayload:any = { // Type any to avoid TS error on user_id for update
        user_id: user.id,
        text: newObjectiveText.trim(),
        objective_date: formatDateForSupabase(selectedDate),
        completed: editingObjective ? editingObjective.completed : false,
        completed_at: editingObjective?.completed ? (editingObjective.completed_at || new Date().toISOString()) : null,
        chapter_id: selectedChapterId || null
      };
      let savedObjectiveData: DailyObjective | null = null;

      if (editingObjective) {
        // Don't send user_id or objective_date on update if they are not meant to be changed
        const { user_id, objective_date, ...updatePayload } = objectivePayload; 
        const { data, error } = await supabase.from('daily_objectives').update(updatePayload).eq('id', editingObjective.id).eq('user_id', user.id).select('*, chapters(id,name), daily_objective_tags(tags(*))').single();
        if (error) throw error;
        savedObjectiveData = data ? { ...data, user_id: user.id, tags: data.daily_objective_tags?.map((dot:any) => dot.tags) || [], chapters: data.chapters as {id:string, name:string}|null } : null;
      } else {
        const { data, error } = await supabase.from('daily_objectives').insert(objectivePayload).select('*, chapters(id,name), daily_objective_tags(tags(*))').single();
        if (error) throw error;
        savedObjectiveData = data ? { ...data, user_id: user.id, tags: data.daily_objective_tags?.map((dot:any) => dot.tags) || [], chapters: data.chapters as {id:string, name:string}|null } : null;
      }

      if (savedObjectiveData) {
        await saveObjectiveTags(savedObjectiveData.id, selectedTags);
        const { data: fetchedObjectiveWithTags, error: fetchErr } = await supabase.from('daily_objectives').select('*, chapters(id,name), daily_objective_tags(tags(*))').eq('id', savedObjectiveData.id).eq('user_id', user.id).single();
        if (fetchErr || !fetchedObjectiveWithTags) throw fetchErr || new Error("Récupération de l'objectif avec tags échouée après sauvegarde.");
        const processedFinalObjective = {...fetchedObjectiveWithTags, user_id: user.id, tags: fetchedObjectiveWithTags.daily_objective_tags?.map((dot:any) => dot.tags) || [], chapters: fetchedObjectiveWithTags.chapters as {id:string, name:string}|null };

        if (formatDateForSupabase(selectedDate) === processedFinalObjective.objective_date) {
            if (editingObjective) {
              setObjectives(prev => prev.map(obj => obj.id === processedFinalObjective.id ? processedFinalObjective : obj).sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
            } else {
              setObjectives(prev => [...prev, processedFinalObjective].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
            }
        }
        if (overdueObjectives.find(o => o.id === processedFinalObjective.id) || (isPast(parseISO(processedFinalObjective.objective_date)) && !isToday(parseISO(processedFinalObjective.objective_date)) && !processedFinalObjective.completed)) {
            fetchOverdueObjectives();
        }
        toast({ title: editingObjective ? "Objectif mis à jour" : "Objectif ajouté" });
      }
      setNewObjectiveText(''); setEditingObjective(null); setSelectedChapterId(undefined); setSelectedTags([]); setIsModalOpen(false);
    } catch (e: any) { toast({title:"Erreur", description: (e as Error).message, variant: "destructive"}); console.error("Erreur handleAddOrUpdateObjective:", e); }
    finally { setIsFormLoading(false); }
  };
  
  const fetchOverdueObjectives = useCallback(async () => {
    if (!user || !isToday(selectedDate)) { 
      setOverdueObjectives([]);
      return;
    }
    const sevenDaysAgo = formatDateForSupabase(subDays(new Date(), 7));
    const yesterday = formatDateForSupabase(subDays(new Date(), 1));
    const { data, error } = await supabase.from('daily_objectives')
        .select('*, chapters(id, name), daily_objective_tags(tags(*))')
        .eq('user_id', user.id)
        .eq('completed', false)
        .gte('objective_date', sevenDaysAgo)
        .lte('objective_date', yesterday)
        .order('objective_date', { ascending: true });

    if (error) {
        console.error("Erreur fetchOverdueObjectives:", error);
        toast({ title: "Erreur", description: "Impossible de charger les objectifs en retard.", variant: "destructive" });
    } else {
        setOverdueObjectives((data || []).map(o => ({...o, user_id: user.id, tags: o.daily_objective_tags?.map((dot:any) => dot.tags) || [], chapters: o.chapters as {id:string, name:string}|null })));
    }
  }, [user, selectedDate, toast]);


  const handleToggleObjective = async (id: string, completed: boolean, objectiveDate: string) => {
    if (!user) return;
    setIsItemLoading(id);
    try {
      const updatePayload = { completed, completed_at: completed ? new Date().toISOString() : null };
      const { data: updatedObjFromDb, error } = await supabase.from('daily_objectives').update(updatePayload).eq('id', id).eq('user_id', user.id).select('*, chapters(id,name), daily_objective_tags(tags(*))').single();
      if (error) throw error;

      if (updatedObjFromDb) {
          const processedUpdatedObj: DailyObjective = { ...updatedObjFromDb, user_id: user.id, tags: updatedObjFromDb.daily_objective_tags?.map((dot: any) => dot.tags) || [], chapters: updatedObjFromDb.chapters as { id: string, name: string } | null };
          
          if (objectiveDate === formatDateForSupabase(selectedDate)) {
            setObjectives(prev => prev.map(obj => obj.id === id ? processedUpdatedObj : obj).sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
          }
          if (isPast(parseISO(objectiveDate)) && !isToday(parseISO(objectiveDate))) {
             if(completed) {
                setOverdueObjectives(prevOverdue => prevOverdue.filter(obj => obj.id !== id));
             } else {
                 setOverdueObjectives(prevOverdue => {
                    const existing = prevOverdue.find(o => o.id === id);
                    if(existing) return prevOverdue.map(o => o.id === id ? processedUpdatedObj : o).sort((a,b) => new Date(a.objective_date).getTime() - new Date(b.objective_date).getTime());
                    return [...prevOverdue, processedUpdatedObj].sort((a,b) => new Date(a.objective_date).getTime() - new Date(b.objective_date).getTime());
                 });
             }
          }
      }
    } catch (e: any) { toast({title:"Erreur", description: (e as Error).message, variant:"destructive"}); console.error("Erreur handleToggleObjective:", e); }
    finally { setIsItemLoading(null); }
  };

  const handleDeleteObjective = async (id: string) => {
    if (!user) return;
    setIsItemLoading(id);
    try {
      await supabase.from('daily_objective_tags').delete().eq('daily_objective_id', id);
      const { error } = await supabase.from('daily_objectives').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      setObjectives(prev => prev.filter(obj => obj.id !== id));
      setOverdueObjectives(prev => prev.filter(obj => obj.id !== id));
      if (editingObjective && editingObjective.id === id) { setNewObjectiveText(''); setEditingObjective(null); setSelectedChapterId(undefined); setSelectedTags([]); setIsModalOpen(false); }
      toast({ title: "Objectif supprimé" });
    } catch (e: any) { toast({title:"Erreur", description: (e as Error).message, variant:"destructive"}); console.error("Erreur handleDeleteObjective:", e); }
    finally { setIsItemLoading(null); }
  };

  const openEditModal = (objective: DailyObjective) => { setEditingObjective(objective); setNewObjectiveText(objective.text); setSelectedChapterId(objective.chapter_id || undefined); setSelectedTags(objective.tags || []); setIsModalOpen(true); };
  const openNewModal = () => { setEditingObjective(null); setNewObjectiveText(''); setSelectedChapterId(undefined); setSelectedTags([]); setIsModalOpen(true); };
  const navigateDate = (offset: number) => setSelectedDate(prevDate => startOfDay(addDays(prevDate, offset)));

  const handleAddTagToManualObjective = async (tagNameOrTag: string | Tag) => {
    if (!user) return;
    let finalTag: Tag | undefined = typeof tagNameOrTag === 'string' ? availableTags.find(t => t.name.toLowerCase() === tagNameOrTag.toLowerCase() && t.user_id === user.id) : tagNameOrTag;
    if (typeof tagNameOrTag === 'string' && !finalTag) {
      const { data: newTagFromDb, error: tagError } = await supabase.from('tags').insert({ name: tagNameOrTag, user_id: user.id }).select().single();
      if (tagError || !newTagFromDb) { toast({ title: "Erreur Tag", description: tagError?.message, variant: "destructive" }); return; }
      finalTag = { ...newTagFromDb, user_id: user.id };
      setAvailableTags(prev => [...prev, finalTag!].sort((a,b)=>a.name.localeCompare(b.name)));
    }
    if (finalTag && !selectedTags.find(mt => mt.id === finalTag!.id)) { setSelectedTags(prev => [...prev, finalTag!]); }
  };
  const handleRemoveTagFromManualObjective = (tagId: string) => setSelectedTags(prev => prev.filter(t => t.id !== tagId));

  const completedCount = objectives.filter(obj => obj.completed).length;
  const totalForSelectedDate = objectives.length;
  const completionPercentage = totalForSelectedDate > 0 ? Math.round((completedCount / totalForSelectedDate) * 100) : 0;
  
  if (!user && isFetching) {
     return (
        <div className="p-4 md:p-6 h-full flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-3" />
            <p className="text-muted-foreground">Chargement...</p>
        </div>
    );
  }
  
  const showAddButtonInHeader = !isSelectedDatePast;
  const showAddButtonInEmptyState = !isSelectedDatePast;


  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <TargetIcon className="h-7 w-7 text-primary" />
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
            Plan du Jour {isSelectedDateToday ? "" : `(${format(selectedDate, "d MMM yyyy", { locale: fr })})`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateDate(-1)} aria-label="Jour précédent" disabled={isFetching}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[180px] justify-start text-left font-normal text-sm h-9" disabled={isFetching}>
                <CalendarDays className="mr-2 h-4 w-4" />
                {format(selectedDate, "PPP", { locale: fr })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(startOfDay(date))} initialFocus locale={fr} />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={() => navigateDate(1)} disabled={isSelectedDateToday || isFetching} aria-label="Jour suivant">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {showAddButtonInHeader && 
            <Button onClick={openNewModal} disabled={isFetching || isFormLoading || !user} size="sm" className="h-9">
              <PlusCircle className="mr-2 h-4 w-4" /> Objectif
            </Button>}
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base md:text-lg">Progression ({format(selectedDate, "d MMMM", { locale: fr })})</CardTitle>
          <Badge variant={completionPercentage === 100 ? "default" : "secondary"} className={cn("text-sm", completionPercentage === 100 && "bg-green-500 text-white")}>
            {completedCount}/{totalForSelectedDate} complétés
          </Badge>
        </CardHeader>
        <CardContent className="py-3">
          <Progress value={completionPercentage} className="w-full h-2.5 mb-1" />
          <p className="text-xs text-muted-foreground text-center">{completionPercentage}%</p>
        </CardContent>
      </Card>

      {isSelectedDateToday && overdueObjectives.length > 0 && (
        <Accordion type="single" collapsible className="w-full" defaultValue="overdue">
          <AccordionItem value="overdue" className="border rounded-lg shadow-sm bg-amber-50/50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700">
            <AccordionTrigger className="text-sm md:text-base font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 py-3 px-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5" />Objectifs en Retard ({overdueObjectives.length})
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 pb-3 px-3 space-y-2.5">
              {overdueObjectives.map((obj) => <DailyObjectiveItem key={obj.id} objective={obj} onToggle={handleToggleObjective} onDelete={handleDeleteObjective} onEdit={openEditModal} isLoading={isItemLoading === obj.id} isPastObjective={true} />)}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
      
      <div className="flex-grow space-y-3 overflow-y-auto custom-scrollbar pr-1 pb-4 min-h-[200px]">
        {isFetching ? ( 
          <div className="flex-grow flex flex-col items-center justify-center text-center p-6">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Chargement des objectifs...</p>
          </div>
        ) : error ? ( 
          <div className="flex-grow flex flex-col items-center justify-center text-center p-6 border-destructive bg-destructive/10 rounded-md">
            <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
            <p className="font-semibold text-destructive">Erreur de chargement</p>
            <p className="text-sm text-destructive/80 mt-1 mb-3 max-w-md mx-auto">{error}</p>
            <Button onClick={() => fetchPageData(selectedDate)} variant="destructive" className="mt-4">Réessayer</Button>
          </div>
        ) : objectives.length === 0 ? ( 
          <div className="flex-grow flex flex-col items-center justify-center text-center p-6 text-muted-foreground border-dashed border rounded-md min-h-[200px]">
            <TargetIcon className="mx-auto h-16 w-16 opacity-30 mb-4"/>
            <p className="font-medium text-lg mb-1">Aucun objectif pour {isSelectedDateToday ? "aujourd'hui" : `le ${format(selectedDate, "d MMM", {locale: fr})}`}.</p>
            <p className="text-sm mb-4">Définissez vos priorités pour cette journée.</p>
            {showAddButtonInEmptyState && 
              <Button onClick={openNewModal} size="lg" className="mt-2" disabled={!user || isFormLoading || isFetching}>
                <PlusCircle className="mr-2 h-5 w-5" /> Définir {objectives.length === 0 && isSelectedDateToday ? 'le premier' : 'un'} objectif
              </Button>
            }
          </div>
        ) : (
          objectives.map((obj) => <DailyObjectiveItem key={obj.id} objective={obj} onToggle={handleToggleObjective} onDelete={handleDeleteObjective} onEdit={openEditModal} isLoading={isItemLoading === obj.id} isPastObjective={isSelectedDatePast && !isSelectedDateToday} />)
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => {if(!isFormLoading) setIsModalOpen(open)}}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="text-lg">{editingObjective ? "Modifier l'Objectif" : `Nouvel Objectif (${format(selectedDate, "d MMM", { locale: fr })})`}</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
                 <div>
                    <Label htmlFor="objectiveTextModal" className="mb-1.5 block text-sm">Description</Label>
                    <Input id="objectiveTextModal" value={newObjectiveText} onChange={(e) => setNewObjectiveText(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && !isFormLoading && handleAddOrUpdateObjective()} disabled={isFormLoading} className="text-sm" />
                 </div>
                 <div>
                    <Label htmlFor="objectiveChapterSelect" className="mb-1.5 block text-sm">Chapitre (Optionnel)</Label>
                    <Select value={selectedChapterId || "none"} onValueChange={(value) => setSelectedChapterId(value === "none" ? undefined : value)} disabled={isFormLoading || chapters.length === 0}>
                        <SelectTrigger id="objectiveChapterSelect" className="text-sm h-10"><SelectValue placeholder={chapters.length === 0 ? "Aucun chapitre défini" : "Lier à un chapitre..."} /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Aucun chapitre</SelectItem>
                            {chapters.map(chap => <SelectItem key={chap.id} value={chap.id}>{chap.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                 </div>
                 <div>
                    <Label className="mb-1.5 block text-sm">Tags (Optionnel)</Label>
                    <SimpleObjectiveTagManager 
                      availableTags={availableTags.filter(t => t.user_id === user?.id)} 
                      selectedTags={selectedTags} 
                      onTagAdd={handleAddTagToManualObjective} 
                      onTagRemove={handleRemoveTagFromManualObjective} 
                      disabled={isFormLoading}
                    />
                 </div>
                 {objectives.filter(obj => !obj.completed && obj.objective_date === formatDateForSupabase(selectedDate)).length >= 5 && !editingObjective && isSelectedDateToday && ( 
                   <p className="text-xs text-orange-600 flex items-center gap-1.5 pt-1">
                     <Info className="h-3.5 w-3.5 shrink-0"/>Vous avez déjà 5 objectifs actifs pour aujourd'hui.
                   </p> 
                 )}
            </div>
            <DialogFooter className="mt-2">
                <DialogClose asChild><Button variant="outline" disabled={isFormLoading}>Annuler</Button></DialogClose>
                <Button 
                  onClick={handleAddOrUpdateObjective} 
                  disabled={
                    isFormLoading || 
                    !newObjectiveText.trim() || 
                    (objectives.filter(obj => !obj.completed && obj.objective_date === formatDateForSupabase(selectedDate)).length >= 5 && !editingObjective && isSelectedDateToday)
                  }
                >
                  {isFormLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (editingObjective ? <Save className="h-4 w-4 mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />)} 
                  {editingObjective ? 'Enregistrer' : 'Ajouter'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DailyObjective, Chapter, Tag, DailyPlan } from '@/types';
import { PlusCircle, Loader2, Target as TargetIcon, Save, CalendarDays, ChevronLeft, ChevronRight, AlertTriangle, Info, History, Edit } from 'lucide-react';
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
// import TagManager from '@/components/ui/tag-manager'; // Original import
import DailyObjectiveItem from './daily-plan-components/DailyObjectiveItem';
import CreateDailyPlanForm from './daily-plan-components/CreateDailyPlanForm';
import { Badge } from '@/components/ui/badge'; // Ensure Badge is imported
import dynamic from 'next/dynamic'; // Import dynamic

const TagManager = dynamic(() => import('@/components/ui/tag-manager'), { ssr: false });


export function DailyPlanSection() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [objectives, setObjectives] = useState<DailyObjective[]>([]);
  const [overdueObjectives, setOverdueObjectives] = useState<DailyObjective[]>([]);
  const [chapters, setChapters] = useState<Pick<Chapter, 'id' | 'name'>[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [dailyPlanForSelectedDate, setDailyPlanForSelectedDate] = useState<DailyPlan | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  const [newObjectiveText, setNewObjectiveText] = useState('');
  const [editingObjective, setEditingObjective] = useState<DailyObjective | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | undefined>(undefined);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);

  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isItemLoading, setIsItemLoading] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const formatDateForSupabase = (date: Date): string => format(date, 'yyyy-MM-dd');

  const isSelectedDateToday = useMemo(() => isToday(selectedDate), [selectedDate]);
  const isSelectedDatePast = useMemo(() => isPast(selectedDate) && !isToday(selectedDate), [selectedDate]);


  const fetchPageData = useCallback(async (dateToFetch: Date) => {
    if (!user) {
      setIsFetching(false); setObjectives([]); setOverdueObjectives([]); setChapters([]);
      setAvailableTags([]); setDailyPlanForSelectedDate(null); setError(null); return;
    }
    setIsFetching(true); setError(null);
    try {
      const dateString = formatDateForSupabase(dateToFetch);
      const [objRes, chapRes, tagsRes, dailyPlanRes, overdueResOrNull] = await Promise.all([
        supabase.from('daily_objectives').select('*, chapters(id, name), daily_objective_tags(tags(id, name, color)), daily_plans(id, title)').eq('user_id', user.id).eq('objective_date', dateString).order('created_at', { ascending: true }),
        supabase.from('chapters').select('id, name').eq('user_id', user.id).order('name'),
        supabase.from('tags').select('*').eq('user_id', user.id).order('name'),
        supabase.from('daily_plans').select('*').eq('user_id', user.id).eq('plan_date', dateString).maybeSingle(),
        isToday(dateToFetch) ? supabase.from('daily_objectives').select('*, chapters(id, name), daily_objective_tags(tags(id, name, color)), daily_plans(id, title)').eq('user_id', user.id).eq('completed', false).gte('objective_date', formatDateForSupabase(subDays(new Date(), 7))).lt('objective_date', formatDateForSupabase(startOfDay(new Date()))).order('objective_date', { ascending: true }) : Promise.resolve({ data: [], error: null })
      ]);

      if (objRes.error) throw new Error(`Objectifs: ${objRes.error.message}`);
      if (chapRes.error) throw new Error(`Chapitres: ${chapRes.error.message}`);
      if (tagsRes.error) throw new Error(`Tags: ${tagsRes.error.message}`);
      if (dailyPlanRes.error) throw new Error(`Plan du jour: ${dailyPlanRes.error.message}`);
      if (overdueResOrNull && overdueResOrNull.error) throw new Error(`Objectifs en retard: ${overdueResOrNull.error.message}`);

      setObjectives((objRes.data || []).map(o => ({...o, tags: o.daily_objective_tags?.map((dot:any) => dot.tags as Tag) || [], chapters: o.chapters as {id: string, name: string} | null, daily_plans: o.daily_plans as {id: string, title: string | null} | null })));
      setChapters(chapRes.data || []);
      setAvailableTags(tagsRes.data || []);
      setDailyPlanForSelectedDate(dailyPlanRes.data as DailyPlan | null);
      setOverdueObjectives((overdueResOrNull?.data || []).map(o => ({...o, tags: o.daily_objective_tags?.map((dot:any) => dot.tags as Tag) || [], chapters: o.chapters as {id: string, name: string} | null, daily_plans: o.daily_plans as {id: string, title: string | null} | null })));

    } catch (e: any) {
       setError((e as Error).message); toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    } finally { setIsFetching(false); }
  }, [toast, user]);

  useEffect(() => { fetchPageData(selectedDate); }, [selectedDate, user, fetchPageData]);

  useEffect(() => {
    if (!user) return;
    const dailyObjectiveChannel = supabase
      .channel(`db-daily-plan-objectives-user-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_objectives', filter: `user_id=eq.${user.id}` }, (payload) => {
        console.log('Realtime: daily_objectives change', payload);
        fetchPageData(selectedDate);
      })
      .subscribe();
    const tagsChannel = supabase
      .channel(`db-daily-plan-tags-user-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags', filter: `user_id=eq.${user.id}` }, (payload) => {
        console.log('Realtime: tags change', payload);
        fetchPageData(selectedDate);
      })
      .subscribe();
     const dailyPlansChannel = supabase
      .channel(`db-daily-plan-plans-user-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_plans', filter: `user_id=eq.${user.id}` }, (payload) => {
        console.log('Realtime: daily_plans change', payload);
        fetchPageData(selectedDate);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(dailyObjectiveChannel);
      supabase.removeChannel(tagsChannel);
      supabase.removeChannel(dailyPlansChannel);
    };
  }, [selectedDate, user, fetchPageData]);


  const saveObjectiveTags = async (objectiveId: string, tagsToSave: Tag[]) => {
    if(!user) return;
    // Remove old links
    const { error: deleteError } = await supabase.from('daily_objective_tags').delete().eq('daily_objective_id', objectiveId);
    if (deleteError) throw new Error(`Erreur lors de la suppression des anciens tags: ${deleteError.message}`);

    // Add new links
    if (tagsToSave.length > 0) {
      const newLinks = tagsToSave.map(tag => ({ daily_objective_id: objectiveId, tag_id: tag.id }));
      const { error } = await supabase.from('daily_objective_tags').insert(newLinks);
      if (error) throw new Error(`Erreur liaison tags: ${error.message}`);
    }
  };

  const handleAddOrUpdateObjective = async () => {
    if (!user || newObjectiveText.trim() === '') return;
    setIsFormLoading(true);
    try {
      const objectivePayload = {
        user_id: user.id, text: newObjectiveText.trim(), objective_date: formatDateForSupabase(selectedDate),
        completed: editingObjective ? editingObjective.completed : false,
        completed_at: editingObjective?.completed ? (editingObjective.completed_at || new Date().toISOString()) : null,
        chapter_id: selectedChapterId || null, 
        daily_plan_id: dailyPlanForSelectedDate?.id || null,
      };
      let savedObjectiveData: Pick<DailyObjective, 'id' | 'created_at' | 'objective_date'>;

      if (editingObjective) {
        const { data, error } = await supabase.from('daily_objectives').update(objectivePayload).eq('id', editingObjective.id).select('id, created_at, objective_date').single();
        if (error) throw error; savedObjectiveData = data!;
      } else {
        const { data, error } = await supabase.from('daily_objectives').insert(objectivePayload).select('id, created_at, objective_date').single();
        if (error) throw error; savedObjectiveData = data!;
      }
      
      await saveObjectiveTags(savedObjectiveData.id, selectedTags);
      
      // Fetch the full objective with relations to update UI correctly
      const { data: fetchedObjective, error: fetchErr } = await supabase.from('daily_objectives').select('*, chapters(id,name), daily_objective_tags(tags(id,name,color)), daily_plans(id,title)').eq('id', savedObjectiveData.id).single();
      if (fetchErr || !fetchedObjective) throw fetchErr || new Error("Récupération de l'objectif avec relations échouée.");
      
      const processedFinalObjective: DailyObjective = { 
        ...fetchedObjective, 
        tags: fetchedObjective.daily_objective_tags?.map((dot: any) => dot.tags as Tag) || [],
        chapters: fetchedObjective.chapters as {id: string, name: string} | null,
        daily_plans: fetchedObjective.daily_plans as {id: string, title: string | null} | null
      };

      if (savedObjectiveData.objective_date === formatDateForSupabase(selectedDate)) {
          if (editingObjective) {
            setObjectives(prev => prev.map(obj => obj.id === processedFinalObjective.id ? processedFinalObjective : obj).sort((a,b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime()));
          } else {
            setObjectives(prev => [...prev, processedFinalObjective].sort((a,b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime()));
          }
      }
      // Remove from overdue if it was there and now matches selectedDate or is completed
      setOverdueObjectives(prev => prev.filter(o => o.id !== processedFinalObjective.id));
      
      toast({ title: editingObjective ? "Objectif mis à jour" : "Objectif ajouté" });
      setNewObjectiveText(''); setEditingObjective(null); setSelectedChapterId(undefined); setSelectedTags([]); setIsModalOpen(false);
    } catch (e: any) { toast({title:"Erreur d'enregistrement", description: (e as Error).message, variant: "destructive"});
    } finally { setIsFormLoading(false); }
  };

  const handleToggleObjective = async (id: string, completed: boolean, objective_date: string) => {
    if (!user) return; setIsItemLoading(id);
    try {
      const { data: updatedObj, error } = await supabase.from('daily_objectives').update({ completed, completed_at: completed ? new Date().toISOString() : null }).eq('id', id).select('*, chapters(id,name), daily_objective_tags(tags(id,name,color)), daily_plans(id,title)').single();
      if (error) throw error;
      if (updatedObj) {
          const processedUpdatedObj: DailyObjective = { 
            ...updatedObj, 
            tags: updatedObj.daily_objective_tags?.map((dot: any) => dot.tags as Tag) || [],
            chapters: updatedObj.chapters as {id: string, name: string} | null,
            daily_plans: updatedObj.daily_plans as {id: string, title: string | null} | null
          };
          if (objective_date === formatDateForSupabase(selectedDate)) {
            setObjectives(prev => prev.map(obj => obj.id === id ? processedUpdatedObj : obj).sort((a,b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime()));
          }
          // If the objective was in overdue list and is now completed, remove it from overdue
          if (completed) {
            setOverdueObjectives(prevOverdue => prevOverdue.filter(obj => obj.id !== id));
          } else if (objective_date < formatDateForSupabase(startOfDay(new Date())) && !isToday(parseISO(objective_date))) {
            // If unchecked and it's a past date, it might need to go back to overdue
            // This might require re-fetching overdue or adding it back manually if not too complex
            fetchPageData(selectedDate); // Simpler to refetch for consistency here
          }
      }
    } catch (e: any) { toast({title:"Erreur de mise à jour", description: (e as Error).message, variant:"destructive"});
    } finally { setIsItemLoading(null); }
  };

  const handleDeleteObjective = async (id: string) => {
    if (!user) return; setIsItemLoading(id);
    try {
      await supabase.from('daily_objective_tags').delete().eq('daily_objective_id', id);
      const { error } = await supabase.from('daily_objectives').delete().eq('id', id);
      if (error) throw error;
      setObjectives(prev => prev.filter(obj => obj.id !== id));
      setOverdueObjectives(prev => prev.filter(obj => obj.id !== id));
      if (editingObjective && editingObjective.id === id) { setNewObjectiveText(''); setEditingObjective(null); setSelectedChapterId(undefined); setSelectedTags([]); setIsModalOpen(false); }
      toast({ title: "Objectif supprimé" });
    } catch (e: any) { toast({title:"Erreur de suppression", description: (e as Error).message, variant:"destructive"});
    } finally { setIsItemLoading(null); }
  };

  const openEditModal = (objective: DailyObjective) => { setEditingObjective(objective); setNewObjectiveText(objective.text); setSelectedChapterId(objective.chapter_id || undefined); setSelectedTags(objective.tags || []); setIsModalOpen(true); };
  const openNewModal = () => { 
    setEditingObjective(null); 
    setNewObjectiveText(''); 
    setSelectedChapterId(undefined); // No preselection by default unless from URL
    setSelectedTags([]); 
    setIsModalOpen(true); 
  };
  const navigateDate = (offset: number) => setSelectedDate(prevDate => startOfDay(addDays(prevDate, offset)));

  const handleAddTagToManualObjective = async (tagOrNewName: Tag | string) => {
    if (!user) return;
    let finalTag: Tag | undefined;
    if (typeof tagOrNewName === 'string') {
      const existingTag = availableTags.find(t => t.name.toLowerCase() === tagOrNewName.toLowerCase() && t.user_id === user.id);
      if (existingTag) finalTag = existingTag;
      else {
        const { data: newTagFromDb, error: tagError } = await supabase.from('tags').insert({ name: tagOrNewName, user_id: user.id }).select().single();
        if (tagError || !newTagFromDb) { toast({ title: "Erreur création Tag", description: tagError?.message, variant: "destructive" }); return; }
        finalTag = newTagFromDb; 
        setAvailableTags(prev => [...prev, finalTag!].sort((a,b)=>a.name.localeCompare(b.name)));
      }
    } else finalTag = tagOrNewName;
    if (finalTag && !selectedTags.find(st => st.id === finalTag!.id)) setSelectedTags(prev => [...prev, finalTag!]);
  };
  const handleRemoveTagFromManualObjective = (tagId: string) => setSelectedTags(prev => prev.filter(t => t.id !== tagId));

  const completedCount = objectives.filter(obj => obj.completed).length;
  const totalForSelectedDate = objectives.length;
  const completionPercentage = totalForSelectedDate > 0 ? Math.round((completedCount / totalForSelectedDate) * 100) : 0;

  const handleSaveDailyPlan = async (title: string | null) => {
    if (!user) return; setIsSavingPlan(true);
    try {
        const planPayload = { 
          user_id: user.id, 
          plan_date: formatDateForSupabase(selectedDate), 
          title: title || null, 
          id: dailyPlanForSelectedDate?.id // Pass ID for upsert
        };
        const { data: savedPlan, error } = await supabase.from('daily_plans').upsert(planPayload, { onConflict: 'user_id, plan_date' }).select().single();
        if (error) throw error;
        setDailyPlanForSelectedDate(savedPlan as DailyPlan | null);
        toast({ title: dailyPlanForSelectedDate?.id ? "Titre du plan mis à jour" : "Plan du jour créé/mis à jour" });
        setIsPlanModalOpen(false);
    } catch (e: any) { toast({ title: "Erreur enregistrement plan", description: (e as Error).message, variant: "destructive" });
    } finally { setIsSavingPlan(false); }
  };
  const openPlanModal = () => setIsPlanModalOpen(true);
  
  const showAddButtonInHeader = !isSelectedDatePast || isSelectedDateToday;
  const showAddButtonInEmptyState = !isSelectedDatePast || isSelectedDateToday;

  if (!user && isFetching) {
     return (<div className="p-4 md:p-6 h-full flex flex-col items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary mb-3" /><p className="text-muted-foreground">Chargement...</p></div>);
  }

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <TargetIcon className="h-7 w-7 text-primary" />
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
            {isSelectedDateToday ? "Plan du Jour" : `Plan du ${format(selectedDate, "d MMMM yyyy", { locale: fr })}`}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => navigateDate(-1)} aria-label="Jour précédent" disabled={isFetching} className="h-9 w-9"><ChevronLeft className="h-4 w-4" /></Button>
          <Popover><PopoverTrigger asChild><Button variant="outline" className="w-[180px] justify-start text-left font-normal text-sm h-9" disabled={isFetching}><CalendarDays className="mr-2 h-4 w-4" />{format(selectedDate, "PPP", { locale: fr })}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="end"><Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(startOfDay(date))} initialFocus locale={fr} /></PopoverContent></Popover>
          <Button variant="outline" size="icon" onClick={() => navigateDate(1)} disabled={isSelectedDateToday || isFetching} aria-label="Jour suivant" className="h-9 w-9"><ChevronRight className="h-4 w-4" /></Button>
          {showAddButtonInHeader && (<Button onClick={openNewModal} disabled={isFetching || isFormLoading || !user} size="sm" className="h-9"><PlusCircle className="mr-2 h-4 w-4" /> Objectif</Button>)}
          <Button onClick={openPlanModal} variant="outline" size="sm" className="h-9" disabled={isFetching || isSavingPlan || !user}><Edit className="mr-2 h-4 w-4" /> {dailyPlanForSelectedDate?.id ? "Modifier Titre Plan" : "Créer/Modifier Plan"}</Button>
        </div>
      </div>

      {dailyPlanForSelectedDate?.title && (<Card className="shadow-sm bg-primary/5 border-primary/20"><CardHeader className="py-3 px-4"><CardTitle className="text-base md:text-lg text-primary flex items-center gap-2"><Info className="h-5 w-5"/> Plan du Jour : {dailyPlanForSelectedDate.title}</CardTitle></CardHeader></Card>)}

      <Card className="shadow-sm"><CardHeader className="pb-2 pt-4 flex flex-row items-center justify-between"><CardTitle className="text-base md:text-lg">Progression ({format(selectedDate, "d MMMM", { locale: fr })})</CardTitle><Badge variant={completionPercentage === 100 ? "default" : "secondary"} className={cn("text-sm", completionPercentage === 100 && "bg-green-500 text-white")}>{completedCount}/{totalForSelectedDate} complétés</Badge></CardHeader><CardContent className="py-3"><Progress value={completionPercentage} className="w-full h-2.5 mb-1" /><p className="text-xs text-muted-foreground text-center">{completionPercentage}%</p></CardContent></Card>

      {isSelectedDateToday && overdueObjectives.length > 0 && (
        <Accordion type="single" collapsible className="w-full" defaultValue="overdue"><AccordionItem value="overdue" className="border rounded-lg shadow-sm bg-amber-50/50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700"><AccordionTrigger className="text-sm md:text-base font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 py-3 px-4 hover:no-underline"><div className="flex items-center gap-2"><History className="h-5 w-5" />Objectifs en Retard ({overdueObjectives.length})</div></AccordionTrigger><AccordionContent className="pt-1 pb-3 px-3 space-y-2.5">{overdueObjectives.map((obj) => <DailyObjectiveItem key={obj.id} objective={obj} onToggle={handleToggleObjective} onDelete={handleDeleteObjective} onEdit={openEditModal} isLoading={isItemLoading === obj.id} isPastObjective={true} />)}</AccordionContent></AccordionItem></Accordion>
      )}

      <div className="flex-grow space-y-3 overflow-y-auto custom-scrollbar pr-1 pb-4 min-h-[200px]">
        {isFetching ? (<div className="flex-grow flex flex-col items-center justify-center text-center p-6"><Loader2 className="h-10 w-10 animate-spin text-primary mb-4" /><p className="text-muted-foreground">Chargement des objectifs...</p></div>
        ) : error ? (<div className="flex-grow flex flex-col items-center justify-center text-center p-6 border-destructive bg-destructive/10 rounded-md"><AlertTriangle className="h-10 w-10 text-destructive mb-4" /><p className="font-semibold text-destructive">Erreur de chargement</p><p className="text-sm text-destructive/80 mt-1 mb-3 max-w-md mx-auto">{error}</p><Button onClick={() => fetchPageData(selectedDate)} variant="destructive" className="mt-4">Réessayer</Button></div>
        ) : objectives.length === 0 ? (<div className="flex-grow flex flex-col items-center justify-center text-center p-6 text-muted-foreground border-dashed border rounded-md min-h-[200px]"><TargetIcon className="mx-auto h-16 w-16 opacity-30 mb-4"/><p className="font-medium text-lg mb-1">Aucun objectif pour {isSelectedDateToday ? "aujourd'hui" : `le ${format(selectedDate, "d MMM", {locale: fr})}`}.</p>{(dailyPlanForSelectedDate?.title) && <p className="text-sm text-muted-foreground mb-1">Plan : "{dailyPlanForSelectedDate.title}"</p> }<p className="text-sm mb-4">Définissez vos priorités.</p>{showAddButtonInEmptyState && (<Button onClick={openNewModal} size="lg" className="mt-2" disabled={!user || isFormLoading || isFetching}><PlusCircle className="mr-2 h-5 w-5" /> Définir {objectives.length === 0 && isSelectedDateToday ? 'le premier' : 'un'} objectif</Button>)}</div>
        ) : (objectives.map((obj) => <DailyObjectiveItem key={obj.id} objective={obj} onToggle={handleToggleObjective} onDelete={handleDeleteObjective} onEdit={openEditModal} isLoading={isItemLoading === obj.id} isPastObjective={isSelectedDatePast} />))}
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => {if(!isFormLoading) setIsModalOpen(open)}}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className="text-lg">{editingObjective ? "Modifier l'Objectif" : `Nouvel Objectif (${format(selectedDate, "d MMM", { locale: fr })})`}</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
                 <div><Label htmlFor="objectiveTextModal" className="mb-1.5 block text-sm">Description</Label><Input id="objectiveTextModal" value={newObjectiveText} onChange={(e) => setNewObjectiveText(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && !isFormLoading && handleAddOrUpdateObjective()} disabled={isFormLoading || !user} className="text-sm" /></div>
                 <div>
                    <Label htmlFor="objectiveChapterSelect" className="mb-1.5 block text-sm">Chapitre (Optionnel)</Label>
                    <Select value={selectedChapterId || "none"} onValueChange={(value) => setSelectedChapterId(value === "none" ? undefined : value)} disabled={isFormLoading || chapters.length === 0 || !user}>
                        <SelectTrigger id="objectiveChapterSelect" className="text-sm h-10"><SelectValue placeholder={chapters.length === 0 ? "Aucun chapitre" : "Lier à un chapitre..."} /></SelectTrigger>
                        <SelectContent><SelectItem value="none">Aucun chapitre</SelectItem>{chapters.map(chap => <SelectItem key={chap.id} value={chap.id}>{chap.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                 <div>
                    <Label className="mb-1.5 block text-sm">Tags (Optionnel)</Label>
                    <TagManager
                      availableTags={availableTags.filter(t => t.user_id === user?.id)}
                      selectedTags={selectedTags}
                      onTagAdd={handleAddTagToManualObjective}
                      onTagRemove={handleRemoveTagFromManualObjective}
                      disabled={isFormLoading || !user}
                      isLoading={isFetching} // Pass global fetching state for tags
                      triggerLabel="Gérer les tags de l'objectif"
                      allowTagCreation={true}
                    />
                  </div>
                 {objectives.filter(obj => !obj.completed && obj.objective_date === formatDateForSupabase(selectedDate)).length >= 5 && !editingObjective && isSelectedDateToday && (<p className="text-xs text-orange-600 flex items-center gap-1.5 pt-1"><Info className="h-3.5 w-3.5 shrink-0"/>Vous avez déjà 5 objectifs actifs pour aujourd'hui.</p>)}
            </div>
            <DialogFooter className="mt-2">
                <DialogClose asChild><Button variant="outline" disabled={isFormLoading}>Annuler</Button></DialogClose>
                <Button 
                    onClick={handleAddOrUpdateObjective} 
                    disabled={isFormLoading || !user || !newObjectiveText.trim() || (objectives.filter(obj => !obj.completed && obj.objective_date === formatDateForSupabase(selectedDate)).length >= 5 && !editingObjective && isSelectedDateToday)}
                >
                    <Loader2 className={isFormLoading ? "h-4 w-4 animate-spin mr-2" : "hidden"} />
                    {editingObjective ? <Save className="h-4 w-4 mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                    {editingObjective ? 'Enregistrer' : 'Ajouter'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPlanModalOpen} onOpenChange={setIsPlanModalOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className="text-lg">{dailyPlanForSelectedDate?.id ? "Modifier le Titre du Plan" : `Créer un Plan pour le ${format(selectedDate, "d MMM", { locale: fr })}`}</DialogTitle></DialogHeader>
            <CreateDailyPlanForm 
                planDate={selectedDate} 
                userId={user?.id || ''} 
                existingPlan={dailyPlanForSelectedDate} 
                onSubmitPlan={handleSaveDailyPlan} 
                isSubmitting={isSavingPlan} 
                onCancel={() => setIsPlanModalOpen(false)}
            />
        </DialogContent>
      </Dialog>
    </div>
  );
}

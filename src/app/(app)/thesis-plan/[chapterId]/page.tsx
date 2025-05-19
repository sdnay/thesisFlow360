
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ChevronRight, EllipsisVertical, PlusCircle, ListChecks, Target as TargetIcon, NotebookText, FileText, TimerIcon, MessageSquare, Edit, Tags as TagsIcon, Link2 } from 'lucide-react';
import type { Chapter, Task, DailyObjective, PomodoroSession, BrainDumpEntry, Source, Tag } from '@/types';
import { format, parseISO, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import SupervisorCommentsSection from '@/components/thesis/chapter-detail-components/SupervisorCommentsSection';
import ChapterActionsController from '@/components/thesis/chapter-detail-components/ChapterActionsController';
import AddChapterTaskModal from '@/components/thesis/chapter-detail-components/AddChapterTaskModal';
import AddChapterObjectiveModal from '@/components/thesis/chapter-detail-components/AddChapterObjectiveModal';
import AddChapterBrainDumpNote from '@/components/thesis/chapter-detail-components/AddChapterBrainDumpNote';
import ManageChapterSources from '@/components/thesis/chapter-detail-components/ManageChapterSources';
import { ScrollArea } from '@/components/ui/scroll-area'; // Pour les listes

// Helper function to calculate chapter progress
function calculateChapterProgress(tasks: Pick<Task, 'completed'>[] | undefined): number {
  if (!tasks || tasks.length === 0) {
    return 0;
  }
  const completedTasks = tasks.filter(task => task.completed).length;
  return Math.round((completedTasks / tasks.length) * 100);
}

interface ChapterDetailPageProps {
  params: { chapterId: string };
}

export default async function ChapterDetailPage({ params }: ChapterDetailPageProps) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirectTo=/thesis-plan/${params.chapterId}`);
  }

  const { data: chapterData, error: chapterError } = await supabase
    .from('chapters')
    .select('*, tags:chapter_tags(tags(id, name, color))')
    .eq('id', params.chapterId)
    .eq('user_id', user.id)
    .single();

  if (chapterError || !chapterData) {
    console.error("Erreur récupération chapitre ou chapitre non trouvé:", chapterError);
    notFound();
  }
  const chapter: Chapter = { ...chapterData, tags: chapterData.tags?.map((t: any) => t.tags) || [] };

  const [tasksRes, objectivesRes, brainDumpsRes, pomodorosRes, sourcesRes, allUserSourcesRes, availableTagsRes] = await Promise.all([
    supabase.from('tasks').select('*, tags:task_tags(tags(id, name, color))').eq('chapter_id', params.chapterId).eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('daily_objectives').select('*, tags:daily_objective_tags(tags(id, name, color))').eq('chapter_id', params.chapterId).eq('user_id', user.id).order('objective_date', { ascending: false }),
    supabase.from('brain_dump_entries').select('*, tags:brain_dump_entry_tags(tags(id, name, color))').eq('chapter_id', params.chapterId).eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('pomodoro_sessions').select('*').eq('chapter_id', params.chapterId).eq('user_id', user.id).order('start_time', { ascending: false }),
    supabase.from('chapter_sources').select('sources(*, tags:source_tags(tags(id, name, color)))').eq('chapter_id', params.chapterId).eq('user_id', user.id),
    supabase.from('sources').select('*').eq('user_id', user.id).order('title'),
    supabase.from('tags').select('*').eq('user_id', user.id).order('name')
  ]);

  const tasks: Task[] = (tasksRes.data || []).map((t: any) => ({ ...t, tags: t.tags?.map((tg: any) => tg.tags) || [] }));
  const objectives: DailyObjective[] = (objectivesRes.data || []).map((o: any) => ({ ...o, tags: o.tags?.map((tg: any) => tg.tags) || [] }));
  const brainDumps: BrainDumpEntry[] = (brainDumpsRes.data || []).map((b: any) => ({ ...b, tags: b.tags?.map((tg: any) => tg.tags) || [] }));
  const pomodoros: PomodoroSession[] = pomodorosRes.data || [];
  const linkedSources: Source[] = (sourcesRes.data || []).map((cs: any) => ({ ...cs.sources, tags: cs.sources?.tags?.map((t: any) => t.tags) || []}));
  const allUserSources: Source[] = allUserSourcesRes.data || [];
  const availableTags: Tag[] = availableTagsRes.data || [];

  const chapterProgress = calculateChapterProgress(tasks);
  const today_yyyy_mm_dd = format(startOfDay(new Date()), 'yyyy-MM-dd');

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="text-sm text-muted-foreground flex items-center">
        <Link href="/thesis-plan" className="hover:underline">Plan de Thèse</Link>
        <ChevronRight className="h-4 w-4 mx-1" />
        <span className="font-medium text-foreground">{chapter.name}</span>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="flex flex-row justify-between items-start">
          <div>
            <CardTitle className="text-2xl md:text-3xl font-semibold">{chapter.name}</CardTitle>
            <CardDescription className="mt-1 flex items-center gap-2 flex-wrap">
              <Badge variant={chapter.status === "Terminé" ? "default" : "secondary"} className={cn(chapter.status === "Terminé" && "bg-green-600 text-white")}>
                {chapter.status}
              </Badge>
              {chapter.tags && chapter.tags.length > 0 && (
                chapter.tags.slice(0, 3).map((tag: Tag) => (
                  <Badge key={tag.id} variant="outline" style={tag.color ? { borderColor: tag.color, color: tag.color } : {}} className="text-xs">
                    {tag.name}
                  </Badge>
                ))
              )}
              {chapter.tags && chapter.tags.length > 3 && <Badge variant="outline" className="text-xs">+{chapter.tags.length - 3}</Badge>}
            </CardDescription>
            <div className="mt-3 w-full md:max-w-md">
              <div className="flex justify-between text-sm text-muted-foreground mb-1">
                <span>Progression (basée sur les tâches)</span>
                <span>{chapterProgress}%</span>
              </div>
              <Progress value={chapterProgress} className="h-3" />
            </div>
          </div>
          <ChapterActionsController
            chapter={chapter}
            userId={user.id}
            availableTags={availableTags}
            trigger={
              <Button variant="ghost" size="icon" aria-label="Actions du chapitre">
                <EllipsisVertical className="h-5 w-5" />
              </Button>
            }
          />
        </CardHeader>
      </Card>

      <Tabs defaultValue="tasks" className="flex-grow flex flex-col">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 mb-4 shrink-0">
          <TabsTrigger value="tasks"><ListChecks className="mr-1 h-4 w-4 sm:hidden md:inline-block" />Tâches</TabsTrigger>
          <TabsTrigger value="objectives"><TargetIcon className="mr-1 h-4 w-4 sm:hidden md:inline-block" />Objectifs</TabsTrigger>
          <TabsTrigger value="notes"><NotebookText className="mr-1 h-4 w-4 sm:hidden md:inline-block" />Notes</TabsTrigger>
          <TabsTrigger value="sources"><FileText className="mr-1 h-4 w-4 sm:hidden md:inline-block" />Sources</TabsTrigger>
          <TabsTrigger value="pomodoros"><TimerIcon className="mr-1 h-4 w-4 sm:hidden md:inline-block" />Pomodoros</TabsTrigger>
          <TabsTrigger value="comments"><MessageSquare className="mr-1 h-4 w-4 sm:hidden md:inline-block" />Commentaires</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="flex-grow flex flex-col overflow-hidden space-y-3 p-1">
          <div className="flex justify-end mb-2 shrink-0">
            <AddChapterTaskModal
              chapterId={chapter.id}
              userId={user.id}
              availableTags={availableTags}
              onTaskAdded={() => { /* revalidatePath via controller or parent if client-side updates needed */ }}
              isOpen={false} // Placeholder, state will be managed by a controller or this becomes client
              onOpenChange={() => {}} // Placeholder
              trigger={ <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Ajouter Tâche</Button> }
            />
          </div>
          {tasks.length > 0 ? (
            <ScrollArea className="flex-grow custom-scrollbar pr-2 -mr-2">
              <div className="space-y-2">
                {tasks.map((task) => (
                  <Card key={task.id} className={cn("p-3 text-sm border-l-4", task.completed && "opacity-60")}>
                    <div className="flex items-start gap-2">
                      <Checkbox id={`task-${task.id}`} checked={task.completed} className="mt-1" disabled />
                      <div className="flex-grow">
                        <label htmlFor={`task-${task.id}`} className={cn("font-medium", task.completed && "line-through")}>{task.text}</label>
                        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-xs">{task.type}</Badge>
                          {task.tags?.map(tag => <Badge key={tag.id} variant="secondary" className="text-xs" style={tag.color ? {backgroundColor: tag.color, color: 'hsl(var(--secondary-foreground))'} : {}}>{tag.name}</Badge>)}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune tâche liée à ce chapitre.</p>
          )}
        </TabsContent>

        <TabsContent value="objectives" className="flex-grow flex flex-col overflow-hidden space-y-3 p-1">
          <div className="flex justify-end mb-2 shrink-0">
             <AddChapterObjectiveModal
              chapterId={chapter.id}
              userId={user.id}
              objectiveDate={today_yyyy_mm_dd}
              availableTags={availableTags}
              onObjectiveAdded={() => {}}
              isOpen={false} // Placeholder
              onOpenChange={() => {}} // Placeholder
              trigger={ <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Ajouter Objectif</Button>}
            />
          </div>
          {objectives.length > 0 ? (
            <ScrollArea className="flex-grow custom-scrollbar pr-2 -mr-2">
              <div className="space-y-2">
                {objectives.map((obj) => (
                  <Card key={obj.id} className={cn("p-3 text-sm", obj.completed && "opacity-60")}>
                    <div className="flex items-start gap-2">
                      <Checkbox id={`obj-${obj.id}`} checked={obj.completed} className="mt-1" disabled />
                      <div className="flex-grow">
                        <label htmlFor={`obj-${obj.id}`} className={cn("font-medium", obj.completed && "line-through")}>{obj.text}</label>
                        <p className="text-xs text-muted-foreground">Pour le: {format(parseISO(obj.objective_date), "d MMM yyyy", { locale: fr })}</p>
                        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-1">
                           {obj.tags?.map(tag => <Badge key={tag.id} variant="secondary" className="text-xs" style={tag.color ? {backgroundColor: tag.color, color: 'hsl(var(--secondary-foreground))'} : {}}>{tag.name}</Badge>)}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun objectif lié à ce chapitre.</p>
          )}
        </TabsContent>

        <TabsContent value="notes" className="flex-grow flex flex-col overflow-hidden space-y-3 p-1">
          <div className="flex justify-end mb-2 shrink-0">
            <AddChapterBrainDumpNote
              chapterId={chapter.id}
              userId={user.id}
              availableTags={availableTags}
              onNoteAdded={() => {}}
              trigger={<Button size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Ajouter Note (Vide-Cerveau)</Button>}
            />
          </div>
          {brainDumps.length > 0 ? (
            <ScrollArea className="flex-grow custom-scrollbar pr-2 -mr-2">
               <div className="space-y-2">
                {brainDumps.map(note => (
                  <Card key={note.id} className="p-3 text-sm">
                    <p className="font-medium whitespace-pre-wrap">{note.text}</p>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-xs">{note.status}</Badge>
                        {note.tags?.map(tag => <Badge key={tag.id} variant="secondary" className="text-xs" style={tag.color ? {backgroundColor: tag.color, color: 'hsl(var(--secondary-foreground))'} : {}}>{tag.name}</Badge>)}
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune note du vide-cerveau liée.</p>
          )}
        </TabsContent>

        <TabsContent value="sources" className="flex-grow flex flex-col overflow-hidden space-y-3 p-1">
           <div className="flex justify-end mb-2 shrink-0">
            <ManageChapterSources
              chapterId={chapter.id}
              userId={user.id}
              allUserSources={allUserSources}
              initiallyLinkedSourceIds={new Set(linkedSources.map(s => s.id))}
              onAssociationsUpdated={() => {}}
              trigger={<Button size="sm"><Link2 className="mr-2 h-4 w-4"/>Gérer les Sources Associées</Button>}
            />
          </div>
          {linkedSources.length > 0 ? (
             <ScrollArea className="flex-grow custom-scrollbar pr-2 -mr-2">
              <div className="space-y-2">
                {linkedSources.map(source => (
                  <Card key={source.id} className="p-3 text-sm">
                    <p className="font-medium">{source.title}</p>
                     <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-xs">{source.type}</Badge>
                        {source.tags?.map(tag => <Badge key={tag.id} variant="secondary" className="text-xs" style={tag.color ? {backgroundColor: tag.color, color: 'hsl(var(--secondary-foreground))'} : {}}>{tag.name}</Badge>)}
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune source liée à ce chapitre.</p>
          )}
        </TabsContent>

        <TabsContent value="pomodoros" className="flex-grow flex flex-col overflow-hidden space-y-3 p-1">
           <div className="flex justify-end mb-2 shrink-0">
            <Button size="sm" asChild>
                <Link href={`/pomodoro?chapterId=${chapter.id}`}><TimerIcon className="mr-2 h-4 w-4"/>Enregistrer un Pomodoro</Link>
            </Button>
           </div>
          {pomodoros.length > 0 ? (
            <ScrollArea className="flex-grow custom-scrollbar pr-2 -mr-2">
                <div className="space-y-2">
                    {pomodoros.map(pomo => (
                    <Card key={pomo.id} className="p-3 text-sm">
                        <p className="font-medium">{pomo.duration} min - {format(parseISO(pomo.start_time), "d MMM yyyy, HH:mm", {locale: fr})}</p>
                        {pomo.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{pomo.notes}</p>}
                    </Card>
                    ))}
                </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune session Pomodoro liée.</p>
          )}
        </TabsContent>

        <TabsContent value="comments" className="flex-grow flex flex-col overflow-hidden p-1">
          <SupervisorCommentsSection chapterId={chapter.id} userId={user.id} initialComments={chapter.supervisor_comments || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

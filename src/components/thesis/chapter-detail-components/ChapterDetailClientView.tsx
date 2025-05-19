
"use client";

import { useState, useEffect, type FC } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronRight, ListTree, Info, Edit, Tags as TagsIcon, PlusCircle, TimerIcon, MessageSquare, NotebookText, FileText, Target as TargetIcon, ListChecks, EllipsisVertical, Link as LinkIconLucide } from 'lucide-react';
import type { Chapter, Task, DailyObjective, PomodoroSession, BrainDumpEntry, Source, Tag, TaskType } from '@/types';
import { format, parseISO, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

import SupervisorCommentsSection from './SupervisorCommentsSection';
import ChapterActionsController from './ChapterActionsController';
import AddChapterTaskModal from './AddChapterTaskModal';
import AddChapterObjectiveModal from './AddChapterObjectiveModal';
import AddChapterBrainDumpNote from './AddChapterBrainDumpNote';
import ManageChapterSources from './ManageChapterSources';
import { SourceTypeIcon, sourceTypeText } from '@/components/thesis/source-library-components/SourceTypeIcon';
import { statusConfigDefinition } from '@/components/thesis/brain-dump-components/brainDumpConstants';

interface ChapterDetailClientViewProps {
  initialChapter: Chapter;
  initialTasks: Task[];
  initialObjectives: DailyObjective[];
  initialBrainDumps: BrainDumpEntry[];
  initialLinkedSources: Source[];
  initialPomodoros: PomodoroSession[];
  initialChapterProgress: number;
  userId: string;
  availableTags: Tag[];
  allUserSources: Source[];
}
const taskTypeLabels: Record<TaskType, string> = { urgent: "Urgent", important: "Important", reading: "Lecture", chatgpt: "ChatGPT", secondary: "Secondaire" };


const ChapterDetailClientView: FC<ChapterDetailClientViewProps> = ({
  initialChapter,
  initialTasks,
  initialObjectives,
  initialBrainDumps,
  initialLinkedSources,
  initialPomodoros,
  initialChapterProgress,
  userId,
  availableTags,
  allUserSources,
}) => {
  const router = useRouter();
  const [chapter, setChapter] = useState<Chapter>(initialChapter);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [objectives, setObjectives] = useState<DailyObjective[]>(initialObjectives);
  const [brainDumps, setBrainDumps] = useState<BrainDumpEntry[]>(initialBrainDumps);
  const [linkedSources, setLinkedSources] = useState<Source[]>(initialLinkedSources);
  const [pomodoros, setPomodoros] = useState<PomodoroSession[]>(initialPomodoros);
  const [chapterProgress, setChapterProgress] = useState<number>(initialChapterProgress);

  // Modal states
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isAddObjectiveModalOpen, setIsAddObjectiveModalOpen] = useState(false);
  const [isAddBrainDumpModalOpen, setIsAddBrainDumpModalOpen] = useState(false);
  const [isManageSourcesModalOpen, setIsManageSourcesModalOpen] = useState(false);
  
  // For ChapterActionsController (Edit Chapter Details & Tags)
  // These states would be managed within ChapterActionsController or lifted if needed by other parts here.
  // For now, ChapterActionsController handles its own modal states.

  useEffect(() => {
    setChapter(initialChapter);
    setTasks(initialTasks);
    setObjectives(initialObjectives);
    setBrainDumps(initialBrainDumps);
    setLinkedSources(initialLinkedSources);
    setPomodoros(initialPomodoros);
    setChapterProgress(initialChapterProgress);
  }, [initialChapter, initialTasks, initialObjectives, initialBrainDumps, initialLinkedSources, initialPomodoros, initialChapterProgress]);

  const handleGenericSuccess = () => {
    router.refresh(); // Re-fetch server component data
  };
  
  const today_yyyy_mm_dd = format(startOfDay(new Date()), 'yyyy-MM-dd');

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      {/* Breadcrumbs */}
      <div className="text-sm text-muted-foreground flex items-center">
        <Link href="/thesis-plan" className="hover:underline">Plan de Thèse</Link>
        <ChevronRight className="h-4 w-4 mx-1" />
        <span className="font-medium text-foreground">{chapter.name}</span>
      </div>

      {/* Chapter Header Card */}
      <Card className="shadow-lg shrink-0">
        <CardHeader className="flex flex-row justify-between items-start gap-4">
          <div className='flex-grow'>
            <CardTitle className="text-2xl md:text-3xl font-semibold">{chapter.name}</CardTitle>
            <CardDescription className="mt-1 flex items-center gap-2 flex-wrap">
              <Badge variant={chapter.status === "Terminé" ? "default" : "secondary"} className={cn(chapter.status === "Terminé" && "bg-green-600 text-white dark:bg-green-500 dark:text-white")}>
                {chapter.status || "Non défini"}
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
            userId={userId}
            availableTags={availableTags}
            onSuccessCallback={handleGenericSuccess}
          />
        </CardHeader>
      </Card>

      {/* Tabs for Linked Items */}
      <Tabs defaultValue="tasks" className="flex-grow flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 mb-4 shrink-0">
          <TabsTrigger value="tasks"><ListChecks className="mr-1 h-4 w-4 sm:hidden md:inline-block" />Tâches ({tasks.length})</TabsTrigger>
          <TabsTrigger value="objectives"><TargetIcon className="mr-1 h-4 w-4 sm:hidden md:inline-block" />Objectifs ({objectives.length})</TabsTrigger>
          <TabsTrigger value="notes"><NotebookText className="mr-1 h-4 w-4 sm:hidden md:inline-block" />Notes ({brainDumps.length})</TabsTrigger>
          <TabsTrigger value="sources"><FileText className="mr-1 h-4 w-4 sm:hidden md:inline-block" />Sources ({linkedSources.length})</TabsTrigger>
          <TabsTrigger value="pomodoros"><TimerIcon className="mr-1 h-4 w-4 sm:hidden md:inline-block" />Pomodoros ({pomodoros.length})</TabsTrigger>
          <TabsTrigger value="comments"><MessageSquare className="mr-1 h-4 w-4 sm:hidden md:inline-block" />Commentaires ({chapter.supervisor_comments?.length || 0})</TabsTrigger>
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="flex-grow flex flex-col overflow-hidden space-y-3 p-1">
          <div className="flex justify-end mb-2 shrink-0">
            <AddChapterTaskModal
              chapterId={chapter.id}
              userId={userId}
              availableTags={availableTags}
              isOpen={isAddTaskModalOpen}
              onOpenChange={setIsAddTaskModalOpen}
              onTaskAdded={handleGenericSuccess}
            />
          </div>
          <ScrollArea className="flex-grow custom-scrollbar pr-2 -mr-2">
            {tasks.length > 0 ? (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <Card key={task.id} className={cn("p-3 text-sm border-l-4", task.completed && "opacity-60",
                    task.type === 'urgent' ? 'border-red-500' :
                    task.type === 'important' ? 'border-orange-500' :
                    task.type === 'reading' ? 'border-green-500' : // Changed reading to green
                    task.type === 'chatgpt' ? 'border-blue-500' :
                    'border-gray-400'
                  )}>
                    <div className="flex items-start gap-2">
                      <Checkbox id={`task-${task.id}`} checked={task.completed} className="mt-1" disabled />
                      <div className="flex-grow">
                        <label htmlFor={`task-${task.id}`} className={cn("font-medium", task.completed && "line-through")}>{task.text}</label>
                        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-1 items-center">
                          <Badge variant="outline" className="text-xs">{taskTypeLabels[task.type as TaskType] || task.type}</Badge>
                          {task.tags?.map(tag => <Badge key={tag.id} variant="secondary" className="text-xs" style={tag.color ? {backgroundColor: tag.color, color: 'hsl(var(--secondary-foreground))'} : {}}>{tag.name}</Badge>)}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-10 flex flex-col items-center justify-center h-full">
                <ListChecks className="h-12 w-12 text-muted-foreground/50 mb-3"/>
                <p>Aucune tâche liée à ce chapitre pour le moment.</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Objectives Tab */}
        <TabsContent value="objectives" className="flex-grow flex flex-col overflow-hidden space-y-3 p-1">
          <div className="flex justify-end mb-2 shrink-0">
             <AddChapterObjectiveModal
                chapterId={chapter.id}
                userId={userId}
                availableTags={availableTags}
                objectiveDate={today_yyyy_mm_dd}
                isOpen={isAddObjectiveModalOpen}
                onOpenChange={setIsAddObjectiveModalOpen}
                onObjectiveAdded={handleGenericSuccess}
            />
          </div>
          <ScrollArea className="flex-grow custom-scrollbar pr-2 -mr-2">
            {objectives.length > 0 ? (
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
            ) : (
               <div className="text-sm text-muted-foreground text-center py-10 flex flex-col items-center justify-center h-full">
                  <TargetIcon className="h-12 w-12 text-muted-foreground/50 mb-3"/>
                  <p>Aucun objectif lié à ce chapitre.</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Notes (Brain Dump) Tab */}
        <TabsContent value="notes" className="flex-grow flex flex-col overflow-hidden space-y-3 p-1">
          <div className="flex justify-end mb-2 shrink-0">
            <AddChapterBrainDumpNote
                chapterId={chapter.id}
                userId={userId}
                availableTags={availableTags}
                isOpen={isAddBrainDumpModalOpen}
                onOpenChange={setIsAddBrainDumpModalOpen}
                onNoteAdded={handleGenericSuccess}
            />
          </div>
          <ScrollArea className="flex-grow custom-scrollbar pr-2 -mr-2">
            {brainDumps.length > 0 ? (
               <div className="space-y-2">
                {brainDumps.map(note => {
                  const statusConfig = statusConfigDefinition[note.status as keyof typeof statusConfigDefinition] || statusConfigDefinition.captured;
                  const StatusIcon = statusConfig.icon;
                  return (
                    <Card key={note.id} className={cn("p-3 text-sm border-l-4", statusConfig.colorClasses.border)}>
                       <div className="flex justify-between items-center mb-1">
                         <Badge variant="outline" className={cn("text-xs font-medium border-none", statusConfig.colorClasses.badgeBg, statusConfig.colorClasses.badgeText)}>
                           <StatusIcon className={cn("mr-1.5 h-3.5 w-3.5", statusConfig.colorClasses.iconText)} />
                           {statusConfig.label}
                         </Badge>
                         <span className="text-xs text-muted-foreground">{format(parseISO(note.created_at), "d MMM yy", { locale: fr })}</span>
                       </div>
                      <p className="font-medium whitespace-pre-wrap mb-1">{note.text}</p>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-1">
                          {note.tags?.map(tag => <Badge key={tag.id} variant="secondary" className="text-xs" style={tag.color ? {backgroundColor: tag.color, color: 'hsl(var(--secondary-foreground))'} : {}}>{tag.name}</Badge>)}
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-10 flex flex-col items-center justify-center h-full">
                  <NotebookText className="h-12 w-12 text-muted-foreground/50 mb-3"/>
                  <p>Aucune note du vide-cerveau liée à ce chapitre.</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Sources Tab */}
        <TabsContent value="sources" className="flex-grow flex flex-col overflow-hidden space-y-3 p-1">
           <div className="flex justify-end mb-2 shrink-0">
            <ManageChapterSources
                chapterId={chapter.id}
                userId={userId}
                allUserSources={allUserSources}
                initiallyLinkedSourceIds={new Set(linkedSources.map(s => s.id))}
                isOpen={isManageSourcesModalOpen}
                onOpenChange={setIsManageSourcesModalOpen}
                onAssociationsUpdated={handleGenericSuccess}
            />
          </div>
          <ScrollArea className="flex-grow custom-scrollbar pr-2 -mr-2">
            {linkedSources.length > 0 ? (
              <div className="space-y-2">
                {linkedSources.map(source => (
                  <Card key={source.id} className="p-3 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <SourceTypeIcon type={source.type} className="h-4 w-4 text-primary" />
                        <p className="font-medium flex-grow truncate" title={source.title}>{source.title}</p>
                        <Badge variant="outline" className="text-xs">{sourceTypeText(source.type)}</Badge>
                    </div>
                     <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-1">
                        {source.tags?.map(tag => <Badge key={tag.id} variant="secondary" className="text-xs" style={tag.color ? {backgroundColor: tag.color, color: 'hsl(var(--secondary-foreground))'} : {}}>{tag.name}</Badge>)}
                    </div>
                    {source.source_link_or_path && (source.source_link_or_path.startsWith('http')) ? (
                        <Link href={source.source_link_or_path} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 block truncate">
                            {source.source_link_or_path}
                        </Link>
                    ) : source.source_link_or_path ? (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{source.source_link_or_path}</p>
                    ) : null}
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-10 flex flex-col items-center justify-center h-full">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-3"/>
                  <p>Aucune source associée à ce chapitre.</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Pomodoros Tab */}
        <TabsContent value="pomodoros" className="flex-grow flex flex-col overflow-hidden space-y-3 p-1">
           <div className="flex justify-end mb-2 shrink-0">
            <Button size="sm" asChild>
                <Link href={`/pomodoro?chapterId=${chapter.id}&chapterName=${encodeURIComponent(chapter.name)}`}><TimerIcon className="mr-2 h-4 w-4"/>Enregistrer un Pomodoro</Link>
            </Button>
           </div>
           <ScrollArea className="flex-grow custom-scrollbar pr-2 -mr-2">
            {pomodoros.length > 0 ? (
                <div className="space-y-2">
                    {pomodoros.map(pomo => (
                    <Card key={pomo.id} className="p-3 text-sm">
                        <p className="font-medium">{pomo.duration} min - {pomo.start_time ? format(parseISO(pomo.start_time), "d MMM yyyy, HH:mm", {locale: fr}) : 'Date inconnue'}</p>
                        {pomo.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{pomo.notes}</p>}
                        <div className="text-xs text-muted-foreground mt-1 flex flex-col gap-0.5">
                            {pomo.tasks && <span className="flex items-center gap-1"><ListChecks className="h-3 w-3"/> Tâche: {pomo.tasks.text.substring(0,30)}...</span>}
                            {pomo.daily_objectives && <span className="flex items-center gap-1"><TargetIcon className="h-3 w-3"/> Objectif: {pomo.daily_objectives.text.substring(0,30)}...</span>}
                        </div>
                    </Card>
                    ))}
                </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-10 flex flex-col items-center justify-center h-full">
                  <TimerIcon className="h-12 w-12 text-muted-foreground/50 mb-3"/>
                  <p>Aucune session Pomodoro enregistrée pour ce chapitre.</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments" className="flex-grow flex flex-col overflow-hidden p-1">
          <SupervisorCommentsSection chapterId={chapter.id} userId={userId} initialComments={chapter.supervisor_comments || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChapterDetailClientView;

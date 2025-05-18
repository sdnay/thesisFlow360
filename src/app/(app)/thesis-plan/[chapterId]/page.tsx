
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
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
import { ChevronRight, EllipsisVertical, PlusCircle, ListChecks, Target as TargetIcon, NotebookText, FileText, TimerIcon, MessageSquare } from 'lucide-react';
import type { Chapter, Task, DailyObjective, PomodoroSession, BrainDumpEntry, Source, Tag } from '@/types'; // Assurez-vous que les types sont corrects
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Fonction pour calculer la progression (peut être déplacée dans un utilitaire)
function calculateChapterProgress(tasks: Task[] | undefined): number {
  if (!tasks || tasks.length === 0) {
    return 0;
  }
  const completedTasks = tasks.filter(task => task.completed).length;
  return Math.round((completedTasks / tasks.length) * 100);
}

const taskTypeLabels: Record<TaskType, string> = { urgent: "Urgent", important: "Important", reading: "Lecture", chatgpt: "ChatGPT", secondary: "Secondaire" };
const taskTypeColors: Record<TaskType, string> = {
  urgent: "border-red-500 bg-red-50 text-red-700",
  important: "border-orange-500 bg-orange-50 text-orange-700",
  reading: "border-green-500 bg-green-50 text-green-700",
  chatgpt: "border-blue-500 bg-blue-50 text-blue-700",
  secondary: "border-gray-500 bg-gray-50 text-gray-700",
};


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
    // Redirection gérée par le middleware, mais sécurité supplémentaire
    return notFound();
  }

  const { data: chapter, error: chapterError } = await supabase
    .from('chapters')
    .select('*, tags:chapter_tags(tags(id, name, color))')
    .eq('id', params.chapterId)
    .eq('user_id', user.id)
    .single();

  if (chapterError || !chapter) {
    console.error("Erreur récupération chapitre:", chapterError);
    notFound();
  }

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*, tags:task_tags(tags(id, name, color))')
    .eq('chapter_id', params.chapterId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // TODO: Récupérer aussi les objectifs, pomodoros, notes, sources liés
  const { data: objectives, error: objectivesError } = await supabase
    .from('daily_objectives')
    .select('*, tags:daily_objective_tags(tags(id, name, color))')
    .eq('chapter_id', params.chapterId)
    .eq('user_id', user.id)
    .order('objective_date', { ascending: false });

  const chapterProgress = calculateChapterProgress(tasks || []);

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      {/* Fil d'Ariane */}
      <div className="text-sm text-muted-foreground flex items-center">
        <Link href="/thesis-plan" className="hover:underline">Plan de Thèse</Link>
        <ChevronRight className="h-4 w-4 mx-1" />
        <span className="font-medium text-foreground">{chapter.name}</span>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="flex flex-row justify-between items-start">
          <div>
            <CardTitle className="text-2xl md:text-3xl font-semibold">{chapter.name}</CardTitle>
            <CardDescription className="mt-1 flex items-center gap-2">
              <Badge variant={chapter.status === "Terminé" ? "default" : "secondary"} className={cn(chapter.status === "Terminé" && "bg-green-600 text-white")}>
                {chapter.status}
              </Badge>
              {chapter.tags && chapter.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {chapter.tags.slice(0,3).map((tagEntry: any) => (
                    <Badge key={tagEntry.tags.id} variant="outline" style={tagEntry.tags.color ? { borderColor: tagEntry.tags.color, color: tagEntry.tags.color } : {}}>
                      {tagEntry.tags.name}
                    </Badge>
                  ))}
                  {chapter.tags.length > 3 && <Badge variant="outline">+{chapter.tags.length-3}</Badge>}
                </div>
              )}
            </CardDescription>
            <div className="mt-3 w-full">
              <div className="flex justify-between text-sm text-muted-foreground mb-1">
                <span>Progression</span>
                <span>{chapterProgress}%</span>
              </div>
              <Progress value={chapterProgress} className="h-3" />
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <EllipsisVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Éditer Chapitre</DropdownMenuItem>
              <DropdownMenuItem>Gérer les Tags</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive">Supprimer Chapitre</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
      </Card>

      <Tabs defaultValue="tasks" className="flex-grow flex flex-col">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 mb-4">
          <TabsTrigger value="tasks"><ListChecks className="mr-1 h-4 w-4 sm:hidden md:inline-block"/>Tâches</TabsTrigger>
          <TabsTrigger value="objectives"><TargetIcon className="mr-1 h-4 w-4 sm:hidden md:inline-block"/>Objectifs</TabsTrigger>
          <TabsTrigger value="notes"><NotebookText className="mr-1 h-4 w-4 sm:hidden md:inline-block"/>Notes</TabsTrigger>
          <TabsTrigger value="sources"><FileText className="mr-1 h-4 w-4 sm:hidden md:inline-block"/>Sources</TabsTrigger>
          <TabsTrigger value="pomodoros"><TimerIcon className="mr-1 h-4 w-4 sm:hidden md:inline-block"/>Pomodoros</TabsTrigger>
          <TabsTrigger value="comments"><MessageSquare className="mr-1 h-4 w-4 sm:hidden md:inline-block"/>Commentaires</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="flex-grow overflow-y-auto space-y-3 custom-scrollbar p-1">
          <div className="flex justify-end mb-3">
            <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Ajouter Tâche</Button>
          </div>
          {tasks && tasks.length > 0 ? (
            tasks.map((task) => (
              <Card key={task.id} className={cn("p-3 text-sm border-l-4", taskTypeColors[task.type]?.border, task.completed && "opacity-60")}>
                <div className="flex items-start gap-2">
                  <Checkbox id={`task-${task.id}`} checked={task.completed} className="mt-1" />
                  <div className="flex-grow">
                    <label htmlFor={`task-${task.id}`} className={cn("font-medium", task.completed && "line-through")}>{task.text}</label>
                    <div className="text-xs text-muted-foreground mt-1">
                      <Badge variant="outline" className={cn(taskTypeColors[task.type]?.badgeBg, taskTypeColors[task.type]?.badgeText, taskTypeColors[task.type]?.border.replace('-l-','-'))}>{taskTypeLabels[task.type]}</Badge>
                      {task.tags && task.tags.length > 0 && task.tags.map((tagEntry: any) => (
                        <Badge key={tagEntry.tags.id} variant="secondary" className="ml-1">{tagEntry.tags.name}</Badge>
                      ))}
                    </div>
                  </div>
                  {/* Boutons d'action pour la tâche (éditer, supprimer) à ajouter ici */}
                </div>
              </Card>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune tâche liée à ce chapitre.</p>
          )}
        </TabsContent>

        <TabsContent value="objectives" className="flex-grow overflow-y-auto space-y-3 custom-scrollbar p-1">
           <div className="flex justify-end mb-3">
            <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Ajouter Objectif</Button>
          </div>
          {objectives && objectives.length > 0 ? (
            objectives.map((obj) => (
              <Card key={obj.id} className={cn("p-3 text-sm", obj.completed && "opacity-60")}>
                <div className="flex items-start gap-2">
                  <Checkbox id={`obj-${obj.id}`} checked={obj.completed} className="mt-1" />
                   <div className="flex-grow">
                    <label htmlFor={`obj-${obj.id}`} className={cn("font-medium", obj.completed && "line-through")}>{obj.text}</label>
                    <p className="text-xs text-muted-foreground">Pour le: {format(parseISO(obj.objective_date), "d MMM yyyy", {locale: fr})}</p>
                     {obj.tags && obj.tags.length > 0 && obj.tags.map((tagEntry: any) => (
                        <Badge key={tagEntry.tags.id} variant="secondary" className="ml-1 text-xs">{tagEntry.tags.name}</Badge>
                      ))}
                  </div>
                </div>
              </Card>
            ))
          ) : (
             <p className="text-sm text-muted-foreground text-center py-4">Aucun objectif lié à ce chapitre.</p>
          )}
        </TabsContent>
        
        <TabsContent value="notes" className="flex-grow overflow-y-auto custom-scrollbar p-1">
           <div className="flex justify-end mb-3"> <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Ajouter Note</Button> </div>
          <p className="text-sm text-muted-foreground text-center py-4">Aucune note du vide-cerveau liée à ce chapitre pour le moment.</p>
        </TabsContent>
        <TabsContent value="sources" className="flex-grow overflow-y-auto custom-scrollbar p-1">
           <div className="flex justify-end mb-3"> <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Lier Source</Button> </div>
          <p className="text-sm text-muted-foreground text-center py-4">Aucune source liée à ce chapitre pour le moment.</p>
        </TabsContent>
        <TabsContent value="pomodoros" className="flex-grow overflow-y-auto custom-scrollbar p-1">
          <p className="text-sm text-muted-foreground text-center py-4">Aucune session Pomodoro enregistrée pour ce chapitre.</p>
        </TabsContent>
        <TabsContent value="comments" className="flex-grow overflow-y-auto space-y-3 custom-scrollbar p-1">
          {chapter.supervisor_comments && chapter.supervisor_comments.length > 0 ? (
            chapter.supervisor_comments.map((comment, index) => (
              <Card key={index} className="p-3 text-sm bg-muted/50"><p className="whitespace-pre-wrap">{comment}</p></Card>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun commentaire de superviseur pour ce chapitre.</p>
          )}
          <div className="pt-4 border-t">
            <Textarea placeholder="Ajouter un nouveau commentaire..." rows={3} className="text-sm mb-2" />
            <Button size="sm">Enregistrer Commentaire</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

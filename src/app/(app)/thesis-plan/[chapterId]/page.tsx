
import { createServerClient, type CookieOptions } from '@supabase/ssr';
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
import { ChevronRight, ListTree, Info, Edit, Tags as TagsIcon, PlusCircle, TimerIcon, MessageSquare, NotebookText, FileText, Target as TargetIcon, ListChecks, EllipsisVertical } from 'lucide-react';
import type { Chapter, Task, DailyObjective, PomodoroSession, BrainDumpEntry, Source, Tag } from '@/types';
import { format, parseISO, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

import ChapterDetailClientView from '@/components/thesis/chapter-detail-components/ChapterDetailClientView';

// Helper function (consider moving to a utils file)
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
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // This should ideally be caught by middleware, but as a fallback.
    // For Server Components, you might redirect or show a specific UI.
    // For now, we'll let it proceed, and the Client Component part can handle it.
    // Or, redirect('/login'); if you prefer server-side redirect for unauthenticated access to this page.
    console.warn("[ChapterDetailPage] User not authenticated. Data fetching will be limited or fail for RLS.");
    // Depending on your RLS, fetching data without a user might return empty or error.
    // It's better if middleware ensures user is logged in before reaching here.
  }
  const userId = user?.id; // userId can be undefined if no user

  const chapterId = params.chapterId;

  // Fetch all data in parallel
  const [
    chapterRes,
    tasksRes,
    objectivesRes,
    brainDumpsRes,
    linkedSourcesRes,
    allUserSourcesRes,
    availableTagsRes,
    pomodorosRes
  ] = await Promise.all([
    userId ? supabase.from('chapters').select('*, tags:chapter_tags(tags(id, name, color))').eq('id', chapterId).eq('user_id', userId).single() : Promise.resolve({ data: null, error: { message: "User not authenticated for chapter fetch" } as any }),
    userId ? supabase.from('tasks').select('*, tags:task_tags(tags(id, name, color))').eq('chapter_id', chapterId).eq('user_id', userId).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    userId ? supabase.from('daily_objectives').select('*, tags:daily_objective_tags(tags(id, name, color))').eq('chapter_id', chapterId).eq('user_id', userId).order('objective_date', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    userId ? supabase.from('brain_dump_entries').select('*, tags:brain_dump_entry_tags(tags(id, name, color))').eq('chapter_id', chapterId).eq('user_id', userId).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    userId ? supabase.from('chapter_sources').select('sources(*, tags:source_tags(tags(id, name, color)))').eq('chapter_id', chapterId).eq('user_id', userId) : Promise.resolve({ data: [], error: null }),
    userId ? supabase.from('sources').select('*').eq('user_id', userId).order('title') : Promise.resolve({ data: [], error: null }),
    userId ? supabase.from('tags').select('*').eq('user_id', userId).order('name') : Promise.resolve({ data: [], error: null }),
    userId ? supabase.from('pomodoro_sessions').select('*, tasks(id,text), daily_objectives(id,text), chapters(id,name)').eq('chapter_id', chapterId).eq('user_id', userId).order('start_time', { ascending: false }) : Promise.resolve({ data: [], error: null })
  ]);

  if (chapterRes.error || !chapterRes.data) {
    console.error("Erreur récupération chapitre ou chapitre non trouvé:", chapterRes.error);
    notFound();
  }
  
  // Type assertion helper or be careful with direct mapping
  const chapter: Chapter = { 
    ...chapterRes.data, 
    tags: chapterRes.data.tags?.map((t: any) => t.tags as Tag) || [],
    // Ensure other relational fields are correctly typed or initialized if potentially missing
    tasks: [], // Will be populated by tasksRes
    daily_objectives: [], // Will be populated by objectivesRes
    brain_dump_entries: [], // Will be populated by brainDumpsRes
    sources: [], // Will be populated by linkedSourcesRes
    pomodoro_sessions: [] // Will be populated by pomodorosRes
  };
  
  const tasks: Task[] = (tasksRes.data || []).map((t: any) => ({ ...t, tags: t.tags?.map((tg: any) => tg.tags as Tag) || [] }));
  const objectives: DailyObjective[] = (objectivesRes.data || []).map((o: any) => ({ ...o, tags: o.tags?.map((tg: any) => tg.tags as Tag) || [] }));
  const brainDumps: BrainDumpEntry[] = (brainDumpsRes.data || []).map((b: any) => ({ ...b, tags: b.tags?.map((tg: any) => tg.tags as Tag) || [] }));
  
  // Ensure linkedSources are correctly typed and mapped
  const linkedSources: Source[] = (linkedSourcesRes.data || []).map((cs: any) => {
      if (!cs.sources) return null; // Handle case where sources might be null
      return {
          ...cs.sources,
          tags: cs.sources.tags?.map((t: any) => t.tags as Tag) || []
      };
  }).filter(Boolean) as Source[]; // Filter out nulls and assert type

  const allUserSources: Source[] = allUserSourcesRes.data || [];
  const availableTags: Tag[] = availableTagsRes.data || [];
  const pomodoros: PomodoroSession[] = (pomodorosRes.data || []).map((p: any) => ({
      ...p,
      // Ensure nested relational data is correctly structured if needed immediately
      // or handle it within the PomodoroLogItem component
  }));

  // Populate the chapter object with its related items
  chapter.tasks = tasks;
  chapter.daily_objectives = objectives;
  chapter.brain_dump_entries = brainDumps;
  chapter.sources = linkedSources; // Assuming linkedSources are the chapter's sources
  chapter.pomodoro_sessions = pomodoros;


  const chapterProgress = calculateChapterProgress(tasks); // Calculated based on tasks linked to this chapter

  if (!userId) { // If somehow user is not authenticated, show a message or redirect
     return (
      <div className="p-4 md:p-6 space-y-6 h-full flex flex-col items-center justify-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <CardTitle>Accès non autorisé</CardTitle>
        <CardDescription>Vous devez être connecté pour voir cette page.</CardDescription>
        <Button asChild><Link href="/login">Se connecter</Link></Button>
      </div>
    );
  }

  return (
    <ChapterDetailClientView
      initialChapter={chapter}
      initialTasks={tasks}
      initialObjectives={objectives}
      initialBrainDumps={brainDumps}
      initialLinkedSources={linkedSources}
      initialPomodoros={pomodoros}
      initialChapterProgress={chapterProgress}
      userId={userId}
      availableTags={availableTags}
      allUserSources={allUserSources}
    />
  );
}

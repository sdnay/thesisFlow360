
"use client";

import type { FC } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Edit3, Info, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Chapter } from '@/types';

interface CompactChapterCardProps {
  chapter: Chapter;
  onEditModalOpen: (chapter: Chapter) => void;
}

const CompactChapterCard: FC<CompactChapterCardProps> = ({ chapter, onEditModalOpen }) => {
  const commentsPreview = chapter.supervisor_comments?.slice(-1)[0] || null;

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-150 flex flex-col bg-card h-full">
      <CardHeader className="pb-2 pt-3 px-3 md:px-4">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-sm md:text-base font-semibold leading-tight line-clamp-2" title={chapter.name}>
            {chapter.name}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={() => onEditModalOpen(chapter)} aria-label="Modifier le chapitre" className="h-7 w-7 text-muted-foreground hover:text-primary shrink-0">
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <CardDescription className="text-xs pt-0.5">
          <Badge variant={chapter.progress === 100 ? "default" : "secondary"} className={cn(chapter.progress === 100 ? "bg-green-500 hover:bg-green-600 text-white dark:text-background" : "")}>
            {chapter.status || 'N/A'}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow py-2 px-3 md:px-4 space-y-2">
        <Progress value={chapter.progress || 0} className="w-full h-2" aria-label={`Progression ${chapter.progress || 0}%`} />
        <p className="text-xs text-muted-foreground text-right">{chapter.progress || 0}%</p>
        {commentsPreview && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mt-1.5 text-xs text-muted-foreground flex items-start gap-1.5 border-t pt-1.5">
                  <Info className="h-3.5 w-3.5 shrink-0 text-primary/70 mt-0.5" />
                  <p className="line-clamp-2 italic">{commentsPreview}</p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="max-w-xs whitespace-pre-wrap">
                <p className="font-semibold mb-1">Dernier commentaire :</p>
                <p>{commentsPreview}</p>
                {chapter.supervisor_comments && chapter.supervisor_comments.length > 1 && (
                   <p className="text-xs text-muted-foreground mt-1">(et {chapter.supervisor_comments.length -1} autre(s))</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </CardContent>
      <CardFooter className="pt-2 pb-3 px-3 md:px-4 border-t mt-auto">
        <Button asChild variant="outline" size="xs" className="w-full text-xs">
            <Link href="/add-chapter"><Layers className="mr-1.5 h-3 w-3" /> Gérer Plan</Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

export default CompactChapterCard;

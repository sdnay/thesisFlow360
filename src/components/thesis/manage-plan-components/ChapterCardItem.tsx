
"use client";

import type { FC } from 'react';
import type { Chapter } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Edit, Trash2, MessageSquare, MoreVertical, TagsIcon, Eye, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChapterCardItemProps {
  chapter: Chapter;
  onEditRequest: (chapter: Chapter) => void;
  onDeleteRequest: (chapterId: string) => void;
  onCommentManagerRequest: (chapter: Chapter) => void;
  isLoadingActionsForId: string | null;
  onViewLinkedItemsRequest: (chapter: Chapter) => void;
  onManageTagsRequest: (chapter: Chapter) => void;
}

const ChapterCardItem: FC<ChapterCardItemProps> = ({
  chapter,
  onEditRequest,
  onDeleteRequest,
  onCommentManagerRequest,
  isLoadingActionsForId,
  onViewLinkedItemsRequest,
  onManageTagsRequest,
}) => {
  const lastComment = chapter.supervisor_comments && chapter.supervisor_comments.length > 0
    ? chapter.supervisor_comments[chapter.supervisor_comments.length - 1]
    : null;
  const isLoading = isLoadingActionsForId === chapter.id;

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col h-full bg-card border-l-4 border-primary/30">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-grow min-w-0">
            <CardTitle className="text-base md:text-lg font-semibold leading-tight line-clamp-3" title={chapter.name}>
              {chapter.name}
            </CardTitle>
            <CardDescription className="text-xs md:text-sm pt-1">
                <Badge variant={chapter.progress === 100 ? "default" : "secondary"} className={cn("font-medium", chapter.progress === 100 ? "bg-green-500 hover:bg-green-600 text-white dark:text-background" : "")}>
                    {chapter.status || 'Non défini'}
                </Badge>
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary" disabled={isLoading} aria-label="Options du chapitre">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => onEditRequest(chapter)} disabled={isLoading} className="cursor-pointer">
                <Edit className="mr-2 h-4 w-4" />
                Modifier le Chapitre
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onManageTagsRequest(chapter)} disabled={isLoading} className="cursor-pointer">
                <TagsIcon className="mr-2 h-4 w-4" />
                Gérer les Tags
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewLinkedItemsRequest(chapter)} disabled={isLoading} className="cursor-pointer">
                <Eye className="mr-2 h-4 w-4" />
                Voir Éléments Liés
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDeleteRequest(chapter.id)}
                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                disabled={isLoading}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer le Chapitre
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="flex-grow py-2 px-4 space-y-3">
        <div>
            <div className="mb-1 text-xs md:text-sm font-medium text-muted-foreground">Progression : {chapter.progress || 0}%</div>
            <Progress value={chapter.progress || 0} className="w-full h-2 md:h-2.5" aria-label={`Progression ${chapter.progress || 0}%`} />
        </div>
        
        {chapter.tags && chapter.tags.length > 0 && (
          <div className="pt-2">
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Tags :</h4>
            <div className="flex flex-wrap gap-1">
              {chapter.tags.slice(0, 3).map(tag => (
                <Badge key={tag.id} variant="secondary" style={tag.color ? { backgroundColor: tag.color, color: 'hsl(var(--secondary-foreground))' } : {}} className="text-xs">
                  {tag.name}
                </Badge>
              ))}
              {chapter.tags.length > 3 && <Badge variant="outline" className="text-xs">+{chapter.tags.length - 3} autre(s)</Badge>}
            </div>
          </div>
        )}

        {lastComment && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between mb-0.5">
              <h4 className="text-xs font-semibold text-muted-foreground">Dernier Commentaire :</h4>
            </div>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger className="w-full text-left">
                  <p className="text-xs text-muted-foreground italic line-clamp-2">{lastComment}</p>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" className="max-w-xs whitespace-pre-wrap bg-popover text-popover-foreground p-2 rounded-md shadow-lg border">
                  <p>{lastComment}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-3 pb-4 px-4 border-t mt-auto">
        <Button variant="outline" size="sm" onClick={() => onCommentManagerRequest(chapter)} disabled={isLoading} className="w-full text-xs text-muted-foreground hover:text-primary hover:bg-primary/5">
          <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
          Commentaires ({chapter.supervisor_comments?.length || 0})
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ChapterCardItem;


"use client";

import type { FC } from 'react';
import type { DailyObjective } from '@/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Edit3, Trash2, Link as LinkIconLucide } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DailyObjectiveItemProps {
  objective: DailyObjective;
  onToggle: (id: string, completed: boolean, objective_date: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (objective: DailyObjective) => void;
  isLoading: boolean;
  isPastObjective?: boolean;
}

const DailyObjectiveItem: FC<DailyObjectiveItemProps> = ({ objective, onToggle, onDelete, onEdit, isLoading, isPastObjective = false }) => {
  return (
    <div className={cn(
      "flex items-start sm:items-center justify-between p-3.5 rounded-lg border transition-colors duration-150 group",
      objective.completed
        ? "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/50"
        : "bg-card hover:bg-muted/30 dark:hover:bg-muted/20",
      isPastObjective && !objective.completed && "bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40"
    )}>
      <div className="flex items-start sm:items-center gap-3 flex-grow min-w-0">
        <Checkbox
          id={`obj-${objective.id}`}
          checked={objective.completed}
          onCheckedChange={(checked) => onToggle(objective.id, !!checked, objective.objective_date)}
          aria-label={objective.completed ? 'Marquer comme non terminé' : 'Marquer comme terminé'}
          disabled={isLoading}
          className={cn(
            "mt-1 sm:mt-0 h-5 w-5 shrink-0",
            objective.completed
              ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-700"
              : (isPastObjective ? "border-amber-500 data-[state=checked]:bg-amber-600" : "border-primary")
          )} />
        <div className="flex-grow space-y-1">
          <label
            htmlFor={`obj-${objective.id}`}
            className={cn(
              "text-sm font-medium leading-normal cursor-pointer break-words w-full",
              objective.completed && "line-through text-muted-foreground"
            )}>{objective.text}</label>
          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
            {isPastObjective && (<span>Date: {format(parseISO(objective.objective_date), "d MMM yy", { locale: fr })}</span>)}
            {objective.chapters && (
              <span className="flex items-center gap-1">
                <LinkIconLucide className="h-3 w-3" /> {objective.chapters.name}
              </span>
            )}
          </div>
          {objective.tags && objective.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {objective.tags.slice(0, 3).map(tag => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="text-xs py-0"
                  style={tag.color ? { borderColor: tag.color, color: tag.color } : {}}
                >
                  {tag.name}
                </Badge>
              ))}
              {objective.tags.length > 3 && <Badge variant="outline" className="text-xs py-0">+{objective.tags.length - 3}</Badge>}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        {!isPastObjective && (
          <Button variant="ghost" size="icon" onClick={() => onEdit(objective)} aria-label="Modifier" disabled={isLoading} className="h-8 w-8 opacity-50 group-hover:opacity-100 text-muted-foreground hover:text-primary">
            <Edit3 className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={() => onDelete(objective.id)} aria-label="Supprimer" className="text-destructive/70 hover:text-destructive h-8 w-8 opacity-50 group-hover:opacity-100" disabled={isLoading}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default DailyObjectiveItem;

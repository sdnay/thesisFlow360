
"use client";

import type { FC } from 'react';
import type { PomodoroSession } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2, ListChecks, Target as TargetIcon, ListTree } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PomodoroLogItemProps {
  session: PomodoroSession;
  onDelete: (id: string) => Promise<void>;
  isLoading: boolean;
}

const PomodoroLogItem: FC<PomodoroLogItemProps> = ({ session, onDelete, isLoading }) => {
  return (
    <li className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3.5 border rounded-lg bg-card hover:bg-muted/30 dark:hover:bg-muted/20 transition-colors shadow-sm">
      <div className="flex-grow mb-2 sm:mb-0 space-y-1.5">
        <p className="text-sm font-medium">
          Session de <span className="text-primary font-semibold">{session.duration} min</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(session.start_time), "eeee d MMMM yyyy 'à' HH:mm", { locale: fr })}
        </p>
        {session.notes && (
          <div className="mt-1.5 pt-1.5 border-t border-border/70">
            <h4 className="text-xs font-semibold text-muted-foreground mb-0.5">Notes :</h4>
            <p className="text-xs text-foreground whitespace-pre-wrap">{session.notes}</p>
          </div>
        )}
        {(session.tasks || session.daily_objectives || session.chapters) && (
           <div className="text-xs text-muted-foreground mt-1.5 pt-1.5 border-t border-border/70 flex flex-col gap-0.5">
            {session.tasks && (
              <span className="flex items-center gap-1.5">
                <ListChecks className="h-3.5 w-3.5 shrink-0" />
                <span>Tâche : {session.tasks.text.substring(0, 40)}{session.tasks.text.length > 40 ? '...' : ''}</span>
              </span>
            )}
            {session.daily_objectives && (
              <span className="flex items-center gap-1.5">
                <TargetIcon className="h-3.5 w-3.5 shrink-0" />
                <span>Objectif : {session.daily_objectives.text.substring(0, 40)}{session.daily_objectives.text.length > 40 ? '...' : ''}</span>
              </span>
            )}
            {session.chapters && (
              <span className="flex items-center gap-1.5">
                <ListTree className="h-3.5 w-3.5 shrink-0" />
                <span>Chapitre : {session.chapters.name.substring(0, 40)}{session.chapters.name.length > 40 ? '...' : ''}</span>
              </span>
            )}
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(session.id)}
        aria-label="Supprimer la session"
        className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 h-8 w-8 self-start sm:self-center shrink-0"
        disabled={isLoading}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
};

export default PomodoroLogItem;

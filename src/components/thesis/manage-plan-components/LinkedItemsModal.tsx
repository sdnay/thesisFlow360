
"use client";

import type { FC } from 'react';
import type { Chapter, Task, DailyObjective } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ListChecks, Target as TargetIconLucide } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';


interface LinkedItemsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  chapter: Chapter | null;
  tasks: Task[];
  objectives: DailyObjective[];
  isLoadingLinkedItems: boolean;
}

const LinkedItemsModal: FC<LinkedItemsModalProps> = ({
  isOpen,
  onOpenChange,
  chapter,
  tasks,
  objectives,
  isLoadingLinkedItems,
}) => {
  if (!chapter) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Éléments Liés à "{chapter.name}"</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] py-4 custom-scrollbar pr-3 -mr-3">
            <div className="space-y-4">
                <div>
                    <h3 className="text-md font-semibold mb-2 flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-primary" /> Tâches ({tasks.length})
                    </h3>
                    {isLoadingLinkedItems ? (
                        <p className="text-sm text-muted-foreground">Chargement des tâches...</p>
                    ) : tasks.length > 0 ? (
                    <ul className="space-y-1.5 text-sm list-disc pl-5">
                        {tasks.map(task => (
                        <li key={task.id} className={cn("leading-normal", task.completed && "line-through text-muted-foreground")}>
                            {task.text}
                        </li>
                        ))}
                    </ul>
                    ) : (
                    <p className="text-sm text-muted-foreground">Aucune tâche liée à ce chapitre.</p>
                    )}
                </div>
                <div className="pt-3 border-t">
                    <h3 className="text-md font-semibold mb-2 flex items-center gap-2">
                    <TargetIconLucide className="h-5 w-5 text-primary" /> Objectifs du Jour ({objectives.length})
                    </h3>
                    {isLoadingLinkedItems ? (
                         <p className="text-sm text-muted-foreground">Chargement des objectifs...</p>
                    ) : objectives.length > 0 ? (
                    <ul className="space-y-1.5 text-sm list-disc pl-5">
                        {objectives.map(obj => (
                        <li key={obj.id} className={cn("leading-normal", obj.completed && "line-through text-muted-foreground")}>
                            {obj.text} (pour le {format(parseISO(obj.objective_date), "d MMM yy", { locale: fr })})
                        </li>
                        ))}
                    </ul>
                    ) : (
                    <p className="text-sm text-muted-foreground">Aucun objectif du jour lié à ce chapitre.</p>
                    )}
                </div>
            </div>
        </ScrollArea>
        <DialogFooter className="mt-2">
          <DialogClose asChild>
            <Button variant="outline">Fermer</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LinkedItemsModal;

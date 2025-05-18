
"use client";

import type { FC } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { Task, TaskType, Chapter, Tag } from '@/types';
import { Trash2, Edit2, Timer, EllipsisVertical, Link as LinkIconLucide } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandList, CommandItem } from '@/components/ui/command';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import TaskTypeSelector from './TaskTypeSelector'; // Adjusted import path

const taskTypeLabels: Record<TaskType, string> = { urgent: "Urgent", important: "Important", reading: "Lecture", chatgpt: "ChatGPT", secondary: "Secondaire" };
const taskTypeClasses: Record<TaskType, { border: string; badgeBg: string; badgeText: string; checkbox: string }> = {
  urgent: { border: "border-red-500 dark:border-red-600", badgeBg: "bg-red-100 dark:bg-red-900/40", badgeText: "text-red-700 dark:text-red-300", checkbox: "border-red-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-600 dark:border-red-500 dark:data-[state=checked]:bg-red-600 dark:data-[state=checked]:border-red-700" },
  important: { border: "border-orange-500 dark:border-orange-600", badgeBg: "bg-orange-100 dark:bg-orange-900/40", badgeText: "text-orange-700 dark:text-orange-300", checkbox: "border-orange-400 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-600 dark:border-orange-500 dark:data-[state=checked]:bg-orange-600 dark:data-[state=checked]:border-orange-700" },
  reading: { border: "border-green-500 dark:border-green-600", badgeBg: "bg-green-100 dark:bg-green-900/40", badgeText: "text-green-700 dark:text-green-300", checkbox: "border-green-400 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-600 dark:border-green-500 dark:data-[state=checked]:bg-green-600 dark:data-[state=checked]:border-green-700" },
  chatgpt: { border: "border-blue-500 dark:border-blue-600", badgeBg: "bg-blue-100 dark:bg-blue-900/40", badgeText: "text-blue-700 dark:text-blue-300", checkbox: "border-blue-400 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-600 dark:border-blue-500 dark:data-[state=checked]:bg-blue-600 dark:data-[state=checked]:border-blue-700" },
  secondary: { border: "border-gray-400 dark:border-gray-500", badgeBg: "bg-gray-100 dark:bg-gray-700/40", badgeText: "text-gray-600 dark:text-gray-400", checkbox: "border-gray-400 data-[state=checked]:bg-gray-500 data-[state=checked]:border-gray-600 dark:border-gray-500 dark:data-[state=checked]:bg-gray-600 dark:data-[state=checked]:border-gray-700" },
};

interface TaskItemCardProps {
  task: Task;
  onToggle: (id: string, completed: boolean) => Promise<void>;
  onSetType: (id: string, type: TaskType) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => Promise<void>;
  onStartPomodoro: (task: Task) => void;
  isCurrentItemLoading: boolean;
}

const TaskItemCard: FC<TaskItemCardProps> = ({ task, onToggle, onSetType, onEdit, onDelete, onStartPomodoro, isCurrentItemLoading }) => {
  const typeStyle = taskTypeClasses[task.type] || taskTypeClasses.secondary;

  return (
    <Card className={cn("relative overflow-hidden border-l-4 shadow-sm transition-all duration-150 hover:shadow-md", typeStyle.border, task.completed && "opacity-60 bg-muted/30 dark:bg-muted/20")}>
      <CardContent className="p-3 md:p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <Checkbox
            id={`task-${task.id}`}
            checked={task.completed}
            onCheckedChange={(checked) => onToggle(task.id, !!checked)}
            className={cn("mt-1 h-5 w-5 shrink-0", typeStyle.checkbox)}
            disabled={isCurrentItemLoading}
            aria-label={task.completed ? "Marquer comme non terminée" : "Marquer comme terminée"}
          />
          <div className="flex-grow space-y-1.5 min-w-0">
            <p className={cn("text-base font-medium leading-relaxed break-words", task.completed && "line-through text-muted-foreground")}>
              {task.text}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <Badge variant="outline" className={cn("font-normal py-0.5 px-1.5 h-auto", typeStyle.badgeBg, typeStyle.badgeText, typeStyle.border.replace('-l-', '-'))}>{taskTypeLabels[task.type]}</Badge>
              <span className="text-muted-foreground">Créé : {task.created_at ? format(new Date(task.created_at), "d MMM yy, HH:mm", { locale: fr }) : 'N/A'}</span>
              {task.chapters && (
                <span className="text-muted-foreground flex items-center gap-1">
                  <LinkIconLucide className="h-3 w-3" />
                  Chapitre: {task.chapters.name}
                </span>
              )}
            </div>
            {task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1.5">
                {task.tags.map(tag => (
                  <Badge key={tag.id} variant="secondary" style={tag.color ? { backgroundColor: tag.color, color: 'hsl(var(--secondary-foreground))' } : {}} className="text-xs">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-2 border-t sm:border-none sm:pt-0 mt-auto">
          <TaskTypeSelector selectedType={task.type} onSelectType={(type) => onSetType(task.id, type)} disabled={isCurrentItemLoading} size="sm" buttonClassName="w-full sm:w-auto" />
          <div className="flex gap-1.5 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={() => onStartPomodoro(task)} className="flex-grow sm:flex-grow-0 h-9" disabled={isCurrentItemLoading} title="Démarrer un Pomodoro pour cette tâche">
              <Timer className="mr-1.5 h-4 w-4" /> Pomodoro
            </Button>
             <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9" disabled={isCurrentItemLoading} title="Plus d'actions">
                        <EllipsisVertical className="h-4 w-4"/>
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-40 p-1">
                  <Command>
                    <CommandList>
                      <CommandItem onSelect={() => onEdit(task)} disabled={isCurrentItemLoading} className="cursor-pointer text-sm">
                          <Edit2 className="mr-2 h-4 w-4" /> Modifier
                      </CommandItem>
                      <CommandItem onSelect={() => onDelete(task.id)} disabled={isCurrentItemLoading} className="text-destructive focus:text-destructive cursor-pointer text-sm">
                          <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                      </CommandItem>
                    </CommandList>
                  </Command>
                </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskItemCard;

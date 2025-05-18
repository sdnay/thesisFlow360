
"use client";

import type { FC } from 'react';
import { useState } from 'react';
import type { TaskType } from '@/types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDownIcon as ChevronUpDownIconLucide, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

const taskTypeLabels: Record<TaskType, string> = { urgent: "Urgent", important: "Important", reading: "Lecture", chatgpt: "ChatGPT", secondary: "Secondaire" };

interface TaskTypeSelectorProps {
  selectedType: TaskType;
  onSelectType: (type: TaskType) => void;
  disabled?: boolean;
  buttonClassName?: string;
  size?: 'sm' | 'default';
}

const TaskTypeSelector: FC<TaskTypeSelectorProps> = ({ selectedType, onSelectType, disabled, buttonClassName, size = 'default' }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className={cn("justify-between font-normal", size === 'sm' ? "h-9 w-[140px] text-xs" : "h-10 w-[160px] text-sm", buttonClassName)} disabled={disabled}>
          {taskTypeLabels[selectedType]}
          <ChevronUpDownIconLucide className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn(size === 'sm' ? "w-[140px]" : "w-[160px]", "p-0")}>
        <Command>
          <CommandInput placeholder="Rechercher type..." className="h-9 text-sm" />
          <CommandList>
            <CommandEmpty>Aucun type.</CommandEmpty>
            <CommandGroup>
              {Object.entries(taskTypeLabels).map(([type, label]) => (
                <CommandItem key={type} value={type} onSelect={(currentValue) => { onSelectType(currentValue as TaskType); setOpen(false); }} className="text-sm cursor-pointer">
                  <ListChecks className={cn("mr-2 h-4 w-4", selectedType === type ? "opacity-100" : "opacity-0")} />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default TaskTypeSelector;

"use client";

import { useState, type FC, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import type { Task, TaskType } from '@/types';
import { modifyTaskList, type ModifyTaskListInput, type ModifyTaskListOutput } from '@/ai/flows/modify-task-list';
import { Bot, Trash2, PlusCircle, AlertTriangle, Edit2, CheckCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { CheckIcon } from 'lucide-react';

const taskTypeColors: Record<TaskType, string> = {
  urgent: "bg-red-100 text-red-700 border-red-300 hover:bg-red-200",
  important: "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200",
  reading: "bg-green-100 text-green-700 border-green-300 hover:bg-green-200",
  chatgpt: "bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200",
  secondary: "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200",
};

const taskTypeLabels: Record<TaskType, string> = {
  urgent: "Urgent",
  important: "Important",
  reading: "Reading",
  chatgpt: "ChatGPT",
  secondary: "Secondary",
};


const TaskTypeSelector: FC<{ selectedType: TaskType, onSelectType: (type: TaskType) => void }> = ({ selectedType, onSelectType }) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" role="combobox" aria-expanded={open} className="w-[120px] justify-between text-xs">
          {taskTypeLabels[selectedType]}
          <ChevronUpDownIcon className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[120px] p-0">
        <Command>
          <CommandInput placeholder="Search type..." className="h-8 text-xs" />
          <CommandEmpty>No type found.</CommandEmpty>
          <CommandList>
            <CommandGroup>
              {Object.entries(taskTypeLabels).map(([type, label]) => (
                <CommandItem
                  key={type}
                  value={type}
                  onSelect={(currentValue) => {
                    onSelectType(currentValue as TaskType);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 h-3 w-3",
                      selectedType === type ? "opacity-100" : "opacity-0"
                    )}
                  />
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

const ChevronUpDownIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
  </svg>
);


const TaskItemDisplay: FC<{ task: Task, onToggle: (id: string) => void, onDelete: (id: string) => void, onSetType: (id: string, type: TaskType) => void, onEdit: (task: Task) => void }> = ({ task, onToggle, onDelete, onSetType, onEdit }) => {
  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-md border transition-all duration-150",
      taskTypeColors[task.type],
      task.completed && "opacity-60"
    )}>
      <div className="flex items-center gap-3 flex-grow min-w-0">
        <Checkbox
          id={`task-${task.id}`}
          checked={task.completed}
          onCheckedChange={() => onToggle(task.id)}
          className={cn(
             task.type === 'urgent' ? "border-red-500 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-600"
            :task.type === 'important' ? "border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-600"
            : "border-primary"
          )}
        />
        <label
          htmlFor={`task-${task.id}`}
          className={cn(
            "text-sm font-medium leading-none cursor-pointer break-words w-full",
            task.completed && "line-through"
          )}
        >
          {task.text}
        </label>
      </div>
      <div className="flex items-center gap-1 ml-2 shrink-0">
        <TaskTypeSelector selectedType={task.type} onSelectType={(type) => onSetType(task.id, type)} />
         <Button variant="ghost" size="icon" onClick={() => onEdit(task)} className="h-7 w-7 hover:bg-black/5">
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(task.id)} className="h-7 w-7 hover:bg-black/5 text-destructive/80 hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};


export function AiTaskManagerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [instructions, setInstructions] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  
  const [manualTaskText, setManualTaskText] = useState('');
  const [manualTaskType, setManualTaskType] = useState<TaskType>('secondary');
  const [editingTask, setEditingTask] = useState<Task | null>(null);


  const handleAiModifyTasks = async () => {
    if (instructions.trim() === '') return;
    setIsLoading(true);
    setError(null);
    setAiReasoning(null);
    try {
      const input: ModifyTaskListInput = {
        instructions,
        taskList: tasks.map(t => `${t.text} (Completed: ${t.completed}, Type: ${t.type})`),
      };
      const result: ModifyTaskListOutput = await modifyTaskList(input);
      
      // Basic parsing of modified task list. This is a simplification.
      // A more robust solution would involve the AI returning structured task data.
      const newTasks: Task[] = result.modifiedTaskList.map((taskText, index) => {
        const existingTask = tasks.find(t => taskText.includes(t.text)); // Very naive matching
        const completedMatch = taskText.match(/Completed: (true|false)/i);
        const typeMatch = taskText.match(/Type: (urgent|important|reading|chatgpt|secondary)/i);

        return {
          id: existingTask?.id || Date.now().toString() + index,
          text: taskText.replace(/\s*\((Completed: (true|false)|Type: \w+)\)/gi, '').trim(),
          completed: completedMatch ? completedMatch[1].toLowerCase() === 'true' : (existingTask?.completed || false),
          type: typeMatch ? typeMatch[1].toLowerCase() as TaskType : (existingTask?.type || 'secondary'),
          createdAt: existingTask?.createdAt || new Date().toISOString(),
        };
      });

      setTasks(newTasks);
      setAiReasoning(result.reasoning);
      setInstructions('');
    } catch (e) {
      console.error("Error modifying task list:", e);
      setError("Failed to modify task list with AI. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddOrUpdateManualTask = () => {
    if (manualTaskText.trim() === '') return;

    if (editingTask) {
      setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, text: manualTaskText, type: manualTaskType } : t));
      setEditingTask(null);
    } else {
      const newTask: Task = {
        id: Date.now().toString(),
        text: manualTaskText.trim(),
        completed: false,
        type: manualTaskType,
        createdAt: new Date().toISOString(),
      };
      setTasks(prevTasks => [newTask, ...prevTasks]);
    }
    setManualTaskText('');
    setManualTaskType('secondary');
  };

  const handleToggleTask = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleDeleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
    if (editingTask && editingTask.id === id) {
        setEditingTask(null);
        setManualTaskText('');
        setManualTaskType('secondary');
    }
  };

  const handleSetTaskType = (id: string, type: TaskType) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, type } : t));
  };
  
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setManualTaskText(task.text);
    setManualTaskType(task.type);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <h1 className="text-2xl font-semibold tracking-tight">AI Task Manager</h1>
      
      {/* AI Task Modification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" /> AI-Powered Task Modification
          </CardTitle>
          <CardDescription>
            Instruct the AI to manage your tasks (e.g., "Add a task to write chapter 1", "Mark 'review literature' as urgent and complete").
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Enter instructions for the AI..."
            rows={3}
            className="mb-2"
          />
           {error && (
            <p className="text-xs text-destructive mt-1 mb-2 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {error}</p>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleAiModifyTasks} disabled={isLoading || !instructions.trim()}>
            {isLoading ? 'Processing...' : 'Submit to AI'}
          </Button>
        </CardFooter>
      </Card>

      {aiReasoning && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-sm text-blue-700">AI Reasoning</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-blue-600 whitespace-pre-wrap">{aiReasoning}</p>
          </CardContent>
        </Card>
      )}

      {/* Manual Task Input */}
       <Card>
        <CardHeader>
          <CardTitle>{editingTask ? 'Edit Task' : 'Add New Task Manually'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            value={manualTaskText}
            onChange={(e) => setManualTaskText(e.target.value)}
            placeholder="Enter task description..."
            className="flex-grow"
          />
          <div className="flex items-center gap-2">
            <TaskTypeSelector selectedType={manualTaskType} onSelectType={setManualTaskType} />
            <Button onClick={handleAddOrUpdateManualTask} className="flex-shrink-0">
              {editingTask ? <Edit2 className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              {editingTask ? 'Update Task' : 'Add Task'}
            </Button>
            {editingTask && (
                <Button variant="outline" onClick={() => { setEditingTask(null); setManualTaskText(''); setManualTaskType('secondary');}}>
                    Cancel Edit
                </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Task List */}
      <Card className="flex-grow flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>Your Tasks</CardTitle>
          <CardDescription>{tasks.length} task(s)</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow overflow-y-auto space-y-3 pr-1">
          {tasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No tasks yet. Add some manually or use the AI!</p>
          ) : (
            tasks.map((task) => (
              <TaskItemDisplay 
                key={task.id} 
                task={task} 
                onToggle={handleToggleTask} 
                onDelete={handleDeleteTask}
                onSetType={handleSetTaskType}
                onEdit={handleEditTask}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

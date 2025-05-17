import React, { useState, useEffect } from 'react';
import TaskForm from '@/components/tasks/TaskForm';
import { Task, Tag } from '@/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

const AiTaskManagerPage = () => {
  const [tasks, setTasks] = useState<Task[]>([]); // Replace with your actual task state
  const queryClient = useQueryClient();

  // Function to fetch tasks (replace with your actual data fetching)
  const { data: initialTasks, isLoading, error } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, task_tags(tag(*))'); // Fetch tasks with related tags
      if (error) throw error;
      return data as Task[];
    },
  });

  useEffect(() => {
    if (initialTasks) {
      setTasks(initialTasks);
    }
  }, [initialTasks]);

  // Mutation to update or insert a task
  const upsertTaskMutation = useMutation({
    mutationFn: async (taskData: Omit<Task, 'id' | 'created_at'> & { id?: string }, tags: Tag[]) => {
      if (taskData.id) {
        // Update existing task
        const { id, ...updates } = taskData;
        const { data, error } = await supabase
          .from('tasks')
          .update(updates)
          .eq('id', id)
          .select('*')
          .single();
        if (error) throw error;
        return { ...data, tags } as Task;
      } else {
        // Insert new task
        const { data, error } = await supabase
          .from('tasks')
          .insert(taskData)
          .select('*')
          .single();
        if (error) throw error;
        return { ...data, tags } as Task;
      }
    },
    onSuccess: async (newTask) => {
      // Update tags after task is updated/inserted
      if (newTask) {
        await saveEntityWithTags({
          entityType: 'task',
          entityId: newTask.id,
          currentTags: newTask.tags || [],
          initialTags: initialTasks?.find(t => t.id === newTask.id)?.task_tags?.map(tt => tt.tag) || [], // Fetch initial tags here
        });
      }
      // Invalidate and refetch queries
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Function to handle task submission
  const handleTaskSubmit = async (taskData: Omit<Task, 'id' | 'created_at'>, tags: Tag[]) => {
    try {
      await upsertTaskMutation.mutateAsync({
        ...taskData,
        id: (taskData as any).id, // type casting needed
      }, tags);
    } catch (error: any) {
      console.error('Error saving task:', error);
      // Display an error message to the user
    }
  };

  // Function to save entity tags (as before)
  async function saveEntityWithTags({
    entityType, // : 'task' | 'chapter' | 'daily_objective' | 'source' | 'brain_dump';
    entityId: entityId,
    currentTags, // : Tag[];
    initialTags // : Tag[];
  }: { entityType: string, entityId: string, currentTags: Tag[], initialTags: Tag[] }) {
    // Implementation of saveEntityWithTags (as in previous responses)
    const junctionTableMap = {
      task: 'task_tags',
      chapter: 'chapter_tags',
      daily_objective: 'daily_objective_tags',
      source: 'source_tags',
      brain_dump: 'brain_dump_tags',
    };
    const entityIdColumnMap = {
      task: 'task_id',
      chapter: 'chapter_id',
      daily_objective: 'daily_objective_id',
      source: 'source_id',
      brain_dump: 'brain_dump_entry_id',
    };

    const junctionTable = junctionTableMap[entityType as keyof typeof junctionTableMap];
    const entityIdColumn = entityIdColumnMap[entityType as keyof typeof entityIdColumnMap];

    const tagsToAdd = currentTags.filter(tag => !initialTags.find(t => t.id === tag.id));
    const tagsToRemove = initialTags.filter(tag => !currentTags.find(t => t.id === tag.id));

    // 1. Insérer les nouveaux liens dans la table de jonction
    if (tagsToAdd.length > 0) {
      const linksToInsert = tagsToAdd.map(tag => ({
        [entityIdColumn]: entityId,
        tag_id: tag.id,
      }));
      const { error } = await supabase.from(junctionTable).insert(linksToInsert);
      if (error) throw error;
    }

    // 2. Supprimer les anciens liens de la table de jonction
    if (tagsToRemove.length > 0) {
      const tagIdsToRemove = tagsToRemove.map(tag => tag.id);
      const { error } = await supabase.from(junctionTable)
        .delete()
        .eq(entityIdColumn, entityId)
        .in('tag_id', tagIdsToRemove);
      if (error) throw error;
    }
  }

  return (
    <div>
      {/* Render the TaskForm */}
      <TaskForm
        initialTask={null} // Provide the task data if it is an edit
        onSubmit={handleTaskSubmit}
      />
       {/* Display the existing tasks */}
         {tasks?.map((task) => (
            <div key={task.id}>
               {task.description}
            </div>
         ))}
    </div>
  );
};

export default AiTaskManagerPage;

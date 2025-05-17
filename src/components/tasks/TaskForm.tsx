import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import TagManager from '@/components/ui/tag-manager';
import { Task, Tag } from '@/types'; // Importez vos types
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

interface TaskFormProps {
  initialTask?: Task;
  onSubmit: (taskData: Omit<Task, 'id' | 'created_at'>, tags: Tag[]) => Promise<void>; // Ajustez le type onSubmit
}

const TaskForm: React.FC<TaskFormProps> = ({ initialTask, onSubmit }) => {
  const [description, setDescription] = useState(initialTask?.description || '');
  const [completed, setCompleted] = useState(initialTask?.completed || false);
  const [selectedTags, setSelectedTags] = useState<Tag[]>(initialTask?.task_tags?.map(tt => tt.tag) || []); // Initialisez les tags
  const queryClient = useQueryClient();

  const handleTagChange = (newTags: Tag[]) => {
    setSelectedTags(newTags);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validez les données du formulaire ici si nécessaire

    const taskData: Omit<Task, 'id' | 'created_at'> = {
      description: description,
      completed: completed,
      // Vous devrez peut-être inclure d'autres champs de tâche ici
    };

    await onSubmit(taskData, selectedTags);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="description">Description de la tâche:</Label>
        <Input
          type="text"
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="completed">Terminée:</Label>
        <input
          type="checkbox"
          id="completed"
          checked={completed}
          onChange={(e) => setCompleted(e.target.checked)}
        />
      </div>

      <div>
        <TagManager
          entityId={initialTask?.id || 'new'}
          entityType="task"
          initialTags={selectedTags}
          onTagsChange={handleTagChange}
        />
      </div>

      <Button type="submit">Enregistrer la tâche</Button>
    </form>
  );
};

export default TaskForm;

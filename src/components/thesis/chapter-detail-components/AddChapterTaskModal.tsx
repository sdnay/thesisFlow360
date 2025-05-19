
"use client";

import type { FC } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea'; // Added for task text
import { Loader2, PlusCircle, Save } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import type { Chapter, Tag, Task, TaskType } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import TaskTypeSelector from '@/components/thesis/task-manager-components/TaskTypeSelector';
import TagManager from '@/components/ui/tag-manager';

interface AddChapterTaskModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  chapterId: string;
  userId: string;
  availableTags: Tag[];
  onTaskAdded: () => void; // Callback to refresh task list
}

const AddChapterTaskModal: FC<AddChapterTaskModalProps> = ({
  isOpen,
  onOpenChange,
  chapterId,
  userId,
  availableTags,
  onTaskAdded,
}) => {
  const { toast } = useToast();
  const [taskText, setTaskText] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('secondary');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [allUserTags, setAllUserTags] = useState<Tag[]>(availableTags);


  const handleSaveTask = async () => {
    if (!userId || !taskText.trim()) {
      toast({ title: "Erreur", description: "Le texte de la tâche est requis.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const taskPayload = {
        user_id: userId,
        text: taskText.trim(),
        type: taskType,
        completed: false,
        chapter_id: chapterId,
      };

      const { data: newTaskData, error: taskError } = await supabase
        .from('tasks')
        .insert(taskPayload)
        .select('id')
        .single();

      if (taskError) throw taskError;
      if (!newTaskData) throw new Error("La création de la tâche a échoué.");

      // Save tags
      if (selectedTags.length > 0) {
        const tagLinks = selectedTags.map(tag => ({ task_id: newTaskData.id, tag_id: tag.id }));
        const { error: tagLinkError } = await supabase.from('task_tags').insert(tagLinks);
        if (tagLinkError) {
            // Rollback task creation or notify user about partial success?
            // For now, just log and toast error.
            console.error("Erreur liaison tags pour tâche:", tagLinkError);
            toast({ title: "Erreur Tags", description: "La tâche a été créée mais les tags n'ont pas pu être liés.", variant: "destructive" });
        }
      }

      toast({ title: "Tâche ajoutée", description: `"${taskText.trim()}" ajoutée au chapitre.` });
      setTaskText('');
      setTaskType('secondary');
      setSelectedTags([]);
      onTaskAdded(); // Refresh list on parent page
      onOpenChange(false); // Close modal
    } catch (e: any) {
      console.error("Erreur sauvegarde tâche depuis détail chapitre:", e);
      toast({ title: "Erreur Sauvegarde Tâche", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = async (tagOrNewName: Tag | string) => {
    if (!userId) return;
    let finalTag: Tag | undefined;

    if (typeof tagOrNewName === 'string') {
      const existingTag = allUserTags.find(t => t.name.toLowerCase() === tagOrNewName.toLowerCase() && t.user_id === userId);
      if (existingTag) {
        finalTag = existingTag;
      } else {
        const { data: newTagFromDb, error: tagError } = await supabase
          .from('tags')
          .insert({ name: tagOrNewName, user_id: userId })
          .select()
          .single();
        if (tagError || !newTagFromDb) {
          toast({ title: "Erreur Création Tag", description: tagError?.message, variant: "destructive" });
          return;
        }
        finalTag = newTagFromDb;
        setAllUserTags(prev => [...prev, finalTag!].sort((a, b) => a.name.localeCompare(b.name)));
      }
    } else {
      finalTag = tagOrNewName;
    }
    if (finalTag && !selectedTags.find(st => st.id === finalTag!.id)) {
      setSelectedTags(prev => [...prev, finalTag!]);
    }
  };

  const handleRemoveTag = (tagId: string) => {
    setSelectedTags(prev => prev.filter(t => t.id !== tagId));
  };
  
  const resetForm = () => {
    setTaskText('');
    setTaskType('secondary');
    setSelectedTags([]);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if(!open) resetForm(); onOpenChange(open); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Ajouter une Tâche à ce Chapitre</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="taskTextModal" className="mb-1.5 block text-sm">Description de la tâche</Label>
            <Textarea
              id="taskTextModal"
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              placeholder="Que devez-vous faire ?"
              rows={3}
              disabled={isSaving}
              className="text-sm"
            />
          </div>
          <div>
            <Label htmlFor="taskTypeModal" className="mb-1.5 block text-sm">Type de tâche</Label>
            <TaskTypeSelector
              selectedType={taskType}
              onSelectType={setTaskType}
              disabled={isSaving}
              size="sm"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Tags (Optionnel)</Label>
            <TagManager
              availableTags={allUserTags.filter(t => t.user_id === userId)}
              selectedTags={selectedTags}
              onTagAdd={handleAddTag}
              onTagRemove={handleRemoveTag}
              disabled={isSaving}
              triggerLabel="Gérer les tags de la tâche"
              allowTagCreation={true}
            />
          </div>
        </div>
        <DialogFooter className="mt-2">
          <DialogClose asChild><Button variant="outline" onClick={resetForm} disabled={isSaving}>Annuler</Button></DialogClose>
          <Button onClick={handleSaveTask} disabled={isSaving || !taskText.trim()}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Ajouter la Tâche
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddChapterTaskModal;

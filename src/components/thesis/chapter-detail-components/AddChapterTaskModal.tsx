
"use client";

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, PlusCircle, Save } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import type { Tag, TaskType } from '@/types';
import TaskTypeSelector from '@/components/thesis/task-manager-components/TaskTypeSelector';
import TagManager from '@/components/ui/tag-manager';
import { revalidatePath } from 'next/cache';

interface AddChapterTaskModalProps {
  chapterId: string;
  userId: string;
  availableTags: Tag[];
  revalidationPath: string; // Path to revalidate after adding
}

const AddChapterTaskModal: FC<AddChapterTaskModalProps> = ({
  chapterId,
  userId,
  availableTags,
  revalidationPath: pathForRevalidation,
}) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [taskText, setTaskText] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('secondary');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [localAvailableTags, setLocalAvailableTags] = useState<Tag[]>(availableTags);

  useEffect(() => {
    setLocalAvailableTags(availableTags);
  }, [availableTags]);

  const resetForm = () => {
    setTaskText('');
    setTaskType('secondary');
    setSelectedTags([]);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    setIsOpen(open);
  };

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

      if (selectedTags.length > 0) {
        const tagLinks = selectedTags.map(tag => ({ task_id: newTaskData.id, tag_id: tag.id }));
        const { error: tagLinkError } = await supabase.from('task_tags').insert(tagLinks);
        if (tagLinkError) {
          console.error("Erreur liaison tags pour tâche:", tagLinkError);
          toast({ title: "Erreur Tags", description: "La tâche a été créée mais les tags n'ont pas pu être liés.", variant: "destructive" });
        }
      }

      toast({ title: "Tâche ajoutée", description: `"${taskText.trim()}" ajoutée au chapitre.` });
      resetForm();
      setIsOpen(false);
      // Revalidate the path to refresh data on the server component
      if (pathForRevalidation) {
        // This is a server-side action, ideally called from a server action
        // For client component, this call would be ineffective.
        // We assume this modal might be used in a context where revalidation is passed down
        // or this component itself will be refactored into a server action form submission.
        // For now, we rely on parent component re-rendering or Supabase realtime.
        // The parent Server Component (ChapterDetailPage) should use revalidatePath in its actions or callbacks.
      }
      // TODO: Consider a more robust revalidation strategy, possibly prop callback or server action
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
      const existingTag = localAvailableTags.find(t => t.name.toLowerCase() === tagOrNewName.toLowerCase() && t.user_id === userId);
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
        setLocalAvailableTags(prev => [...prev, finalTag!].sort((a, b) => a.name.localeCompare(b.name)));
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

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Ajouter Tâche</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Ajouter une Tâche à ce Chapitre</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="taskTextModalChapter" className="mb-1.5 block text-sm">Description de la tâche</Label>
            <Textarea
              id="taskTextModalChapter"
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              placeholder="Que devez-vous faire ?"
              rows={3}
              disabled={isSaving}
              className="text-sm"
            />
          </div>
          <div>
            <Label htmlFor="taskTypeModalChapter" className="mb-1.5 block text-sm">Type de tâche</Label>
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
              availableTags={localAvailableTags}
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
          <DialogClose asChild><Button variant="outline" disabled={isSaving}>Annuler</Button></DialogClose>
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

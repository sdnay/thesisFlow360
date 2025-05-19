
"use client";

import type { FC } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, PlusCircle, Save } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import type { Tag, DailyObjective } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import TagManager from '@/components/ui/tag-manager';
import { format } from 'date-fns';

interface AddChapterObjectiveModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  chapterId: string;
  userId: string;
  objectiveDate: string; // YYYY-MM-DD string
  availableTags: Tag[];
  onObjectiveAdded: () => void; // Callback to refresh objective list
}

const AddChapterObjectiveModal: FC<AddChapterObjectiveModalProps> = ({
  isOpen,
  onOpenChange,
  chapterId,
  userId,
  objectiveDate,
  availableTags,
  onObjectiveAdded,
}) => {
  const { toast } = useToast();
  const [objectiveText, setObjectiveText] = useState('');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [allUserTags, setAllUserTags] = useState<Tag[]>(availableTags);

  const handleSaveObjective = async () => {
    if (!userId || !objectiveText.trim()) {
      toast({ title: "Erreur", description: "Le texte de l'objectif est requis.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const objectivePayload = {
        user_id: userId,
        text: objectiveText.trim(),
        objective_date: objectiveDate,
        completed: false,
        chapter_id: chapterId,
        // daily_plan_id: null, // Or logic to find active plan for the day
      };

      const { data: newObjectiveData, error: objectiveError } = await supabase
        .from('daily_objectives')
        .insert(objectivePayload)
        .select('id')
        .single();

      if (objectiveError) throw objectiveError;
      if (!newObjectiveData) throw new Error("La création de l'objectif a échoué.");

      // Save tags
      if (selectedTags.length > 0) {
        const tagLinks = selectedTags.map(tag => ({ daily_objective_id: newObjectiveData.id, tag_id: tag.id }));
        const { error: tagLinkError } = await supabase.from('daily_objective_tags').insert(tagLinks);
        if (tagLinkError) {
            console.error("Erreur liaison tags pour objectif:", tagLinkError);
            toast({ title: "Erreur Tags", description: "L'objectif a été créé mais les tags n'ont pas pu être liés.", variant: "destructive" });
        }
      }

      toast({ title: "Objectif ajouté", description: `"${objectiveText.trim()}" ajouté pour le ${format(new Date(objectiveDate+'T00:00:00'), 'd MMM yyyy')}.` });
      setObjectiveText('');
      setSelectedTags([]);
      onObjectiveAdded(); 
      onOpenChange(false);
    } catch (e: any) {
      console.error("Erreur sauvegarde objectif depuis détail chapitre:", e);
      toast({ title: "Erreur Sauvegarde Objectif", description: e.message, variant: "destructive" });
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
    setObjectiveText('');
    setSelectedTags([]);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if(!open) resetForm(); onOpenChange(open);}}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Ajouter un Objectif à ce Chapitre</DialogTitle>
          <p className="text-sm text-muted-foreground">Pour le {format(new Date(objectiveDate+'T00:00:00'), 'eeee d MMMM yyyy')}</p>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="objectiveTextModal" className="mb-1.5 block text-sm">Description de l'objectif</Label>
            <Input
              id="objectiveTextModal"
              value={objectiveText}
              onChange={(e) => setObjectiveText(e.target.value)}
              placeholder="Quel est votre objectif ?"
              disabled={isSaving}
              className="text-sm"
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
              triggerLabel="Gérer les tags de l'objectif"
              allowTagCreation={true}
            />
          </div>
        </div>
        <DialogFooter className="mt-2">
          <DialogClose asChild><Button variant="outline" onClick={resetForm} disabled={isSaving}>Annuler</Button></DialogClose>
          <Button onClick={handleSaveObjective} disabled={isSaving || !objectiveText.trim()}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Ajouter l'Objectif
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddChapterObjectiveModal;

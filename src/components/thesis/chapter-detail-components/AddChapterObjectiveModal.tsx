
"use client";

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, PlusCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import type { Tag } from '@/types';
import TagManager from '@/components/ui/tag-manager';
import { format, parseISO } from 'date-fns'; // Added parseISO here
import { fr } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

interface AddChapterObjectiveModalProps {
  chapterId: string;
  userId: string;
  objectiveDate: string; // YYYY-MM-DD string
  availableTags: Tag[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const AddChapterObjectiveModal: FC<AddChapterObjectiveModalProps> = ({
  chapterId,
  userId,
  objectiveDate,
  availableTags,
  isOpen,
  onOpenChange,
  onSuccess,
}) => {
  const { toast } = useToast();
  const router = useRouter();
  const [objectiveText, setObjectiveText] = useState('');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [localAvailableTags, setLocalAvailableTags] = useState<Tag[]>(availableTags);

  useEffect(() => {
    setLocalAvailableTags(availableTags);
  }, [availableTags]);

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens, unless you want to preserve state across openings
      // For now, we reset to ensure a fresh form for a new objective for this chapter/date.
      setObjectiveText('');
      setSelectedTags([]);
    }
  }, [isOpen]);


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
        objective_date: objectiveDate, // Use the passed objectiveDate
        completed: false,
        chapter_id: chapterId,
      };

      const { data: newObjectiveData, error: objectiveError } = await supabase
        .from('daily_objectives')
        .insert(objectivePayload)
        .select('id')
        .single();

      if (objectiveError) throw objectiveError;
      if (!newObjectiveData) throw new Error("La création de l'objectif a échoué.");

      if (selectedTags.length > 0) {
        const tagLinks = selectedTags.map(tag => ({ daily_objective_id: newObjectiveData.id, tag_id: tag.id, user_id: userId }));
        const { error: tagLinkError } = await supabase.from('daily_objective_tags').insert(tagLinks);
        if (tagLinkError) {
            console.error("Erreur liaison tags pour objectif:", tagLinkError);
            // Consider not throwing here, but logging and toasting an advisory
            toast({ title: "Avertissement Tags", description: "L'objectif a été créé mais certains tags n'ont pas pu être liés: " + tagLinkError.message, variant: "default", duration: 5000 });
        }
      }

      toast({ title: "Objectif ajouté", description: `"${objectiveText.trim()}" ajouté pour le ${format(parseISO(objectiveDate), 'd MMM yyyy', {locale: fr})}.` });
      
      if (onSuccess) onSuccess();
      onOpenChange(false); // Close modal on success
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
      const existingTag = localAvailableTags.find(t => t.name.toLowerCase() === tagOrNewName.toLowerCase() && t.user_id === userId);
      if (existingTag) {
        finalTag = existingTag;
      } else {
        const { data: newTagFromDb, error: tagError } = await supabase
          .from('tags')
          .insert({ name: tagOrNewName, user_id: userId, color: null }) // Assuming default color or handle color later
          .select()
          .single();
        if (tagError || !newTagFromDb) {
          toast({ title: "Erreur Création Tag", description: tagError?.message, variant: "destructive" });
          return;
        }
        finalTag = newTagFromDb as Tag; // Cast if necessary, ensure `user_id` is part of the select
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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Ajouter un Objectif à ce Chapitre</DialogTitle>
          <p className="text-sm text-muted-foreground">Pour le {format(parseISO(objectiveDate), 'eeee d MMMM yyyy', {locale: fr})}</p>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="objectiveTextModalChapterDetail" className="mb-1.5 block text-sm">Description de l'objectif</Label>
            <Input
              id="objectiveTextModalChapterDetail"
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
              availableTags={localAvailableTags}
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Annuler</Button>
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


"use client";

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import type { Chapter, Tag } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';
import SimpleChapterTagManager from './SimpleChapterTagManager'; // Import relatif
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';


interface ManageTagsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  chapter: Chapter | null;
  availableTags: Tag[]; // Les tags globaux disponibles pour cet utilisateur
  onGlobalTagsUpdate: (newTag: Tag) => void; // Callback pour mettre à jour la liste globale si un tag est créé
  onSaveTags: (chapterId: string, tagsToSave: Tag[]) => Promise<void>;
  isLoading: boolean;
}

const ManageTagsModal: FC<ManageTagsModalProps> = ({
  isOpen,
  onOpenChange,
  chapter,
  availableTags,
  onGlobalTagsUpdate,
  onSaveTags,
  isLoading,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);

  useEffect(() => {
    if (chapter?.tags) {
      setSelectedTags(chapter.tags);
    } else {
      setSelectedTags([]);
    }
  }, [chapter]);

  const handleTagAdd = async (tagNameOrTag: string | Tag) => {
    if (!user || !chapter) return;

    let finalTag: Tag | undefined;

    if (typeof tagNameOrTag === 'string') {
      const existingTag = availableTags.find(
        (t) => t.name.toLowerCase() === tagNameOrTag.toLowerCase() && t.user_id === user.id
      );
      if (existingTag) {
        finalTag = existingTag;
      } else {
        // Créer un nouveau tag globalement
        try {
          const { data: newTagFromDb, error: tagError } = await supabase
            .from('tags')
            .insert({ name: tagNameOrTag, user_id: user.id, color: null }) // Couleur par défaut, peut être amélioré
            .select()
            .single();

          if (tagError || !newTagFromDb) {
            throw tagError || new Error("Impossible de créer le tag.");
          }
          finalTag = { ...newTagFromDb, user_id: user.id }; // Assurer que user_id est là
          onGlobalTagsUpdate(finalTag); // Informer le parent de la création d'un nouveau tag global
          toast({ title: "Tag créé", description: `Le tag "${finalTag.name}" a été ajouté à la liste globale.`});
        } catch (e: any) {
          toast({ title: "Erreur Création Tag", description: e.message, variant: "destructive" });
          return;
        }
      }
    } else {
      finalTag = tagNameOrTag;
    }

    if (finalTag && !selectedTags.find((st) => st.id === finalTag!.id)) {
      setSelectedTags((prev) => [...prev, finalTag!]);
    }
  };

  const handleTagRemove = (tagId: string) => {
    setSelectedTags((prev) => prev.filter((t) => t.id !== tagId));
  };

  const handleSave = async () => {
    if (chapter) {
      await onSaveTags(chapter.id, selectedTags);
      // La fermeture de la modale et le re-fetch sont gérés par le parent (ManageThesisPlan)
    }
  };

  if (!chapter) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Gérer les Tags pour "{chapter.name}"</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-3">
          <SimpleChapterTagManager
            availableTags={availableTags} // Utilise les tags globaux filtrés par le parent
            selectedTags={selectedTags}
            onTagAdd={handleTagAdd}
            onTagRemove={handleTagRemove}
            disabled={isLoading}
          />
        </div>
        <DialogFooter className="mt-2">
          <DialogClose asChild>
            <Button variant="outline" disabled={isLoading}>
              Annuler
            </Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Enregistrer les Tags
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageTagsModal;

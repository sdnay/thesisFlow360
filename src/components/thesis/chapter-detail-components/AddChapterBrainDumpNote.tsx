
"use client";

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PlusCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import type { Tag, BrainDumpEntryStatus } from '@/types';
import TagManager from '@/components/ui/tag-manager';
import { useRouter } from 'next/navigation';
import { statusConfigDefinition } from '@/components/thesis/brain-dump-components/brainDumpConstants';

const brainDumpStatuses: BrainDumpEntryStatus[] = ["captured", "idea", "task", "discarded"];

interface AddChapterBrainDumpNoteProps {
  chapterId: string;
  userId: string;
  availableTags: Tag[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const AddChapterBrainDumpNote: FC<AddChapterBrainDumpNoteProps> = ({
  chapterId,
  userId,
  availableTags,
  isOpen,
  onOpenChange,
  onSuccess,
}) => {
  const { toast } = useToast();
  // const router = useRouter(); // Not directly needed if parent handles refresh
  const [noteText, setNoteText] = useState('');
  const [noteStatus, setNoteStatus] = useState<BrainDumpEntryStatus>('captured');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [localAvailableTags, setLocalAvailableTags] = useState<Tag[]>(availableTags);

  useEffect(() => {
    setLocalAvailableTags(availableTags);
  }, [availableTags]);
  
  const resetForm = () => {
    setNoteText('');
    setNoteStatus('captured');
    setSelectedTags([]);
  };

  const handleOpenChangeInternal = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  const handleSaveNote = async () => {
    if (!userId || !noteText.trim()) {
      toast({ title: "Erreur", description: "Le texte de la note est requis.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const notePayload = {
        user_id: userId,
        text: noteText.trim(),
        status: noteStatus,
        chapter_id: chapterId,
      };

      const { data: newNoteData, error: noteError } = await supabase
        .from('brain_dump_entries')
        .insert(notePayload)
        .select('id')
        .single();

      if (noteError) throw noteError;
      if (!newNoteData) throw new Error("La création de la note a échoué.");

      if (selectedTags.length > 0) {
        const tagLinks = selectedTags.map(tag => ({ brain_dump_entry_id: newNoteData.id, tag_id: tag.id, user_id: userId }));
        const { error: tagLinkError } = await supabase.from('brain_dump_entry_tags').insert(tagLinks);
        if (tagLinkError) {
          console.error("Erreur liaison tags pour note:", tagLinkError);
          toast({ title: "Avertissement Tags", description: "La note a été créée mais les tags n'ont pas pu être liés.", variant: "default" });
        }
      }

      toast({ title: "Note ajoutée", description: "Note ajoutée au vide-cerveau et liée à ce chapitre." });
      resetForm();
      if (onSuccess) onSuccess();
      // onOpenChange(false); // Parent (ChapterDetailClientView) will close modal
    } catch (e: any) {
      console.error("Erreur sauvegarde note depuis détail chapitre:", e);
      toast({ title: "Erreur Sauvegarde Note", description: e.message, variant: "destructive" });
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
    <Dialog open={isOpen} onOpenChange={handleOpenChangeInternal}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Ajouter une Note au Vide-Cerveau pour ce Chapitre</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="noteTextModalChapterDetail" className="mb-1.5 block text-sm">Contenu de la note</Label>
            <Textarea
              id="noteTextModalChapterDetail"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Votre idée, pensée, citation..."
              rows={4}
              disabled={isSaving}
              className="text-sm"
            />
          </div>
          <div>
            <Label htmlFor="noteStatusModalChapterDetail" className="mb-1.5 block text-sm">Statut initial</Label>
            <Select value={noteStatus} onValueChange={(value) => setNoteStatus(value as BrainDumpEntryStatus)} disabled={isSaving}>
              <SelectTrigger id="noteStatusModalChapterDetail" className="text-sm">
                <SelectValue placeholder="Choisir un statut" />
              </SelectTrigger>
              <SelectContent>
                {brainDumpStatuses.map(status => (
                  <SelectItem key={status} value={status} className="text-sm">
                    {statusConfigDefinition[status as keyof typeof statusConfigDefinition]?.label || status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Tags (Optionnel)</Label>
            <TagManager
              availableTags={localAvailableTags}
              selectedTags={selectedTags}
              onTagAdd={handleAddTag}
              onTagRemove={handleRemoveTag}
              disabled={isSaving}
              triggerLabel="Gérer les tags de la note"
              allowTagCreation={true}
            />
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => handleOpenChangeInternal(false)} disabled={isSaving}>Annuler</Button>
          <Button onClick={handleSaveNote} disabled={isSaving || !noteText.trim()}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Ajouter la Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddChapterBrainDumpNote;


"use client";

import type { FC, ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Edit, Tags as TagsIcon, EllipsisVertical } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import type { Chapter, Tag } from '@/types';
import TagManager from '@/components/ui/tag-manager';
import { useRouter } from 'next/navigation';

interface ChapterActionsControllerProps {
  chapter: Chapter;
  userId: string;
  availableTags: Tag[];
  trigger?: ReactNode;
  // onChapterUpdated?: () => void; // Replaced by router.refresh()
}

const ChapterActionsController: FC<ChapterActionsControllerProps> = ({
  chapter,
  userId,
  availableTags: initialAvailableTags,
  trigger,
}) => {
  const { toast } = useToast();
  const router = useRouter();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);
  
  const [editableChapterName, setEditableChapterName] = useState(chapter.name);
  const [editableChapterStatus, setEditableChapterStatus] = useState(chapter.status);
  
  const [selectedTags, setSelectedTags] = useState<Tag[]>(chapter.tags || []);
  const [localAvailableTags, setLocalAvailableTags] = useState<Tag[]>(initialAvailableTags);
  
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isSavingTags, setIsSavingTags] = useState(false);

  useEffect(() => {
    if (isEditModalOpen) {
        setEditableChapterName(chapter.name);
        setEditableChapterStatus(chapter.status);
    }
  }, [chapter, isEditModalOpen]);

  useEffect(() => {
    if (isTagsModalOpen) {
        setSelectedTags(chapter.tags || []);
    }
  }, [chapter, isTagsModalOpen]);


  useEffect(() => {
    setLocalAvailableTags(initialAvailableTags);
  }, [initialAvailableTags]);

  const handleSaveChapterDetails = async () => {
    if (!userId || !editableChapterName.trim()) {
      toast({ title: "Erreur", description: "Le nom du chapitre est requis.", variant: "destructive" });
      return;
    }
    setIsSavingDetails(true);
    try {
      const chapterPayload = {
        name: editableChapterName.trim(),
        status: editableChapterStatus.trim() || 'Non commencé',
      };
      const { error } = await supabase
        .from('chapters')
        .update(chapterPayload)
        .eq('id', chapter.id)
        .eq('user_id', userId);

      if (error) throw error;
      toast({ title: "Chapitre Mis à Jour", description: "Les détails du chapitre ont été sauvegardés." });
      setIsEditModalOpen(false);
      router.refresh(); // Refresh server component data
    } catch (e: any) {
      toast({ title: "Erreur Sauvegarde", description: e.message, variant: "destructive" });
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleSaveChapterTags = async () => {
    if (!userId) return;
    setIsSavingTags(true);
    try {
      // Delete existing links for this chapter (ensure user_id is part of the condition if your RLS on junction table is not enough)
      // For simplicity, RLS on 'chapter_tags' based on 'chapters.user_id' should be sufficient.
      await supabase.from('chapter_tags').delete().eq('chapter_id', chapter.id); 
      
      if (selectedTags.length > 0) {
        const newLinks = selectedTags.map(tag => ({ chapter_id: chapter.id, tag_id: tag.id, user_id: userId })); // Add user_id for junction table RLS
        const { error: insertError } = await supabase.from('chapter_tags').insert(newLinks);
        if (insertError) throw insertError;
      }
      toast({ title: "Tags Mis à Jour", description: "Les tags du chapitre ont été sauvegardés." });
      setIsTagsModalOpen(false);
      router.refresh(); // Refresh server component data
    } catch (e: any) {
      toast({ title: "Erreur Tags", description: e.message, variant: "destructive" });
    } finally {
      setIsSavingTags(false);
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
          .insert({ name: tagOrNewName, user_id: userId, color: null }) // Ensure user_id is set for new tags
          .select()
          .single();
        if (tagError || !newTagFromDb) {
          toast({ title: "Erreur Création Tag", description: tagError?.message, variant: "destructive" });
          return;
        }
        finalTag = newTagFromDb as Tag;
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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger || (
            <Button variant="ghost" size="icon" aria-label="Actions du chapitre">
              <EllipsisVertical className="h-5 w-5" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => setIsEditModalOpen(true)} className="cursor-pointer">
            <Edit className="mr-2 h-4 w-4" />
            Éditer Détails Chapitre
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsTagsModalOpen(true)} className="cursor-pointer">
            <TagsIcon className="mr-2 h-4 w-4" />
            Gérer les Tags
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Éditer le Chapitre</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="chapterNameEditDetail" className="mb-1.5 block text-sm">Nom du Chapitre</Label>
              <Input id="chapterNameEditDetail" value={editableChapterName} onChange={(e) => setEditableChapterName(e.target.value)} disabled={isSavingDetails} className="text-sm" />
            </div>
            <div>
              <Label htmlFor="chapterStatusEditDetail" className="mb-1.5 block text-sm">Statut</Label>
              <Input id="chapterStatusEditDetail" value={editableChapterStatus} onChange={(e) => setEditableChapterStatus(e.target.value)} disabled={isSavingDetails} className="text-sm" placeholder="ex: En cours, Terminé..." />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={isSavingDetails}>Annuler</Button>
            <Button onClick={handleSaveChapterDetails} disabled={isSavingDetails || !editableChapterName.trim()}>
              {isSavingDetails ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTagsModalOpen} onOpenChange={setIsTagsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Gérer les Tags pour "{chapter.name}"</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <TagManager
              availableTags={localAvailableTags}
              selectedTags={selectedTags}
              onTagAdd={handleAddTag}
              onTagRemove={handleRemoveTag}
              disabled={isSavingTags}
              triggerLabel="Gérer les tags du chapitre"
              allowTagCreation={true}
            />
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setIsTagsModalOpen(false)} disabled={isSavingTags}>Annuler</Button>
            <Button onClick={handleSaveChapterTags} disabled={isSavingTags}>
              {isSavingTags ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Enregistrer les Tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChapterActionsController;

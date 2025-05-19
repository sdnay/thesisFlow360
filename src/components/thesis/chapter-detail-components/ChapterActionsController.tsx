
"use client";

import type { FC, ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Edit, Tags as TagsIcon, EllipsisVertical, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import type { Chapter, Tag } from '@/types';
import TagManager from '@/components/ui/tag-manager'; // Assuming TagManager is for global use
import { revalidatePath } from 'next/cache'; // Only works in Server Actions / Route Handlers

interface ChapterActionsControllerProps {
  chapter: Chapter;
  userId: string;
  availableTags: Tag[];
  revalidationPath: string;
  revalidationListPath?: string;
  trigger?: ReactNode; // Optional custom trigger for the DropdownMenu
}

const ChapterActionsController: FC<ChapterActionsControllerProps> = ({
  chapter,
  userId,
  availableTags: initialAvailableTags,
  revalidationPath: pathToRevalidate,
  revalidationListPath,
  trigger,
}) => {
  const { toast } = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);
  
  const [editableChapterName, setEditableChapterName] = useState(chapter.name);
  const [editableChapterStatus, setEditableChapterStatus] = useState(chapter.status);
  // Progress is calculated dynamically, so not directly editable here

  const [selectedTags, setSelectedTags] = useState<Tag[]>(chapter.tags || []);
  const [localAvailableTags, setLocalAvailableTags] = useState<Tag[]>(initialAvailableTags);
  
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isSavingTags, setIsSavingTags] = useState(false);

  useEffect(() => {
    setEditableChapterName(chapter.name);
    setEditableChapterStatus(chapter.status);
    setSelectedTags(chapter.tags || []);
  }, [chapter]);

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
        // progress, supervisor_comments are not edited here
      };
      const { error } = await supabase
        .from('chapters')
        .update(chapterPayload)
        .eq('id', chapter.id)
        .eq('user_id', userId);

      if (error) throw error;
      toast({ title: "Chapitre Mis à Jour", description: "Les détails du chapitre ont été sauvegardés." });
      setIsEditModalOpen(false);
      // Server Action or API route would call revalidatePath(pathToRevalidate) and revalidatePath(revalidationListPath)
      // For client-side, we rely on parent re-fetching or Supabase subscriptions.
      // Or pass a callback from the parent Server Component that calls revalidatePath.
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
      // 1. Delete existing tag links for this chapter
      const { error: deleteError } = await supabase
        .from('chapter_tags')
        .delete()
        .eq('chapter_id', chapter.id);
      if (deleteError) throw deleteError;

      // 2. Insert new tag links
      if (selectedTags.length > 0) {
        const newLinks = selectedTags.map(tag => ({ chapter_id: chapter.id, tag_id: tag.id }));
        const { error: insertError } = await supabase.from('chapter_tags').insert(newLinks);
        if (insertError) throw insertError;
      }
      toast({ title: "Tags Mis à Jour", description: "Les tags du chapitre ont été sauvegardés." });
      setIsTagsModalOpen(false);
       // Similar revalidation note as above
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
          .insert({ name: tagOrNewName, user_id: userId, color: null })
          .select()
          .single();
        if (tagError || !newTagFromDb) {
          toast({ title: "Erreur Création Tag", description: tagError?.message, variant: "destructive" });
          return;
        }
        finalTag = newTagFromDb as Tag; // Cast as Tag
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
          {/* Consider adding Delete Chapter option here if appropriate */}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Chapter Details Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Éditer le Chapitre</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="chapterNameEdit" className="mb-1.5 block text-sm">Nom du Chapitre</Label>
              <Input id="chapterNameEdit" value={editableChapterName} onChange={(e) => setEditableChapterName(e.target.value)} disabled={isSavingDetails} className="text-sm" />
            </div>
            <div>
              <Label htmlFor="chapterStatusEdit" className="mb-1.5 block text-sm">Statut</Label>
              <Input id="chapterStatusEdit" value={editableChapterStatus} onChange={(e) => setEditableChapterStatus(e.target.value)} disabled={isSavingDetails} className="text-sm" placeholder="ex: En cours, Terminé..." />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <DialogClose asChild><Button variant="outline" disabled={isSavingDetails}>Annuler</Button></DialogClose>
            <Button onClick={handleSaveChapterDetails} disabled={isSavingDetails || !editableChapterName.trim()}>
              {isSavingDetails ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Chapter Tags Modal */}
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
              triggerLabel="Gérer les tags du chapitre" // This won't be visible if PopoverTrigger is not used
              allowTagCreation={true}
            />
          </div>
          <DialogFooter className="mt-2">
            <DialogClose asChild><Button variant="outline" disabled={isSavingTags}>Annuler</Button></DialogClose>
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

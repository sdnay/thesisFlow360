
"use client";

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import type { Source } from '@/types';
import { SourceTypeIcon, sourceTypeText } from '@/components/thesis/source-library-components/SourceTypeIcon';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

interface ManageChapterSourcesProps {
  chapterId: string;
  userId: string;
  allUserSources: Source[]; 
  initiallyLinkedSourceIds: Set<string>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const ManageChapterSources: FC<ManageChapterSourcesProps> = ({
  chapterId,
  userId,
  allUserSources,
  initiallyLinkedSourceIds,
  isOpen,
  onOpenChange,
  onSuccess,
}) => {
  const { toast } = useToast();
  // const router = useRouter(); // Not directly needed if parent handles refresh
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set(initiallyLinkedSourceIds));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedSourceIds(new Set(initiallyLinkedSourceIds));
    }
  }, [initiallyLinkedSourceIds, isOpen]);

  const handleToggleSource = (sourceId: string) => {
    setSelectedSourceIds(prevSelectedIds => {
      const newSelectedIds = new Set(prevSelectedIds);
      if (newSelectedIds.has(sourceId)) {
        newSelectedIds.delete(sourceId);
      } else {
        newSelectedIds.add(sourceId);
      }
      return newSelectedIds;
    });
  };

  const handleSaveChanges = async () => {
    if (!userId) return;
    setIsSaving(true);
    try {
      const sourcesToLink = Array.from(selectedSourceIds).filter(id => !initiallyLinkedSourceIds.has(id));
      const sourcesToUnlink = Array.from(initiallyLinkedSourceIds).filter(id => !selectedSourceIds.has(id));

      if (sourcesToUnlink.length > 0) {
        const { error: deleteError } = await supabase
          .from('chapter_sources')
          .delete()
          .eq('chapter_id', chapterId)
          .eq('user_id', userId) // Important for RLS on junction table
          .in('source_id', sourcesToUnlink);
        if (deleteError) throw new Error(`Erreur lors de la dissociation des sources: ${deleteError.message}`);
      }

      if (sourcesToLink.length > 0) {
        const newLinks = sourcesToLink.map(sourceId => ({
          chapter_id: chapterId,
          source_id: sourceId,
          user_id: userId, // Important for RLS on junction table
        }));
        const { error: insertError } = await supabase.from('chapter_sources').insert(newLinks);
        if (insertError) throw new Error(`Erreur lors de l'association des nouvelles sources: ${insertError.message}`);
      }

      toast({ title: "Associations Mises à Jour", description: "Les sources liées à ce chapitre ont été mises à jour." });
      if(onSuccess) onSuccess();
      // onOpenChange(false); // Parent (ChapterDetailClientView) will close modal
    } catch (e: any) {
      console.error("Erreur gestion associations sources-chapitre:", e);
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Gérer les Sources Associées à ce Chapitre</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] py-4 custom-scrollbar pr-3 -mr-3">
          <div className="space-y-2">
            {allUserSources.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">Aucune source dans votre bibliothèque. Ajoutez-en d'abord.</p>
            )}
            {allUserSources.map(source => (
              <div key={source.id} className="flex items-center space-x-3 p-2 border rounded-md hover:bg-muted/50">
                <Checkbox
                  id={`source-link-${source.id}`}
                  checked={selectedSourceIds.has(source.id)}
                  onCheckedChange={() => handleToggleSource(source.id)}
                  disabled={isSaving}
                />
                <Label htmlFor={`source-link-${source.id}`} className="flex-grow text-sm cursor-pointer">
                  <div className="flex items-center gap-2">
                    <SourceTypeIcon type={source.type} className="h-4 w-4 text-muted-foreground" />
                    <span>{source.title}</span>
                    <Badge variant="outline" className="text-xs ml-auto">{sourceTypeText(source.type)}</Badge>
                  </div>
                </Label>
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Annuler</Button>
          <Button onClick={handleSaveChanges} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Enregistrer les Associations
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageChapterSources;

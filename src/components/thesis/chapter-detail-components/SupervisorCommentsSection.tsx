
"use client";

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, MessageSquare, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation'; // Import useRouter

interface SupervisorCommentsSectionProps {
  chapterId: string;
  userId: string;
  initialComments: string[];
  // onCommentsUpdated?: () => void; // We'll use router.refresh()
}

const SupervisorCommentsSection: FC<SupervisorCommentsSectionProps> = ({
  chapterId,
  userId,
  initialComments,
}) => {
  const { toast } = useToast();
  const router = useRouter(); // Initialize router
  const [comments, setComments] = useState<string[]>(initialComments);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDelete, setIsLoadingDelete] = useState<number | null>(null);


  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  const handleSaveComment = async () => {
    if (!userId || !newCommentText.trim()) {
      toast({ title: "Erreur", description: "Le commentaire ne peut pas être vide.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const updatedComments = [...comments, newCommentText.trim()];
      const { error } = await supabase
        .from('chapters')
        .update({ supervisor_comments: updatedComments })
        .eq('id', chapterId)
        .eq('user_id', userId);

      if (error) throw error;

      // No local state update needed for comments, router.refresh() will handle it
      setNewCommentText('');
      toast({ title: "Commentaire Ajouté" });
      router.refresh(); // Refresh server component data
    } catch (e: any) {
      console.error("Erreur sauvegarde commentaire:", e);
      toast({ title: "Erreur Sauvegarde Commentaire", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteComment = async (commentIndex: number) => {
    if (!userId) return;
    setIsLoadingDelete(commentIndex);
    try {
      const updatedComments = comments.filter((_, index) => index !== commentIndex);
      const { error } = await supabase
        .from('chapters')
        .update({ supervisor_comments: updatedComments })
        .eq('id', chapterId)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      // No local state update needed
      toast({ title: "Commentaire Supprimé" });
      router.refresh(); // Refresh server component data
    } catch (e:any) {
      toast({ title: "Erreur Suppression Commentaire", description: e.message, variant: "destructive" });
    } finally {
      setIsLoadingDelete(null);
    }
  };


  return (
    <div className="space-y-4 h-full flex flex-col">
      <Label htmlFor="newCommentTextChapterDetail" className="block text-sm font-medium">Ajouter un commentaire du superviseur</Label>
      <Textarea
        id="newCommentTextChapterDetail"
        value={newCommentText}
        onChange={(e) => setNewCommentText(e.target.value)}
        placeholder="Saisissez un nouveau commentaire..."
        rows={3}
        disabled={isSaving}
        className="text-sm"
      />
      <Button onClick={handleSaveComment} disabled={isSaving || !newCommentText.trim()} className="self-end">
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
        Enregistrer Commentaire
      </Button>

      <div className="pt-4 border-t flex-grow overflow-hidden flex flex-col">
        <h4 className="text-md font-semibold mb-2 shrink-0">Commentaires Existants ({comments.length})</h4>
        {comments.length > 0 ? (
          <ScrollArea className="flex-grow custom-scrollbar pr-2 -mr-2">
            <div className="space-y-2">
              {comments.map((comment, index) => (
                <div key={index} className="p-2.5 border rounded-md bg-muted/30 flex justify-between items-start gap-2 text-sm">
                  <p className="whitespace-pre-wrap flex-grow leading-relaxed">{comment}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleDeleteComment(index)}
                    disabled={isLoadingDelete === index}
                    title="Supprimer le commentaire"
                  >
                    {isLoadingDelete === index ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive/70 hover:text-destructive" />}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">Aucun commentaire pour le moment.</p>
        )}
      </div>
    </div>
  );
};

export default SupervisorCommentsSection;

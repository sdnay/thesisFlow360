"use client";

import { useState, type FC } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import type { Chapter } from '@/types';
import { PlusCircle, Edit3, Trash2, MessageSquare } from 'lucide-react';

const initialChapters: Chapter[] = [
  { id: '1', name: 'Introduction', progress: 75, status: 'En cours', supervisorComments: ['Bon début, développer la revue de littérature.'] },
  { id: '2', name: 'Revue de Littérature', progress: 40, status: 'En révision', supervisorComments: ['Besoin de sources plus récentes.'] },
  { id: '3', name: 'Méthodologie', progress: 90, status: 'Brouillon terminé', supervisorComments: [] },
  { id: '4', name: 'Résultats', progress: 10, status: 'Non commencé', supervisorComments: [] },
  { id: '5', name: 'Discussion', progress: 0, status: 'Non commencé', supervisorComments: [] },
  { id: '6', name: 'Conclusion', progress: 0, status: 'Non commencé', supervisorComments: [] },
];

interface ChapterProgressCardProps {
  chapter: Chapter;
  onEdit: (chapter: Chapter) => void;
  onDelete: (chapterId: string) => void;
  onAddComment: (chapterId: string, comment: string) => void;
}

const ChapterProgressCard: FC<ChapterProgressCardProps> = ({ chapter, onEdit, onDelete, onAddComment }) => {
  const [comment, setComment] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);

  const handleAddComment = () => {
    if (comment.trim()) {
      onAddComment(chapter.id, comment.trim());
      setComment('');
      setShowCommentInput(false);
    }
  };

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-200">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{chapter.name}</CardTitle>
            <CardDescription>{chapter.status}</CardDescription>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => onEdit(chapter)} aria-label="Modifier le chapitre">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(chapter.id)} aria-label="Supprimer le chapitre" className="text-destructive hover:text-destructive/80">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-2 text-sm font-medium">Progression : {chapter.progress}%</div>
        <Progress value={chapter.progress} className="w-full h-3" />
        {chapter.supervisorComments.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Commentaires du superviseur :</h4>
            <ul className="list-disc list-inside text-xs space-y-1">
              {chapter.supervisorComments.map((comment, index) => (
                <li key={index}>{comment}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-2">
        {showCommentInput ? (
          <div className="w-full flex gap-2 items-center">
            <Input 
              value={comment} 
              onChange={(e) => setComment(e.target.value)} 
              placeholder="Nouveau commentaire..."
              className="flex-grow"
            />
            <Button onClick={handleAddComment} size="sm">Ajouter</Button>
            <Button onClick={() => setShowCommentInput(false)} size="sm" variant="outline">Annuler</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowCommentInput(true)}>
            <MessageSquare className="mr-2 h-4 w-4" /> Ajouter un commentaire
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};


export function ThesisDashboardSection() {
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentChapter, setCurrentChapter] = useState<Partial<Chapter> | null>(null);

  const openModalForNew = () => {
    setCurrentChapter({ name: '', progress: 0, status: 'Non commencé', supervisorComments: [] });
    setIsModalOpen(true);
  };

  const openModalForEdit = (chapter: Chapter) => {
    setCurrentChapter(chapter);
    setIsModalOpen(true);
  };

  const handleSaveChapter = () => {
    if (!currentChapter || !currentChapter.name) return; 

    if (currentChapter.id) { 
      setChapters(chapters.map(ch => ch.id === currentChapter.id ? currentChapter as Chapter : ch));
    } else { 
      const newChapter: Chapter = {
        ...currentChapter,
        id: Date.now().toString(), 
      } as Chapter;
      setChapters([...chapters, newChapter]);
    }
    setIsModalOpen(false);
    setCurrentChapter(null);
  };
  
  const handleDeleteChapter = (chapterId: string) => {
    setChapters(chapters.filter(ch => ch.id !== chapterId));
  };

  const handleAddCommentToChapter = (chapterId: string, comment: string) => {
    setChapters(chapters.map(ch => 
      ch.id === chapterId ? { ...ch, supervisorComments: [...ch.supervisorComments, comment] } : ch
    ));
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Tableau de Bord de la Thèse</h2>
        <Button onClick={openModalForNew}>
          <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un Chapitre
        </Button>
      </div>

      {chapters.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">Aucun chapitre ajouté pour le moment. Commencez par ajouter votre premier chapitre !</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {chapters.map((chapter) => (
            <ChapterProgressCard 
              key={chapter.id} 
              chapter={chapter} 
              onEdit={openModalForEdit}
              onDelete={handleDeleteChapter}
              onAddComment={handleAddCommentToChapter}
            />
          ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentChapter?.id ? 'Modifier le Chapitre' : 'Ajouter un Nouveau Chapitre'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="chapterName" className="block text-sm font-medium mb-1">Nom du Chapitre</label>
              <Input
                id="chapterName"
                value={currentChapter?.name || ''}
                onChange={(e) => setCurrentChapter(prev => ({ ...prev, name: e.target.value }))}
                placeholder="ex : Introduction"
              />
            </div>
            <div>
              <label htmlFor="chapterProgress" className="block text-sm font-medium mb-1">Progression (%)</label>
              <Input
                id="chapterProgress"
                type="number"
                min="0"
                max="100"
                value={currentChapter?.progress || 0}
                onChange={(e) => setCurrentChapter(prev => ({ ...prev, progress: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
            <div>
              <label htmlFor="chapterStatus" className="block text-sm font-medium mb-1">Statut</label>
              <Input
                id="chapterStatus"
                value={currentChapter?.status || ''}
                onChange={(e) => setCurrentChapter(prev => ({ ...prev, status: e.target.value }))}
                placeholder="ex : En cours"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveChapter}>Enregistrer le Chapitre</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

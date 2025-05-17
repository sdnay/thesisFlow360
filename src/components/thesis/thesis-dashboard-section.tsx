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
  { id: '1', name: 'Introduction', progress: 75, status: 'In Progress', supervisorComments: ['Good start, expand on literature review.'] },
  { id: '2', name: 'Literature Review', progress: 40, status: 'Under Review', supervisorComments: ['Needs more recent sources.'] },
  { id: '3', name: 'Methodology', progress: 90, status: 'Draft Completed', supervisorComments: [] },
  { id: '4', name: 'Results', progress: 10, status: 'Not Started', supervisorComments: [] },
  { id: '5', name: 'Discussion', progress: 0, status: 'Not Started', supervisorComments: [] },
  { id: '6', name: 'Conclusion', progress: 0, status: 'Not Started', supervisorComments: [] },
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
            <Button variant="ghost" size="icon" onClick={() => onEdit(chapter)} aria-label="Edit chapter">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(chapter.id)} aria-label="Delete chapter" className="text-destructive hover:text-destructive/80">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-2 text-sm font-medium">Progress: {chapter.progress}%</div>
        <Progress value={chapter.progress} className="w-full h-3" />
        {chapter.supervisorComments.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Supervisor Comments:</h4>
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
              placeholder="New comment..."
              className="flex-grow"
            />
            <Button onClick={handleAddComment} size="sm">Add</Button>
            <Button onClick={() => setShowCommentInput(false)} size="sm" variant="outline">Cancel</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowCommentInput(true)}>
            <MessageSquare className="mr-2 h-4 w-4" /> Add Comment
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
    setCurrentChapter({ name: '', progress: 0, status: 'Not Started', supervisorComments: [] });
    setIsModalOpen(true);
  };

  const openModalForEdit = (chapter: Chapter) => {
    setCurrentChapter(chapter);
    setIsModalOpen(true);
  };

  const handleSaveChapter = () => {
    if (!currentChapter || !currentChapter.name) return; // Basic validation

    if (currentChapter.id) { // Editing existing chapter
      setChapters(chapters.map(ch => ch.id === currentChapter.id ? currentChapter as Chapter : ch));
    } else { // Adding new chapter
      const newChapter: Chapter = {
        ...currentChapter,
        id: Date.now().toString(), // Simple ID generation
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
        <h2 className="text-2xl font-semibold">Thesis Dashboard</h2>
        <Button onClick={openModalForNew}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Chapter
        </Button>
      </div>

      {chapters.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">No chapters added yet. Get started by adding your first chapter!</p>
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
            <DialogTitle>{currentChapter?.id ? 'Edit Chapter' : 'Add New Chapter'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="chapterName" className="block text-sm font-medium mb-1">Chapter Name</label>
              <Input
                id="chapterName"
                value={currentChapter?.name || ''}
                onChange={(e) => setCurrentChapter(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Introduction"
              />
            </div>
            <div>
              <label htmlFor="chapterProgress" className="block text-sm font-medium mb-1">Progress (%)</label>
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
              <label htmlFor="chapterStatus" className="block text-sm font-medium mb-1">Status</label>
              <Input
                id="chapterStatus"
                value={currentChapter?.status || ''}
                onChange={(e) => setCurrentChapter(prev => ({ ...prev, status: e.target.value }))}
                placeholder="e.g., In Progress"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveChapter}>Save Chapter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

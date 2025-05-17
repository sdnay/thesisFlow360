"use client";

import { useState, type FC } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import type { Source } from '@/types';
import { PlusCircle, Edit3, Trash2, LinkIcon, FileText, Mic, BookOpen } from 'lucide-react';
import { format } from 'date-fns';

const initialSources: Source[] = [
  { id: 's1', title: 'The Structure of Scientific Revolutions', type: 'pdf', sourceLinkOrPath: 'kuhn_structure.pdf', notes: 'Key text on paradigm shifts.', createdAt: new Date().toISOString() },
  { id: 's2', title: 'Stanford Encyclopedia of Philosophy - Epistemology', type: 'website', sourceLinkOrPath: 'https://plato.stanford.edu/entries/epistemology/', createdAt: new Date().toISOString() },
];

const SourceTypeIcon: FC<{ type: Source['type'] }> = ({ type }) => {
  switch (type) {
    case 'pdf': return <FileText className="h-4 w-4 text-red-500" />;
    case 'website': return <LinkIcon className="h-4 w-4 text-blue-500" />;
    case 'interview': return <Mic className="h-4 w-4 text-green-500" />;
    case 'field_notes': return <BookOpen className="h-4 w-4 text-orange-500" />;
    default: return <FileText className="h-4 w-4 text-gray-500" />;
  }
};

const SourceItemCard: FC<{ source: Source, onEdit: (source: Source) => void, onDelete: (id: string) => void }> = ({ source, onEdit, onDelete }) => {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <SourceTypeIcon type={source.type} />
            <CardTitle className="text-base">{source.title}</CardTitle>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => onEdit(source)} aria-label="Edit source">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(source.id)} aria-label="Delete source" className="text-destructive hover:text-destructive/80">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">
          Type: {source.type} | Added: {format(new Date(source.createdAt), "MMM d, yyyy")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {source.sourceLinkOrPath && (
          <p className="text-xs truncate mb-1">
            Path/Link: <a href={source.sourceLinkOrPath.startsWith('http') ? source.sourceLinkOrPath : '#'} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{source.sourceLinkOrPath}</a>
          </p>
        )}
        {source.notes && <p className="text-sm text-muted-foreground whitespace-pre-wrap">Notes: {source.notes}</p>}
      </CardContent>
    </Card>
  );
};

export function SourceLibrarySection() {
  const [sources, setSources] = useState<Source[]>(initialSources);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSource, setCurrentSource] = useState<Partial<Source> | null>(null);
  const sourceTypes: Source['type'][] = ["pdf", "website", "interview", "field_notes", "other"];

  const openModalForNew = () => {
    setCurrentSource({ title: '', type: 'pdf', sourceLinkOrPath: '', notes: '', createdAt: new Date().toISOString() });
    setIsModalOpen(true);
  };

  const openModalForEdit = (source: Source) => {
    setCurrentSource(source);
    setIsModalOpen(true);
  };

  const handleSaveSource = () => {
    if (!currentSource || !currentSource.title || !currentSource.type) return; 

    if (currentSource.id) { // Editing existing source
      setSources(sources.map(s => s.id === currentSource.id ? currentSource as Source : s));
    } else { // Adding new source
      const newSource: Source = {
        ...currentSource,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      } as Source;
      setSources([newSource, ...sources]);
    }
    setIsModalOpen(false);
    setCurrentSource(null);
  };
  
  const handleDeleteSource = (sourceId: string) => {
    setSources(sources.filter(s => s.id !== sourceId));
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Source Library</h2>
        <Button onClick={openModalForNew}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Source
        </Button>
      </div>

      {sources.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">No sources added yet. Start building your library!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
          {sources.map((source) => (
            <SourceItemCard 
              key={source.id} 
              source={source} 
              onEdit={openModalForEdit}
              onDelete={handleDeleteSource}
            />
          ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{currentSource?.id ? 'Edit Source' : 'Add New Source'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="sourceTitle" className="block text-sm font-medium mb-1">Title</label>
              <Input
                id="sourceTitle"
                value={currentSource?.title || ''}
                onChange={(e) => setCurrentSource(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Journal Article Name"
              />
            </div>
            <div>
              <label htmlFor="sourceType" className="block text-sm font-medium mb-1">Type</label>
              <Select
                value={currentSource?.type || 'pdf'}
                onValueChange={(value) => setCurrentSource(prev => ({ ...prev, type: value as Source['type'] }))}
              >
                <SelectTrigger id="sourceType">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {sourceTypes.map(type => (
                    <SelectItem key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
             <div>
              <label htmlFor="sourceLinkOrPath" className="block text-sm font-medium mb-1">Link or File Path (Optional)</label>
              <Input
                id="sourceLinkOrPath"
                value={currentSource?.sourceLinkOrPath || ''}
                onChange={(e) => setCurrentSource(prev => ({ ...prev, sourceLinkOrPath: e.target.value }))}
                placeholder="e.g., https://example.com/article or /docs/my_paper.pdf"
              />
            </div>
            <div>
              <label htmlFor="sourceNotes" className="block text-sm font-medium mb-1">Notes (Optional)</label>
              <Textarea
                id="sourceNotes"
                value={currentSource?.notes || ''}
                onChange={(e) => setCurrentSource(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Key takeaways, quotes, etc."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSource}>Save Source</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

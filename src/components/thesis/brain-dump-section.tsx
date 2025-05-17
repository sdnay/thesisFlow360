"use client";

import { useState, type FC } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { BrainDumpEntry } from '@/types';
import { Lightbulb, ListChecks, Trash2, Archive, Save } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const initialBrainDumps: BrainDumpEntry[] = [
  { id: 'bd1', text: 'Explore Foucault\'s concept of power in relation to social media.', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), status: 'captured' },
  { id: 'bd2', text: 'Quote: "The limits of my language mean the limits of my world." - Wittgenstein. Check original source.', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), status: 'idea' },
];

const BrainDumpItemCard: FC<{ entry: BrainDumpEntry, onUpdateStatus: (id: string, status: BrainDumpEntry['status']) => void, onDelete: (id: string) => void }> = ({ entry, onUpdateStatus, onDelete }) => {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <p className="text-sm whitespace-pre-wrap">{entry.text}</p>
      </CardContent>
      <CardFooter className="flex justify-between items-center text-xs text-muted-foreground pt-2">
        <span>{formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })} - Status: <span className="font-medium">{entry.status}</span></span>
        <div className="flex gap-1">
          {entry.status === 'captured' && (
            <>
              <Button variant="ghost" size="icon" onClick={() => onUpdateStatus(entry.id, 'task')} title="Mark as Task">
                <ListChecks className="h-4 w-4 text-blue-500" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onUpdateStatus(entry.id, 'idea')} title="Mark as Idea">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={() => onUpdateStatus(entry.id, 'discarded')} title="Discard">
             <Archive className="h-4 w-4 text-gray-500" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(entry.id)} title="Delete Permanently" className="text-destructive hover:text-destructive/80">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}


export function BrainDumpSection() {
  const [brainDumps, setBrainDumps] = useState<BrainDumpEntry[]>(initialBrainDumps);
  const [newDumpText, setNewDumpText] = useState('');

  const handleAddDump = () => {
    if (newDumpText.trim() === '') return;
    const newEntry: BrainDumpEntry = {
      id: Date.now().toString(),
      text: newDumpText.trim(),
      createdAt: new Date().toISOString(),
      status: 'captured',
    };
    setBrainDumps([newEntry, ...brainDumps]);
    setNewDumpText('');
  };

  const handleUpdateStatus = (id: string, status: BrainDumpEntry['status']) => {
    setBrainDumps(prevDumps => prevDumps.map(dump => dump.id === id ? { ...dump, status } : dump));
  };
  
  const handleDeleteDump = (id: string) => {
    setBrainDumps(prevDumps => prevDumps.filter(dump => dump.id !== id));
  };

  const capturedDumps = brainDumps.filter(d => d.status === 'captured');
  const ideaDumps = brainDumps.filter(d => d.status === 'idea');
  const taskDumps = brainDumps.filter(d => d.status === 'task');
  const discardedDumps = brainDumps.filter(d => d.status === 'discarded');


  return (
    <div className="p-4 md:p-6 space-y-6">
      <h2 className="text-2xl font-semibold">Brain Dump</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>Capture New Idea</CardTitle>
          <CardDescription>Jot down any thoughts, quotes, or tasks that come to mind.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={newDumpText}
            onChange={(e) => setNewDumpText(e.target.value)}
            placeholder="Type your thoughts here..."
            rows={4}
            className="mb-2"
          />
        </CardContent>
        <CardFooter>
          <Button onClick={handleAddDump} disabled={!newDumpText.trim()}>
            <Save className="mr-2 h-4 w-4" /> Save Dump
          </Button>
        </CardFooter>
      </Card>

      {brainDumps.length === 0 && !newDumpText && (
         <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">Your mind is clear! Or, start dumping your thoughts above.</p>
          </CardContent>
        </Card>
      )}

      {capturedDumps.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-2">To Clarify ({capturedDumps.length})</h3>
          <div className="space-y-3">
            {capturedDumps.map(entry => <BrainDumpItemCard key={entry.id} entry={entry} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteDump} />)}
          </div>
        </div>
      )}

      {ideaDumps.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-2">Useful Ideas ({ideaDumps.length})</h3>
           <div className="space-y-3">
            {ideaDumps.map(entry => <BrainDumpItemCard key={entry.id} entry={entry} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteDump} />)}
          </div>
        </div>
      )}
      
      {taskDumps.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-2">Tasks ({taskDumps.length})</h3>
           <div className="space-y-3">
            {taskDumps.map(entry => <BrainDumpItemCard key={entry.id} entry={entry} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteDump} />)}
          </div>
        </div>
      )}

      {discardedDumps.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-2">Discarded ({discardedDumps.length})</h3>
           <div className="space-y-3">
            {discardedDumps.map(entry => <BrainDumpItemCard key={entry.id} entry={entry} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteDump} />)}
          </div>
        </div>
      )}
    </div>
  );
}

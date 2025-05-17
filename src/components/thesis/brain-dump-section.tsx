"use client";

import { useState, type FC } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { BrainDumpEntry } from '@/types';
import { Lightbulb, ListChecks, Trash2, Archive, Save } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const initialBrainDumps: BrainDumpEntry[] = [
  { id: 'bd1', text: 'Explorer le concept de pouvoir de Foucault par rapport aux médias sociaux.', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), status: 'captured' },
  { id: 'bd2', text: 'Citation : "Les limites de mon langage signifient les limites de mon monde." - Wittgenstein. Vérifier la source originale.', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), status: 'idea' },
];

const BrainDumpItemCard: FC<{ entry: BrainDumpEntry, onUpdateStatus: (id: string, status: BrainDumpEntry['status']) => void, onDelete: (id: string) => void }> = ({ entry, onUpdateStatus, onDelete }) => {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <p className="text-sm whitespace-pre-wrap">{entry.text}</p>
      </CardContent>
      <CardFooter className="flex justify-between items-center text-xs text-muted-foreground pt-2">
        <span>{formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true, locale: fr })} - Statut : <span className="font-medium">{entry.status === "captured" ? "Capturé" : entry.status === "idea" ? "Idée" : entry.status === "task" ? "Tâche" : "Écarté"}</span></span>
        <div className="flex gap-1">
          {entry.status === 'captured' && (
            <>
              <Button variant="ghost" size="icon" onClick={() => onUpdateStatus(entry.id, 'task')} title="Marquer comme Tâche">
                <ListChecks className="h-4 w-4 text-blue-500" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onUpdateStatus(entry.id, 'idea')} title="Marquer comme Idée">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={() => onUpdateStatus(entry.id, 'discarded')} title="Écarter">
             <Archive className="h-4 w-4 text-gray-500" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(entry.id)} title="Supprimer Définitivement" className="text-destructive hover:text-destructive/80">
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
      <h2 className="text-2xl font-semibold">Vide-Cerveau</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>Capturer une Nouvelle Idée</CardTitle>
          <CardDescription>Notez toutes les pensées, citations ou tâches qui vous viennent à l'esprit.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={newDumpText}
            onChange={(e) => setNewDumpText(e.target.value)}
            placeholder="Écrivez vos pensées ici..."
            rows={4}
            className="mb-2"
          />
        </CardContent>
        <CardFooter>
          <Button onClick={handleAddDump} disabled={!newDumpText.trim()}>
            <Save className="mr-2 h-4 w-4" /> Enregistrer la Note
          </Button>
        </CardFooter>
      </Card>

      {brainDumps.length === 0 && !newDumpText && (
         <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">Votre esprit est clair ! Ou commencez à décharger vos pensées ci-dessus.</p>
          </CardContent>
        </Card>
      )}

      {capturedDumps.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-2">À Clarifier ({capturedDumps.length})</h3>
          <div className="space-y-3">
            {capturedDumps.map(entry => <BrainDumpItemCard key={entry.id} entry={entry} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteDump} />)}
          </div>
        </div>
      )}

      {ideaDumps.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-2">Idées Utiles ({ideaDumps.length})</h3>
           <div className="space-y-3">
            {ideaDumps.map(entry => <BrainDumpItemCard key={entry.id} entry={entry} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteDump} />)}
          </div>
        </div>
      )}
      
      {taskDumps.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-2">Tâches ({taskDumps.length})</h3>
           <div className="space-y-3">
            {taskDumps.map(entry => <BrainDumpItemCard key={entry.id} entry={entry} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteDump} />)}
          </div>
        </div>
      )}

      {discardedDumps.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-2">Écartées ({discardedDumps.length})</h3>
           <div className="space-y-3">
            {discardedDumps.map(entry => <BrainDumpItemCard key={entry.id} entry={entry} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteDump} />)}
          </div>
        </div>
      )}
    </div>
  );
}

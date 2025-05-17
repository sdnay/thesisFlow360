
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { BrainDumpEntry } from '@/types';
import { Lightbulb, ListChecks, Trash2, Archive, Save, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

interface BrainDumpItemCardProps { 
  entry: BrainDumpEntry;
  onUpdateStatus: (id: string, status: BrainDumpEntry['status']) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading: boolean;
}

const BrainDumpItemCard: FC<BrainDumpItemCardProps> = ({ entry, onUpdateStatus, onDelete, isLoading }) => {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <p className="text-sm whitespace-pre-wrap">{entry.text}</p>
      </CardContent>
      <CardFooter className="flex justify-between items-center text-xs text-muted-foreground pt-2">
        <span>{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: fr })} - Statut : <span className="font-medium">{entry.status === "captured" ? "Capturé" : entry.status === "idea" ? "Idée" : entry.status === "task" ? "Tâche" : "Écarté"}</span></span>
        <div className="flex gap-1">
          {entry.status === 'captured' && (
            <>
              <Button variant="ghost" size="icon" onClick={() => onUpdateStatus(entry.id, 'task')} title="Marquer comme Tâche" disabled={isLoading}>
                <ListChecks className="h-4 w-4 text-blue-500" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onUpdateStatus(entry.id, 'idea')} title="Marquer comme Idée" disabled={isLoading}>
                <Lightbulb className="h-4 w-4 text-yellow-500" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={() => onUpdateStatus(entry.id, 'discarded')} title="Écarter" disabled={isLoading || entry.status === 'discarded'}>
             <Archive className="h-4 w-4 text-gray-500" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(entry.id)} title="Supprimer Définitivement" className="text-destructive hover:text-destructive/80" disabled={isLoading}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}


export function BrainDumpSection() {
  const [brainDumps, setBrainDumps] = useState<BrainDumpEntry[]>([]);
  const [newDumpText, setNewDumpText] = useState('');
  const [isLoading, setIsLoading] = useState(false); // For add operation
  const [isCardLoading, setIsCardLoading] = useState(false); // For card operations (update/delete)
  const [isFetching, setIsFetching] = useState(true);
  const { toast } = useToast();

  const fetchBrainDumps = useCallback(async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('brain_dump_entries')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBrainDumps(data || []);
    } catch (e: any) {
      toast({ title: "Erreur", description: "Impossible de charger les notes du vide-cerveau.", variant: "destructive" });
      console.error("Erreur fetchBrainDumps:", e);
    } finally {
      setIsFetching(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBrainDumps();
  }, [fetchBrainDumps]);

  const handleAddDump = async () => {
    if (newDumpText.trim() === '') return;
    setIsLoading(true);
    try {
      const newEntryPayload: Omit<BrainDumpEntry, 'id' | 'created_at'> = {
        text: newDumpText.trim(),
        status: 'captured',
      };
      const { error } = await supabase.from('brain_dump_entries').insert(newEntryPayload);
      if (error) throw error;
      setNewDumpText('');
      await fetchBrainDumps();
      toast({ title: "Note ajoutée", description: "Votre pensée a été capturée." });
    } catch (e: any) {
      toast({ title: "Erreur d'ajout", description: e.message, variant: "destructive" });
      console.error("Erreur handleAddDump:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: BrainDumpEntry['status']) => {
    setIsCardLoading(true);
    try {
      const { error } = await supabase.from('brain_dump_entries').update({ status }).eq('id', id);
      if (error) throw error;
      await fetchBrainDumps(); // Refresh list
    } catch (e: any) {
      toast({ title: "Erreur de mise à jour", description: e.message, variant: "destructive" });
      console.error("Erreur handleUpdateStatus:", e);
    } finally {
      setIsCardLoading(false);
    }
  };
  
  const handleDeleteDump = async (id: string) => {
    setIsCardLoading(true);
    try {
      const { error } = await supabase.from('brain_dump_entries').delete().eq('id', id);
      if (error) throw error;
      await fetchBrainDumps(); // Refresh list
      toast({ title: "Note supprimée" });
    } catch (e: any) {
      toast({ title: "Erreur de suppression", description: e.message, variant: "destructive" });
      console.error("Erreur handleDeleteDump:", e);
    } finally {
      setIsCardLoading(false);
    }
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
            disabled={isLoading || isFetching}
          />
        </CardContent>
        <CardFooter>
          <Button onClick={handleAddDump} disabled={isLoading || !newDumpText.trim() || isFetching}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Enregistrer la Note
          </Button>
        </CardFooter>
      </Card>

      {isFetching ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : brainDumps.length === 0 && !newDumpText ? (
         <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">Votre esprit est clair ! Ou commencez à décharger vos pensées ci-dessus.</p>
          </CardContent>
        </Card>
      ) : null}

      {capturedDumps.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-2">À Clarifier ({capturedDumps.length})</h3>
          <div className="space-y-3">
            {capturedDumps.map(entry => <BrainDumpItemCard key={entry.id} entry={entry} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteDump} isLoading={isCardLoading} />)}
          </div>
        </div>
      )}

      {ideaDumps.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-2">Idées Utiles ({ideaDumps.length})</h3>
           <div className="space-y-3">
            {ideaDumps.map(entry => <BrainDumpItemCard key={entry.id} entry={entry} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteDump} isLoading={isCardLoading} />)}
          </div>
        </div>
      )}
      
      {taskDumps.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-2">Tâches ({taskDumps.length})</h3>
           <div className="space-y-3">
            {taskDumps.map(entry => <BrainDumpItemCard key={entry.id} entry={entry} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteDump} isLoading={isCardLoading}/>)}
          </div>
        </div>
      )}

      {discardedDumps.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-2">Écartées ({discardedDumps.length})</h3>
           <div className="space-y-3">
            {discardedDumps.map(entry => <BrainDumpItemCard key={entry.id} entry={entry} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteDump} isLoading={isCardLoading}/>)}
          </div>
        </div>
      )}
    </div>
  );
}

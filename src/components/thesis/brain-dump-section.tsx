
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { BrainDumpEntry } from '@/types';
import { Lightbulb, ListChecks, Trash2, Archive, Save, Loader2, Brain, Zap, ArchiveRestore, PlusCircle } from 'lucide-react'; 
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BrainDumpItemCardProps { 
  entry: BrainDumpEntry;
  onUpdateStatus: (id: string, status: BrainDumpEntry['status']) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading: boolean;
}

const statusConfig: Record<BrainDumpEntry['status'], { label: string; icon: FC<any>; color: string; description: string; actions?: Array<{ toStatus: BrainDumpEntry['status']; label: string; icon: FC<any>; condition?: (entry: BrainDumpEntry) => boolean }> }> = {
  captured: {
    label: 'Capturé',
    icon: Zap,
    color: 'bg-blue-50 border-blue-400 text-blue-700',
    description: 'Pensées brutes, à trier.',
    actions: [
      { toStatus: 'task', label: 'Vers Tâche', icon: ListChecks },
      { toStatus: 'idea', label: 'Vers Idée', icon: Lightbulb },
      { toStatus: 'discarded', label: 'Écarter', icon: Archive },
    ],
  },
  task: {
    label: 'Tâche',
    icon: ListChecks,
    color: 'bg-amber-50 border-amber-400 text-amber-700',
    description: 'Actions concrètes à planifier.',
    actions: [
      { toStatus: 'idea', label: 'Vers Idée', icon: Lightbulb },
      { toStatus: 'discarded', label: 'Écarter', icon: Archive },
    ],
  },
  idea: {
    label: 'Idée',
    icon: Lightbulb,
    color: 'bg-lime-50 border-lime-400 text-lime-700',
    description: 'Concepts à explorer ou développer.',
    actions: [
      { toStatus: 'task', label: 'Vers Tâche', icon: ListChecks },
      { toStatus: 'discarded', label: 'Écarter', icon: Archive },
    ],
  },
  discarded: {
    label: 'Écarté',
    icon: Archive,
    color: 'bg-gray-100 border-gray-300 text-gray-600 opacity-70',
    description: 'Notes jugées non pertinentes.',
    actions: [
      { toStatus: 'captured', label: 'Restaurer', icon: ArchiveRestore },
    ],
  },
};


const BrainDumpItemCard: FC<BrainDumpItemCardProps> = ({ entry, onUpdateStatus, onDelete, isLoading }) => {
  const config = statusConfig[entry.status];
  return (
    <Card className={cn("shadow-sm hover:shadow-lg transition-shadow flex flex-col", config.color, "border-2")}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex justify-between items-center">
            <Badge variant="outline" className={cn("text-xs font-medium", config.color, "border-current")}>
                <config.icon className="mr-1.5 h-3.5 w-3.5" />
                {config.label}
            </Badge>
            <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: fr })}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-1 pb-3 px-4 flex-grow">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{entry.text}</p>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-2 pb-3 px-4 border-t">
        <div className="flex gap-1 flex-wrap">
          {config.actions?.map(action => {
            if (action.condition && !action.condition(entry)) return null;
            return (
              <Button 
                key={action.toStatus}
                variant="outline" 
                size="xs" 
                onClick={() => onUpdateStatus(entry.id, action.toStatus)} 
                title={action.label} 
                disabled={isLoading}
                className="text-xs bg-card hover:bg-muted/50 text-foreground"
              >
                <action.icon className="mr-1 h-3 w-3" /> {action.label}
              </Button>
            )
          })}
        </div>
        <Button variant="ghost" size="icon" onClick={() => onDelete(entry.id)} title="Supprimer Définitivement" className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 h-7 w-7" disabled={isLoading}>
            <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}


export function BrainDumpSection() {
  const [brainDumps, setBrainDumps] = useState<BrainDumpEntry[]>([]);
  const [newDumpText, setNewDumpText] = useState('');
  const [isAddingLoading, setIsAddingLoading] = useState(false);
  const [isCardLoading, setIsCardLoading] = useState<string | null>(null);
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
      toast({ title: "Erreur", description: "Impossible de charger les notes.", variant: "destructive" });
      console.error("Erreur fetchBrainDumps:", e);
    } finally {
      setIsFetching(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBrainDumps();
    const channel = supabase
      .channel('db-braindump-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brain_dump_entries' }, fetchBrainDumps)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBrainDumps]);

  const handleAddDump = async () => {
    if (newDumpText.trim() === '') return;
    setIsAddingLoading(true);
    try {
      const newEntryPayload: Omit<BrainDumpEntry, 'id' | 'created_at'> = {
        text: newDumpText.trim(),
        status: 'captured',
      };
      const { error } = await supabase.from('brain_dump_entries').insert(newEntryPayload);
      if (error) throw error;
      setNewDumpText('');
      toast({ title: "Note ajoutée", description: "Votre pensée a été capturée." });
      // Data will be refetched by Supabase listener
    } catch (e: any) {
      toast({ title: "Erreur d'ajout", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleAddDump:", e);
    } finally {
      setIsAddingLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: BrainDumpEntry['status']) => {
    setIsCardLoading(id);
    try {
      const { error } = await supabase.from('brain_dump_entries').update({ status }).eq('id', id);
      if (error) throw error;
      // Data will be refetched by Supabase listener
    } catch (e: any) {
      toast({ title: "Erreur de mise à jour", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleUpdateStatus:", e);
    } finally {
      setIsCardLoading(null);
    }
  };
  
  const handleDeleteDump = async (id: string) => {
    setIsCardLoading(id);
    try {
      const { error } = await supabase.from('brain_dump_entries').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Note supprimée" });
      // Data will be refetched by Supabase listener
    } catch (e: any) {
      toast({ title: "Erreur de suppression", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleDeleteDump:", e);
    } finally {
      setIsCardLoading(null);
    }
  };

  const groupedDumps = brainDumps.reduce((acc, entry) => {
    (acc[entry.status] = acc[entry.status] || []).push(entry);
    return acc;
  }, {} as Record<BrainDumpEntry['status'], BrainDumpEntry[]>);

  const statusOrder: BrainDumpEntry['status'][] = ['captured', 'idea', 'task', 'discarded'];


  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex items-center gap-3">
        <Brain className="h-7 w-7 text-primary" />
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Vide-Cerveau</h1>
      </div>
      
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Capturer une Pensée / Idée</CardTitle>
          <CardDescription className="text-xs md:text-sm">Notez rapidement tout ce qui vous vient à l'esprit.</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <Textarea
            value={newDumpText}
            onChange={(e) => setNewDumpText(e.target.value)}
            placeholder="Écrivez ici..."
            rows={3}
            className="mb-3 text-sm"
            disabled={isAddingLoading || isFetching}
          />
        </CardContent>
        <CardFooter>
          <Button onClick={handleAddDump} disabled={isAddingLoading || !newDumpText.trim() || isFetching}>
            {isAddingLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Enregistrer la Note
          </Button>
        </CardFooter>
      </Card>

      {isFetching ? (
        <Card className="flex-grow flex flex-col items-center justify-center text-center p-6">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Chargement des notes...</p>
        </Card>
      ) : brainDumps.length === 0 && !newDumpText ? (
         <Card className="flex-grow flex flex-col items-center justify-center text-center p-6 border-dashed">
            <Brain className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4"/>
            <CardTitle className="text-xl">Votre esprit est clair !</CardTitle>
            <p className="text-muted-foreground my-2 max-w-md mx-auto">Le vide-cerveau est l'endroit idéal pour noter rapidement des idées, des tâches ou des pensées fugaces avant de les oublier.</p>
            <Button onClick={() => document.querySelector('textarea')?.focus()} size="lg" className="mt-2">
                <PlusCircle className="mr-2 h-5 w-5"/>Noter la première idée
            </Button>
        </Card>
      ) : (
        <div className="flex-grow space-y-6 overflow-y-auto custom-scrollbar pr-1 pb-4">
          {statusOrder.map(statusKey => {
            const entries = groupedDumps[statusKey] || [];
            const config = statusConfig[statusKey];
            if (entries.length === 0 && statusKey !== 'captured' ) return null; 

            return (
              <div key={statusKey}>
                <h2 className="text-lg md:text-xl font-semibold mb-3 flex items-center gap-2">
                  <config.icon className={cn("h-5 w-5", config.color.replace(/bg-(\w+)-50/, 'text-$1-600'))} />
                  {config.label} <Badge variant="secondary" className="text-sm">{entries.length}</Badge>
                </h2>
                 <CardDescription className="ml-7 -mt-2 mb-3 text-sm">{config.description}</CardDescription>
                {entries.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {entries.map(entry => <BrainDumpItemCard key={entry.id} entry={entry} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteDump} isLoading={isCardLoading === entry.id} />)}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic ml-7 py-4">Aucune note dans cette catégorie pour le moment.</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  );
}

// src/components/thesis/brain-dump-section.tsx
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { BrainDumpEntry, BrainDumpEntryStatus } from '@/types';
import { Loader2, Brain, PlusCircle, Archive } from 'lucide-react'; // Removed unused icons from here
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import BrainDumpItemCard from './brain-dump-components/BrainDumpItemCard';
import { statusConfigDefinition, type StatusConfigType } from './brain-dump-components/brainDumpConstants';

export function BrainDumpSection() {
  const { user } = useAuth();
  const [brainDumps, setBrainDumps] = useState<BrainDumpEntry[]>([]);
  const [newDumpText, setNewDumpText] = useState('');
  const [isAddingLoading, setIsAddingLoading] = useState(false);
  const [isCardLoading, setIsCardLoading] = useState<string | null>(null); // ID of the card being actioned upon
  const [isFetching, setIsFetching] = useState(true);
  const { toast } = useToast();

  const fetchBrainDumps = useCallback(async () => {
    if (!user) {
      setBrainDumps([]); // Clear data if no user
      setIsFetching(false);
      return;
    }
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('brain_dump_entries')
        .select('*')
        .eq('user_id', user.id) // Filter by user
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBrainDumps(data || []);
    } catch (e: any) {
      toast({ title: "Erreur de chargement", description: "Impossible de charger les notes du vide-cerveau.", variant: "destructive" });
      console.error("Erreur fetchBrainDumps:", e);
    } finally {
      setIsFetching(false);
    }
  }, [toast, user]);

  useEffect(() => {
    fetchBrainDumps();
  }, [fetchBrainDumps]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`db-braindump-section-user-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brain_dump_entries', filter: `user_id=eq.${user.id}` }, (payload) => {
        console.log('BrainDump Realtime event:', payload);
        fetchBrainDumps();
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to BrainDump updates for user ${user.id}`);
        }
        if (err) {
          console.error('BrainDump Realtime subscription error:', err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchBrainDumps]);

  const handleAddDump = async () => {
    if (newDumpText.trim() === '' || !user) return;
    setIsAddingLoading(true);
    try {
      const newEntryPayload: Omit<BrainDumpEntry, 'id' | 'created_at' | 'user_id'> & { user_id: string } = {
        text: newDumpText.trim(),
        status: 'captured',
        user_id: user.id,
      };
      const { data: newEntry, error } = await supabase.from('brain_dump_entries').insert(newEntryPayload).select().single();
      if (error) throw error;
      if (newEntry) {
        // Optimistic update or rely on realtime
        // setBrainDumps(prev => [newEntry, ...prev]); // Manual update if not relying on realtime for immediate feedback
      }
      setNewDumpText('');
      toast({ title: "Note ajoutée", description: "Votre pensée a été capturée." });
    } catch (e: any) {
      toast({ title: "Erreur d'ajout", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleAddDump:", e);
    } finally {
      setIsAddingLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: BrainDumpEntryStatus) => {
    if (!user) return;
    setIsCardLoading(id);
    try {
      const { data: updatedEntry, error } = await supabase
        .from('brain_dump_entries')
        .update({ status })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      if (updatedEntry) {
        // Optimistic update or rely on realtime
        // setBrainDumps(prev => prev.map(entry => entry.id === id ? updatedEntry : entry));
      }
      toast({ title: "Statut mis à jour" });
    } catch (e: any) {
      toast({ title: "Erreur de mise à jour", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleUpdateStatus:", e);
    } finally {
      setIsCardLoading(null);
    }
  };

  const handleDeleteDump = async (id: string) => {
    if (!user) return;
    setIsCardLoading(id);
    try {
      const { error } = await supabase
        .from('brain_dump_entries')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      // Optimistic update or rely on realtime
      // setBrainDumps(prev => prev.filter(entry => entry.id !== id));
      toast({ title: "Note supprimée" });
    } catch (e: any) {
      toast({ title: "Erreur de suppression", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleDeleteDump:", e);
    } finally {
      setIsCardLoading(null);
    }
  };

  const mainStatusOrder: Array<keyof StatusConfigType> = ['captured', 'idea', 'task'];
  const discardedStatusKey: keyof StatusConfigType = 'discarded';

  const groupedDumps = brainDumps.reduce((acc, entry) => {
    const currentStatus = entry.status as BrainDumpEntryStatus; // entry.status should already be BrainDumpEntryStatus
    (acc[currentStatus] = acc[currentStatus] || []).push(entry);
    return acc;
  }, {} as Record<BrainDumpEntryStatus, BrainDumpEntry[]>);

  if (isFetching && !user) { // Show initial loader if user is not yet available (relevant if page loads before auth context resolves)
     return (
        <div className="p-4 md:p-6 h-full flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-3" />
            <p className="text-muted-foreground">Chargement...</p>
        </div>
    );
  }
  if (isFetching && brainDumps.length === 0) { // Show loader if fetching and no data yet
    return (
      <div className="p-4 md:p-6 h-full flex flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Chargement du vide-cerveau...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <Brain className="h-7 w-7 text-primary" />
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Vide-Cerveau</h1>
        </div>
      </div>

      <Card className="shadow-md shrink-0">
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-base md:text-lg">Capturer une nouvelle pensée ou idée</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={newDumpText}
            onChange={(e) => setNewDumpText(e.target.value)}
            placeholder="Écrivez rapidement ce qui vous vient à l'esprit..."
            rows={3}
            className="mb-3 text-sm"
            disabled={isAddingLoading || !user}
          />
        </CardContent>
        <CardFooter>
          <Button onClick={handleAddDump} disabled={isAddingLoading || !newDumpText.trim() || !user}>
            {isAddingLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Ajouter la Note
          </Button>
        </CardFooter>
      </Card>

      {!user && !isFetching && (
         <Card className="flex-grow flex flex-col items-center justify-center text-center p-6 border-dashed bg-muted/20">
            <Brain className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
            <CardTitle className="text-lg md:text-xl">Connectez-vous pour utiliser le Vide-Cerveau</CardTitle>
            <p className="text-muted-foreground my-2 max-w-md mx-auto text-sm">
                Sauvegardez vos idées et pensées en vous connectant à votre compte.
            </p>
         </Card>
      )}

      {user && !isFetching && brainDumps.length === 0 && (
        <Card className="flex-grow flex flex-col items-center justify-center text-center p-6 border-dashed bg-muted/20">
          <Brain className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
          <CardTitle className="text-lg md:text-xl">Votre esprit est un canevas vierge !</CardTitle>
          <p className="text-muted-foreground my-2 max-w-md mx-auto text-sm">
            Utilisez cet espace pour noter rapidement idées, tâches fugaces ou réflexions avant qu'elles ne s'échappent.
          </p>
          <Button onClick={() => {
            const textarea = document.querySelector('textarea'); // Consider more specific selector if multiple textareas exist
            if (textarea) textarea.focus();
          }} size="lg" className="mt-2">
            <PlusCircle className="mr-2 h-5 w-5" />Noter la première idée
          </Button>
        </Card>
      )}

      {user && !isFetching && brainDumps.length > 0 && (
        <div className="flex-grow flex flex-col lg:flex-row gap-4 md:gap-6 overflow-hidden">
          {mainStatusOrder.map(statusKey => {
            const entries = groupedDumps[statusKey] || [];
            const config = statusConfigDefinition[statusKey];
            return (
              <Card key={statusKey} className="flex-1 flex flex-col min-w-0 lg:max-w-md xl:max-w-lg shadow-sm">
                <CardHeader className={cn("sticky top-0 z-10 bg-card/80 backdrop-blur-sm pb-3 pt-4 px-4 border-b flex flex-row items-center justify-between", config.colorClasses.border)}>
                  <div className="flex items-center gap-2">
                    <config.icon className={cn("h-5 w-5", config.colorClasses.iconText)} />
                    <CardTitle className="text-base md:text-lg">{config.label}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-sm">{entries.length}</Badge>
                </CardHeader>
                <ScrollArea className="flex-grow">
                  <CardContent className="p-3 md:p-4 space-y-3 md:space-y-4">
                    {entries.length > 0 ? (
                      entries.map(entry => (
                        <BrainDumpItemCard
                          key={entry.id}
                          entry={entry}
                          onUpdateStatus={handleUpdateStatus}
                          onDelete={handleDeleteDump}
                          isLoading={isCardLoading === entry.id}
                        />
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground italic text-center py-6">Aucune note {config.label.toLowerCase()} pour le moment.</p>
                    )}
                  </CardContent>
                </ScrollArea>
              </Card>
            );
          })}
        </div>
      )}

      {user && !isFetching && (groupedDumps[discardedStatusKey]?.length > 0 || brainDumps.length > 0) && (
        <Accordion type="single" collapsible className="w-full shrink-0 pt-4 border-t">
          <AccordionItem value="discarded-notes">
            <AccordionTrigger className="text-base md:text-lg font-semibold text-muted-foreground hover:text-foreground py-3">
              <div className="flex items-center gap-2">
                <Archive className={cn("h-5 w-5", statusConfigDefinition[discardedStatusKey].colorClasses.iconText)} />
                Notes Écartées
                <Badge variant="outline" className="ml-2">{groupedDumps[discardedStatusKey]?.length || 0}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              {groupedDumps[discardedStatusKey]?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                  {groupedDumps[discardedStatusKey].map(entry => (
                    <BrainDumpItemCard
                      key={entry.id}
                      entry={entry}
                      onUpdateStatus={handleUpdateStatus}
                      onDelete={handleDeleteDump}
                      isLoading={isCardLoading === entry.id}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic text-center py-6">Aucune note écartée.</p>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}

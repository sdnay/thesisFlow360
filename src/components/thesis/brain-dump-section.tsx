"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { BrainDumpEntry, BrainDumpEntryStatus } from '@/types';
import { Lightbulb, ListChecks, Trash2, Archive, Loader2, Brain, Zap, ArchiveRestore, PlusCircle, EllipsisVertical } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';

// ----- CONFIG -----
const statusConfigDefinition = {
  captured: {
    label: 'Capturé',
    icon: Zap,
    colorClasses: {
      border: 'border-blue-500 dark:border-blue-600',
      badgeBg: 'bg-blue-100 dark:bg-blue-900/40',
      badgeText: 'text-blue-700 dark:text-blue-300',
      iconText: 'text-blue-600 dark:text-blue-400',
    },
    description: 'Pensées brutes, idées initiales à trier.',
    actions: [
      { toStatus: 'task' as BrainDumpEntryStatus, label: 'Convertir en Tâche', icon: ListChecks },
      { toStatus: 'idea' as BrainDumpEntryStatus, label: 'Convertir en Idée', icon: Lightbulb },
      { toStatus: 'discarded' as BrainDumpEntryStatus, label: 'Écarter la note', icon: Archive },
    ],
  },
  idea: {
    label: 'Idée',
    icon: Lightbulb,
    colorClasses: {
      border: 'border-lime-500 dark:border-lime-600',
      badgeBg: 'bg-lime-100 dark:bg-lime-900/40',
      badgeText: 'text-lime-700 dark:text-lime-300',
      iconText: 'text-lime-600 dark:text-lime-400',
    },
    description: 'Concepts à explorer ou développer.',
    actions: [
      { toStatus: 'task' as BrainDumpEntryStatus, label: 'Convertir en Tâche', icon: ListChecks },
      { toStatus: 'discarded' as BrainDumpEntryStatus, label: 'Écarter l\'idée', icon: Archive },
    ],
  },
  task: {
    label: 'Tâche',
    icon: ListChecks,
    colorClasses: {
      border: 'border-amber-500 dark:border-amber-600',
      badgeBg: 'bg-amber-100 dark:bg-amber-900/40',
      badgeText: 'text-amber-700 dark:text-amber-300',
      iconText: 'text-amber-600 dark:text-amber-400',
    },
    description: 'Actions concrètes à planifier ou à réaliser.',
    actions: [
      { toStatus: 'idea' as BrainDumpEntryStatus, label: 'Transformer en Idée', icon: Lightbulb },
      { toStatus: 'discarded' as BrainDumpEntryStatus, label: 'Écarter la tâche', icon: Archive },
    ],
  },
  discarded: {
    label: 'Écarté',
    icon: Archive,
    colorClasses: {
      border: 'border-gray-400 dark:border-gray-500',
      badgeBg: 'bg-gray-100 dark:bg-gray-700/40',
      badgeText: 'text-gray-600 dark:text-gray-400',
      iconText: 'text-gray-500 dark:text-gray-500',
    },
    description: 'Notes jugées non pertinentes ou terminées.',
    actions: [
      { toStatus: 'captured' as BrainDumpEntryStatus, label: 'Restaurer (comme Capturé)', icon: ArchiveRestore },
    ],
  },
} as const;

type StatusConfigType = typeof statusConfigDefinition;

interface BrainDumpItemCardProps {
  entry: BrainDumpEntry;
  onUpdateStatus: (id: string, status: BrainDumpEntryStatus) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading: boolean;
}

const BrainDumpItemCard: FC<BrainDumpItemCardProps> = ({
  entry,
  onUpdateStatus,
  onDelete,
  isLoading,
}) => {
  const config = statusConfigDefinition[entry.status];
  if (!config) {
    return (
      <Card className="border-l-4 border-red-500 p-3 text-red-700">
        Erreur: Statut de note invalide ({entry.status}) pour "{entry.text.substring(0, 30)}...".
      </Card>
    );
  }
  const availableActions = config.actions || [];

  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow duration-150 flex flex-col border-l-4", config.colorClasses.border)}>
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex justify-between items-center">
          <Badge variant="outline" className={cn(
            "text-xs font-medium border-none",
            config.colorClasses.badgeBg,
            config.colorClasses.badgeText
          )}>
            <config.icon className={cn("mr-1.5 h-3.5 w-3.5", config.colorClasses.iconText)} />
            {config.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: fr })}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-1 pb-3 px-3 flex-grow min-h-[50px]">
        <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">{entry.text}</p>
      </CardContent>
      <CardFooter className="flex justify-end items-center gap-1 pt-2 pb-3 px-3 border-t">
        {availableActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                disabled={isLoading}
                title="Changer le statut"
              >
                <EllipsisVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {availableActions.map(action => (
                <DropdownMenuItem
                  key={action.toStatus}
                  onClick={() => onUpdateStatus(entry.id, action.toStatus)}
                  disabled={isLoading}
                  className="text-sm cursor-pointer"
                >
                  <action.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(entry.id)}
          title="Supprimer Définitivement"
          className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 h-8 w-8"
          disabled={isLoading}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};

// --------------------
//      MAIN EXPORT
// --------------------

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
      toast({ title: "Erreur de chargement", description: "Impossible de charger les notes du vide-cerveau.", variant: "destructive" });
    } finally {
      setIsFetching(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBrainDumps();
    const channel = supabase
      .channel('db-braindump-page-refactor-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brain_dump_entries' }, (_payload) => {
        fetchBrainDumps();
      })
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
    } catch (e: any) {
      toast({ title: "Erreur d'ajout", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsAddingLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: BrainDumpEntryStatus) => {
    setIsCardLoading(id);
    try {
      const { error } = await supabase.from('brain_dump_entries').update({ status }).eq('id', id);
      if (error) throw error;
      toast({ title: "Statut mis à jour" });
    } catch (e: any) {
      toast({ title: "Erreur de mise à jour", description: (e as Error).message, variant: "destructive" });
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
    } catch (e: any) {
      toast({ title: "Erreur de suppression", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsCardLoading(null);
    }
  };

  const mainStatusOrder: Array<keyof StatusConfigType> = ['captured', 'idea', 'task'];
  const discardedStatusKey: keyof StatusConfigType = 'discarded';

  const groupedDumps = brainDumps.reduce((acc, entry) => {
    const currentStatus = entry.status as BrainDumpEntryStatus;
    (acc[currentStatus] = acc[currentStatus] || []).push(entry);
    return acc;
  }, {} as Record<BrainDumpEntryStatus, BrainDumpEntry[]>);

  if (isFetching) {
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
            disabled={isAddingLoading}
          />
        </CardContent>
        <CardFooter>
          <Button onClick={handleAddDump} disabled={isAddingLoading || !newDumpText.trim()}>
            {isAddingLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Ajouter la Note
          </Button>
        </CardFooter>
      </Card>

      {brainDumps.length === 0 && !newDumpText ? (
        <Card className="flex-grow flex flex-col items-center justify-center text-center p-6 border-dashed bg-muted/20">
          <Brain className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
          <CardTitle className="text-lg md:text-xl">Votre esprit est un canevas vierge !</CardTitle>
          <p className="text-muted-foreground my-2 max-w-md mx-auto text-sm">
            Utilisez cet espace pour noter rapidement idées, tâches fugaces ou réflexions avant qu'elles ne s'échappent.
          </p>
          <Button onClick={() => {
            const textarea = document.querySelector('textarea');
            if (textarea) textarea.focus();
          }} size="lg" className="mt-2">
            <PlusCircle className="mr-2 h-5 w-5" />Noter la première idée
          </Button>
        </Card>
      ) : (
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

      {(groupedDumps[discardedStatusKey]?.length > 0 || brainDumps.length > 0) && (
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

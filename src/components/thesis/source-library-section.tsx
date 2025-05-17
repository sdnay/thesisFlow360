
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import type { Source } from '@/types';
import { PlusCircle, Edit3, Trash2, Link as LinkIconLucide, FileText, Mic, BookOpen, Loader2, Library, Save } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const SourceTypeIcon: FC<{ type: Source['type'], className?: string }> = ({ type, className }) => {
  const iconProps = { className: cn("h-4 w-4", className) };
  switch (type) {
    case 'pdf': return <FileText {...iconProps} />;
    case 'website': return <LinkIconLucide {...iconProps} />;
    case 'interview': return <Mic {...iconProps} />;
    case 'field_notes': return <BookOpen {...iconProps} />;
    default: return <FileText {...iconProps} />;
  }
};

const sourceTypeText = (type: Source['type']): string => {
    switch (type) {
        case 'pdf': return 'Document PDF';
        case 'website': return 'Site Web / Lien';
        case 'interview': return 'Entretien';
        case 'field_notes': return 'Notes de Terrain';
        case 'other': return 'Autre';
        default: return type;
    }
}


const SourceItemCard: FC<{ source: Source, onEdit: (source: Source) => void, onDelete: (id: string) => Promise<void>, isLoading: boolean }> = ({ source, onEdit, onDelete, isLoading }) => {
  const isExternalLink = source.source_link_or_path && (source.source_link_or_path.startsWith('http://') || source.source_link_or_path.startsWith('https://'));
  return (
    <Card className="shadow-md hover:shadow-xl transition-shadow duration-200 flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2 flex-grow min-w-0">
            <SourceTypeIcon type={source.type} className="text-primary shrink-0" />
            <CardTitle className="text-base md:text-lg truncate" title={source.title}>{source.title}</CardTitle>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="outline" size="icon" onClick={() => onEdit(source)} aria-label="Modifier la source" disabled={isLoading} className="h-8 w-8">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="destructiveOutline" size="icon" onClick={() => onDelete(source.id)} aria-label="Supprimer la source" disabled={isLoading} className="h-8 w-8">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs pt-1">
          Type : {sourceTypeText(source.type)} | Ajouté le : {format(new Date(source.created_at), "d MMM yyyy", { locale: fr })}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-xs md:text-sm flex-grow space-y-2 py-2">
        {source.source_link_or_path && (
          <div className="flex items-center gap-1.5">
            <LinkIconLucide className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {isExternalLink ? (
                <Link href={source.source_link_or_path} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate" title={source.source_link_or_path}>
                    {source.source_link_or_path}
                </Link>
            ) : (
                <span className="truncate text-muted-foreground" title={source.source_link_or_path}>{source.source_link_or_path}</span>
            )}
          </div>
        )}
        {source.notes && (
            <div className="pt-1">
                <h4 className="text-xs font-semibold text-muted-foreground mb-0.5">Notes :</h4>
                <p className="text-muted-foreground whitespace-pre-wrap text-xs max-h-24 overflow-y-auto custom-scrollbar pr-1">{source.notes}</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
};

export function SourceLibrarySection() {
  const [sources, setSources] = useState<Source[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSource, setCurrentSource] = useState<Partial<Source> & { id?: string } | null>(null);
  const sourceTypes: Source['type'][] = ["pdf", "website", "interview", "field_notes", "other"];
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isCardActionLoading, setIsCardActionLoading] = useState<string|null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const { toast } = useToast();

  const fetchSources = useCallback(async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('sources')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSources(data || []);
    } catch (e: any) {
      toast({ title: "Erreur", description: "Impossible de charger les sources.", variant: "destructive" });
      console.error("Erreur fetchSources:", e);
    } finally {
      setIsFetching(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSources();
     const channel = supabase
      .channel('db-sources-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sources' }, fetchSources)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSources]);

  const openModalForNew = () => {
    setCurrentSource({ title: '', type: 'website', source_link_or_path: '', notes: '' });
    setIsModalOpen(true);
  };

  const openModalForEdit = (source: Source) => {
    setCurrentSource(JSON.parse(JSON.stringify(source)));
    setIsModalOpen(true);
  };

  const handleSaveSource = async () => {
    if (!currentSource || !currentSource.title?.trim() || !currentSource.type) {
        toast({title: "Erreur de validation", description: "Le titre et le type de la source sont requis.", variant: "destructive"});
        return;
    }
    setIsFormLoading(true);
    try {
      const payload = {
        title: currentSource.title.trim(),
        type: currentSource.type,
        source_link_or_path: currentSource.source_link_or_path?.trim() || null,
        notes: currentSource.notes?.trim() || null,
      };

      if (currentSource.id) { 
        const { error } = await supabase.from('sources').update(payload).eq('id', currentSource.id);
        if (error) throw error;
        toast({ title: "Source modifiée" });
      } else { 
        const { error } = await supabase.from('sources').insert([payload]);
        if (error) throw error;
        toast({ title: "Source ajoutée" });
      }
      setIsModalOpen(false);
      setCurrentSource(null);
    } catch (e: any) {
      toast({ title: "Erreur d'enregistrement", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleSaveSource:", e);
    } finally {
      setIsFormLoading(false);
    }
  };
  
  const handleDeleteSource = async (sourceId: string) => {
    setIsCardActionLoading(sourceId);
    try {
      const { error } = await supabase.from('sources').delete().eq('id', sourceId);
      if (error) throw error;
      toast({ title: "Source supprimée" });
    } catch (e: any) {
      toast({ title: "Erreur de suppression", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleDeleteSource:", e);
    } finally {
      setIsCardActionLoading(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
            <Library className="h-7 w-7 text-primary" />
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Bibliothèque de Sources</h1>
        </div>
        <Button onClick={openModalForNew} disabled={isFetching || isFormLoading}>
          <PlusCircle className="mr-2 h-4 w-4" /> Ajouter une Source
        </Button>
      </div>

      {isFetching ? (
        <div className="flex-grow flex justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : sources.length === 0 ? (
        <Card className="flex-grow flex flex-col items-center justify-center text-center p-6 bg-muted/30">
            <Library className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3"/>
            <p className="text-muted-foreground">Aucune source ajoutée pour le moment.</p>
            <p className="text-xs text-muted-foreground">Commencez à construire votre bibliothèque de références !</p>
        </Card>
      ) : (
        <div className="flex-grow grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-start overflow-y-auto custom-scrollbar pr-1 pb-4">
          {sources.map((source) => (
            <SourceItemCard 
              key={source.id} 
              source={source} 
              onEdit={openModalForEdit}
              onDelete={handleDeleteSource}
              isLoading={isCardActionLoading === source.id}
            />
          ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={(open) => {if(!isFormLoading) setIsModalOpen(open)}}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">{currentSource?.id ? 'Modifier la Source' : 'Ajouter une Nouvelle Source'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="sourceTitle" className="block text-sm font-medium mb-1.5">Titre de la source</Label>
              <Input
                id="sourceTitle"
                value={currentSource?.title || ''}
                onChange={(e) => setCurrentSource(prev => ({ ...prev, title: e.target.value }))}
                placeholder="ex : Article de revue, Nom du livre..."
                disabled={isFormLoading}
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="sourceType" className="block text-sm font-medium mb-1.5">Type de source</Label>
              <Select
                value={currentSource?.type || 'website'}
                onValueChange={(value) => setCurrentSource(prev => ({ ...prev, type: value as Source['type'] }))}
                disabled={isFormLoading}
              >
                <SelectTrigger id="sourceType" aria-label="Type de source" className="text-sm">
                  <SelectValue placeholder="Sélectionner le type" />
                </SelectTrigger>
                <SelectContent>
                  {sourceTypes.map(type => (
                    <SelectItem key={type} value={type} className="text-sm">{sourceTypeText(type)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
             <div>
              <Label htmlFor="sourceLinkOrPath" className="block text-sm font-medium mb-1.5">Lien ou Chemin du Fichier (Optionnel)</Label>
              <Input
                id="sourceLinkOrPath"
                value={currentSource?.source_link_or_path || ''}
                onChange={(e) => setCurrentSource(prev => ({ ...prev, source_link_or_path: e.target.value }))}
                placeholder="ex : https://exemple.com ou /docs/document.pdf"
                disabled={isFormLoading}
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="sourceNotes" className="block text-sm font-medium mb-1.5">Notes (Optionnel)</Label>
              <Textarea
                id="sourceNotes"
                value={currentSource?.notes || ''}
                onChange={(e) => setCurrentSource(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Points clés, citations, idées principales..."
                rows={4}
                disabled={isFormLoading}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button variant="outline" disabled={isFormLoading}>Annuler</Button>
            </DialogClose>
            <Button onClick={handleSaveSource} disabled={isFormLoading || !currentSource?.title?.trim()}>
              {isFormLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
              {currentSource?.id ? 'Enregistrer les Modifications' : 'Ajouter la Source'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

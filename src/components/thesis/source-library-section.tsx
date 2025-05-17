
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import type { Source } from '@/types';
import { PlusCircle, Edit3, Trash2, LinkIcon, FileText, Mic, BookOpen, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

const SourceTypeIcon: FC<{ type: Source['type'] }> = ({ type }) => {
  switch (type) {
    case 'pdf': return <FileText className="h-4 w-4 text-red-500" />;
    case 'website': return <LinkIcon className="h-4 w-4 text-blue-500" />;
    case 'interview': return <Mic className="h-4 w-4 text-green-500" />;
    case 'field_notes': return <BookOpen className="h-4 w-4 text-orange-500" />;
    default: return <FileText className="h-4 w-4 text-gray-500" />;
  }
};

const sourceTypeText = (type: Source['type']): string => {
    switch (type) {
        case 'pdf': return 'PDF';
        case 'website': return 'Site Web';
        case 'interview': return 'Entretien';
        case 'field_notes': return 'Notes de Terrain';
        case 'other': return 'Autre';
        default: return type;
    }
}


const SourceItemCard: FC<{ source: Source, onEdit: (source: Source) => void, onDelete: (id: string) => Promise<void>, isLoading: boolean }> = ({ source, onEdit, onDelete, isLoading }) => {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <SourceTypeIcon type={source.type} />
            <CardTitle className="text-base">{source.title}</CardTitle>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => onEdit(source)} aria-label="Modifier la source" disabled={isLoading}>
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(source.id)} aria-label="Supprimer la source" className="text-destructive hover:text-destructive/80" disabled={isLoading}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">
          Type : {sourceTypeText(source.type)} | Ajouté : {format(new Date(source.created_at), "d MMM yyyy", { locale: fr })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {source.source_link_or_path && (
          <p className="text-xs truncate mb-1">
            Chemin/Lien : <a href={source.source_link_or_path.startsWith('http') ? source.source_link_or_path : '#'} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{source.source_link_or_path}</a>
          </p>
        )}
        {source.notes && <p className="text-sm text-muted-foreground whitespace-pre-wrap">Notes : {source.notes}</p>}
      </CardContent>
    </Card>
  );
};

export function SourceLibrarySection() {
  const [sources, setSources] = useState<Source[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSource, setCurrentSource] = useState<Partial<Source> & { id?: string } | null>(null);
  const sourceTypes: Source['type'][] = ["pdf", "website", "interview", "field_notes", "other"];
  const [isLoading, setIsLoading] = useState(false); // For modal operations
  const [isCardLoading, setIsCardLoading] = useState(false); // For delete operations on cards
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
  }, [fetchSources]);

  const openModalForNew = () => {
    setCurrentSource({ title: '', type: 'pdf', source_link_or_path: '', notes: '' });
    setIsModalOpen(true);
  };

  const openModalForEdit = (source: Source) => {
    setCurrentSource(JSON.parse(JSON.stringify(source))); // Deep copy
    setIsModalOpen(true);
  };

  const handleSaveSource = async () => {
    if (!currentSource || !currentSource.title || !currentSource.type) {
        toast({title: "Erreur de validation", description: "Le titre et le type de la source sont requis.", variant: "destructive"});
        return;
    }
    setIsLoading(true);
    try {
      const payload = {
        title: currentSource.title,
        type: currentSource.type,
        source_link_or_path: currentSource.source_link_or_path || null,
        notes: currentSource.notes || null,
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
      await fetchSources();
    } catch (e: any) {
      toast({ title: "Erreur d'enregistrement", description: e.message, variant: "destructive" });
      console.error("Erreur handleSaveSource:", e);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteSource = async (sourceId: string) => {
    setIsCardLoading(true);
    try {
      const { error } = await supabase.from('sources').delete().eq('id', sourceId);
      if (error) throw error;
      await fetchSources();
      toast({ title: "Source supprimée" });
    } catch (e: any) {
      toast({ title: "Erreur de suppression", description: e.message, variant: "destructive" });
      console.error("Erreur handleDeleteSource:", e);
    } finally {
      setIsCardLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Bibliothèque de Sources</h2>
        <Button onClick={openModalForNew} disabled={isFetching || isLoading}>
          <PlusCircle className="mr-2 h-4 w-4" /> Ajouter une Source
        </Button>
      </div>

      {isFetching ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : sources.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">Aucune source ajoutée pour le moment. Commencez à construire votre bibliothèque !</p>
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
              isLoading={isCardLoading}
            />
          ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={(open) => {if(!isLoading) setIsModalOpen(open)}}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{currentSource?.id ? 'Modifier la Source' : 'Ajouter une Nouvelle Source'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="sourceTitle" className="block text-sm font-medium mb-1">Titre</label>
              <Input
                id="sourceTitle"
                value={currentSource?.title || ''}
                onChange={(e) => setCurrentSource(prev => ({ ...prev, title: e.target.value }))}
                placeholder="ex : Nom de l'article de revue"
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="sourceType" className="block text-sm font-medium mb-1">Type</label>
              <Select
                value={currentSource?.type || 'pdf'}
                onValueChange={(value) => setCurrentSource(prev => ({ ...prev, type: value as Source['type'] }))}
                disabled={isLoading}
              >
                <SelectTrigger id="sourceType">
                  <SelectValue placeholder="Sélectionner le type" />
                </SelectTrigger>
                <SelectContent>
                  {sourceTypes.map(type => (
                    <SelectItem key={type} value={type}>{sourceTypeText(type)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
             <div>
              <label htmlFor="sourceLinkOrPath" className="block text-sm font-medium mb-1">Lien ou Chemin du Fichier (Optionnel)</label>
              <Input
                id="sourceLinkOrPath"
                value={currentSource?.source_link_or_path || ''}
                onChange={(e) => setCurrentSource(prev => ({ ...prev, source_link_or_path: e.target.value }))}
                placeholder="ex : https://exemple.com/article ou /docs/mon_document.pdf"
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="sourceNotes" className="block text-sm font-medium mb-1">Notes (Optionnel)</label>
              <Textarea
                id="sourceNotes"
                value={currentSource?.notes || ''}
                onChange={(e) => setCurrentSource(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Points clés, citations, etc."
                rows={3}
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {if(!isLoading)setIsModalOpen(false)}} disabled={isLoading}>Annuler</Button>
            <Button onClick={handleSaveSource} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enregistrer la Source
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

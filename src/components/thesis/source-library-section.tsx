
"use client";

import { useState, type FC, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import type { Source } from '@/types';
import { PlusCircle, Loader2, Library, Save, Filter as FilterIcon, Search as SearchIcon, ArrowUpDown, FileArchive } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { SourceTypeIcon, sourceTypeText } from './source-library-components/SourceTypeIcon'; // Import from new location
import SourceItemCard from './source-library-components/SourceItemCard'; // Import from new location

const sourceTypes: Source['type'][] = ["pdf", "website", "interview", "field_notes", "other"];
type SortOrder = "created_at_desc" | "created_at_asc" | "title_asc" | "title_desc";

const sortOptions: { value: SortOrder; label: string }[] = [
  { value: "created_at_desc", label: "Date d'ajout (plus récent)" },
  { value: "created_at_asc", label: "Date d'ajout (plus ancien)" },
  { value: "title_asc", label: "Titre (A-Z)" },
  { value: "title_desc", label: "Titre (Z-A)" },
];

export function SourceLibrarySection() {
  const { user } = useAuth();
  const [sources, setSources] = useState<Source[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSource, setCurrentSource] = useState<Partial<Source> & { id?: string } | null>(null);
  
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isCardActionLoading, setIsCardActionLoading] = useState<string|null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<Source['type'] | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('created_at_desc');

  const fetchSources = useCallback(async () => {
    if (!user) {
      setSources([]);
      setIsFetching(false);
      return;
    }
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('sources')
        .select('*')
        .eq('user_id', user.id) // Filter by user
        .order('created_at', { ascending: false }); // Default sort by Supabase
      if (error) throw error;
      setSources(data || []);
    } catch (e: any) {
      toast({ title: "Erreur", description: "Impossible de charger les sources.", variant: "destructive" });
      console.error("Erreur fetchSources:", e);
    } finally {
      setIsFetching(false);
    }
  }, [toast, user]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]); // fetchSources is stable due to useCallback with `user` dependency

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`db-sources-page-user-${user.id}`) // User specific channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sources', filter: `user_id=eq.${user.id}` }, 
        (payload) => {
          console.log('SourceLibrary Realtime event:', payload);
          fetchSources();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchSources]);

  const openModalForNew = () => {
    setCurrentSource({ title: '', type: 'website', source_link_or_path: '', notes: '', user_id: user?.id });
    setIsModalOpen(true);
  };

  const openModalForEdit = (source: Source) => {
    setCurrentSource(JSON.parse(JSON.stringify(source)));
    setIsModalOpen(true);
  };

  const handleSaveSource = async () => {
    if (!user || !currentSource || !currentSource.title?.trim() || !currentSource.type) {
        toast({title: "Erreur de validation", description: "Le titre et le type de la source sont requis.", variant: "destructive"});
        return;
    }
    setIsFormLoading(true);
    try {
      const payload = {
        user_id: user.id, // Ensure user_id is set
        title: currentSource.title.trim(),
        type: currentSource.type,
        source_link_or_path: currentSource.source_link_or_path?.trim() || null,
        notes: currentSource.notes?.trim() || null,
      };

      if (currentSource.id) { 
        const { data: updatedSource, error } = await supabase.from('sources').update(payload).eq('id', currentSource.id).eq('user_id', user.id).select().single();
        if (error) throw error;
        setSources(prev => prev.map(s => s.id === updatedSource?.id ? updatedSource : s));
        toast({ title: "Source modifiée" });
      } else { 
        const { data: newSource, error } = await supabase.from('sources').insert(payload).select().single();
        if (error) throw error;
        setSources(prev => [newSource, ...prev].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())); // Add to start
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
    if (!user) return;
    setIsCardActionLoading(sourceId);
    try {
      const { error } = await supabase.from('sources').delete().eq('id', sourceId).eq('user_id', user.id);
      if (error) throw error;
      setSources(prev => prev.filter(s => s.id !== sourceId));
      toast({ title: "Source supprimée" });
    } catch (e: any) {
      toast({ title: "Erreur de suppression", description: (e as Error).message, variant: "destructive" });
      console.error("Erreur handleDeleteSource:", e);
    } finally {
      setIsCardActionLoading(null);
    }
  };

  const filteredAndSortedSources = useMemo(() => {
    let result = [...sources];

    if (filterType !== 'all') {
      result = result.filter(source => source.type === filterType);
    }

    if (searchQuery.trim() !== '') {
      const lowerSearchQuery = searchQuery.toLowerCase();
      result = result.filter(source =>
        source.title.toLowerCase().includes(lowerSearchQuery) ||
        (source.notes && source.notes.toLowerCase().includes(lowerSearchQuery))
      );
    }

    switch (sortOrder) {
      case 'created_at_asc':
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'title_asc':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title_desc':
        result.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'created_at_desc': // Default
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }
    return result;
  }, [sources, searchQuery, filterType, sortOrder]);

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
            <Library className="h-7 w-7 text-primary" />
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Bibliothèque de Sources</h1>
        </div>
        <Button onClick={openModalForNew} disabled={isFetching || isFormLoading || !user}>
          <PlusCircle className="mr-2 h-4 w-4" /> Ajouter une Source
        </Button>
      </div>

      {/* Toolbar for Search and Filters */}
      <Card className="p-3 md:p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 items-end">
          <div className="sm:col-span-2 lg:col-span-1">
            <Label htmlFor="sourceSearch" className="text-xs font-medium">Rechercher</Label>
            <div className="relative mt-1">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="sourceSearch"
                type="search"
                placeholder="Rechercher par titre ou notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm h-9"
                disabled={!user}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="sourceFilterType" className="text-xs font-medium">Filtrer par Type</Label>
            <Select value={filterType} onValueChange={(value) => setFilterType(value as Source['type'] | 'all')} disabled={!user}>
              <SelectTrigger id="sourceFilterType" className="text-sm h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {sourceTypes.map(type => (
                  <SelectItem key={type} value={type}>{sourceTypeText(type)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="sourceSortOrder" className="text-xs font-medium">Trier par</Label>
            <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)} disabled={!user}>
              <SelectTrigger id="sourceSortOrder" className="text-sm h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {sortOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {!user && !isFetching && (
         <Card className="flex-grow flex flex-col items-center justify-center text-center p-6 border-dashed bg-muted/20">
            <Library className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
            <CardTitle className="text-lg md:text-xl">Connectez-vous pour accéder à votre bibliothèque</CardTitle>
            <p className="text-muted-foreground my-2 max-w-md mx-auto text-sm">
                Vos sources bibliographiques seront stockées et organisées ici une fois connecté.
            </p>
         </Card>
      )}

      {user && isFetching ? (
        <Card className="flex-grow flex flex-col items-center justify-center text-center p-6">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Chargement de la bibliothèque...</p>
        </Card>
      ) : user && filteredAndSortedSources.length === 0 ? (
        <Card className="flex-grow flex flex-col items-center justify-center text-center p-6 border-dashed bg-muted/20">
            <FileArchive className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4"/>
            <CardTitle className="text-xl">{sources.length === 0 ? "Votre bibliothèque est vide." : "Aucune source ne correspond."}</CardTitle>
            <p className="text-muted-foreground my-2 max-w-md mx-auto text-sm">
              {sources.length === 0 ? "Commencez à construire votre base de connaissances en ajoutant des références." : "Essayez d'ajuster vos filtres ou votre recherche."}
            </p>
            {sources.length === 0 && 
              <Button onClick={openModalForNew} disabled={isFormLoading} size="lg" className="mt-2">
                  <PlusCircle className="mr-2 h-5 w-5" /> Ajouter la première source
              </Button>
            }
        </Card>
      ) : user && (
        <div className="flex-grow grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-start overflow-y-auto custom-scrollbar pr-1 pb-4">
          {filteredAndSortedSources.map((source) => (
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
              <Label htmlFor="sourceTitleModal" className="block text-sm font-medium mb-1.5">Titre de la source</Label>
              <Input
                id="sourceTitleModal"
                value={currentSource?.title || ''}
                onChange={(e) => setCurrentSource(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                placeholder="ex : Article de revue, Nom du livre..."
                disabled={isFormLoading}
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="sourceTypeModal" className="block text-sm font-medium mb-1.5">Type de source</Label>
              <Select
                value={currentSource?.type || 'website'}
                onValueChange={(value) => setCurrentSource(prev => prev ? ({ ...prev, type: value as Source['type'] }) : null)}
                disabled={isFormLoading}
              >
                <SelectTrigger id="sourceTypeModal" aria-label="Type de source" className="text-sm">
                  <SelectValue placeholder="Sélectionner le type" />
                </SelectTrigger>
                <SelectContent>
                  {sourceTypes.map(type => (
                    <SelectItem key={type} value={type} className="text-sm flex items-center gap-2">
                      <SourceTypeIcon type={type} className="inline-block mr-2" /> {sourceTypeText(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
             <div>
              <Label htmlFor="sourceLinkOrPathModal" className="block text-sm font-medium mb-1.5">Lien ou Chemin du Fichier (Optionnel)</Label>
              <Input
                id="sourceLinkOrPathModal"
                value={currentSource?.source_link_or_path || ''}
                onChange={(e) => setCurrentSource(prev => prev ? ({ ...prev, source_link_or_path: e.target.value }) : null)}
                placeholder="ex : https://exemple.com ou /docs/document.pdf"
                disabled={isFormLoading}
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="sourceNotesModal" className="block text-sm font-medium mb-1.5">Notes (Optionnel)</Label>
              <Textarea
                id="sourceNotesModal"
                value={currentSource?.notes || ''}
                onChange={(e) => setCurrentSource(prev => prev ? ({ ...prev, notes: e.target.value }) : null)}
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
              {currentSource?.id ? 'Enregistrer' : 'Ajouter la Source'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

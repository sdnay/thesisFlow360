import { Badge } from "@/components/ui/badge";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Tag } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { XIcon, PlusCircle } from 'lucide-react'; // Icônes
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from "@/components/ui/button";

interface TagManagerProps {
  entityId: string; // ID de l'entité (Task, Chapter, etc.)
  entityType: 'task' | 'chapter' | 'daily_objective' | 'source' | 'brain_dump'; // Type d'entité
  initialTags: Tag[]; // Tags déjà associés à l'entité
  onTagsChange: (tags: Tag[]) => void; // Callback pour remonter les changements de tags
}

const TagManager: React.FC<TagManagerProps> = ({ entityId, entityType, initialTags, onTagsChange }) => {
  const [selectedTags, setSelectedTags] = useState<Tag[]>(initialTags);
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const queryClient = useQueryClient();

  // Charger tous les tags existants
  const { data: availableTags, isLoading: isLoadingTags } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tags').select('*');
      if (error) throw error;
      return data as Tag[];
    },
  });

  // Mutation pour créer un nouveau tag
  const createTagMutation = useMutation({
    mutationFn: async (tagName: string) => {
      const { data, error } = await supabase.from('tags').insert({ name: tagName }).select().single();
      if (error) throw error;
      return data as Tag;
    },
    onSuccess: (newTag) => {
      // Invalider la query des tags pour rafraîchir la liste disponible
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      return newTag; // Renvoyer le nouveau tag pour l'ajouter directement aux selectedTags
    },
  });

  // Mapping entre entityType et le nom de la table de jonction
  const junctionTableMap = {
    task: 'task_tags',
    chapter: 'chapter_tags',
    daily_objective: 'daily_objective_tags',
    source: 'source_tags',
    brain_dump: 'brain_dump_tags',
  };
   const entityIdColumnMap = {
    task: 'task_id',
    chapter: 'chapter_id',
    daily_objective: 'daily_objective_id',
    source: 'source_id',
    brain_dump: 'brain_dump_entry_id',
   };

  // Mutation pour lier/délier un tag à l'entité
  const updateEntityTagsMutation = useMutation({
      mutationFn: async ({ tagId, action }: { tagId: string; action: 'add' | 'remove' }) => {
        const junctionTable = junctionTableMap[entityType];
        const entityIdColumn = entityIdColumnMap[entityType];

        if (action === 'add') {
          const { error } = await supabase.from(junctionTable).insert({
            [entityIdColumn]: entityId,
            tag_id: tagId,
          });
          if (error) throw error;
        } else { // action === 'remove'
           const { error } = await supabase.from(junctionTable)
            .delete()
            .eq(entityIdColumn, entityId)
            .eq('tag_id', tagId);
          if (error) throw error;
        }
      },
       // Note: Pour une mise à jour instantanée parfaite, on mettrait à jour le cache de react-query
       // ou l'état global ici de manière optimiste avant l'appel API, puis rollback en cas d'erreur.
       // L'exemple ci-dessous gère l'état local selectedTags et déclenche onTagsChange.
  });


  const handleTagSelect = async (tagName: string) => {
    setInputValue(''); // Reset input

    const existingTag = availableTags?.find(tag => tag.name === tagName);
    let tagToAdd = existingTag;

    if (!existingTag) {
      // Tag doesn't exist, create it
      try {
        tagToAdd = await createTagMutation.mutateAsync(tagName);
         // createTagMutation onSuccess will invalidate 'tags' query
      } catch (error) {
        console.error('Failed to create tag:', error);
        // Afficher une notification d'erreur à l'utilisateur
        return; // Stop the process if tag creation fails
      }
    }

    if (tagToAdd && !selectedTags.find(tag => tag.id === tagToAdd.id)) {
       const newSelectedTags = [...selectedTags, tagToAdd];
       setSelectedTags(newSelectedTags);
       onTagsChange(newSelectedTags); // Notifier le parent
       // Trigger database update
       updateEntityTagsMutation.mutate({ tagId: tagToAdd.id, action: 'add' });
    }

    setOpen(false); // Close the popover
  };

  const handleTagRemove = (tagId: string) => {
    const newSelectedTags = selectedTags.filter(tag => tag.id !== tagId);
    setSelectedTags(newSelectedTags);
    onTagsChange(newSelectedTags); // Notifier le parent
     // Trigger database update
    updateEntityTagsMutation.mutate({ tagId, action: 'remove' });
  };

  const filteredAvailableTags = useMemo(() => {
     return availableTags?.filter(tag =>
       tag.name.toLowerCase().includes(inputValue.toLowerCase()) &&
       !selectedTags.find(selectedTag => selectedTag.id === tag.id) // Exclure les tags déjà sélectionnés
     );
  }, [availableTags, inputValue, selectedTags]);


  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap gap-2">
        {selectedTags.map(tag => (
          <Badge key={tag.id} variant="secondary" className="flex items-center">
            {tag.name}
            <XIcon
              className="ml-1 h-3 w-3 cursor-pointer"
              onClick={() => handleTagRemove(tag.id)}
            />
          </Badge>
        ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" role="combobox" aria-expanded={open} className="w-full justify-between">
            Ajouter un Tag
            <PlusCircle className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput
              placeholder="Rechercher ou créer un tag..."
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>
                 {isLoadingTags ? "Chargement des tags..." : "Aucun tag trouvé."}
                 {inputValue && !isLoadingTags && (
                    <CommandItem onSelect={() => handleTagSelect(inputValue)}>
                        Créer "{inputValue}"
                    </CommandItem>
                 )}
              </CommandEmpty>
              <CommandGroup heading="Tags existants">
                {filteredAvailableTags?.map(tag => (
                  <CommandItem key={tag.id} value={tag.name} onSelect={() => handleTagSelect(tag.name)}>
                    {tag.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </PopoverContent>
        </Popover>
         {/* Afficher les états de loading/error des mutations si nécessaire */}
          {(createTagMutation.isPending || updateEntityTagsMutation.isPending) && <p>Mise à jour des tags...</p>}
          {createTagMutation.isError && <p className="text-red-500">Erreur lors de la création du tag.</p>}
           {updateEntityTagsMutation.isError && <p className="text-red-500">Erreur lors de la mise à jour des tags.</p>}
    </div>
  );
};

export default TagManager;

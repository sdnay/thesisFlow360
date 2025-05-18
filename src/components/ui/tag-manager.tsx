
"use client";

import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import type { Tag } from '@/types'; // Assurez-vous que ce chemin est correct
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandList, CommandEmpty, CommandItem, CommandInput, CommandGroup } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { XIcon, PlusCircle, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagManagerProps {
  // Tous les tags existants dans le système pour cet utilisateur (pour la suggestion/sélection)
  availableTags: Tag[];
  // Les tags actuellement sélectionnés pour l'entité en cours d'édition
  selectedTags: Tag[];
  // Callback quand un tag est ajouté (soit un objet Tag existant, soit un string pour un nouveau tag)
  onTagAdd: (tagOrNewName: Tag | string) => void;
  // Callback quand un tag est retiré (par son ID)
  onTagRemove: (tagId: string) => void;
  // Pour désactiver le composant
  disabled?: boolean;
  // Pour afficher un état de chargement (par exemple, si les availableTags sont en cours de fetch)
  isLoading?: boolean;
  // Permettre la création de nouveaux tags à la volée
  allowTagCreation?: boolean;
  // Label pour le bouton de déclenchement du popover
  triggerLabel?: string;
  // Classe pour le bouton de déclenchement
  triggerClassName?: string;
}

const TagManager: FC<TagManagerProps> = ({
  availableTags,
  selectedTags,
  onTagAdd,
  onTagRemove,
  disabled = false,
  isLoading = false,
  allowTagCreation = true,
  triggerLabel = "Gérer les Tags",
  triggerClassName,
}) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Tags qui sont disponibles pour la sélection (pas déjà sélectionnés ET filtrés par l'input)
  const filteredAndUnselectedTags = useMemo(() => {
    if (isLoading) return [];
    return (availableTags || [])
      .filter(
        (tag) =>
          !selectedTags.find((selectedTag) => selectedTag.id === tag.id) &&
          tag.name.toLowerCase().includes(inputValue.toLowerCase())
      )
      .slice(0, 10); // Limiter le nombre de suggestions
  }, [availableTags, selectedTags, inputValue, isLoading]);

  // Vérifie si le texte tapé correspond exactement à un tag existant (disponible ou déjà sélectionné)
  const exactMatchInAvailableOrSelected = useMemo(() => {
    if (!inputValue.trim()) return null;
    const searchLower = inputValue.toLowerCase();
    return (availableTags || []).find(tag => tag.name.toLowerCase() === searchLower);
  }, [availableTags, inputValue]);

  const showCreateOption = useMemo(() => {
    return allowTagCreation && inputValue.trim() !== '' && !exactMatchInAvailableOrSelected;
  }, [allowTagCreation, inputValue, exactMatchInAvailableOrSelected]);

  const handleSelectOrSubmitTag = (tagOrNewName: Tag | string) => {
    onTagAdd(tagOrNewName);
    setInputValue(''); // Réinitialiser l'input
    setOpen(false); // Fermer le popover
  };

  return (
    <div className="w-full space-y-2">
      {selectedTags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="text-xs items-center gap-1 pl-2 pr-1 py-0.5"
              style={tag.color ? { backgroundColor: tag.color, color: 'hsl(var(--secondary-foreground))' } : {}}
            >
              {tag.name}
              <button
                type="button"
                className={cn(
                  "rounded-full hover:bg-muted-foreground/20 p-0.5 focus:outline-none focus:ring-1 focus:ring-ring",
                  disabled && "cursor-not-allowed opacity-50"
                )}
                onClick={() => !disabled && onTagRemove(tag.id)}
                disabled={disabled}
                aria-label={`Retirer le tag ${tag.name}`}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-start font-normal text-muted-foreground", triggerClassName)}
            disabled={disabled || isLoading}
            type="button" // Important pour ne pas soumettre un formulaire parent
          >
            <Tags className="mr-2 h-4 w-4 shrink-0 opacity-70" />
            {isLoading ? "Chargement des tags..." : triggerLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command
            filter={(value, search) => {
              if (value.toLowerCase().includes(search.toLowerCase())) return 1;
              return 0;
            }}
          >
            <CommandInput
              placeholder="Rechercher ou créer un tag..."
              value={inputValue}
              onValueChange={setInputValue}
              className="h-9 text-sm"
              disabled={disabled || isLoading}
            />
            <CommandList>
              {isLoading && <CommandItem disabled className="text-xs text-muted-foreground">Chargement...</CommandItem>}
              {!isLoading && (
                <CommandEmpty>
                  {showCreateOption ? (
                    <CommandItem
                      value={`__create__${inputValue}`} // Valeur unique pour l'option de création
                      onSelect={() => handleSelectOrSubmitTag(inputValue.trim())}
                      className="text-xs cursor-pointer"
                    >
                      <PlusCircle className="mr-2 h-3.5 w-3.5" />
                      Créer "{inputValue.trim()}"
                    </CommandItem>
                  ) : (
                    inputValue.trim() && exactMatchInAvailableOrSelected ? "Tag déjà existant ou sélectionné." : "Aucun tag trouvé."
                  )}
                </CommandEmpty>
              )}
              {!isLoading && filteredAndUnselectedTags.length > 0 && (
                <CommandGroup heading="Tags existants">
                  {filteredAndUnselectedTags.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      value={tag.name} // Important pour le filtrage de Command
                      onSelect={() => handleSelectOrSubmitTag(tag)}
                      className="text-xs cursor-pointer"
                    >
                      {tag.color && <span className="mr-2 h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />}
                      {tag.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default TagManager;

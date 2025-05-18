
"use client";

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import type { Tag } from '@/types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandList, CommandEmpty, CommandItem, CommandInput } from '@/components/ui/command';
import { XIcon, PlusCircle } from 'lucide-react';

interface SimpleChapterTagManagerProps {
  availableTags: Tag[];
  selectedTags: Tag[];
  onTagAdd: (tagNameOrTag: string | Tag) => Promise<void>;
  onTagRemove: (tagId: string) => void;
  disabled?: boolean;
}

const SimpleChapterTagManager: FC<SimpleChapterTagManagerProps> = ({
  availableTags,
  selectedTags,
  onTagAdd,
  onTagRemove,
  disabled,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    if (inputValue.trim() === '') {
      setSuggestions([]);
      return;
    }
    setSuggestions(
      availableTags
        .filter(
          (tag) =>
            tag.name.toLowerCase().includes(inputValue.toLowerCase()) &&
            !selectedTags.find((st) => st.id === tag.id)
        )
        .slice(0, 5)
    );
  }, [inputValue, availableTags, selectedTags]);

  const handleAdd = async (tagOrName: Tag | string) => {
    await onTagAdd(tagOrName);
    setInputValue('');
    setPopoverOpen(false); // Close popover after adding
  };

  return (
    <div className="space-y-2 mt-2">
      <div className="flex flex-wrap gap-1 min-h-[24px]">
        {selectedTags.map((tag) => (
          <Badge
            key={tag.id}
            variant="secondary"
            style={tag.color ? { backgroundColor: tag.color, color: 'hsl(var(--secondary-foreground))' } : {}}
            className="text-xs"
          >
            {tag.name}
            <XIcon
              className="ml-1.5 h-3 w-3 cursor-pointer hover:text-destructive"
              onClick={() => !disabled && onTagRemove(tag.id)}
              aria-disabled={disabled}
            />
          </Badge>
        ))}
      </div>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Input
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (!popoverOpen && e.target.value.trim()) {
                setPopoverOpen(true);
              } else if (popoverOpen && !e.target.value.trim() && suggestions.length === 0) {
                setPopoverOpen(false);
              }
            }}
            placeholder="Ajouter ou créer un tag..."
            className="text-sm h-9"
            disabled={disabled}
            aria-label="Ajouter un tag"
          />
        </PopoverTrigger>
        {(popoverOpen && (suggestions.length > 0 || (inputValue.trim() && !availableTags.find(t => t.name.toLowerCase() === inputValue.trim().toLowerCase())))) && (
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput 
                value={inputValue} 
                onValueChange={(search) => {
                  setInputValue(search);
                   if (!popoverOpen && search.trim()) {
                     setPopoverOpen(true);
                   }
                }}
                placeholder="Rechercher ou créer..."
                className="h-8 text-xs"
              />
              <CommandList>
                <CommandEmpty>
                  {inputValue.trim() ? (
                    <CommandItem
                      onSelect={() => handleAdd(inputValue.trim())}
                      className="text-xs cursor-pointer"
                    >
                      <PlusCircle className="mr-2 h-3.5 w-3.5" /> Créer "{inputValue.trim()}"
                    </CommandItem>
                  ) : (
                    "Aucun tag trouvé."
                  )}
                </CommandEmpty>
                {suggestions.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={tag.name}
                    onSelect={() => handleAdd(tag)}
                    className="text-xs cursor-pointer"
                  >
                    {tag.name}
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
};

export default SimpleChapterTagManager;

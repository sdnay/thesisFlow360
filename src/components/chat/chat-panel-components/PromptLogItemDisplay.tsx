
"use client";

import type { FC } from 'react';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Copy, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { PromptLogEntry } from '@/types';

interface PromptLogItemDisplayProps {
  entry: PromptLogEntry;
  onUsePrompt: (prompt: string) => void;
}

const PromptLogItemDisplay: FC<PromptLogItemDisplayProps> = ({ entry, onUsePrompt }) => {
  const [copiedOriginal, setCopiedOriginal] = useState(false);
  const [copiedRefined, setCopiedRefined] = useState(false);

  const handleCopy = (text: string, type: 'original' | 'refined') => {
    navigator.clipboard.writeText(text);
    if (type === 'original') setCopiedOriginal(true);
    else setCopiedRefined(true);
    setTimeout(() => {
      if (type === 'original') setCopiedOriginal(false);
      else setCopiedRefined(false);
    }, 1500);
  };

  return (
    <Card className="shadow-sm bg-card/80">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex justify-between items-center">
            <CardTitle className="text-xs font-semibold text-primary">Prompt Original</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
            {entry.timestamp ? formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true, locale: fr }) : 'Date inconnue'}
            </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="text-xs space-y-1.5 pb-2 px-3">
        <div className="p-2 border rounded-md bg-background relative">
          <p className="whitespace-pre-wrap text-foreground/90">{entry.original_prompt}</p>
          <TooltipProvider delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="absolute top-0.5 right-0.5 h-6 w-6" onClick={() => handleCopy(entry.original_prompt, 'original')}>
              {copiedOriginal ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </TooltipTrigger> <TooltipContent side="left"><p>Copier Original</p></TooltipContent> </Tooltip> </TooltipProvider>
        </div>
        {entry.refined_prompt && ( <>
          <h4 className="text-xs font-semibold text-accent pt-1">Prompt Affiné</h4>
          <div className="p-2 border rounded-md bg-accent/10 border-accent/30 relative">
            <p className="whitespace-pre-wrap text-accent/90">{entry.refined_prompt}</p>
            <TooltipProvider delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="absolute top-0.5 right-0.5 h-6 w-6" onClick={() => handleCopy(entry.refined_prompt!, 'refined')}>
                {copiedRefined ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger> <TooltipContent side="left"><p>Copier Affiné</p></TooltipContent> </Tooltip> </TooltipProvider>
          </div> </>
        )}
        {entry.reasoning && ( <>
          <h4 className="text-xs font-semibold text-muted-foreground pt-1">Raisonnement</h4>
          <p className="p-2 border rounded-md bg-muted/40 italic whitespace-pre-wrap text-muted-foreground/90">{entry.reasoning}</p> </>
        )}
        {entry.tags && entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {entry.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-2 pb-3 px-3">
        <Button variant="outline" size="xs" onClick={() => onUsePrompt(entry.refined_prompt || entry.original_prompt)} className="text-xs">
          Utiliser ce Prompt
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PromptLogItemDisplay;


"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { PromptLogEntry } from '@/types';
import { refinePrompt, type RefinePromptInput, type RefinePromptOutput } from '@/ai/flows/refine-prompt';
import { Sparkles, History, Send, Copy, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

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
    }, 2000);
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Prompt Original</CardTitle>
        <CardDescription className="text-xs">
          Enregistré : {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true, locale: fr })}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div className="p-2 border rounded-md bg-muted/50 relative">
          <p className="whitespace-pre-wrap">{entry.original_prompt}</p>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6"
            onClick={() => handleCopy(entry.original_prompt, 'original')}
          >
            {copiedOriginal ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
        {entry.refined_prompt && (
          <>
            <h4 className="text-sm font-medium pt-1">Prompt Affiné</h4>
            <div className="p-2 border rounded-md bg-accent/20 relative">
              <p className="whitespace-pre-wrap">{entry.refined_prompt}</p>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6"
                onClick={() => handleCopy(entry.refined_prompt!, 'refined')}
              >
                {copiedRefined ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </>
        )}
        {entry.reasoning && (
          <>
            <h4 className="text-sm font-medium">Raisonnement pour l'Affinage</h4>
            <p className="p-2 border rounded-md bg-muted/30 italic whitespace-pre-wrap">{entry.reasoning}</p>
          </>
        )}
        {entry.tags && entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {entry.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-2">
        <Button variant="outline" size="sm" onClick={() => onUsePrompt(entry.refined_prompt || entry.original_prompt)}>
          Utiliser ce Prompt
        </Button>
      </CardFooter>
    </Card>
  );
};

export function ChatGPTPromptLogPanel() {
  const [promptLogs, setPromptLogs] = useState<PromptLogEntry[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [tags, setTags] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingLogs, setIsFetchingLogs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPromptLogs = useCallback(async () => {
    setIsFetchingLogs(true);
    setError(null);
    try {
      const { data, error: supabaseError } = await supabase
        .from('prompt_log_entries')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50); // Limiter le nombre de logs affichés

      if (supabaseError) throw supabaseError;
      setPromptLogs(data || []);
    } catch (e: any) {
      console.error("Erreur lors de la récupération du journal des prompts:", e);
      setError("Échec de la récupération du journal des prompts.");
      toast({ title: "Erreur", description: "Impossible de charger le journal des prompts.", variant: "destructive" });
    } finally {
      setIsFetchingLogs(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPromptLogs();
  }, [fetchPromptLogs]);

  const handleRefinePrompt = async () => {
    if (currentPrompt.trim() === '') return;
    setIsLoading(true);
    setError(null);
    try {
      // Utiliser les prompts existants comme historique pour l'affinage
      const historyPrompts = promptLogs
        .slice(0, 10) // Utiliser les 10 derniers prompts comme contexte
        .map(p => p.refined_prompt || p.original_prompt)
        .filter(p => p.trim() !== '');

      const input: RefinePromptInput = {
        prompt: currentPrompt,
        promptHistory: historyPrompts,
      };
      const result: RefinePromptOutput = await refinePrompt(input);
      
      const newLogEntryPayload: Omit<PromptLogEntry, 'id' | 'timestamp'> = {
        original_prompt: currentPrompt,
        refined_prompt: result.refinedPrompt,
        reasoning: result.reasoning,
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
      };
      
      const { error: insertError } = await supabase.from('prompt_log_entries').insert(newLogEntryPayload);
      if (insertError) throw insertError;
      
      setCurrentPrompt(''); 
      setTags('');
      await fetchPromptLogs();
      toast({ title: "Prompt affiné", description: "Le prompt a été affiné et consigné." });
    } catch (e: any) {
      console.error("Erreur lors de l'affinage du prompt:", e);
      setError("Échec de l'affinage du prompt. Veuillez réessayer.");
      // Consigner le prompt original même en cas d'échec de l'affinage
      try {
        const fallbackLogEntry: Omit<PromptLogEntry, 'id' | 'timestamp'> = {
          original_prompt: currentPrompt,
          tags: tags.split(',').map(t => t.trim()).filter(t => t),
        };
        await supabase.from('prompt_log_entries').insert(fallbackLogEntry);
        await fetchPromptLogs();
      } catch (logError: any) {
         toast({ title: "Erreur de consignation", description: logError.message, variant: "destructive" });
      }
      toast({ title: "Erreur d'affinage", description: e.message || "Une erreur est survenue.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLogCurrentPrompt = async () => {
    if (currentPrompt.trim() === '') return;
    setIsLoading(true);
    setError(null);
    try {
      const newLogEntryPayload: Omit<PromptLogEntry, 'id' | 'timestamp'> = {
        original_prompt: currentPrompt,
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
      };
      const { error: insertError } = await supabase.from('prompt_log_entries').insert(newLogEntryPayload);
      if (insertError) throw insertError;

      setCurrentPrompt('');
      setTags('');
      await fetchPromptLogs();
      toast({ title: "Prompt consigné", description: "Le prompt actuel a été enregistré." });
    } catch (e: any) {
      console.error("Erreur lors de la consignation du prompt:", e);
      setError("Échec de la consignation du prompt.");
      toast({ title: "Erreur", description: e.message || "Impossible de consigner le prompt.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUsePromptFromLog = (promptText: string) => {
    setCurrentPrompt(promptText);
  };

  return (
    <div className="flex flex-col h-full p-1 md:p-2 bg-background">
      <Card className="flex-grow flex flex-col shadow-none border-0 md:border md:shadow-md">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Ingénierie de Prompt ChatGPT
          </CardTitle>
          <CardDescription>
            Créez, affinez et consignez vos prompts efficaces. L'historique pour l'affinage est automatiquement tiré des prompts récents.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-4 flex-grow flex flex-col gap-4 overflow-hidden">
          {/* Input Area */}
          <div className="space-y-2">
            <Textarea
              value={currentPrompt}
              onChange={(e) => setCurrentPrompt(e.target.value)}
              placeholder="Entrez votre prompt ici..."
              rows={4}
              className="text-sm"
              disabled={isLoading}
            />
            <Input 
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Étiquettes (séparées par virgule, ex: résumé, analyse)"
              className="text-xs"
              disabled={isLoading}
            />
            <div className="flex gap-2">
              <Button onClick={handleRefinePrompt} disabled={isLoading || !currentPrompt.trim() || isFetchingLogs} className="flex-1">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {isLoading ? 'Affinage...' : 'Affiner & Consigner'}
              </Button>
              <Button onClick={handleLogCurrentPrompt} variant="outline" disabled={isLoading || !currentPrompt.trim() || isFetchingLogs} className="flex-1">
                 {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                 Consigner Actuel
              </Button>
            </div>
             {error && (
              <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {error}</p>
            )}
          </div>
          
          <div className="flex-grow overflow-hidden flex flex-col">
            <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-muted-foreground">
              <History className="h-4 w-4" /> Journal des Prompts
            </h3>
            {isFetchingLogs ? (
               <div className="flex-grow flex items-center justify-center">
                 <Loader2 className="h-8 w-8 animate-spin text-primary" />
               </div>
            ) : promptLogs.length === 0 ? (
              <div className="flex-grow flex items-center justify-center">
                <p className="text-muted-foreground text-center">Votre journal de prompts est vide. <br/>Commencez par entrer un prompt ci-dessus.</p>
              </div>
            ) : (
              <ScrollArea className="flex-grow pr-3">
                <div className="space-y-3">
                  {promptLogs.map((entry) => (
                    <PromptLogItemDisplay key={entry.id} entry={entry} onUsePrompt={handleUsePromptFromLog} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

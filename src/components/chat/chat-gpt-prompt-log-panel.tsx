"use client";

import { useState, type FC } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { PromptLogEntry } from '@/types';
import { refinePrompt, type RefinePromptInput, type RefinePromptOutput } from '@/ai/flows/refine-prompt';
import { Sparkles, History, Send, Copy, Check, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const initialPromptLogs: PromptLogEntry[] = [
  { id: 'pl1', originalPrompt: 'Summarize the key arguments in Foucault\'s Discipline and Punish.', refinedPrompt: 'Provide a concise summary of the main arguments presented in Michel Foucault\'s "Discipline and Punish", focusing on the transition from sovereign power to disciplinary power and its mechanisms.', reasoning: 'Added specificity regarding key concepts and focus areas for a more targeted summary.', timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), tags: ['summary', 'Foucault'] },
  { id: 'pl2', originalPrompt: 'Generate a research question about climate change and its impact on coastal communities.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), tags: ['research-question', 'climate-change'] },
];

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
        <CardTitle className="text-sm font-medium">Original Prompt</CardTitle>
        <CardDescription className="text-xs">
          Logged: {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div className="p-2 border rounded-md bg-muted/50 relative">
          <p className="whitespace-pre-wrap">{entry.originalPrompt}</p>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6"
            onClick={() => handleCopy(entry.originalPrompt, 'original')}
          >
            {copiedOriginal ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
        {entry.refinedPrompt && (
          <>
            <h4 className="text-sm font-medium pt-1">Refined Prompt</h4>
            <div className="p-2 border rounded-md bg-accent/20 relative">
              <p className="whitespace-pre-wrap">{entry.refinedPrompt}</p>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6"
                onClick={() => handleCopy(entry.refinedPrompt!, 'refined')}
              >
                {copiedRefined ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </>
        )}
        {entry.reasoning && (
          <>
            <h4 className="text-sm font-medium">Reasoning for Refinement</h4>
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
        <Button variant="outline" size="sm" onClick={() => onUsePrompt(entry.refinedPrompt || entry.originalPrompt)}>
          Use this Prompt
        </Button>
      </CardFooter>
    </Card>
  );
};

export function ChatGPTPromptLogPanel() {
  const [promptLogs, setPromptLogs] = useState<PromptLogEntry[]>(initialPromptLogs);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [promptHistoryForRefinement, setPromptHistoryForRefinement] = useState<string[]>(['Summarize this text concisely.', 'Explain this concept in simple terms.']);
  const [tags, setTags] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefinePrompt = async () => {
    if (currentPrompt.trim() === '') return;
    setIsLoading(true);
    setError(null);
    try {
      const input: RefinePromptInput = {
        prompt: currentPrompt,
        promptHistory: promptHistoryForRefinement.filter(p => p.trim() !== ''),
      };
      const result: RefinePromptOutput = await refinePrompt(input);
      const newLogEntry: PromptLogEntry = {
        id: Date.now().toString(),
        originalPrompt: currentPrompt,
        refinedPrompt: result.refinedPrompt,
        reasoning: result.reasoning,
        timestamp: new Date().toISOString(),
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
      };
      setPromptLogs(prevLogs => [newLogEntry, ...prevLogs]);
      setCurrentPrompt(''); // Optionally clear current prompt or set to refined
      setTags('');
    } catch (e) {
      console.error("Error refining prompt:", e);
      setError("Failed to refine prompt. Please try again.");
       // Add a basic log entry even if refinement fails
      const newLogEntry: PromptLogEntry = {
        id: Date.now().toString(),
        originalPrompt: currentPrompt,
        timestamp: new Date().toISOString(),
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
      };
      setPromptLogs(prevLogs => [newLogEntry, ...prevLogs]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLogCurrentPrompt = () => {
    if (currentPrompt.trim() === '') return;
     const newLogEntry: PromptLogEntry = {
        id: Date.now().toString(),
        originalPrompt: currentPrompt,
        timestamp: new Date().toISOString(),
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
      };
      setPromptLogs(prevLogs => [newLogEntry, ...prevLogs]);
      setCurrentPrompt('');
      setTags('');
  };

  const handleUsePromptFromLog = (promptText: string) => {
    setCurrentPrompt(promptText);
    // Optionally, scroll to the input area or give focus
  };

  return (
    <div className="flex flex-col h-full p-1 md:p-2 bg-background">
      <Card className="flex-grow flex flex-col shadow-none border-0 md:border md:shadow-md">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            ChatGPT Prompt Engineering
          </CardTitle>
          <CardDescription>
            Craft, refine, and log your effective prompts.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-4 flex-grow flex flex-col gap-4 overflow-hidden">
          {/* Input Area */}
          <div className="space-y-2">
            <Textarea
              value={currentPrompt}
              onChange={(e) => setCurrentPrompt(e.target.value)}
              placeholder="Enter your prompt here..."
              rows={4}
              className="text-sm"
            />
            <Input 
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tags (comma-separated, e.g., summary, analysis)"
              className="text-xs"
            />
            <div className="flex gap-2">
              <Button onClick={handleRefinePrompt} disabled={isLoading || !currentPrompt.trim()} className="flex-1">
                <Sparkles className="mr-2 h-4 w-4" />
                {isLoading ? 'Refining...' : 'Refine & Log'}
              </Button>
              <Button onClick={handleLogCurrentPrompt} variant="outline" disabled={!currentPrompt.trim()} className="flex-1">
                <Send className="mr-2 h-4 w-4" /> Log Current
              </Button>
            </div>
             {error && (
              <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {error}</p>
            )}
          </div>

          {/* Prompt History for Refinement (Collapsible or smaller UI?) */}
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
              Context: Effective Prompt History ({promptHistoryForRefinement.length})
            </summary>
            <Textarea
              value={promptHistoryForRefinement.join('\n')}
              onChange={(e) => setPromptHistoryForRefinement(e.target.value.split('\n'))}
              placeholder="One effective prompt per line (used for refinement context)"
              rows={3}
              className="mt-1 text-xs"
            />
          </details>
          
          {/* Log Display */}
          <div className="flex-grow overflow-hidden flex flex-col">
            <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-muted-foreground">
              <History className="h-4 w-4" /> Prompt Log
            </h3>
            {promptLogs.length === 0 ? (
              <div className="flex-grow flex items-center justify-center">
                <p className="text-muted-foreground text-center">Your prompt log is empty. <br/>Start by entering a prompt above.</p>
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

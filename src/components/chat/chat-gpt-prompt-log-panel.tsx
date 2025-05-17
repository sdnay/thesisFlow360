
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { PromptLogEntry } from '@/types';
import { processUserRequest, type ThesisAgentInput, type ThesisAgentOutput } from '@/ai/flows/thesis-agent-flow';
import { Sparkles, History, Send, Copy, Check, AlertTriangle, Loader2, Bot, Edit } from 'lucide-react'; // Thumbs up/down removed for now
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-xs font-semibold text-primary">Prompt Original</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true, locale: fr })}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-xs space-y-1.5 pb-2">
        <div className="p-2 border rounded-md bg-background relative">
          <p className="whitespace-pre-wrap text-foreground/90">{entry.original_prompt}</p>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-0.5 right-0.5 h-6 w-6"
                  onClick={() => handleCopy(entry.original_prompt, 'original')}
                >
                  {copiedOriginal ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left"><p>Copier Original</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {entry.refined_prompt && (
          <>
            <h4 className="text-xs font-semibold text-accent pt-1">Prompt Affiné</h4>
            <div className="p-2 border rounded-md bg-accent/10 border-accent/30 relative">
              <p className="whitespace-pre-wrap text-accent/90">{entry.refined_prompt}</p>
              <TooltipProvider delayDuration={100}>
               <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-0.5 right-0.5 h-6 w-6"
                    onClick={() => handleCopy(entry.refined_prompt!, 'refined')}
                    >
                    {copiedRefined ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="left"><p>Copier Affiné</p></TooltipContent>
               </Tooltip>
              </TooltipProvider>
            </div>
          </>
        )}
        {entry.reasoning && (
          <>
            <h4 className="text-xs font-semibold text-muted-foreground pt-1">Raisonnement</h4>
            <p className="p-2 border rounded-md bg-muted/40 italic whitespace-pre-wrap text-muted-foreground/90">{entry.reasoning}</p>
          </>
        )}
        {entry.tags && entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {entry.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-2 pb-3">
        <Button variant="outline" size="xs" onClick={() => onUsePrompt(entry.refined_prompt || entry.original_prompt)} className="text-xs">
          <Edit className="mr-1.5 h-3 w-3" /> Utiliser ce Prompt
        </Button>
      </CardFooter>
    </Card>
  );
};

interface AgentMessage {
  id: string;
  type: 'user' | 'agent';
  text: string;
  timestamp: Date;
  actions?: ThesisAgentOutput['actionsTaken'];
  isLoading?: boolean;
}

export function ChatGPTPromptLogPanel() {
  const [promptLogs, setPromptLogs] = useState<PromptLogEntry[]>([]);
  const [currentUserRequest, setCurrentUserRequest] = useState('');
  const [conversation, setConversation] = useState<AgentMessage[]>([]);
  
  const [isLoadingAgent, setIsLoadingAgent] = useState(false);
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
        .limit(5); // Limit to 5 recent logs for brevity in this panel

      if (supabaseError) throw supabaseError;
      setPromptLogs(data || []);
    } catch (e: any) {
      console.error("Erreur lors de la récupération du journal des prompts:", e);
      setError("Échec de la récupération du journal des prompts.");
      toast({ title: "Erreur Logs", description: "Impossible de charger le journal des prompts.", variant: "destructive" });
    } finally {
      setIsFetchingLogs(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPromptLogs();
     const channel = supabase
      .channel('db-promptlogs-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prompt_log_entries' }, fetchPromptLogs)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPromptLogs]);

  const handleSendToAgent = async () => {
    if (currentUserRequest.trim() === '') return;
    
    const userMessage: AgentMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      text: currentUserRequest,
      timestamp: new Date(),
    };
    setConversation(prev => [...prev, userMessage, { id: `agent-loading-${Date.now()}`, type: 'agent', text: 'L\'assistant réfléchit...', timestamp: new Date(), isLoading: true }]);
    
    const requestTextForAgent = currentUserRequest;
    setCurrentUserRequest(''); 
    setIsLoadingAgent(true);
    setError(null);
    
    try {
      const agentInput: ThesisAgentInput = { userRequest: requestTextForAgent };
      const result: ThesisAgentOutput = await processUserRequest(agentInput);
      
      const agentResponseMessage: AgentMessage = {
        id: `agent-${Date.now()}`,
        type: 'agent',
        text: result.responseMessage,
        timestamp: new Date(),
        actions: result.actionsTaken,
      };
      setConversation(prev => [...prev.filter(m => !m.isLoading), agentResponseMessage]);

    } catch (e: any) {
      console.error("Erreur avec l'agent IA:", e);
      const errorMessage = `Erreur de l'agent: ${e.message || "Une erreur inconnue est survenue."}`;
      setError(errorMessage);
      const agentErrorMessage: AgentMessage = {
        id: `agent-error-${Date.now()}`,
        type: 'agent',
        text: errorMessage,
        timestamp: new Date(),
      };
      setConversation(prev => [...prev.filter(m => !m.isLoading), agentErrorMessage]);
      toast({ title: "Erreur de l'Agent", description: e.message || "Une erreur est survenue.", variant: "destructive" });
    } finally {
      setIsLoadingAgent(false);
    }
  };
  
  const handleUsePromptFromLog = (promptText: string) => {
    setCurrentUserRequest(promptText);
    const textarea = document.getElementById('agent-input-textarea') as HTMLTextAreaElement;
    if (textarea) textarea.focus();
  };

  return (
    <div className="flex flex-col h-full p-1 md:p-2 bg-background">
      <Card className="flex-grow flex flex-col shadow-none border-0 md:border md:shadow-lg">
        <CardHeader className="border-b p-4">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Bot className="h-5 w-5 text-primary" />
            Assistant IA ThesisFlow
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Interagissez avec l'IA pour gérer votre thèse ou affiner des prompts.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-3 md:pt-4 flex-grow flex flex-col gap-3 md:gap-4 overflow-hidden p-3 md:p-4">
          <ScrollArea className="flex-grow pr-2 -mr-2 mb-2 border rounded-md p-2 bg-muted/30 custom-scrollbar">
            <div className="space-y-3">
              {conversation.length === 0 && !isLoadingAgent && (
                <div className="text-sm text-muted-foreground text-center py-6">
                  <Sparkles className="mx-auto h-8 w-8 text-primary/70 mb-2"/>
                  Commencez par envoyer un message à l'assistant.
                </div>
              )}
              {conversation.map((msg) => (
                <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-2.5 rounded-lg text-sm shadow-sm ${msg.type === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-card text-card-foreground border rounded-bl-none'}`}>
                    {msg.isLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> 
                        <span className="italic text-muted-foreground">{msg.text}</span>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    )}
                    {msg.actions && msg.actions.length > 0 && (
                      <details className="mt-1.5 text-xs opacity-80 pt-1 border-t border-border/50">
                        <summary className="cursor-pointer font-medium">Détails des actions ({msg.actions.length})</summary>
                        <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        {msg.actions.map((action, index) => (
                          <li key={index}>
                            <strong>{action.toolName}</strong>: {action.toolOutput?.message || JSON.stringify(action.toolOutput)}
                          </li>
                        ))}
                        </ul>
                      </details>
                    )}
                    {!msg.isLoading && <p className="text-xs opacity-60 mt-1.5 text-right">{formatDistanceToNow(msg.timestamp, { addSuffix: true, locale: fr })}</p>}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="space-y-2 border-t pt-3 mt-auto">
            <Textarea
              id="agent-input-textarea"
              value={currentUserRequest}
              onChange={(e) => setCurrentUserRequest(e.target.value)}
              placeholder="Demandez à l'IA..."
              rows={2}
              className="text-sm min-h-[60px] resize-none"
              disabled={isLoadingAgent}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendToAgent();
                }
              }}
            />
            <div className="flex gap-2">
              <Button onClick={handleSendToAgent} disabled={isLoadingAgent || !currentUserRequest.trim()} className="flex-1">
                {isLoadingAgent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {isLoadingAgent ? 'Envoi...' : 'Envoyer'}
              </Button>
            </div>
             {error && (
              <p className="text-xs text-destructive flex items-center gap-1 pt-1"><AlertTriangle className="h-3.5 w-3.5" /> {error}</p>
            )}
          </div>
          
          <details className="border-t pt-3">
            <summary className="text-sm font-medium flex items-center gap-2 text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              <History className="h-4 w-4" /> Historique des Prompts Affinés (5 derniers)
            </summary>
            <div className="mt-2 flex-grow overflow-hidden flex flex-col">
              {isFetchingLogs ? (
                <div className="flex-grow flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : promptLogs.length === 0 ? (
                <div className="text-center py-4">
                  <History className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2"/>
                  <p className="text-muted-foreground text-center text-sm">Le journal des prompts est vide.</p>
                </div>
              ) : (
                <ScrollArea className="flex-grow max-h-60 pr-2 custom-scrollbar">
                  <div className="space-y-2">
                    {promptLogs.map((entry) => (
                      <PromptLogItemDisplay key={entry.id} entry={entry} onUsePrompt={handleUsePromptFromLog} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

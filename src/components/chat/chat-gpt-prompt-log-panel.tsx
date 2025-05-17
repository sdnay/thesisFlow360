
"use client";

import { useState, type FC, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { PromptLogEntry } from '@/types';
import { processUserRequest, type ThesisAgentInput, type ThesisAgentOutput } from '@/ai/flows/thesis-agent-flow';
import { Sparkles, History, Send, Copy, Check, AlertTriangle, Loader2, Bot } from 'lucide-react';
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

interface AgentMessage {
  id: string;
  type: 'user' | 'agent';
  text: string;
  timestamp: Date;
  actions?: ThesisAgentOutput['actionsTaken'];
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
        .limit(20); 

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

  const handleSendToAgent = async () => {
    if (currentUserRequest.trim() === '') return;
    
    const userMessage: AgentMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      text: currentUserRequest,
      timestamp: new Date(),
    };
    setConversation(prev => [...prev, userMessage]);
    
    setIsLoadingAgent(true);
    setError(null);
    
    try {
      const agentInput: ThesisAgentInput = { userRequest: currentUserRequest };
      const result: ThesisAgentOutput = await processUserRequest(agentInput);
      
      const agentResponseMessage: AgentMessage = {
        id: `agent-${Date.now()}`,
        type: 'agent',
        text: result.responseMessage,
        timestamp: new Date(),
        actions: result.actionsTaken,
      };
      setConversation(prev => [...prev, agentResponseMessage]);

      setCurrentUserRequest(''); 
      // Les outils (comme refinePromptTool) peuvent consigner des prompts.
      // On pourrait rafraîchir le journal ici si une action d'affinage a eu lieu.
      if (result.actionsTaken?.some(action => action.toolName === 'refinePromptTool' && action.toolOutput?.success)) {
        await fetchPromptLogs();
      }
      // Afficher un toast pour le message de l'agent peut être redondant si on l'affiche dans le chat
      // mais utile pour les confirmations importantes ou erreurs
      toast({ title: "Assistant IA", description: result.responseMessage });

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
      setConversation(prev => [...prev, agentErrorMessage]);
      toast({ title: "Erreur de l'Agent", description: e.message || "Une erreur est survenue.", variant: "destructive" });
    } finally {
      setIsLoadingAgent(false);
    }
  };
  
  const handleUsePromptFromLog = (promptText: string) => {
    setCurrentUserRequest(promptText);
  };

  return (
    <div className="flex flex-col h-full p-1 md:p-2 bg-background">
      <Card className="flex-grow flex flex-col shadow-none border-0 md:border md:shadow-md">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5 text-primary" />
            Assistant IA ThesisFlow
          </CardTitle>
          <CardDescription>
            Discutez avec l'assistant pour gérer votre thèse, ajouter des éléments, ou affiner des prompts.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-4 flex-grow flex flex-col gap-4 overflow-hidden">
          {/* Conversation Area */}
          <ScrollArea className="flex-grow pr-3 -mr-3 mb-2 border rounded-md p-2 bg-muted/20">
            <div className="space-y-3">
              {conversation.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Commencez par envoyer un message à l'assistant.</p>
              )}
              {conversation.map((msg) => (
                <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-2.5 rounded-lg text-sm ${msg.type === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    {msg.actions && msg.actions.length > 0 && (
                      <details className="mt-1 text-xs opacity-80">
                        <summary className="cursor-pointer">Détails des actions ({msg.actions.length})</summary>
                        <ul className="list-disc pl-4 mt-1">
                        {msg.actions.map((action, index) => (
                          <li key={index}>
                            <strong>{action.toolName}</strong>: {action.toolOutput?.message || JSON.stringify(action.toolOutput)}
                          </li>
                        ))}
                        </ul>
                      </details>
                    )}
                    <p className="text-xs opacity-60 mt-1 text-right">{formatDistanceToNow(msg.timestamp, { addSuffix: true, locale: fr })}</p>
                  </div>
                </div>
              ))}
               {isLoadingAgent && (
                <div className="flex justify-start">
                   <div className="max-w-[80%] p-2.5 rounded-lg text-sm bg-muted text-foreground flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> L'assistant réfléchit...
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="space-y-2 border-t pt-3">
            <Textarea
              value={currentUserRequest}
              onChange={(e) => setCurrentUserRequest(e.target.value)}
              placeholder="Demandez quelque chose à l'assistant IA..."
              rows={3}
              className="text-sm"
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
                {isLoadingAgent ? 'Envoi...' : 'Envoyer à l\'Assistant'}
              </Button>
            </div>
             {error && (
              <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {error}</p>
            )}
          </div>
          
          {/* Section Journal des Prompts (pour consultation) */}
          <details className="border-t pt-3">
            <summary className="text-base font-semibold flex items-center gap-2 text-muted-foreground cursor-pointer hover:text-foreground">
              <History className="h-4 w-4" /> Voir le Journal des Prompts Affinés
            </summary>
            <div className="mt-2 flex-grow overflow-hidden flex flex-col">
              {isFetchingLogs ? (
                <div className="flex-grow flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : promptLogs.length === 0 ? (
                <div className="flex-grow flex items-center justify-center py-4">
                  <p className="text-muted-foreground text-center text-sm">Le journal des prompts affinés est vide.</p>
                </div>
              ) : (
                <ScrollArea className="flex-grow max-h-60 pr-3">
                  <div className="space-y-3">
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

    

"use client";

import { useState, type FC, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { PromptLogEntry, ChatSession, ChatMessage, ThesisAgentOutput } from '@/types';
import { processUserRequest, type ThesisAgentInput } from '@/ai/flows/thesis-agent-flow';
import { Sparkles, History, Send, Copy, Check, AlertTriangle, Loader2, Bot, MessageSquare, Plus, Trash2, ChevronsUpDown } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

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
      <CardFooter className="pt-2 pb-3 px-3">
        <Button variant="outline" size="xs" onClick={() => onUsePrompt(entry.refined_prompt || entry.original_prompt)} className="text-xs">
          Utiliser ce Prompt
        </Button>
      </CardFooter>
    </Card>
  );
};

interface DisplayMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  actions_taken?: ThesisAgentOutput['actionsTaken'];
  isLoading?: boolean;
}

export function ChatGPTPromptLogPanel() {
  const { user } = useAuth();
  const [promptLogs, setPromptLogs] = useState<PromptLogEntry[]>([]);
  const [currentUserRequest, setCurrentUserRequest] = useState('');
  
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSessionTitle, setCurrentSessionTitle] = useState<string>("Nouvelle Discussion");
  const [conversation, setConversation] = useState<DisplayMessage[]>([]);

  const [isLoadingAgent, setIsLoadingAgent] = useState(false);
  const [isFetchingLogs, setIsFetchingLogs] = useState(true);
  const [isFetchingSessions, setIsFetchingSessions] = useState(true);
  const [isFetchingMessages, setIsFetchingMessages] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [conversation]);

  const fetchPromptLogs = useCallback(async () => {
     if (!user) { setPromptLogs([]); setIsFetchingLogs(false); return; }
     setIsFetchingLogs(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('prompt_log_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(5); 
      if (supabaseError) throw supabaseError;
      setPromptLogs(data || []);
    } catch (e: any) {
      console.error("Erreur chargement journal des prompts:", e);
      toast({ title: "Erreur Logs", description: "Impossible de charger le journal des prompts.", variant: "destructive" });
    } finally {
      setIsFetchingLogs(false);
    }
  }, [toast, user]);

  const fetchChatSessions = useCallback(async () => {
    if (!user) { setChatSessions([]); setIsFetchingSessions(false); return; }
    setIsFetchingSessions(true);
    try {
      const { data, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (sessionError) throw sessionError;
      setChatSessions(data || []);
      if (data && data.length > 0 && !currentSessionId) {
        setCurrentSessionId(data[0].id);
        setCurrentSessionTitle(data[0].title);
      } else if ((!data || data.length === 0) && !currentSessionId) {
        setCurrentSessionTitle("Nouvelle Discussion");
        setConversation([]);
      }
    } catch (e: any) {
      console.error("Erreur chargement sessions de chat:", e);
      toast({ title: "Erreur Sessions", description: "Impossible de charger les sessions de chat.", variant: "destructive" });
    } finally {
      setIsFetchingSessions(false);
    }
  }, [user, toast, currentSessionId]);

  const loadMessagesForSession = useCallback(async (sessionId: string) => {
    if (!user || !sessionId) { setConversation([]); return; }
    setIsFetchingMessages(true);
    try {
      const { data, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('timestamp', { ascending: true });
      if (messagesError) throw messagesError;
      setConversation((data || []).map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'agent',
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        actions_taken: msg.actions_taken as ThesisAgentOutput['actionsTaken'] || undefined,
      })));
    } catch (e: any) {
      console.error(`Erreur chargement messages pour session ${sessionId}:`, e);
      toast({ title: "Erreur Messages", description: "Impossible de charger les messages.", variant: "destructive" });
    } finally {
      setIsFetchingMessages(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchPromptLogs();
    fetchChatSessions();
  }, [fetchPromptLogs, fetchChatSessions, user]);

  useEffect(() => {
    if (currentSessionId) {
      loadMessagesForSession(currentSessionId);
      const selectedSession = chatSessions.find(s => s.id === currentSessionId);
      setCurrentSessionTitle(selectedSession?.title || "Discussion");
    } else {
      setConversation([]);
      setCurrentSessionTitle("Nouvelle Discussion");
    }
  }, [currentSessionId, loadMessagesForSession, chatSessions]);


  useEffect(() => {
    if (!user) return;
    const promptLogChannel = supabase
      .channel(`db-promptlogs-panel-user-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prompt_log_entries', filter: `user_id=eq.${user.id}` }, fetchPromptLogs)
      .subscribe();
    
    const chatMessagesSubscription = supabase
      .channel(`db-chatmessages-panel-user-${user.id}-session-${currentSessionId || 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `user_id=eq.${user.id}${currentSessionId ? `&session_id=eq.${currentSessionId}` : ''}` }, (payload) => {
        if (currentSessionId && (payload.new?.session_id === currentSessionId || (payload.old as any)?.session_id === currentSessionId)) {
          loadMessagesForSession(currentSessionId);
        }
      })
      .subscribe();

    const chatSessionsSubscription = supabase
      .channel(`db-chatsessions-panel-user-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions', filter: `user_id=eq.${user.id}` }, (payload) => {
         fetchChatSessions();
         if (payload.eventType === 'DELETE' && (payload.old as any)?.id === currentSessionId) {
           setCurrentSessionId(null); 
         }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(promptLogChannel);
      supabase.removeChannel(chatMessagesSubscription);
      supabase.removeChannel(chatSessionsSubscription);
    };
  }, [user, fetchPromptLogs, loadMessagesForSession, fetchChatSessions, currentSessionId]);

  const createNewChatSession = async (firstUserMessageContent: string): Promise<string | null> => {
    if (!user) return null;
    setIsCreatingSession(true);
    try {
      const title = firstUserMessageContent.substring(0, 30) + (firstUserMessageContent.length > 30 ? "..." : "") || `Discussion du ${format(new Date(), 'dd/MM HH:mm', { locale: fr })}`;
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({ user_id: user.id, title })
        .select()
        .single();
      if (error) throw error;
      if (data) {
        toast({ title: "Nouvelle session créée", description: data.title });
        setChatSessions(prev => [data, ...prev].sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
        return data.id;
      }
      return null;
    } catch (e: any) {
      console.error("Erreur création session de chat:", e);
      toast({ title: "Erreur", description: "Impossible de créer une nouvelle session.", variant: "destructive" });
      return null;
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleSendToAgent = async () => {
    if (currentUserRequest.trim() === '' || !user) return;

    const tempUserMessageId = `user-${Date.now()}`;
    const userMessage: DisplayMessage = {
      id: tempUserMessageId,
      role: 'user',
      content: currentUserRequest.trim(),
      timestamp: new Date(),
    };
    setConversation(prev => [...prev, userMessage]);
    
    const requestTextForAgent = currentUserRequest.trim();
    setCurrentUserRequest(''); 
    setIsLoadingAgent(true);
    setError(null);
    
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      const newSessionId = await createNewChatSession(requestTextForAgent);
      if (newSessionId) {
        activeSessionId = newSessionId;
        setCurrentSessionId(newSessionId);
      } else {
        setConversation(prev => prev.filter(m => m.id !== tempUserMessageId));
        setIsLoadingAgent(false);
        return;
      }
    }

    const { error: userMsgDbError } = await supabase.from('chat_messages').insert({
      session_id: activeSessionId,
      user_id: user.id,
      role: 'user',
      content: requestTextForAgent,
    });
    if (userMsgDbError) {
      toast({ title: "Erreur", description: "Impossible d'enregistrer votre message.", variant: "destructive" });
      setConversation(prev => prev.filter(m => m.id !== tempUserMessageId));
      setIsLoadingAgent(false);
      return;
    }
    
    const agentChatHistory = conversation
      .filter(m => m.id !== tempUserMessageId && !m.isLoading)
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        content: msg.content,
        actions_taken: msg.actions_taken
      }));
    // Ensure the current user message is part of the history if it wasn't filtered out
    if(!agentChatHistory.find(m => m.content === requestTextForAgent && m.role === 'user')) {
      agentChatHistory.push({ role: 'user', content: requestTextForAgent, actions_taken: undefined });
    }

    const loadingAgentMessage: DisplayMessage = {
      id: `agent-loading-${Date.now()}`,
      role: 'agent',
      content: 'ThesisBot réfléchit...',
      timestamp: new Date(),
      isLoading: true,
    };
    setConversation(prev => [...prev, loadingAgentMessage]);

    try {
      // Format chatHistory for the agent
      const formattedAgentChatHistory = agentChatHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model', // 'agent' from UI becomes 'model' for Genkit
        parts: [{ text: msg.content }], // Correctly format parts
      })) as Array<{role: 'user' | 'model'; parts: {text: string}[]}> | undefined;


      const agentInput: ThesisAgentInput = { 
        userRequest: requestTextForAgent,
        chatHistory: formattedAgentChatHistory && formattedAgentChatHistory.length > 0 ? formattedAgentChatHistory : null,
      };
      const result: ThesisAgentOutput = await processUserRequest(agentInput);
      
      const agentResponseMessage: DisplayMessage = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: result.responseMessage,
        timestamp: new Date(),
        actions_taken: result.actionsTaken,
      };
      setConversation(prev => [...prev.filter(m => !m.isLoading && m.id !== tempUserMessageId), userMessage, agentResponseMessage].sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime()));

      await supabase.from('chat_messages').insert({
        session_id: activeSessionId,
        user_id: user.id,
        role: 'agent',
        content: result.responseMessage,
        actions_taken: result.actionsTaken || null,
      });

    } catch (e: any) {
      const errorMessage = `Erreur de l'agent: ${e.message || "Une erreur inconnue est survenue."}`;
      setError(errorMessage);
      const agentErrorMessage: DisplayMessage = {id: `agent-error-${Date.now()}`, role: 'agent', content: errorMessage, timestamp: new Date() };
      setConversation(prev => [...prev.filter(m => !m.isLoading && m.id !== tempUserMessageId), userMessage, agentErrorMessage].sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime()));
      toast({ title: "Erreur de l'Agent", description: e.message || "Une erreur est survenue.", variant: "destructive" });
    } finally {
      setIsLoadingAgent(false);
       // Ensure the original user message is definitely in the conversation
       setConversation(prev => {
        if (!prev.find(m => m.id === tempUserMessageId)) {
          const finalConvo = [...prev, userMessage].sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime());
          return finalConvo.filter(m => m.id !== loadingAgentMessage.id || !m.isLoading);
        }
        return prev.filter(m => m.id !== loadingAgentMessage.id || !m.isLoading);
      });
    }
  };
  
  const handleUsePromptFromLog = (promptText: string) => {
    setCurrentUserRequest(promptText);
    const textarea = document.getElementById('agent-input-textarea') as HTMLTextAreaElement;
    if (textarea) textarea.focus();
  };

  const handleSelectSession = (sessionId: string | null) => {
    if (sessionId === 'new_chat') {
      setCurrentSessionId(null);
    } else {
      setCurrentSessionId(sessionId);
    }
  };
  
  const handleDeleteSession = async () => {
    if (!currentSessionId || !user || isDeletingSession) return;
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette session de discussion et tous ses messages ? Cette action est irréversible.")) return;
    
    setIsDeletingSession(true);
    try {
      // La suppression en cascade devrait gérer les messages.
      const { error } = await supabase.from('chat_sessions').delete().eq('id', currentSessionId).eq('user_id', user.id);
      if (error) throw error;
      toast({ title: "Session supprimée" });
      setCurrentSessionId(null); 
      fetchChatSessions(); // Rafraîchit la liste et sélectionne la plus récente ou nouvelle discussion.
    } catch (e: any) {
      toast({ title: "Erreur", description: "Impossible de supprimer la session.", variant: "destructive" });
      console.error("Erreur handleDeleteSession:", e);
    } finally {
      setIsDeletingSession(false);
    }
  };

  const sessionDropdownTitle = currentSessionId ? (chatSessions.find(s => s.id === currentSessionId)?.title || "Chargement...") : "Nouvelle Discussion";

  return (
    <div className="flex flex-col h-full p-1 md:p-2 bg-background">
      <Card className="flex-grow flex flex-col shadow-none border-0 md:border md:shadow-lg overflow-hidden">
        <CardHeader className="border-b p-3 md:p-4 flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm md:text-base">Assistant IA ThesisBot</CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto h-8 text-xs md:text-sm whitespace-nowrap max-w-[180px] truncate" disabled={isFetchingSessions || isCreatingSession || isDeletingSession}>
                {isFetchingSessions ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="truncate">{sessionDropdownTitle}</span> }
                <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto custom-scrollbar">
              <DropdownMenuLabel className="text-xs">Discussions</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => handleSelectSession('new_chat')} className="text-sm cursor-pointer">
                <Plus className="mr-2 h-4 w-4" /> Nouvelle Discussion
              </DropdownMenuItem>
              {isFetchingSessions && <DropdownMenuItem disabled className="text-sm"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Chargement...</DropdownMenuItem>}
              {!isFetchingSessions && chatSessions.length > 0 && <DropdownMenuSeparator />}
              {chatSessions.map(session => (
                <DropdownMenuItem key={session.id} onSelect={() => handleSelectSession(session.id)} className={cn("text-sm cursor-pointer justify-between", currentSessionId === session.id && "bg-accent/80 font-semibold")}>
                  <div className="flex items-center truncate">
                    <MessageSquare className="mr-2 h-4 w-4 opacity-70 shrink-0" />
                    <span className="truncate" title={session.title}>{session.title}</span>
                  </div>
                   {currentSessionId === session.id && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              ))}
               {!isFetchingSessions && chatSessions.length === 0 && <DropdownMenuItem disabled className="text-xs italic text-muted-foreground">Aucune session</DropdownMenuItem>}
               {currentSessionId && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleDeleteSession} disabled={isDeletingSession} className="text-destructive focus:text-destructive text-sm cursor-pointer">
                    {isDeletingSession ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>} 
                    Supprimer la session active
                  </DropdownMenuItem>
                </>
               )}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        
        <CardContent className="pt-3 md:pt-4 flex-grow flex flex-col gap-3 md:gap-4 p-3 md:p-4 overflow-hidden">
          <ScrollArea className="flex-grow pr-2 -mr-2 mb-2 border rounded-md p-2 bg-muted/30 custom-scrollbar">
            {isFetchingMessages ? (
              <div className="flex justify-center items-center h-full text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Chargement des messages...</div>
            ) : conversation.length === 0 && !isLoadingAgent && !isFetchingSessions && (
              <div className="text-sm text-muted-foreground text-center py-6 h-full flex flex-col justify-center items-center">
                <Sparkles className="mx-auto h-8 w-8 text-primary/70 mb-2"/>
                {currentSessionId ? "Aucun message dans cette session." : "Commencez une nouvelle discussion ou sélectionnez-en une existante."}
              </div>
            )}
            <div className="space-y-3 py-2 px-1">
              {conversation.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-2.5 rounded-lg text-sm shadow-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-card text-card-foreground border rounded-bl-none'}`}>
                    {msg.isLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> 
                        <span className="italic text-muted-foreground">{msg.content}</span>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                    {msg.actions_taken && msg.actions_taken.length > 0 && (
                      <details className="mt-1.5 text-xs opacity-80 pt-1 border-t border-border/50">
                        <summary className="cursor-pointer font-medium hover:text-primary transition-colors">Détails des actions ({msg.actions_taken.length})</summary>
                        <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        {msg.actions_taken.map((action, index) => (
                          <li key={index}>
                            <strong>{action.toolName}</strong>: {action.toolOutput?.message || JSON.stringify(action.toolOutput)}
                          </li>
                        ))}
                        </ul>
                      </details>
                    )}
                    {!msg.isLoading && <p className="text-xs opacity-60 mt-1.5 text-right">{msg.timestamp ? formatDistanceToNow(msg.timestamp, { addSuffix: true, locale: fr }) : ''}</p>}
                  </div>
                </div>
              ))}
               <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="space-y-2 border-t pt-3 mt-auto shrink-0">
            <Textarea
              id="agent-input-textarea"
              value={currentUserRequest}
              onChange={(e) => setCurrentUserRequest(e.target.value)}
              placeholder={user ? (isCreatingSession ? "Création de la session..." : "Demandez à ThesisBot...") : "Veuillez vous connecter pour utiliser l'assistant."}
              rows={2}
              className="text-sm min-h-[60px] resize-none custom-scrollbar"
              disabled={isLoadingAgent || !user || isCreatingSession || isFetchingMessages || isFetchingSessions}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && user && !isCreatingSession && !isFetchingMessages && !isFetchingSessions) {
                  e.preventDefault();
                  handleSendToAgent();
                }
              }}
            />
            <div className="flex gap-2">
              <Button onClick={handleSendToAgent} disabled={isLoadingAgent || !currentUserRequest.trim() || !user || isCreatingSession || isFetchingMessages || isFetchingSessions} className="flex-1">
                {isLoadingAgent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {isLoadingAgent ? 'Envoi...' : 'Envoyer'}
              </Button>
            </div>
             {error && (
              <p className="text-xs text-destructive flex items-center gap-1 pt-1"><AlertTriangle className="h-3.5 w-3.5" /> {error}</p>
            )}
          </div>
          
          <details className="border-t pt-3 shrink-0">
            <summary className="text-sm font-medium flex items-center gap-2 text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              <History className="h-4 w-4" /> Historique des Prompts Affinés (5 derniers)
            </summary>
            <div className="mt-2 flex-grow overflow-hidden flex flex-col">
              {isFetchingLogs ? (
                <div className="flex-grow flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : promptLogs.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm border rounded-md p-4 bg-muted/30">
                  <History className="mx-auto h-10 w-10 opacity-50 mb-2"/>
                  <p className="font-medium">Le journal des prompts est vide.</p>
                  <p className="text-xs">Les prompts affinés par l'IA apparaîtront ici.</p>
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


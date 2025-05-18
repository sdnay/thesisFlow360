
"use client";

import { useState, type FC, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { PromptLogEntry, ChatSession, ChatMessage, ThesisAgentOutput } from '@/types';
import { processUserRequest } from '@/ai/flows/thesis-agent-flow';
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
import PromptLogItemDisplay from './chat-panel-components/PromptLogItemDisplay'; // Extracted component

// Interface pour les messages affichés dans l'UI du chat
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
  const [isDeletingSessionId, setIsDeletingSessionId] = useState<string | null>(null);


  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  },[]);

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
    if (!user) { 
      setChatSessions([]); 
      setCurrentSessionId(null);
      setCurrentSessionTitle("Nouvelle Discussion");
      setConversation([]);
      setIsFetchingSessions(false); 
      return; 
    }
    setIsFetchingSessions(true);
    try {
      const { data, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('id, title, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (sessionError) throw sessionError;
      
      const fetchedSessions = data || [];
      setChatSessions(fetchedSessions);

      if (fetchedSessions.length > 0) {
        if (!currentSessionId || !fetchedSessions.find(s => s.id === currentSessionId)) {
           // Si aucune session n'est sélectionnée OU si la session active n'est plus dans la liste
           setCurrentSessionId(fetchedSessions[0].id);
           setCurrentSessionTitle(fetchedSessions[0].title);
        } else {
           // S'assurer que le titre de la session active est à jour si elle existe toujours
           const activeSession = fetchedSessions.find(s => s.id === currentSessionId);
           if (activeSession) setCurrentSessionTitle(activeSession.title);
        }
      } else {
        // Aucune session existante
        handleNewChat();
      }

    } catch (e: any) {
      console.error("Erreur chargement sessions de chat:", e);
      toast({ title: "Erreur Sessions", description: "Impossible de charger les sessions de chat.", variant: "destructive" });
    } finally {
      setIsFetchingSessions(false);
    }
  }, [user, toast, currentSessionId]); // currentSessionId en dépendance pour rafraîchir le titre

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
    if(user) {
        fetchPromptLogs();
        fetchChatSessions(); // Cela va charger les sessions et potentiellement la première session ou une nouvelle
    } else {
        // Réinitialiser si l'utilisateur se déconnecte
        setPromptLogs([]);
        setChatSessions([]);
        setCurrentSessionId(null);
        setCurrentSessionTitle("Nouvelle Discussion");
        setConversation([]);
    }
  }, [user, fetchPromptLogs, fetchChatSessions]);

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
    
    const channels = supabase
      .channel(`db-chat-panel-user-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prompt_log_entries', filter: `user_id=eq.${user.id}` }, fetchPromptLogs)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `user_id=eq.${user.id}` }, (payload) => {
        const changedSessionId = payload.new?.session_id || (payload.old as any)?.session_id;
        if (changedSessionId === currentSessionId) {
          loadMessagesForSession(currentSessionId);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions', filter: `user_id=eq.${user.id}` }, fetchChatSessions)
      .subscribe((status, err) => {
        if (err) { console.error('Erreur abonnement Realtime Chat Panel:', err); }
      });

    return () => {
      supabase.removeChannel(channels);
    };
  }, [user, fetchPromptLogs, loadMessagesForSession, fetchChatSessions, currentSessionId]);

  const createNewChatSession = async (firstUserMessageContent: string): Promise<string | null> => {
    if (!user) return null;
    setIsCreatingSession(true);
    try {
      const title = firstUserMessageContent.substring(0, 35).trim() + (firstUserMessageContent.length > 35 ? "..." : "") || `Discussion ${format(new Date(), 'dd/MM HH:mm', { locale: fr })}`;
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({ user_id: user.id, title })
        .select('id, title, updated_at')
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

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setCurrentSessionTitle("Nouvelle Discussion");
    setConversation([]);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handleSelectSession = (sessionId: string | null) => {
    if (sessionId === 'new_chat_trigger') {
        handleNewChat();
    } else {
        setCurrentSessionId(sessionId);
    }
  };
  
  const handleDeleteSession = async (sessionIdToDelete: string) => {
    if (!user || isDeletingSessionId || !sessionIdToDelete) return;
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette session de discussion et tous ses messages ? Cette action est irréversible.")) return;
    
    setIsDeletingSessionId(sessionIdToDelete);
    try {
      const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionIdToDelete).eq('user_id', user.id);
      if (error) throw error;
      toast({ title: "Session supprimée" });
      
      const remainingSessions = chatSessions.filter(s => s.id !== sessionIdToDelete);
      setChatSessions(remainingSessions);

      if (currentSessionId === sessionIdToDelete) {
        if (remainingSessions.length > 0) {
          setCurrentSessionId(remainingSessions[0].id); // Sélectionne la plus récente des restantes
        } else {
          handleNewChat(); // Aucune session restante, initie une nouvelle discussion
        }
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: "Impossible de supprimer la session.", variant: "destructive" });
      console.error("Erreur handleDeleteSession:", e);
    } finally {
      setIsDeletingSessionId(null);
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
      const newlyCreatedSessionId = await createNewChatSession(requestTextForAgent);
      if (newlyCreatedSessionId) {
        activeSessionId = newlyCreatedSessionId;
        setCurrentSessionId(newlyCreatedSessionId);
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
    
    const loadingAgentMessage: DisplayMessage = {
      id: `agent-loading-${Date.now()}`,
      role: 'agent',
      content: 'ThesisBot réfléchit...',
      timestamp: new Date(),
      isLoading: true,
    };
    setConversation(prev => [...prev, loadingAgentMessage]);

    console.log('[ChatPanel] Conversation state before mapping to history:', JSON.stringify(conversation.filter(m => m.id !== tempUserMessageId && m.id !== loadingAgentMessage.id && !m.isLoading), null, 2));
    
    const formattedAgentChatHistory = conversation
        .filter(m => m.id !== tempUserMessageId && m.id !== loadingAgentMessage.id && !m.isLoading) 
        .map(msg => {
          console.log(`[ChatPanel] Formatting msg ID: ${msg.id}, Role: ${msg.role}, Content: "${msg.content}" (Type: ${typeof msg.content})`);
          return {
            role: msg.role === 'user' ? 'user' : ('model' as 'user' | 'model'),
            parts: [{ text: String(msg.content === undefined || msg.content === null ? "Contenu manquant ou invalide" : msg.content) }],
          };
        }) as Array<{role: 'user' | 'model'; parts: {text: string}[]}> | undefined;

    console.log('[ChatPanel] Final formattedAgentChatHistory to be sent:', JSON.stringify(formattedAgentChatHistory, null, 2));

    try {
      const agentInput = { 
        userRequest: requestTextForAgent,
        chatHistory: (formattedAgentChatHistory && formattedAgentChatHistory.length > 0) ? formattedAgentChatHistory : null,
      };
      const result: ThesisAgentOutput = await processUserRequest(agentInput);
      
      const agentResponseMessage: DisplayMessage = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: result.responseMessage,
        timestamp: new Date(),
        actions_taken: result.actionsTaken,
      };
      
      setConversation(prev => [...prev.filter(m => m.id !== loadingAgentMessage.id), agentResponseMessage]);

      await supabase.from('chat_messages').insert({
        session_id: activeSessionId,
        user_id: user.id,
        role: 'agent',
        content: result.responseMessage,
        actions_taken: result.actionsTaken || null,
      });

       const updatedSession = chatSessions.find(s => s.id === activeSessionId);
       if (updatedSession) {
         setChatSessions(prev => prev.map(s => s.id === activeSessionId ? {...s, updated_at: new Date().toISOString()} : s).sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
       }
    } catch (e: any) {
      const errorMessage = `Erreur de l'agent: ${e.message || "Une erreur inconnue est survenue."}`;
      setError(errorMessage);
      const agentErrorMessage: DisplayMessage = {id: `agent-error-${Date.now()}`, role: 'agent', content: errorMessage, timestamp: new Date() };
      setConversation(prev => [...prev.filter(m => m.id !== loadingAgentMessage.id), agentErrorMessage]);
      toast({ title: "Erreur de l'Agent", description: e.message || "Une erreur est survenue.", variant: "destructive" });
    } finally {
      setIsLoadingAgent(false);
    }
  };
  
  const handleUsePromptFromLog = (promptText: string) => {
    setCurrentUserRequest(promptText);
    if (textareaRef.current) textareaRef.current.focus();
  };
  
  const sessionDropdownTitle = currentSessionId ? (chatSessions.find(s => s.id === currentSessionId)?.title || (isFetchingSessions ? "Chargement..." : "Nouvelle Discussion")) : "Nouvelle Discussion";

  return (
    <div className="flex flex-col h-full p-1 md:p-2 bg-background">
      <Card className="flex-grow flex flex-col shadow-none border-0 md:border md:shadow-lg overflow-hidden">
        <CardHeader className="border-b p-3 md:p-4 flex flex-row justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm md:text-base">Assistant IA ThesisBot</CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto h-8 text-xs md:text-sm whitespace-nowrap max-w-[180px] truncate" disabled={isFetchingSessions || isCreatingSession || !!isDeletingSessionId}>
                {isFetchingSessions ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="truncate" title={sessionDropdownTitle}>{sessionDropdownTitle}</span> }
                <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto custom-scrollbar">
              <DropdownMenuLabel className="text-xs">Discussions</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => handleSelectSession('new_chat_trigger')} className="text-sm cursor-pointer">
                <Plus className="mr-2 h-4 w-4" /> Nouvelle Discussion
              </DropdownMenuItem>
              {isFetchingSessions && <DropdownMenuItem disabled className="text-sm"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Chargement...</DropdownMenuItem>}
              {!isFetchingSessions && chatSessions.length > 0 && <DropdownMenuSeparator />}
              {chatSessions.map(session => (
                <DropdownMenuItem key={session.id} onSelect={() => handleSelectSession(session.id)} className={cn("text-sm cursor-pointer flex justify-between items-center group/item pr-1", currentSessionId === session.id && "bg-accent text-accent-foreground")}>
                  <div className="flex items-center truncate max-w-[calc(100%-2.5rem)]"> {/* Adjust max-width */}
                    <MessageSquare className="mr-2 h-4 w-4 opacity-70 shrink-0" />
                    <span className="truncate" title={session.title}>{session.title}</span>
                  </div>
                   {currentSessionId === session.id && <Check className="h-4 w-4 text-primary shrink-0 ml-auto mr-1" />}
                   <Button 
                     variant="ghost" 
                     size="icon" 
                     className="h-7 w-7 opacity-50 group-hover/item:opacity-100 hover:!opacity-100 hover:text-destructive shrink-0 ml-1" 
                     onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }} 
                     disabled={isDeletingSessionId === session.id} 
                     title="Supprimer la session"
                   >
                       {isDeletingSessionId === session.id ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Trash2 className="h-3.5 w-3.5"/>}
                   </Button>
                </DropdownMenuItem>
              ))}
               {!isFetchingSessions && chatSessions.length === 0 && <DropdownMenuItem disabled className="text-xs italic text-muted-foreground">Aucune session</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        
        <CardContent className="flex-grow flex flex-col gap-3 md:gap-4 p-3 md:p-4 overflow-hidden">
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
                            <strong>{action.toolName}</strong>: {action.toolOutput?.message || JSON.stringify(action.toolOutput, null, 2)}
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
              ref={textareaRef}
              value={currentUserRequest}
              onChange={(e) => setCurrentUserRequest(e.target.value)}
              placeholder={user ? (isCreatingSession ? "Création de la session..." : (isFetchingMessages ? "Chargement..." : "Demandez à ThesisBot...")) : "Veuillez vous connecter pour utiliser l'assistant."}
              rows={2}
              className="text-sm min-h-[60px] resize-none custom-scrollbar"
              disabled={isLoadingAgent || !user || isCreatingSession || isFetchingMessages || isFetchingSessions}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && user && !isCreatingSession && !isFetchingMessages && !isFetchingSessions && !isLoadingAgent) {
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
                <div className="flex-grow flex items-center justify-center py-4"> <Loader2 className="h-6 w-6 animate-spin text-primary" /> </div>
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

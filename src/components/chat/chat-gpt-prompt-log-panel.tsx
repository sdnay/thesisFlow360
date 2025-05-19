
"use client";

import { useState, type FC, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { PromptLogEntry, ChatSession, ChatMessage as DbChatMessage, ThesisAgentOutput, DisplayMessage } from '@/types';
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
import PromptLogItemDisplay from './chat-panel-components/PromptLogItemDisplay';


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
      handleNewChat(); // Réinitialise pour un état propre si pas d'utilisateur
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

      // Logique pour déterminer la session active après le fetch
      if (fetchedSessions.length > 0) {
        const activeSessionStillExists = currentSessionId && fetchedSessions.some(s => s.id === currentSessionId);
        if (activeSessionStillExists) {
          const activeSession = fetchedSessions.find(s => s.id === currentSessionId);
          setCurrentSessionTitle(activeSession?.title || "Discussion");
          // Ne pas appeler loadMessagesForSession ici, currentSessionId useEffect s'en charge
        } else {
          // Si la session active n'existe plus (ex: supprimée dans un autre onglet)
          // ou si aucune session n'était active, sélectionner la plus récente ou initier une nouvelle.
          // Pour l'instant, si currentSessionId est null (nouvelle discussion), on le laisse comme ça.
          // Si currentSessionId était défini mais n'existe plus, on pourrait sélectionner fetchedSessions[0].id
          // ou appeler handleNewChat(). Pour plus de simplicité, on va laisser l'useEffect de currentSessionId gérer.
          if (currentSessionId && !activeSessionStillExists) {
            // La session active a été supprimée ailleurs, on passe à la plus récente ou à une nouvelle.
             handleSelectSession(fetchedSessions[0]?.id || null);
          } else if (!currentSessionId) {
            // Reste sur "Nouvelle Discussion"
          }
        }
      } else {
        // Aucune session existante pour l'utilisateur
        handleNewChat();
      }
    } catch (e: any) {
      console.error("Erreur chargement sessions de chat:", e);
      toast({ title: "Erreur Sessions", description: "Impossible de charger les sessions de chat.", variant: "destructive" });
      handleNewChat(); // Fallback vers une nouvelle discussion en cas d'erreur
    } finally {
      setIsFetchingSessions(false);
    }
  }, [user, toast, currentSessionId]); // currentSessionId ajouté pour la logique de sélection

  const loadMessagesForSession = useCallback(async (sessionId: string) => {
    if (!user || !sessionId) { 
      setConversation([]); 
      setIsFetchingMessages(false);
      return;
    }
    console.log(`[ChatPanel] Chargement des messages pour la session ID: ${sessionId}`);
    setIsFetchingMessages(true);
    try {
      const { data, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('timestamp', { ascending: true });
      if (messagesError) throw messagesError;
      
      setConversation((data || []).map((msg: DbChatMessage) => ({
        id: msg.id,
        role: msg.role as 'user' | 'agent',
        content: String(msg.content ?? "Contenu du message manquant ou invalide"), // Assurer que content est une chaîne
        timestamp: new Date(msg.timestamp),
        actions_taken: msg.actions_taken as ThesisAgentOutput['actionsTaken'] || undefined,
      })));
      console.log(`[ChatPanel] Messages chargés pour la session ${sessionId}:`, data?.length || 0);
    } catch (e: any) {
      console.error(`Erreur chargement messages pour session ${sessionId}:`, e);
      toast({ title: "Erreur Messages", description: "Impossible de charger les messages.", variant: "destructive" });
      setConversation([]);
    } finally {
      setIsFetchingMessages(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if(user) {
        fetchPromptLogs();
        fetchChatSessions(); 
    } else {
        setPromptLogs([]);
        handleNewChat(); 
    }
  }, [user, fetchPromptLogs]); // fetchChatSessions est appelé séparément

  useEffect(() => {
    if (user && currentSessionId) {
      loadMessagesForSession(currentSessionId);
      const selectedSession = chatSessions.find(s => s.id === currentSessionId);
      setCurrentSessionTitle(selectedSession?.title || "Discussion");
    } else if (!user || !currentSessionId) {
      // Si pas d'utilisateur ou pas de session ID, c'est géré par handleNewChat ou la logique initiale.
    }
  }, [currentSessionId, user, loadMessagesForSession, chatSessions]);


  useEffect(() => {
    if (!user) return;
    
    const channels = supabase
      .channel(`db-chat-panel-user-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prompt_log_entries', filter: `user_id=eq.${user.id}` }, fetchPromptLogs)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `user_id=eq.${user.id}` }, (payload) => {
        const newMessage = payload.new as DbChatMessage;
        if (newMessage.session_id === currentSessionId) {
            // Plutôt que de recharger tous les messages, on pourrait ajouter le nouveau à 'conversation'
            // Mais pour la robustesse, recharger est plus simple pour l'instant.
            loadMessagesForSession(currentSessionId); 
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions', filter: `user_id=eq.${user.id}` }, (payload) => {
          console.log('[ChatPanel] Changement détecté sur chat_sessions via Realtime', payload);
          fetchChatSessions(); // Rafraîchit la liste des sessions
      })
      .subscribe((status, err) => {
        if (err) { console.error('Erreur abonnement Realtime Chat Panel:', err); }
      });

    return () => {
      supabase.removeChannel(channels);
    };
  }, [user, fetchPromptLogs, loadMessagesForSession, fetchChatSessions, currentSessionId]);

  const createNewChatSession = async (firstUserMessageContent: string): Promise<ChatSession | null> => {
    if (!user) return null;
    console.log("[ChatPanel] Création d'une nouvelle session de chat...");
    setIsCreatingSession(true);
    try {
      const title = firstUserMessageContent.substring(0, 35).trim() + (firstUserMessageContent.length > 35 ? "..." : "") || `Discussion ${format(new Date(), 'dd/MM HH:mm', { locale: fr })}`;
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({ user_id: user.id, title })
        .select('id, title, updated_at') // S'assurer que user_id est dans les données retournées si nécessaire ailleurs
        .single();
      if (error) throw error;

      if (data) {
        // Important: Supabase ne retourne pas `user_id` par défaut après insert à moins de le spécifier dans select
        // ou de l'ajouter manuellement si on en a besoin dans l'objet ChatSession local immédiatement.
        // Pour l'instant, l'objet data retourné contient id, title, updated_at.
        const newSession: ChatSession = { ...data, user_id: user.id }; 
        console.log("[ChatPanel] Nouvelle session créée:", newSession);
        toast({ title: "Nouvelle session créée", description: newSession.title });
        setChatSessions(prev => [newSession, ...prev].sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
        return newSession;
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

  const handleNewChat = useCallback(() => {
    console.log("[ChatPanel] handleNewChat appelé");
    setCurrentSessionId(null);
    setCurrentSessionTitle("Nouvelle Discussion");
    setConversation([]);
    setCurrentUserRequest('');
    if (textareaRef.current) textareaRef.current.focus();
  }, []);

  const handleSelectSession = (sessionId: string | null) => {
    console.log(`[ChatPanel] Sélection de session : ${sessionId}`);
    if (sessionId === 'new_chat_trigger' || sessionId === null) {
        handleNewChat();
    } else {
        setCurrentSessionId(sessionId);
        // Le titre et les messages seront mis à jour par les useEffect qui observent currentSessionId
    }
  };
  
  const handleDeleteSession = async (sessionIdToDelete: string) => {
    if (!user || isDeletingSessionId || !sessionIdToDelete) return;
    // Confirmation utilisateur
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette session de discussion et tous ses messages ? Cette action est irréversible.")) {
        return;
    }
    
    console.log(`[ChatPanel] Tentative de suppression de la session ID: ${sessionIdToDelete}`);
    setIsDeletingSessionId(sessionIdToDelete);
    try {
      // La RLS devrait s'assurer que l'utilisateur ne supprime que ses propres sessions.
      // La table chat_messages a ON DELETE CASCADE pour session_id.
      const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionIdToDelete).eq('user_id', user.id);
      if (error) throw error;
      toast({ title: "Session supprimée" });
      
      const updatedSessions = chatSessions.filter(s => s.id !== sessionIdToDelete);
      setChatSessions(updatedSessions);
      
      if (currentSessionId === sessionIdToDelete) {
        if (updatedSessions.length > 0) {
          handleSelectSession(updatedSessions[0].id); // Sélectionner la plus récente des restantes
        } else {
          handleNewChat(); // Aucune session restante
        }
      }
      // Si une autre session était active, pas besoin de changer currentSessionId.
      // fetchChatSessions(); // Optionnel, car on met à jour l'état local. Realtime devrait aussi suivre.
    } catch (e: any) {
      toast({ title: "Erreur", description: "Impossible de supprimer la session.", variant: "destructive" });
      console.error("Erreur handleDeleteSession:", e);
    } finally {
      setIsDeletingSessionId(null);
    }
  };
  
  const handleSendToAgent = async () => {
    if (currentUserRequest.trim() === '' || !user) return;

    const userMessageContent = currentUserRequest.trim();
    let activeSessionId = currentSessionId;

    // 1. Construire l'historique à partir de l'état ACTUEL de la conversation (avant d'ajouter le nouveau message utilisateur)
    console.log('[ChatPanel] Construction de l\'historique. État actuel de conversation:', JSON.stringify(conversation, null, 2));
    const agentChatHistory = conversation
      .filter(m => !m.isLoading) // Exclure les messages de chargement précédents s'il y en a
      .map(msg => {
        // Garantit que textContent est TOUJOURS une chaîne.
        const textContent = msg.content || ""; 
        console.log(`[ChatPanel] Hist: Rôle: ${msg.role}, Texte Original: "${msg.content}", Texte Utilisé: "${textContent}"`);
        return {
          role: msg.role === 'user' ? 'user' : ('model' as 'user' | 'model'),
          parts: [{ text: textContent }],
        };
      })
      .filter(entry => typeof entry.parts[0]?.text === 'string') as Array<{role: 'user' | 'model'; parts: {text: string}[]}> | undefined;
    console.log('[ChatPanel] Historique formaté envoyé à l\'agent:', JSON.stringify(agentChatHistory, null, 2));


    // 2. Préparer et ajouter le message utilisateur à l'affichage local
    const tempUserMessageId = `user-${Date.now()}`;
    const userMessage: DisplayMessage = {
      id: tempUserMessageId,
      role: 'user',
      content: userMessageContent,
      timestamp: new Date(),
    };
    // Important: ajouter le message à l'affichage APRES avoir construit l'historique
    setConversation(prev => [...prev, userMessage]);
    
    setCurrentUserRequest(''); 
    setIsLoadingAgent(true);
    setError(null);
    
    // 3. Gérer la session (créer si nouvelle discussion)
    if (!activeSessionId) {
      console.log("[ChatPanel] Pas de session active, tentative de création...");
      const newSession = await createNewChatSession(userMessageContent);
      if (newSession) {
        activeSessionId = newSession.id;
        setCurrentSessionId(newSession.id); // Mettre à jour l'ID de session active globalement
        setCurrentSessionTitle(newSession.title);
      } else {
        // Échec de création de session, annuler l'envoi
        setConversation(prev => prev.filter(m => m.id !== tempUserMessageId)); // Retirer le message utilisateur de l'UI
        setIsLoadingAgent(false);
        toast({ title: "Erreur Session", description: "Impossible de démarrer une nouvelle discussion. Veuillez réessayer.", variant: "destructive" });
        return;
      }
    }
    
    // 4. Sauvegarder le message de l'utilisateur en base de données
    const { error: userMsgDbError } = await supabase.from('chat_messages').insert({
      session_id: activeSessionId, // Doit être l'ID de la session (nouvelle ou existante)
      user_id: user.id,
      role: 'user',
      content: userMessageContent,
    });

    if (userMsgDbError) {
      toast({ title: "Erreur Message", description: "Impossible d'enregistrer votre message.", variant: "destructive" });
      setConversation(prev => prev.filter(m => m.id !== tempUserMessageId));
      setIsLoadingAgent(false);
      return;
    }
    
    // 5. Ajouter le message de chargement de l'agent à l'affichage local
    const loadingAgentMessage: DisplayMessage = {
      id: `agent-loading-${Date.now()}`,
      role: 'agent',
      content: 'ThesisBot réfléchit...',
      timestamp: new Date(),
      isLoading: true,
    };
    setConversation(prev => [...prev, loadingAgentMessage]);
    
    try {
      const agentInput = { 
        userRequest: userMessageContent,
        chatHistory: (agentChatHistory && agentChatHistory.length > 0) ? agentChatHistory : null,
      };
      const result: ThesisAgentOutput = await processUserRequest(agentInput);
      
      const agentResponseContent = String(result.responseMessage ?? "L'agent n'a pas fourni de message explicite.");
      const agentResponseMessage: DisplayMessage = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: agentResponseContent,
        timestamp: new Date(),
        actions_taken: result.actionsTaken,
      };
      
      // Remplacer le message de chargement par la réponse réelle de l'agent
      setConversation(prev => [...prev.filter(m => m.id !== loadingAgentMessage.id), agentResponseMessage]);

      // Sauvegarder la réponse de l'agent en base de données
      await supabase.from('chat_messages').insert({
        session_id: activeSessionId,
        user_id: user.id, // L'agent agit pour le compte de l'utilisateur ici
        role: 'agent',
        content: agentResponseMessage.content,
        actions_taken: result.actionsTaken || null,
      });

       // Mettre à jour updated_at de la session via le trigger ou manuellement si trigger non fiable/désactivé
       const { error: updateSessionError } = await supabase
         .from('chat_sessions')
         .update({ updated_at: new Date().toISOString() })
         .eq('id', activeSessionId!) // activeSessionId ne devrait pas être null ici
         .eq('user_id', user.id);
        if (updateSessionError) console.warn("Erreur mise à jour updated_at session:", updateSessionError);
        
    } catch (e: any) {
      const errorMessage = String(e.message || "Une erreur inconnue est survenue lors de l'appel à l'agent.");
      setError(errorMessage);
      const agentErrorMessage: DisplayMessage = {id: `agent-error-${Date.now()}`, role: 'agent', content: errorMessage, timestamp: new Date() };
      setConversation(prev => [...prev.filter(m => m.id !== loadingAgentMessage.id), agentErrorMessage]);
      toast({ title: "Erreur de l'Agent", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoadingAgent(false);
    }
  };
  
  const handleUsePromptFromLog = (promptText: string) => {
    setCurrentUserRequest(promptText);
    if (textareaRef.current) textareaRef.current.focus();
  };
  
  const sessionDropdownTitle = currentSessionId && chatSessions.find(s => s.id === currentSessionId)
    ? (chatSessions.find(s => s.id === currentSessionId)?.title || "Discussion") 
    : "Nouvelle Discussion";

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
              <DropdownMenuItem onSelect={() => handleSelectSession(null)} className="text-sm cursor-pointer">
                <Plus className="mr-2 h-4 w-4" /> Nouvelle Discussion
              </DropdownMenuItem>
              {isFetchingSessions && <DropdownMenuItem disabled className="text-sm"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Chargement...</DropdownMenuItem>}
              {!isFetchingSessions && chatSessions.length > 0 && <DropdownMenuSeparator />}
              {chatSessions.map(session => (
                <DropdownMenuItem 
                  key={session.id} 
                  onSelect={(e) => { 
                    const target = e.target as HTMLElement;
                    // Empêcher la sélection si on clique sur le bouton de suppression
                    if (!target.closest('[data-role="delete-session-btn"]')) {
                      handleSelectSession(session.id);
                    }
                  }} 
                  className={cn("text-sm cursor-pointer flex justify-between items-center group/item pr-1", currentSessionId === session.id && "bg-accent text-accent-foreground")}
                >
                  <div className="flex items-center truncate max-w-[calc(100%-2.5rem)]">
                    <MessageSquare className="mr-2 h-4 w-4 opacity-70 shrink-0" />
                    <span className="truncate" title={session.title}>{session.title}</span>
                  </div>
                   {currentSessionId === session.id && <Check className="h-4 w-4 text-primary shrink-0 ml-auto mr-1" />}
                   <Button 
                     data-role="delete-session-btn" // Rôle pour cibler le clic
                     variant="ghost" 
                     size="icon" 
                     className="h-7 w-7 opacity-0 group-hover/item:opacity-100 hover:!opacity-100 hover:text-destructive shrink-0 ml-1" 
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
        
        <CardContent className="flex-grow flex flex-col gap-3 md:gap-4 p-3 md:p-4 overflow-hidden"> {/* Ajout de overflow-hidden ici */}
          <ScrollArea className="flex-grow pr-2 -mr-2 mb-2 border rounded-md p-2 bg-muted/30 custom-scrollbar">
            {isFetchingMessages ? (
              <div className="flex justify-center items-center h-full text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Chargement des messages...</div>
            ) : conversation.length === 0 && !isLoadingAgent && !isFetchingSessions && (
              <div className="text-sm text-muted-foreground text-center py-6 h-full flex flex-col justify-center items-center">
                <Sparkles className="mx-auto h-8 w-8 text-primary/70 mb-2"/>
                {currentSessionId ? "Aucun message dans cette session." : (isCreatingSession ? "Création de la session..." : "Commencez une nouvelle discussion ou sélectionnez-en une existante.")}
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
                            <strong>{action.toolName}</strong>: {String(action.toolOutput?.message || JSON.stringify(action.toolOutput, null, 2))}
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

          <div className="space-y-2 border-t pt-3 mt-auto shrink-0"> {/* Zone de saisie */}
            <Textarea
              id="agent-input-textarea"
              ref={textareaRef}
              value={currentUserRequest}
              onChange={(e) => setCurrentUserRequest(e.target.value)}
              placeholder={user ? (isCreatingSession ? "Création de la session..." : (isFetchingMessages ? "Chargement..." : (currentSessionId ? "Votre message à ThesisBot..." : "Commencez une nouvelle discussion..."))) : "Veuillez vous connecter pour utiliser l'assistant."}
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


    
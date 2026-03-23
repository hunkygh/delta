import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp, ArrowUpLeft, ChevronDown, Mic, Square, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import aiChatThreadService, { type AiChatThreadSummary } from '../../services/aiChatThreadService';
import chatPersistence from '../../services/chatPersistence';
import chatService from '../../services/chatService';
import type { Event } from '../../types/Event';
import type { ChatContext, ChatMessage, ChatProposal } from '../../types/chat';

interface AiRailRequest {
  id: string;
  prompt: string;
  context?: ChatContext | null;
  label?: {
    kicker: string;
    title: string;
  };
}

interface QueuedOutboundMessage {
  id: string;
  content: string;
  context: ChatContext | null;
  messageId: string;
  label?: AiRailRequest['label'] | null;
}

interface AiRailCardProps {
  currentBlock: Event | null;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  threadEvent?: Event | null;
  threadMode?: 'general' | 'block';
  request?: AiRailRequest | null;
  onPushProposal?: (proposal: ChatProposal, assistantText: string) => Promise<string | void> | string | void;
}

const MAX_MESSAGES = 60;
type ShellAiMode = 'text' | 'voice';
type ShellAiVisualState = 'closed' | 'opening' | 'open' | 'closing';

export default function AiRailCard({
  currentBlock,
  expanded,
  onExpandedChange,
  threadEvent = null,
  threadMode = 'general',
  request = null,
  onPushProposal
}: AiRailCardProps): JSX.Element {
  const { user } = useAuth();
  const [mode, setMode] = useState<ShellAiMode>('text');
  const [visualState, setVisualState] = useState<ShellAiVisualState>(expanded ? 'open' : 'closed');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threadSummaries, setThreadSummaries] = useState<AiChatThreadSummary[]>([]);
  const [threadsMenuOpen, setThreadsMenuOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeOutboundMessageId, setActiveOutboundMessageId] = useState<string | null>(null);
  const [enteringMessageId, setEnteringMessageId] = useState<string | null>(null);
  const [applyingProposalId, setApplyingProposalId] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<AiRailRequest['label'] | null>(null);
  const [proposalTitleDrafts, setProposalTitleDrafts] = useState<Record<string, string>>({});
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const threadsMenuRef = useRef<HTMLDivElement | null>(null);
  const messageStateRef = useRef<ChatMessage[]>([]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const latestRequestIdRef = useRef<string | null>(null);
  const expandedCardRef = useRef<HTMLDivElement | null>(null);
  const queuedOutboundRef = useRef<QueuedOutboundMessage[]>([]);
  const isExpandedVisual = visualState === 'opening' || visualState === 'open' || visualState === 'closing';

  const effectiveEvent = threadEvent || currentBlock;
  const latestNodeContext = useMemo(() => {
    const requestContext = request?.context;
    if (requestContext?.node_id) return requestContext;
    const latestWithContext = [...messages].reverse().find((entry) => entry.context?.node_id)?.context || null;
    return latestWithContext;
  }, [messages, request]);
  const persistenceScopeKey = latestNodeContext?.node_id
    ? `node:${latestNodeContext.node_id}:${latestNodeContext.focal_id || 'global'}:${latestNodeContext.node_mode || 'operate'}`
    : threadMode === 'block' && threadEvent
      ? `time-block:${threadEvent.id}`
      : 'general';
  const activeThreadRef = useRef<string | null>(null);

  useEffect(() => {
    activeThreadRef.current = activeThreadId;
  }, [activeThreadId]);

  useEffect(() => {
    if (!user?.id) {
      setThreadSummaries([]);
      setActiveThreadId(null);
      return;
    }

    let cancelled = false;
    const loadThreads = async (): Promise<void> => {
      const threads = await aiChatThreadService.listThreads(user.id);
      if (cancelled) return;
      setThreadSummaries(threads);
      const matchingThread = threads.find((entry) => entry.scope_key === persistenceScopeKey) || null;
      if (!activeThreadRef.current && matchingThread) {
        setActiveThreadId(matchingThread.id);
      }
    };

    void loadThreads();
    return () => {
      cancelled = true;
    };
  }, [persistenceScopeKey, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    const loadMessages = async (): Promise<void> => {
      if (activeThreadId) {
        const stored = await aiChatThreadService.getThreadMessages(activeThreadId);
        if (cancelled) return;
        setMessages(stored);
        return;
      }

      const state = chatPersistence.load(user.id, MAX_MESSAGES, persistenceScopeKey);
      if (cancelled) return;
      setMessages(state.messages || []);
    };

    void loadMessages();
    return () => {
      cancelled = true;
    };
  }, [activeThreadId, persistenceScopeKey, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    chatPersistence.save(user.id, messages, MAX_MESSAGES, persistenceScopeKey);
  }, [messages, persistenceScopeKey, user?.id]);

  useEffect(() => {
    messageStateRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (expanded) {
      setVisualState((prev) => (prev === 'open' ? prev : 'opening'));
      const frameId = window.requestAnimationFrame(() => {
        setVisualState('open');
      });
      return () => window.cancelAnimationFrame(frameId);
    }

    if (visualState === 'closed') {
      return undefined;
    }

    setVisualState('closing');
    const timeoutId = window.setTimeout(() => {
      setVisualState('closed');
    }, 560);

    return () => window.clearTimeout(timeoutId);
  }, [expanded]);

  useEffect(() => {
    if ((visualState !== 'open' && visualState !== 'opening') || !messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, visualState]);

  useEffect(() => {
    if (!enteringMessageId) return;
    const timeoutId = window.setTimeout(() => {
      setEnteringMessageId((current) => (current === enteringMessageId ? null : current));
    }, 520);
    return () => window.clearTimeout(timeoutId);
  }, [enteringMessageId]);

  useEffect(() => {
    if (!isExpandedVisual) return;
    const handlePointerDown = (event: MouseEvent): void => {
      if (expandedCardRef.current && !expandedCardRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement | null;
        if (target?.closest('.shell-refactor-page') && !target.closest('.shell-layout')) {
          onExpandedChange(false);
        }
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isExpandedVisual, onExpandedChange]);

  useEffect(() => {
    if (!threadsMenuOpen) return;
    const handlePointerDown = (event: MouseEvent): void => {
      if (threadsMenuRef.current && !threadsMenuRef.current.contains(event.target as Node)) {
        setThreadsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [threadsMenuOpen]);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = '0px';
    const nextHeight = Math.min(Math.max(inputRef.current.scrollHeight, 24), 88);
    inputRef.current.style.height = `${nextHeight}px`;
  }, [draft, mode, visualState]);

  const chatContext = useMemo<ChatContext | null>(() => {
    if (!effectiveEvent) return null;
    return {
      time_block_id: effectiveEvent.id,
      time_block_occurrence: {
        scheduled_start_utc: effectiveEvent.start,
        scheduled_end_utc: effectiveEvent.end
      }
    };
  }, [effectiveEvent]);

  const buildThreadHeader = (label?: AiRailRequest['label'] | null): { kicker: string; title: string } => {
    if (label) {
      return {
        kicker: label.kicker,
        title: label.title
      };
    }
    if (threadMode === 'block' && threadEvent) {
      return {
        kicker: 'Thread',
        title: threadEvent.title
      };
    }
    if (activeLabel) {
      return {
        kicker: activeLabel.kicker,
        title: activeLabel.title
      };
    }
    return {
      kicker: 'Delta AI',
      title: 'General workspace chat'
    };
  };

  const syncThreadSummaries = async (): Promise<void> => {
    if (!user?.id) return;
    const threads = await aiChatThreadService.listThreads(user.id);
    setThreadSummaries(threads);
  };

  const ensureActiveThread = async (
    context: ChatContext | null,
    label?: AiRailRequest['label'] | null
  ): Promise<string | null> => {
    if (!user?.id) return null;
    if (activeThreadRef.current) return activeThreadRef.current;

    const header = buildThreadHeader(label || null);
    const created = await aiChatThreadService.createThread({
      userId: user.id,
      title: header.title,
      kicker: header.kicker,
      scopeKey: persistenceScopeKey,
      context
    });

    if (!created) return null;
    setActiveThreadId(created.id);
    setThreadSummaries((prev) => [created, ...prev.filter((entry) => entry.id !== created.id)]);
    activeThreadRef.current = created.id;
    return created.id;
  };

  const runQueuedMessage = async (queuedMessage: QueuedOutboundMessage): Promise<void> => {
    if (!queuedMessage.content.trim()) return;
    const threadId = await ensureActiveThread(queuedMessage.context, queuedMessage.label || null);
    setIsSending(true);
    setActiveOutboundMessageId(queuedMessage.messageId);
    setEnteringMessageId(queuedMessage.messageId);
    try {
      const visibleMessages = messageStateRef.current.filter((entry) => entry.role !== 'system_marker');
      const activeIndex = visibleMessages.findIndex((entry) => entry.id === queuedMessage.messageId);
      const payloadSource = activeIndex >= 0 ? visibleMessages.slice(0, activeIndex + 1) : visibleMessages;
      const payloadMessages = payloadSource
        .filter((entry) => entry.role !== 'system_marker')
        .slice(-24)
        .map((entry) => ({ role: entry.role, content: entry.content }));

      const reply = await chatService.send({
        messages: payloadMessages,
        context: queuedMessage.context,
        mode: 'ai'
      });

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          reply.source === 'heuristic' && reply.debug_reason
            ? `${reply.text || 'No response generated.'}\n\n[debug: ${reply.debug_reason}${reply.debug_model ? ` | model: ${reply.debug_model}` : ''}${reply.debug_error ? ` | error: ${reply.debug_error}` : ''}]`
            : reply.text || 'No response generated.',
        created_at: Date.now(),
        context: queuedMessage.context,
        proposals: reply.proposals || null,
        debug_meta: reply.debug_meta || null
      };

      if (threadId) {
        await aiChatThreadService.appendMessage(threadId, assistantMessage);
        await aiChatThreadService.touchThread(threadId, {
          context: queuedMessage.context || {},
          ...buildThreadHeader(queuedMessage.label || null)
        });
      }

      setMessages((prev) =>
        prev.map((entry) => (entry.id === queuedMessage.messageId ? { ...entry, queued: false } : entry)).concat(assistantMessage)
      );
      await syncThreadSummaries();
    } finally {
      setIsSending(false);
      const nextQueued = queuedOutboundRef.current.shift();
      if (nextQueued) {
        window.setTimeout(() => {
          void runQueuedMessage(nextQueued);
        }, 0);
      } else {
        setActiveOutboundMessageId(null);
      }
    }
  };

  const queueMessage = (value: string, overrideContext: ChatContext | null = chatContext, label?: AiRailRequest['label'] | null): void => {
    if (!value.trim()) return;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: value.trim(),
      created_at: Date.now(),
      context: overrideContext,
      queued: isSending || queuedOutboundRef.current.length > 0
    };
    const queuedMessage: QueuedOutboundMessage = {
      id: crypto.randomUUID(),
      content: value.trim(),
      context: overrideContext,
      messageId: userMessage.id,
      label
    };

    setDraft('');
    setMode('text');
    onExpandedChange(true);
    if (label) {
      setActiveLabel(label);
    }
    setMessages((prev) => [...prev, userMessage]);

    void (async () => {
      const threadId = await ensureActiveThread(overrideContext, label || null);
      if (threadId) {
        await aiChatThreadService.appendMessage(threadId, userMessage);
        await aiChatThreadService.touchThread(threadId, {
          context: overrideContext || {},
          ...buildThreadHeader(label || null)
        });
        await syncThreadSummaries();
      }
    })();

    if (isSending) {
      queuedOutboundRef.current.push(queuedMessage);
      return;
    }

    void runQueuedMessage(queuedMessage);
  };

  const handleSend = async (): Promise<void> => {
    queueMessage(draft, chatContext);
  };

  const handleProposalApply = async (proposal: ChatProposal, assistantText: string): Promise<void> => {
    if (!onPushProposal) return;
    setApplyingProposalId(proposal.id);
    try {
      const proposalToApply =
        'title' in proposal
          ? {
              ...proposal,
              title: (proposalTitleDrafts[proposal.id] || proposal.title).trim() || proposal.title
            }
          : proposal;
      const confirmation = await onPushProposal(proposalToApply, assistantText);
      if (confirmation) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: confirmation,
            created_at: Date.now(),
            context: chatContext
          }
        ]);
      }
    } finally {
      setApplyingProposalId((current) => (current === proposal.id ? null : current));
    }
  };

  useEffect(() => {
    if (!request || latestRequestIdRef.current === request.id) return;
    latestRequestIdRef.current = request.id;
    queueMessage(request.prompt, request.context || null, request.label || null);
  }, [request]);

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const isVoiceOpen = mode === 'voice';
  const isMultiline = draft.includes('\n') || draft.length > 52;
  const hideCompactCard = visualState === 'opening' || visualState === 'open';
  const activeThreadSummary = activeThreadId ? threadSummaries.find((entry) => entry.id === activeThreadId) || null : null;
  const expandedHeader = activeThreadSummary
    ? {
        kicker: activeThreadSummary.kicker || 'Delta AI',
        title: activeThreadSummary.title
      }
    : buildThreadHeader();
  const composer = (
    <div className={`shell-ai-mode-row ${isVoiceOpen ? 'voice-open' : ''}`.trim()}>
      <div className="shell-ai-pill-shell shell-ai-text-lane open">
        <div className={`shell-ai-composer-shell ${isMultiline ? 'multiline' : ''}`.trim()}>
          {isVoiceOpen ? (
            <div className="shell-ai-voice-inline" aria-label="Voice recording active">
              <div className="shell-ai-voice-meter" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : (
            <textarea
              ref={inputRef}
              className="shell-ai-composer-input"
              placeholder="Ask Delta"
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
            />
          )}
          <button
            type="button"
            className={`shell-ai-send ${draft.trim() ? 'ready' : ''} ${isSending ? 'busy' : ''}`.trim()}
            onClick={() => void handleSend()}
            disabled={!draft.trim()}
            aria-label={isSending ? 'Queue message' : 'Send message'}
          >
            {isSending ? <Square size={14} fill="currentColor" /> : <ArrowUp size={16} />}
          </button>
        </div>
      </div>

      <button
        type="button"
        className={`shell-ai-mode-button shell-ai-voice-trigger ${mode === 'voice' ? 'active' : ''}`.trim()}
        onClick={() => setMode((prev) => (prev === 'voice' ? 'text' : 'voice'))}
        aria-label={isVoiceOpen ? 'Stop voice input' : 'Open voice input'}
      >
        {isVoiceOpen ? <Square size={14} fill="currentColor" /> : <Mic size={17} />}
      </button>
    </div>
  );

  return (
    <section
      className={`shell-ai-card ${isExpandedVisual ? 'expanded' : ''}`.trim()}
      data-visual-state={visualState}
    >
      <div className={`shell-ai-card-compact shell-ai-card-base ${hideCompactCard ? 'is-hidden' : ''}`.trim()}>
        <button
          type="button"
          className="shell-ai-compact-expand"
          onClick={() => onExpandedChange(true)}
          aria-label="Expand AI chat"
        >
          <ArrowUpLeft size={16} />
        </button>
        <div className="shell-ai-collapsed-space" aria-hidden="true">
          <div className="shell-ai-collapsed-hint">
            <span>+ Note</span>
            <span>or</span>
            <span>Plan &amp; Execute</span>
          </div>
        </div>
        <div className="shell-ai-composer-band shell-ai-composer-band-collapsed">{composer}</div>
      </div>

      {isExpandedVisual ? (
        <div ref={expandedCardRef} className="shell-ai-card-shell shell-ai-card-shell-expanded">
          <div className="shell-ai-header-strip">
            <div className="shell-ai-header-copy shell-ai-header-copy-wrap" ref={threadsMenuRef}>
              <span>{expandedHeader.kicker}</span>
              <button
                type="button"
                className="shell-ai-thread-picker"
                onClick={() => setThreadsMenuOpen((prev) => !prev)}
                aria-label="Open chat history"
                aria-expanded={threadsMenuOpen}
              >
                <strong>{expandedHeader.title}</strong>
                <ChevronDown size={14} />
              </button>
              {threadsMenuOpen ? (
                <div className="shell-ai-thread-menu">
                  {threadSummaries.length === 0 ? (
                    <div className="shell-ai-thread-menu-empty">No saved chats yet</div>
                  ) : (
                    threadSummaries.map((thread) => (
                      <button
                        key={thread.id}
                        type="button"
                        className={`shell-ai-thread-menu-item ${thread.id === activeThreadId ? 'active' : ''}`.trim()}
                        onClick={() => {
                          setThreadsMenuOpen(false);
                          setActiveThreadId(thread.id);
                          setActiveLabel({
                            kicker: thread.kicker || 'Delta AI',
                            title: thread.title
                          });
                        }}
                      >
                        <strong>{thread.title}</strong>
                        <span>{thread.kicker || 'Delta AI'}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="shell-ai-expanded-close"
              onClick={() => onExpandedChange(false)}
              aria-label="Close AI chat"
            >
              <X size={16} />
            </button>
          </div>
          <div className="shell-ai-messages" ref={messagesRef} aria-label="Delta AI messages">
            {messages.length === 0 ? (
              <div className="shell-ai-empty-state" />
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`shell-ai-message ${message.role} ${enteringMessageId === message.id ? 'entering' : ''}`.trim()}
                >
                  <div className="shell-ai-bubble">{message.content}</div>
                  {message.role === 'user' && message.queued ? <div className="shell-ai-message-queued">Queued</div> : null}
                  {message.role === 'assistant' && Array.isArray(message.proposals) && message.proposals.length > 0 ? (
                    <div className="shell-ai-proposal-stack">
                      {message.proposals.map((proposal) => (
                        <div key={proposal.id} className="shell-ai-proposal-card">
                          <div className="shell-ai-proposal-copy">
                            <span className="shell-ai-proposal-kicker">
                              {proposal.type === 'create_time_block' ? 'Proposal' : proposal.type === 'node_setup_apply' ? 'Setup' : 'Draft'}
                            </span>
                            {proposal.type === 'node_setup_apply' ? (
                              <strong>{proposal.summary}</strong>
                            ) : 'title' in proposal ? (
                              <input
                                type="text"
                                className="shell-ai-proposal-title-input"
                                value={proposalTitleDrafts[proposal.id] ?? proposal.title}
                                onChange={(event) =>
                                  setProposalTitleDrafts((prev) => ({
                                    ...prev,
                                    [proposal.id]: event.target.value
                                  }))
                                }
                              />
                            ) : (
                              <strong>{proposal.event_title}</strong>
                            )}
                            {'scheduled_start_utc' in proposal ? (
                              <span>
                                {new Date(proposal.scheduled_start_utc).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit'
                                })}
                              </span>
                            ) : proposal.type === 'node_setup_apply' ? (
                              <span>
                                {proposal.lists.length} list{proposal.lists.length === 1 ? '' : 's'} to configure
                              </span>
                            ) : null}
                          </div>
                          <div className="shell-ai-proposal-actions">
                            <button
                              type="button"
                              className="shell-ai-proposal-push"
                              onClick={() => void handleProposalApply(proposal, message.content)}
                              disabled={
                                applyingProposalId === proposal.id ||
                                ('title' in proposal &&
                                  !(proposalTitleDrafts[proposal.id] ?? proposal.title).trim())
                              }
                            >
                              {proposal.type === 'node_setup_apply'
                                ? applyingProposalId === proposal.id
                                  ? 'Setting up…'
                                  : 'Set this up'
                                : 'Push'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
            {isSending ? (
              <div className="shell-ai-message assistant thinking" aria-live="polite" aria-label="Delta is responding">
                <div className="shell-ai-bubble">
                  <span className="shell-ai-thinking-cursor" aria-hidden="true">
                    _
                  </span>
                </div>
              </div>
            ) : null}
          </div>
          <div className="shell-ai-composer-band">{composer}</div>
        </div>
      ) : null}
    </section>
  );
}

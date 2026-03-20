import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp, Mic, Square } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
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

interface AiRailCardProps {
  currentBlock: Event | null;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  threadEvent?: Event | null;
  threadMode?: 'general' | 'block';
  request?: AiRailRequest | null;
  onPushProposal?: (proposal: ChatProposal, assistantText: string) => void;
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
  const [isSending, setIsSending] = useState(false);
  const [activeLabel, setActiveLabel] = useState<AiRailRequest['label'] | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const latestRequestIdRef = useRef<string | null>(null);
  const expandedCardRef = useRef<HTMLDivElement | null>(null);
  const isExpandedVisual = visualState === 'opening' || visualState === 'open' || visualState === 'closing';

  const effectiveEvent = threadEvent || currentBlock;
  const persistenceScopeKey = threadMode === 'block' && threadEvent ? `time-block:${threadEvent.id}` : 'general';

  useEffect(() => {
    if (!user?.id) {
      setMessages([]);
      return;
    }

    const state = chatPersistence.load(user.id, MAX_MESSAGES, persistenceScopeKey);
    setMessages(state.messages || []);
  }, [persistenceScopeKey, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    chatPersistence.save(user.id, messages, MAX_MESSAGES, persistenceScopeKey);
  }, [messages, persistenceScopeKey, user?.id]);

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

  const sendMessage = async (value: string, overrideContext: ChatContext | null = chatContext): Promise<void> => {
    if (!value.trim() || isSending) return;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: value.trim(),
      created_at: Date.now(),
      context: overrideContext
    };

    setDraft('');
    setMode('text');
    onExpandedChange(true);
    setIsSending(true);
    setMessages((prev) => [...prev, userMessage]);

    try {
      const payloadMessages = [...messages, userMessage]
        .filter((entry) => entry.role !== 'system_marker')
        .slice(-24)
        .map((entry) => ({ role: entry.role, content: entry.content }));

      const reply = await chatService.send({
        messages: payloadMessages,
        context: overrideContext,
        mode: 'ai'
      });

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: reply.text || 'No response generated.',
        created_at: Date.now(),
        context: overrideContext,
        proposals: reply.proposals || null,
        debug_meta: reply.debug_meta || null
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async (): Promise<void> => {
    await sendMessage(draft, chatContext);
  };

  useEffect(() => {
    if (!request || latestRequestIdRef.current === request.id) return;
    latestRequestIdRef.current = request.id;
    if (request.label) {
      setActiveLabel(request.label);
    }
    void sendMessage(request.prompt, request.context || null);
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
            className="shell-ai-send"
            onClick={() => void handleSend()}
            disabled={!draft.trim() || isSending}
            aria-label="Send message"
          >
            <ArrowUp size={16} />
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
        <div ref={expandedCardRef} className="shell-ai-card-shell shell-ai-card-base">
          <div className="shell-ai-messages" ref={messagesRef} aria-label="Delta AI messages">
            {threadMode === 'block' && threadEvent ? (
              <div className="shell-ai-thread-kicker">
                <span>Thread</span>
                <strong>{threadEvent.title}</strong>
              </div>
            ) : activeLabel ? (
              <div className="shell-ai-thread-kicker">
                <span>{activeLabel.kicker}</span>
                <strong>{activeLabel.title}</strong>
              </div>
            ) : null}
            {messages.length === 0 ? (
              <div className="shell-ai-empty-state" />
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`shell-ai-message ${message.role}`.trim()}>
                  <div className="shell-ai-bubble">{message.content}</div>
                  {message.role === 'assistant' && Array.isArray(message.proposals) && message.proposals.length > 0 ? (
                    <div className="shell-ai-proposal-stack">
                      {message.proposals.map((proposal) => (
                        <div key={proposal.id} className="shell-ai-proposal-card">
                          <div className="shell-ai-proposal-copy">
                            <span className="shell-ai-proposal-kicker">
                              {proposal.type === 'create_time_block' ? 'Proposal' : 'Draft'}
                            </span>
                            <strong>{'title' in proposal ? proposal.title : proposal.event_title}</strong>
                            {'scheduled_start_utc' in proposal ? (
                              <span>
                                {new Date(proposal.scheduled_start_utc).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit'
                                })}
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="shell-ai-proposal-push"
                            onClick={() => onPushProposal?.(proposal, message.content)}
                          >
                            Push
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
          <div className="shell-ai-composer-band">{composer}</div>
        </div>
      ) : null}
    </section>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Calendar, Search, X, ArrowDown, ChevronDown } from 'lucide-react';
import { Atom, Microphone, PaperPlaneTilt } from '@phosphor-icons/react';
import type { User } from '@supabase/supabase-js';
import type { ChatContext, ChatDebugMeta, ChatMessage, ChatProposal } from '../types/chat';
import chatPersistence from '../services/chatPersistence';
import chatService from '../services/chatService';
import focalBoardService from '../services/focalBoardService';

interface HeaderProps {
  user: User | null;
  isAiOpen: boolean;
  onToggleAi: () => void;
  onCloseAi: () => void;
  aiContextTags: string[];
  onRemoveAiContextTag: (tag: string) => void;
  chatContext: ChatContext;
  onClearChatContext: () => void;
}

interface SourceOption {
  id: string;
  label: string;
  context: ChatContext;
}

export default function Header({
  user,
  isAiOpen,
  onToggleAi,
  onCloseAi,
  aiContextTags,
  onRemoveAiContextTag,
  chatContext,
  onClearChatContext
}: HeaderProps): JSX.Element {
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatMode, setChatMode] = useState<'ai' | 'memo'>('ai');
  const [isVoiceModeRequested, setIsVoiceModeRequested] = useState(false);
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [sourceOptions, setSourceOptions] = useState<SourceOption[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('current');
  const [selectedSourceContext, setSelectedSourceContext] = useState<ChatContext | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [approvedProposalIds, setApprovedProposalIds] = useState<Record<string, boolean>>({});
  const [dismissedProposalIds, setDismissedProposalIds] = useState<Record<string, boolean>>({});
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const sourceMenuRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const previousContextSignatureRef = useRef<string>('unset');
  const streamTimerRef = useRef<number | null>(null);
  const debugFlag = String((import.meta as any).env?.VITE_CHAT_DEBUG || '').toLowerCase();
  const showChatDebug = debugFlag === '1' || debugFlag === 'true';
  const showJumpToLatest = !isNearBottom && messages.length > 0;

  const getContextLabel = (context: ChatContext): string => {
    const parts: string[] = [];
    if (context.time_block_id) parts.push('Time Block');
    if (context.focal_id) parts.push('Space');
    if (context.list_id) parts.push('List');
    if (context.item_id) parts.push('Item');
    if (context.action_id) parts.push('Action');
    if (context.time_block_occurrence?.scheduled_start_utc) {
      const date = new Date(context.time_block_occurrence.scheduled_start_utc);
      parts.push(
        date.toLocaleString(undefined, {
          weekday: 'short',
          hour: 'numeric',
          minute: '2-digit'
        })
      );
    }
    return parts.length > 0 ? `Context: ${parts.join(' • ')}` : 'Context: none';
  };

  const contextSignature = useMemo(() => JSON.stringify(chatContext || {}), [chatContext]);

  useEffect(() => {
    if (!user?.id) {
      setMessages([]);
      return;
    }
    const persisted = chatPersistence.load(user.id, 60);
    setMessages(persisted.messages || []);
    previousContextSignatureRef.current = contextSignature;
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    chatPersistence.save(user.id, messages, 60);
  }, [messages, user?.id]);

  useEffect(() => {
    if (!isAiOpen) return;
    if (previousContextSignatureRef.current === 'unset') {
      previousContextSignatureRef.current = contextSignature;
      return;
    }
    if (previousContextSignatureRef.current !== contextSignature) {
      previousContextSignatureRef.current = contextSignature;
      setMessages((prev) => ([
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'system_marker',
          content: getContextLabel(chatContext),
          marker_label: getContextLabel(chatContext),
          created_at: Date.now(),
          context: chatContext
        }
      ]));
    }
  }, [contextSignature, chatContext, isAiOpen]);

  useEffect(() => {
    if (!sourceMenuOpen) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (!sourceMenuRef.current) return;
      if (!sourceMenuRef.current.contains(event.target as Node)) {
        setSourceMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [sourceMenuOpen]);

  useEffect(() => {
    if (!sourceMenuOpen || !user?.id) return;
    let cancelled = false;
    const loadSourceOptions = async (): Promise<void> => {
      const nextOptions: SourceOption[] = [{ id: 'current', label: 'Current', context: { ...chatContext } }];
      try {
        const [focalRows, listRows] = await Promise.all([
          focalBoardService.getFocals(user.id),
          focalBoardService.getListsForUser(user.id)
        ]);
        const focalById = new Map((focalRows || []).map((focal: any) => [focal.id, focal.name]));
        (focalRows || []).forEach((focal: any) => {
          nextOptions.push({
            id: `focal:${focal.id}`,
            label: `Space · ${focal.name}`,
            context: { focal_id: focal.id }
          });
        });
        (listRows || []).forEach((list: any) => {
          const focalName = focalById.get(list.focal_id) || 'Space';
          nextOptions.push({
            id: `list:${list.id}`,
            label: `List · ${focalName} / ${list.name}`,
            context: { focal_id: list.focal_id, list_id: list.id }
          });
        });
        if (chatContext.list_id) {
          const itemRows = await focalBoardService.getItemsByListId(chatContext.list_id);
          (itemRows || []).slice(0, 50).forEach((item: any) => {
            nextOptions.push({
              id: `item:${item.id}`,
              label: `Item · ${item.title}`,
              context: {
                focal_id: chatContext.focal_id,
                list_id: chatContext.list_id,
                item_id: item.id
              }
            });
          });
        }
      } catch {
        // Keep "Current" option available even if workspace source fetch fails.
      }
      if (!cancelled) {
        setSourceOptions(nextOptions);
      }
    };
    void loadSourceOptions();
    return () => {
      cancelled = true;
    };
  }, [sourceMenuOpen, user?.id, chatContext]);

  useEffect(() => {
    setSelectedSourceId('current');
    setSelectedSourceContext(null);
  }, [contextSignature]);

  useEffect(() => {
    return () => {
      if (streamTimerRef.current) {
        window.clearInterval(streamTimerRef.current);
      }
    };
  }, []);

  const scrollToBottom = (): void => {
    const node = messagesRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  };

  const handleMessagesScroll = (): void => {
    const node = messagesRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    setIsNearBottom(distance <= 80);
  };

  useEffect(() => {
    if (!isAiOpen) return;
    if (!isNearBottom && isStreaming) return;
    scrollToBottom();
  }, [messages, isAiOpen, isNearBottom, isStreaming]);

  const autoSizeInput = (): void => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const minHeight = 42;
    const maxHeight = 120;
    const nextHeight = Math.max(minHeight, Math.min(maxHeight, el.scrollHeight));
    el.style.height = `${nextHeight}px`;
  };

  useEffect(() => {
    autoSizeInput();
  }, [draft]);

  const insertMessage = (message: ChatMessage): void => {
    setMessages((prev) => [...prev, message]);
  };

  const startStreamingReply = (
    text: string,
    proposals: ChatProposal[] = [],
    debugMeta?: ChatDebugMeta
  ): Promise<void> =>
    new Promise((resolve) => {
      const assistantId = crypto.randomUUID();
      setStreamingMessageId(assistantId);
      setIsStreaming(true);
      insertMessage({
        id: assistantId,
        role: 'assistant',
        content: '',
        created_at: Date.now(),
        proposals,
        debug_meta: debugMeta || null
      });

      let index = 0;
      const chunkSize = 4;
      streamTimerRef.current = window.setInterval(() => {
        index = Math.min(text.length, index + chunkSize);
        const nextChunk = text.slice(0, index);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: nextChunk, proposals: index >= text.length ? proposals : undefined }
              : msg
          )
        );

        if (index >= text.length) {
          if (streamTimerRef.current) {
            window.clearInterval(streamTimerRef.current);
            streamTimerRef.current = null;
          }
          setStreamingMessageId(null);
          setIsStreaming(false);
          resolve();
        }
      }, 22);
    });

  const handleSend = async (): Promise<void> => {
    const value = draft.trim();
    if (!value || !user || isSending || isStreaming) return;
    setIsSending(true);
    setDraft('');
    const outboundContext = selectedSourceContext || chatContext;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: value,
      created_at: Date.now(),
      context: outboundContext,
      mode: chatMode
    };
    insertMessage(userMessage);

    if (chatMode === 'memo') {
      await startStreamingReply(
        'Memo mode is staged. This note is ready for Docs persistence once the memo writer path is wired.',
        []
      );
      setIsSending(false);
      return;
    }

    const payloadMessages = [...messages, userMessage]
      .filter((entry) => entry.role !== 'system_marker')
      .slice(-24)
      .map((entry) => ({ role: entry.role, content: entry.content }));

    const reply = await chatService.send({
      messages: payloadMessages,
      context: outboundContext,
      mode: chatMode
    });
    await startStreamingReply(reply.text, reply.proposals || [], reply.debug_meta);
    setIsSending(false);
  };

  const formatDebugMeta = (meta?: ChatDebugMeta | null): string | null => {
    if (!meta) return null;
    const scopeParts = [
      meta.scope?.focal,
      meta.scope?.list,
      meta.scope?.item,
      meta.scope?.action,
      meta.scope?.time_block
    ].filter(Boolean);
    const scope = scopeParts.length ? scopeParts.join(' > ') : meta.scope?.mode || 'global';
    const counts = meta.counts
      ? `counts f:${meta.counts.focals} l:${meta.counts.lists} i:${meta.counts.items} a:${meta.counts.actions} tb:${meta.counts.timeBlocks}`
      : null;
    return [
      meta.source ? `source=${meta.source}` : null,
      meta.route ? `route=${meta.route}` : null,
      scope ? `scope=${scope}` : null,
      counts
    ]
      .filter(Boolean)
      .join(' • ');
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleApproveProposal = async (proposal: ChatProposal): Promise<void> => {
    if (!user?.id) return;
    try {
      if (proposal.type === 'create_follow_up_action') {
        await focalBoardService.createAction(
          proposal.item_id,
          user.id,
          proposal.title,
          proposal.notes || null
        );
      } else if (proposal.type === 'create_focal') {
        await focalBoardService.createFocal(user.id, proposal.title);
      } else if (proposal.type === 'create_list') {
        await focalBoardService.createLane(proposal.focal_id, user.id, proposal.title, 'Items', 'Actions');
      } else if (proposal.type === 'create_item') {
        await focalBoardService.createItem(proposal.list_id, user.id, proposal.title);
      } else if (proposal.type === 'create_action') {
        await focalBoardService.createAction(proposal.item_id, user.id, proposal.title, null);
      }
      setApprovedProposalIds((prev) => ({ ...prev, [proposal.id]: true }));
      insertMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Applied: ${proposal.title}.`,
        created_at: Date.now()
      });
    } catch (error: any) {
      insertMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Could not apply proposal: ${error?.message || 'Unknown error'}.`,
        created_at: Date.now()
      });
    }
  };

  const selectedSourceLabel =
    selectedSourceId === 'current'
      ? 'Current'
      : sourceOptions.find((option) => option.id === selectedSourceId)?.label || 'Current';

  const handleSourceSelect = (option: SourceOption): void => {
    setSelectedSourceId(option.id);
    setSelectedSourceContext(option.id === 'current' ? null : option.context);
    setSourceMenuOpen(false);
  };

  return (
    <header className="header-strip">
      <div className="header-content">
        {/* Delta logo - left side */}
        <div className="header-logo">
          <img
            src="/in-app-logo.png"
            alt="Delta"
            className="logo-image"
          />
        </div>
        
        {/* Calendar snapshot block */}
        <div className="calendar-snapshot-block">
          <Calendar className="calendar-icon" size={16} />
          <span className="calendar-text">calendar snapshot</span>
        </div>
        
        {/* Search bar - centered */}
        <div className="search-bar">
          <Search className="search-icon" size={16} />
          <input
            type="text"
            placeholder="Search"
            className="search-input"
          />
        </div>
        
        {/* Ask Delta button - right side */}
        <button 
          className={`ask-delta-button ${isAiOpen ? 'active' : ''}`.trim()} 
          onClick={onToggleAi}
          data-user={user?.id ?? 'anonymous'}
          aria-expanded={isAiOpen}
          aria-controls="delta-ai-panel"
          aria-label="Ask Delta"
        >
          <Atom className="ai-atom-icon" weight="fill" />
        </button>
      </div>
      
      {/* AI Chat Panel */}
      {isAiOpen && (
        <aside id="delta-ai-panel" className="delta-ai-panel" aria-label="Delta AI panel">
          <div className="delta-ai-panel-inner">
            <div className="delta-ai-panel-header">
              <div className="delta-ai-panel-title">
              <Atom className="ai-atom-icon" weight="fill" />
              <span>Delta AI</span>
              </div>
              <button className="delta-ai-close-btn" onClick={onCloseAi} aria-label="Close Delta panel">
                <X size={14} />
              </button>
            </div>
          
          <div className="delta-ai-panel-content">
            <div className="delta-ai-chat-shell">
              <div className="delta-ai-chat-messages" ref={messagesRef} onScroll={handleMessagesScroll}>
                {messages.length === 0 && (
                  <div className="delta-ai-chat-placeholder">
                    Start typing to plan, prioritize, and execute.
                  </div>
                )}
                {messages.map((message) => (
                  <div key={message.id} className={`delta-ai-message-row ${message.role}`.trim()}>
                    {message.role === 'system_marker' ? (
                      <div className="delta-ai-context-marker">
                        <span>{message.marker_label || message.content}</span>
                      </div>
                    ) : message.role === 'user' ? (
                      <div className="delta-ai-user-bubble">{message.content}</div>
                    ) : (
                      <div className="delta-ai-assistant-block">
                        <div className="delta-ai-assistant-text">
                          {message.content || (streamingMessageId === message.id ? '…' : '')}
                        </div>
                        {showChatDebug && message.debug_meta && (
                          <div className="delta-ai-debug-footer">{formatDebugMeta(message.debug_meta)}</div>
                        )}
                        {(message.proposals || []).map((proposal) => (
                          dismissedProposalIds[proposal.id] ? null : (
                          <div key={proposal.id} className="delta-ai-inline-card">
                            <p>{proposal.title}</p>
                            <div className="delta-ai-inline-card-actions">
                              <button
                                type="button"
                                className="delta-ai-inline-primary"
                                disabled={Boolean(approvedProposalIds[proposal.id])}
                                onClick={() => void handleApproveProposal(proposal)}
                              >
                                {approvedProposalIds[proposal.id] ? 'Applied' : 'Approve'}
                              </button>
                              <button
                                type="button"
                                className="delta-ai-inline-secondary"
                                onClick={() => setDismissedProposalIds((prev) => ({ ...prev, [proposal.id]: true }))}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {showJumpToLatest && (
                  <button type="button" className="delta-ai-jump-latest" onClick={scrollToBottom}>
                    <ArrowDown size={13} />
                    Jump to latest
                  </button>
                )}
              </div>

              <div className="delta-ai-composer-surface">
                <div className="delta-ai-input-stack">
                  <textarea
                    ref={inputRef}
                    placeholder="Ask Delta…"
                    className="delta-ai-input-field"
                    value={draft}
                    rows={2}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleInputKeyDown}
                  />
                  <button
                    type="button"
                    className="delta-ai-send-button"
                    onClick={() => void handleSend()}
                    disabled={isSending || isStreaming || !draft.trim()}
                    aria-label="Send message"
                  >
                    <PaperPlaneTilt className="delta-ai-send-icon" size={18} weight="fill" />
                  </button>
                </div>

                <div className="delta-ai-composer-footer">
                  <button
                    type="button"
                    className={`delta-ai-voice-btn ${isVoiceModeRequested ? 'active' : ''}`.trim()}
                    onClick={() => setIsVoiceModeRequested((prev) => !prev)}
                    aria-pressed={isVoiceModeRequested}
                    aria-label="Voice mode"
                  >
                    <Microphone size={15} weight="fill" />
                  </button>

                  <div className="delta-ai-source-control" ref={sourceMenuRef}>
                    {selectedSourceId === 'current' ? (
                      <button
                        type="button"
                        className="delta-ai-source-add"
                        onClick={() => setSourceMenuOpen((prev) => !prev)}
                        aria-expanded={sourceMenuOpen}
                      >
                        <span>Add source</span>
                        <ChevronDown size={13} />
                      </button>
                    ) : (
                      <span className="delta-ai-chip-tag delta-ai-source-chip">
                        <span className="delta-ai-chip-tag-label">{selectedSourceLabel}</span>
                        <button
                          type="button"
                          className="delta-ai-chip-tag-remove"
                          onClick={() => {
                            setSelectedSourceId('current');
                            setSelectedSourceContext(null);
                          }}
                          aria-label="Clear selected source"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    )}
                    {sourceMenuOpen && (
                      <div className="delta-ai-source-menu" role="menu" aria-label="Source selection">
                        {sourceOptions.map((option) => (
                          <button key={option.id} type="button" onClick={() => handleSourceSelect(option)}>
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="delta-ai-memo-toggle-wrap">
                    <label className="delta-ai-mode-toggle-label" htmlFor="delta-ai-memo-toggle">Memo</label>
                    <button
                      id="delta-ai-memo-toggle"
                      type="button"
                      className={`calendar-switch ${chatMode === 'memo' ? 'on' : 'off'}`.trim()}
                      aria-label={`Memo mode ${chatMode === 'memo' ? 'on' : 'off'}`}
                      onClick={() => setChatMode((prev) => (prev === 'memo' ? 'ai' : 'memo'))}
                    >
                      <span className="calendar-switch-thumb" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </aside>
      )}
    </header>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Calendar, Search, X, ArrowDown, ChevronDown } from 'lucide-react';
import { Microphone, PaperPlaneTilt, Plus } from '@phosphor-icons/react';
import type { User } from '@supabase/supabase-js';
import { getChatProposalTitle, type ChatContext, type ChatDebugMeta, type ChatMessage, type ChatProposal } from '../types/chat';
import chatPersistence from '../services/chatPersistence';
import chatService from '../services/chatService';
import focalBoardService from '../services/focalBoardService';
import docsService from '../services/docsService';
import { calendarService } from '../services/calendarService';

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

type HeaderCreateType = 'item' | 'task' | 'time_block' | 'note';

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
  const [proposalNotes, setProposalNotes] = useState<Record<string, string>>({});
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [createType, setCreateType] = useState<HeaderCreateType>('item');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createListId, setCreateListId] = useState<string>('');
  const [createItemId, setCreateItemId] = useState<string>('');
  const [createStart, setCreateStart] = useState('');
  const [createEnd, setCreateEnd] = useState('');
  const [createFocals, setCreateFocals] = useState<Array<{ id: string; name: string }>>([]);
  const [createLists, setCreateLists] = useState<Array<{ id: string; focal_id: string; name: string; item_label?: string | null; action_label?: string | null }>>([]);
  const [createItems, setCreateItems] = useState<Array<{ id: string; lane_id: string; title: string }>>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createFeedback, setCreateFeedback] = useState<string>('');
  const [createError, setCreateError] = useState<string>('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const sourceMenuRef = useRef<HTMLDivElement | null>(null);
  const createPanelRef = useRef<HTMLDivElement | null>(null);
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
    if (!createPanelOpen) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (!createPanelRef.current) return;
      if (!createPanelRef.current.contains(event.target as Node)) {
        setCreatePanelOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [createPanelOpen]);

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
    if (!createPanelOpen || !user?.id) return;
    let cancelled = false;
    const loadCreateContext = async (): Promise<void> => {
      setCreateLoading(true);
      try {
        const [focalRows, listRows] = await Promise.all([
          focalBoardService.getFocals(user.id),
          focalBoardService.getListsForUser(user.id)
        ]);
        if (cancelled) return;
        setCreateFocals((focalRows || []).map((row: any) => ({ id: row.id, name: row.name })));
        const normalizedLists = (listRows || []).map((row: any) => ({
          id: row.id,
          focal_id: row.focal_id,
          name: row.name,
          item_label: row.item_label,
          action_label: row.action_label
        }));
        setCreateLists(normalizedLists);

        const inferredListId =
          chatContext.list_id ||
          (chatContext.item_id
            ? normalizedLists.find((list: { id: string }) => list.id === chatContext.list_id)?.id || ''
            : normalizedLists[0]?.id || '');
        setCreateListId((prev) => prev || inferredListId);

        if (chatContext.item_id) {
          setCreateItemId((prev) => prev || chatContext.item_id || '');
        }
      } catch (error: any) {
        if (!cancelled) {
          setCreateError(error?.message || 'Failed to load create options');
        }
      } finally {
        if (!cancelled) {
          setCreateLoading(false);
        }
      }
    };
    void loadCreateContext();
    return () => {
      cancelled = true;
    };
  }, [createPanelOpen, user?.id, chatContext.item_id, chatContext.list_id]);

  useEffect(() => {
    if (!createPanelOpen || !user?.id) return;
    if (createType !== 'task') return;
    const targetListId =
      createListId ||
      (chatContext.list_id && createLists.some((list) => list.id === chatContext.list_id) ? chatContext.list_id : '');
    if (!targetListId) return;
    let cancelled = false;
    const loadItems = async (): Promise<void> => {
      try {
        const rows = await focalBoardService.getItemsByListId(targetListId);
        if (cancelled) return;
        const mapped = (rows || []).map((row: any) => ({
          id: row.id,
          lane_id: row.lane_id,
          title: row.title
        }));
        setCreateItems(mapped);
        if (!createItemId) {
          setCreateItemId(chatContext.item_id && mapped.some((item: { id: string }) => item.id === chatContext.item_id) ? chatContext.item_id : mapped[0]?.id || '');
        }
      } catch {
        if (!cancelled) {
          setCreateItems([]);
        }
      }
    };
    void loadItems();
    return () => {
      cancelled = true;
    };
  }, [createPanelOpen, createType, createListId, createItemId, createLists, chatContext.item_id, chatContext.list_id, user?.id]);

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
      try {
        await docsService.createNote({
          userId: user.id,
          body: value,
          source: 'memo',
          originContext: { ...outboundContext }
        });
      } catch (error) {
        console.error('Failed to persist memo note to notes:', error);
      }
      await startStreamingReply(
        'Saved to Notes.',
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

  const getSourceBadgeLabel = (meta?: ChatDebugMeta | null): string => {
    if (meta?.source === 'db') return 'DB';
    if (meta?.source === 'llm') return 'LLM';
    return 'Fallback';
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const roundToQuarterHour = (date: Date): Date => {
    const next = new Date(date);
    const minutes = next.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    next.setMinutes(roundedMinutes, 0, 0);
    return next;
  };

  const toLocalDateTimeValue = (date: Date): string => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const resetCreateDraft = (type: HeaderCreateType = 'item'): void => {
    const start = roundToQuarterHour(new Date());
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setCreateType(type);
    setCreateTitle('');
    setCreateDescription('');
    setCreateFeedback('');
    setCreateError('');
    setCreateStart(toLocalDateTimeValue(start));
    setCreateEnd(toLocalDateTimeValue(end));
    setCreateListId(chatContext.list_id || '');
    setCreateItemId(chatContext.item_id || '');
  };

  const openCreatePanel = (): void => {
    resetCreateDraft('item');
    setCreatePanelOpen(true);
  };

  const handleCreateSubmit = async (): Promise<void> => {
    if (!user?.id || createSubmitting) return;
    const title = createTitle.trim();
    setCreateError('');
    setCreateFeedback('');
    if (!title) {
      setCreateError('Title is required');
      return;
    }

    setCreateSubmitting(true);
    try {
      if (createType === 'item') {
        if (!createListId) throw new Error('Choose a target list');
        await focalBoardService.createItem(createListId, user.id, title, createDescription.trim() || null);
        setCreateFeedback('Item created');
      } else if (createType === 'task') {
        if (!createItemId) throw new Error('Choose a parent item');
        await focalBoardService.createAction(createItemId, user.id, title, createDescription.trim() || null, null);
        setCreateFeedback('Task created');
      } else if (createType === 'time_block') {
        const parsedStart = new Date(createStart);
        const parsedEnd = new Date(createEnd);
        const safeStart = Number.isNaN(parsedStart.getTime()) ? roundToQuarterHour(new Date()) : parsedStart;
        const safeEnd = Number.isNaN(parsedEnd.getTime()) || parsedEnd <= parsedStart
          ? new Date(safeStart.getTime() + 60 * 60 * 1000)
          : parsedEnd;
        await calendarService.upsertTimeBlock(user.id, {
          id: crypto.randomUUID(),
          title,
          description: createDescription.trim(),
          start: safeStart.toISOString(),
          end: safeEnd.toISOString(),
          recurrence: 'none',
          recurrenceConfig: undefined,
          includeWeekends: true,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver',
          tasks: [],
          tags: []
        });
        setCreateFeedback('Time block created');
      } else if (createType === 'note') {
        const body = createDescription.trim() || title;
        await docsService.createNote({
          userId: user.id,
          title,
          body,
          source: 'quick_text',
          originContext: { ...chatContext }
        });
        setCreateFeedback('Note created');
      }

      const nextType = createType;
      resetCreateDraft(nextType);
      setCreateFeedback(
        createType === 'item'
          ? 'Item created'
          : createType === 'task'
            ? 'Task created'
            : createType === 'time_block'
              ? 'Time block created'
              : 'Note created'
      );
    } catch (error: any) {
      setCreateError(error?.message || 'Could not create item');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleApproveProposal = async (proposal: ChatProposal): Promise<void> => {
    if (!user?.id) return;
    try {
      const noteOverride = (proposalNotes[proposal.id] || '').trim() || null;
      await focalBoardService.applyChatProposalAtomic({
        userId: user.id,
        proposal,
        noteOverride,
        idempotencyKey: proposal.id
      });
      setApprovedProposalIds((prev) => ({ ...prev, [proposal.id]: true }));
      setProposalNotes((prev) => {
        const next = { ...prev };
        delete next[proposal.id];
        return next;
      });
      const appliedTitle = getChatProposalTitle(proposal);
      insertMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Applied: ${appliedTitle}.`,
        created_at: Date.now()
      });
    } catch (error: any) {
      insertMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'I could not apply that update safely right now. Nothing was partially applied.',
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

        <div className="header-create-wrap" ref={createPanelRef}>
          <button
            type="button"
            className={`header-create-trigger ${createPanelOpen ? 'open' : ''}`.trim()}
            aria-label="Create"
            aria-expanded={createPanelOpen}
            onClick={() => {
              if (createPanelOpen) {
                setCreatePanelOpen(false);
                return;
              }
              openCreatePanel();
            }}
          >
            <Plus size={16} weight="bold" />
          </button>

          {createPanelOpen && (
            <div className="header-create-panel">
              <div className="header-create-type-row" role="tablist" aria-label="Create type">
                {[
                  { key: 'item', label: 'Item' },
                  { key: 'task', label: 'Task' },
                  { key: 'time_block', label: 'Time Block' },
                  { key: 'note', label: 'Note' }
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={createType === option.key ? 'active' : ''}
                    onClick={() => {
                      setCreateType(option.key as HeaderCreateType);
                      setCreateFeedback('');
                      setCreateError('');
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="header-create-panel-body">
                {(createType === 'item' || createType === 'task') && (
                  <label className="header-create-field">
                    <span>List</span>
                    <select
                      value={createListId}
                      onChange={(event) => {
                        setCreateListId(event.target.value);
                        if (createType === 'task') {
                          setCreateItemId('');
                        }
                      }}
                    >
                      <option value="">Select list</option>
                      {createLists.map((list) => {
                        const focalName = createFocals.find((focal) => focal.id === list.focal_id)?.name || 'Space';
                        return (
                          <option key={list.id} value={list.id}>
                            {focalName} / {list.name}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                )}

                {createType === 'task' && (
                  <label className="header-create-field">
                    <span>Parent item</span>
                    <select value={createItemId} onChange={(event) => setCreateItemId(event.target.value)}>
                      <option value="">Select item</option>
                      {createItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {createType === 'time_block' && (
                  <div className="header-create-time-grid">
                    <label className="header-create-field">
                      <span>Start</span>
                      <input type="datetime-local" value={createStart} onChange={(event) => setCreateStart(event.target.value)} />
                    </label>
                    <label className="header-create-field">
                      <span>End</span>
                      <input type="datetime-local" value={createEnd} onChange={(event) => setCreateEnd(event.target.value)} />
                    </label>
                  </div>
                )}

                <label className="header-create-field">
                  <span>{createType === 'time_block' ? 'Title' : 'Name'}</span>
                  <input
                    type="text"
                    value={createTitle}
                    onChange={(event) => setCreateTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleCreateSubmit();
                      }
                    }}
                    placeholder={
                      createType === 'item'
                        ? 'New item'
                        : createType === 'task'
                          ? 'New task'
                          : createType === 'time_block'
                            ? 'New time block'
                            : 'New note'
                    }
                  />
                </label>

                <label className="header-create-field">
                  <span>Description</span>
                  <textarea
                    rows={3}
                    value={createDescription}
                    onChange={(event) => setCreateDescription(event.target.value)}
                    placeholder="Optional description"
                  />
                </label>

                {createLoading && <div className="header-create-meta">Loading destinations…</div>}
                {createError && <div className="header-create-meta error">{createError}</div>}
                {!createError && createFeedback && <div className="header-create-meta success">{createFeedback}</div>}

                <div className="header-create-actions">
                  <button type="button" className="secondary" onClick={() => setCreatePanelOpen(false)}>
                    Close
                  </button>
                  <button type="button" className="primary-primary" onClick={() => void handleCreateSubmit()} disabled={createSubmitting}>
                    {createSubmitting ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
      </div>
      
      {/* AI Chat Panel */}
      {isAiOpen && (
        <aside id="delta-ai-panel" className="delta-ai-panel" aria-label="Delta AI panel">
          <div className="delta-ai-panel-inner">
            <div className="delta-ai-panel-header">
              <div className="delta-ai-panel-title">
              <img className="ai-atom-icon delta-ai-button-icon" src="/Delta-AI-Button.png" alt="" aria-hidden="true" />
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
                        <div className="delta-ai-provenance-chip">{getSourceBadgeLabel(message.debug_meta)}</div>
                        <div className="delta-ai-assistant-line">
                          <img className="delta-ai-response-logo" src="/Delta-AI-Button.png" alt="" aria-hidden="true" />
                          <div className="delta-ai-assistant-text">
                            {message.content || (streamingMessageId === message.id ? '…' : '')}
                          </div>
                        </div>
                        {Array.isArray(message.debug_meta?.warnings) && message.debug_meta.warnings.length > 0 && (
                          <div className="delta-ai-warning-footer">
                            {message.debug_meta.warnings[0]}
                          </div>
                        )}
                        {showChatDebug && message.debug_meta && (
                          <div className="delta-ai-debug-footer">{formatDebugMeta(message.debug_meta)}</div>
                        )}
                        {(message.proposals || []).map((proposal) => (
                          dismissedProposalIds[proposal.id] ? null : (
                          <div key={proposal.id} className="delta-ai-inline-card">
                            <p>{getChatProposalTitle(proposal)}</p>
                            {(proposal.type === 'create_action' ||
                              proposal.type === 'create_follow_up_action' ||
                              proposal.type === 'create_time_block' ||
                              proposal.type === 'resolve_time_conflict') && (
                              <input
                                type="text"
                                className="delta-ai-inline-input"
                                placeholder="Optional description"
                                value={proposalNotes[proposal.id] ?? proposal.notes ?? ''}
                                onChange={(event) =>
                                  setProposalNotes((prev) => ({ ...prev, [proposal.id]: event.target.value }))
                                }
                              />
                            )}
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

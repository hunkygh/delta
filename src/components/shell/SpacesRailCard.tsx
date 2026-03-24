import { CommentAdd } from 'clicons-react';
import { ArrowLeft, ArrowUpDown, ArrowUpRight, Circle, Funnel, Search, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import commentsService from '../../services/commentsService';
import focalBoardService from '../../services/focalBoardService';
import type { ShellFocalSummary, ShellItemSummary, ShellListSummary } from './types';

interface SpacesRailCardProps {
  userId: string;
  focals: ShellFocalSummary[];
  lists: ShellListSummary[];
  items: ShellItemSummary[];
  activeFocalId: string | null;
  onSelectFocal: (focalId: string) => void;
  onOpenItem: (itemId: string, listId: string, focalId: string | null) => void;
  onAddSpace: () => void;
  onAddList: (focalId: string | null) => void;
  onExpand: (payload: { focalId: string | null; listId: string | null; mode: 'space' | 'list' }) => void;
  onRefreshShellData: () => Promise<void>;
  onModeChange?: (mode: 'spaces' | 'lists' | 'items') => void;
}

interface RailStatus {
  id: string | null;
  key: string;
  name: string;
  color: string;
  order_num?: number;
}

interface RailItem {
  id: string;
  lane_id?: string | null;
  listId?: string | null;
  focal_id?: string | null;
  focalId?: string | null;
  title: string;
  status?: string | null;
  status_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  signal_score?: number | null;
  actions?: Array<{
    id: string;
    scheduled_at?: string | null;
  }>;
}

interface ThreadComment {
  id: string;
  author_type: 'user' | 'ai' | 'system';
  content: string;
  created_at: string;
}

const getTileTextClass = (value: string): string => {
  if (value.length > 24) return 'shell-space-tile-text compact';
  if (value.length > 16) return 'shell-space-tile-text snug';
  return 'shell-space-tile-text';
};

export default function SpacesRailCard({
  userId,
  focals,
  lists,
  items,
  activeFocalId,
  onSelectFocal,
  onOpenItem,
  onAddSpace,
  onAddList,
  onExpand,
  onRefreshShellData,
  onModeChange
}: SpacesRailCardProps): JSX.Element {
  type SortMode = 'status' | 'recently_added' | 'recent_activity' | 'next_action';

  const [view, setView] = useState<'spaces' | 'lists' | 'items'>('spaces');
  const [localFocalId, setLocalFocalId] = useState<string | null>(activeFocalId || focals[0]?.id || null);
  const [localListId, setLocalListId] = useState<string | null>(null);
  const [listStatuses, setListStatuses] = useState<RailStatus[]>([]);
  const [liveItems, setLiveItems] = useState<RailItem[]>([]);
  const [selectedCommentItemId, setSelectedCommentItemId] = useState<string | null>(null);
  const [selectedStatusItemId, setSelectedStatusItemId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('status');
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [itemControlRailOpen, setItemControlRailOpen] = useState(false);
  const [itemControlsOpen, setItemControlsOpen] = useState<'filter' | 'sort' | null>(null);
  const [commentThread, setCommentThread] = useState<ThreadComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    onModeChange?.(view);
  }, [onModeChange, view]);

  useEffect(() => {
    if (!focals.length) {
      setLocalFocalId(null);
      setLocalListId(null);
      setView('spaces');
      return;
    }

    if (!localFocalId || !focals.some((focal) => focal.id === localFocalId)) {
      setLocalFocalId(activeFocalId || focals[0].id);
    }
  }, [activeFocalId, focals, localFocalId]);

  const visibleFocals = focals.slice(0, 5);
  const selectedFocal =
    visibleFocals.find((focal) => focal.id === localFocalId)
    || focals.find((focal) => focal.id === localFocalId)
    || null;
  const visibleLists = useMemo(() => {
    if (!selectedFocal?.id) return [];
    return lists.filter((list) => list.focalId === selectedFocal.id).slice(0, 6);
  }, [lists, selectedFocal?.id]);
  const selectedList =
    visibleLists.find((list) => list.id === localListId)
    || lists.find((list) => list.id === localListId)
    || null;
  const visibleItems = useMemo(() => {
    if (!selectedList?.id) return [];
    return items.filter((item) => item.listId === selectedList.id);
  }, [items, selectedList?.id]);
  const renderedItems = useMemo(
    () => (view === 'items' && selectedList?.id ? liveItems : visibleItems),
    [view, selectedList?.id, liveItems, visibleItems]
  );
  const activeFocalName = selectedFocal?.name || 'Selected space';
  const selectedCommentItem = renderedItems.find((item) => item.id === selectedCommentItemId) || null;
  const selectedStatusItem = renderedItems.find((item) => item.id === selectedStatusItemId) || null;
  const visibleByFilter = useMemo(
    () =>
      statusFilter === 'all'
        ? renderedItems
        : renderedItems.filter((item) =>
            listStatuses.some(
              (status) =>
                (status.id && item.status_id === status.id && (status.id || status.key) === statusFilter) ||
                (!status.id && status.key === item.status && status.key === statusFilter) ||
                (status.id && status.key === item.status && status.id === statusFilter)
            )
          ),
    [listStatuses, renderedItems, statusFilter]
  );

  const searchedItems = useMemo(() => {
    const normalized = itemSearchQuery.trim().toLowerCase();
    if (!normalized) return visibleByFilter;
    return visibleByFilter.filter((item) => item.title.toLowerCase().includes(normalized));
  }, [itemSearchQuery, visibleByFilter]);

  const getNextActionTimestamp = useCallback((item: RailItem | ShellItemSummary): number | null => {
    const actions = 'actions' in item && Array.isArray(item.actions) ? item.actions : [];
    const timestamps = actions
      .map((action) => (action.scheduled_at ? new Date(action.scheduled_at).getTime() : null))
      .filter((value): value is number => value !== null && Number.isFinite(value))
      .sort((a, b) => a - b);
    return timestamps[0] ?? null;
  }, []);

  const sortedItems = useMemo(() => {
    const next = [...searchedItems];
    if (sortMode === 'recently_added') {
      return next.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
    if (sortMode === 'recent_activity') {
      return next.sort((a, b) => {
        const updatedDelta = new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
        if (updatedDelta !== 0) return updatedDelta;
        return (b.signal_score || 0) - (a.signal_score || 0);
      });
    }
    if (sortMode === 'next_action') {
      return next.sort((a, b) => {
        const nextA = getNextActionTimestamp(a);
        const nextB = getNextActionTimestamp(b);
        if (nextA === null && nextB === null) return a.title.localeCompare(b.title);
        if (nextA === null) return 1;
        if (nextB === null) return -1;
        return nextA - nextB;
      });
    }
    return next.sort((a, b) => a.title.localeCompare(b.title));
  }, [getNextActionTimestamp, searchedItems, sortMode]);

  const groupedItems = useMemo(() => {
    if (sortMode !== 'status') {
      return [{ status: null as RailStatus | null, items: sortedItems }];
    }

    return listStatuses
      .map((status) => ({
        status,
        items: searchedItems.filter((item) => item.status_id === status.id || item.status === status.key)
      }))
      .filter((group) => statusFilter === 'all' || group.items.length > 0);
  }, [listStatuses, searchedItems, sortMode, sortedItems, statusFilter]);

  const loadSelectedListData = useCallback(async (): Promise<void> => {
    if (!selectedList?.id) {
      setListStatuses([]);
      setLiveItems([]);
      return;
    }
    try {
      const detail = await focalBoardService.getListDetail(selectedList.id);
      setListStatuses(
        ((detail?.lane_statuses || []) as RailStatus[]).slice().sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))
      );
      setLiveItems((detail?.items || []) as RailItem[]);
    } catch (error) {
      console.warn('Failed to load selected list detail for spaces card:', error);
    }
  }, [selectedList?.id]);

  useEffect(() => {
    if (view === 'items' && selectedList?.id) {
      void loadSelectedListData();
    }
  }, [view, selectedList?.id, items, loadSelectedListData]);

  useEffect(() => {
    setStatusFilter('all');
    setSortMode('status');
    setItemSearchQuery('');
    setSearchExpanded(false);
    setItemControlRailOpen(false);
    setItemControlsOpen(null);
  }, [selectedList?.id]);

  useEffect(() => {
    if (!searchExpanded) return;
    const frameId = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [searchExpanded]);

  useEffect(() => {
    if (!selectedCommentItemId) {
      setCommentThread([]);
      setCommentDraft('');
      setCommentError(null);
      return;
    }
    const loadComments = async (): Promise<void> => {
      setCommentLoading(true);
      setCommentError(null);
      try {
        const [legacyComments, scopedComments] = await Promise.all([
          commentsService.getItemComments(selectedCommentItemId, 50),
          focalBoardService.getScopedComments('item', selectedCommentItemId, userId)
        ]);
        const merged: ThreadComment[] = [
          ...(legacyComments || []).map((entry: any) => ({
            id: `legacy-${entry.id}`,
            author_type: 'user' as const,
            content: entry.body,
            created_at: entry.created_at
          })),
          ...(scopedComments || []).map((entry: any) => ({
            id: `thread-${entry.id}`,
            author_type: entry.author_type === 'ai' ? 'ai' : entry.author_type === 'system' ? 'system' : 'user',
            content: entry.content,
            created_at: entry.created_at
          }))
        ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        setCommentThread(merged);
      } catch (error: any) {
        setCommentError(error?.message || 'Failed to load comments');
      } finally {
        setCommentLoading(false);
      }
    };
    void loadComments();
  }, [selectedCommentItemId, userId]);

  const setItemStatus = async (item: RailItem, nextStatus: RailStatus): Promise<void> => {
    if (!selectedList?.id || !nextStatus) return;
    await focalBoardService.updateItem(item.id, {
      status: nextStatus.key,
      status_id: nextStatus.id || null
    });
    setSelectedStatusItemId(null);
    await Promise.all([loadSelectedListData(), onRefreshShellData()]);
  };

  const sendComment = async (): Promise<void> => {
    if (!selectedCommentItemId) return;
    const body = commentDraft.trim();
    if (!body) return;
    setCommentSubmitting(true);
    setCommentError(null);
    try {
      const created = await focalBoardService.createScopedComment('item', selectedCommentItemId, userId, body, 'user');
      setCommentThread((prev) => [
        ...prev,
        {
          id: `thread-${created.id}`,
          author_type: 'user',
          content: created.content,
          created_at: created.created_at
        }
      ]);
      setCommentDraft('');
      await onRefreshShellData();
    } catch (error: any) {
      setCommentError(error?.message || 'Failed to send update');
    } finally {
      setCommentSubmitting(false);
    }
  };

  return (
    <section className="shell-card shell-spaces-card">
      <div className="shell-space-rail-head">
        <div className="shell-space-rail-breadcrumb">
          {view === 'items' ? (
            <>
              <button
                type="button"
                className="shell-space-rail-back"
                onClick={() => setView('lists')}
                aria-label={`Back to ${activeFocalName}`}
              >
                <ArrowLeft size={16} />
              </button>
              <strong>{selectedList?.name || 'List'}</strong>
            </>
          ) : view === 'lists' ? (
            <>
              <button
                type="button"
                className="shell-space-rail-back"
                onClick={() => setView('spaces')}
                aria-label="Back to spaces"
              >
                <ArrowLeft size={16} />
              </button>
              <strong>{activeFocalName}</strong>
            </>
          ) : (
            <strong>Spaces</strong>
          )}
          {view !== 'items' ? (
            <button
              type="button"
              className="shell-space-rail-add"
              onClick={() => {
                if (view === 'lists') {
                  onAddList(selectedFocal?.id || null);
                  return;
                }
                onAddSpace();
              }}
              aria-label={view === 'lists' ? 'Add list' : 'Add space'}
            >
              +
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="shell-space-expand-btn"
          onClick={() =>
            onExpand({
              focalId: selectedFocal?.id || null,
              listId: view === 'lists' ? localListId || visibleLists[0]?.id || null : localListId || null,
              mode: view === 'lists' || view === 'items' ? 'list' : 'space'
            })
          }
          aria-label={`Expand ${activeFocalName}`}
        >
          <ArrowUpRight size={16} />
        </button>
      </div>
      {view === 'items' && listStatuses.length > 0 ? (
        <div className="shell-space-item-controls shell-space-item-controls-top">
          <div className="shell-space-item-controls-bar">
            <div className={`shell-space-item-controls-actions ${itemControlRailOpen ? 'open' : ''}`.trim()}>
              <button
                type="button"
                className={`shell-space-item-controls-trigger ${itemControlsOpen === 'filter' ? 'active' : ''}`.trim()}
                aria-label="Filter items"
                onClick={() => {
                  setItemControlRailOpen(true);
                  setItemControlsOpen((current) => (current === 'filter' ? null : 'filter'));
                }}
              >
                <Funnel size={15} />
              </button>
              <button
                type="button"
                className={`shell-space-item-controls-trigger ${itemControlsOpen === 'sort' ? 'active' : ''}`.trim()}
                aria-label="Sort items"
                onClick={() => {
                  setItemControlRailOpen(true);
                  setItemControlsOpen((current) => (current === 'sort' ? null : 'sort'));
                }}
              >
                <ArrowUpDown size={15} />
              </button>
            </div>
            <button
              type="button"
              className={`shell-space-item-controls-trigger ${itemControlRailOpen ? 'active' : ''}`.trim()}
              aria-label="List controls"
              onClick={() => {
                setItemControlRailOpen((current) => {
                  const next = !current;
                  if (!next) {
                    setItemControlsOpen(null);
                  }
                  return next;
                });
              }}
            >
              <SlidersHorizontal size={15} />
            </button>
            <div className={`shell-space-item-search-wrap ${searchExpanded ? 'open' : ''}`.trim()}>
              <button
                type="button"
                className={`shell-space-item-controls-trigger ${searchExpanded ? 'active' : ''}`.trim()}
                aria-label={searchExpanded ? 'Close search' : 'Search items'}
                onClick={() => {
                  if (searchExpanded && !itemSearchQuery.trim()) {
                    setSearchExpanded(false);
                    return;
                  }
                  setSearchExpanded(true);
                }}
              >
                <Search size={15} />
              </button>
              <label className="shell-space-item-search">
                <Search size={13} aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={itemSearchQuery}
                  onChange={(event) => setItemSearchQuery(event.target.value)}
                  onBlur={() => {
                    if (!itemSearchQuery.trim()) {
                      setSearchExpanded(false);
                    }
                  }}
                  placeholder="Search items"
                  aria-label="Search items"
                />
              </label>
            </div>
          </div>
          <div className={`shell-space-item-controls-drawer ${itemControlsOpen ? 'open' : ''}`.trim()}>
            {itemControlsOpen === 'filter' ? (
              <div className="shell-space-status-filter-row">
                <button
                  type="button"
                  className={`shell-space-status-filter-pill ${statusFilter === 'all' ? 'active' : ''}`.trim()}
                  onClick={() => setStatusFilter('all')}
                >
                  All
                </button>
                {listStatuses.map((status) => (
                  <button
                    key={status.id || status.key}
                    type="button"
                    className={`shell-space-status-filter-pill ${statusFilter === (status.id || status.key) ? 'active' : ''}`.trim()}
                    onClick={() => setStatusFilter((status.id || status.key) as string)}
                  >
                    {status.name}
                  </button>
                ))}
              </div>
            ) : null}
            {itemControlsOpen === 'sort' ? (
              <div className="shell-space-status-filter-row shell-space-sort-row">
                {[
                  ['status', 'By status'],
                  ['recently_added', 'Recently added'],
                  ['recent_activity', 'Recent activity'],
                  ['next_action', 'Next action']
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`shell-space-status-filter-pill ${sortMode === value ? 'active' : ''}`.trim()}
                    onClick={() => setSortMode(value as SortMode)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="shell-space-rail-shell">
        <div className="shell-space-rail-viewport">
          <div
            className={`shell-space-rail-track ${
              view === 'lists' ? 'show-lists' : view === 'items' ? 'show-items' : ''
            }`.trim()}
          >
            <div className="shell-space-rail-panel">
              <div className="shell-space-rail-grid">
                {visibleFocals.map((focal) => (
                  <button
                    key={focal.id}
                    type="button"
                    className="shell-space-tile"
                    onClick={() => {
                      setLocalFocalId(focal.id);
                      onSelectFocal(focal.id);
                      setView('lists');
                    }}
                  >
                    <span className={getTileTextClass(focal.name)}>{focal.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="shell-space-rail-panel">
              <div className="shell-space-rail-list-stack">
                {visibleLists.map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    className="shell-space-list-row shell-space-list-row-plain"
                    onClick={() => {
                      setLocalListId(list.id);
                      setView('items');
                    }}
                  >
                    <span className="shell-space-list-row-text">{list.name}</span>
                  </button>
                ))}
                {visibleLists.length === 0 ? (
                  <div className="shell-space-list-row shell-space-list-row-empty">
                    <span className="shell-space-list-row-text">No lists yet</span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="shell-space-rail-panel">
              <div className="shell-space-rail-list-stack shell-space-rail-item-stack">
                {groupedItems.map(({ status, items: statusItems }) => (
                  <section key={status?.id || status?.key || sortMode} className="shell-space-status-group">
                    {status ? (
                      <div className="shell-space-status-group-head">
                        <span className="shell-space-status-group-dot" style={{ backgroundColor: status.color }} />
                        <strong>{status.name}</strong>
                        <span>{statusItems.length}</span>
                      </div>
                    ) : null}
                    {statusItems.map((item) => {
                      const currentStatus =
                        listStatuses.find((entry) => entry.id === item.status_id || (item.status && entry.key === item.status)) || null;
                      const resolvedListId = selectedList?.id || item.listId || item.lane_id || null;
                      return (
                        <div
                          key={item.id}
                          className="shell-space-list-row shell-space-item-row shell-space-item-row-plain"
                        >
                          <button
                            type="button"
                            className="shell-space-item-status-btn"
                            aria-label={currentStatus ? `Update status from ${currentStatus.name}` : 'Update status'}
                            onClick={() => {
                              setSelectedCommentItemId(null);
                              setSelectedStatusItemId((current) => (current === item.id ? null : item.id));
                            }}
                          >
                            <Circle size={15} strokeWidth={1.75} style={{ color: currentStatus?.color || 'rgba(236,243,247,0.78)' }} />
                          </button>
                          <button
                            type="button"
                            className="shell-space-item-title-btn"
                            onClick={() => {
                              if (!resolvedListId) return;
                              onOpenItem(item.id, resolvedListId, selectedFocal?.id || item.focal_id || item.focalId || null);
                            }}
                          >
                            <span className="shell-space-list-row-text">{item.title}</span>
                          </button>
                          <button
                            type="button"
                            className="shell-space-item-comment-btn"
                            aria-label={`Open updates for ${item.title}`}
                            onClick={() => {
                              setSelectedStatusItemId(null);
                              setSelectedCommentItemId((current) => (current === item.id ? null : item.id));
                            }}
                          >
                            <CommentAdd size={16} strokeWidth={1.5} />
                          </button>
                        </div>
                      );
                    })}
                  </section>
                ))}
                {renderedItems.length === 0 ? (
                  <div className="shell-space-list-row shell-space-list-row-empty">
                    <span className="shell-space-list-row-text">No items yet</span>
                  </div>
                ) : null}
                {renderedItems.length > 0 && groupedItems.every((group) => group.items.length === 0) ? (
                  <div className="shell-space-list-row shell-space-list-row-empty">
                    <span className="shell-space-list-row-text">No items match this status</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
      {selectedCommentItem ? (
        <aside className="shell-space-item-comment-popout">
          <div className="shell-space-item-comment-popout-head">
            <div className="shell-space-item-comment-popout-copy">
              <span className="shell-kicker">Activity</span>
              <strong>{selectedCommentItem.title}</strong>
            </div>
            <button
              type="button"
              className="shell-space-item-comment-close"
              aria-label="Close updates"
              onClick={() => setSelectedCommentItemId(null)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="shell-space-item-comment-thread">
            {commentLoading ? <div className="shell-space-item-comment-empty">Loading updates…</div> : null}
            {!commentLoading && commentThread.length === 0 ? (
              <div className="shell-space-item-comment-empty">No updates yet</div>
            ) : null}
            {commentThread.map((entry) => (
              <article key={entry.id} className={`shell-space-item-comment ${entry.author_type}`.trim()}>
                <p>{entry.content}</p>
                <time>{new Date(entry.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
              </article>
            ))}
          </div>
          <div className="shell-space-item-comment-compose">
            <div className="shell-space-item-comment-compose-shell">
            <input
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="Write an update…"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void sendComment();
                }
              }}
            />
            <button
              type="button"
              className="shell-space-item-comment-send"
              disabled={commentSubmitting || !commentDraft.trim()}
              onClick={() => void sendComment()}
            >
              Send
            </button>
            </div>
            {commentError ? <div className="shell-space-item-comment-error">{commentError}</div> : null}
          </div>
        </aside>
      ) : null}
      {selectedStatusItem ? (
        <aside className="shell-space-item-comment-popout shell-space-item-status-sidecar">
          <div className="shell-space-item-comment-popout-head">
            <div className="shell-space-item-comment-popout-copy">
              <span className="shell-kicker">Status</span>
              <strong>{selectedStatusItem.title}</strong>
            </div>
            <button
              type="button"
              className="shell-space-item-comment-close"
              aria-label="Close status menu"
              onClick={() => setSelectedStatusItemId(null)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="shell-space-item-status-list">
            {listStatuses.map((status) => {
              const currentStatus =
                status.id === selectedStatusItem.status_id || (selectedStatusItem.status && status.key === selectedStatusItem.status);
              return (
                <button
                  key={status.id || status.key}
                  type="button"
                  className={`shell-space-item-status-option ${currentStatus ? 'active' : ''}`.trim()}
                  onClick={() => void setItemStatus(selectedStatusItem, status)}
                >
                  <Circle size={14} strokeWidth={1.75} style={{ color: status.color }} />
                  <span>{status.name}</span>
                </button>
              );
            })}
          </div>
          <div className="shell-space-item-comment-compose">
            <button
              type="button"
              className="shell-space-item-status-note-btn"
              onClick={() => {
                setSelectedStatusItemId(null);
                setSelectedCommentItemId(selectedStatusItem.id);
              }}
            >
              Add optional note
            </button>
          </div>
        </aside>
      ) : null}
    </section>
  );
}

import { CommentAdd } from 'clicons-react';
import { ArrowLeft, ArrowUpRight, Circle, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  onRefreshShellData
}: SpacesRailCardProps): JSX.Element {
  const [view, setView] = useState<'spaces' | 'lists' | 'items'>('spaces');
  const [localFocalId, setLocalFocalId] = useState<string | null>(activeFocalId || focals[0]?.id || null);
  const [localListId, setLocalListId] = useState<string | null>(null);
  const [listStatuses, setListStatuses] = useState<RailStatus[]>([]);
  const [liveItems, setLiveItems] = useState<RailItem[]>([]);
  const [selectedCommentItemId, setSelectedCommentItemId] = useState<string | null>(null);
  const [selectedStatusItemId, setSelectedStatusItemId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [commentThread, setCommentThread] = useState<ThreadComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

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
  const groupedItems = useMemo(() => {
    const visibleByFilter =
      statusFilter === 'all'
        ? renderedItems
        : renderedItems.filter((item) =>
            listStatuses.some(
              (status) =>
                (status.id && item.status_id === status.id && (status.id || status.key) === statusFilter) ||
                (!status.id && status.key === item.status && status.key === statusFilter) ||
                (status.id && status.key === item.status && status.id === statusFilter)
            )
          );

    return listStatuses
      .map((status) => ({
        status,
        items: visibleByFilter.filter((item) => item.status_id === status.id || item.status === status.key)
      }))
      .filter((group) => statusFilter === 'all' || group.items.length > 0);
  }, [listStatuses, renderedItems, statusFilter]);

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
  }, [selectedList?.id]);

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
                <button
                  type="button"
                  className="shell-space-tile shell-space-tile-add"
                  onClick={onAddSpace}
                  aria-label="Add space"
                >
                  <span className="shell-space-tile-add-icon">+</span>
                </button>
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
                <button
                  type="button"
                  className="shell-space-list-row shell-space-list-row-add shell-space-list-row-plain"
                  onClick={() => onAddList(selectedFocal?.id || null)}
                >
                  <span className="shell-space-list-row-text">+ Add</span>
                </button>
                {visibleLists.length === 0 ? (
                  <div className="shell-space-list-row shell-space-list-row-empty">
                    <span className="shell-space-list-row-text">No lists yet</span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="shell-space-rail-panel">
              <div className="shell-space-rail-list-stack shell-space-rail-item-stack">
                {listStatuses.length > 0 ? (
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
                {groupedItems.map(({ status, items: statusItems }) => (
                  <section key={status.id || status.key} className="shell-space-status-group">
                    <div className="shell-space-status-group-head">
                      <span className="shell-space-status-group-dot" style={{ backgroundColor: status.color }} />
                      <strong>{status.name}</strong>
                      <span>{statusItems.length}</span>
                    </div>
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

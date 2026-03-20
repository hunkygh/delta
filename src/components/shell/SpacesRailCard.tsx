import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ShellFocalSummary, ShellItemSummary, ShellListSummary } from './types';

interface SpacesRailCardProps {
  focals: ShellFocalSummary[];
  lists: ShellListSummary[];
  items: ShellItemSummary[];
  activeFocalId: string | null;
  onSelectFocal: (focalId: string) => void;
  onOpenItem: (itemId: string, listId: string, focalId: string | null) => void;
  onAddSpace: () => void;
  onAddList: (focalId: string | null) => void;
  onExpand: (payload: { focalId: string | null; listId: string | null; mode: 'space' | 'list' }) => void;
}

const getTileTextClass = (value: string): string => {
  if (value.length > 24) return 'shell-space-tile-text compact';
  if (value.length > 16) return 'shell-space-tile-text snug';
  return 'shell-space-tile-text';
};

export default function SpacesRailCard({
  focals,
  lists,
  items,
  activeFocalId,
  onSelectFocal,
  onOpenItem,
  onAddSpace,
  onAddList,
  onExpand
}: SpacesRailCardProps): JSX.Element {
  const [view, setView] = useState<'spaces' | 'lists' | 'items'>('spaces');
  const [localFocalId, setLocalFocalId] = useState<string | null>(activeFocalId || focals[0]?.id || null);
  const [localListId, setLocalListId] = useState<string | null>(null);

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
  const activeFocalName = selectedFocal?.name || 'Selected space';

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
                    className="shell-space-list-row"
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
                  className="shell-space-list-row shell-space-list-row-add"
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
                {visibleItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="shell-space-list-row shell-space-item-row"
                    onClick={() => {
                      const resolvedListId = selectedList?.id || item.listId || null;
                      if (!resolvedListId) return;
                      onOpenItem(item.id, resolvedListId, selectedFocal?.id || item.focalId);
                    }}
                  >
                    <span className="shell-space-list-row-text">{item.title}</span>
                  </button>
                ))}
                {visibleItems.length === 0 ? (
                  <div className="shell-space-list-row shell-space-list-row-empty">
                    <span className="shell-space-list-row-text">No items yet</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

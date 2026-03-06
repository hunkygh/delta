import React, { useRef, useState } from 'react';
import { ChevronRight, CornerDownLeft } from 'lucide-react';
import ActionList from './ActionList';
import StatusSelect from './StatusSelect';
import './ItemList.css';

const ItemList = ({
  items,
  actions,
  laneId,
  userId,
  itemLabel = 'Items',
  actionLabel = 'Actions',
  getItemActions,
  laneStatuses = [],
  onCreateItem,
  onCreateAction,
  onUpdateItem,
  onUpdateAction
}) => {
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [focusActionForItemId, setFocusActionForItemId] = useState(null);
  const [composerMode, setComposerMode] = useState('item');
  const [lastCreatedItemId, setLastCreatedItemId] = useState(null);
  const composerInputRef = useRef(null);

  const toggleItemExpansion = (itemId) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleCreateItem = async (title, options = {}) => {
    if (!title.trim()) {
      return;
    }
    
    try {
      const createdItem = await onCreateItem(laneId, title.trim());
      if (createdItem?.id) {
        setLastCreatedItemId(createdItem.id);
      }
      setNewItemTitle('');
      setIsCreatingItem(true);
      if (options.openActionComposer && createdItem?.id) {
        setExpandedItems((prev) => new Set(prev).add(createdItem.id));
        setFocusActionForItemId(createdItem.id);
      }
      window.requestAnimationFrame(() => {
        composerInputRef.current?.focus();
      });
    } catch (err) {
      console.error('Failed to create item:', err);
    }
  };

  const handleCreateSubtask = async (title) => {
    if (!title.trim() || !lastCreatedItemId || !onCreateAction) {
      return;
    }
    try {
      await onCreateAction(lastCreatedItemId, title.trim());
      setExpandedItems((prev) => new Set(prev).add(lastCreatedItemId));
      setFocusActionForItemId(lastCreatedItemId);
      setNewItemTitle('');
      setIsCreatingItem(true);
      window.requestAnimationFrame(() => {
        composerInputRef.current?.focus();
      });
    } catch (err) {
      console.error('Failed to create subtask:', err);
    }
  };

  const getItemStatus = (item) => {
    const itemActions = getItemActions(item.id);
    if (itemActions.length === 0) return item.status;
    
    const completedActions = itemActions.filter(action => action.status === 'completed').length;
    const totalActions = itemActions.length;
    
    if (completedActions === 0) return item.status;
    if (completedActions === totalActions) return 'completed';
    return 'in_progress';
  };

  const resolveLaneStatuses = (item) => {
    if (laneStatuses && laneStatuses.length > 0) {
      return [...laneStatuses].sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0));
    }
    return [
      { id: null, name: 'To do', key: 'pending', color: '#94a3b8' },
      { id: null, name: 'In progress', key: 'in_progress', color: '#f59e0b' },
      { id: null, name: 'Done', key: 'completed', color: '#22c55e' }
    ];
  };

  const handleStatusSelect = async (item, status) => {
    if (!onUpdateItem) {
      return;
    }

    const nextStatusKey = status.key || status.name?.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'pending';
    const updates = status.id
      ? { status_id: status.id, status: nextStatusKey }
      : { status: nextStatusKey };

    try {
      await onUpdateItem(item.id, updates);
    } catch (error) {
      console.error('Failed to update item status:', error);
    }
  };

  return (
    <div className="item-list">
      {items.map((item) => {
        const isExpanded = expandedItems.has(item.id);
        const itemActions = getItemActions(item.id);

        return (
          <div key={item.id} className="item">
            {/* Item Header */}
            <div 
              className="item-header"
              onClick={() => toggleItemExpansion(item.id)}
            >
              <div className="item-info">
                <button
                  className={`expand-button leading ${isExpanded ? 'expanded' : ''}`.trim()}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleItemExpansion(item.id);
                  }}
                  aria-label={isExpanded ? 'Collapse item' : 'Expand item'}
                >
                  <ChevronRight size={13} />
                </button>
                <StatusSelect
                  statuses={resolveLaneStatuses(item)}
                  value={item.status_id ?? item.status}
                  onChange={(status) => void handleStatusSelect(item, status)}
                  appearance="circle"
                  className="item-status-circle"
                />
                <span className="item-title">{item.title}</span>
                {item.description && (
                  <span className="item-description">{item.description}</span>
                )}
              </div>
              
              <div className="item-actions">
                {itemActions.length > 0 && (
                  <span className="action-count">
                    {itemActions.filter(a => a.status === 'completed').length}/{itemActions.length}
                  </span>
                )}
              </div>
            </div>

            {/* Actions (expandable) */}
            {isExpanded && (
              <div className="item-content">
                <ActionList
                  actions={itemActions}
                  itemId={item.id}
                  userId={userId}
                  actionLabel={actionLabel}
                  laneStatuses={resolveLaneStatuses(item)}
                  onCreateAction={onCreateAction}
                  onUpdateAction={onUpdateAction}
                  forceCreateOpen={focusActionForItemId === item.id}
                  onForceCreateHandled={() => setFocusActionForItemId(null)}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Add New Item */}
      {isCreatingItem ? (
        <form
          className={`new-item-composer ${composerMode === 'subtask' ? 'subtask-mode' : ''}`.trim()}
          onSubmit={(event) => {
            event.preventDefault();
            if (composerMode === 'subtask') {
              void handleCreateSubtask(newItemTitle);
              return;
            }
            void handleCreateItem(newItemTitle);
          }}
        >
          <div className="new-item-composer-icon" aria-hidden="true">
            {composerMode === 'subtask' ? '↳' : '◌'}
          </div>
          <input
            ref={composerInputRef}
            className="new-item-composer-input"
            value={newItemTitle}
            onChange={(event) => setNewItemTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setIsCreatingItem(false);
                setNewItemTitle('');
                setComposerMode('item');
                return;
              }
              if (event.key === 'Tab') {
                event.preventDefault();
                if (event.shiftKey) {
                  setComposerMode('item');
                  return;
                }
                if (lastCreatedItemId) {
                  setComposerMode('subtask');
                }
              }
            }}
            placeholder=""
            autoFocus
          />
          <div className="new-item-composer-actions">
            <button type="submit" className="new-item-save" aria-label={composerMode === 'subtask' ? 'Save subtask' : 'Save item'}>
              <CornerDownLeft size={18} />
            </button>
          </div>
        </form>
      ) : (
        <div className="add-item-hover-zone">
          <button
            onClick={() => setIsCreatingItem(true)}
            className="add-item-button"
          >
            + New {itemLabel}
          </button>
        </div>
      )}
    </div>
  );
};

export default ItemList;

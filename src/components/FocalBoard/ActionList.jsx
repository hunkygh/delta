import React, { useEffect, useState } from 'react';
import StatusSelect from './StatusSelect';
import './ActionList.css';

const ActionList = ({
  actions,
  itemId,
  userId,
  actionLabel = 'Tasks',
  onCreateAction,
  onUpdateAction,
  laneStatuses = [],
  forceCreateOpen = false,
  onForceCreateHandled
}) => {
  const [creatingAction, setCreatingAction] = useState(false);
  const [newActionTitle, setNewActionTitle] = useState('');

  useEffect(() => {
    if (!forceCreateOpen) {
      return;
    }
    setCreatingAction(true);
    onForceCreateHandled?.();
  }, [forceCreateOpen, onForceCreateHandled]);

  const handleCreateAction = async (title) => {
    if (!title.trim()) return;
    
    try {
      if (onCreateAction) {
        await onCreateAction(itemId, title.trim());
      }
      setNewActionTitle('');
      setCreatingAction(false);
    } catch (err) {
      console.error('Failed to create action:', err);
    }
  };

  const resolveStatuses = () => {
    if (laneStatuses && laneStatuses.length > 0) {
      return [...laneStatuses].sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0));
    }
    return [
      { id: null, name: 'To do', key: 'pending', color: '#94a3b8' },
      { id: null, name: 'In progress', key: 'in_progress', color: '#f59e0b' },
      { id: null, name: 'Done', key: 'completed', color: '#22c55e' }
    ];
  };

  const handleActionStatusSelect = async (actionId, status) => {
    try {
      const newStatus = status.key || status.name?.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'pending';
      if (onUpdateAction) {
        await onUpdateAction(actionId, { status: newStatus });
      }
    } catch (err) {
      console.error('Failed to update action:', err);
    }
  };

  return (
    <div className="action-list">
      {actions.map((action) => (
        <div key={action.id} className="action">
          <div className="action-content">
            <StatusSelect
              statuses={resolveStatuses()}
              value={action.status}
              onChange={(status) => void handleActionStatusSelect(action.id, status)}
              appearance="circle"
            />
            
            <div className="action-info">
              <span className="action-title">{action.title}</span>
              {action.description && (
                <span className="action-description">{action.description}</span>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Add New Action */}
      {creatingAction ? (
        <form
          className="new-action-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreateAction(newActionTitle);
          }}
        >
          <div className="new-action-composer-icon" aria-hidden="true">◌</div>
          <input
            className="new-action-composer-input"
            value={newActionTitle}
            onChange={(event) => setNewActionTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setCreatingAction(false);
                setNewActionTitle('');
              }
            }}
            placeholder={`New ${actionLabel}`}
            autoFocus
          />
          <div className="new-action-composer-actions">
            <button
              type="button"
              className="new-action-cancel"
              onClick={() => {
                setCreatingAction(false);
                setNewActionTitle('');
              }}
            >
              Cancel
            </button>
            <button type="submit" className="new-action-save">
              Save ↵
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setCreatingAction(true)}
          className="add-action-inline-button"
        >
          + Add {actionLabel}
        </button>
      )}
    </div>
  );
};

export default ActionList;

import React, { useState } from 'react';
import { Settings2 } from 'lucide-react';
import ItemList from './ItemList';
import InlineInput from '../UI/InlineInput';
import './LaneList.css';

const LaneList = ({
  lanes,
  items,
  actions,
  onCreateLane,
  onUpdateLane,
  onCreateItem,
  onCreateAction,
  onUpdateItem,
  onUpdateAction,
  onOpenList,
  userId
}) => {
  const [isCreatingLane, setIsCreatingLane] = useState(false);
  const [newLaneName, setNewLaneName] = useState('');
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newActionLabel, setNewActionLabel] = useState('');
  const [editingLaneId, setEditingLaneId] = useState(null);
  const [laneTermsDraft, setLaneTermsDraft] = useState({ itemLabel: '', actionLabel: '' });

  const handleCreateLane = async (laneName) => {
    if (!laneName.trim()) {
      return;
    }
    
    try {
      await onCreateLane(
        laneName.trim(),
        newItemLabel.trim() || laneName.trim(),
        newActionLabel.trim() || 'Actions'
      );
      setNewLaneName('');
      setNewItemLabel('');
      setNewActionLabel('');
      setIsCreatingLane(false);
    } catch (err) {
      console.error('Failed to create list:', err);
    }
  };

  const startEditingTerms = (lane) => {
    setEditingLaneId(lane.id);
    setLaneTermsDraft({
      itemLabel: lane.item_label || '',
      actionLabel: lane.action_label || 'Actions'
    });
  };

  const saveLaneTerms = async (laneId) => {
    try {
      await onUpdateLane(laneId, {
        item_label: laneTermsDraft.itemLabel.trim() || 'Items',
        action_label: laneTermsDraft.actionLabel.trim() || 'Actions'
      });
      setEditingLaneId(null);
    } catch (error) {
      console.error('Failed to update lane terms:', error);
    }
  };

  const getItemsForLane = (laneId) => {
    return items.filter(item => item.lane_id === laneId);
  };

  const getActionsForItem = (itemId) => {
    return actions.filter(action => action.item_id === itemId);
  };

  return (
    <div className="lane-list">
      {lanes.map((lane) => {
        const laneItems = getItemsForLane(lane.id);
        return (
        <div key={lane.id} className="lane">
          <div className="lane-header">
            <div className="lane-title-wrap">
              <h3 className="lane-title">
                <button
                  type="button"
                  className="lane-title-button"
                  onClick={() => onOpenList?.(lane)}
                >
                  {lane.item_label || 'Items'}
                  <span className="lane-title-separator"> / </span>
                  <span className="lane-title-secondary">{lane.action_label || 'Actions'}</span>
                </button>
              </h3>
              <span className="lane-count">{laneItems.length}</span>
            </div>
            <div className="lane-actions">
              <button
                className="lane-icon-button"
                title="Edit list terminology"
                aria-label="Edit list terminology"
                onClick={() => startEditingTerms(lane)}
              >
                <Settings2 size={14} />
              </button>
            </div>
          </div>

          {editingLaneId === lane.id && (
            <div className="lane-label-editor">
              <label className="lane-term-field">
                <span>Item term</span>
                <input
                  className="calendar-input"
                  value={laneTermsDraft.itemLabel}
                  onChange={(event) =>
                    setLaneTermsDraft((prev) => ({ ...prev, itemLabel: event.target.value }))
                  }
                  placeholder="Items"
                />
              </label>
              <label className="lane-term-field">
                <span>Action term</span>
                <input
                  className="calendar-input"
                  value={laneTermsDraft.actionLabel}
                  onChange={(event) =>
                    setLaneTermsDraft((prev) => ({ ...prev, actionLabel: event.target.value }))
                  }
                  placeholder="Actions"
                />
              </label>
              <div className="lane-label-editor-actions">
                <button className="lane-editor-save" onClick={() => saveLaneTerms(lane.id)}>
                  Save Terms
                </button>
                <button className="lane-editor-cancel" onClick={() => setEditingLaneId(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Items in Lane */}
          <ItemList
            items={getItemsForLane(lane.id)}
            actions={actions}
            laneId={lane.id}
            userId={userId}
            itemLabel={lane.item_label || 'Items'}
            actionLabel={lane.action_label || 'Actions'}
            laneStatuses={lane.lane_statuses || []}
            getItemActions={getActionsForItem}
            onCreateItem={onCreateItem}
            onCreateAction={onCreateAction}
            onUpdateItem={onUpdateItem}
            onUpdateAction={onUpdateAction}
          />
        </div>
      );
      })}

      {/* Add New List */}
      <div className="add-lane-section">
        {isCreatingLane ? (
          <div className="lane-create-editor">
            <InlineInput
              value={newLaneName}
              onChange={setNewLaneName}
              onSubmit={handleCreateLane}
              onCancel={() => {
                setIsCreatingLane(false);
                setNewLaneName('');
                setNewItemLabel('');
                setNewActionLabel('');
              }}
              placeholder="List name (e.g., Workouts, Pipeline)..."
              autoFocus
            />
            <div className="lane-create-terms-grid">
              <input
                className="calendar-input"
                value={newItemLabel}
                onChange={(event) => setNewItemLabel(event.target.value)}
                placeholder="Item term (e.g., Workout, Lead)"
              />
              <input
                className="calendar-input"
                value={newActionLabel}
                onChange={(event) => setNewActionLabel(event.target.value)}
                placeholder="Action term (e.g., Lift, Step)"
              />
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsCreatingLane(true)}
            className="add-lane-button"
            aria-label="Add new list"
          >
            + Add List
          </button>
        )}
      </div>
    </div>
  );
};

export default LaneList;

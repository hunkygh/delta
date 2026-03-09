import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFocalBoard } from '../../hooks/useFocalBoard';
import InlineInput from '../UI/InlineInput';
import focalBoardService from '../../services/focalBoardService';
import './FocalBoard.css';

const FocalBoard = ({ userId, selectedFocalFromNav, selectedFocalIdFromNav }) => {
  const navigate = useNavigate();
  const {
    focals,
    selectedFocal,
    lanes,
    items,
    actions,
    loading,
    error,
    createFocal,
    createLane,
    selectFocal,
    loadFocalData,
    clearError
  } = useFocalBoard(userId);

  const [isCreatingFocal, setIsCreatingFocal] = useState(false);
  const [newFocalName, setNewFocalName] = useState('');
  const [isCreatingLane, setIsCreatingLane] = useState(false);
  const [newLaneName, setNewLaneName] = useState('');
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newActionLabel, setNewActionLabel] = useState('');

  const handleCreateFocal = async (name) => {
    if (!name.trim()) return;

    try {
      const newFocal = await createFocal(name.trim());
      selectFocal(newFocal);
      setNewFocalName('');
      setIsCreatingFocal(false);
      navigate(`/spaces/${newFocal.id}`, { state: { selectedFocal: newFocal.name, selectedFocalId: newFocal.id } });
    } catch (err) {
      console.error('Failed to create space:', err);
      alert(`Failed to create space: ${err.message || 'Unknown error'}`);
      setIsCreatingFocal(false);
      setNewFocalName('');
    }
  };

  const handleCreateLane = useCallback(async () => {
    if (!selectedFocal || !newLaneName.trim()) return;

    try {
      await createLane(
        selectedFocal.id,
        newLaneName.trim(),
        newItemLabel.trim() || newLaneName.trim(),
        newActionLabel.trim() || 'Tasks'
      );
      setNewLaneName('');
      setNewItemLabel('');
      setNewActionLabel('');
      setIsCreatingLane(false);
      await loadFocalData(selectedFocal.id);
    } catch (err) {
      console.error('Failed to create list:', err);
      alert(`Failed to create list: ${err.message || 'Unknown error'}`);
    }
  }, [createLane, loadFocalData, newActionLabel, newItemLabel, newLaneName, selectedFocal]);

  const handleOpenList = useCallback((lane) => {
    navigate(`/spaces/list/${lane.id}`, {
      state: {
        selectedFocal: selectedFocal?.name,
        selectedFocalId: selectedFocal?.id
      }
    });
  }, [navigate, selectedFocal]);

  const laneStats = useMemo(() => {
    const itemsByLane = new Map();
    const actionsByLane = new Map();

    for (const item of items) {
      const list = itemsByLane.get(item.lane_id) || [];
      list.push(item);
      itemsByLane.set(item.lane_id, list);
    }

    for (const action of actions) {
      const parentItem = items.find((entry) => entry.id === action.item_id);
      if (!parentItem) continue;
      const list = actionsByLane.get(parentItem.lane_id) || [];
      list.push(action);
      actionsByLane.set(parentItem.lane_id, list);
    }

    return lanes.map((lane) => {
      const laneItems = itemsByLane.get(lane.id) || [];
      const laneActions = actionsByLane.get(lane.id) || [];
      const doneItems = laneItems.filter((item) => item.status === 'completed').length;
      const doneActions = laneActions.filter((action) => action.status === 'completed').length;

      let statuses = (lane.lane_statuses || [])
        .sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))
        .map((status) => ({
          id: status.id,
          key: status.key,
          name: status.name,
          color: status.color || '#94a3b8',
          count: laneItems.filter((item) => item.status_id === status.id || (!item.status_id && item.status === status.key)).length
        }));

      // Fallback when lane_statuses are unavailable in this environment/query:
      // derive status columns from item.status values so counts are still accurate.
      if (statuses.length === 0) {
        const statusCounts = new Map();
        laneItems.forEach((item) => {
          const key = String(item.status || 'pending');
          statusCounts.set(key, (statusCounts.get(key) || 0) + 1);
        });
        statuses = [...statusCounts.entries()].map(([key, count], index) => ({
          id: key,
          key,
          name: key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
          color: key === 'completed' ? '#22c55e' : key === 'in_progress' ? '#f59e0b' : '#94a3b8',
          count
        }));
      }

      return {
        lane,
        itemCount: laneItems.length,
        actionCount: laneActions.length,
        doneItems,
        doneActions,
        statuses
      };
    });
  }, [actions, items, lanes]);

  const statusColumns = useMemo(() => {
    const byKey = new Map();
    for (const row of laneStats) {
      for (const status of row.statuses || []) {
        if (!byKey.has(status.key)) {
          byKey.set(status.key, {
            key: status.key,
            name: status.name,
            color: status.color
          });
        }
      }
    }
    if (byKey.size === 0) {
      return [
        { key: 'pending', name: 'To do', color: '#94a3b8' },
        { key: 'in_progress', name: 'In progress', color: '#f59e0b' },
        { key: 'completed', name: 'Done', color: '#22c55e' }
      ];
    }
    return Array.from(byKey.values());
  }, [laneStats]);

  const tableGridTemplate = useMemo(() => {
    const statusCols = statusColumns.map(() => 'minmax(104px, 0.7fr)').join(' ');
    return `minmax(180px, 1.2fr) minmax(140px, 1fr) ${statusCols}`;
  }, [statusColumns]);

  useEffect(() => {
    if (selectedFocalIdFromNav && focals.length > 0) {
      const byId = focals.find((f) => f.id === selectedFocalIdFromNav);
      if (byId && byId.id !== selectedFocal?.id) {
        selectFocal(byId);
        return;
      }
    }

    if (selectedFocalFromNav && focals.length > 0) {
      const matchingFocal = focals.find((f) => f.name === selectedFocalFromNav);
      if (matchingFocal && matchingFocal.id !== selectedFocal?.id) {
        selectFocal(matchingFocal);
      }
    }
  }, [selectedFocalIdFromNav, selectedFocalFromNav, focals, selectFocal, selectedFocal]);

  if (loading && focals.length === 0 && !selectedFocal) {
    return (
      <div className="focal-board loading">
        <div className="loading-message">Loading your spaces...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="focal-board error">
        <div className="error-message">
          Error: {error}
          <button onClick={clearError} className="retry-button">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="focal-board">
      <div className="focal-board-header">
        <h2>{selectedFocal ? selectedFocal.name : 'Select a Space'}</h2>

        {!selectedFocal && (
          <div className="add-focal-section">
            {isCreatingFocal ? (
              <InlineInput
                value={newFocalName}
                onChange={setNewFocalName}
                onSubmit={handleCreateFocal}
                onCancel={() => {
                  setIsCreatingFocal(false);
                  setNewFocalName('');
                }}
                placeholder="Space name..."
                autoFocus
              />
            ) : (
              <button onClick={() => setIsCreatingFocal(true)} className="add-focal-button">
                + New Space
              </button>
            )}
          </div>
        )}
      </div>

      {selectedFocal ? (
        <div className="focal-overview">
          <section className="focal-overview-card lists-card">
            <header className="focal-overview-card-head">
              <h3>Lists</h3>
              {isCreatingLane ? (
                <div className="focal-create-list-controls">
                  <button className="add-focal-button" onClick={() => void handleCreateLane()}>Create</button>
                  <button
                    className="lane-editor-cancel"
                    onClick={() => {
                      setIsCreatingLane(false);
                      setNewLaneName('');
                      setNewItemLabel('');
                      setNewActionLabel('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button className="add-focal-button" onClick={() => setIsCreatingLane(true)}>+ Add List</button>
              )}
            </header>

            {isCreatingLane && (
              <div className="focal-create-list-editor">
                <input
                  className="calendar-input"
                  value={newLaneName}
                  onChange={(event) => setNewLaneName(event.target.value)}
                  placeholder="List name"
                  autoFocus
                />
                <input
                  className="calendar-input"
                  value={newItemLabel}
                  onChange={(event) => setNewItemLabel(event.target.value)}
                  placeholder="Item term"
                />
                <input
                  className="calendar-input"
                  value={newActionLabel}
                  onChange={(event) => setNewActionLabel(event.target.value)}
                  placeholder="Action term"
                />
              </div>
            )}

            <div className="lists-table">
              <div className="lists-table-head" style={{ gridTemplateColumns: tableGridTemplate }}>
                <span>Name</span>
                <span>Terms</span>
                {statusColumns.map((status) => (
                  <span key={`head-${status.key}`} className="lists-status-head">
                    <span className="lists-status-head-dot" style={{ backgroundColor: status.color }} aria-hidden="true" />
                    {status.name}
                  </span>
                ))}
              </div>
              {laneStats.map(({ lane, statuses }) => {
                const countByStatus = new Map((statuses || []).map((status) => [status.key, status.count || 0]));
                return (
                  <button
                    key={lane.id}
                    type="button"
                    className="lists-table-row"
                    style={{ gridTemplateColumns: tableGridTemplate }}
                    onClick={() => handleOpenList(lane)}
                  >
                    <span className="lists-row-name">{lane.name}</span>
                    <span className="lists-row-muted">{lane.item_label || 'Items'} / {lane.action_label || 'Tasks'}</span>
                    {statusColumns.map((status) => (
                      <span key={`${lane.id}-${status.key}`} className="lists-row-status-count">
                        {countByStatus.get(status.key) || 0}
                      </span>
                    ))}
                  </button>
                );
              })}
              {laneStats.length === 0 && (
                <div className="lists-table-empty">No lists yet. Create your first list to get started.</div>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="no-focal-selected">
          <div className="no-focal-message">
            <h3>No Space Selected</h3>
            <p>Choose a space from the sidebar or create a new one to get started.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FocalBoard;

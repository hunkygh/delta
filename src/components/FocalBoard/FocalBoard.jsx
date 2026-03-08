import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFocalBoard } from '../../hooks/useFocalBoard';
import InlineInput from '../UI/InlineInput';
import { calendarService } from '../../services/calendarService';
import focalBoardService from '../../services/focalBoardService';
import listFieldService from '../../services/listFieldService';
import itemFieldValueService from '../../services/itemFieldValueService';
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
  const [focalEvents, setFocalEvents] = useState([]);
  const [recurringSummaryByLane, setRecurringSummaryByLane] = useState({});
  const [customStatusSummaryByLane, setCustomStatusSummaryByLane] = useState({});

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

  useEffect(() => {
    if (!selectedFocal || !userId) {
      setFocalEvents([]);
      return;
    }

    const loadFocalEvents = async () => {
      try {
        const allEvents = await calendarService.getTimeBlocks(userId);
        const laneIds = new Set((lanes || []).map((lane) => lane.id));
        const filtered = (allEvents || [])
          .filter((event) => event.focal_id === selectedFocal.id || (event.lane_id && laneIds.has(event.lane_id)))
          .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
          .slice(0, 8);
        setFocalEvents(filtered);
      } catch (err) {
        console.error('Failed to load focal events:', err);
        setFocalEvents([]);
      }
    };

    void loadFocalEvents();
  }, [lanes, selectedFocal, userId]);

  useEffect(() => {
    const loadRecurringSummaries = async () => {
      const recurringLanes = (lanes || []).filter((lane) => (lane.mode || 'one_off') === 'recurring');
      if (recurringLanes.length === 0) {
        setRecurringSummaryByLane({});
        return;
      }
      const weekStart = new Date();
      weekStart.setUTCHours(0, 0, 0, 0);
      const day = weekStart.getUTCDay();
      const diff = day === 0 ? -6 : 1 - day;
      weekStart.setUTCDate(weekStart.getUTCDate() + diff);
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      weekEnd.setUTCHours(23, 59, 59, 999);

      try {
        const entries = await Promise.all(
          recurringLanes.map(async (lane) => {
            const payload = await focalBoardService.getRecurringListMvpView(
              lane.id,
              weekStart.toISOString(),
              weekEnd.toISOString()
            );
            const avgStreak = (payload.items || []).length
              ? Math.round(
                  (payload.items || []).reduce(
                    (sum, item) => sum + (item?.recurring?.streak || 0),
                    0
                  ) / (payload.items || []).length
                )
              : 0;
            return [
              lane.id,
              {
                scheduled: payload.summary?.scheduled_count || 0,
                completed: payload.summary?.completed_count || 0,
                avgStreak
              }
            ];
          })
        );
        setRecurringSummaryByLane(Object.fromEntries(entries));
      } catch (err) {
        console.error('Failed to load recurring list summaries:', err);
      }
    };

    void loadRecurringSummaries();
  }, [lanes]);

  useEffect(() => {
    const loadCustomStatusSummaries = async () => {
      if (!lanes?.length) {
        setCustomStatusSummaryByLane({});
        return;
      }
      try {
        const entries = await Promise.all(
          lanes.map(async (lane) => {
            const fields = await listFieldService.getFields(lane.id);
            const statusField =
              fields.find((field) => field.type === 'status' && field.is_primary) ||
              fields.find((field) => field.type === 'status') ||
              null;
            if (!statusField) {
              return [lane.id, { hasStatusField: false, top: [] }];
            }
            const valuesMap = await itemFieldValueService.bulkFetchForList(lane.id);
            const counts = new Map();
            Object.values(valuesMap).forEach((perItem) => {
              const value = perItem?.[statusField.id];
              const option = (statusField.options || []).find((entry) => entry.id === value?.option_id);
              const label = option?.label || 'Unassigned';
              counts.set(label, (counts.get(label) || 0) + 1);
            });
            const top = [...counts.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([label, count]) => ({ label, count }));
            return [lane.id, { hasStatusField: true, top }];
          })
        );
        setCustomStatusSummaryByLane(Object.fromEntries(entries));
      } catch (error) {
        console.error('Failed to load custom field status summaries:', error);
      }
    };
    void loadCustomStatusSummaries();
  }, [lanes]);

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

      const statuses = (lane.lane_statuses || [])
        .sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))
        .map((status) => ({
          id: status.id,
          name: status.name,
          count: laneItems.filter((item) => item.status_id === status.id || (!item.status_id && item.status === status.key)).length
        }));

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
          <section className="focal-overview-card calendar-card">
            <header className="focal-overview-card-head"><h3>Space Calendar</h3></header>
            {focalEvents.length === 0 ? (
              <p className="focal-overview-card-subtitle">No related time blocks yet.</p>
            ) : (
              <div className="focal-calendar-list">
                {focalEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="focal-calendar-row"
                    onClick={() => navigate('/calendar', { state: { focusEventId: event.id } })}
                  >
                    <span>{event.title}</span>
                    <time>{new Date(event.start).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
                  </button>
                ))}
              </div>
            )}
          </section>

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
              <div className="lists-table-head">
                <span>Name</span>
                <span>Terms</span>
                <span>Progress</span>
                <span>Status Mix</span>
              </div>
              {laneStats.map(({ lane, itemCount, actionCount, doneItems, statuses }) => {
                const isRecurring = (lane.mode || 'one_off') === 'recurring';
                const recurringSummary = recurringSummaryByLane[lane.id];
                const completionPct = itemCount > 0 ? Math.round((doneItems / itemCount) * 100) : 0;
                const customSummary = customStatusSummaryByLane[lane.id];
                return (
                  <button key={lane.id} type="button" className="lists-table-row" onClick={() => handleOpenList(lane)}>
                    <span className="lists-row-name">{lane.name}</span>
                    <span className="lists-row-muted">{lane.item_label || 'Items'} / {lane.action_label || 'Tasks'}</span>
                    <span className="lists-row-progress">
                      {isRecurring ? (
                        <span>{recurringSummary ? `${recurringSummary.completed}/${recurringSummary.scheduled}` : '—'}</span>
                      ) : (
                        <>
                          <span className="lists-progress-track">
                            <span className="lists-progress-fill" style={{ width: `${completionPct}%` }} />
                          </span>
                          <span>{doneItems}/{itemCount}</span>
                        </>
                      )}
                    </span>
                    <span className="lists-row-muted">
                      {isRecurring
                        ? `Recurring • Avg streak ${recurringSummary?.avgStreak ?? 0}`
                        : customSummary?.hasStatusField
                          ? customSummary.top.length > 0
                            ? customSummary.top.map((entry) => `${entry.label} ${entry.count}`).join(' • ')
                            : 'No status values yet'
                          : (statuses || []).slice(0, 2).map((status) => `${status.name} ${status.count}`).join(' • ') || 'Add Status Field'}
                    </span>
                  </button>
                );
              })}
              {laneStats.length === 0 && (
                <div className="lists-table-empty">No lists yet. Create your first list to get started.</div>
              )}
            </div>
          </section>

          <section className="focal-card-grid secondary">
            <article className="focal-overview-card utility-card">
              <header className="focal-overview-card-head"><h3>Bookmarks</h3></header>
              <p className="focal-overview-card-subtitle">Pinned links and references for this space.</p>
            </article>
            <article className="focal-overview-card utility-card">
              <header className="focal-overview-card-head"><h3>Resources</h3></header>
              <p className="focal-overview-card-subtitle">Files and uploads scoped to this space.</p>
            </article>
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

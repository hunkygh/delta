import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddSquareIcon, ComputerDollar, GridView } from 'clicons-react';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, Compass, CornerDownRight, LogOut, Minus, Plus, Repeat2, Share2 } from 'lucide-react';
import { HomeIcon, ProfileIcon } from '../../icons';
import { authService } from '../../services/authService';
import type { ShellComposerDraft, ShellComposerType } from './composerTypes';
import type { ShellFocalSummary, ShellItemSummary, ShellListSummary } from './types';
import type { ShellInstalledNode, ShellNodeDefinition } from './nodeRuntime';

const navItems = [
  { label: 'Home', key: 'home', icon: HomeIcon, showLabel: true },
  { label: 'Nodes', key: 'nodes', icon: GridView, showLabel: false },
  { label: 'Profile', key: 'profile', icon: ProfileIcon, showLabel: false }
];

const formatInstalledNodeLabel = (value: string): string => value.replace(/\s+node$/i, '').trim();

interface ShellNavPillProps {
  composerOpen: boolean;
  onComposerOpenChange: (open: boolean) => void;
  onComposerFreshOpen: () => void;
  composerDraft: ShellComposerDraft;
  onComposerDraftChange: (draft: ShellComposerDraft) => void;
  onComposerSubmit: (draft: ShellComposerDraft) => Promise<void>;
  focals: ShellFocalSummary[];
  lists: ShellListSummary[];
  items: ShellItemSummary[];
  nodeCatalog: ShellNodeDefinition[];
  installedNodes: ShellInstalledNode[];
  onOpenNodeManager: (nodeId?: string) => void;
}

export default function ShellNavPill({
  composerOpen,
  onComposerOpenChange,
  onComposerFreshOpen,
  composerDraft,
  onComposerDraftChange,
  onComposerSubmit,
  focals,
  lists,
  items,
  nodeCatalog,
  installedNodes,
  onOpenNodeManager
}: ShellNavPillProps): JSX.Element {
  const PANEL_ANIMATION_MS = 420;
  const navigate = useNavigate();
  const [visualState, setVisualState] = useState<'closed' | 'opening' | 'open' | 'closing'>(
    composerOpen ? 'open' : 'closed'
  );
  const [submitting, setSubmitting] = useState(false);
  const [openPicker, setOpenPicker] = useState<null | 'date' | 'start' | 'end' | 'parent'>(null);
  const [showDetails, setShowDetails] = useState(Boolean(composerDraft.lockedType || composerDraft.sourceEventId));
  const [showSubitems, setShowSubitems] = useState(false);
  const [nodesPanelOpen, setNodesPanelOpen] = useState(false);
  const [nodesPanelVisualState, setNodesPanelVisualState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');
  const [accountPanelOpen, setAccountPanelOpen] = useState(false);
  const [accountPanelVisualState, setAccountPanelVisualState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');
  const [pickerMonth, setPickerMonth] = useState<Date>(() => {
    const base = composerDraft.scheduledDate ? new Date(`${composerDraft.scheduledDate}T12:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [renderedPicker, setRenderedPicker] = useState<null | 'date' | 'start' | 'end' | 'parent'>(null);
  const [pickerVisualState, setPickerVisualState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');
  const composerRef = useRef<HTMLElement | null>(null);
  const nodesPanelRef = useRef<HTMLDivElement | null>(null);
  const accountPanelRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = async (): Promise<void> => {
    try {
      await authService.signOut();
      setAccountPanelOpen(false);
      window.location.href = '/login';
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  const updateDraft = (partial: Partial<ShellComposerDraft>): void => {
    onComposerDraftChange({
      ...composerDraft,
      ...partial
    });
  };

  const syncPickerMonth = (dateString: string | null | undefined): void => {
    if (!dateString) return;
    const next = new Date(`${dateString}T12:00:00`);
    if (!Number.isNaN(next.getTime())) {
      setPickerMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  };

  const updateSubitem = (index: number, value: string): void => {
    const next = [...composerDraft.subitems];
    next[index] = value;
    onComposerDraftChange({
      ...composerDraft,
      subitems: next
    });
  };

  const lockedTypeLabel = (() => {
    switch (composerDraft.type) {
      case 'list':
        return 'List';
      case 'space':
        return 'Space';
      case 'item':
        return 'Item';
      case 'task':
        return 'Task';
      case 'note':
        return 'Note';
      default:
        return 'Time block';
    }
  })();

  const addSubitem = (): void => {
    setShowSubitems(true);
    onComposerDraftChange({
      ...composerDraft,
      subitems: [...composerDraft.subitems, '']
    });
  };

  const listsForComposer = composerDraft.focalId
    ? lists.filter((list) => list.focalId === composerDraft.focalId)
    : lists;

  const itemsForComposer = composerDraft.listId
    ? items.filter((item) => item.listId === composerDraft.listId)
    : items;
  const parentItemQuery = composerDraft.parentItemQuery || '';
  const parentItemPrefixMatch = useMemo(() => {
    const query = parentItemQuery.trim().toLowerCase();
    if (!query) return null;
    return (
      itemsForComposer.find((item) => item.title.toLowerCase().startsWith(query)) ||
      itemsForComposer.find((item) => item.title.toLowerCase().includes(query)) ||
      null
    );
  }, [itemsForComposer, parentItemQuery]);
  const parentItemRemainder = useMemo(() => {
    const query = parentItemQuery.trim();
    if (!query || !parentItemPrefixMatch) return '';
    if (!parentItemPrefixMatch.title.toLowerCase().startsWith(query.toLowerCase())) return '';
    return parentItemPrefixMatch.title.slice(query.length);
  }, [parentItemPrefixMatch, parentItemQuery]);

  const selectedDate = composerDraft.scheduledDate ? new Date(`${composerDraft.scheduledDate}T12:00:00`) : null;
  const daysInMonth = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 0).getDate();
  const startWeekday = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth(), 1).getDay();
  const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const timeOptions = useMemo(() => {
    const values: string[] = [];
    for (let hour = 0; hour < 24; hour += 1) {
      for (let minute = 0; minute < 60; minute += 15) {
        values.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
      }
    }
    return values;
  }, []);

  const formatDateValue = (value: string | null | undefined): string => {
    if (!value) return 'Select date';
    const parsed = new Date(`${value}T12:00:00`);
    return parsed.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTimeValue = (value: string | null | undefined): string => {
    if (!value) return 'Select time';
    const [hours, minutes] = value.split(':').map(Number);
    const parsed = new Date();
    parsed.setHours(hours || 0, minutes || 0, 0, 0);
    return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  };

  const pickDate = (day: number): void => {
    const next = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth(), day, 12, 0, 0, 0);
    updateDraft({ scheduledDate: next.toISOString().slice(0, 10) });
    setOpenPicker(null);
  };

  const renderDatePicker = (): JSX.Element => (
    <div
      className="shell-nav-picker-popover shell-nav-picker-inline-surface shell-nav-date-popover"
      data-visual-state={pickerVisualState}
    >
      <div className="shell-nav-picker-head">
        <button type="button" className="shell-nav-picker-nav" onClick={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1, 1))}>
          <ChevronLeft size={14} />
        </button>
        <strong>{pickerMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}</strong>
        <button type="button" className="shell-nav-picker-nav" onClick={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1))}>
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="shell-nav-picker-weekdays" aria-hidden="true">
        {weekdayLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="shell-nav-picker-days">
        {Array.from({ length: startWeekday }).map((_, index) => (
          <span key={`blank-${index}`} className="shell-nav-picker-day blank" />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
          const isSelected =
            selectedDate &&
            selectedDate.getFullYear() === pickerMonth.getFullYear() &&
            selectedDate.getMonth() === pickerMonth.getMonth() &&
            selectedDate.getDate() === day;
          const cellDate = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth(), day);
          const isToday =
            cellDate.getFullYear() === new Date().getFullYear() &&
            cellDate.getMonth() === new Date().getMonth() &&
            cellDate.getDate() === new Date().getDate();
          return (
            <button
              key={day}
              type="button"
              className={`shell-nav-picker-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`.trim()}
              onClick={() => pickDate(day)}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderTimePicker = (field: 'start' | 'end'): JSX.Element => {
    const currentValue = field === 'start' ? composerDraft.startTime : composerDraft.endTime;
    return (
      <div
        className="shell-nav-picker-popover shell-nav-picker-inline-surface shell-nav-time-popover"
        data-visual-state={pickerVisualState}
      >
        <div className="shell-nav-time-list">
          {timeOptions.map((time) => (
            <button
              key={`${field}-${time}`}
              type="button"
              className={`shell-nav-time-option ${currentValue === time ? 'selected' : ''}`.trim()}
              onClick={() => {
                updateDraft(field === 'start' ? { startTime: time } : { endTime: time });
                setOpenPicker(null);
              }}
            >
              {formatTimeValue(time)}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const selectParentItem = (item: ShellItemSummary): void => {
    updateDraft({
      parentItemId: item.id,
      parentItemQuery: item.title
    });
  };

  const renderTypeSpecificFields = (): JSX.Element | null => {
    if (composerDraft.type === 'time_block') {
      const recurrenceValue = composerDraft.recurrence || 'none';
      const recurrenceEnabled = recurrenceValue !== 'none';

      return (
        <>
          <div className="shell-nav-composer-grid shell-nav-composer-grid-two">
            <div className="shell-nav-picker-field-wrap">
              <button
                type="button"
                className={`shell-nav-composer-inline-field shell-nav-picker-trigger ${openPicker === 'date' ? 'open' : ''}`.trim()}
                onClick={() => {
                  syncPickerMonth(composerDraft.scheduledDate);
                  setOpenPicker((prev) => (prev === 'date' ? null : 'date'));
                }}
              >
                <span className="shell-nav-composer-inline-icon" aria-hidden="true">
                  <CalendarDays size={14} />
                </span>
                <span className="shell-nav-picker-value">{formatDateValue(composerDraft.scheduledDate)}</span>
              </button>
              {renderedPicker === 'date' ? renderDatePicker() : null}
            </div>
            <div className="shell-nav-recurrence-card">
              <button
                type="button"
                className={`shell-nav-ios-toggle shell-nav-recurrence-toggle ${recurrenceEnabled ? 'on' : ''}`.trim()}
                onClick={() =>
                  updateDraft({
                    recurrence: recurrenceEnabled ? 'none' : recurrenceValue === 'none' ? 'weekly' : recurrenceValue
                  })
                }
                aria-pressed={recurrenceEnabled}
              >
                <span className="shell-nav-recurrence-head">
                  <span className="shell-nav-composer-inline-icon" aria-hidden="true">
                    <Repeat2 size={14} />
                  </span>
                  <span>Repeat</span>
                </span>
                <span className="shell-nav-ios-toggle-track" aria-hidden="true">
                  <span className="shell-nav-ios-toggle-thumb" />
                </span>
              </button>
              {recurrenceEnabled ? (
                <div className="shell-nav-recurrence-options" role="tablist" aria-label="Recurrence">
                  {[
                    ['daily', 'Day'],
                    ['weekly', 'Week'],
                    ['monthly', 'Month'],
                    ['custom', 'Custom']
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`shell-nav-recurrence-chip ${recurrenceValue === value ? 'active' : ''}`.trim()}
                      onClick={() => updateDraft({ recurrence: value as ShellComposerDraft['recurrence'] })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="shell-nav-composer-grid shell-nav-composer-grid-two">
            {(['start', 'end'] as const).map((field) => (
              <div key={field} className="shell-nav-picker-field-wrap">
                <button
                  type="button"
                  className={`shell-nav-composer-inline-field shell-nav-picker-trigger ${openPicker === field ? 'open' : ''}`.trim()}
                  onClick={() => setOpenPicker((prev) => (prev === field ? null : field))}
                >
                  <span className="shell-nav-composer-inline-icon" aria-hidden="true">
                    <Clock3 size={14} />
                  </span>
                  <span className="shell-nav-picker-value">
                    {formatTimeValue(field === 'start' ? composerDraft.startTime : composerDraft.endTime)}
                  </span>
                </button>
                {renderedPicker === field ? renderTimePicker(field) : null}
              </div>
            ))}
          </div>
          {recurrenceEnabled ? (
            <div className="shell-nav-composer-grid shell-nav-composer-grid-two">
              <div className="shell-nav-stepper">
                <span className="shell-nav-stepper-label">Every</span>
                <button
                  type="button"
                  className="shell-nav-stepper-btn"
                  onClick={() => updateDraft({ recurrenceInterval: Math.max(1, (composerDraft.recurrenceInterval || 1) - 1) })}
                  aria-label="Decrease repeat interval"
                >
                  <Minus size={14} />
                </button>
                <span className="shell-nav-stepper-value">{composerDraft.recurrenceInterval || 1}</span>
                <button
                  type="button"
                  className="shell-nav-stepper-btn"
                  onClick={() => updateDraft({ recurrenceInterval: (composerDraft.recurrenceInterval || 1) + 1 })}
                  aria-label="Increase repeat interval"
                >
                  <Plus size={14} />
                </button>
              </div>
              <button
                type="button"
                className={`shell-nav-ios-toggle ${composerDraft.includeWeekends !== false ? 'on' : ''}`.trim()}
                onClick={() => updateDraft({ includeWeekends: composerDraft.includeWeekends === false })}
                aria-pressed={composerDraft.includeWeekends !== false}
              >
                <span className="shell-nav-ios-toggle-copy">Include weekends</span>
                <span className="shell-nav-ios-toggle-track" aria-hidden="true">
                  <span className="shell-nav-ios-toggle-thumb" />
                </span>
              </button>
            </div>
          ) : null}
        </>
      );
    }

    if (composerDraft.type === 'item') {
      return (
        <div className="shell-nav-composer-grid shell-nav-composer-grid-two">
          <label className="shell-nav-composer-field">
            <select
              aria-label="Parent space"
              value={composerDraft.focalId || ''}
              onChange={(event) => updateDraft({ focalId: event.target.value || null, listId: null })}
            >
              <option value="">Select space</option>
              {focals.map((focal) => (
                <option key={focal.id} value={focal.id}>
                  {focal.name}
                </option>
              ))}
            </select>
          </label>
          <label className="shell-nav-composer-field">
            <select
              aria-label="Parent list"
              value={composerDraft.listId || ''}
              onChange={(event) => updateDraft({ listId: event.target.value || null })}
            >
              <option value="">Select list</option>
              {listsForComposer.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      );
    }

    if (composerDraft.type === 'task') {
      return (
        <>
          <div className="shell-nav-composer-grid shell-nav-composer-grid-two">
            <label className="shell-nav-composer-field">
              <select
                aria-label="Parent space"
                value={composerDraft.focalId || ''}
                onChange={(event) =>
                  updateDraft({ focalId: event.target.value || null, listId: null, parentItemId: null, parentItemQuery: '' })
                }
              >
                <option value="">Select space</option>
                {focals.map((focal) => (
                  <option key={focal.id} value={focal.id}>
                    {focal.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="shell-nav-composer-field">
              <select
                aria-label="Parent list"
                value={composerDraft.listId || ''}
                onChange={(event) => updateDraft({ listId: event.target.value || null, parentItemId: null, parentItemQuery: '' })}
              >
                <option value="">Select list</option>
                {listsForComposer.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="shell-nav-picker-field-wrap shell-nav-composer-field">
            <div className="shell-nav-composer-combobox">
              {parentItemQuery.trim() ? (
                <span className="shell-nav-composer-combobox-preview" aria-hidden="true">
                  <span className="shell-nav-composer-combobox-preview-prefix">{parentItemQuery}</span>
                  <span>{parentItemRemainder}</span>
                </span>
              ) : null}
              <input
                aria-label="Parent item"
                placeholder="Parent item"
                value={parentItemQuery}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  const exactMatch = itemsForComposer.find((item) => item.title.toLowerCase() === nextValue.trim().toLowerCase()) || null;
                  updateDraft({
                    parentItemQuery: nextValue,
                    parentItemId: exactMatch?.id || null
                  });
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (parentItemPrefixMatch) {
                      selectParentItem(parentItemPrefixMatch);
                    } else {
                      updateDraft({
                        parentItemId: null,
                        parentItemQuery: parentItemQuery.trim()
                      });
                    }
                  }
                }}
              />
              <button
                type="button"
                className="shell-nav-composer-combobox-toggle"
                aria-label="Use suggested parent item"
                onClick={() => {
                  if (parentItemPrefixMatch) {
                    selectParentItem(parentItemPrefixMatch);
                    return;
                  }
                  const firstItem = itemsForComposer[0];
                  if (firstItem) {
                    selectParentItem(firstItem);
                  }
                }}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </>
      );
    }

    if (composerDraft.type === 'list') {
      return composerDraft.lockedType ? null : (
        <label className="shell-nav-composer-field">
          <select
            aria-label="Parent space"
            value={composerDraft.focalId || ''}
            onChange={(event) => updateDraft({ focalId: event.target.value || null })}
          >
            <option value="">Select space</option>
            {focals.map((focal) => (
              <option key={focal.id} value={focal.id}>
                {focal.name}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (composerDraft.type === 'note') {
      return (
        <label className="shell-nav-composer-note-hint">
          Raw notes save into docs and can later be routed by AI into the right blocks, items, or tasks.
        </label>
      );
    }

    return null;
  };

  const renderNavPill = (): JSX.Element => (
    <nav className="shell-nav-pill" aria-label="Shell navigation preview">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="shell-nav-pill-item">
            <button
              type="button"
              className={`${item.key === 'home' ? 'active' : ''} ${item.key === 'nodes' && nodesPanelVisualState !== 'closed' ? 'active' : ''} ${item.key === 'profile' && accountPanelVisualState !== 'closed' ? 'active' : ''} ${!item.showLabel ? 'icon-only' : ''}`.trim()}
              onClick={() => {
                if (item.key === 'nodes') {
                  onComposerOpenChange(false);
                  setAccountPanelOpen(false);
                  setNodesPanelOpen((prev) => !prev);
                  return;
                }

                if (item.key === 'profile') {
                  onComposerOpenChange(false);
                  setNodesPanelOpen(false);
                  setAccountPanelOpen((prev) => !prev);
                  return;
                }

                setNodesPanelOpen(false);
                setAccountPanelOpen(false);
              }}
            >
              <Icon size={16} />
              {item.showLabel ? <span>{item.label}</span> : null}
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className={`shell-nav-pill-add ${composerOpen ? 'active' : ''}`.trim()}
        onClick={() => {
          setNodesPanelOpen(false);
          setAccountPanelOpen(false);
          if (composerOpen) {
            onComposerOpenChange(false);
            return;
          }
          onComposerFreshOpen();
        }}
        aria-label="Open quick add"
      >
        <AddSquareIcon size={18} strokeWidth={2.2} />
      </button>
    </nav>
  );

  const renderNodesPanel = (): JSX.Element | null => {
    if (nodesPanelVisualState === 'closed') return null;

    return (
      <section
        ref={nodesPanelRef}
        className="shell-nav-profile-panel shell-nav-profile-dock"
        data-visual-state={nodesPanelVisualState}
        aria-label="Nodes"
      >
        <div className="shell-nav-profile-dock-head">
          <strong>Nodes</strong>
        </div>
        <div className="shell-nav-profile-dock-icons">
          {installedNodes.length > 0 ? (
            <>
              {installedNodes.map((installedNode) => {
                const node = nodeCatalog.find((entry) => entry.id === installedNode.nodeId) || null;
                if (!node) return null;
                return (
                  <button
                    key={installedNode.nodeId}
                    type="button"
                    className="shell-nav-profile-node-icon"
                    onClick={() => {
                      setNodesPanelOpen(false);
                      onOpenNodeManager(installedNode.nodeId);
                    }}
                    aria-label={node.name}
                    title={node.name}
                  >
                    <span className="shell-nav-profile-node-icon-glyph" aria-hidden="true">
                      {node.iconKey === 'computer_dollar' ? <ComputerDollar size={16} strokeWidth={1.5} /> : <Compass size={16} />}
                    </span>
                    <span className="shell-nav-profile-node-icon-label">{formatInstalledNodeLabel(node.name)}</span>
                  </button>
                );
              })}
              <button
                type="button"
                className="shell-nav-profile-node-icon shell-nav-profile-node-icon-add"
                onClick={() => {
                  setNodesPanelOpen(false);
                  onOpenNodeManager();
                }}
                aria-label="Open node marketplace"
                title="Open node marketplace"
              >
                <span className="shell-nav-profile-node-icon-glyph" aria-hidden="true">
                  <Plus size={16} />
                </span>
              </button>
            </>
          ) : (
            <>
              <span className="shell-nav-profile-dock-empty">No nodes installed</span>
              <button
                type="button"
                className="shell-nav-profile-node-icon shell-nav-profile-node-icon-add"
                onClick={() => {
                  setNodesPanelOpen(false);
                  onOpenNodeManager();
                }}
                aria-label="Open node marketplace"
                title="Open node marketplace"
              >
                <span className="shell-nav-profile-node-icon-glyph" aria-hidden="true">
                  <Plus size={16} />
                </span>
              </button>
            </>
          )}
        </div>
      </section>
    );
  };

  const renderAccountPanel = (): JSX.Element | null => {
    if (accountPanelVisualState === 'closed') return null;

    return (
      <section
        ref={accountPanelRef}
        className="shell-nav-profile-panel shell-nav-account-panel"
        data-visual-state={accountPanelVisualState}
        aria-label="Profile"
      >
        <div className="shell-nav-profile-dock-head">
          <strong>Profile</strong>
        </div>
        <div className="shell-nav-account-actions">
          <button
            type="button"
            className="shell-nav-account-action"
            onClick={() => {
              setAccountPanelOpen(false);
              navigate('/calendar');
            }}
          >
            <span className="shell-nav-account-action-glyph" aria-hidden="true">
              <CalendarDays size={15} />
            </span>
            <span className="shell-nav-account-action-body">
              <span className="shell-nav-account-action-title">Old view</span>
              <span className="shell-nav-account-action-copy">Switch to the legacy calendar layout.</span>
            </span>
          </button>
          <button
            type="button"
            className="shell-nav-account-action"
            onClick={() => {
              setAccountPanelOpen(false);
            }}
          >
            <span className="shell-nav-account-action-glyph" aria-hidden="true">
              <Share2 size={15} />
            </span>
            <span className="shell-nav-account-action-body">
              <span className="shell-nav-account-action-title">Share Delta</span>
              <span className="shell-nav-account-action-copy">Share link coming soon.</span>
            </span>
          </button>
          <button
            type="button"
            className="shell-nav-account-action logout"
            onClick={() => void handleLogout()}
          >
            <span className="shell-nav-account-action-glyph" aria-hidden="true">
              <LogOut size={15} />
            </span>
            <span className="shell-nav-account-action-body">
              <span className="shell-nav-account-action-title">Log out</span>
              <span className="shell-nav-account-action-copy">Sign out of your Delta workspace.</span>
            </span>
          </button>
        </div>
      </section>
    );
  };

  const composerVisible = visualState === 'opening' || visualState === 'open' || visualState === 'closing';
  const isFreshQuickAdd = !composerDraft.lockedType && !composerDraft.sourceEventId;

  useEffect(() => {
    if (!composerVisible) return;
    setShowDetails(Boolean(composerDraft.lockedType || composerDraft.sourceEventId));
  }, [composerDraft.lockedType, composerDraft.sourceEventId, composerVisible]);

  useEffect(() => {
    if (!composerVisible) return;
    setShowSubitems(Boolean(composerDraft.subitems.some((entry) => entry.trim())));
  }, [composerDraft.subitems, composerVisible]);

  useEffect(() => {
    if (composerOpen) {
      setVisualState((prev) => (prev === 'open' ? prev : 'opening'));
      const frameId = window.requestAnimationFrame(() => {
        setVisualState('open');
      });
      return () => window.cancelAnimationFrame(frameId);
    }

    if (visualState === 'closed') {
      return undefined;
    }

    setVisualState('closing');
    const timeoutId = window.setTimeout(() => {
      setVisualState('closed');
    }, PANEL_ANIMATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [composerOpen]);

  useEffect(() => {
    if (nodesPanelOpen) {
      setNodesPanelVisualState((prev) => (prev === 'open' ? prev : 'opening'));
      const frameId = window.requestAnimationFrame(() => {
        setNodesPanelVisualState('open');
      });
      return () => window.cancelAnimationFrame(frameId);
    }

    if (nodesPanelVisualState === 'closed') {
      return undefined;
    }

    setNodesPanelVisualState('closing');
    const timeoutId = window.setTimeout(() => {
      setNodesPanelVisualState('closed');
    }, PANEL_ANIMATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [nodesPanelOpen, nodesPanelVisualState]);

  useEffect(() => {
    if (accountPanelOpen) {
      setAccountPanelVisualState((prev) => (prev === 'open' ? prev : 'opening'));
      const frameId = window.requestAnimationFrame(() => {
        setAccountPanelVisualState('open');
      });
      return () => window.cancelAnimationFrame(frameId);
    }

    if (accountPanelVisualState === 'closed') {
      return undefined;
    }

    setAccountPanelVisualState('closing');
    const timeoutId = window.setTimeout(() => {
      setAccountPanelVisualState('closed');
    }, PANEL_ANIMATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [accountPanelOpen, accountPanelVisualState]);

  useEffect(() => {
    if (openPicker) {
      setRenderedPicker(openPicker);
      setPickerVisualState((prev) => (prev === 'open' ? prev : 'opening'));
      const frameId = window.requestAnimationFrame(() => {
        setPickerVisualState('open');
      });
      return () => window.cancelAnimationFrame(frameId);
    }

    if (!renderedPicker || pickerVisualState === 'closed') {
      return undefined;
    }

    setPickerVisualState('closing');
    const timeoutId = window.setTimeout(() => {
      setPickerVisualState('closed');
      setRenderedPicker(null);
    }, PANEL_ANIMATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [openPicker, renderedPicker, pickerVisualState]);

  useEffect(() => {
    if (!composerVisible) return;
    const handlePointerDown = (event: MouseEvent): void => {
      if (composerRef.current && !composerRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement | null;
        const clickedOutsideLayout = Boolean(target?.closest('.shell-refactor-page')) && !target?.closest('.shell-layout');
        const clickedBareCenterBackground =
          Boolean(target?.closest('.shell-center')) &&
          !target?.closest(
            '.shell-current-card, .shell-upcoming-line, .shell-upcoming-sticky-add, .shell-space-panel, .shell-surface-panel, .shell-rail, .shell-nav-shell'
          );
        if (clickedOutsideLayout || clickedBareCenterBackground) {
          onComposerOpenChange(false);
        }
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [composerVisible, onComposerOpenChange]);

  useEffect(() => {
    if (nodesPanelVisualState === 'closed') return;
    const handlePointerDown = (event: MouseEvent): void => {
      if (nodesPanelRef.current && !nodesPanelRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement | null;
        if (target?.closest('.shell-refactor-page') && !target.closest('.shell-layout')) {
          setNodesPanelOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [nodesPanelVisualState]);

  useEffect(() => {
    if (accountPanelVisualState === 'closed') return;
    const handlePointerDown = (event: MouseEvent): void => {
      if (accountPanelRef.current && !accountPanelRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement | null;
        if (target?.closest('.shell-refactor-page') && !target.closest('.shell-layout')) {
          setAccountPanelOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [accountPanelVisualState]);

  return (
    <div className={`shell-nav-shell ${composerVisible ? 'open' : ''}`.trim()}>
      {renderNodesPanel()}
      {renderAccountPanel()}
      {composerVisible ? (
        <section ref={composerRef} className="shell-nav-composer" data-visual-state={visualState} aria-label="Quick add composer">
          {composerDraft.lockedType ? (
            <div className="shell-nav-composer-edit-head">
              <strong>{composerDraft.headerTitle || composerDraft.name || `New ${lockedTypeLabel.toLowerCase()}`}</strong>
            </div>
          ) : null}

          <label className="shell-nav-composer-field">
            <input
              placeholder={composerDraft.type === 'note' ? 'Title (optional)' : 'Name'}
              value={composerDraft.name}
              onChange={(event) => updateDraft({ name: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && isFreshQuickAdd && !showDetails && composerDraft.name.trim()) {
                  event.preventDefault();
                  setShowDetails(true);
                }
              }}
            />
          </label>

          {showDetails || !isFreshQuickAdd ? (
            <>
              <label className="shell-nav-composer-field">
                <textarea
                  rows={3}
                  placeholder={composerDraft.type === 'note' ? 'Write your note' : 'Description'}
                  value={composerDraft.description}
                  onChange={(event) => updateDraft({ description: event.target.value })}
                />
              </label>

              {renderTypeSpecificFields()}

              {composerDraft.type === 'time_block' ? (
                <div className="shell-nav-composer-subitems">
                  {showSubitems ? (
                    <div className="shell-nav-composer-subitem-list">
                      {composerDraft.subitems.map((subitem, index) => (
                        <div key={`subitem-${index}`} className="shell-nav-composer-subitem-row">
                          <span className="shell-nav-composer-subitem-icon" aria-hidden="true">
                            <CornerDownRight size={15} />
                          </span>
                          <input
                            placeholder={index === 0 ? 'Subitem' : `Subitem ${index + 1}`}
                            value={subitem}
                            onChange={(event) => updateSubitem(index, event.target.value)}
                          />
                        </div>
                      ))}
                      <button type="button" className="shell-nav-composer-subitem-add" onClick={addSubitem}>
                        <span className="shell-nav-composer-subitem-icon" aria-hidden="true">
                          <CornerDownRight size={15} />
                        </span>
                        <span>Add subitem</span>
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="shell-nav-composer-subitem-add" onClick={addSubitem}>
                      <span className="shell-nav-composer-subitem-icon" aria-hidden="true">
                        <CornerDownRight size={15} />
                      </span>
                      <span>Add subitem</span>
                    </button>
                  )}
                </div>
              ) : null}
            </>
          ) : null}

          <div className="shell-nav-composer-actions">
            {!composerDraft.lockedType ? (
              <div className="shell-nav-composer-type-row shell-nav-composer-type-row-footer">
                {[
                  ['time_block', 'Time block'],
                  ['space', 'Space'],
                  ['list', 'List'],
                  ['item', 'Item'],
                  ['task', 'Task']
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`shell-nav-composer-type ${composerDraft.type === value ? 'active' : ''}`.trim()}
                    onClick={() => updateDraft({ type: value as ShellComposerType })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="shell-nav-composer-actions-locked-label">
                <span className="shell-kicker">{lockedTypeLabel}</span>
              </div>
            )}
            <span className="shell-nav-composer-actions-divider" aria-hidden="true" />
            <button
              type="button"
              className="shell-nav-composer-primary"
              disabled={submitting || (!showDetails && isFreshQuickAdd && !composerDraft.name.trim())}
              onClick={async () => {
                if (isFreshQuickAdd && !showDetails) {
                  setShowDetails(true);
                  return;
                }
                setSubmitting(true);
                try {
                  await onComposerSubmit(composerDraft);
                  onComposerOpenChange(false);
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {isFreshQuickAdd && !showDetails ? (
                <>
                  Continue
                  <ArrowRight size={14} />
                </>
              ) : composerDraft.sourceEventId ? 'Save' : 'Create'}
            </button>
          </div>
        </section>
      ) : (
        renderNavPill()
      )}
      {composerVisible ? renderNavPill() : null}
    </div>
  );
}

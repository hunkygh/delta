import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Event } from '../../types/Event';

interface CalendarSurfacePanelProps {
  userId: string;
  events: Event[];
  selectedDate: Date;
  selectedEventId: string | null;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
  onSelectEvent: (eventId: string | null) => void;
  onSaveEvent: (event: Event) => Promise<Event>;
}

const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const dayKey = (value: Date): string =>
  `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;

const formatRange = (startIso: string, endIso: string): string => {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const format = (value: Date) =>
    value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  return `${format(start)} - ${format(end)}`;
};

export default function CalendarSurfacePanel({
  userId,
  events,
  selectedDate,
  selectedEventId,
  onClose,
  onSelectDate,
  onSelectEvent,
  onSaveEvent
}: CalendarSurfacePanelProps): JSX.Element {
  const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
  const leadingBlankDays = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const today = new Date();

  const selectedDateEvents = useMemo(() => {
    const selectedKey = dayKey(selectedDate);
    return [...events]
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .filter((event) => dayKey(new Date(event.start)) === selectedKey);
  }, [events, selectedDate]);

  const selectedEvent = selectedDateEvents.find((event) => event.id === selectedEventId) || null;
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedEvent) {
      setDraftTitle('');
      setDraftDescription('');
      setDraftStart('');
      setDraftEnd('');
      setSaveError(null);
      return;
    }

    setDraftTitle(selectedEvent.title || '');
    setDraftDescription(selectedEvent.description || '');
    setDraftStart(selectedEvent.start.slice(0, 16));
    setDraftEnd(selectedEvent.end.slice(0, 16));
    setSaveError(null);
  }, [selectedEvent]);

  const handleCreate = async (): Promise<void> => {
    const base = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 9, 0, 0, 0);
    const end = new Date(base.getTime() + 60 * 60 * 1000);
    const draft: Event = {
      id: crypto.randomUUID(),
      title: 'New time block',
      description: '',
      start: base.toISOString(),
      end: end.toISOString(),
      recurrence: 'none',
      recurrenceConfig: undefined,
      includeWeekends: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver',
      tasks: [],
      blockTasks: [],
      tags: []
    };

    setIsSaving(true);
    setSaveError(null);
    try {
      const saved = await onSaveEvent(draft);
      onSelectDate(new Date(saved.start));
      onSelectEvent(saved.id);
    } catch (error: any) {
      setSaveError(error?.message || 'Could not create time block');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSelected = async (): Promise<void> => {
    if (!selectedEvent) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const start = new Date(draftStart);
      const end = new Date(draftEnd);
      const safeStart = Number.isNaN(start.getTime()) ? new Date(selectedEvent.start) : start;
      const safeEnd =
        Number.isNaN(end.getTime()) || end.getTime() <= safeStart.getTime()
          ? new Date(safeStart.getTime() + 60 * 60 * 1000)
          : end;

      const saved = await onSaveEvent({
        ...selectedEvent,
        title: draftTitle.trim() || 'Untitled block',
        description: draftDescription,
        start: safeStart.toISOString(),
        end: safeEnd.toISOString(),
        timezone: selectedEvent.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver'
      });
      onSelectDate(new Date(saved.start));
      onSelectEvent(saved.id);
    } catch (error: any) {
      setSaveError(error?.message || 'Could not save time block');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="shell-surface-panel shell-surface-panel-dark shell-surface-panel-calendar" aria-label="Calendar">
      <div className="shell-surface-panel-head shell-surface-panel-head-dark">
        <div>
          <span className="shell-kicker">Calendar</span>
          <h2>{selectedDate.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h2>
        </div>
        <button type="button" className="shell-surface-panel-close shell-surface-panel-close-dark" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="shell-surface-panel-body shell-surface-panel-body-dark">
        <div className="shell-calendar-surface-layout">
          <section className="shell-calendar-surface-picker">
            <div className="shell-calendar-surface-month-bar">
              <button
                type="button"
                className="shell-calendar-surface-month-btn"
                onClick={() => onSelectDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))}
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <strong>{selectedDate.toLocaleDateString([], { month: 'long' })}</strong>
              <button
                type="button"
                className="shell-calendar-surface-month-btn"
                onClick={() => onSelectDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))}
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="shell-calendar-surface-weekdays" aria-hidden="true">
              {weekdayLabels.map((label, index) => (
                <span key={`${label}-${index}`}>{label}</span>
              ))}
            </div>

            <div className="shell-calendar-surface-grid">
              {Array.from({ length: leadingBlankDays }).map((_, index) => (
                <span key={`blank-${index}`} className="shell-calendar-surface-empty" />
              ))}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const cellDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
                const isSelected = dayKey(cellDate) === dayKey(selectedDate);
                const isToday = dayKey(cellDate) === dayKey(today);

                return (
                  <button
                    key={day}
                    type="button"
                    className={`shell-calendar-surface-day ${isSelected ? 'selected' : ''} ${isToday ? 'current' : ''}`.trim()}
                    onClick={() => {
                      onSelectDate(cellDate);
                      onSelectEvent(null);
                    }}
                    aria-pressed={isSelected}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="shell-calendar-surface-agenda">
            <div className="shell-calendar-surface-agenda-head">
              <div>
                <span className="shell-kicker">
                  {selectedEvent ? 'Selected block' : 'Scheduled items'}
                </span>
                <strong>
                  {selectedEvent
                    ? selectedEvent.title
                    : selectedDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                </strong>
                <p className="shell-calendar-surface-agenda-meta">
                  {selectedEvent
                    ? formatRange(selectedEvent.start, selectedEvent.end)
                    : selectedDateEvents.length > 0
                      ? `${selectedDateEvents.length} item${selectedDateEvents.length === 1 ? '' : 's'} on deck`
                      : 'Nothing scheduled yet'}
                </p>
              </div>
              <button type="button" className="shell-calendar-surface-add-btn" onClick={() => void handleCreate()} disabled={isSaving}>
                + Add
              </button>
            </div>

            <div className={`shell-calendar-surface-agenda-stage ${selectedEvent ? 'detail-open' : ''}`.trim()}>
              <div className="shell-calendar-surface-agenda-list">
                {selectedDateEvents.length > 0 ? (
                  selectedDateEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className={`shell-calendar-surface-agenda-row ${selectedEventId === event.id ? 'selected' : ''}`.trim()}
                      onClick={() => onSelectEvent(event.id)}
                    >
                      <div>
                        <strong>{event.title}</strong>
                        <span>{event.description?.trim() || 'Scheduled block'}</span>
                      </div>
                      <time>{formatRange(event.start, event.end)}</time>
                    </button>
                  ))
                ) : (
                  <div className="shell-calendar-surface-empty-state">
                    <strong>Nothing scheduled for this day</strong>
                    <span>Select another date or start shaping the day from the shell.</span>
                  </div>
                )}
              </div>

              <aside className="shell-calendar-surface-detail">
                {selectedEvent ? (
                  <div className="shell-calendar-surface-detail-card">
                    <div className="shell-calendar-surface-detail-head">
                      <button type="button" className="shell-calendar-surface-detail-back" onClick={() => onSelectEvent(null)}>
                        Calendar / {selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </button>
                      <span>{selectedEvent.timezone || userId}</span>
                    </div>

                    <label className="shell-calendar-surface-field">
                      <span>Title</span>
                      <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
                    </label>

                    <label className="shell-calendar-surface-field">
                      <span>Description</span>
                      <textarea
                        rows={5}
                        value={draftDescription}
                        onChange={(event) => setDraftDescription(event.target.value)}
                      />
                    </label>

                    <div className="shell-calendar-surface-field-row">
                      <label className="shell-calendar-surface-field">
                        <span>Start</span>
                        <input type="datetime-local" value={draftStart} onChange={(event) => setDraftStart(event.target.value)} />
                      </label>
                      <label className="shell-calendar-surface-field">
                        <span>End</span>
                        <input type="datetime-local" value={draftEnd} onChange={(event) => setDraftEnd(event.target.value)} />
                      </label>
                    </div>

                    {saveError ? <p className="shell-calendar-surface-error">{saveError}</p> : null}

                    <div className="shell-calendar-surface-detail-actions">
                      <button type="button" className="shell-calendar-surface-detail-secondary" onClick={() => onSelectEvent(null)}>
                        Close
                      </button>
                      <button type="button" className="shell-calendar-surface-detail-primary" onClick={() => void handleSaveSelected()} disabled={isSaving}>
                        {isSaving ? 'Saving…' : 'Save block'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </aside>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
